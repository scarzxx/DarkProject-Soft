use std::{
    fs,
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, State, WindowEvent, Wry,
};

const TRAY_ID: &str = "dark-control-tray";

pub struct TrayState {
    enabled: AtomicBool,
    path: PathBuf,
    open: MenuItem<Wry>,
    quit: MenuItem<Wry>,
}

fn load_preference(path: &Path) -> Result<bool, String> {
    match fs::read(path) {
        Ok(data) => serde_json::from_slice(&data).map_err(|error| error.to_string()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error.to_string()),
    }
}

fn save_preference(path: &Path, enabled: bool) -> Result<(), String> {
    let directory = path.parent().ok_or("Missing preferences directory")?;
    fs::create_dir_all(directory).map_err(|error| error.to_string())?;
    fs::write(
        path,
        if enabled {
            b"true".as_slice()
        } else {
            b"false".as_slice()
        },
    )
    .map_err(|error| error.to_string())
}

fn show_window(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.show()?;
        window.unminimize()?;
        window.set_focus()?;
    }
    Ok(())
}

/// Create a recoverable tray menu before honoring the saved close behavior.
pub fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let path = app.path().app_config_dir()?.join("close-to-tray.json");
    let enabled = load_preference(&path).unwrap_or_else(|error| {
        eprintln!("Could not load tray preference: {error}");
        false
    });
    let open = MenuItem::with_id(app, "tray-open", "Open Dark Control", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "tray-quit", "Exit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &quit])?;
    let icon = app
        .default_window_icon()
        .ok_or("Application icon is unavailable")?
        .clone();
    let tray = TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .tooltip("Dark Control")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "tray-open" => {
                if let Err(error) = show_window(app) {
                    eprintln!("Could not restore window: {error}");
                }
            }
            "tray-quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if matches!(
                event,
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                }
            ) {
                if let Err(error) = show_window(tray.app_handle()) {
                    eprintln!("Could not restore window: {error}");
                }
            }
        })
        .build(app)?;
    tray.set_visible(enabled)?;
    app.manage(TrayState {
        enabled: AtomicBool::new(enabled),
        path,
        open,
        quit,
    });
    Ok(())
}

/// Preserve normal closing unless the user enabled a working tray icon.
pub fn on_window_event(window: &tauri::Window, event: &WindowEvent) {
    if window.label() == "main" {
        if let WindowEvent::CloseRequested { api, .. } = event {
            if window.state::<TrayState>().enabled.load(Ordering::Relaxed) {
                match window.hide() {
                    Ok(()) => api.prevent_close(),
                    Err(error) => eprintln!("Could not hide window: {error}"),
                }
            }
        }
    }
}

#[tauri::command]
pub fn get_close_to_tray(state: State<'_, TrayState>) -> bool {
    state.enabled.load(Ordering::Relaxed)
}

#[tauri::command]
pub fn set_close_to_tray(
    app: AppHandle,
    state: State<'_, TrayState>,
    enabled: bool,
) -> Result<(), String> {
    let tray = app
        .tray_by_id(TRAY_ID)
        .ok_or("System tray is unavailable")?;
    tray.set_visible(enabled)
        .map_err(|error| error.to_string())?;
    if let Err(error) = save_preference(&state.path, enabled) {
        if let Err(restore_error) = tray.set_visible(state.enabled.load(Ordering::Relaxed)) {
            return Err(format!("{error}; tray restore failed: {restore_error}"));
        }
        return Err(error);
    }
    state.enabled.store(enabled, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub fn set_tray_language(state: State<'_, TrayState>, language: String) -> Result<(), String> {
    let (open, quit) = match language.as_str() {
        "cs" => ("Otevřít Dark Control", "Ukončit"),
        "sk" => ("Otvoriť Dark Control", "Ukončiť"),
        "en" => ("Open Dark Control", "Exit"),
        _ => return Err("Unsupported tray language".into()),
    };
    state
        .open
        .set_text(open)
        .map_err(|error| error.to_string())?;
    state.quit.set_text(quit).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn hide_to_tray(app: AppHandle, state: State<'_, TrayState>) -> Result<(), String> {
    if !state.enabled.load(Ordering::Relaxed) {
        return Err("Enable close to tray first".into());
    }
    app.get_webview_window("main")
        .ok_or("Main window is unavailable")?
        .hide()
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tray_preference_defaults_off_and_survives_restart() {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(format!(
            "../test-output/tray-{}/close-to-tray.json",
            std::process::id()
        ));
        assert!(!load_preference(&path).unwrap());
        save_preference(&path, true).unwrap();
        assert!(load_preference(&path).unwrap());
        save_preference(&path, false).unwrap();
        assert!(!load_preference(&path).unwrap());
        fs::write(&path, b"invalid").unwrap();
        assert!(load_preference(&path).is_err());
    }

    #[test]
    fn persistence_errors_are_not_successful_updates() {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(format!(
            "../test-output/tray-blocked-{}",
            std::process::id()
        ));
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, b"file").unwrap();
        assert!(save_preference(&path.join("settings.json"), true).is_err());
    }
}
