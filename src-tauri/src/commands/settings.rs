// ============================================================
// ZEUS — Settings Commands
// ============================================================
// Replaces: src/main/ipc/handlers/settings.handler.ts
// Uses tauri-plugin-store for JSON file persistence.
// ============================================================

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "zeus-settings.json";

// ── Commands ─────────────────────────────────────────────────

#[tauri::command]
pub async fn settings_get(
    app: AppHandle,
    key: Option<String>,
) -> Result<Value, String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;

    if let Some(k) = key {
        let val = store.get(&k).unwrap_or(Value::Null);
        Ok(val)
    } else {
        // Return all settings
        let entries: serde_json::Map<String, Value> = store
            .entries()
            .into_iter()
            .collect();
        Ok(Value::Object(entries))
    }
}

#[tauri::command]
pub async fn settings_set(
    app: AppHandle,
    key: String,
    value: Value,
) -> Result<bool, String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    store.set(key, value);
    store.save().map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub async fn settings_reset(
    app: AppHandle,
    key: Option<String>,
) -> Result<bool, String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;

    if let Some(k) = key {
        store.delete(&k);
    } else {
        store.clear();
    }

    store.save().map_err(|e| e.to_string())?;
    Ok(true)
}
