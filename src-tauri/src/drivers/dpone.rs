use super::{vendor::*, DriverDescriptor};
use crate::models::MacroEvent;
use serde_json::{json, Value};

pub const DRIVER: DriverDescriptor = DriverDescriptor {
    router_id: "DponeSeries",
    implemented: true,
};
pub struct Driver;
const EFFECTS: &[(u8, u8)] = &[
    (0, 0),
    (8, 1),
    (7, 2),
    (10, 3),
    (31, 4),
    (6, 5),
    (30, 6),
    (32, 7),
    (1, 8),
    (19, 10),
];

fn packet(command: u8, index: u8, length: u16, args: &[u8]) -> Vec<u8> {
    let mut data = vec![0; 520];
    data[4..6].copy_from_slice(&length.to_le_bytes());
    data[6] = command;
    data[7] = index;
    data[8..8 + args.len()].copy_from_slice(args);
    data
}

impl Codec for Driver {
    fn encode(&self, request: &Request, model: &WireModel) -> Result<Vec<Step>> {
        let query = |command, index, length| feature(packet(command, index, length, &[]), 50, true);
        let legacy = |command: u8, length: u16| {
            let mut data = vec![0; 65];
            data[0] = 4;
            data[1] = command;
            data[8..10].copy_from_slice(&length.to_le_bytes());
            feature(data, 50, true)
        };
        Ok(match request {
            Request::Clock(time) => {
                vec![legacy(24, 0), legacy(40, 1), clock(time, 50)?, legacy(2, 0)]
            }
            Request::Version => vec![query(129, 1, 83)],
            Request::ReadLighting => vec![query(132, 0, 1)],
            Request::Lighting(settings) => {
                let effect = levels(settings, EFFECTS)?;
                if settings.effect == 19 {
                    return unsupported("custom lighting requires a per-key color table");
                }
                let dir = match settings.effect {
                    0 => direction(settings.direction, &[0, 32, 16, 48])?,
                    1 | 31 => direction(settings.direction, &[0, 16])?,
                    _ => 0,
                };
                let args = [
                    percent(settings.brightness, 127),
                    255,
                    percent(settings.speed, 5).wrapping_sub(1) & 15
                        | dir
                        | if settings.multi_color { 128 } else { 0 },
                    settings.color[0],
                    settings.color[1],
                    settings.color[2],
                ];
                vec![
                    feature(packet(5, effect, 9, &args), 50, false),
                    feature(packet(4, 0, 1, &[effect]), 50, false),
                ]
            }
            Request::Snap { enabled, pairs } => {
                if pairs.len() > 40 {
                    return Err("DPONE Snap Tap maximum is 40 pairs".into());
                }
                let mut data = vec![u8::from(*enabled), pairs.len() as u8];
                for pair in pairs {
                    data.extend_from_slice(&[pair.key1, pair.key2, pair.kind]);
                }
                vec![feature(packet(11, 0, 122, &data), 50, true)]
            }
            Request::ReadSnap => vec![query(139, 1, 122)],
            Request::ReadCustom => vec![query(135, 0, 432)],
            Request::CustomLighting { settings, colors } if settings.effect == 19 => {
                levels(settings, EFFECTS)?;
                let mut data = vec![0; 512];
                for pixel in colors {
                    if pixel.slot >= model.led_codes.len() || pixel.slot >= 128 {
                        return Err("Invalid DPONE color slot".into());
                    }
                    data[pixel.slot * 4..pixel.slot * 4 + 3].copy_from_slice(&pixel.color);
                    data[pixel.slot * 4 + 3] = 112;
                }
                vec![
                    feature(packet(4, 0, 1, &[10]), 50, false),
                    feature(packet(7, 0, 432, &data), 50, false),
                ]
            }
            Request::ReadKeys { layer: 0 } => vec![query(137, 0, 218)],
            Request::WriteKeys { layer: 0, data } if data.len() == 512 => {
                vec![feature(packet(9, 0, 218, data), 50, false)]
            }
            Request::WriteKeys { layer: 1, data } if data.len() == 512 => {
                let mut steps = vec![legacy(24, 0), legacy(39, 9)];
                for chunk in data.chunks(64) {
                    let mut data = chunk.to_vec();
                    data.resize(65, 0);
                    steps.push(feature(data, 50, false));
                }
                steps.push(legacy(2, 0));
                steps
            }
            Request::ReadMacro { id } if *id < 10 => vec![query(138, *id, 367)],
            Request::WriteMacro { id, name, events } if *id < 10 => {
                let data = self.macro_data(*id, name, events)?;
                vec![feature(packet(10, *id, 367, &data), 50, false)]
            }
            _ => return unsupported("DPONE operation or family-native table size/layer"),
        })
    }
    fn decode(&self, request: &Request, replies: &[Vec<u8>], offset: usize) -> Result<Value> {
        if offset > 1 {
            return unsupported("DPONE response offset");
        }
        match request {
            Request::Version => {
                let data = last(replies)?;
                require(data, 86)?;
                if data[84] == 0 && data[85] == 0 {
                    return unsupported("DPONE firmware version is absent");
                }
                Ok(json!(format!("{:x}", data[offset + 84])))
            }
            Request::ReadLighting => {
                let first = replies.first().ok_or("Missing DPONE selected effect")?;
                require(first, 10)?;
                let effect = effect_from_wire(first[9], EFFECTS)?;
                let data = last(replies)?;
                require(data, offset + 14)?;
                let flags = data[offset + 10];
                let dir = match effect {
                    0 => match flags & 48 {
                        0 => 0,
                        32 => 1,
                        16 => 2,
                        48 => 3,
                        _ => unreachable!(),
                    },
                    1 | 31 => direction((flags & 48) >> 4, &[0, 1])?,
                    _ => 0,
                };
                let color = if [7, 8, 9, 10, 29, 30, 32].contains(&effect) {
                    Some([data[offset + 11], data[offset + 12], data[offset + 13]])
                } else {
                    None
                };
                Ok(lighting(
                    effect,
                    (u16::from(data[offset + 8]) * 100).div_ceil(127),
                    u16::from(flags.wrapping_add(1) & 15) * 20,
                    dir,
                    flags & 128 != 0,
                    color,
                ))
            }
            Request::ReadSnap => {
                let data = last(replies)?;
                require(data, offset + 10)?;
                let count = data[offset + 9] as usize;
                if count > 40 {
                    return Err("Invalid DPONE Snap Tap pair count".into());
                }
                require(data, offset + 10 + 3 * count)?;
                let pairs: Vec<_> = data[offset + 10..offset + 10 + 3 * count]
                    .as_chunks::<3>()
                    .0
                    .iter()
                    .map(|p| json!({"key1":p[0],"key2":p[1],"kind":p[2]}))
                    .collect();
                Ok(json!({"enabled":data[offset+8]==1,"pairs":pairs}))
            }
            Request::ReadKeys { .. } => {
                let data = last(replies)?;
                require(data, offset + 226)?;
                Ok(json!(data[offset + 8..offset + 226]
                    .as_chunks::<2>()
                    .0
                    .iter()
                    .map(|p| json!({"code":p[0],"kind":p[1]}))
                    .collect::<Vec<_>>()))
            }
            Request::ReadMacro { .. } => {
                let data = last(replies)?;
                require(data, offset + 48)?;
                let count = data[offset + 47] as usize;
                if count > 109 {
                    return Err("Invalid DPONE macro event count".into());
                }
                require(data, offset + 48 + 3 * count)?;
                let mut events = Vec::new();
                for p in data[offset + 48..offset + 48 + 3 * count]
                    .as_chunks::<3>()
                    .0
                {
                    if p[0] == 0 {
                        break;
                    }
                    let delay = u16::from(p[1])
                        + if p[2] >= 128 {
                            u16::from(p[2] - 128) * 256
                        } else {
                            0
                        };
                    events.push(json!({"hid":p[0],"delay":delay,"pressed":p[2]>=128}));
                }
                let bytes = &data[offset + 8..offset + 46];
                let count = bytes.iter().filter(|v| **v != 0).count();
                Ok(
                    json!({"name":String::from_utf8_lossy(&bytes[..count]),"repeat":data[offset+46],"events":events}),
                )
            }
            Request::ReadCustom => {
                let data = last(replies)?;
                require(data, offset + 440)?;
                Ok(json!(data[offset + 8..offset + 440]
                    .as_chunks::<4>()
                    .0
                    .iter()
                    .enumerate()
                    .filter(|(_, p)| p[..3].iter().any(|v| *v != 0))
                    .map(|(slot, p)| json!({"slot":slot,"color":&p[..3]}))
                    .collect::<Vec<_>>()))
            }
            _ => Ok(Value::Null),
        }
    }
    fn follow_up(&self, request: &Request, replies: &[Vec<u8>]) -> Result<Vec<Step>> {
        if matches!(request, Request::ReadLighting) {
            let data = last(replies)?;
            require(data, 10)?;
            effect_from_wire(data[9], EFFECTS)?;
            Ok(vec![feature(packet(133, data[9], 12, &[]), 50, true)])
        } else {
            Ok(Vec::new())
        }
    }
    fn macro_data(&self, _id: u8, name: &str, events: &[MacroEvent]) -> Result<Vec<u8>> {
        if events.len() > 109 || events.iter().any(|e| e.delay > 32767 || e.hid == 0) {
            return Err("DPONE macro exceeds 109 events or 15-bit delay".into());
        }
        let mut data = vec![0; 40];
        let length = name.len().min(38);
        data[..length].copy_from_slice(&name.as_bytes()[..length]);
        data[38] = 1;
        data[39] = events.len() as u8;
        for event in events {
            let delay = event.delay | if event.pressed { 32768 } else { 0 };
            data.extend_from_slice(&[event.hid, delay as u8, (delay >> 8) as u8]);
        }
        Ok(data)
    }
}
