// ============================================================
// ZEUS — Debugger Commands (DAP via debugpy)
// ============================================================
// Replaces: src/main/ipc/handlers/debug.handler.ts
// Manages a single debug session via DAP over TCP.
// Debug starts ONLY when user requests debugging.
// ============================================================

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::state::{AppState, DebugSession};

// ── Types ────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Breakpoint {
    pub id: String,
    pub file_path: String,
    pub line: u32,
    pub enabled: bool,
    pub condition: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum DebugEvent {
    Stopped {
        reason: String,
        #[serde(rename = "filePath")]
        file_path: String,
        line: u32,
    },
    Continued,
    Exited {
        #[serde(rename = "exitCode")]
        exit_code: i32,
    },
    Output {
        category: String,
        output: String,
    },
}

// ── DAP Client ───────────────────────────────────────────────

struct DapClient {
    stream: TcpStream,
    seq: u32,
}

impl DapClient {
    fn new(stream: TcpStream) -> Self {
        Self { stream, seq: 0 }
    }

    fn send_request(&mut self, command: &str, args: serde_json::Value) -> Result<(), String> {
        self.seq += 1;
        let msg = serde_json::json!({
            "seq": self.seq,
            "type": "request",
            "command": command,
            "arguments": args
        });
        let body = msg.to_string();
        let header = format!("Content-Length: {}\r\n\r\n", body.len());
        self.stream
            .write_all((header + &body).as_bytes())
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

// ── Global DAP Stream ─────────────────────────────────────────

static DAP_CLIENT: Lazy<Mutex<Option<DapClient>>> = Lazy::new(|| Mutex::new(None));

fn find_free_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .map(|l| l.local_addr().unwrap().port())
        .unwrap_or(5678)
}

fn parse_dap_messages(buffer: &mut String) -> Vec<serde_json::Value> {
    let mut messages = Vec::new();
    loop {
        let Some(header_end) = buffer.find("\r\n\r\n") else {
            break;
        };
        let header = &buffer[..header_end];
        let len: usize = header
            .lines()
            .find(|l| l.starts_with("Content-Length:"))
            .and_then(|l| l.split(':').nth(1))
            .and_then(|v| v.trim().parse().ok())
            .unwrap_or(0);

        let body_start = header_end + 4;
        if buffer.len() < body_start + len {
            break;
        }

        let body = &buffer[body_start..body_start + len];
        if let Ok(msg) = serde_json::from_str::<serde_json::Value>(body) {
            messages.push(msg);
        }
        *buffer = buffer[body_start + len..].to_string();
    }
    messages
}

// ── Commands ─────────────────────────────────────────────────

#[tauri::command]
pub async fn debug_start(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    file_path: String,
    python_path: String,
    breakpoints: Vec<Breakpoint>,
) -> Result<serde_json::Value, String> {
    // Stop any existing session
    {
        let mut session = state.debug_session.lock().unwrap();
        if let Some(mut s) = session.take() {
            let _ = s.child.kill();
        }
    }

    let port = find_free_port();
    let python = if python_path.is_empty() { "python".to_string() } else { python_path };
    let cwd = Path::new(&file_path)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| ".".to_string());

    let child = Command::new(&python)
        .args([
            "-m", "debugpy",
            "--listen", &format!("127.0.0.1:{}", port),
            "--wait-for-client",
            &file_path,
        ])
        .current_dir(&cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start debugpy: {}", e))?;

    let session_id = format!("debug_{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0));

    // Store session
    {
        let mut session = state.debug_session.lock().unwrap();
        *session = Some(DebugSession {
            child,
            port,
            seq: 0,
        });
    }

    // Connect to DAP server (retry for up to 6 seconds)
    let mut dap_stream: Option<TcpStream> = None;
    for _ in 0..20 {
        thread::sleep(Duration::from_millis(300));
        if let Ok(stream) = TcpStream::connect(format!("127.0.0.1:{}", port)) {
            stream.set_read_timeout(Some(Duration::from_millis(100))).ok();
            dap_stream = Some(stream);
            break;
        }
    }

    let Some(stream) = dap_stream else {
        return Err("Failed to connect to debugpy DAP server".to_string());
    };

    let mut client = DapClient::new(stream.try_clone().map_err(|e| e.to_string())?);

    // Initialize DAP
    client.send_request("initialize", serde_json::json!({
        "clientID": "zeus",
        "adapterID": "python",
        "pathFormat": "path",
        "linesStartAt1": true,
        "columnsStartAt1": true
    }))?;

    // Set breakpoints grouped by file
    let mut bps_by_file: std::collections::HashMap<String, Vec<&Breakpoint>> =
        std::collections::HashMap::new();
    for bp in &breakpoints {
        bps_by_file.entry(bp.file_path.clone()).or_default().push(bp);
    }

    for (file, bps) in &bps_by_file {
        client.send_request("setBreakpoints", serde_json::json!({
            "source": { "path": file },
            "breakpoints": bps.iter().map(|bp| {
                let mut obj = serde_json::json!({ "line": bp.line });
                if let Some(cond) = &bp.condition {
                    obj["condition"] = serde_json::Value::String(cond.clone());
                }
                obj
            }).collect::<Vec<_>>()
        }))?;
    }

    client.send_request("launch", serde_json::json!({
        "program": file_path,
        "stopOnEntry": false,
        "justMyCode": true
    }))?;

    client.send_request("configurationDone", serde_json::json!({}))?;

    // Store DAP client
    {
        let mut dap = DAP_CLIENT.lock().unwrap();
        *dap = Some(client);
    }

    // Spawn reader thread for DAP events
    let app_reader = app.clone();
    thread::spawn(move || {
        let mut reader_stream = stream;
        let mut buffer = String::new();
        let mut raw_buf = [0u8; 8192];

        loop {
            match reader_stream.read(&mut raw_buf) {
                Ok(0) => break,
                Ok(n) => {
                    buffer.push_str(&String::from_utf8_lossy(&raw_buf[..n]));
                    for msg in parse_dap_messages(&mut buffer) {
                        if msg["type"] == "event" {
                            let event_name = msg["event"].as_str().unwrap_or("");
                            let body = &msg["body"];
                            let event = match event_name {
                                "stopped" => Some(DebugEvent::Stopped {
                                    reason: body["reason"]
                                        .as_str()
                                        .unwrap_or("breakpoint")
                                        .to_string(),
                                    file_path: body["source"]["path"]
                                        .as_str()
                                        .unwrap_or("")
                                        .to_string(),
                                    line: body["line"].as_u64().unwrap_or(0) as u32,
                                }),
                                "continued" => Some(DebugEvent::Continued),
                                "exited" => Some(DebugEvent::Exited {
                                    exit_code: body["exitCode"].as_i64().unwrap_or(0) as i32,
                                }),
                                "output" => Some(DebugEvent::Output {
                                    category: body["category"]
                                        .as_str()
                                        .unwrap_or("console")
                                        .to_string(),
                                    output: body["output"].as_str().unwrap_or("").to_string(),
                                }),
                                _ => None,
                            };

                            if let Some(e) = event {
                                let _ = app_reader.emit("debug:event", e);
                            }
                        }
                    }
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut
                    || e.kind() == std::io::ErrorKind::WouldBlock =>
                {
                    // Read timeout — continue polling
                    continue;
                }
                Err(_) => break,
            }
        }
    });

    Ok(serde_json::json!({
        "success": true,
        "sessionId": session_id,
        "port": port
    }))
}

fn dap_send(command: &str, args: serde_json::Value) {
    if let Ok(mut guard) = DAP_CLIENT.lock() {
        if let Some(client) = guard.as_mut() {
            let _ = client.send_request(command, args);
        }
    }
}

#[tauri::command]
pub async fn debug_stop(state: tauri::State<'_, AppState>) -> Result<bool, String> {
    dap_send("disconnect", serde_json::json!({ "restart": false }));
    {
        let mut session = state.debug_session.lock().unwrap();
        if let Some(mut s) = session.take() {
            let _ = s.child.kill();
        }
    }
    {
        let mut dap = DAP_CLIENT.lock().unwrap();
        *dap = None;
    }
    Ok(true)
}

#[tauri::command]
pub async fn debug_continue() -> Result<bool, String> {
    dap_send("continue", serde_json::json!({ "threadId": 1 }));
    Ok(true)
}

#[tauri::command]
pub async fn debug_pause() -> Result<bool, String> {
    dap_send("pause", serde_json::json!({ "threadId": 1 }));
    Ok(true)
}

#[tauri::command]
pub async fn debug_step_over() -> Result<bool, String> {
    dap_send("next", serde_json::json!({ "threadId": 1 }));
    Ok(true)
}

#[tauri::command]
pub async fn debug_step_in() -> Result<bool, String> {
    dap_send("stepIn", serde_json::json!({ "threadId": 1 }));
    Ok(true)
}

#[tauri::command]
pub async fn debug_step_out() -> Result<bool, String> {
    dap_send("stepOut", serde_json::json!({ "threadId": 1 }));
    Ok(true)
}

#[tauri::command]
pub async fn debug_set_breakpoints(breakpoints: Vec<Breakpoint>) -> Result<bool, String> {
    let mut bps_by_file: std::collections::HashMap<String, Vec<&Breakpoint>> =
        std::collections::HashMap::new();
    for bp in &breakpoints {
        bps_by_file.entry(bp.file_path.clone()).or_default().push(bp);
    }

    if let Ok(mut guard) = DAP_CLIENT.lock() {
        if let Some(client) = guard.as_mut() {
            for (file, bps) in &bps_by_file {
                let _ = client.send_request("setBreakpoints", serde_json::json!({
                    "source": { "path": file },
                    "breakpoints": bps.iter().map(|bp| serde_json::json!({ "line": bp.line })).collect::<Vec<_>>()
                }));
            }
        }
    }

    Ok(true)
}
