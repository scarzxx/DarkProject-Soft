use crate::drivers::{self, ProtocolDriver};
use crate::models::DeviceSummary;
use crate::registry::{self, DeviceMetadata};
use hidapi::{DeviceInfo, HidApi};
use std::collections::HashMap;
use std::hash::Hash;

fn score(info: &DeviceInfo) -> u8 {
    u8::from(
        info.product_string()
            .unwrap_or_default()
            .starts_with("DPKB_"),
    ) * 4
        + u8::from(info.usage_page() == 0xFF01) * 2
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
            registry::candidate(
                registry,
                info.vendor_id(),
                info.product_string().unwrap_or_default(),
            )
        })
        .collect();
    // Serial descriptors may contain a model ID shared by multiple physical units.
    // Keep every best-ranked path rather than merging identical keyboards.
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
        |info| score(info),
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
                score(info),
            )
        })
        .ok_or_else(|| "No supported Dark Project keyboard found".into())
}

/// Enumerate known-vendor interfaces without transmitting HID reports.
pub fn scan_devices() -> Result<Vec<DeviceSummary>, String> {
    let api = HidApi::new().map_err(|error| error.to_string())?;
    let registry = registry::devices()?;
    Ok(detected(&api, registry)
        .into_iter()
        .map(|info| registry::summary(info, metadata(registry, info)))
        .collect())
}

/// Read identity/profile headers only for the selected verified model.
pub fn scan_device(id: Option<&str>) -> Result<DeviceSummary, String> {
    let api = HidApi::new().map_err(|error| error.to_string())?;
    let registry = registry::devices()?;
    let info = selected(&api, registry, id)?;
    let model = metadata(registry, info);
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

/// Revalidate selected physical identity before every read or write operation.
pub fn open_driver(id: Option<&str>) -> Result<Box<dyn ProtocolDriver>, String> {
    let api = HidApi::new().map_err(|error| error.to_string())?;
    let registry = registry::devices()?;
    let info = selected(&api, registry, id)?;
    drivers::open(&api, info, metadata(registry, info))
}

#[cfg(test)]
mod tests {
    use super::highest_ranked;

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
}
