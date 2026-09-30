// ============================================================
// ZEUS — Diagnostics IPC Handler (Static Analysis / Error Lens)
// ============================================================
// Uses ruff (primary) or pyflakes (fallback) for static analysis.
// NEVER executes user code to produce diagnostics.
// ============================================================

import { ipcMain, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import { IPC } from '../../../shared/ipc-channels'
import type { Diagnostic, DiagnosticsResult, DiagnosticSeverity } from '../../../shared/types'
import { v4 as uuid } from 'uuid'

interface RuffDiagnostic {
  filename: string
  location: { row: number; column: number }
  end_location: { row: number; column: number }
  code: string
  message: string
  severity?: string
}

function ruffSeverity(code: string): DiagnosticSeverity {
  if (!code) return 'warning'
  const prefix = code.slice(0, 1).toUpperCase()
  // E = error, W = warning, F = error (pyflakes), C = convention, N = naming, etc.
  switch (prefix) {
    case 'E': return code.startsWith('E9') ? 'error' : 'warning'
    case 'F': {
      // F8xx = undefined names, F4xx = import errors → error
      const num = parseInt(code.slice(1)) || 0
      if (num >= 800 || num >= 400) return 'error'
      return 'warning'
    }
    case 'W': return 'warning'
    default: return 'info'
  }
}

async function runRuff(filePath: string, code: string): Promise<Diagnostic[]> {
  return new Promise((resolve) => {
    // Write to temp file so ruff can analyze
    const tmpPath = path.join(os.tmpdir(), `zeus_diag_${Date.now()}.py`)
    fs.writeFileSync(tmpPath, code, 'utf-8')

    const proc = spawn('python', [
      '-m', 'ruff',
      'check',
      '--output-format=json',
      '--no-cache',
      tmpPath
    ], { env: process.env })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

    proc.on('close', () => {
      fs.unlink(tmpPath, () => {})

      if (!stdout && stderr) {
        resolve([])
        return
      }

      try {
        const raw: RuffDiagnostic[] = JSON.parse(stdout || '[]')
        const diags: Diagnostic[] = raw.map((r) => ({
          id: uuid(),
          filePath,
          line: r.location?.row ?? 1,
          column: r.location?.column ?? 0,
          endLine: r.end_location?.row,
          endColumn: r.end_location?.column,
          severity: ruffSeverity(r.code),
          code: r.code,
          message: r.message,
          source: 'ruff'
        }))
        resolve(diags)
      } catch {
        resolve([])
      }
    })

    proc.on('error', () => {
      fs.unlink(tmpPath, () => {})
      resolve([]) // ruff not installed — fall through to pyflakes
    })
  })
}

async function runPyflakes(filePath: string, code: string): Promise<Diagnostic[]> {
  return new Promise((resolve) => {
    const tmpPath = path.join(os.tmpdir(), `zeus_diag_${Date.now()}.py`)
    fs.writeFileSync(tmpPath, code, 'utf-8')

    const proc = spawn('python', ['-m', 'pyflakes', tmpPath], {
      env: process.env
    })

    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

    proc.on('close', () => {
      fs.unlink(tmpPath, () => {})
      const output = stdout + stderr
      const diags: Diagnostic[] = []

      // pyflakes output: filename:line:col: message
      const regex = /^.+:(\d+):(\d+):\s+(.+)$/gm
      let match: RegExpExecArray | null
      while ((match = regex.exec(output)) !== null) {
        const msg = match[3]
        const sev: DiagnosticSeverity = msg.toLowerCase().includes('undefined') ||
          msg.toLowerCase().includes('syntax') ? 'error' : 'warning'

        diags.push({
          id: uuid(),
          filePath,
          line: parseInt(match[1]),
          column: parseInt(match[2]),
          severity: sev,
          code: 'PF',
          message: msg,
          source: 'pyflakes'
        })
      }
      resolve(diags)
    })

    proc.on('error', () => {
      fs.unlink(tmpPath, () => {})
      resolve([])
    })
  })
}

export function registerDiagnosticsHandlers(_win: BrowserWindow): void {
  ipcMain.handle(IPC.DIAG_ANALYZE, async (
    _e,
    filePath: string,
    code: string
  ): Promise<DiagnosticsResult> => {
    if (!code || !code.trim()) {
      return { filePath, diagnostics: [] }
    }

    // Try ruff first (fast), fall back to pyflakes
    let diagnostics = await runRuff(filePath, code)

    if (diagnostics.length === 0) {
      // Ruff may have found nothing OR isn't installed
      // Try pyflakes as fallback
      const pyflakesDiags = await runPyflakes(filePath, code)
      if (pyflakesDiags.length > 0) {
        diagnostics = pyflakesDiags
      }
    }

    return { filePath, diagnostics }
  })
}
