// ============================================================
// ZEUS — File System Commands
// ============================================================
// Replaces: src/main/ipc/handlers/fs.handler.ts
// All Electron dialog/fs/chokidar calls → Tauri + Rust std::fs
// ============================================================

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::thread;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

use crate::state::AppState;

// ── Types ────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub size: Option<u64>,
    pub extension: Option<String>,
    pub children: Option<Vec<FileEntry>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FileChangeEvent {
    #[serde(rename = "type")]
    pub event_type: String, // "add" | "change" | "unlink" | "addDir" | "unlinkDir"
    pub path: String,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DialogOpenOptions {
    pub title: Option<String>,
    pub filters: Option<Vec<DialogFilter>>,
    pub multiple: Option<bool>,
    pub directory: Option<bool>,
    pub default_path: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct DialogFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DialogOpenResult {
    pub canceled: bool,
    pub file_paths: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DialogSaveResult {
    pub canceled: bool,
    pub file_path: Option<String>,
}

// ── Helpers ──────────────────────────────────────────────────

fn build_file_entry(path: &Path) -> Option<FileEntry> {
    let meta = fs::metadata(path).ok()?;
    let name = path.file_name()?.to_string_lossy().to_string();
    let is_directory = meta.is_dir();
    let size = if meta.is_file() { Some(meta.len()) } else { None };
    let extension = if meta.is_file() {
        path.extension().map(|e| format!(".{}", e.to_string_lossy().to_lowercase()))
    } else {
        None
    };

    Some(FileEntry {
        name,
        path: path.to_string_lossy().replace('\\', "/"),
        is_directory,
        size,
        extension,
        children: None,
    })
}

fn should_skip(name: &str) -> bool {
    // Skip hidden dirs except .env variants, and common noise dirs
    if name == "__pycache__" || name == "node_modules" || name == ".git" {
        return true;
    }
    if name.starts_with('.') && !name.starts_with(".env") && !name.starts_with(".venv") {
        return true;
    }
    false
}

fn list_dir_recursive(dir: &Path, depth: usize, max_depth: usize) -> Vec<FileEntry> {
    let Ok(entries) = fs::read_dir(dir) else {
        return vec![];
    };

    let mut dirs: Vec<FileEntry> = Vec::new();
    let mut files: Vec<FileEntry> = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();

        if should_skip(&name) {
            continue;
        }

        let Some(mut fe) = build_file_entry(&path) else {
            continue;
        };

        if fe.is_directory && depth < max_depth {
            fe.children = Some(list_dir_recursive(&path, depth + 1, max_depth));
            dirs.push(fe);
        } else if fe.is_directory {
            fe.children = Some(vec![]);
            dirs.push(fe);
        } else {
            files.push(fe);
        }
    }

    // Sort: dirs alphabetically, then files alphabetically
    dirs.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    dirs.extend(files);
    dirs
}

// ── Commands ─────────────────────────────────────────────────

#[tauri::command]
pub async fn fs_read_file(file_path: String) -> Result<String, String> {
    fs::read_to_string(&file_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fs_write_file(file_path: String, content: String) -> Result<bool, String> {
    if let Some(parent) = Path::new(&file_path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&file_path, content.as_bytes()).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub async fn fs_list_dir(dir_path: String) -> Result<Vec<FileEntry>, String> {
    let path = PathBuf::from(&dir_path);
    if !path.is_dir() {
        return Err(format!("Not a directory: {}", dir_path));
    }
    Ok(list_dir_recursive(&path, 0, 3))
}

#[tauri::command]
pub async fn fs_create_file(file_path: String) -> Result<bool, String> {
    if let Some(parent) = Path::new(&file_path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&file_path, b"").map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub async fn fs_create_dir(dir_path: String) -> Result<bool, String> {
    fs::create_dir_all(&dir_path).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub async fn fs_delete(target_path: String) -> Result<bool, String> {
    let path = PathBuf::from(&target_path);
    if path.is_dir() {
        fs::remove_dir_all(&path).map_err(|e| e.to_string())?;
    } else {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(true)
}

#[tauri::command]
pub async fn fs_rename(old_path: String, new_path: String) -> Result<bool, String> {
    fs::rename(&old_path, &new_path).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub async fn fs_move(src_path: String, dest_path: String) -> Result<bool, String> {
    fs::rename(&src_path, &dest_path).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub async fn fs_exists(target_path: String) -> Result<bool, String> {
    Ok(Path::new(&target_path).exists())
}

#[tauri::command]
pub async fn fs_get_home() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().replace('\\', "/"))
        .ok_or_else(|| "Cannot determine home directory".to_string())
}

// ── File Watcher ─────────────────────────────────────────────

#[tauri::command]
pub async fn fs_watch_start(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    dir_path: String,
) -> Result<bool, String> {
    use notify::{Watcher, RecursiveMode, recommended_watcher, Event, EventKind};

    let mut watchers = state.watchers.lock().unwrap();
    if watchers.contains_key(&dir_path) {
        return Ok(true); // already watching
    }

    let (stop_tx, stop_rx) = std::sync::mpsc::channel::<()>();
    let dir_clone = dir_path.clone();
    let app_clone = app.clone();

    thread::spawn(move || {
        let (tx, rx) = std::sync::mpsc::channel::<notify::Result<Event>>();

        let mut watcher = match recommended_watcher(tx) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("[FS Watch] Failed to create watcher: {}", e);
                return;
            }
        };

        if let Err(e) = watcher.watch(Path::new(&dir_clone), RecursiveMode::Recursive) {
            eprintln!("[FS Watch] Failed to watch {}: {}", dir_clone, e);
            return;
        }

        loop {
            // Check for stop signal (non-blocking)
            if stop_rx.try_recv().is_ok() {
                break;
            }

            // Check for file events with timeout
            match rx.recv_timeout(std::time::Duration::from_millis(100)) {
                Ok(Ok(event)) => {
                    let event_type = match event.kind {
                        EventKind::Create(ck) => {
                            if format!("{:?}", ck).contains("Dir") { "addDir" } else { "add" }
                        }
                        EventKind::Modify(_) => "change",
                        EventKind::Remove(rk) => {
                            if format!("{:?}", rk).contains("Dir") { "unlinkDir" } else { "unlink" }
                        }
                        _ => continue,
                    };

                    for path in event.paths {
                        let path_str = path.to_string_lossy().replace('\\', "/");
                        let fe = FileChangeEvent {
                            event_type: event_type.to_string(),
                            path: path_str,
                        };
                        let _ = app_clone.emit("fs:changed", fe);
                    }
                }
                Ok(Err(e)) => eprintln!("[FS Watch] Error: {}", e),
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {}
                Err(_) => break, // channel closed
            }
        }
    });

    watchers.insert(dir_path, stop_tx);
    Ok(true)
}

#[tauri::command]
pub async fn fs_watch_stop(
    state: tauri::State<'_, AppState>,
    dir_path: String,
) -> Result<bool, String> {
    let mut watchers = state.watchers.lock().unwrap();
    if let Some(tx) = watchers.remove(&dir_path) {
        let _ = tx.send(());
    }
    Ok(true)
}

// ── Dialogs ──────────────────────────────────────────────────

#[tauri::command]
pub async fn fs_open_dialog(
    app: AppHandle,
    options: Option<serde_json::Value>,
) -> Result<DialogOpenResult, String> {
    use tauri_plugin_dialog::DialogExt;

    let is_directory = options
        .as_ref()
        .and_then(|o| o.get("directory"))
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

    let title = options
        .as_ref()
        .and_then(|o| o.get("title"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "Open".to_string());

    // Use blocking dialog on a separate thread
    let (tx, rx) = std::sync::mpsc::channel();
    let app_clone = app.clone();
    let title_clone = title.clone();

    thread::spawn(move || {
        let dialog = app_clone.dialog();
        if is_directory {
            dialog.file()
                .set_title(&title_clone)
                .pick_folder(move |result| {
                    let _ = tx.send(result.map(|p| vec![p.to_string()]));
                });
        } else {
            dialog.file()
                .set_title(&title_clone)
                .pick_file(move |result| {
                    let _ = tx.send(result.map(|p| vec![p.to_string()]));
                });
        }
    });

    match rx.recv_timeout(std::time::Duration::from_secs(300)) {
        Ok(Some(paths)) => Ok(DialogOpenResult {
            canceled: false,
            file_paths: paths,
        }),
        Ok(None) => Ok(DialogOpenResult {
            canceled: true,
            file_paths: vec![],
        }),
        Err(_) => Ok(DialogOpenResult {
            canceled: true,
            file_paths: vec![],
        }),
    }
}

#[tauri::command]
pub async fn fs_save_dialog(
    app: AppHandle,
    options: Option<serde_json::Value>,
) -> Result<DialogSaveResult, String> {
    use tauri_plugin_dialog::DialogExt;

    let title = options
        .as_ref()
        .and_then(|o| o.get("title"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "Save As".to_string());

    let (tx, rx) = std::sync::mpsc::channel();
    let app_clone = app.clone();
    let title_clone = title.clone();

    thread::spawn(move || {
        app_clone.dialog().file()
            .set_title(&title_clone)
            .save_file(move |result| {
                let _ = tx.send(result.map(|p| p.to_string()));
            });
    });

    match rx.recv_timeout(std::time::Duration::from_secs(300)) {
        Ok(Some(path)) => Ok(DialogSaveResult {
            canceled: false,
            file_path: Some(path),
        }),
        Ok(None) => Ok(DialogSaveResult {
            canceled: true,
            file_path: None,
        }),
        Err(_) => Ok(DialogSaveResult {
            canceled: true,
            file_path: None,
        }),
    }
}
