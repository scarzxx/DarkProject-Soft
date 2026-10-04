use super::{hfd_packets as packets, vendor::*, DriverDescriptor};
use crate::models::MacroEvent;
use serde_json::{json, Value};
pub const DRIVER: DriverDescriptor = DriverDescriptor {
    router_id: "TFTKeyboardSeries",
    implemented: true,
};
pub struct Driver;

pub fn command(cmd: u8, length: u16) -> Step {
    let mut data = vec![0; 65];
    data[0] = 4;
    data[1] = cmd;
    data[8..10].copy_from_slice(&length.to_le_bytes());
    feature(data, 35, true)
}

/// Follow the vendor's ten-attempt prepare/ack/data/finish version transaction.
pub fn read_version<T: super::transport::HidTransport>(keyboard: &Keyboard<T>) -> Result<Value> {
    for _ in 0..10 {
        let mut replies = keyboard.execute_plan(vec![command(24, 0), command(5, 0)])?;
        let ack = last(&replies)?;
        require(ack, 5)?;
        if ack[4] != 1 {
            continue;
        }
        let version = keyboard.execute_plan(vec![Step::Feature { report_id: 0 }])?;
        let data = last(&version)?;
        require(data, 11)?;
        let valid = data[9] != 0 || data[8] != 0;
        replies.extend(version);
        replies.extend(keyboard.execute_plan(vec![command(2, 0)])?);
        if valid {
            return keyboard.codec.decode(&Request::Version, &replies, 0);
        }
    }
    unsupported("TFT firmware version after ten attempts")
}

impl Codec for Driver {
    fn encode(&self, request: &Request, _model: &WireModel) -> Result<Vec<Step>> {
        Ok(match request {
            Request::Clock(time)=>vec![command(24,0),command(40,1),clock(time,35)?,command(2,0)],
            Request::Version=>vec![command(24,0),command(5,0),Step::Feature{report_id:0},command(2,0)],
            Request::ReadLighting=>vec![Step::Delay(50),command(18,1),Step::Delay(10),Step::Feature{report_id:0}],
            Request::Lighting(settings)=> {
                let mut data=packets::payload(settings,false)?;data[4]=0;data.resize(256,0);
                vec![command(24,0),command(19,1),feature(data,35,false),command(2,0),command(240,0)]
            }
            Request::WriteKeys{layer,data} if *layer<=1 && data.len()==576=> {
                let mut steps=vec![command(24,0),command(if *layer==0 {17}else{39},9)];
                for chunk in data.chunks(64) {let mut data=chunk.to_vec();data.resize(65,0);steps.push(feature(data,35,false));}
                steps.push(command(2,0));steps
            }
            Request::MacroTable(items)=> {
                let data=macro_table(self,items)?;let mut steps=vec![command(21,9)];
                for chunk in data.chunks(64){let mut data=chunk.to_vec();data.resize(65,0);steps.push(feature(data,35,false));}
                steps.push(command(2,0));steps
            }
            _=>return unsupported("TFT operation: vendor key read has no decoder; generic macro read uses another format"),
        })
    }
    fn decode(&self, request: &Request, replies: &[Vec<u8>], _offset: usize) -> Result<Value> {
        match request {
            Request::Version => {
                let ack = replies
                    .get(1)
                    .ok_or("Missing TFT version acknowledgement")?;
                require(ack, 5)?;
                if ack[4] != 1 {
                    return Err("TFT firmware query was not acknowledged".into());
                }
                let data = replies.get(2).ok_or("Missing TFT version data")?;
                require(data, 11)?;
                if data[8] == 0 && data[9] == 0 {
                    return unsupported("TFT firmware version is absent");
                }
                Ok(json!(format!("{}.{:02}", data[10], data[9])))
            }
            Request::ReadLighting => {
                let data = last(replies)?;
                require(data, 17)?;
                if data[15] != 170 || data[16] != 85 {
                    return Err("Invalid TFT lighting signature".into());
                }
                packets::decode_lighting(&data[1..], false)
            }
            _ => Ok(Value::Null),
        }
    }
    fn macro_data(&self, _id: u8, _name: &str, events: &[MacroEvent]) -> Result<Vec<u8>> {
        packets::legacy_macro(events, 8)
    }
}
