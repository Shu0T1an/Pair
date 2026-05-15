import { useState, useCallback, useEffect, useRef } from 'react'
import type { ProjectSessions, SessionInfo, Message } from '@/shared/types'
import { ipcClient } from '@/renderer/ipc-client'

// localStorage keys
const LAST_SESSION_KEY = 'pair-last-session'

function loadLastSession(): string | null {
  try {
    return localStorage.getItem(LAST_SESSION_KEY)
  } catch {
    return null
  }
}

function saveLastSession(sessionId: string) {
  try {
    localStorage.setItem(LAST_SESSION_KEY, sessionId)
  } catch {
    // ignore
  }
}

export function useSessions() {
  const [projects, setProjects] = useState<ProjectSessions[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  
  // 消息缓存
  const messagesCacheRef = useRef<Map<string, Message[]>>(new Map())

  // 加载会话列表
  const loadSessions = useCallback(async () => {
    try {
      const sessions = await ipcClient.listSessions()
      setProjects(sessions)
      return sessions
    } catch (error) {
      console.error('加载会话列表失败:', error)
      return []
    }
  }, [])

  // 切换会话
  const selectSession = useCallback(async (sessionId: string) => {
    setActiveSessionId(sessionId)
    saveLastSession(sessionId)
  }, [])

  // 创建会话
  const createSession = useCallback(async (projectPath?: string, modelId?: string): Promise<SessionInfo | null> => {
    try {
      const session = await ipcClient.createSession({ projectPath: projectPath || '', modelId })
      await loadSessions()
      return session
    } catch (error) {
      console.error('创建会话失败:', error)
      return null
    }
  }, [loadSessions])

  // 删除会话
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await ipcClient.deleteSession(sessionId)
      messagesCacheRef.current.delete(sessionId)
      
      if (activeSessionId === sessionId) {
        setActiveSessionId(null)
      }
      
      await loadSessions()
    } catch (error) {
      console.error('删除会话失败:', error)
    }
  }, [activeSessionId, loadSessions])

  // 删除所有会话
  const deleteAllSessions = useCallback(async () => {
    try {
      await ipcClient.deleteAllSessions()
      messagesCacheRef.current.clear()
      setActiveSessionId(null)
      await loadSessions()
    } catch (error) {
      console.error('删除所有会话失败:', error)
    }
  }, [loadSessions])

  // 删除指定项目下的所有会话
  const deleteAllSessionsInProject = useCallback(async (projectPath: string) => {
    try {
      await ipcClient.deleteAllSessionsInProject(projectPath)
      // 如果当前活动会话属于该项目，清除活动会话
      const currentSession = projects.flatMap(p => p.sessions).find(s => s.id === activeSessionId)
      if (currentSession && currentSession.projectPath === projectPath) {
        setActiveSessionId(null)
      }
      messagesCacheRef.current.clear()
      await loadSessions()
    } catch (error) {
      console.error('删除项目会话失败:', error)
    }
  }, [activeSessionId, projects, loadSessions])

  // 重命名会话
  const renameSession = useCallback(async (sessionId: string, newName: string) => {
    try {
      await ipcClient.updateSession(sessionId, { name: newName })
      await loadSessions()
    } catch (error) {
      console.error('重命名会话失败:', error)
    }
  }, [loadSessions])

  // 初始化：加载会话列表
  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  // 恢复上次会话
  useEffect(() => {
    if (projects.length > 0 && !activeSessionId) {
      const lastSessionId = loadLastSession()
      if (lastSessionId) {
        const sessionExists = projects.some(p => p.sessions.some(s => s.id === lastSessionId))
        if (sessionExists) {
          selectSession(lastSessionId)
        }
      }
    }
  }, [projects, activeSessionId, selectSession])

  return {
    projects,
    activeSessionId,
    loadSessions,
    selectSession,
    createSession,
    deleteSession,
    deleteAllSessions,
    deleteAllSessionsInProject,
    renameSession,
    getMessagesCache: () => messagesCacheRef.current,
  }
}
