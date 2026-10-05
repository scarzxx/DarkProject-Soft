use super::{
    transport::HidTransport,
    vendor::{self, Keyboard, MacroRecord, Request},
};
use crate::models::{MacroDefinition, MacroEvent, RawKeyBinding};
use serde::Deserialize;
use serde_json::Value;
use std::{collections::HashMap, sync::OnceLock};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LayoutRecord {
    style_name: String,
    slot_mapping: HashMap<String, usize>,
}

#[derive(Deserialize)]
struct PairRecord {
    code: u8,
    kind: u8,
}

static LAYOUTS: OnceLock<Result<HashMap<String, HashMap<String, usize>>, String>> = OnceLock::new();

fn layout_registry() -> vendor::Result<&'static HashMap<String, HashMap<String, usize>>> {
    LAYOUTS
        .get_or_init(|| {
            let layouts: Vec<LayoutRecord> = serde_json::from_str(include_str!(
                "../../../registry/layouts.json"
            ))
            .map_err(|error| format!("Invalid keyboard layout registry: {error}"))?;
            Ok(layouts
                .into_iter()
                .map(|layout| (layout.style_name, layout.slot_mapping))
                .collect())
        })
        .as_ref()
        .map_err(Clone::clone)
}

fn protocol_codes<T: HidTransport>(keyboard: &Keyboard<T>) -> &[String] {
    if keyboard.metadata.router_id == "SparkLinkSeries" {
        &keyboard.model.key_codes
    } else {
        &keyboard.model.led_codes
    }
}

fn visual_slot<T: HidTransport>(keyboard: &Keyboard<T>, native_slot: usize) -> usize {
    let Ok(layouts) = layout_registry() else {
        return native_slot;
    };
    protocol_codes(keyboard)
        .get(native_slot)
        .and_then(|code| layouts.get(&keyboard.metadata.style_name)?.get(code))
        .copied()
        .unwrap_or(native_slot)
}

fn native_slot<T: HidTransport>(keyboard: &Keyboard<T>, visual_slot: usize) -> vendor::Result<usize> {
    let layouts = layout_registry()?;
    let slots = layouts
        .get(&keyboard.metadata.style_name)
        .ok_or("Missing exact layout slot mapping")?;
    protocol_codes(keyboard)
        .iter()
        .position(|code| slots.get(code).copied() == Some(visual_slot))
        .ok_or_else(|| "Selected key has no exact vendor protocol slot".into())
}

fn four_byte_rows(value: Value) -> vendor::Result<Vec<[u8; 4]>> {
    let rows: Vec<Vec<u8>> = serde_json::from_value(value)
        .map_err(|error| format!("Invalid family key table: {error}"))?;
    rows.into_iter()
        .map(|row| {
            row.as_slice()
                .try_into()
                .map_err(|_| "Invalid four-byte key record".into())
        })
        .collect()
}

fn pair_rows(value: Value) -> vendor::Result<Vec<PairRecord>> {
    serde_json::from_value(value).map_err(|error| format!("Invalid DPONE key table: {error}"))
}

fn decode_pair(slot: usize, pair: &PairRecord) -> RawKeyBinding {
    match (pair.code, pair.kind) {
        (0, 0) => RawKeyBinding {
            slot,
            code: 0,
            kind: 0,
        },
        (code, 32) => RawKeyBinding {
            slot,
            code,
            kind: 1,
        },
        (code, 48) => RawKeyBinding {
            slot,
            code: code.saturating_add(1),
            kind: 5,
        },
        _ => RawKeyBinding {
            slot,
            code: pair.code,
            kind: u8::MAX,
        },
    }
}

fn decode_record(router_id: &str, slot: usize, record: [u8; 4]) -> RawKeyBinding {
    let (kind, code) = match router_id {
        "WitmodSeries" if record[0] == 0 && record[1] == 0 => (0, 0),
        "WitmodSeries" if record[0] == 0 => (1, record[1]),
        "WitmodSeries" if record[0] == 16 => (5, record[2].saturating_add(1)),
        "HFDKBRGBSeries" if record[0] == 2 => (1, record[2]),
        "HFDKBRGBSeries" if record[0] == 6 => (5, record[1].saturating_add(1)),
        "HFDKBRGBSeries" if record[0] == 5 && record[1] == 3 => (0, 0),
        "SparkLinkSeries" if record[2] == 255 && record[3] == 255 => (0, 0),
        "SparkLinkSeries" if record[3] == 0 => (1, record[2]),
        _ => (u8::MAX, 0),
    };
    RawKeyBinding { slot, code, kind }
}

pub fn read_bindings<T: HidTransport>(
    keyboard: &Keyboard<T>,
    layer: u8,
) -> vendor::Result<Vec<RawKeyBinding>> {
    let router = keyboard.metadata.router_id.as_str();
    if layer > 1 || (router == "DponeSeries" && layer != 0) {
        return vendor::unsupported("family-native key layer read");
    }
    match router {
        "DponeSeries" => Ok(pair_rows(keyboard.execute(&Request::ReadKeys { layer })?)?
            .iter()
            .enumerate()
            .map(|(slot, pair)| decode_pair(visual_slot(keyboard, slot), pair))
            .collect()),
        "WitmodSeries" | "SparkLinkSeries" | "HFDKBRGBSeries" => {
            let mut rows = four_byte_rows(keyboard.execute(&Request::ReadKeys { layer })?)?;
            let count = protocol_codes(keyboard).len();
            if count > 0 {
                rows.truncate(count);
            }
            Ok(rows
                .into_iter()
                .enumerate()
                .map(|(slot, row)| decode_record(router, visual_slot(keyboard, slot), row))
                .collect())
        }
        _ => vendor::unsupported("family-native key table readback"),
    }
}

fn validate_patch(patch: &RawKeyBinding) -> vendor::Result<()> {
    match patch.kind {
        0 => Ok(()),
        1 if patch.code > 0 => Ok(()),
        5 if (1..=10).contains(&patch.code) => Ok(()),
        1 => Err("Keyboard mapping requires a nonzero HID code".into()),
        5 => Err("Macro mapping must reference macro 1..10".into()),
        _ => vendor::unsupported("editor mapping kind for this family"),
    }
}

fn base_table<T: HidTransport>(keyboard: &Keyboard<T>, length: usize) -> Vec<u8> {
    if keyboard.model.button_defaults.len() == length {
        keyboard.model.button_defaults.clone()
    } else {
        vec![0; length]
    }
}

pub fn apply_binding<T: HidTransport>(
    keyboard: &Keyboard<T>,
    layer: u8,
    patch: &RawKeyBinding,
) -> vendor::Result<()> {
    validate_patch(patch)?;
    let native_layer = match layer {
        1 => 0,
        2 => 1,
        _ => return vendor::unsupported("editor key layer"),
    };
    let router = keyboard.metadata.router_id.as_str();
    let slot = native_slot(keyboard, patch.slot)?;
    match router {
        "DponeSeries" if native_layer == 0 => {
            let rows = pair_rows(keyboard.execute(&Request::ReadKeys { layer: 0 })?)?;
            if slot >= rows.len() {
                return Err("Selected DPONE key is outside the hardware table".into());
            }
            let mut data = base_table(keyboard, 512);
            for (index, row) in rows.iter().enumerate().take(256) {
                data[index * 2] = row.code;
                data[index * 2 + 1] = row.kind;
            }
            let record = match patch.kind {
                0 => [0, 0],
                1 => [patch.code, 32],
                5 => [patch.code - 1, 48],
                _ => unreachable!(),
            };
            data[slot * 2..slot * 2 + 2].copy_from_slice(&record);
            keyboard.execute(&Request::WriteKeys {
                layer: 0,
                data,
            })?;
        }
        "WitmodSeries" => {
            let rows = four_byte_rows(keyboard.execute(&Request::ReadKeys {
                layer: native_layer,
            })?)?;
            let expected = keyboard.model.button_defaults.len();
            if expected < 4 || slot * 4 + 4 > expected {
                return Err("Selected Witmod key is outside the hardware table".into());
            }
            let mut data = base_table(keyboard, expected);
            let raw = rows.into_iter().flatten().collect::<Vec<_>>();
            let copy = raw.len().min(data.len());
            data[..copy].copy_from_slice(&raw[..copy]);
            let record = match patch.kind {
                0 => [0, 0, 0, 0],
                1 => [0, patch.code, 0, 0],
                5 => [16, 0, patch.code - 1, 0],
                _ => unreachable!(),
            };
            data[slot * 4..slot * 4 + 4].copy_from_slice(&record);
            keyboard.execute(&Request::WriteKeys {
                layer: native_layer,
                data,
            })?;
        }
        "HFDKBRGBSeries" => {
            let rows = four_byte_rows(keyboard.execute(&Request::ReadKeys {
                layer: native_layer,
            })?)?;
            if slot >= rows.len() {
                return Err("Selected HFD RGB key is outside the hardware table".into());
            }
            if rows[slot][0] == 11 {
                return vendor::unsupported(
                    "key currently participates in Snap Tap; change that pair before remapping it",
                );
            }
            let mut data = base_table(keyboard, 512);
            let raw = rows.into_iter().flatten().collect::<Vec<_>>();
            let copy = raw.len().min(data.len());
            data[..copy].copy_from_slice(&raw[..copy]);
            data[508..512].copy_from_slice(&[0, 0, 170, 85]);
            let record = match patch.kind {
                0 => [5, 3, 0, 0],
                1 => [2, 0, patch.code, 0],
                5 => [6, patch.code - 1, 0, 0],
                _ => unreachable!(),
            };
            data[slot * 4..slot * 4 + 4].copy_from_slice(&record);
            keyboard.execute(&Request::WriteKeys {
                layer: native_layer,
                data,
            })?;
        }
        "SparkLinkSeries" if patch.kind != 5 => {
            let source = keyboard
                .model
                .key_hids
                .get(slot)
                .copied()
                .flatten()
                .ok_or("Selected SparkLink key has no vendor HID identity")?;
            let record = if patch.kind == 0 {
                [source, native_layer, 255, 255]
            } else {
                [source, native_layer, patch.code, 0]
            };
            keyboard.execute(&Request::WriteKeys {
                layer: native_layer,
                data: record.to_vec(),
            })?;
        }
        "SparkLinkSeries" => {
            return vendor::unsupported(
                "SparkLink macros are bound-key transactions, not key-table macro IDs",
            )
        }
        _ => return vendor::unsupported("lossless family-native keybinding adapter"),
    }
    Ok(())
}

fn object_events(value: Value) -> vendor::Result<Vec<MacroEvent>> {
    let events = value
        .get("events")
        .cloned()
        .ok_or("Missing macro event list")?;
    serde_json::from_value(events).map_err(|error| format!("Invalid macro event list: {error}"))
}

pub fn read_macros<T: HidTransport>(keyboard: &Keyboard<T>) -> vendor::Result<Vec<MacroDefinition>> {
    match keyboard.metadata.router_id.as_str() {
        "DponeSeries" | "WitmodSeries" => {
            let mut macros = Vec::new();
            for native_id in 0..10u8 {
                let events = object_events(keyboard.execute(&Request::ReadMacro { id: native_id })?)?;
                if !events.is_empty() {
                    macros.push(MacroDefinition {
                        id: native_id + 1,
                        events,
                    });
                }
            }
            Ok(macros)
        }
        "HFDKBRGBSeries" => {
            let tables: Vec<Vec<MacroEvent>> = serde_json::from_value(
                keyboard.execute(&Request::ReadMacro { id: 0 })?,
            )
            .map_err(|error| format!("Invalid HFD RGB macro table: {error}"))?;
            Ok(tables
                .into_iter()
                .take(10)
                .enumerate()
                .filter(|(_, events)| !events.is_empty())
                .map(|(id, events)| MacroDefinition {
                    id: id as u8 + 1,
                    events,
                })
                .collect())
        }
        _ => vendor::unsupported("family-native macro readback"),
    }
}

pub fn write_macro<T: HidTransport>(
    keyboard: &Keyboard<T>,
    macro_id: u8,
    events: &[MacroEvent],
) -> vendor::Result<()> {
    if !(1..=10).contains(&macro_id) {
        return Err("Macro ID must be 1..10".into());
    }
    let native_id = macro_id - 1;
    match keyboard.metadata.router_id.as_str() {
        "DponeSeries" => {
            keyboard.execute(&Request::WriteMacro {
                id: native_id,
                name: format!("Macro {macro_id}"),
                events: events.to_vec(),
            })?;
        }
        "WitmodSeries" => {
            let mut table = Vec::with_capacity(10);
            for id in 0..10u8 {
                let current = object_events(keyboard.execute(&Request::ReadMacro { id })?)?;
                table.push(MacroRecord {
                    id,
                    name: format!("Macro {}", id + 1),
                    events: if id == native_id {
                        events.to_vec()
                    } else {
                        current
                    },
                });
            }
            keyboard.execute(&Request::MacroTable(table))?;
        }
        "HFDKBRGBSeries" => {
            let mut table: Vec<Vec<MacroEvent>> = serde_json::from_value(
                keyboard.execute(&Request::ReadMacro { id: 0 })?,
            )
            .map_err(|error| format!("Invalid HFD RGB macro table: {error}"))?;
            table.truncate(10);
            if native_id as usize > table.len() {
                return vendor::unsupported("HFD RGB macro IDs must stay densely ordered");
            }
            if native_id as usize == table.len() {
                if events.is_empty() {
                    return Err("A new HFD RGB macro needs at least one event".into());
                }
                table.push(events.to_vec());
            } else {
                table[native_id as usize] = events.to_vec();
            }
            while table.last().is_some_and(Vec::is_empty) {
                table.pop();
            }
            if table.is_empty() {
                return vendor::unsupported("HFD RGB cannot encode an empty complete macro table");
            }
            let records = table
                .into_iter()
                .enumerate()
                .map(|(id, events)| MacroRecord {
                    id: id as u8,
                    name: format!("Macro {}", id + 1),
                    events,
                })
                .collect();
            keyboard.execute(&Request::MacroTable(records))?;
        }
        _ => return vendor::unsupported("lossless family-native macro adapter"),
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn native_records_decode_without_reinterpreting_unknown_vendor_actions() {
        assert_eq!(decode_record("WitmodSeries", 7, [0, 4, 0, 0]).kind, 1);
        let macro_binding = decode_record("WitmodSeries", 7, [16, 0, 2, 0]);
        assert_eq!((macro_binding.kind, macro_binding.code), (5, 3));
        assert_eq!(decode_record("WitmodSeries", 7, [0, 0, 0, 0]).kind, 0);
        assert_eq!(decode_record("HFDKBRGBSeries", 9, [11, 3, 4, 7]).kind, u8::MAX);
        assert_eq!(decode_record("SparkLinkSeries", 2, [4, 0, 255, 255]).kind, 0);
    }

    #[test]
    fn exact_layout_mapping_resolves_protocol_order_instead_of_visual_index() {
        let layouts = layout_registry().unwrap();
        let bushido = layouts.get("8440US").unwrap();
        assert_eq!(bushido.get("Custom_Fnkey"), Some(&71));
        assert!(bushido.contains_key("KeyA"));
    }
}
