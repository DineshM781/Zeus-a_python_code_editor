// ============================================================
// ZEUS — Diagnostics Commands (Error Lens / Static Analysis)
// ============================================================
// Replaces: src/main/ipc/handlers/diagnostics.handler.ts
// Uses ruff (primary) or pyflakes (fallback).
// NEVER executes user code — only static analysis tools.
// ============================================================

use std::path::PathBuf;
use std::process::Command;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── Types ────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostic {
    pub id: String,
    pub file_path: String,
    pub line: u32,
    pub column: u32,
    pub end_line: Option<u32>,
    pub end_column: Option<u32>,
    pub severity: String, // "error" | "warning" | "info" | "hint"
    pub code: String,
    pub message: String,
    pub source: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsResult {
    pub file_path: String,
    pub diagnostics: Vec<Diagnostic>,
    pub error: Option<String>,
}

#[derive(Deserialize, Debug)]
struct RuffDiagnostic {
    filename: Option<String>,
    location: Option<RuffLocation>,
    end_location: Option<RuffLocation>,
    code: Option<String>,
    message: Option<String>,
}

#[derive(Deserialize, Debug)]
struct RuffLocation {
    row: u32,
    column: u32,
}

// ── Helpers ──────────────────────────────────────────────────

fn ruff_severity(code: &str) -> &'static str {
    if code.is_empty() {
        return "warning";
    }
    let prefix = &code[..1].to_uppercase();
    match prefix.as_str() {
        "E" => {
            if code.starts_with("E9") {
                "error"
            } else {
                "warning"
            }
        }
        "F" => {
            let num: u32 = code[1..].parse().unwrap_or(0);
            if num >= 800 || (num >= 400 && num < 500) {
                "error"
            } else {
                "warning"
            }
        }
        "W" => "warning",
        _ => "info",
    }
}

fn run_ruff(file_path: &str, code: &str) -> Vec<Diagnostic> {
    // Write code to temp file
    let tmp = std::env::temp_dir().join(format!(
        "zeus_diag_{}.py",
        Uuid::new_v4().as_simple()
    ));

    if std::fs::write(&tmp, code.as_bytes()).is_err() {
        return vec![];
    }

    let result = Command::new("python")
        .args([
            "-m", "ruff",
            "check",
            "--output-format=json",
            "--no-cache",
            &tmp.to_string_lossy(),
        ])
        .output();

    let _ = std::fs::remove_file(&tmp);

    let output = match result {
        Ok(o) => o,
        Err(_) => return vec![],
    };

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    if stdout.is_empty() {
        return vec![];
    }

    let raw: Vec<RuffDiagnostic> = serde_json::from_str(&stdout).unwrap_or_default();

    raw.into_iter()
        .map(|r| {
            let code = r.code.unwrap_or_default();
            let severity = ruff_severity(&code).to_string();
            Diagnostic {
                id: Uuid::new_v4().to_string(),
                file_path: file_path.to_string(),
                line: r.location.as_ref().map(|l| l.row).unwrap_or(1),
                column: r.location.as_ref().map(|l| l.column).unwrap_or(0),
                end_line: r.end_location.as_ref().map(|l| l.row),
                end_column: r.end_location.as_ref().map(|l| l.column),
                severity,
                code,
                message: r.message.unwrap_or_default(),
                source: "ruff".to_string(),
            }
        })
        .collect()
}

fn run_pyflakes(file_path: &str, code: &str) -> Vec<Diagnostic> {
    let tmp = std::env::temp_dir().join(format!(
        "zeus_diag_{}.py",
        Uuid::new_v4().as_simple()
    ));

    if std::fs::write(&tmp, code.as_bytes()).is_err() {
        return vec![];
    }

    let result = Command::new("python")
        .args(["-m", "pyflakes", &tmp.to_string_lossy()])
        .output();

    let _ = std::fs::remove_file(&tmp);

    let output = match result {
        Ok(o) => o,
        Err(_) => return vec![],
    };

    let combined = format!(
        "{} {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );

    // pyflakes output: file:line:col: message
    let re = regex::Regex::new(r"(?m)^.+:(\d+):(\d+):\s+(.+)$").unwrap();
    re.captures_iter(&combined)
        .map(|cap| {
            let msg = cap[3].trim().to_string();
            let sev = if msg.to_lowercase().contains("undefined")
                || msg.to_lowercase().contains("syntax")
            {
                "error"
            } else {
                "warning"
            };
            Diagnostic {
                id: Uuid::new_v4().to_string(),
                file_path: file_path.to_string(),
                line: cap[1].parse().unwrap_or(1),
                column: cap[2].parse().unwrap_or(0),
                end_line: None,
                end_column: None,
                severity: sev.to_string(),
                code: "PF".to_string(),
                message: msg,
                source: "pyflakes".to_string(),
            }
        })
        .collect()
}

// ── Commands ─────────────────────────────────────────────────

#[tauri::command]
pub async fn diag_analyze(file_path: String, code: String) -> Result<DiagnosticsResult, String> {
    if code.trim().is_empty() {
        return Ok(DiagnosticsResult {
            file_path,
            diagnostics: vec![],
            error: None,
        });
    }

    // Try ruff first (fast, preferred)
    let diagnostics = tokio::task::spawn_blocking({
        let fp = file_path.clone();
        let c = code.clone();
        move || {
            let ruff_results = run_ruff(&fp, &c);
            if !ruff_results.is_empty() {
                return ruff_results;
            }
            // Fallback to pyflakes
            run_pyflakes(&fp, &c)
        }
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(DiagnosticsResult {
        file_path,
        diagnostics,
        error: None,
    })
}
