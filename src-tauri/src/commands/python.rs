// ============================================================
// ZEUS — Python Commands
// ============================================================
// Replaces: src/main/ipc/handlers/python.handler.ts
// Manages Python process lifecycle: detect, run, kill
// ============================================================

use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;

#[allow(unused_imports)]
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::state::AppState;

// ── Types ────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PythonEnvironment {
    pub path: String,
    pub version: String,
    pub name: String,
    pub is_venv: bool,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PythonRunOptions {
    pub file_path: Option<String>,
    pub code: Option<String>,
    pub python_path: String,
    pub cwd: Option<String>,
    pub env: Option<HashMap<String, String>>,
    pub run_id: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PythonRunChunk {
    pub run_id: String,
    pub stream: String, // "stdout" | "stderr"
    pub data: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PythonRunResult {
    pub exit_code: i32,
}

// ── Helpers ──────────────────────────────────────────────────

fn get_python_version(python_cmd: &str) -> Option<String> {
    let output = Command::new(python_cmd)
        .args(["--version"])
        .stderr(Stdio::piped())
        .stdout(Stdio::piped())
        .output()
        .ok()?;

    let combined = format!(
        "{} {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );

    let re = regex::Regex::new(r"Python (\d+\.\d+\.\d+)").ok()?;
    re.captures(combined.trim())
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string())
}

fn detect_system_pythons() -> Vec<PythonEnvironment> {
    let candidates = if cfg!(windows) {
        vec!["python", "python3", "py"]
    } else {
        vec!["python3", "python"]
    };

    let mut found = Vec::new();
    for cmd in candidates {
        if let Some(version) = get_python_version(cmd) {
            found.push(PythonEnvironment {
                path: cmd.to_string(),
                version,
                name: format!("system ({})", cmd),
                is_venv: false,
            });
        }
    }
    found
}

fn find_venv_python(project_root: &str) -> Vec<PythonEnvironment> {
    let venv_names = [".venv", "venv", "env", ".env"];
    let mut found = Vec::new();

    for name in &venv_names {
        let venv_path = PathBuf::from(project_root).join(name);
        let python_path = if cfg!(windows) {
            venv_path.join("Scripts").join("python.exe")
        } else {
            venv_path.join("bin").join("python")
        };

        if python_path.exists() {
            if let Some(version) = get_python_version(&python_path.to_string_lossy()) {
                found.push(PythonEnvironment {
                    path: python_path.to_string_lossy().replace('\\', "/"),
                    version,
                    name: name.to_string(),
                    is_venv: true,
                });
            }
        }
    }
    found
}

// ── Commands ─────────────────────────────────────────────────

#[tauri::command]
pub async fn python_detect(project_root: Option<String>) -> Result<Vec<PythonEnvironment>, String> {
    let mut envs = Vec::new();

    // Check venvs first (most specific)
    if let Some(root) = &project_root {
        envs.extend(find_venv_python(root));
    }

    // Then system pythons
    envs.extend(detect_system_pythons());
    Ok(envs)
}

#[tauri::command]
pub async fn python_get_envs(project_root: Option<String>) -> Result<Vec<PythonEnvironment>, String> {
    python_detect(project_root).await
}

#[tauri::command]
pub async fn python_run(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    options: PythonRunOptions,
) -> Result<PythonRunResult, String> {
    let run_id = options.run_id.clone();
    let python_path = if options.python_path.is_empty() {
        "python".to_string()
    } else {
        options.python_path.clone()
    };

    // Determine script path
    let (script_path, is_temp) = if let Some(fp) = &options.file_path {
        (fp.clone(), false)
    } else if let Some(code) = &options.code {
        let tmp = std::env::temp_dir().join(format!("zeus_run_{}.py", &run_id));
        std::fs::write(&tmp, code.as_bytes()).map_err(|e| e.to_string())?;
        (tmp.to_string_lossy().to_string(), true)
    } else {
        return Err("Either file_path or code must be provided".to_string());
    };

    // Determine CWD
    let cwd = options.cwd.clone().unwrap_or_else(|| {
        if let Some(fp) = &options.file_path {
            Path::new(fp)
                .parent()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|| ".".to_string())
        } else {
            std::env::current_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| ".".to_string())
        }
    });

    // Build environment
    let mut env_vars: HashMap<String, String> = std::env::vars().collect();
    if let Some(extra_env) = options.env {
        env_vars.extend(extra_env);
    }

    // Spawn process
    let mut child = Command::new(&python_path)
        .arg(&script_path)
        .current_dir(&cwd)
        .envs(&env_vars)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start Python: {}", e))?;

    // Take stdout/stderr pipes before storing child
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // Store child in state so it can be killed by python_kill
    {
        let mut procs = state.python_processes.lock().unwrap();
        procs.insert(run_id.clone(), child);
    }

    // Stream stdout in background thread
    if let Some(mut stdout_pipe) = stdout {
        let rid = run_id.clone();
        let app_s = app.clone();
        thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match stdout_pipe.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = app_s.emit("python:runOutput", PythonRunChunk {
                            run_id: rid.clone(),
                            stream: "stdout".to_string(),
                            data,
                        });
                    }
                    Err(_) => break,
                }
            }
        });
    }

    // Stream stderr in background thread
    if let Some(mut stderr_pipe) = stderr {
        let rid = run_id.clone();
        let app_e = app.clone();
        thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match stderr_pipe.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = app_e.emit("python:runOutput", PythonRunChunk {
                            run_id: rid.clone(),
                            stream: "stderr".to_string(),
                            data,
                        });
                    }
                    Err(_) => break,
                }
            }
        });
    }

    // Wait for process to finish (blocking) — move child out of state first
    let child_opt = {
        let mut procs = state.python_processes.lock().unwrap();
        procs.remove(&run_id)
    };

    let exit_code = tokio::task::spawn_blocking(move || {
        if let Some(mut child) = child_opt {
            let code = child.wait()
                .map(|s| s.code().unwrap_or(0))
                .unwrap_or(0);
            if is_temp {
                let _ = std::fs::remove_file(&script_path);
            }
            code
        } else {
            // Process was killed before we waited
            if is_temp {
                let _ = std::fs::remove_file(&script_path);
            }
            -1
        }
    })
    .await
    .unwrap_or(-1);

    Ok(PythonRunResult { exit_code })
}

#[tauri::command]
pub async fn python_kill(
    state: tauri::State<'_, AppState>,
    run_id: String,
) -> Result<bool, String> {
    let mut procs = state.python_processes.lock().unwrap();
    if let Some(mut child) = procs.remove(&run_id) {
        let _ = child.kill();
        Ok(true)
    } else {
        Ok(false)
    }
}
