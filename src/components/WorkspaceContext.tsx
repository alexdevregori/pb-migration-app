'use client'

import { createContext, useContext, useState } from 'react'
import type { WorkspaceInfo } from '@/lib/productboard/types'

interface WorkspaceContextValue {
  workspaceInfo: WorkspaceInfo | null
  setWorkspaceInfo: (info: WorkspaceInfo | null) => void
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspaceInfo: null,
  setWorkspaceInfo: () => {},
})

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaceInfo, setWorkspaceInfo] = useState<WorkspaceInfo | null>(null)
  return (
    <WorkspaceContext.Provider value={{ workspaceInfo, setWorkspaceInfo }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  return useContext(WorkspaceContext)
}
