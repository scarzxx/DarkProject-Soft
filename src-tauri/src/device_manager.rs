use crate::drivers::{self, ProtocolDriver};
use crate::models::DeviceSummary;
use crate::registry::{self, DeviceMetadata};
use hidapi::{DeviceInfo, HidApi, HidDevice};
use std::collections::HashMap;
use std::hash::Hash;

fn score(registry: &[DeviceMetadata], info: &DeviceInfo) -> u8 {
    u8::from(metadata(registry, info).is_some()) * 4
        + u8::from(
            info.product_string()
                .unwrap_or_default()
                .starts_with("DPKB_"),
        ) * 2
}

fn metadata<'a>(registry: &'a [DeviceMetadata], info: &DeviceInfo) -> Option<&'a DeviceMetadata> {
    registry::identify(
        registry,
        info.vendor_id(),
        info.product_id(),
        info.product_string().unwrap_or_default(),
        info.serial_number(),
    )
}

fn highest_ranked<T, K: Eq + Hash>(
    items: Vec<T>,
    identity: impl Fn(&T) -> K,
    rank: impl Fn(&T) -> u8,
) -> Vec<T> {
    let mut highest = HashMap::new();
    for item in &items {
        highest
            .entry(identity(item))
            .and_modify(|value: &mut u8| *value = (*value).max(rank(item)))
            .or_insert_with(|| rank(item));
    }
    items
        .into_iter()
        .filter(|item| highest.get(&identity(item)) == Some(&rank(item)))
        .collect()
}

fn detected<'a>(api: &'a HidApi, registry: &[DeviceMetadata]) -> Vec<&'a DeviceInfo> {
    let interfaces = api
        .device_list()
        .filter(|info| {
            registry::interface_candidate(
                registry,
                info.vendor_id(),
                info.product_id(),
                info.product_string().unwrap_or_default(),
                info.serial_number(),
                info.usage_page(),
                info.usage(),
            )
        })
        .collect();
    // Keep distinct physical paths, but drop lower-ranked duplicate collections.
    highest_ranked(
        interfaces,
        |info| {
            (
                info.vendor_id(),
                info.product_id(),
                info.product_string(),
                info.serial_number(),
            )
        },
        |info| score(registry, info),
    )
}

fn selected<'a>(
    api: &'a HidApi,
    registry: &[DeviceMetadata],
    id: Option<&str>,
) -> Result<&'a DeviceInfo, String> {
    let devices = detected(api, registry);
    if let Some(id) = id {
        return devices
            .into_iter()
            .find(|info| info.path().to_string_lossy() == id)
            .ok_or_else(|| "Selected device is no longer connected".into());
    }
    devices
        .into_iter()
        .max_by_key(|info| {
            (
                metadata(registry, info).is_some_and(drivers::available),
                metadata(registry, info).is_some(),
                score(registry, info),
            )
        })
        .ok_or_else(|| "No supported Dark Project keyboard found".into())
}

fn witmod_hardware_name(bytes: &[u8]) -> Option<String> {
    let mut vendor = [0u8; 110];
    let mut nonzero = 0usize;
    for (index, byte) in bytes.iter().copied().take(110).enumerate() {
        if byte != 0 {
            vendor[index] = byte;
            nonzero += 1;
        }
    }
    if nonzero == 0 {
        return None;
    }
    let printable = String::from_utf8_lossy(&vendor[..nonzero])
        .chars()
        .filter(|ch| ch.is_ascii_graphic() || *ch == ' ')
        .collect::<String>();
    let parts = printable.split(',').collect::<Vec<_>>();
    if parts.len() < 2 {
        return None;
    }
    let name = parts[parts.len() - 2].replace('_', ".");
    (!name.trim().is_empty()).then(|| name.trim().to_owned())
}

fn witmod_block(device: &HidDevice, expected_index: u8) -> Option<Vec<u8>> {
    for _ in 0..8 {
        let mut data = vec![0u8; 128];
        let length = device.read_timeout(&mut data, 250).ok()?;
        if length == 0 || length > data.len() {
            return None;
        }
        data.truncate(length);
        let payload = if data.len() >= 64 && data[0] == 1 && data[1] == 13 {
            &data[1..]
        } else {
            &data[..]
        };
        if payload.len() < 63 || payload[0] != 13 || payload[3] != expected_index {
            continue;
        }
        return Some(payload[5..63].to_vec());
    }
    None
}

/// Vendor Witmod devices with generic USB descriptors identify themselves through command 13.
/// This probe only requests identity data and never sends a configuration command.
fn probe_witmod_identity<'a>(
    api: &HidApi,
    registry: &'a [DeviceMetadata],
    info: &DeviceInfo,
) -> Option<&'a DeviceMetadata> {
    let pair_models = registry
        .iter()
        .filter(|device| registry::connection_matches(device, info.vendor_id(), info.product_id()))
        .collect::<Vec<_>>();
    if pair_models.is_empty()
        || pair_models
            .iter()
            .any(|device| device.router_id != "WitmodSeries")
    {
        return None;
    }
    let candidates = pair_models
        .into_iter()
        .filter(|device| registry::interface_matches(device, info.usage_page(), info.usage()))
        .collect::<Vec<_>>();
    if candidates.is_empty() {
        return None;
    }

    let device = info.open_device(api).ok()?;
    let mut request = vec![0u8; 64];
    request[0] = 1; // numbered HID output report
    request[1] = 13; // vendor identity/version query
    if device.write(&request).ok()? != request.len() {
        return None;
    }
    let mut combined = witmod_block(&device, 0)?;
    combined.extend(witmod_block(&device, 1)?);
    let hardware_name = witmod_hardware_name(&combined)?;
    candidates.into_iter().find(|candidate| {
        [
            candidate.hardware_name.as_str(),
            candidate.product_name.as_str(),
            candidate.model_name.as_str(),
        ]
        .into_iter()
        .any(|name| name.replace('_', ".").eq_ignore_ascii_case(&hardware_name))
    })
}

fn resolved_metadata<'a>(
    api: &HidApi,
    registry: &'a [DeviceMetadata],
    info: &DeviceInfo,
) -> Option<&'a DeviceMetadata> {
    metadata(registry, info).or_else(|| probe_witmod_identity(api, registry, info))
}

/// Enumerate known configuration interfaces without transmitting HID reports.
pub fn scan_devices() -> Result<Vec<DeviceSummary>, String> {
    let api = HidApi::new().map_err(|error| error.to_string())?;
    let registry = registry::devices()?;
    Ok(detected(&api, registry)
        .into_iter()
        .map(|info| registry::summary(info, metadata(registry, info)))
        .collect())
}

/// Resolve the selected device. Ambiguous Witmod identities may use the vendor read-only query.
pub fn scan_device(id: Option<&str>) -> Result<DeviceSummary, String> {
    let api = HidApi::new().map_err(|error| error.to_string())?;
    let registry = registry::devices()?;
    let info = selected(&api, registry, id)?;
    let model = resolved_metadata(&api, registry, info);
    let mut summary = registry::summary(info, model);
    if summary.verified {
        let driver = drivers::open(&api, info, model)?;
        summary.firmware = driver
            .firmware_version()
            .unwrap_or_else(|_| "unknown".into());
        summary.active_profile = driver.current_profile().unwrap_or(0);
    }
    Ok(summary)
}

/// Revalidate physical identity and exact HID collection before every read or write operation.
pub fn open_driver(id: Option<&str>) -> Result<Box<dyn ProtocolDriver>, String> {
    let api = HidApi::new().map_err(|error| error.to_string())?;
    let registry = registry::devices()?;
    let info = selected(&api, registry, id)?;
    let model = resolved_metadata(&api, registry, info);
    drivers::open(&api, info, model)
}

#[cfg(test)]
mod tests {
    use super::{highest_ranked, witmod_hardware_name};

    #[test]
    fn identical_models_keep_distinct_paths_and_legacy_tie_order() {
        let interfaces = vec![
            ("unit1-keyboard", "shared-model", 4),
            ("unit1-config", "shared-model", 6),
            ("unit2-config", "shared-model", 6),
            ("other-config", "other-model", 0),
        ];
        let selected = highest_ranked(interfaces, |info| info.1, |info| info.2);
        assert_eq!(
            selected.iter().map(|info| info.0).collect::<Vec<_>>(),
            ["unit1-config", "unit2-config", "other-config"]
        );
        assert_eq!(
            selected
                .iter()
                .filter(|info| info.1 == "shared-model")
                .max_by_key(|info| info.2)
                .unwrap()
                .0,
            "unit2-config"
        );
    }

    #[test]
    fn absent_devices_produce_an_empty_list() {
        let interfaces: Vec<(u16, u8)> = vec![];
        assert!(highest_ranked(interfaces, |info| info.0, |info| info.1).is_empty());
    }

    #[test]
    fn witmod_identity_parser_matches_vendor_second_last_field_rule() {
        let mut response = vec![0u8; 116];
        let text = b"KEYBOARD,GK8170MDPRGBEU,V1_2_3_4";
        response[..text.len()].copy_from_slice(text);
        assert_eq!(
            witmod_hardware_name(&response).as_deref(),
            Some("GK8170MDPRGBEU")
        );
        assert_eq!(witmod_hardware_name(&[0; 116]), None);
    }
}
