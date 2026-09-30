// ============================================================
// ZEUS — App Commands
// ============================================================
// Replaces: src/main/ipc/handlers/app.handler.ts
// Window management is handled by Tauri's built-in window API.
// Only app-level utility commands are implemented here.
// ============================================================

use tauri::AppHandle;

#[tauri::command]
pub async fn app_get_version(app: AppHandle) -> Result<String, String> {
    let version = app.package_info().version.to_string();
    Ok(version)
}

#[tauri::command]
pub async fn app_open_external(url: String) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(true)
}

#[tauri::command]
pub async fn app_open_path(file_path: String) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&file_path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(true)
}
