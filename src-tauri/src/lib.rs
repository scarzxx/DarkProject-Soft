mod models;
mod protocol;

use models::*;
use protocol::{Keyboard, PID, PROFILE_COUNT, VID};

fn err(e: impl std::fmt::Display) -> String { e.to_string() }

#[tauri::command]
fn scan_device() -> Result<DeviceSummary, String> {
    let k = Keyboard::open().map_err(err)?;
    let firmware = k.firmware_version().unwrap_or_else(|_| "unknown".into());
    let active_profile = k.current_profile().unwrap_or(0);
    let product = k.product_name.clone();
    let layout = if product.contains("ANSI") {
        "ANSI"
    } else if product.contains("ISO") {
        "ISO"
    } else {
        "Unknown"
    };

    // DPKB_BUSHIDO_87_* vendor metadata:
    // PerformanceFlag=false, LightingFlag=true, SnapTapFlag=true,
    // HardwareProfileNum=3, FnNums=1, LightingData=[0..13, 19].
    let capabilities = DeviceCapabilities {
        lighting: true,
        custom_lighting: true,
        keybindings: true,
        fn_layer: true,
        snap_tap: true,
        macros: true,
        performance: false,
        profiles: true,
        max_snap_tap_pairs: 20,
        lighting_effects: vec![0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 19],
    };

    Ok(DeviceSummary {
        connected: true,
        product_name: product,
        serial_number: k.serial_number.clone(),
        vendor_id: VID,
        product_id: PID,
        firmware,
        layout: layout.into(),
        protocol: "CommonKeyboardSeries".into(),
        profiles: PROFILE_COUNT,
        active_profile,
        capabilities,
    })
}

#[tauri::command]
fn read_profile(profile: u8) -> Result<ProfileState, String> {
    Keyboard::open().map_err(err)?.read_profile(profile).map_err(err)
}

#[tauri::command]
fn switch_profile(profile: u8) -> Result<(), String> {
    Keyboard::open().map_err(err)?.switch_profile(profile).map_err(err)
}

#[tauri::command]
fn apply_lighting(profile: u8, settings: LightingSettings) -> Result<(), String> {
    Keyboard::open().map_err(err)?.apply_lighting(profile, &settings).map_err(err)
}

#[tauri::command]
fn apply_performance(profile: u8, settings: PerformanceSettings) -> Result<(), String> {
    Keyboard::open().map_err(err)?.apply_performance(profile, &settings).map_err(err)
}

#[tauri::command]
fn apply_snap_tap(profile: u8, enabled: bool, pairs: Vec<SnapPair>) -> Result<(), String> {
    Keyboard::open().map_err(err)?.apply_snap_tap(profile, enabled, &pairs).map_err(err)
}

#[tauri::command]
fn apply_key_binding(profile: u8, layer: u8, patch: RawKeyBinding) -> Result<(), String> {
    Keyboard::open().map_err(err)?.apply_key_binding(profile, layer, &patch).map_err(err)
}

#[tauri::command]
fn write_macro(macro_id: u8, events: Vec<MacroEvent>) -> Result<(), String> {
    Keyboard::open().map_err(err)?.write_macro(macro_id, &events).map_err(err)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            scan_device,
            read_profile,
            switch_profile,
            apply_lighting,
            apply_performance,
            apply_snap_tap,
            apply_key_binding,
            write_macro
        ])
        .run(tauri::generate_context!())
        .expect("error while running Dark Control");
}
