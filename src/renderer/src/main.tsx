// ============================================================
// ZEUS — Renderer Entry Point (Tauri 2)
// ============================================================
// Install the Tauri bridge BEFORE React renders so that
// window.zeus is available when stores initialize.
// ============================================================

import { installZeusAPI } from './lib/tauri-bridge'
installZeusAPI()

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'
import './styles/themes.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
