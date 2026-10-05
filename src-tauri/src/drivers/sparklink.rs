use super::{vendor::*, DriverDescriptor};
use crate::models::MacroEvent;
use serde_json::{json, Value};
pub const DRIVER: DriverDescriptor = DriverDescriptor {
    router_id: "SparkLinkSeries",
    implemented: true,
};
pub struct Driver;

fn effect(id: u8) -> Result<u8> {
    match id {
        8 | 20 => Ok(0),
        34..=52 => Ok(id - 33),
        53 => Ok(19),
        19 => Ok(21),
        _ => unsupported("Sparklink effect"),
    }
}

fn packet(command: u8, length: u8, args: &[u8]) -> Vec<u8> {
    let mut data = vec![0; 64];
    data[..3].copy_from_slice(&[92, length, command]);
    let last = if length > 0 && length <= 252 {
        args.get(length as usize - 1).copied().unwrap_or(0)
    } else {
        0
    };
    data[3] = 53u8
        .wrapping_add(92)
        .wrapping_add(length)
        .wrapping_add(command)
        .wrapping_add(last);
    data[4..4 + args.len().min(60)].copy_from_slice(&args[..args.len().min(60)]);
    data
}

pub fn decode_lighting(data: &[u8]) -> Result<Value> {
    require(data, 43)?;
    let effect = if data[37] & 1 == 0 {
        20
    } else {
        match data[39] {
            0 => 8,
            1..=19 => data[39] + 33,
            21 => 19,
            _ => return unsupported("Sparklink wire effect"),
        }
    };
    let color = if effect == 8 {
        Some([data[7], data[6], data[5]])
    } else {
        None
    };
    Ok(lighting(
        effect,
        u16::from(data[38]) * 25,
        u16::from(data[40]) * 25,
        if data[37] & 2 != 0 { 0 } else { 1 },
        data[42] == 7,
        color,
    ))
}

pub fn decode_version(data: &[u8]) -> Result<Value> {
    let count = data.iter().take(110).filter(|v| **v != 0).count();
    let text = String::from_utf8_lossy(&data[..count]);
    let parts = text.split('T').collect::<Vec<_>>();
    if parts.len() < 2 {
        return unsupported("Sparklink firmware string format");
    }
    Ok(json!(parts[parts.len() - 2]
        .rsplit("App V")
        .next()
        .unwrap_or_default()
        .trim()))
}

impl Codec for Driver {
    fn encode(&self, request: &Request, model: &WireModel) -> Result<Vec<Step>> {
        Ok(match request {
            Request::Version=>vec![input(0,packet(1,2,&[255,255]),vec![92,60,129],InputEnd::One,5,false)],
            Request::ReadLighting=> {
                let mut data=vec![0;44];data[43]=255;
                vec![input(0,packet(24,44,&data),vec![92],InputEnd::One,5,false)]
            }
            Request::Lighting(settings)=> {
                if settings.brightness>100 || settings.speed>100{return Err("Brightness and speed must be 0..100".into());}
                let wire=effect(settings.effect)?;
                if settings.effect==19{return unsupported("Sparklink custom lighting requires per-key colors");}
                let mut data=vec![0;44];data[0]=1;
                data[5..8].copy_from_slice(&[settings.color[2],settings.color[1],settings.color[0]]);
                data[37]=u8::from(settings.effect!=20) | direction(settings.direction,&[0,2])?;
                data[38]=percent(settings.brightness,4);data[39]=wire;data[40]=percent(settings.speed,4);
                data[42]=if settings.multi_color{7}else{0};data[43]=255;
                vec![output(0,packet(24,44,&data),10)]
            }
            Request::WriteKeys{layer,data} if *layer<=3 && !data.is_empty() && data.len()<=model.key_hids.len()*4 && data.len()%4==0=> {
                let count=data.len().div_ceil(56);
                (0..count).map(|i| {
                    let length=if i+1==count{data.len()%56}else{56};
                    let mut args=vec![0;60];args[0]=1;
                    args[1..1+length].copy_from_slice(&data[i*56..i*56+length]);
                    output(0,packet(35,57,&args),10)
                }).collect()
            }
            Request::ReadKeys{layer} if *layer<=3 && model.key_hids.len()==87 && model.key_hids.iter().all(Option::is_some)=> {
                let data=model.key_hids.iter().flat_map(|hid|[hid.unwrap_or(0),*layer,0,0]).collect::<Vec<_>>();
                let count=data.len().div_ceil(56);let mut steps=Vec::new();
                for (i,chunk) in data.chunks(56).enumerate() {
                    let mut args=vec![0;60];args[1..1+chunk.len()].copy_from_slice(chunk);
                    let receive=if i+1==count{Receive::Input{prefix:vec![92],end:InputEnd::Count(7),retry:false}}else{Receive::None};
                    steps.push(Step::Send{packet:Packet{channel:"output",report_id:0,data:packet(35,57,&args)},delay:5,receive});
                }steps
            }
            Request::BoundMacro{key,events} if *key!=0 && !events.is_empty()=> {
                if !model.key_hids.contains(&Some(*key)){return unsupported("Sparklink macro target is not a model key");}
                let data=self.macro_data(0,"",events)?;let mut steps=vec![Step::Delay(100)];
                let count=events.len().div_ceil(14);
                for i in 0..count {
                    let remaining=if i+1==count{events.len()%14}else{14};
                    let mut args=vec![0;60];args[..4].copy_from_slice(&[1,(i*14) as u8,1,remaining as u8]);
                    let length=(data.len()-i*56).min(56);args[4..4+length].copy_from_slice(&data[i*56..i*56+length]);
                    let mut encoded=packet(32,60,&args);
                    if i*56+55>=data.len(){encoded[3]=0;}
                    steps.push(output(0,encoded,10));steps.push(Step::Delay(50));
                }
                let mut args=vec![0;60];args[0]=1;
                args[1..13].copy_from_slice(&[*key,8,6,0,*key,17,0,1,*key,18,events.len() as u8,0]);
                steps.push(output(0,packet(35,57,&args),10));steps
            }
            Request::CustomLighting{settings,colors} if settings.effect==19=> {
                let mut setting=settings.clone();setting.effect=8;
                let mut steps=self.encode(&Request::Lighting(setting),model)?;
                if let Step::Send{packet,..}=&mut steps[0]{packet.data[43]=21;}
                if model.key_hids.len()*4>389 || model.key_hids.iter().any(Option::is_none){return unsupported("Sparklink custom key matrix");}
                let mut data=vec![255;389];
                for(i,hid)in model.key_hids.iter().enumerate(){data[4*i..4*i+4].copy_from_slice(&[hid.unwrap_or(0),0,0,0]);}
                for pixel in colors {
                    if pixel.slot>=model.key_hids.len(){return Err("Invalid Sparklink custom key slot".into());}
                    if model.key_codes[pixel.slot]=="Custom_Fnkey"{data[4*pixel.slot]=1;}
                    data[4*pixel.slot+1..4*pixel.slot+4].copy_from_slice(&pixel.color);
                }
                for chunk in data.chunks(56){let mut args=vec![255;60];args[0]=1;args[1..1+chunk.len()].copy_from_slice(chunk);
                    steps.push(output(0,packet(42,57,&args),10));}
                steps
            }
            Request::SnapTransition{pairs,previous} if !pairs.is_empty() && pairs.len()<=10 && previous.len()<=20=> {
                let mut args=vec![0;41];args[0]=1;
                for(i,pair)in pairs.iter().enumerate() {
                    if !model.key_hids.contains(&Some(pair.key1)) || !model.key_hids.contains(&Some(pair.key2)){
                        return unsupported("Sparklink Snap Tap model key");
                    }
                    args[1+i*4..5+i*4].copy_from_slice(&[pair.key1,pair.key2,pair.key2,pair.key1]);
                }
                let mut steps=vec![output(0,packet(44,(1+4*pairs.len()) as u8,&args),10),output(0,packet(0,4,&[97,1,255,255]),10)];
                let mut removed=Vec::new();
                if previous.len()>=pairs.len() {
                    for old in previous.iter().take(pairs.len()) {
                        for key in [old.key1,old.key2] {
                            if !pairs.iter().any(|pair|pair.key1==key || pair.key2==key){removed.extend_from_slice(&[key,8,0,0]);}
                        }
                    }
                }
                if !removed.is_empty() {
                    if removed.len()>56{return unsupported("Sparklink advanced-key cleanup exceeds one vendor packet");}
                    let mut args=vec![0;60];args[0]=1;args[1..1+removed.len()].copy_from_slice(&removed);
                    steps.push(output(0,packet(35,57,&args),10));
                }steps
            }
            _=>return unsupported("Sparklink operation: macros need their bound key; Snap Tap needs a complete advanced-key cleanup context"),
        })
    }
    fn decode(&self, request: &Request, replies: &[Vec<u8>], _offset: usize) -> Result<Value> {
        match request {
            Request::Version => {
                let data = last(replies)?;
                require(data, 46)?;
                decode_version(&data[30..46])
            }
            Request::ReadLighting => {
                let data = last(replies)?;
                require(data, 64)?;
                if data[2] != 152 {
                    return Err("Unexpected Sparklink lighting command".into());
                }
                decode_lighting(&data[4..])
            }
            Request::ReadKeys { .. } => {
                let mut data = Vec::new();
                for r in replies {
                    require(r, 61)?;
                    if r[2] != 163 {
                        return Err("Unexpected Sparklink key command".into());
                    }
                    data.extend_from_slice(&r[5..61]);
                }
                Ok(json!(data
                    .as_chunks::<4>()
                    .0
                    .iter()
                    .map(|p| p.to_vec())
                    .collect::<Vec<_>>()))
            }
            _ => Ok(Value::Null),
        }
    }
    fn macro_data(&self, _id: u8, _name: &str, events: &[MacroEvent]) -> Result<Vec<u8>> {
        if events.len() > 64 || events.iter().any(|e| e.delay > 32767) {
            return Err("Sparklink macro exceeds event/delay capacity".into());
        }
        let mut data = vec![0; 256];
        for record in data.as_chunks_mut::<4>().0 {
            record[3] = 128;
        }
        for (i, event) in events.iter().enumerate() {
            let delay = events.get(i + 1).map_or(1, |next| next.delay);
            data[i * 4] = event.hid;
            data[i * 4 + 2] = delay as u8;
            data[i * 4 + 3] =
                ((delay >> 8) as u8).wrapping_add(if event.pressed { 16 } else { 128 });
        }
        Ok(data)
    }
}
