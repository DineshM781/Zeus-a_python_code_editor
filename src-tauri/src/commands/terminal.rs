// ============================================================
// ZEUS — Terminal Commands (PTY-based)
// ============================================================
// Replaces: src/main/ipc/handlers/terminal.handler.ts
// Uses portable-pty for proper PTY/process handling on Windows
// ============================================================

use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::thread;

use once_cell::sync::Lazy;
use portable_pty::{CommandBuilder, PtySize, native_pty_system};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

// ── Types ────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ShellOption {
    pub name: String,
    pub path: String,
    pub args: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TerminalCreateOptions {
    pub id: String,
    pub shell: Option<String>,
    pub cwd: Option<String>,
    pub env: Option<HashMap<String, String>>,
    pub cols: Option<u16>,
    pub rows: Option<u16>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TerminalDataEvent {
    pub id: String,
    pub data: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TerminalCreateResult {
    pub success: bool,
    pub error: Option<String>,
}

// ── Terminal Registry ─────────────────────────────────────────
// Global map of terminal_id → (writer, pair) protected by Mutex

struct TerminalEntry {
    writer: Box<dyn portable_pty::MasterPty + Send>,
    // Keep the child alive so the PTY doesn't close
    _child: Box<dyn portable_pty::Child + Send + Sync>,
}

static TERMINALS: Lazy<Mutex<HashMap<String, TerminalEntry>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

// ── Shell Detection ───────────────────────────────────────────

#[tauri::command]
pub async fn term_list_shells() -> Result<Vec<ShellOption>, String> {
    let mut shells = Vec::new();

    #[cfg(windows)]
    {
        // PowerShell 7+
        let ps7 = r"C:\Program Files\PowerShell\7\pwsh.exe";
        if Path::new(ps7).exists() {
            shells.push(ShellOption {
                name: "PowerShell 7".to_string(),
                path: ps7.to_string(),
                args: None,
            });
        }

        // Windows PowerShell 5
        shells.push(ShellOption {
            name: "Windows PowerShell".to_string(),
            path: "powershell.exe".to_string(),
            args: None,
        });

        // CMD
        shells.push(ShellOption {
            name: "Command Prompt".to_string(),
            path: "cmd.exe".to_string(),
            args: None,
        });

        // Git Bash
        let git_bash = r"C:\Program Files\Git\bin\bash.exe";
        if Path::new(git_bash).exists() {
            shells.push(ShellOption {
                name: "Git Bash".to_string(),
                path: git_bash.to_string(),
                args: Some(vec!["--login".to_string(), "-i".to_string()]),
            });
        }

        // WSL (if available)
        if let Ok(output) = std::process::Command::new("where").arg("wsl").output() {
            if output.status.success() {
                shells.push(ShellOption {
                    name: "WSL".to_string(),
                    path: "wsl".to_string(),
                    args: None,
                });
            }
        }
    }

    #[cfg(not(windows))]
    {
        let unix_shells = [
            ("Zsh", "/bin/zsh"),
            ("Bash", "/bin/bash"),
            ("Fish", "/usr/bin/fish"),
            ("Sh", "/bin/sh"),
        ];
        for (name, path) in &unix_shells {
            if Path::new(path).exists() {
                shells.push(ShellOption {
                    name: name.to_string(),
                    path: path.to_string(),
                    args: None,
                });
            }
        }
    }

    Ok(shells)
}

fn get_default_shell() -> String {
    #[cfg(windows)]
    {
        std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
    }
    #[cfg(not(windows))]
    {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
    }
}

// ── Terminal Lifecycle ────────────────────────────────────────

#[tauri::command]
pub async fn term_create(
    app: AppHandle,
    options: TerminalCreateOptions,
) -> Result<TerminalCreateResult, String> {
    let id = options.id.clone();
    let shell = options.shell.unwrap_or_else(get_default_shell);
    let cols = options.cols.unwrap_or(80);
    let rows = options.rows.unwrap_or(24);
    let cwd = options.cwd.unwrap_or_else(|| {
        dirs::home_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| ".".to_string())
    });

    let pty_system = native_pty_system();

    let pair = match pty_system.openpty(PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    }) {
        Ok(p) => p,
        Err(e) => {
            return Ok(TerminalCreateResult {
                success: false,
                error: Some(format!("Failed to open PTY: {}", e)),
            });
        }
    };

    let mut cmd = CommandBuilder::new(&shell);
    cmd.cwd(&cwd);

    // Set TERM environment variable
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");

    // Apply user-supplied env vars
    if let Some(env) = options.env {
        for (k, v) in env {
            cmd.env(k, v);
        }
    }

    let child = match pair.slave.spawn_command(cmd) {
        Ok(c) => c,
        Err(e) => {
            return Ok(TerminalCreateResult {
                success: false,
                error: Some(format!("Failed to spawn shell: {}", e)),
            });
        }
    };

    // Get reader from master for streaming output
    let mut reader = match pair.master.try_clone_reader() {
        Ok(r) => r,
        Err(e) => {
            return Ok(TerminalCreateResult {
                success: false,
                error: Some(format!("Failed to clone PTY reader: {}", e)),
            });
        }
    };

    // Spawn reader thread that forwards PTY output to frontend
    let id_reader = id.clone();
    let app_reader = app.clone();
    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    // Lossy UTF-8 conversion to handle terminal control codes
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_reader.emit("term:data", TerminalDataEvent {
                        id: id_reader.clone(),
                        data,
                    });
                }
                Err(_) => break,
            }
        }

        // Process exited
        let _ = app_reader.emit("term:data", TerminalDataEvent {
            id: id_reader,
            data: "\r\n[Process exited]\r\n".to_string(),
        });
    });

    // Store in global registry
    {
        let mut terminals = TERMINALS.lock().unwrap();
        terminals.insert(id.clone(), TerminalEntry {
            writer: pair.master,
            _child: child,
        });
    }

    Ok(TerminalCreateResult {
        success: true,
        error: None,
    })
}

#[tauri::command]
pub async fn term_write(id: String, data: String) -> Result<bool, String> {
    let mut terminals = TERMINALS.lock().unwrap();
    if let Some(term) = terminals.get_mut(&id) {
        term.writer
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn term_resize(id: String, cols: u16, rows: u16) -> Result<bool, String> {
    let terminals = TERMINALS.lock().unwrap();
    if let Some(term) = terminals.get(&id) {
        let _ = term.writer.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        });
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn term_kill(id: String) -> Result<bool, String> {
    let mut terminals = TERMINALS.lock().unwrap();
    if terminals.remove(&id).is_some() {
        Ok(true)
    } else {
        Ok(false)
    }
    // Dropping the TerminalEntry closes the PTY and kills the child
}
