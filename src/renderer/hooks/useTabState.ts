import { useState, useCallback, useEffect } from 'react'
import type { SessionInfo } from '@/shared/types'

const STORAGE_KEY = 'pair-open-tabs'
const MAX_TABS = 10

interface TabState {
  sessionIds: string[]
  activeTabId?: string
}

/**
 * 标签状态管理 Hook
 * - 管理打开的标签列表
 * - 持久化到 localStorage
 * - 最多 MAX_TABS 个标签
 */
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

  // 持久化到 localStorage
  useEffect(() => {
    try {
      const state: TabState = { sessionIds: openTabIds }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (e) {
      console.error('Failed to save tab state:', e)
    }
  }, [openTabIds])

  /**
   * 添加标签（如果已存在则不移动位置，新标签添加到最前面）
   */
  const addTab = useCallback((sessionId: string) => {
    setOpenTabIds(prev => {
      // 如果已存在，不移动位置
      if (prev.includes(sessionId)) {
        return prev
      }
      // 新标签添加到最前面
      const next = [sessionId, ...prev]
      // 限制数量
      return next.slice(0, MAX_TABS)
    })
  }, [])

  /**
   * 关闭标签（只从标签栏移除，不删除会话）
   * 返回应该切换到的下一个标签 ID
   */
  const closeTab = useCallback((sessionId: string, currentActiveId?: string): string | undefined => {
    let nextActiveId: string | undefined

    setOpenTabIds(prev => {
      const index = prev.findIndex(id => id === sessionId)
      if (index === -1) return prev

      // 如果关闭的是当前活跃标签，需要确定下一个标签
      if (sessionId === currentActiveId) {
        if (prev.length === 1) {
          // 只有一个标签，关闭后没有标签
          nextActiveId = undefined
        } else if (index === 0) {
          // 关闭的是第一个，切换到新的第一个
          nextActiveId = prev[1]
        } else {
          // 切换到左边的标签
          nextActiveId = prev[index - 1]
        }
      }

      return prev.filter(id => id !== sessionId)
    })

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

  return {
    openTabIds,
    addTab,
    closeTab,
    getTabSessions,
    hasTab,
  }
}
