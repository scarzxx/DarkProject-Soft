mod device_manager;
mod drivers;
mod models;
mod registry;
mod tray;
mod updater;

use models::{
    DeviceSummary, FeatureState, LightingSettings, MacroEvent, PerformanceSettings, ProfileState,
    RawKeyBinding, SnapPair,
};

#[tauri::command]
fn scan_devices() -> Result<Vec<DeviceSummary>, String> {
    device_manager::scan_devices()
}

#[tauri::command]
fn scan_device(device_id: Option<String>) -> Result<DeviceSummary, String> {
    device_manager::scan_device(device_id.as_deref())
}

#[tauri::command]
fn read_features(device_id: Option<String>, profile: u8) -> Result<FeatureState, String> {
    device_manager::open_driver(device_id.as_deref())?.read_features(profile)
}

#[tauri::command]
fn read_profile(device_id: Option<String>, profile: u8) -> Result<ProfileState, String> {
    device_manager::open_driver(device_id.as_deref())?.read_profile(profile)
}

#[tauri::command]
fn switch_profile(device_id: Option<String>, profile: u8) -> Result<(), String> {
    device_manager::open_driver(device_id.as_deref())?.switch_profile(profile)
}

#[tauri::command]
fn apply_lighting(
    device_id: Option<String>,
    profile: u8,
    settings: LightingSettings,
) -> Result<(), String> {
    device_manager::open_driver(device_id.as_deref())?.apply_lighting(profile, &settings)
}

#[tauri::command]
fn apply_performance(
    device_id: Option<String>,
    profile: u8,
    settings: PerformanceSettings,
) -> Result<(), String> {
    device_manager::open_driver(device_id.as_deref())?.apply_performance(profile, &settings)
}

#[tauri::command]
fn apply_snap_tap(
    device_id: Option<String>,
    profile: u8,
    enabled: bool,
    pairs: Vec<SnapPair>,
) -> Result<(), String> {
    device_manager::open_driver(device_id.as_deref())?.apply_snap_tap(profile, enabled, &pairs)
}

#[tauri::command]
fn apply_key_binding(
    device_id: Option<String>,
    profile: u8,
    layer: u8,
    patch: RawKeyBinding,
) -> Result<(), String> {
    device_manager::open_driver(device_id.as_deref())?.apply_key_binding(profile, layer, &patch)
}

#[tauri::command]
fn write_macro(
    device_id: Option<String>,
    macro_id: u8,
    events: Vec<MacroEvent>,
) -> Result<(), String> {
    device_manager::open_driver(device_id.as_deref())?.write_macro(macro_id, &events)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        if let Err(error) = tray::show_window(app) {
            eprintln!("Could not restore the running window: {error}");
        }
    }));

    builder
        .setup(tray::setup)
        .on_window_event(tray::on_window_event)
        .invoke_handler(tauri::generate_handler![
            scan_devices,
            scan_device,
            read_features,
            read_profile,
            switch_profile,
            apply_lighting,
            apply_performance,
            apply_snap_tap,
            apply_key_binding,
            write_macro,
            tray::get_close_to_tray,
            tray::set_close_to_tray,
            tray::set_tray_language,
            tray::hide_to_tray,
            updater::install_github_release
        ])
        .run(tauri::generate_context!())
        .expect("error while running Dark Control");
}
