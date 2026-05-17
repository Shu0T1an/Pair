import { useState, useCallback, useEffect, useRef } from 'react'
import type { SessionInfo } from '@/shared/types'

const STORAGE_KEY = 'pair-open-tabs'
const MAX_TABS = 10

interface TabState {
  sessionIds: string[]
  activeTabId?: string
}

export function useTabState() {
  const [openTabIds, setOpenTabIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const state: TabState = JSON.parse(stored)
        return state.sessionIds || []
      }
    } catch (e) {
      console.error('Failed to load tab state:', e)
    }
    return []
  })

  const openTabIdsRef = useRef(openTabIds)
  useEffect(() => {
    openTabIdsRef.current = openTabIds
  }, [openTabIds])

  useEffect(() => {
    try {
      const state: TabState = { sessionIds: openTabIds }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (e) {
      console.error('Failed to save tab state:', e)
    }
  }, [openTabIds])

  const addTab = useCallback((sessionId: string) => {
    setOpenTabIds(prev => {
      if (prev.includes(sessionId)) {
        return prev
      }
      const next = [sessionId, ...prev]
      return next.slice(0, MAX_TABS)
    })
  }, [])

  const closeTab = useCallback((sessionId: string, currentActiveId?: string): string | undefined => {
    const prev = openTabIdsRef.current
    const index = prev.findIndex(id => id === sessionId)
    if (index === -1) return undefined

    let nextActiveId: string | undefined
    if (sessionId === currentActiveId) {
      if (prev.length === 1) {
        nextActiveId = undefined
      } else if (index === 0) {
        nextActiveId = prev[1]
      } else {
        nextActiveId = prev[index - 1]
      }
    }

    setOpenTabIds(prevIds => prevIds.filter(id => id !== sessionId))
    return nextActiveId
  }, [])

  /**
   * 获取完整的会话信息列表（用于 TabBar 显示）
   */
  const getTabSessions = useCallback((allSessions: SessionInfo[]): SessionInfo[] => {
    const sessionMap = new Map(allSessions.map(s => [s.id, s]))
    return openTabIds
      .map(id => sessionMap.get(id))
      .filter((s): s is SessionInfo => s !== undefined)
  }, [openTabIds])

  /**
   * 检查标签是否存在
   */
  const hasTab = useCallback((sessionId: string) => {
    return openTabIds.includes(sessionId)
  }, [openTabIds])

  /**
   * 关闭全部标签
   */
  const closeAllTabs = useCallback(() => {
    setOpenTabIds([])
  }, [])

  return {
    openTabIds,
    addTab,
    closeTab,
    closeAllTabs,
    getTabSessions,
    hasTab,
  }
}
