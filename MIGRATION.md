# ZEUS — Tauri 2 Migration Guide

## Windows Build Prerequisites

ZEUS on Tauri 2 requires one of the following before `npm run dev`:

### Option A — MSVC Build Tools (Recommended)
```powershell
winget install --id=Microsoft.VisualStudio.2022.BuildTools `
  --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```
Then restart the terminal and run `npm run dev`.

### Option B — MSYS2/MinGW64 (GNU toolchain)
After MSYS2 installs, in an MSYS2 terminal run:
```bash
pacman -S --needed mingw-w64-x86_64-gcc
```
Add `C:\msys64\mingw64\bin` to Windows PATH, then run `npm run dev`.

---

## Dev Commands

| Command | Purpose |
|---------|---------|
| `npm install` | Install frontend dependencies |
| `npm run dev` | Start in development mode (hot reload) |
| `npm run build` | Build production Windows installer |
| `npm run typecheck` | Type-check frontend TypeScript |
| `npm run test` | Run frontend tests |

---

## Architecture: What Changed vs. Electron

| Electron | Tauri 2 |
|----------|---------|
| `electron` npm + Node.js main process | `src-tauri/` Rust backend |
| `electron-vite` config | `vite.config.ts` (plain Vite) |
| `electron-builder` | `@tauri-apps/cli tauri build` |
| `node-pty` | `portable-pty` Rust crate |
| `chokidar` | `notify` Rust crate |
| `simple-git` | Shell `git` commands from Rust |
| `electron-store` | `tauri-plugin-store` |
| `ipcMain.handle()` | `#[tauri::command]` in Rust |
| `ipcRenderer.invoke()` | `invoke()` from `@tauri-apps/api/core` |
| `contextBridge.exposeInMainWorld('zeus', ...)` | `tauri-bridge.ts` → `window.zeus = ...` |
| `BrowserWindow` + `webPreferences` | `tauri.conf.json` window config |

## What Is COMPLETELY Unchanged

- `src/renderer/src/ai/ai_provider.ts` — AI architecture unchanged
- All React components in `src/renderer/src/components/`
- All Zustand stores — still call `window.zeus.*` identically
- `src/renderer/src/hooks/`
- `src/shared/types.ts` — shared types unchanged
- Monaco Editor, xterm.js integrations
- All keyboard shortcuts and UI behavior
