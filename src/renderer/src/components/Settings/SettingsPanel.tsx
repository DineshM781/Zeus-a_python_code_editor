// ============================================================
// ZEUS — Settings Panel
// ============================================================

import React, { useState } from 'react'
import { useSettingsStore } from '../../stores/settingsStore'
import styles from './SettingsPanel.module.css'

type SettingsSection = 'editor' | 'python' | 'terminal' | 'ai' | 'diagnostics' | 'notebook' | 'git'

const SettingsPanel: React.FC = () => {
  const { settings, update, closeSettings } = useSettingsStore()
  const [activeSection, setActiveSection] = useState<SettingsSection>('editor')

  const sections: Array<{ id: SettingsSection; label: string; icon: string }> = [
    { id: 'editor',      label: 'Editor',      icon: '✏️' },
    { id: 'python',      label: 'Python',       icon: '🐍' },
    { id: 'terminal',    label: 'Terminal',     icon: '⌨️' },
    { id: 'ai',          label: 'AI',           icon: '⚡' },
    { id: 'diagnostics', label: 'Diagnostics',  icon: '🔍' },
    { id: 'notebook',    label: 'Notebook',     icon: '📓' },
    { id: 'git',         label: 'Git',          icon: '🔀' }
  ]

  return (
    <div className={styles.overlay} onClick={closeSettings}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>⚙️ Settings</h2>
          <button className={styles.closeBtn} onClick={closeSettings}>×</button>
        </div>

        <div className={styles.body}>
          {/* Sidebar */}
          <div className={styles.sidebar}>
            {sections.map((s) => (
              <button
                key={s.id}
                className={`${styles.sideItem} ${activeSection === s.id ? styles.active : ''}`}
                onClick={() => setActiveSection(s.id)}
              >
                <span>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className={styles.content}>
            {activeSection === 'editor' && (
              <SettingsSection title="Editor">
                <SettingRow label="Font Size" description="Editor font size in pixels">
                  <input type="number" min="10" max="32" value={settings.editor.fontSize}
                    onChange={(e) => update('editor', { fontSize: Number(e.target.value) })} />
                </SettingRow>
                <SettingRow label="Font Family">
                  <input type="text" value={settings.editor.fontFamily}
                    onChange={(e) => update('editor', { fontFamily: e.target.value })} />
                </SettingRow>
                <SettingRow label="Tab Size">
                  <select value={settings.editor.tabSize}
                    onChange={(e) => update('editor', { tabSize: Number(e.target.value) })}>
                    {[2, 3, 4, 8].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </SettingRow>
                <SettingRow label="Theme">
                  <select value={settings.editor.theme}
                    onChange={(e) => update('editor', { theme: e.target.value as any })}>
                    <option value="zeus-dark">Zeus Dark</option>
                    <option value="zeus-light">Zeus Light</option>
                  </select>
                </SettingRow>
                <SettingRow label="Word Wrap">
                  <select value={settings.editor.wordWrap}
                    onChange={(e) => update('editor', { wordWrap: e.target.value as any })}>
                    <option value="off">Off</option>
                    <option value="on">On</option>
                    <option value="wordWrapColumn">Column</option>
                  </select>
                </SettingRow>
                <SettingRow label="Minimap">
                  <input type="checkbox" checked={settings.editor.minimap}
                    onChange={(e) => update('editor', { minimap: e.target.checked })} />
                </SettingRow>
                <SettingRow label="Auto Save">
                  <select value={settings.editor.autoSave}
                    onChange={(e) => update('editor', { autoSave: e.target.value as any })}>
                    <option value="off">Off</option>
                    <option value="afterDelay">After Delay</option>
                    <option value="onFocusChange">On Focus Change</option>
                  </select>
                </SettingRow>
              </SettingsSection>
            )}

            {activeSection === 'python' && (
              <SettingsSection title="Python">
                <SettingRow label="Interpreter Path" description="Path to Python executable">
                  <input type="text" value={settings.python.interpreterPath}
                    onChange={(e) => update('python', { interpreterPath: e.target.value })} />
                </SettingRow>
                <SettingRow label="Linter">
                  <select value={settings.python.linter}
                    onChange={(e) => update('python', { linter: e.target.value as any })}>
                    <option value="ruff">Ruff (fast)</option>
                    <option value="pyflakes">Pyflakes</option>
                    <option value="none">None</option>
                  </select>
                </SettingRow>
                <SettingRow label="Formatter">
                  <select value={settings.python.formatter}
                    onChange={(e) => update('python', { formatter: e.target.value as any })}>
                    <option value="ruff">Ruff</option>
                    <option value="black">Black</option>
                    <option value="autopep8">autopep8</option>
                    <option value="none">None</option>
                  </select>
                </SettingRow>
                <SettingRow label="Format on Save">
                  <input type="checkbox" checked={settings.python.formatOnSave}
                    onChange={(e) => update('python', { formatOnSave: e.target.checked })} />
                </SettingRow>
                <SettingRow label="Analysis Delay (ms)">
                  <input type="number" min="100" max="5000" value={settings.python.analysisDelay}
                    onChange={(e) => update('python', { analysisDelay: Number(e.target.value) })} />
                </SettingRow>
              </SettingsSection>
            )}

            {activeSection === 'ai' && (
              <SettingsSection title="AI">
                <div className={styles.aiNote}>
                  Configure the AI provider by editing{' '}
                  <code>src/renderer/src/ai/ai_provider.ts</code>
                </div>
                <SettingRow label="Enable AI">
                  <input type="checkbox" checked={settings.ai.enabled}
                    onChange={(e) => update('ai', { enabled: e.target.checked })} />
                </SettingRow>
                <SettingRow label="Code Completion">
                  <input type="checkbox" checked={settings.ai.completionEnabled}
                    onChange={(e) => update('ai', { completionEnabled: e.target.checked })} />
                </SettingRow>
                <SettingRow label="Completion Delay (ms)">
                  <input type="number" min="200" max="5000" value={settings.ai.completionDelay}
                    onChange={(e) => update('ai', { completionDelay: Number(e.target.value) })} />
                </SettingRow>
                <SettingRow label="Context Level">
                  <select value={settings.ai.contextLevel}
                    onChange={(e) => update('ai', { contextLevel: e.target.value as any })}>
                    <option value="selection">Selection</option>
                    <option value="function">Current Function</option>
                    <option value="file">Entire File</option>
                    <option value="openFiles">Open Files</option>
                  </select>
                </SettingRow>
              </SettingsSection>
            )}

            {activeSection === 'diagnostics' && (
              <SettingsSection title="Diagnostics (Error Lens)">
                <SettingRow label="Enable Error Lens">
                  <input type="checkbox" checked={settings.diagnostics.enabled}
                    onChange={(e) => update('diagnostics', { enabled: e.target.checked })} />
                </SettingRow>
                <SettingRow label="Show Warnings">
                  <input type="checkbox" checked={settings.diagnostics.showWarnings}
                    onChange={(e) => update('diagnostics', { showWarnings: e.target.checked })} />
                </SettingRow>
                <SettingRow label="Show Info">
                  <input type="checkbox" checked={settings.diagnostics.showInfo}
                    onChange={(e) => update('diagnostics', { showInfo: e.target.checked })} />
                </SettingRow>
                <SettingRow label="Analysis Delay (ms)">
                  <input type="number" min="100" max="5000" value={settings.diagnostics.analysisDelay}
                    onChange={(e) => update('diagnostics', { analysisDelay: Number(e.target.value) })} />
                </SettingRow>
              </SettingsSection>
            )}

            {activeSection === 'terminal' && (
              <SettingsSection title="Terminal">
                <SettingRow label="Font Size">
                  <input type="number" min="10" max="24" value={settings.terminal.fontSize}
                    onChange={(e) => update('terminal', { fontSize: Number(e.target.value) })} />
                </SettingRow>
                <SettingRow label="Scrollback Lines">
                  <input type="number" min="100" max="100000" value={settings.terminal.scrollback}
                    onChange={(e) => update('terminal', { scrollback: Number(e.target.value) })} />
                </SettingRow>
              </SettingsSection>
            )}

            {activeSection === 'notebook' && (
              <SettingsSection title="Notebook">
                <SettingRow label="Default Kernel">
                  <input type="text" value={settings.notebook.defaultKernel}
                    onChange={(e) => update('notebook', { defaultKernel: e.target.value })} />
                </SettingRow>
                <SettingRow label="Auto Save">
                  <input type="checkbox" checked={settings.notebook.autoSave}
                    onChange={(e) => update('notebook', { autoSave: e.target.checked })} />
                </SettingRow>
              </SettingsSection>
            )}

            {activeSection === 'git' && (
              <SettingsSection title="Git">
                <SettingRow label="Enable Git Integration">
                  <input type="checkbox" checked={settings.git.enabled}
                    onChange={(e) => update('git', { enabled: e.target.checked })} />
                </SettingRow>
              </SettingsSection>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const SettingsSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className={styles.settingsSection}>
    <h3 className={styles.sectionTitle}>{title}</h3>
    {children}
  </div>
)

const SettingRow: React.FC<{ label: string; description?: string; children: React.ReactNode }> = ({ label, description, children }) => (
  <div className={styles.settingRow}>
    <div className={styles.settingLabel}>
      <span>{label}</span>
      {description && <span className={styles.settingDesc}>{description}</span>}
    </div>
    <div className={styles.settingControl}>{children}</div>
  </div>
)

export default SettingsPanel
