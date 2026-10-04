use crate::models::{DeviceCapabilities, DeviceSummary};
use serde::Deserialize;
use std::sync::OnceLock;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Connection {
    pub vendor_id: u16,
    pub product_id: u16,
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

static REGISTRY: OnceLock<Result<Vec<DeviceMetadata>, String>> = OnceLock::new();

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

/// Resolve shared USB IDs only when product or vendor model identity is unique.
pub fn identify<'a>(
    registry: &'a [DeviceMetadata],
    vendor_id: u16,
    product_id: u16,
    product: &str,
    serial: Option<&str>,
) -> Option<&'a DeviceMetadata> {
    let compatible = |device: &&DeviceMetadata| {
        device.connections.iter().any(|connection| {
            connection.vendor_id == vendor_id && connection.product_id == product_id
        })
    };
    let named = |device: &&DeviceMetadata| {
        device.product_name.eq_ignore_ascii_case(product.trim())
            || device.hardware_name.eq_ignore_ascii_case(product.trim())
            || device.model_name.eq_ignore_ascii_case(product.trim())
    };
    let mut names = registry.iter().filter(compatible).filter(named);
    let first = names.next();
    let unique = first.is_some() && names.next().is_none();
    if unique {
        let device = first?;
        if registry.iter().filter(compatible).any(|candidate| {
            serial.is_some_and(|serial| candidate.id.eq_ignore_ascii_case(serial))
                && candidate.id != device.id
        }) {
            return None;
        }
        return Some(device);
    }
    let mut matches = registry.iter().filter(compatible).filter(|device| {
        (first.is_none() || named(device))
            && serial.is_some_and(|serial| device.id.eq_ignore_ascii_case(serial))
    });
    let matched = matches.next()?;
    if matches.next().is_some() {
        None
    } else {
        Some(matched)
    }
}

/// Discover unknown models from known USB vendors without opening their interfaces.
pub fn candidate(registry: &[DeviceMetadata], vendor_id: u16, product: &str) -> bool {
    registry.iter().any(|device| {
        device
            .connections
            .iter()
            .any(|connection| connection.vendor_id == vendor_id)
    }) || product.starts_with("DPKB_")
        || product.contains("Dark Project")
}

/// Build an inert descriptor when hardware identity or its driver is unverified.
pub fn summary(info: &hidapi::DeviceInfo, metadata: Option<&DeviceMetadata>) -> DeviceSummary {
    let advertised = metadata
        .map(|device| device.capabilities.clone())
        .unwrap_or_default();
    let verified = metadata.is_some_and(crate::drivers::available);
    let mut capabilities = if verified {
        advertised.clone()
    } else {
        DeviceCapabilities::default()
    };
    capabilities.tft = false;
    capabilities.sync = false;
    capabilities.actuation = false;
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
