import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'
import type { SessionStatus } from '@/shared/types'

interface SessionState {
  status: SessionStatus
  timestamp: number
}

interface SessionStateContextValue {
  getStatus: (sessionId: string) => SessionStatus
  updateStatus: (sessionId: string, status: SessionStatus) => void
}

const SessionStateContext = createContext<SessionStateContextValue | null>(null)

export function SessionStateProvider({ children }: { children: ReactNode }) {
  const [states] = useState<Map<string, SessionState>>(new Map())
  // 使用 ref 存储 Map，避免每次渲染新建对象
  const statesRef = useRef(states)
  // 用于触发 re-render 的版本号
  const [, setVersion] = useState(0)

  const getStatus = useCallback((sessionId: string): SessionStatus => {
    return statesRef.current.get(sessionId)?.status ?? 'idle'
  }, [])

  const updateStatus = useCallback((sessionId: string, status: SessionStatus) => {
    statesRef.current.set(sessionId, { status, timestamp: Date.now() })
    setVersion(v => v + 1)
  }, [])

  return (
    <SessionStateContext.Provider value={{ getStatus, updateStatus }}>
      {children}
    </SessionStateContext.Provider>
  )
}

export function useSessionState() {
  const context = useContext(SessionStateContext)
  if (!context) {
    throw new Error('useSessionState must be used within a SessionStateProvider')
  }
  return context
}
