use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceCapabilities {
    pub lighting: bool,
    pub custom_lighting: bool,
    pub keybindings: bool,
    pub fn_layer: bool,
    pub snap_tap: bool,
    pub macros: bool,
    pub performance: bool,
    pub profiles: bool,
    pub max_snap_tap_pairs: u8,
    pub lighting_effects: Vec<u8>,
    pub tft: bool,
    pub sync: bool,
    pub actuation: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceSummary {
    pub id: String,
    pub registry_id: Option<String>,
    pub style_name: Option<String>,
    pub known: bool,
    pub verified: bool,
    pub connected: bool,
    pub product_name: String,
    pub serial_number: Option<String>,
    pub vendor_id: u16,
    pub product_id: u16,
    pub firmware: String,
    pub layout: String,
    pub protocol: String,
    pub profiles: u8,
    pub active_profile: u8,
    pub capabilities: DeviceCapabilities,
    pub advertised_capabilities: DeviceCapabilities,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LightingSettings {
    pub effect: u8,
    pub brightness: u8,
    pub speed: u8,
    pub direction: u8,
    pub color: [u8; 3],
    pub multi_color: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceSettings {
    pub polling_rate: u16,
    pub input_latency: u8,
    pub debounce: u8,
    pub sleep_time: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapPair {
    pub kind: u8,
    pub key1: u8,
    pub key2: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RawKeyBinding {
    pub slot: usize,
    pub code: u8,
    pub kind: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MacroEvent {
    pub hid: u8,
    pub delay: u16,
    pub pressed: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MacroDefinition {
    pub id: u8,
    pub events: Vec<MacroEvent>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileState {
    pub profile: u8,
    pub lighting: LightingSettings,
    pub performance: PerformanceSettings,
    pub snap_tap_enabled: bool,
    pub snap_tap_pairs: Vec<SnapPair>,
    pub key_bindings: Vec<RawKeyBinding>,
    pub fn_key_bindings: Vec<RawKeyBinding>,
    pub macros: Vec<MacroDefinition>,
}
