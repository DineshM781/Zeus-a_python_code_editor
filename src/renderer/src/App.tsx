// ============================================================
// ZEUS — Root App Component
// ============================================================

import React, { useEffect, useState } from 'react'
import { useSettingsStore } from './stores/settingsStore'
import { useTerminalStore } from './stores/terminalStore'
import { useExplorerStore } from './stores/explorerStore'
import AppLayout from './components/Layout/AppLayout'
import WelcomeScreen from './components/Welcome/WelcomeScreen'
import SettingsPanel from './components/Settings/SettingsPanel'
import Toast from './components/UI/Toast'
import styles from './App.module.css'

export interface ToastMessage {
  id: string
  message: string
  type: 'info' | 'success' | 'error' | 'warning'
}

const App: React.FC = () => {
  const { load: loadSettings, settings, isOpen: isSettingsOpen } = useSettingsStore()
  const { initShells } = useTerminalStore()
  const { projectRoot } = useExplorerStore()
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  // Initialize app
  useEffect(() => {
    loadSettings()
    initShells()
  }, [])

  const showToast = (message: string, type: ToastMessage['type'] = 'info') => {
    const id = `toast-${Date.now()}`
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }

  // Expose showToast globally for other components to use
  useEffect(() => {
    ;(window as any).__zeusToast = showToast
  }, [])

  return (
    <div className={styles.app} data-theme={settings.editor.theme}>
      {!projectRoot ? (
        <WelcomeScreen />
      ) : (
        <AppLayout />
      )}

      {isSettingsOpen && <SettingsPanel />}

      {/* Toast notifications */}
      <div className={styles.toastContainer}>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
          />
        ))}
      </div>
    </div>
  )
}

// Global helper to show toasts from anywhere
export function showToast(message: string, type: ToastMessage['type'] = 'info') {
  ;(window as any).__zeusToast?.(message, type)
}

export default App
