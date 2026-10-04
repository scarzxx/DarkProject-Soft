use super::{hfd_packets as packets, vendor::*, DriverDescriptor};
use crate::models::MacroEvent;
use serde_json::{json, Value};
pub const DRIVER: DriverDescriptor = DriverDescriptor {
    router_id: "HFDKBRGBSeries",
    implemented: true,
};
pub struct Driver;

impl Codec for Driver {
    fn encode(&self, request: &Request, model: &WireModel) -> Result<Vec<Step>> {
        Ok(match request {
            Request::Clock(_)=>return unsupported("HFD RGB ApplyTimeSyns is empty in the vendor bundle"),
            Request::Version=>vec![packets::ack(16,56,0,&[])],
            Request::ReadLighting=>vec![packets::ack(19,56,0,&[])],
            Request::Lighting(settings)=>vec![packets::ack(35,56,0,&packets::payload(settings,true)?)],
            Request::ReadSnap=>vec![packets::ack(17,56,0,&[])],
            Request::ReadCustom if !model.led_codes.is_empty()=> {
                let length=model.led_codes.len()*4;let count=length.div_ceil(56);
                (0..count).map(|i|packets::ack(20,if i+1==count{(length%56) as u16}else{56},(i*56) as u16,&[])).collect()
            }
            Request::CustomLighting{settings,colors} if settings.effect==19=> {
                if settings.brightness>100 || settings.speed>100{return Err("Brightness and speed must be 0..100".into());}
                let mut data=vec![0;504];
                for slot in 0..model.led_codes.len().min(126){data[4*slot]=slot as u8;}
                for pixel in colors {
                    if pixel.slot>=126 || pixel.slot>=model.led_codes.len(){return unsupported("HFD RGB color slot outside vendor's 504-byte table");}
                    data[4*pixel.slot+1..4*pixel.slot+4].copy_from_slice(&pixel.color);
                }
                let mut steps=data.chunks(56).enumerate().map(|(i,c)|packets::ack(36,56,(i*56) as u16,c)).collect::<Vec<_>>();
                let mut setting=settings.clone();setting.effect=8;
                let mut payload=packets::payload(&setting,true)?;payload[0]=20;
                steps.push(packets::ack(35,56,0,&payload));steps
            }
            Request::ReadKeys{layer} if *layer<=1 && !model.led_codes.is_empty()=> {
                let length=model.led_codes.len()*4;let count=length.div_ceil(56);
                (0..count).map(|i|packets::ack(if *layer==0{18}else{22},
                    if i+1==count {(length%56) as u16}else{56},(i*56) as u16,&[])).collect()
            }
            Request::WriteKeys{layer,data} if *layer<=1 && data.len()==512=>data.chunks(56).enumerate()
                .map(|(i,c)|packets::ack(if *layer==0 {34}else{38},c.len() as u16,(i*56) as u16,c)).collect(),
            Request::ReadMacro{id:0}=> (0..55).map(|i|packets::ack(21,if i==54{48}else{56},i*56,&[])).collect(),
            Request::MacroTable(items)=> {
                let data=macro_table(self,items)?;
                if data.len()>3072 {return Err("HFD RGB macro table exceeds 3072 bytes".into());}
                data.chunks(56).enumerate().map(|(i,c)|packets::ack(37,56,(i*56) as u16,c)).collect()
            }
            Request::SnapWithKeys{enabled,pairs,keys}=> {
                let data=packets::snap_keys(model,keys,pairs)?;
                let mut status=vec![0;56];status[4]=2;status[5]=3;status[8]=u8::from(*enabled);
                let mut steps=vec![packets::ack(33,56,0,&status)];
                steps.extend(self.encode(&Request::WriteKeys{layer:0,data},model)?);steps
            }
            _=>return unsupported("HFD RGB operation: macro writes require the whole ordered macro table; Snap Tap pairs require both key tables"),
        })
    }
    fn decode(&self, request: &Request, replies: &[Vec<u8>], _offset: usize) -> Result<Value> {
        match request {
            Request::Version => {
                let r = last(replies)?;
                require(r, 18)?;
                Ok(json!(format!("{:x}.{:02x}", r[17], r[16])))
            }
            Request::ReadLighting => {
                let r = last(replies)?;
                require(r, 24)?;
                packets::decode_lighting(&r[8..], true)
            }
            Request::ReadSnap => {
                let r = last(replies)?;
                require(r, 16)?;
                Ok(json!({"enabled":r[15]==1}))
            }
            Request::ReadKeys { .. } | Request::ReadMacro { .. } | Request::ReadCustom => {
                let mut data = Vec::new();
                for r in replies {
                    require(r, 64)?;
                    data.extend_from_slice(&r[8..64]);
                }
                if matches!(request, Request::ReadKeys { .. }) {
                    Ok(json!(data
                        .as_chunks::<4>()
                        .0
                        .iter()
                        .map(|p| p.to_vec())
                        .collect::<Vec<_>>()))
                } else if matches!(request, Request::ReadCustom) {
                    Ok(json!(data
                        .as_chunks::<4>()
                        .0
                        .iter()
                        .filter(|p| p[1..].iter().any(|v| *v != 0))
                        .map(|p| json!({"slot":p[0],"color":&p[1..]}))
                        .collect::<Vec<_>>()))
                } else {
                    decode_macros(&data[..data.len().min(3072)])
                }
            }
            _ => Ok(Value::Null),
        }
    }
    fn macro_data(&self, _id: u8, _name: &str, events: &[MacroEvent]) -> Result<Vec<u8>> {
        if events.len() > 668 {
            return Err("HFD RGB macro exceeds macro storage".into());
        }
        let mut data = vec![0; 4];
        data[..2].copy_from_slice(&((events.len() * 2) as u16).to_le_bytes());
        for e in events {
            data.extend_from_slice(&[
                e.delay as u8,
                (e.delay >> 8) as u8,
                e.hid,
                if e.pressed { 176 } else { 48 },
            ]);
        }
        Ok(data)
    }
}

fn decode_macros(data: &[u8]) -> Result<Value> {
    require(data, 400)?;
    let mut offset = 400;
    let mut macros = Vec::new();
    while offset + 4 <= data.len() {
        let size = u16::from_le_bytes([data[offset], data[offset + 1]]) as usize;
        if size == 0 {
            break;
        }
        if !size.is_multiple_of(2) {
            return Err("Invalid HFD RGB macro size".into());
        }
        offset += 4;
        let count = size / 2;
        require(data, offset + count * 4)?;
        let mut events = Vec::new();
        for p in data[offset..offset + count * 4].as_chunks::<4>().0 {
            if p[3] & 48 != 48 {
                return unsupported("HFD RGB non-keyboard macro record");
            }
            events.push(
                json!({"hid":p[2],"delay":u16::from_le_bytes([p[0],p[1]]),"pressed":p[3]&128!=0}),
            );
        }
        macros.push(events);
        offset += count * 4;
    }
    Ok(json!(macros))
}
