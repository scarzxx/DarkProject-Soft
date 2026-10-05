use std::{env, process::Command};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const RELEASE_PREFIX: &str = "https://github.com/scarzxx/DarkProject-Soft/releases/download/";
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn validate_release_asset(url: &str, file_name: &str) -> Result<(), String> {
    if !url.starts_with(RELEASE_PREFIX) {
        return Err("Update URL is not a DarkProject-Soft GitHub Release asset".into());
    }
    if file_name.is_empty() || file_name.contains('/') || file_name.contains('\\') {
        return Err("Invalid update file name".into());
    }
    if !file_name.to_ascii_lowercase().ends_with(".exe") {
        return Err("Only the Windows setup EXE can be installed automatically".into());
    }
    Ok(())
}

fn ps_quote(value: &str) -> String {
    value.replace('\'', "''")
}

#[cfg(windows)]
fn download_and_launch(url: &str, file_name: &str) -> Result<(), String> {
    validate_release_asset(url, file_name)?;
    let destination = env::temp_dir().join(file_name);
    let destination = destination
        .to_str()
        .ok_or_else(|| "Could not create a Windows update path".to_string())?;
    let url = ps_quote(url);
    let destination = ps_quote(destination);
    let script = format!(
        "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; \
         Invoke-WebRequest -UseBasicParsing -Uri '{url}' -OutFile '{destination}'; \
         Start-Process -FilePath '{destination}'"
    );
    let status = Command::new("powershell.exe")
        .args([
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &script,
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .status()
        .map_err(|error| format!("Could not start the GitHub Release downloader: {error}"))?;
    if !status.success() {
        return Err(format!(
            "GitHub Release download failed with exit code {}",
            status.code().unwrap_or(-1)
        ));
    }
    Ok(())
}

#[cfg(not(windows))]
fn download_and_launch(url: &str, file_name: &str) -> Result<(), String> {
    validate_release_asset(url, file_name)?;
    Err("Automatic GitHub Release installation is currently available on Windows only".into())
}

/// Download the installer only from this project's public GitHub Releases and launch it.
#[tauri::command]
pub async fn install_github_release(
    app: tauri::AppHandle,
    url: String,
    file_name: String,
) -> Result<(), String> {
    validate_release_asset(&url, &file_name)?;
    tauri::async_runtime::spawn_blocking(move || download_and_launch(&url, &file_name))
        .await
        .map_err(|error| format!("Update task failed: {error}"))??;
    app.exit(0);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_this_repository_release_setup_exe_is_accepted() {
        assert!(validate_release_asset(
            "https://github.com/scarzxx/DarkProject-Soft/releases/download/v0.4.1/Dark-Control-v0.4.1-Windows-x64-setup.exe",
            "Dark-Control-v0.4.1-Windows-x64-setup.exe"
        )
        .is_ok());
        assert!(validate_release_asset(
            "https://example.com/update.exe",
            "update.exe"
        )
        .is_err());
        assert!(validate_release_asset(
            "https://github.com/scarzxx/DarkProject-Soft/releases/download/v0.4.1/file.msi",
            "../file.msi"
        )
        .is_err());
    }
}
