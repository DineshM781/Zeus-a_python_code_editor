// ============================================================
// ZEUS — Terminal Panel (xterm.js + node-pty)
// ============================================================

import React, { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { useTerminalStore } from '../../stores/terminalStore'
import { useExplorerStore } from '../../stores/explorerStore'
import 'xterm/css/xterm.css'
import styles from './TerminalPanel.module.css'

interface TerminalInstance {
  id: string
  xterm: XTerm
  fitAddon: FitAddon
  containerRef: React.RefObject<HTMLDivElement>
}

const TerminalPanel: React.FC = () => {
  const { tabs, activeTerminalId, createTerminal, killTerminal, setActiveTerminal } = useTerminalStore()
  const { projectRoot } = useExplorerStore()
  const instancesRef = useRef<Map<string, TerminalInstance>>(new Map())
  const [initialized, setInitialized] = useState(false)

  // Create first terminal on mount if none exist
  useEffect(() => {
    if (!initialized && tabs.length === 0) {
      setInitialized(true)
      createTerminal(undefined, projectRoot || undefined)
    }
  }, [])

  // Listen for terminal data from main process
  useEffect(() => {
    const unsubscribe = window.zeus.terminal.onData(({ id, data }) => {
      const instance = instancesRef.current.get(id)
      if (instance) {
        instance.xterm.write(data)
      }
    })
    return () => {
      unsubscribe()
    }
  }, [])

  // Create xterm instance for new tabs
  const mountTerminal = (id: string, container: HTMLDivElement) => {
    if (instancesRef.current.has(id)) return

    const xterm = new XTerm({
      theme: {
        background: '#0d0d12',
        foreground: '#e2e4f0',
        cursor: '#cba6f7',
        cursorAccent: '#0d0d12',
        black: '#1e1e2e',
        red: '#f38ba8',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        blue: '#89b4fa',
        magenta: '#cba6f7',
        cyan: '#89dceb',
        white: '#cdd6f4',
        brightBlack: '#585b70',
        brightRed: '#f38ba8',
        brightGreen: '#a6e3a1',
        brightYellow: '#f9e2af',
        brightBlue: '#89b4fa',
        brightMagenta: '#f5c2e7',
        brightCyan: '#89dceb',
        brightWhite: '#e2e4f0'
      },
      fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 10000,
      allowTransparency: true
    })

    const fitAddon = new FitAddon()
    const webLinks = new WebLinksAddon()
    xterm.loadAddon(fitAddon)
    xterm.loadAddon(webLinks)
    xterm.open(container)

    // Fit after a brief delay
    setTimeout(() => {
      try {
        fitAddon.fit()
        window.zeus.terminal.resize(id, xterm.cols, xterm.rows)
      } catch { /* ignore */ }
    }, 100)

    // Send input to main process
    xterm.onData((data) => {
      window.zeus.terminal.write(id, data)
    })

    // Resize observer
    const observer = new ResizeObserver(() => {
      try {
        fitAddon.fit()
        window.zeus.terminal.resize(id, xterm.cols, xterm.rows)
      } catch { /* ignore */ }
    })
    observer.observe(container)

    instancesRef.current.set(id, {
      id,
      xterm,
      fitAddon,
      containerRef: { current: container }
    })

    return () => {
      observer.disconnect()
      xterm.dispose()
      instancesRef.current.delete(id)
    }
  }

  return (
    <div className={styles.panel}>
      {/* Tab bar */}
      <div className={styles.tabBar}>
        <div className={styles.tabs}>
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`${styles.tab} ${tab.id === activeTerminalId ? styles.active : ''}`}
              onClick={() => setActiveTerminal(tab.id)}
            >
              <span className={styles.tabIcon}>$</span>
              <span>{tab.title}</span>
              <button
                className={styles.closeTabBtn}
                onClick={(e) => {
                  e.stopPropagation()
                  killTerminal(tab.id)
                }}
              >×</button>
            </div>
          ))}
        </div>
        <div className={styles.tabActions}>
          <button
            className="icon-btn"
            onClick={() => createTerminal(undefined, projectRoot || undefined)}
            title="New Terminal"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Terminal instances */}
      <div className={styles.terminalContainer}>
        {tabs.map((tab) => (
          <TerminalContainer
            key={tab.id}
            id={tab.id}
            isActive={tab.id === activeTerminalId}
            onMount={mountTerminal}
          />
        ))}
        {tabs.length === 0 && (
          <div className={styles.empty}>
            <button
              className={styles.newTermBtn}
              onClick={() => createTerminal(undefined, projectRoot || undefined)}
            >
              + New Terminal
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

interface TerminalContainerProps {
  id: string
  isActive: boolean
  onMount: (id: string, el: HTMLDivElement) => (() => void) | void
}

const TerminalContainer: React.FC<TerminalContainerProps> = ({ id, isActive, onMount }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (containerRef.current) {
      const cleanup = onMount(id, containerRef.current)
      if (cleanup) cleanupRef.current = cleanup
    }
    return () => {
      cleanupRef.current?.()
    }
  }, [id])

  return (
    <div
      ref={containerRef}
      className={`${styles.xtermContainer} ${isActive ? styles.visible : styles.hidden}`}
    />
  )
}

export default TerminalPanel
