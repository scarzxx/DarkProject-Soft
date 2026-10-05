use crate::models::{DeviceCapabilities, DeviceSummary};
use serde::Deserialize;
use std::{collections::HashMap, sync::OnceLock};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Connection {
    pub vendor_id: u16,
    pub product_id: u16,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Interface {
    pub usage_page: u16,
    pub usage: u16,
    #[serde(default)]
    pub transport: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceMetadata {
    pub id: String,
    pub product_name: String,
    pub hardware_name: String,
    pub model_name: String,
    pub router_id: String,
    pub style_name: String,
    pub profiles: u8,
    pub verified: bool,
    pub connections: Vec<Connection>,
    pub capabilities: DeviceCapabilities,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeviceInterfaceRecord {
    id: String,
    #[serde(default)]
    interfaces: Vec<Interface>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DriverFeatureSet {
    pub profile_state: bool,
    pub lighting: bool,
    pub custom_lighting: bool,
    pub keybindings: bool,
    pub fn_layer: bool,
    pub snap_tap: bool,
    pub macros: bool,
    pub performance: bool,
    pub profiles: bool,
}

static REGISTRY: OnceLock<Result<Vec<DeviceMetadata>, String>> = OnceLock::new();
static INTERFACES: OnceLock<Result<HashMap<String, Vec<Interface>>, String>> = OnceLock::new();
static DRIVER_FEATURES: OnceLock<Result<HashMap<String, DriverFeatureSet>, String>> = OnceLock::new();

/// Load bundled technical metadata once; invalid metadata returns an error.
pub fn devices() -> Result<&'static [DeviceMetadata], String> {
    REGISTRY
        .get_or_init(|| {
            serde_json::from_str(include_str!("../../registry/devices.json"))
                .map_err(|error| format!("Invalid device registry: {error}"))
        })
        .as_ref()
        .map(Vec::as_slice)
        .map_err(Clone::clone)
}

fn interface_registry() -> Result<&'static HashMap<String, Vec<Interface>>, String> {
    INTERFACES
        .get_or_init(|| {
            let records: Vec<DeviceInterfaceRecord> =
                serde_json::from_str(include_str!("../../registry/devices.json"))
                    .map_err(|error| format!("Invalid interface registry: {error}"))?;
            Ok(records
                .into_iter()
                .map(|record| (record.id, record.interfaces))
                .collect())
        })
        .as_ref()
        .map_err(Clone::clone)
}

fn driver_feature_registry() -> Result<&'static HashMap<String, DriverFeatureSet>, String> {
    DRIVER_FEATURES
        .get_or_init(|| {
            serde_json::from_str(include_str!("../../registry/driver-capabilities.json"))
                .map_err(|error| format!("Invalid driver capability registry: {error}"))
        })
        .as_ref()
        .map_err(Clone::clone)
}

/// Shared source of truth for operations that are safe to expose through the app.
pub fn driver_features(router_id: &str) -> Option<&'static DriverFeatureSet> {
    driver_feature_registry().ok()?.get(router_id)
}

pub fn connection_matches(device: &DeviceMetadata, vendor_id: u16, product_id: u16) -> bool {
    device.connections.iter().any(|connection| {
        connection.vendor_id == vendor_id && connection.product_id == product_id
    })
}

/// Match the exact HID collection declared by vendor metadata for this model.
pub fn interface_matches(device: &DeviceMetadata, usage_page: u16, usage: u16) -> bool {
    let Ok(registry) = interface_registry() else {
        return false;
    };
    registry.get(&device.id).is_some_and(|interfaces| {
        interfaces.iter().any(|interface| {
            let transport_ok = match interface.transport.as_deref() {
                None => true,
                Some(transport) => {
                    transport.eq_ignore_ascii_case("USB")
                        || transport.eq_ignore_ascii_case("DONGLE")
                }
            };
            transport_ok && interface.usage_page == usage_page && interface.usage == usage
        })
    })
}

/// Resolve shared USB IDs only when product, serial/model ID, or the pair itself is unique.
pub fn identify<'a>(
    registry: &'a [DeviceMetadata],
    vendor_id: u16,
    product_id: u16,
    product: &str,
    serial: Option<&str>,
) -> Option<&'a DeviceMetadata> {
    let compatible = registry
        .iter()
        .filter(|device| connection_matches(device, vendor_id, product_id))
        .collect::<Vec<_>>();
    if compatible.is_empty() {
        return None;
    }

    let product = product.trim();
    let named = compatible
        .iter()
        .copied()
        .filter(|device| {
            device.product_name.eq_ignore_ascii_case(product)
                || device.hardware_name.eq_ignore_ascii_case(product)
                || device.model_name.eq_ignore_ascii_case(product)
        })
        .collect::<Vec<_>>();

    if let Some(serial) = serial {
        let serial_matches = compatible
            .iter()
            .copied()
            .filter(|device| device.id.eq_ignore_ascii_case(serial))
            .collect::<Vec<_>>();
        if serial_matches.len() == 1 {
            let serial_model = serial_matches[0];
            if named.is_empty() || named.iter().any(|device| device.id == serial_model.id) {
                return Some(serial_model);
            }
            return None;
        }
    }

    if named.len() == 1 {
        return Some(named[0]);
    }
    if named.is_empty() && compatible.len() == 1 {
        return Some(compatible[0]);
    }
    None
}

fn strong_product_identity(product: &str) -> bool {
    let product = product.trim();
    product.starts_with("DPKB_") || product.to_ascii_lowercase().contains("dark project")
}

/// Enumerate only exact known VID/PID pairs, plus strongly branded future devices.
pub fn candidate(
    registry: &[DeviceMetadata],
    vendor_id: u16,
    product_id: u16,
    product: &str,
) -> bool {
    registry
        .iter()
        .any(|device| connection_matches(device, vendor_id, product_id))
        || strong_product_identity(product)
}

/// Decide whether this HID collection can belong to a supported configuration interface.
pub fn interface_candidate(
    registry: &[DeviceMetadata],
    vendor_id: u16,
    product_id: u16,
    product: &str,
    serial: Option<&str>,
    usage_page: u16,
    usage: u16,
) -> bool {
    if !candidate(registry, vendor_id, product_id, product) {
        return false;
    }
    if let Some(device) = identify(registry, vendor_id, product_id, product, serial) {
        return interface_matches(device, usage_page, usage);
    }
    let compatible = registry
        .iter()
        .filter(|device| connection_matches(device, vendor_id, product_id))
        .collect::<Vec<_>>();
    if compatible.is_empty() {
        return strong_product_identity(product);
    }
    compatible
        .into_iter()
        .any(|device| interface_matches(device, usage_page, usage))
}

/// Intersect vendor-advertised features with the safe UI/command adapters for a router family.
pub fn usable_capabilities(device: &DeviceMetadata) -> DeviceCapabilities {
    let Some(driver) = driver_features(&device.router_id) else {
        return DeviceCapabilities::default();
    };
    let advertised = &device.capabilities;
    let lighting = driver.lighting && advertised.lighting;
    let snap_tap = driver.snap_tap && advertised.snap_tap;
    DeviceCapabilities {
        lighting,
        custom_lighting: driver.custom_lighting && advertised.custom_lighting,
        keybindings: driver.keybindings && advertised.keybindings,
        fn_layer: driver.fn_layer && advertised.fn_layer,
        snap_tap,
        macros: driver.macros && advertised.macros,
        performance: driver.performance && advertised.performance,
        profiles: driver.profile_state && driver.profiles && advertised.profiles,
        max_snap_tap_pairs: if snap_tap {
            advertised.max_snap_tap_pairs
        } else {
            0
        },
        lighting_effects: if lighting {
            advertised.lighting_effects.clone()
        } else {
            Vec::new()
        },
        // These need separate media/sync/actuation APIs and remain disabled.
        tft: false,
        sync: false,
        actuation: false,
    }
}

/// Build an inert descriptor when hardware identity or its driver is unverified.
pub fn summary(info: &hidapi::DeviceInfo, metadata: Option<&DeviceMetadata>) -> DeviceSummary {
    let advertised = metadata
        .map(|device| device.capabilities.clone())
        .unwrap_or_default();
    let verified = metadata.is_some_and(crate::drivers::available);
    let capabilities = if verified {
        metadata.map(usable_capabilities).unwrap_or_default()
    } else {
        DeviceCapabilities::default()
    };
    let style = metadata.map(|device| device.style_name.clone());
    let layout = match style.as_deref() {
        Some(style) if style.ends_with("UK") || style.ends_with("ISO") => "ISO",
        Some(_) => "ANSI",
        None => "Unknown",
    };
    DeviceSummary {
        id: info.path().to_string_lossy().into_owned(),
        registry_id: metadata.map(|device| device.id.clone()),
        product_name: info
            .product_string()
            .unwrap_or("Unknown keyboard")
            .to_owned(),
        style_name: style,
        known: metadata.is_some(),
        verified,
        connected: true,
        serial_number: info.serial_number().map(str::to_owned),
        vendor_id: info.vendor_id(),
        product_id: info.product_id(),
        firmware: "unknown".into(),
        layout: layout.into(),
        protocol: metadata
            .map(|device| device.router_id.clone())
            .unwrap_or_else(|| "Unknown".into()),
        profiles: metadata.map_or(0, |device| device.profiles),
        active_profile: 0,
        capabilities,
        advertised_capabilities: advertised,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shared_usb_id_does_not_verify_other_models() {
        let registry = devices().unwrap();
        let bushido = identify(registry, 0x342D, 0xE40F, "DPKB_BUSHIDO_87_ANSI", None).unwrap();
        assert!(crate::drivers::available(bushido));
        let violet = identify(registry, 0x342D, 0xE40F, "DPKB_VIOLET_87_ANSI", None).unwrap();
        assert!(!crate::drivers::available(violet));
        assert!(identify(registry, 0x342D, 0xE40F, "Unknown", None).is_none());
        assert!(identify(registry, 0xFFFF, 0xE40F, "DPKB_BUSHIDO_87_ANSI", None).is_none());
        assert!(identify(
            registry,
            0x342D,
            0xE40F,
            "DPKB_BUSHIDO_87_ANSI",
            Some(&violet.id)
        )
        .is_none());
    }

    #[test]
    fn vendor_identity_disambiguates_generic_product_names() {
        let registry = devices().unwrap();
        let model = identify(
            registry,
            0x0416,
            0xC345,
            "USB KEYBOARD",
            Some("0x04160xC345004"),
        )
        .unwrap();
        assert_eq!(model.style_name, "WITMOD83UK");
        assert!(!crate::drivers::available(model));
        let bushido = identify(
            registry,
            0x342D,
            0xE40F,
            "USB KEYBOARD",
            Some("0x342D0xE40F012"),
        )
        .unwrap();
        assert!(crate::drivers::available(bushido));
    }

    #[test]
    fn candidates_require_exact_usb_pairs_unless_the_product_is_strongly_branded() {
        let registry = devices().unwrap();
        assert!(candidate(registry, 0x342D, 0xE40F, "Unknown"));
        assert!(!candidate(registry, 0x342D, 0xFFFF, "Unknown"));
        assert!(candidate(registry, 0xFFFF, 0xFFFF, "DPKB_FUTURE_MODEL"));
    }

    #[test]
    fn exact_vendor_interfaces_and_driver_feature_gates_are_loaded() {
        let registry = devices().unwrap();
        let witmod = registry
            .iter()
            .find(|device| device.router_id == "WitmodSeries")
            .unwrap();
        let interfaces = interface_registry().unwrap().get(&witmod.id).unwrap();
        let interface = interfaces.first().unwrap();
        assert!(interface_matches(witmod, interface.usage_page, interface.usage));
        assert!(!interface_matches(witmod, 0x0001, 0x0006));
        let features = driver_features("WitmodSeries").unwrap();
        assert!(!features.profile_state);
        assert!(features.lighting);
        assert!(features.snap_tap);
        assert!(!features.keybindings);
        assert!(driver_features("CommonKeyboardSeries").unwrap().profile_state);
        assert!(driver_features("UnexpectedSeries").is_none());
    }

    #[test]
    fn only_one_device_and_driver_are_verified() {
        let registry = devices().unwrap();
        assert_eq!(registry.len(), 45);
        let verified: Vec<_> = registry
            .iter()
            .filter(|device| crate::drivers::available(device))
            .collect();
        assert_eq!(verified.len(), 1);
        assert_eq!(verified[0].product_name, "DPKB_BUSHIDO_87_ANSI");
        assert!(!verified[0].capabilities.performance);
        assert_eq!(verified[0].profiles, 3);
        assert!(crate::drivers::descriptor("UnexpectedSeries").is_none());
    }

    #[test]
    fn generated_protocols_match_the_driver_registry_and_device_membership() {
        let families: serde_json::Value =
            serde_json::from_str(include_str!("../../registry/protocols.json")).unwrap();
        for family in families.as_array().unwrap() {
            let router = family["routerId"].as_str().unwrap();
            assert!(crate::drivers::descriptor(router).is_some());
            assert!(driver_features(router).is_some());
            for id in family["deviceIds"].as_array().unwrap() {
                let model = devices()
                    .unwrap()
                    .iter()
                    .find(|model| model.id == id.as_str().unwrap())
                    .unwrap();
                assert_eq!(model.router_id, router);
            }
        }
        let registry = devices().unwrap();
        let usb_name = identify(registry, 0x0416, 0xC345, "GK8170MDPRGBEU", None).unwrap();
        let model_name =
            identify(registry, 0x0416, 0xC345, "DPP83_GSH_NAVY_ANSI_EN", None).unwrap();
        assert_eq!(usb_name.id, model_name.id);
        assert!(!crate::drivers::available(usb_name));
    }
}
