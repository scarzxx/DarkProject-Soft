#[allow(dead_code)]
mod common;
mod dpone;
#[cfg(test)]
mod golden_tests;
mod hfd;
mod hfd_packets;
mod hfd_rgb;
mod sparklink;
mod tft;
pub mod transport;
#[allow(dead_code)]
pub mod vendor;
mod witmod;

use crate::models::{
    FeatureState, LightingFeatureState, LightingSettings, MacroEvent, PerformanceSettings,
    ProfileState, RawKeyBinding, SnapPair, SnapTapState,
};
use crate::registry::DeviceMetadata;
use hidapi::{DeviceInfo, HidApi};

/// Protocol registration separates recognized families from implemented transports.
pub struct DriverDescriptor {
    pub router_id: &'static str,
    pub implemented: bool,
}

const DRIVERS: [DriverDescriptor; 7] = [
    DriverDescriptor {
        router_id: "CommonKeyboardSeries",
        implemented: true,
    },
    dpone::DRIVER,
    witmod::DRIVER,
    tft::DRIVER,
    sparklink::DRIVER,
    hfd::DRIVER,
    hfd_rgb::DRIVER,
];

/// Find the driver boundary for a vendor router; unknown families are inert.
pub fn descriptor(router_id: &str) -> Option<&'static DriverDescriptor> {
    DRIVERS.iter().find(|driver| driver.router_id == router_id)
}

/// Verification belongs to the individual model, never just to shared USB IDs.
pub fn available(metadata: &DeviceMetadata) -> bool {
    metadata.verified
        && crate::registry::devices().is_ok_and(|devices| {
            devices.iter().any(|device| {
                device.id == metadata.id
                    && device.router_id == metadata.router_id
                    && device.style_name == metadata.style_name
                    && device.verified
            })
        })
        && descriptor(&metadata.router_id).is_some_and(|driver| driver.implemented)
}

/// Reject unverified drivers before constructing or opening any HID transport.
pub fn ensure_available(metadata: Option<&DeviceMetadata>) -> Result<(), String> {
    if metadata.is_some_and(available) {
        Ok(())
    } else {
        Err("Device is unverified; HID commands are disabled".into())
    }
}

/// Stable UI command interface. Family-native codecs stay behind this boundary.
pub trait ProtocolDriver {
    #[allow(dead_code)]
    fn vendor_request(&self, _request: &vendor::Request) -> Result<serde_json::Value, String> {
        vendor::unsupported("family-native operations on the legacy Common interface")
    }
    fn firmware_version(&self) -> Result<String, String>;
    fn current_profile(&self) -> Result<u8, String>;
    fn read_features(&self, profile: u8) -> Result<FeatureState, String>;
    fn read_profile(&self, profile: u8) -> Result<ProfileState, String>;
    fn switch_profile(&self, profile: u8) -> Result<(), String>;
    fn apply_lighting(&self, profile: u8, settings: &LightingSettings) -> Result<(), String>;
    fn apply_performance(&self, profile: u8, settings: &PerformanceSettings) -> Result<(), String>;
    fn apply_snap_tap(&self, profile: u8, enabled: bool, pairs: &[SnapPair]) -> Result<(), String>;
    fn apply_key_binding(
        &self,
        profile: u8,
        layer: u8,
        patch: &RawKeyBinding,
    ) -> Result<(), String>;
    fn write_macro(&self, macro_id: u8, events: &[MacroEvent]) -> Result<(), String>;
}

impl<T: transport::HidTransport> ProtocolDriver for common::Keyboard<T> {
    fn firmware_version(&self) -> Result<String, String> {
        common::Keyboard::firmware_version(self).map_err(|error| error.to_string())
    }
    fn current_profile(&self) -> Result<u8, String> {
        common::Keyboard::current_profile(self).map_err(|error| error.to_string())
    }
    fn read_features(&self, profile: u8) -> Result<FeatureState, String> {
        let state = common::Keyboard::read_profile(self, profile).map_err(|error| error.to_string())?;
        Ok(FeatureState {
            lighting: Some(LightingFeatureState {
                effect: state.lighting.effect,
                brightness: state.lighting.brightness,
                speed: state.lighting.speed,
                direction: state.lighting.direction,
                color: Some(state.lighting.color),
                multi_color: state.lighting.multi_color,
            }),
            snap_tap: Some(SnapTapState {
                enabled: state.snap_tap_enabled,
                pairs: state.snap_tap_pairs,
            }),
        })
    }
    fn read_profile(&self, profile: u8) -> Result<ProfileState, String> {
        common::Keyboard::read_profile(self, profile).map_err(|error| error.to_string())
    }
    fn switch_profile(&self, profile: u8) -> Result<(), String> {
        common::Keyboard::switch_profile(self, profile).map_err(|error| error.to_string())
    }
    fn apply_lighting(&self, profile: u8, settings: &LightingSettings) -> Result<(), String> {
        common::Keyboard::apply_lighting(self, profile, settings).map_err(|error| error.to_string())
    }
    fn apply_performance(&self, profile: u8, settings: &PerformanceSettings) -> Result<(), String> {
        common::Keyboard::apply_performance(self, profile, settings)
            .map_err(|error| error.to_string())
    }
    fn apply_snap_tap(&self, profile: u8, enabled: bool, pairs: &[SnapPair]) -> Result<(), String> {
        common::Keyboard::apply_snap_tap(self, profile, enabled, pairs)
            .map_err(|error| error.to_string())
    }
    fn apply_key_binding(
        &self,
        profile: u8,
        layer: u8,
        patch: &RawKeyBinding,
    ) -> Result<(), String> {
        common::Keyboard::apply_key_binding(self, profile, layer, patch)
            .map_err(|error| error.to_string())
    }
    fn write_macro(&self, macro_id: u8, events: &[MacroEvent]) -> Result<(), String> {
        common::Keyboard::write_macro(self, macro_id, events).map_err(|error| error.to_string())
    }
}

/// Open only the selected verified model on its exact vendor configuration collection.
pub fn open(
    api: &HidApi,
    info: &DeviceInfo,
    metadata: Option<&DeviceMetadata>,
) -> Result<Box<dyn ProtocolDriver>, String> {
    ensure_available(metadata)?;
    let metadata = metadata.ok_or("Missing device metadata")?;
    let canonical = crate::registry::devices()?
        .iter()
        .find(|device| device.id == metadata.id)
        .ok_or("Unknown model")?;
    if !crate::registry::interface_matches(canonical, info.usage_page(), info.usage()) {
        return Err("Selected HID collection does not match the model registry".into());
    }
    create_with_transport(
        info.open_device(api).map_err(|error| error.to_string())?,
        canonical,
        info.product_string()
            .unwrap_or("Dark Project Keyboard")
            .to_owned(),
        info.serial_number().map(str::to_owned),
    )
}

/// Select by canonical model identity and router. Production access is gated in open.
pub fn create_with_transport<T: transport::HidTransport + 'static>(
    transport: T,
    metadata: &'static DeviceMetadata,
    product_name: String,
    serial_number: Option<String>,
) -> Result<Box<dyn ProtocolDriver>, String> {
    if !crate::registry::devices()?.iter().any(|device| {
        device.id == metadata.id
            && device.router_id == metadata.router_id
            && device.style_name == metadata.style_name
    }) {
        return Err(
            "unsupported/unverified: model/router/layout identity is not registered".into(),
        );
    }
    if metadata.router_id == "CommonKeyboardSeries" {
        return Ok(Box::new(common::Keyboard {
            device: transport,
            product_name,
            serial_number,
        }));
    }
    Ok(Box::new(vendor::Keyboard::new(
        transport,
        codec(&metadata.router_id)?,
        metadata,
    )?))
}

fn codec(router_id: &str) -> Result<Box<dyn vendor::Codec>, String> {
    Ok(match router_id {
        "DponeSeries" => Box::new(dpone::Driver),
        "WitmodSeries" => Box::new(witmod::Driver),
        "TFTKeyboardSeries" => Box::new(tft::Driver),
        "SparkLinkSeries" => Box::new(sparklink::Driver),
        "HFDKBSeries" => Box::new(hfd::Driver),
        "HFDKBRGBSeries" => Box::new(hfd_rgb::Driver),
        _ => return Err("unsupported/unverified: unknown routerID".into()),
    })
}

impl<T: transport::HidTransport> ProtocolDriver for vendor::Keyboard<T> {
    fn vendor_request(&self, request: &vendor::Request) -> Result<serde_json::Value, String> {
        self.execute(request)
    }
    fn firmware_version(&self) -> Result<String, String> {
        self.execute(&vendor::Request::Version)?
            .as_str()
            .map(str::to_owned)
            .ok_or("Invalid firmware response".into())
    }
    fn current_profile(&self) -> Result<u8, String> {
        if self.metadata.profiles == 1 {
            Ok(0)
        } else {
            vendor::unsupported("current hardware profile")
        }
    }
    fn read_features(&self, profile: u8) -> Result<FeatureState, String> {
        if profile != 0 {
            return vendor::unsupported("nonzero family-native profile");
        }
        let capabilities = crate::registry::usable_capabilities(self.metadata);
        let lighting = if capabilities.lighting {
            Some(
                serde_json::from_value(self.execute(&vendor::Request::ReadLighting)?)
                    .map_err(|error| format!("Invalid family lighting response: {error}"))?,
            )
        } else {
            None
        };
        let snap_tap = if capabilities.snap_tap {
            Some(
                serde_json::from_value(self.execute(&vendor::Request::ReadSnap)?)
                    .map_err(|error| format!("Invalid family Snap Tap response: {error}"))?,
            )
        } else {
            None
        };
        Ok(FeatureState { lighting, snap_tap })
    }
    fn read_profile(&self, _profile: u8) -> Result<ProfileState, String> {
        vendor::unsupported(
            "complete Common ProfileState is not a family-native snapshot; use feature reads",
        )
    }
    fn switch_profile(&self, _profile: u8) -> Result<(), String> {
        vendor::unsupported("profile switching")
    }
    fn apply_lighting(&self, profile: u8, settings: &LightingSettings) -> Result<(), String> {
        if !crate::registry::usable_capabilities(self.metadata).lighting {
            return vendor::unsupported("lighting adapter for this family/model");
        }
        if profile != 0 {
            return vendor::unsupported("nonzero family-native profile");
        }
        self.execute(&vendor::Request::Lighting(settings.clone()))
            .map(|_| ())
    }
    fn apply_performance(
        &self,
        _profile: u8,
        _settings: &PerformanceSettings,
    ) -> Result<(), String> {
        vendor::unsupported("performance")
    }
    fn apply_snap_tap(&self, profile: u8, enabled: bool, pairs: &[SnapPair]) -> Result<(), String> {
        if !crate::registry::usable_capabilities(self.metadata).snap_tap {
            return vendor::unsupported("Snap Tap adapter for this family/model");
        }
        if profile != 0 {
            return vendor::unsupported("nonzero family-native profile");
        }
        self.execute(&vendor::Request::Snap {
            enabled,
            pairs: pairs.to_vec(),
        })
        .map(|_| ())
    }
    fn apply_key_binding(
        &self,
        _profile: u8,
        _layer: u8,
        _patch: &RawKeyBinding,
    ) -> Result<(), String> {
        vendor::unsupported("Common single-key patch is not a complete family-native key table")
    }
    fn write_macro(&self, _id: u8, _events: &[MacroEvent]) -> Result<(), String> {
        vendor::unsupported(
            "standalone macro writes are not exposed until the family table semantics are verified",
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::drivers::transport::mock::MockTransport;

    #[test]
    fn unverified_drivers_and_unknown_models_never_grant_transport_access() {
        assert!(ensure_available(None).is_err());
        for device in crate::registry::devices().unwrap() {
            assert_eq!(
                ensure_available(Some(device)).is_ok(),
                device.product_name == "DPKB_BUSHIDO_87_ANSI"
            );
        }
        for driver in DRIVERS.iter().skip(1) {
            assert!(driver.implemented);
        }
    }

    #[test]
    fn disabled_family_adapter_rejects_before_sending_transport_events() {
        let metadata = crate::registry::devices()
            .unwrap()
            .iter()
            .find(|device| device.router_id == "TFTKeyboardSeries")
            .unwrap();
        let driver = vendor::Keyboard::new(
            MockTransport::default(),
            Box::new(tft::Driver),
            metadata,
        )
        .unwrap();
        assert!(ProtocolDriver::apply_snap_tap(&driver, 0, true, &[]).is_err());
        assert!(driver.transport.events.borrow().is_empty());
    }

    #[test]
    fn bushido_effect_wire_ids_and_limits_remain_unchanged() {
        let mapping = [
            (0, 0),
            (1, 6),
            (2, 2),
            (3, 7),
            (4, 4),
            (5, 8),
            (6, 1),
            (7, 3),
            (8, 5),
            (9, 9),
            (10, 10),
            (11, 11),
            (12, 12),
            (13, 13),
            (19, 14),
        ];
        for (profile, hid) in mapping {
            assert_eq!(common::profile_to_hid_effect(profile), Some(hid));
            assert_eq!(common::hid_to_profile_effect(hid), Some(profile));
        }
        assert_eq!(common::profile_to_hid_effect(20), None);
        assert_eq!(common::hid_to_profile_effect(255), None);
        assert_eq!(
            (
                common::VID,
                common::PID,
                common::REPORT_ID,
                common::PROFILE_COUNT,
                common::KEY_SLOTS
            ),
            (0x342D, 0xE40F, 7, 3, 96)
        );
    }
}
