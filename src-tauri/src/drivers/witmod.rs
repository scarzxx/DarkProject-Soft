use super::{vendor::*, DriverDescriptor};
use crate::models::MacroEvent;
use serde_json::{json, Value};
pub const DRIVER: DriverDescriptor = DriverDescriptor {
    router_id: "WitmodSeries",
    implemented: true,
};
pub struct Driver;
const EFFECTS: &[(u8, u8)] = &[
    (0, 2),
    (1, 4),
    (2, 0),
    (3, 9),
    (4, 7),
    (5, 13),
    (6, 3),
    (7, 1),
    (8, 0),
    (9, 8),
    (10, 6),
    (11, 7),
    (12, 0),
    (13, 5),
    (14, 15),
    (15, 14),
    (16, 11),
    (17, 16),
    (18, 12),
    (19, 10),
];

fn packet(command: u8, index: u8, number: u8, args: &[u8]) -> Vec<u8> {
    let mut data = vec![0; 63];
    data[0] = command;
    data[1] = index;
    data[3] = number;
    data[4] = args.len() as u8;
    data[5..5 + args.len()].copy_from_slice(args);
    data
}

fn read(command: u8, index: u8, end: InputEnd) -> Step {
    input(
        1,
        packet(command, index, 0, &[]),
        vec![command, index],
        end,
        100,
        false,
    )
}

fn collected(replies: &[Vec<u8>], width: usize) -> Result<Vec<u8>> {
    let mut data = Vec::new();
    for r in replies {
        require(r, 5 + width)?;
        data.extend_from_slice(&r[5..5 + width]);
    }
    Ok(data)
}

pub fn decode_lighting(data: &[u8]) -> Result<Value> {
    require(data, 16)?;
    let effect = effect_from_wire(data[5], EFFECTS)?;
    let dir = match effect {
        0 => direction(data[14], &[0, 2, 1, 3])?,
        1 => direction(data[14], &[1, 0])?,
        14 | 18 => {
            if data[14] == 2 {
                0
            } else if data[14] == 3 {
                1
            } else {
                return unsupported("Witmod decoded direction");
            }
        }
        _ => match data[14] {
            0 => 0,
            32 => 1,
            16 => 2,
            48 => 3,
            _ => return unsupported("Witmod decoder default direction"),
        },
    };
    let color = if [7, 8, 9, 10, 29, 30, 32].contains(&effect) {
        Some([data[8], data[9], data[10]])
    } else {
        None
    };
    Ok(lighting(
        effect,
        u16::from(data[6]) * 25,
        (u16::from(data[7]) + 1) * 20,
        dir,
        data[15] == 1,
        color,
    ))
}

pub fn decode_version(data: &[u8]) -> Result<Value> {
    let length = data.iter().take(110).filter(|b| **b != 0).count();
    let bytes = data
        .iter()
        .take(length)
        .copied()
        .filter(|b| (32..=126).contains(b))
        .collect::<Vec<_>>();
    let text = String::from_utf8_lossy(&bytes);
    let suffix = text.rsplit(',').next().unwrap_or_default();
    let version = suffix.get(1..).unwrap_or_default().replace('_', ".");
    Ok(json!(version
        .split('.')
        .take(3)
        .collect::<Vec<_>>()
        .join(".")
        .trim()))
}

impl Codec for Driver {
    fn encode(&self, request: &Request, model: &WireModel) -> Result<Vec<Step>> {
        let short = |full, max| InputEnd::Short {
            offset: 4,
            full,
            max,
        };
        Ok(match request {
            Request::Version => vec![read(13, 0, InputEnd::Packet { offset: 3, last: 1 })],
            Request::ReadLighting => vec![read(7, 1, InputEnd::One)],
            Request::Lighting(settings) => {
                let effect = levels(settings, EFFECTS)?;
                if settings.effect == 19 {
                    return unsupported("Witmod custom lighting requires per-key colors");
                }
                let mut data = vec![0; 14];
                data[0] = effect;
                data[1] = percent(settings.brightness, 4);
                data[2] = percent(settings.speed, 5).wrapping_sub(1);
                data[3..6].copy_from_slice(&settings.color);
                data[9] = match settings.effect {
                    0 => direction(settings.direction, &[0, 2, 1, 3])?,
                    1 => direction(settings.direction, &[1, 0])?,
                    14 | 18 => direction(settings.direction, &[2, 3])?,
                    _ => 0,
                };
                data[10] = u8::from(settings.multi_color);
                vec![output(1, packet(7, 0, 0, &data), 10)]
            }
            Request::Snap { enabled, pairs } => {
                if pairs.len() > 20 {
                    return Err("Witmod Snap Tap maximum is 20 pairs".into());
                }
                let mut data = [0; 80];
                for (i, p) in pairs.iter().enumerate() {
                    data[i * 4..i * 4 + 4].copy_from_slice(&[1, p.kind, p.key1, p.key2]);
                }
                vec![
                    output(1, packet(36, 0, 0, &data[..40]), 10),
                    output(1, packet(36, 0, 1, &data[40..]), 10),
                    output(1, packet(36, 3, 0, &[u8::from(*enabled)]), 10),
                ]
            }
            Request::CustomLighting { settings, colors } if settings.effect == 19 => {
                levels(settings, EFFECTS)?;
                let mut data = vec![0; 396];
                for pixel in colors {
                    if pixel.slot >= model.led_codes.len() {
                        return Err("Invalid Witmod color slot".into());
                    }
                    if data.len() < pixel.slot * 3 + 3 {
                        data.resize(pixel.slot * 3 + 3, 0);
                    }
                    data[pixel.slot * 3..pixel.slot * 3 + 3].copy_from_slice(&pixel.color);
                }
                data.chunks(54)
                    .enumerate()
                    .map(|(i, c)| output(1, packet(9, 0, i as u8, c), 10))
                    .collect()
            }
            Request::ReadSnap => vec![
                read(36, 2, InputEnd::One),
                read(36, 1, InputEnd::Packet { offset: 3, last: 1 }),
            ],
            Request::ReadKeys { layer } if *layer <= 1 => {
                vec![read(24, 128 + *layer * 2, short(56, 16))]
            }
            Request::WriteKeys { layer, data }
                if *layer <= 1
                    && data.len() == model.button_defaults.len()
                    && data.len() >= 407 =>
            {
                let mut data = data.clone();
                if *layer == 1 {
                    data[404..407].copy_from_slice(&[26, 0, 1]);
                }
                data.chunks(56)
                    .enumerate()
                    .map(|(i, c)| output(1, packet(24, *layer * 2, i as u8, c), 10))
                    .collect()
            }
            Request::ReadMacro { id } if *id < 10 => vec![read(25, 128 + *id, short(58, 5))],
            Request::MacroTable(items) if !items.is_empty() && items.len() <= 10 => {
                let mut steps = vec![Step::Delay(100)];
                let mut ids = std::collections::BTreeSet::new();
                for item in items {
                    if !ids.insert(item.id) {
                        return Err("Duplicate Witmod macro slot".into());
                    }
                    let data = self.macro_data(item.id, &item.name, &item.events)?;
                    for (i, c) in data.chunks(58).enumerate() {
                        steps.push(output(1, packet(25, item.id, i as u8, c), 10));
                    }
                    steps.push(Step::Delay(100));
                }
                // Vendor clears the trailing slots by list length, not by highest ID.
                if items
                    .iter()
                    .enumerate()
                    .any(|(i, item)| item.id as usize != i)
                {
                    return unsupported("Witmod complete macro table must be densely ordered");
                }
                for id in items.len()..10 {
                    for i in 0..5 {
                        steps.push(output(
                            1,
                            packet(25, id as u8, i, &vec![0; if i == 4 { 24 } else { 58 }]),
                            10,
                        ));
                    }
                    steps.push(Step::Delay(100));
                }
                steps
            }
            _ => {
                return unsupported(
                    "Witmod operation: single-macro write would erase unrelated macro slots",
                )
            }
        })
    }
    fn decode(&self, request: &Request, replies: &[Vec<u8>], _offset: usize) -> Result<Value> {
        match request {
            Request::Version => decode_version(&collected(replies, 58)?),
            Request::ReadLighting => decode_lighting(last(replies)?),
            Request::ReadSnap => {
                let status = replies.first().ok_or("Missing Snap Tap status")?;
                require(status, 6)?;
                let data = collected(&replies[1..], 40)?;
                let pairs = data
                    .as_chunks::<4>()
                    .0
                    .iter()
                    .take_while(|p| p[2] != 0)
                    .map(|p| json!({"kind":p[1],"key1":p[2],"key2":p[3]}))
                    .collect::<Vec<_>>();
                Ok(json!({"enabled":status[5]==1,"pairs":pairs}))
            }
            Request::ReadKeys { .. } => Ok(json!(collected(replies, 56)?
                .as_chunks::<4>()
                .0
                .iter()
                .map(|p| p.to_vec())
                .collect::<Vec<_>>())),
            Request::ReadMacro { .. } => {
                let data = collected(replies, 58)?;
                require(&data, 8)?;
                if data[3] % 4 != 0 {
                    return Err("Invalid Witmod macro size".into());
                }
                require(&data, 8 + data[3] as usize)?;
                let mut events = Vec::new();
                for p in data[8..8 + data[3] as usize].as_chunks::<4>().0 {
                    if p[0] == 0 {
                        break;
                    }
                    if p[0] == 255 {
                        continue;
                    }
                    let high = if p[2] >= 128 {
                        u16::from(p[2] - 128) * 256
                    } else {
                        0
                    };
                    events
                        .push(json!({"hid":p[0],"delay":high+u16::from(p[3]),"pressed":p[1]>=16}));
                }
                Ok(
                    json!({"events":events,"repeatType":data[1],"repeatTime":if data[1]==1 {u16::from_be_bytes([data[4],data[5]])}else{0}}),
                )
            }
            _ => Ok(Value::Null),
        }
    }
    fn macro_data(&self, id: u8, _name: &str, events: &[MacroEvent]) -> Result<Vec<u8>> {
        if id >= 10 || events.len() > 62 {
            return Err("Witmod macro exceeds slot or 62-event limit".into());
        }
        let mut data = vec![0; 256];
        data[0] = id;
        data[3] = (events.len() * 4) as u8;
        for (i, e) in events.iter().enumerate() {
            let delay = events.get(i + 1).map_or(1, |next| next.delay);
            data[8 + i * 4..12 + i * 4].copy_from_slice(&[
                e.hid,
                if e.pressed { 16 } else { 0 },
                (delay >> 8) as u8,
                delay as u8,
            ]);
        }
        Ok(data)
    }
}
