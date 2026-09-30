// ============================================================
// ZEUS — Side Panel Router
// ============================================================

import React from 'react'
import type { SidePanelView } from '../Layout/AppLayout'
import ExplorerPanel from '../Explorer/ExplorerPanel'
import SearchPanel from '../Search/SearchPanel'
import GitPanel from '../Git/GitPanel'
import DebugPanel from '../Debugger/DebugPanel'

interface Props {
  view: SidePanelView
}

const SidePanel: React.FC<Props> = ({ view }) => {
  switch (view) {
    case 'explorer': return <ExplorerPanel />
    case 'search':   return <SearchPanel />
    case 'git':      return <GitPanel />
    case 'debug':    return <DebugPanel />
    default:         return null
  }
}

export default SidePanel
