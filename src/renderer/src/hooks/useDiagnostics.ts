// ============================================================
// ZEUS — useDiagnostics Hook (Error Lens)
// ============================================================
// Runs static analysis on Python files via ruff/pyflakes.
// Does NOT execute user code.
// Displays diagnostics as inline Monaco decorations.
// ============================================================

import { useEffect, useRef, MutableRefObject } from 'react'
import * as monaco from 'monaco-editor'
import { useEditorStore } from '../stores/editorStore'
import { useSettingsStore } from '../stores/settingsStore'
import type { Diagnostic } from '../../../shared/types'

const PYTHON_EXTENSIONS = ['.py', '.pyw']
const isPython = (filePath: string) =>
  PYTHON_EXTENSIONS.some((ext) => filePath.endsWith(ext))

function severityToMonaco(severity: Diagnostic['severity']): monaco.MarkerSeverity {
  switch (severity) {
    case 'error':   return monaco.MarkerSeverity.Error
    case 'warning': return monaco.MarkerSeverity.Warning
    case 'info':    return monaco.MarkerSeverity.Info
    case 'hint':    return monaco.MarkerSeverity.Hint
    default:        return monaco.MarkerSeverity.Warning
  }
}

function severityToDecoration(severity: Diagnostic['severity']): {
  className: string
  glyphMarginClassName: string
  after?: monaco.editor.IModelDecorationOptions['after']
} {
  const colors: Record<string, { cls: string; glyph: string; color: string }> = {
    error:   { cls: 'zeus-diag-error',   glyph: 'zeus-glyph-error',   color: 'var(--color-error)' },
    warning: { cls: 'zeus-diag-warning', glyph: 'zeus-glyph-warning', color: 'var(--color-warning)' },
    info:    { cls: 'zeus-diag-info',    glyph: 'zeus-glyph-info',    color: 'var(--color-info)' },
    hint:    { cls: 'zeus-diag-hint',    glyph: 'zeus-glyph-hint',    color: 'var(--color-hint)' }
  }
  const c = colors[severity] || colors.warning
  return { className: c.cls, glyphMarginClassName: c.glyph }
}

// Inject Error Lens CSS once
let cssInjected = false
function injectErrorLensCSS() {
  if (cssInjected) return
  cssInjected = true

  const style = document.createElement('style')
  style.textContent = `
    /* Error Lens — wavy underlines */
    .zeus-diag-error   { border-bottom: 2px wavy var(--color-error, #f38ba8); }
    .zeus-diag-warning { border-bottom: 2px wavy var(--color-warning, #fab387); }
    .zeus-diag-info    { border-bottom: 2px wavy var(--color-info, #89dceb); }
    .zeus-diag-hint    { border-bottom: 1px dotted var(--color-hint, #a6e3a1); }

    /* Error Lens — glyph margin icons */
    .zeus-glyph-error::before {
      content: '●';
      color: var(--color-error, #f38ba8);
      font-size: 10px;
    }
    .zeus-glyph-warning::before {
      content: '▲';
      color: var(--color-warning, #fab387);
      font-size: 9px;
    }
    .zeus-glyph-info::before {
      content: 'ℹ';
      color: var(--color-info, #89dceb);
      font-size: 10px;
    }
    .zeus-glyph-hint::before {
      content: '◆';
      color: var(--color-hint, #a6e3a1);
      font-size: 8px;
    }
  `
  document.head.appendChild(style)
}

export function useDiagnostics(
  editorRef: MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>,
  filePath: string,
  tabId: string,
  language: string
): void {
  const { setDiagnostics } = useEditorStore()
  const { settings } = useSettingsStore()
  const decorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastContentRef = useRef<string>('')

  useEffect(() => {
    injectErrorLensCSS()
  }, [])

  useEffect(() => {
    if (!settings.diagnostics.enabled) return
    if (language !== 'python') return
    if (!isPython(filePath)) return

    const editor = editorRef.current
    if (!editor) return

    // Initialize decoration collection
    decorationsRef.current = editor.createDecorationsCollection([])

    const runAnalysis = async () => {
      const editor = editorRef.current
      if (!editor) return

      const content = editor.getValue()
      if (content === lastContentRef.current) return
      lastContentRef.current = content

      try {
        const result = await window.zeus.diagnostics.analyze(filePath, content)
        const diags = result.diagnostics || []

        // Filter based on settings
        const filtered = diags.filter((d) => {
          if (d.severity === 'warning' && !settings.diagnostics.showWarnings) return false
          if (d.severity === 'info' && !settings.diagnostics.showInfo) return false
          if (d.severity === 'hint' && !settings.diagnostics.showHints) return false
          return true
        })

        // Update store
        setDiagnostics(filePath, filtered)

        // Update Monaco markers
        const model = editor.getModel()
        if (model) {
          const markers: monaco.editor.IMarkerData[] = filtered.map((d) => ({
            startLineNumber: d.line,
            startColumn: d.column,
            endLineNumber: d.endLine ?? d.line,
            endColumn: d.endColumn ?? (d.column + 1),
            severity: severityToMonaco(d.severity),
            message: `${d.code}: ${d.message}`,
            source: d.source
          }))
          monaco.editor.setModelMarkers(model, 'zeus-diagnostics', markers)
        }

        // Add Error Lens inline decorations
        const decorations: monaco.editor.IModelDeltaDecoration[] = filtered.map((d) => {
          const { className, glyphMarginClassName } = severityToDecoration(d.severity)
          return {
            range: new monaco.Range(d.line, d.column, d.endLine ?? d.line, d.endColumn ?? 999),
            options: {
              inlineClassName: className,
              glyphMarginClassName,
              isWholeLine: false,
              // Error Lens: show message at end of line
              after: {
                content: `  ${d.code}: ${d.message}`,
                inlineClassName: `zeus-lens-${d.severity}`
              },
              overviewRuler: {
                color: d.severity === 'error' ? '#f38ba8' : '#fab387',
                position: monaco.editor.OverviewRulerLane.Right
              }
            }
          }
        })

        decorationsRef.current?.set(decorations)
      } catch {
        // Analysis failed — don't crash editor
      }
    }

    // Listen to content changes and debounce
    const disposable = editor.onDidChangeModelContent(() => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(runAnalysis, settings.diagnostics.analysisDelay)
    })

    // Run initial analysis
    timerRef.current = setTimeout(runAnalysis, 500)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      disposable.dispose()
      decorationsRef.current?.clear()

      // Clear Monaco markers
      const model = editor.getModel()
      if (model) {
        monaco.editor.setModelMarkers(model, 'zeus-diagnostics', [])
      }
    }
  }, [editorRef, filePath, language, settings.diagnostics])
}
