use super::vendor::*;
use crate::models::{LightingSettings, MacroEvent};
use serde_json::Value;

pub const EFFECTS: &[(u8, u8)] = &[
    (8, 1),
    (10, 2),
    (4, 3),
    (3, 4),
    (13, 5),
    (2, 6),
    (7, 7),
    (6, 8),
    (23, 9),
    (24, 10),
    (25, 11),
    (1, 12),
    (11, 13),
    (28, 14),
    (27, 15),
    (26, 16),
    (12, 17),
    (22, 18),
    (21, 19),
    (20, 0),
    (19, 20),
];

pub fn payload(settings: &LightingSettings, rgb: bool) -> Result<Vec<u8>> {
    let wire = levels(settings, EFFECTS)?;
    if settings.effect == 19 {
        return unsupported("custom lighting needs family-native per-key colors");
    }
    let mut data = vec![0; 56];
    data[0] = wire;
    data[1..4].copy_from_slice(&settings.color);
    data[4] = 255;
    data[8] = u8::from(settings.multi_color && settings.effect != 8);
    let level = |value| {
        if !rgb {
            percent(value, 5)
        } else if value == 0 {
            1
        } else if value <= 25 {
            2
        } else if value <= 50 {
            3
        } else if value <= 75 {
            4
        } else {
            5
        }
    };
    data[9] = level(settings.brightness);
    data[10] = level(settings.speed);
    data[11] = match settings.effect {
        25 | 26 | 22 => direction(settings.direction, if rgb { &[0, 1] } else { &[1, 0] })?,
        24 => direction(settings.direction, if rgb { &[1, 0] } else { &[2, 3] })?,
        _ => 0,
    };
    data[14] = 170;
    data[15] = 85;
    Ok(data)
}

pub fn packet(command: u8, length: u16, address: u16, args: &[u8]) -> Vec<u8> {
    let mut data = vec![0; 64];
    data[..5].copy_from_slice(&[
        170,
        command,
        length as u8,
        address as u8,
        (address >> 8) as u8,
    ]);
    data[8..8 + args.len()].copy_from_slice(args);
    data
}

pub fn ack(command: u8, length: u16, address: u16, args: &[u8]) -> Step {
    input(
        0,
        packet(command, length, address, args),
        vec![
            85,
            command,
            length as u8,
            address as u8,
            (address >> 8) as u8,
        ],
        InputEnd::One,
        0,
        true,
    )
}

pub fn decode_lighting(data: &[u8], rgb: bool) -> Result<Value> {
    require(data, 16)?;
    let effect = effect_from_wire(data[0], EFFECTS)?;
    let dir = if rgb {
        match effect {
            25 | 26 | 22 => direction(data[11], &[1, 0])?,
            24 => direction(data[11], &[1, 0])?,
            _ => 0,
        }
    } else {
        0
    };
    let color = if rgb {
        if effect == 8 {
            Some([data[3], data[2], data[1]])
        } else {
            None
        }
    } else {
        Some([data[1], data[2], data[3]])
    };
    Ok(lighting(
        effect,
        u16::from(data[9]) * 20,
        u16::from(data[10]) * 20,
        dir,
        data[8] == 1,
        color,
    ))
}

pub fn legacy_macro(events: &[MacroEvent], header: usize) -> Result<Vec<u8>> {
    if events.is_empty() || events.len() > 128 {
        return Err("Invalid legacy macro length".into());
    }
    let mut data = vec![0; header];
    data[0] = (events.len() * 2 - 1) as u8;
    for (index, event) in events.iter().enumerate() {
        if index > 0 {
            data.extend_from_slice(&[event.delay as u8, (event.delay >> 8) as u8, 0, 80]);
        }
        data.extend_from_slice(&[0, 0, event.hid, if event.pressed { 176 } else { 48 }]);
    }
    Ok(data)
}

pub fn snap_keys(
    model: &WireModel,
    keys: &[u8],
    pairs: &[crate::models::SnapPair],
) -> Result<Vec<u8>> {
    if keys.len() != 512 || model.led_hids.is_empty() || pairs.len() > 20 {
        return unsupported("Snap Tap requires a complete known key table and LED matrix");
    }
    let mut data = keys.to_vec();
    for pair in pairs {
        let kind = direction(pair.kind, &[3, 1, 2, 4])?;
        for key in [pair.key1, pair.key2] {
            if key == 0 {
                return unsupported("Snap Tap key HID 0");
            }
            let slot = model
                .led_hids
                .iter()
                .position(|hid| *hid == Some(key))
                .ok_or("Unknown Snap Tap key")?;
            if slot >= 128 {
                return unsupported("Snap Tap key outside vendor binding table");
            }
            data[slot * 4..slot * 4 + 4].copy_from_slice(&[11, kind, pair.key1, pair.key2]);
        }
    }
    Ok(data)
}
