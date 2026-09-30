// ============================================================
// ZEUS — Monaco Theme Configuration
// ============================================================

import * as monaco from 'monaco-editor'

export function configureMonacoTheme(): void {
  // ZEUS Dark theme
  monaco.editor.defineTheme('zeus-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment',        foreground: '6c7086', fontStyle: 'italic' },
      { token: 'keyword',        foreground: 'cba6f7', fontStyle: 'bold' },
      { token: 'keyword.python', foreground: 'cba6f7', fontStyle: 'bold' },
      { token: 'string',         foreground: 'a6e3a1' },
      { token: 'string.escape',  foreground: 'a6e3a1', fontStyle: 'bold' },
      { token: 'number',         foreground: 'fab387' },
      { token: 'type',           foreground: 'f9e2af' },
      { token: 'class',          foreground: 'f9e2af', fontStyle: 'bold' },
      { token: 'function',       foreground: '89b4fa' },
      { token: 'identifier',     foreground: 'e2e4f0' },
      { token: 'operator',       foreground: '89dceb' },
      { token: 'delimiter',      foreground: '9399b2' },
      { token: 'variable',       foreground: 'cdd6f4' },
      { token: 'variable.python', foreground: 'ef9f76' },
      { token: 'constant',       foreground: 'fab387' },
      { token: 'decorator',      foreground: 'f38ba8' },
      { token: 'tag',            foreground: 'f38ba8' },
      { token: 'attribute.name', foreground: 'fab387' },
      { token: 'attribute.value', foreground: 'a6e3a1' }
    ],
    colors: {
      'editor.background':                '#0d0d12',
      'editor.foreground':                '#e2e4f0',
      'editor.lineHighlightBackground':   '#1e1e2e',
      'editor.lineHighlightBorder':       '#2a2a42',
      'editor.selectionBackground':       '#3a3a5c',
      'editor.inactiveSelectionBackground': '#2a2a42',
      'editor.selectionHighlightBackground': '#2e2e4a',
      'editorCursor.foreground':          '#cba6f7',
      'editorWhitespace.foreground':      '#313244',
      'editorIndentGuide.background':     '#1e1e2e',
      'editorIndentGuide.activeBackground': '#45475a',
      'editorLineNumber.foreground':      '#45475a',
      'editorLineNumber.activeForeground': '#cdd6f4',
      'editorBracketMatch.background':    '#313244',
      'editorBracketMatch.border':        '#7c6af5',
      'editorGutter.background':          '#0d0d12',
      'editorError.foreground':           '#f38ba8',
      'editorWarning.foreground':         '#fab387',
      'editorInfo.foreground':            '#89dceb',
      'editorHint.foreground':            '#a6e3a1',
      'editorOverviewRuler.errorForeground': '#f38ba8',
      'editorOverviewRuler.warningForeground': '#fab387',
      'scrollbar.shadow':                 '#00000050',
      'scrollbarSlider.background':       '#2a2a4250',
      'scrollbarSlider.hoverBackground':  '#3d3d6080',
      'scrollbarSlider.activeBackground': '#7c6af540',
      'stickyScroll.background':          '#12121a',
      'editorSuggestWidget.background':   '#1e1e2e',
      'editorSuggestWidget.border':       '#2a2a42',
      'editorSuggestWidget.foreground':   '#e2e4f0',
      'editorSuggestWidget.selectedBackground': '#3a3a5c',
      'editorSuggestWidget.highlightForeground': '#cba6f7',
      'editorHoverWidget.background':     '#1e1e2e',
      'editorHoverWidget.border':         '#2a2a42',
      'editorWidget.background':          '#1e1e2e',
      'editorWidget.border':              '#2a2a42',
      'input.background':                 '#181824',
      'input.foreground':                 '#e2e4f0',
      'input.border':                     '#2a2a42',
      'inputValidation.errorBorder':      '#f38ba8',
      'peekView.border':                  '#7c6af5',
      'peekViewEditor.background':        '#12121a',
      'peekViewResult.background':        '#181824',
      'peekViewTitle.background':         '#1e1e2e'
    }
  })

  // ZEUS Light theme
  monaco.editor.defineTheme('zeus-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment',  foreground: '9399b2', fontStyle: 'italic' },
      { token: 'keyword',  foreground: '7c3aed', fontStyle: 'bold' },
      { token: 'string',   foreground: '16a34a' },
      { token: 'number',   foreground: 'd97706' },
      { token: 'type',     foreground: '92400e' },
      { token: 'class',    foreground: '92400e', fontStyle: 'bold' },
      { token: 'function', foreground: '1d4ed8' },
      { token: 'decorator', foreground: 'dc2626' }
    ],
    colors: {
      'editor.background': '#fafafa',
      'editor.foreground': '#1e1e2e',
      'editor.lineHighlightBackground': '#f0f0f8',
      'editorLineNumber.foreground': '#9399b2',
      'editorLineNumber.activeForeground': '#1e1e2e',
      'editorCursor.foreground': '#7c3aed'
    }
  })
}
