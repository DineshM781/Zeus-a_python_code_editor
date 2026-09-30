// ============================================================
// ZEUS — Tauri 2 Backend Entry Point
// ============================================================

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            // File System
            commands::fs::fs_read_file,
            commands::fs::fs_write_file,
            commands::fs::fs_list_dir,
            commands::fs::fs_create_file,
            commands::fs::fs_create_dir,
            commands::fs::fs_delete,
            commands::fs::fs_rename,
            commands::fs::fs_move,
            commands::fs::fs_exists,
            commands::fs::fs_watch_start,
            commands::fs::fs_watch_stop,
            commands::fs::fs_get_home,
            commands::fs::fs_open_dialog,
            commands::fs::fs_save_dialog,
            // Python
            commands::python::python_detect,
            commands::python::python_get_envs,
            commands::python::python_run,
            commands::python::python_kill,
            // Diagnostics
            commands::diagnostics::diag_analyze,
            // Terminal
            commands::terminal::term_list_shells,
            commands::terminal::term_create,
            commands::terminal::term_write,
            commands::terminal::term_resize,
            commands::terminal::term_kill,
            // Git
            commands::git::git_status,
            commands::git::git_init,
            commands::git::git_stage,
            commands::git::git_unstage,
            commands::git::git_commit,
            commands::git::git_push,
            commands::git::git_pull,
            commands::git::git_fetch,
            commands::git::git_branches,
            commands::git::git_checkout,
            commands::git::git_diff,
            commands::git::git_log,
            commands::git::git_clone,
            // Kernel (Jupyter)
            commands::notebook::kernel_start,
            commands::notebook::kernel_stop,
            commands::notebook::kernel_execute,
            commands::notebook::kernel_interrupt,
            commands::notebook::kernel_restart,
            commands::notebook::kernel_list,
            // Debugger
            commands::debugger::debug_start,
            commands::debugger::debug_stop,
            commands::debugger::debug_continue,
            commands::debugger::debug_pause,
            commands::debugger::debug_step_over,
            commands::debugger::debug_step_in,
            commands::debugger::debug_step_out,
            commands::debugger::debug_set_breakpoints,
            // Settings
            commands::settings::settings_get,
            commands::settings::settings_set,
            commands::settings::settings_reset,
            // App
            commands::app::app_get_version,
            commands::app::app_open_external,
            commands::app::app_open_path,
        ])
        .setup(|_app| {
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running ZEUS application");
}
