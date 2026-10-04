use super::{hfd_packets as packets, vendor::*, DriverDescriptor};
use crate::models::MacroEvent;
use serde_json::{json, Value};
pub const DRIVER: DriverDescriptor = DriverDescriptor {
    router_id: "HFDKBSeries",
    implemented: true,
};
pub struct Driver;

impl Codec for Driver {
    fn encode(&self, request: &Request, model: &WireModel) -> Result<Vec<Step>> {
        let send = |cmd, length, address, data: &[u8]| {
            output(0, packets::packet(cmd, length, address, data), 35)
        };
        Ok(match request {
            Request::Clock(_) => {
                return unsupported("HFD ApplyTimeSyns is empty in the vendor bundle")
            }
            Request::Version => vec![input(
                0,
                packets::packet(16, 56, 0, &[]),
                vec![85, 16],
                InputEnd::One,
                35,
                false,
            )],
            Request::Lighting(settings) => {
                vec![send(35, 23, 0, &packets::payload(settings, false)?)]
            }
            Request::ReadLighting => vec![
                Step::Delay(50),
                send(18, 1, 0, &[]),
                Step::Delay(10),
                Step::Feature { report_id: 0 },
            ],
            Request::WriteKeys { layer, data } if *layer <= 1 && data.len() == 512 => {
                let mut steps = vec![send(48, 56, 0, &[])];
                for (index, chunk) in data.chunks(56).enumerate() {
                    steps.push(send(
                        if *layer == 0 { 34 } else { 38 },
                        chunk.len() as u16,
                        (index * 56) as u16,
                        chunk,
                    ));
                }
                steps.push(send(49, 56, 0, &[]));
                steps
            }
            Request::MacroTable(items) => {
                let data = macro_table(self, items)?;
                let mut steps = vec![send(48, 56, 0, &[])];
                for (i, chunk) in data.chunks(56).enumerate() {
                    steps.push(send(37, 56, (i * 56) as u16, chunk));
                }
                steps.push(send(49, 56, 0, &[]));
                steps
            }
            Request::SnapWithKeys {
                enabled,
                pairs,
                keys,
            } if *enabled || pairs.is_empty() => self.encode(
                &Request::WriteKeys {
                    layer: 0,
                    data: packets::snap_keys(model, keys, pairs)?,
                },
                model,
            )?,
            _ => {
                return unsupported(
                    "HFD operation: vendor key/macro read methods do not decode a table",
                )
            }
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
                require(r, 17)?;
                if r[15] != 170 || r[16] != 85 {
                    return Err("Invalid HFD lighting signature".into());
                }
                packets::decode_lighting(&r[1..], false)
            }
            _ => Ok(Value::Null),
        }
    }
    fn macro_data(&self, _id: u8, _name: &str, events: &[MacroEvent]) -> Result<Vec<u8>> {
        packets::legacy_macro(events, 4)
    }
}
