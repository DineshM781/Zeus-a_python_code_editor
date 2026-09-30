// ============================================================
// ZEUS — Jupyter Kernel Commands (Lazy-loaded)
// ============================================================
// Replaces: src/main/ipc/handlers/kernel.handler.ts
// Kernel starts ONLY when a .ipynb file is opened.
// Uses python -m ipykernel_launcher for kernel process.
// ============================================================

use std::collections::HashMap;
use std::io::Read;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::state::{AppState, KernelEntry};

// ── Types ────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct KernelInfo {
    pub id: String,
    pub name: String,
    pub language: String,
    pub state: String, // "idle" | "busy" | "dead" | "starting"
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct KernelOutput {
    pub execution_id: String,
    #[serde(rename = "type")]
    pub output_type: String, // "stream" | "execute_result" | "error"
    pub data: serde_json::Value,
    pub text: Option<String>,
    pub ename: Option<String>,
    pub evalue: Option<String>,
    pub traceback: Option<Vec<String>>,
    pub execution_count: Option<u32>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct KernelStatusEvent {
    pub id: String,
    pub state: String,
    pub message: Option<String>,
}

// ── Commands ─────────────────────────────────────────────────

#[tauri::command]
pub async fn kernel_start(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    python_path: String,
    cwd: String,
) -> Result<serde_json::Value, String> {
    let id = Uuid::new_v4().to_string();
    let python = if python_path.is_empty() { "python".to_string() } else { python_path.clone() };
    let work_dir = if cwd.is_empty() {
        dirs::home_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| ".".to_string())
    } else {
        cwd.clone()
    };

    let conn_file = std::env::temp_dir()
        .join(format!("zeus_kernel_{}.json", id))
        .to_string_lossy()
        .to_string();

    let child = Command::new(&python)
        .args([
            "-m", "ipykernel_launcher",
            "-f", &conn_file,
        ])
        .current_dir(&work_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start kernel: {}", e))?;

    let kernel_id = id.clone();
    let app_clone = app.clone();

    // Wait for connection file to appear (up to 10 seconds)
    let conn_file_wait = conn_file.clone();
    tokio::task::spawn_blocking(move || {
        let start = Instant::now();
        while start.elapsed() < Duration::from_secs(10) {
            if std::path::Path::new(&conn_file_wait).exists() {
                break;
            }
            thread::sleep(Duration::from_millis(200));
        }
    })
    .await
    .map_err(|e| e.to_string())?;

    // Store kernel in state
    {
        let mut kernels = state.kernels.lock().unwrap();
        kernels.insert(id.clone(), KernelEntry {
            child,
            connection_file: conn_file,
            python_path: python.clone(),
            cwd: work_dir.clone(),
            state: "idle".to_string(),
        });
    }

    // Emit initial status
    let _ = app.emit("kernel:status", KernelStatusEvent {
        id: id.clone(),
        state: "idle".to_string(),
        message: None,
    });

    Ok(serde_json::json!({
        "id": id,
        "name": "python3",
        "language": "python",
        "state": "idle"
    }))
}

#[tauri::command]
pub async fn kernel_stop(
    state: tauri::State<'_, AppState>,
    kernel_id: String,
) -> Result<bool, String> {
    let mut kernels = state.kernels.lock().unwrap();
    if let Some(mut kernel) = kernels.remove(&kernel_id) {
        let _ = kernel.child.kill();
        let _ = std::fs::remove_file(&kernel.connection_file);
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn kernel_interrupt(
    state: tauri::State<'_, AppState>,
    kernel_id: String,
) -> Result<bool, String> {
    let mut kernels = state.kernels.lock().unwrap();
    if let Some(kernel) = kernels.get_mut(&kernel_id) {
        // On Windows, we can't send SIGINT directly. Kill and restart is the workaround.
        // On Unix, we'd use kill(pid, SIGINT).
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            let pid = kernel.child.id();
            unsafe {
                libc::kill(pid as i32, libc::SIGINT);
            }
        }
        #[cfg(windows)]
        {
            // Best effort on Windows: send Ctrl+C via GenerateConsoleCtrlEvent or just kill
            // For now, mark as a no-op since proper SIGINT requires extra work on Windows
            // The user can use kernel_restart to recover
        }
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn kernel_restart(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    kernel_id: String,
    python_path: String,
    cwd: String,
) -> Result<serde_json::Value, String> {
    // Stop existing kernel
    {
        let mut kernels = state.kernels.lock().unwrap();
        if let Some(mut kernel) = kernels.remove(&kernel_id) {
            let _ = kernel.child.kill();
            let _ = std::fs::remove_file(&kernel.connection_file);
        }
    }

    let python = if python_path.is_empty() { "python".to_string() } else { python_path };
    let work_dir = if cwd.is_empty() {
        dirs::home_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| ".".to_string())
    } else {
        cwd
    };

    let conn_file = std::env::temp_dir()
        .join(format!("zeus_kernel_{}.json", &kernel_id))
        .to_string_lossy()
        .to_string();

    let _ = app.emit("kernel:status", KernelStatusEvent {
        id: kernel_id.clone(),
        state: "restarting".to_string(),
        message: None,
    });

    let child = Command::new(&python)
        .args(["-m", "ipykernel_launcher", "-f", &conn_file])
        .current_dir(&work_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to restart kernel: {}", e))?;

    // Wait for connection file
    let conn_file_wait = conn_file.clone();
    tokio::task::spawn_blocking(move || {
        let start = Instant::now();
        while start.elapsed() < Duration::from_secs(10) {
            if std::path::Path::new(&conn_file_wait).exists() {
                break;
            }
            thread::sleep(Duration::from_millis(200));
        }
    })
    .await
    .map_err(|e| e.to_string())?;

    {
        let mut kernels = state.kernels.lock().unwrap();
        kernels.insert(kernel_id.clone(), KernelEntry {
            child,
            connection_file: conn_file,
            python_path: python,
            cwd: work_dir,
            state: "idle".to_string(),
        });
    }

    let _ = app.emit("kernel:status", KernelStatusEvent {
        id: kernel_id.clone(),
        state: "idle".to_string(),
        message: None,
    });

    Ok(serde_json::json!({ "success": true }))
}

/// Execute a notebook cell by running code in a subprocess.
/// For production Jupyter protocol, ZMQ messaging would be used.
/// This implementation runs cells via python subprocess with output streaming.
#[tauri::command]
pub async fn kernel_execute(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    execution_id: String,
    kernel_id: String,
    code: String,
    python_path: String,
    cwd: String,
) -> Result<serde_json::Value, String> {
    if code.trim().is_empty() {
        return Ok(serde_json::json!({ "executionCount": 0 }));
    }

    let python = {
        let kernels = state.kernels.lock().unwrap();
        kernels.get(&kernel_id)
            .map(|k| k.python_path.clone())
            .unwrap_or_else(|| {
                if python_path.is_empty() { "python".to_string() } else { python_path.clone() }
            })
    };

    let work_dir = {
        let kernels = state.kernels.lock().unwrap();
        kernels.get(&kernel_id)
            .map(|k| k.cwd.clone())
            .unwrap_or_else(|| {
                if cwd.is_empty() {
                    dirs::home_dir()
                        .map(|p| p.to_string_lossy().to_string())
                        .unwrap_or_else(|| ".".to_string())
                } else {
                    cwd.clone()
                }
            })
    };

    // Update kernel state
    {
        let mut kernels = state.kernels.lock().unwrap();
        if let Some(k) = kernels.get_mut(&kernel_id) {
            k.state = "busy".to_string();
        }
    }

    let _ = app.emit("kernel:status", KernelStatusEvent {
        id: kernel_id.clone(),
        state: "busy".to_string(),
        message: None,
    });

    // Write cell code to temp file
    let tmp = std::env::temp_dir().join(format!(
        "zeus_cell_{}.py",
        Uuid::new_v4().as_simple()
    ));
    std::fs::write(&tmp, code.as_bytes()).map_err(|e| e.to_string())?;

    let tmp_str = tmp.to_string_lossy().to_string();
    let execution_id_clone = execution_id.clone();
    let kernel_id_clone = kernel_id.clone();
    let app_clone = app.clone();

    let result = tokio::task::spawn_blocking(move || {
        let mut child = Command::new(&python)
            .arg(&tmp_str)
            .current_dir(&work_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| e.to_string())?;

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        // Stream stdout
        if let Some(mut out) = stdout {
            let eid = execution_id_clone.clone();
            let app_s = app_clone.clone();
            thread::spawn(move || {
                let mut buf = [0u8; 4096];
                loop {
                    match out.read(&mut buf) {
                        Ok(0) => break,
                        Ok(n) => {
                            let text = String::from_utf8_lossy(&buf[..n]).to_string();
                            let _ = app_s.emit("kernel:output", KernelOutput {
                                execution_id: eid.clone(),
                                output_type: "stream".to_string(),
                                data: serde_json::json!({ "text": text }),
                                text: Some(text),
                                ename: None,
                                evalue: None,
                                traceback: None,
                                execution_count: None,
                            });
                        }
                        Err(_) => break,
                    }
                }
            });
        }

        // Collect stderr
        let mut stderr_str = String::new();
        if let Some(mut err) = stderr {
            let _ = err.read_to_string(&mut stderr_str);
        }

        let _ = child.wait();
        let _ = std::fs::remove_file(&tmp_str);

        if !stderr_str.is_empty() {
            let lines: Vec<String> = stderr_str.lines().map(|l| l.to_string()).collect();
            let _ = app_clone.emit("kernel:output", KernelOutput {
                execution_id: execution_id_clone.clone(),
                output_type: "error".to_string(),
                data: serde_json::json!({ "text": stderr_str.clone() }),
                text: None,
                ename: Some("Error".to_string()),
                evalue: Some(lines.first().cloned().unwrap_or_default()),
                traceback: Some(lines),
                execution_count: None,
            });
        }

        Ok::<(), String>(())
    })
    .await
    .map_err(|e| e.to_string())?;

    // Update kernel state back to idle
    {
        let mut kernels = state.kernels.lock().unwrap();
        if let Some(k) = kernels.get_mut(&kernel_id) {
            k.state = "idle".to_string();
        }
    }

    let _ = app.emit("kernel:status", KernelStatusEvent {
        id: kernel_id,
        state: "idle".to_string(),
        message: None,
    });

    Ok(serde_json::json!({ "executionCount": 1 }))
}

#[tauri::command]
pub async fn kernel_list(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<KernelInfo>, String> {
    let kernels = state.kernels.lock().unwrap();
    Ok(kernels
        .iter()
        .map(|(id, k)| KernelInfo {
            id: id.clone(),
            name: "python3".to_string(),
            language: "python".to_string(),
            state: k.state.clone(),
        })
        .collect())
}
