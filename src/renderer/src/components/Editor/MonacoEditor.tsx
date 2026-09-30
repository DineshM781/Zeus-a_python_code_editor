// ============================================================
// ZEUS — Monaco Editor (core code editing component)
// ============================================================

import React, { useRef, useEffect, useCallback } from 'react'
import * as monaco from 'monaco-editor'
import { useEditorStore } from '../../stores/editorStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useDebugStore } from '../../stores/debugStore'
import { useDiagnostics } from '../../hooks/useDiagnostics'
import { useAICompletion } from '../../hooks/useAICompletion'
import { configureMonacoTheme } from './monacoTheme'
import styles from './MonacoEditor.module.css'

import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

// Configure Monaco workers (must run before first editor creation)
if (typeof window !== 'undefined') {
  (window as any).MonacoEnvironment = {
    getWorker: (_moduleId: string, label: string) => {
      if (label === 'json') {
        return new jsonWorker()
      }
      if (label === 'typescript' || label === 'javascript') {
        return new tsWorker()
      }
      return new editorWorker()
    }
  }
}

interface Props {
  tabId: string
  filePath: string
  content: string
  language: string
  readOnly?: boolean
}

let themeConfigured = false

const MonacoEditor: React.FC<Props> = ({ tabId, filePath, content, language, readOnly }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const modelRef = useRef<monaco.editor.ITextModel | null>(null)
  const { updateContent, markSaved, setCursor, setDiagnostics } = useEditorStore()
  const { settings } = useSettingsStore()
  const { breakpoints, toggleBreakpoint } = useDebugStore()
  const { triggerCompletion, ghostDecoration, clearGhost } = useAICompletion(editorRef)
  useDiagnostics(editorRef, filePath, tabId, language)

  // Create editor on mount
  useEffect(() => {
    if (!containerRef.current) return

    // Configure theme once
    if (!themeConfigured) {
      configureMonacoTheme()
      themeConfigured = true
    }

    const editorSettings = settings.editor

    const editor = monaco.editor.create(containerRef.current, {
      value: content,
      language,
      theme: 'zeus-dark',
      fontSize: editorSettings.fontSize,
      fontFamily: editorSettings.fontFamily,
      fontLigatures: true,
      tabSize: editorSettings.tabSize,
      insertSpaces: editorSettings.insertSpaces,
      wordWrap: editorSettings.wordWrap,
      minimap: { enabled: editorSettings.minimap },
      lineNumbers: editorSettings.lineNumbers,
      renderWhitespace: editorSettings.renderWhitespace,
      scrollBeyondLastLine: false,
      automaticLayout: true,
      readOnly: readOnly ?? false,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      smoothScrolling: true,
      padding: { top: 12, bottom: 12 },
      glyphMargin: true,
      folding: true,
      bracketPairColorization: { enabled: true },
      guides: {
        bracketPairs: true,
        indentation: true
      },
      suggest: {
        showKeywords: true,
        showSnippets: true
      },
      quickSuggestions: true,
      parameterHints: { enabled: true },
      hover: { enabled: true },
      formatOnPaste: false,
      formatOnType: false,
      renderLineHighlight: 'gutter',
      occurrencesHighlight: 'multiFile',
      selectionHighlight: true,
      contextmenu: true
    })

    editorRef.current = editor
    modelRef.current = editor.getModel()

    // ── Content change → update store + debounce save ────────
    const disposables: monaco.IDisposable[] = []
    let saveTimer: ReturnType<typeof setTimeout>

    disposables.push(
      editor.onDidChangeModelContent(() => {
        const value = editor.getValue()
        updateContent(tabId, value)

        // Auto-save
        clearTimeout(saveTimer)
        if (settings.editor.autoSave === 'afterDelay') {
          saveTimer = setTimeout(async () => {
            await window.zeus.fs.writeFile(filePath, value)
            markSaved(tabId)
          }, settings.editor.autoSaveDelay)
        }

        // Trigger AI completion (debounced inside hook)
        if (settings.ai.completionEnabled) {
          triggerCompletion(value, language)
        }
      })
    )

    // ── Cursor position → status bar ─────────────────────────
    disposables.push(
      editor.onDidChangeCursorPosition((e) => {
        setCursor(tabId, e.position.lineNumber, e.position.column)
      })
    )

    // ── Breakpoint clicks (glyph margin) ─────────────────────
    disposables.push(
      editor.onMouseDown((e) => {
        if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
          const line = e.target.position?.lineNumber
          if (line) toggleBreakpoint(filePath, line)
        }
      })
    )

    // ── TAB to accept AI ghost text ───────────────────────────
    editor.addCommand(monaco.KeyCode.Tab, () => {
      if (ghostDecoration.current) {
        // Accept ghost text
        const ghost = ghostDecoration.current
        clearGhost()
        const pos = editor.getPosition()
        if (pos && ghost) {
          editor.executeEdits('ai-completion', [{
            range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
            text: ghost
          }])
        }
      } else {
        // Default tab behavior
        editor.trigger('keyboard', 'tab', null)
      }
    })

    // ── ESC to dismiss ghost text ─────────────────────────────
    editor.addCommand(monaco.KeyCode.Escape, () => {
      clearGhost()
    })

    // ── Format on save (Ctrl+S) ───────────────────────────────
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
      if (settings.python.formatOnSave && language === 'python') {
        await editor.getAction('editor.action.formatDocument')?.run()
      }
      const value = editor.getValue()
      await window.zeus.fs.writeFile(filePath, value)
      markSaved(tabId)
    })

    return () => {
      clearTimeout(saveTimer)
      disposables.forEach((d) => d.dispose())
      editor.dispose()
      editorRef.current = null
    }
  }, []) // Only run once per tab mount

  // Update editor when settings change
  useEffect(() => {
    if (!editorRef.current) return
    editorRef.current.updateOptions({
      fontSize: settings.editor.fontSize,
      fontFamily: settings.editor.fontFamily,
      tabSize: settings.editor.tabSize,
      wordWrap: settings.editor.wordWrap,
      minimap: { enabled: settings.editor.minimap },
      lineNumbers: settings.editor.lineNumbers
    })
  }, [settings.editor])

  // Sync breakpoints to glyph margin
  const fileBreakpoints = breakpoints.filter((bp) => bp.filePath === filePath)
  useEffect(() => {
    if (!editorRef.current) return
    const decorations = fileBreakpoints.map((bp): monaco.editor.IModelDeltaDecoration => ({
      range: new monaco.Range(bp.line, 1, bp.line, 1),
      options: {
        glyphMarginClassName: styles.breakpointGlyph,
        glyphMarginHoverMessage: { value: `Breakpoint at line ${bp.line}` },
        isWholeLine: false
      }
    }))
    editorRef.current.createDecorationsCollection(decorations)
  }, [fileBreakpoints, filePath])

  return (
    <div className={styles.editorWrapper}>
      <div ref={containerRef} className={styles.monacoContainer} />
    </div>
  )
}

export default MonacoEditor
