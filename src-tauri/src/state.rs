// ============================================================
// ZEUS — Application State
// ============================================================
// Shared mutable state managed by Tauri's state system.
// Each domain has its own Mutex-protected map.
//
// Note: Terminal state is managed in commands/terminal.rs via a
// Lazy<Mutex<HashMap>> because portable_pty types are not Send+Sync
// in a way that works with Tauri's generic state system.
// ============================================================

use std::collections::HashMap;
use std::sync::Mutex;

// ── Kernel State ─────────────────────────────────────────────
pub struct KernelEntry {
    pub child: std::process::Child,
    pub connection_file: String,
    pub python_path: String,
    pub cwd: String,
    pub state: String, // "idle" | "busy" | "dead"
}

// ── Debug State ──────────────────────────────────────────────
pub struct DebugSession {
    pub child: std::process::Child,
    pub port: u16,
    pub seq: u32,
}

// ── App State ────────────────────────────────────────────────
#[derive(Default)]
pub struct AppState {
    /// File watcher stop channels: dir_path → stop_sender
    pub watchers: Mutex<HashMap<String, std::sync::mpsc::Sender<()>>>,
    /// Running Python processes: run_id → child
    pub python_processes: Mutex<HashMap<String, std::process::Child>>,
    /// Active Jupyter kernels: kernel_id → entry
    pub kernels: Mutex<HashMap<String, KernelEntry>>,
    /// Active debug session (at most one at a time)
    pub debug_session: Mutex<Option<DebugSession>>,
}

