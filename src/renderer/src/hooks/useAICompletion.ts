// ============================================================
// ZEUS — useAICompletion Hook
// ============================================================
// Manages AI ghost text completions in Monaco.
// Calls ONLY aiProvider.generateCompletion() — nothing else.
// ============================================================

import { useRef, MutableRefObject, useCallback } from 'react'
import * as monaco from 'monaco-editor'
import { aiProvider } from '../ai/ai_provider'
import { useSettingsStore } from '../stores/settingsStore'

// Inject ghost text CSS once
let ghostCSSInjected = false
function injectGhostCSS() {
  if (ghostCSSInjected) return
  ghostCSSInjected = true
  const style = document.createElement('style')
  style.textContent = `
    .zeus-ghost-text {
      opacity: 0.4;
      font-style: italic;
      color: var(--text-muted, #585b70) !important;
      pointer-events: none;
    }
  `
  document.head.appendChild(style)
}

interface UseAICompletionReturn {
  triggerCompletion: (code: string, language: string) => void
  ghostDecoration: MutableRefObject<string | null>
  clearGhost: () => void
}

export function useAICompletion(
  editorRef: MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>
): UseAICompletionReturn {
  const { settings } = useSettingsStore()
  const ghostDecoration = useRef<string | null>(null)
  const ghostDecorationCollection = useRef<monaco.editor.IEditorDecorationsCollection | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isRequestingRef = useRef(false)

  injectGhostCSS()

  const clearGhost = useCallback(() => {
    ghostDecoration.current = null
    ghostDecorationCollection.current?.clear()
    ghostDecorationCollection.current = null
  }, [])

  const showGhost = useCallback((completionText: string) => {
    const editor = editorRef.current
    if (!editor || !completionText) return

    const pos = editor.getPosition()
    if (!pos) return

    clearGhost()

    // Store the completion text for Tab acceptance
    ghostDecoration.current = completionText

    // Show as inline "after" decoration
    const collection = editor.createDecorationsCollection([{
      range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
      options: {
        after: {
          content: completionText.split('\n')[0] || completionText, // first line preview
          inlineClassName: 'zeus-ghost-text'
        }
      }
    }])

    ghostDecorationCollection.current = collection
  }, [editorRef, clearGhost])

  const triggerCompletion = useCallback((code: string, language: string) => {
    if (!settings.ai.enabled || !settings.ai.completionEnabled) return

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      if (isRequestingRef.current) return

      const editor = editorRef.current
      if (!editor) return

      const pos = editor.getPosition()
      if (!pos) return

      // Get surrounding context (current function / some lines)
      const model = editor.getModel()
      if (!model) return

      const contextLevel = settings.ai.contextLevel
      let surroundingCode: string

      if (contextLevel === 'selection') {
        surroundingCode = editor.getSelection() ?
          model.getValueInRange(editor.getSelection()!) : code
      } else if (contextLevel === 'function') {
        // Get current block (simple heuristic: up to 30 lines above cursor)
        const startLine = Math.max(1, pos.lineNumber - 30)
        const endLine = pos.lineNumber
        surroundingCode = model.getValueInRange(
          new monaco.Range(startLine, 1, endLine, pos.column)
        )
      } else {
        surroundingCode = code
      }

      // Don't trigger on very short content
      if (surroundingCode.trim().length < 10) return

      isRequestingRef.current = true
      try {
        const result = await aiProvider.generateCompletion({
          code,
          language,
          surroundingCode,
          cursorLine: pos.lineNumber
        })

        if (result.completion && editor.getPosition()?.lineNumber === pos.lineNumber) {
          showGhost(result.completion)
        }
      } catch {
        // AI unavailable — silent failure, editor continues normally
      } finally {
        isRequestingRef.current = false
      }
    }, settings.ai.completionDelay)
  }, [editorRef, settings.ai, showGhost])

  return { triggerCompletion, ghostDecoration, clearGhost }
}
