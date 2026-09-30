// ============================================================
// ZEUS — Toast Notification
// ============================================================

import React from 'react'
import styles from './Toast.module.css'

interface Props {
  message: string
  type: 'info' | 'success' | 'error' | 'warning'
  onClose: () => void
}

const ICONS = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' }

const Toast: React.FC<Props> = ({ message, type, onClose }) => (
  <div className={`${styles.toast} ${styles[type]}`} onClick={onClose}>
    <span className={styles.icon}>{ICONS[type]}</span>
    <span className={styles.message}>{message}</span>
    <button className={styles.close}>×</button>
  </div>
)

export default Toast
