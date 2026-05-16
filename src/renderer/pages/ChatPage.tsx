import { useState, useEffect } from 'react'
import { ChatArea } from '@/renderer/components/ChatArea'
import { SessionList } from '@/renderer/components/SessionList'
import { Header } from '@/renderer/components/Header'
import { TitleBar } from '@/renderer/components/TitleBar'
import { TabBar } from '@/renderer/components/TabBar'
import { SettingsModal } from '@/renderer/components/SettingsModal'
import { StatsModal } from '@/renderer/components/StatsModal'
import { SkillsModal } from '@/renderer/components/SkillsModal'
import { useSessions } from '@/renderer/hooks/useSessions'
import { useMessages } from '@/renderer/hooks/useMessages'
import { useModels } from '@/renderer/hooks/useModels'
import { useTabState } from '@/renderer/hooks/useTabState'
import { useTheme } from '@/renderer/contexts/ThemeContext'
import { useModelContext } from '@/renderer/contexts/ModelContext'

export function ChatPage() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isStatsOpen, setIsStatsOpen] = useState(false)
  const [isSkillsOpen, setIsSkillsOpen] = useState(false)
  const { isDark, toggleDark } = useTheme()
  const { addTab, closeTab, getTabSessions } = useTabState()
  
  // 使用 Hooks
  const { 
    projects, 
    activeSessionId, 
    selectSession, 
    createSession,
    deleteSession,
    deleteAllSessionsInProject,
    renameSession,
    getMessagesCache 
  } = useSessions()
  
  const { 
    models, 
    currentModel, 
    currentModelId,
    selectModel 
  } = useModels()
  
  const { modelConfigs } = useModelContext()

  const { 
    messages, 
    isStreaming, 
    sendMessage, 
    abortMessage 
  } = useMessages({ 
    sessionId: activeSessionId, 
    messagesCache: getMessagesCache(), 
    currentModelId: currentModelId,
    modelConfigs 
  })
  
  // 当前会话信息
  const currentSession = projects
    .flatMap(p => p.sessions)
    .find(s => s.id === activeSessionId) || null
  
  // 所有会话列表
  const allSessions = projects.flatMap(p => p.sessions)
  
  // 标签栏显示的会话列表
  const tabSessions = getTabSessions(allSessions)
  
  // 当切换会话时，自动添加到标签栏
  useEffect(() => {
    if (activeSessionId) {
      addTab(activeSessionId)
    }
  }, [activeSessionId, addTab])
  
  // 处理新建会话（从 SessionList 传入已选好的文件夹路径）
  const handleNewSession = async (projectPath?: string) => {
    const session = await createSession(projectPath)
    if (session) {
      selectSession(session.id)
    }
  }
  
  // 处理新建会话（指定项目）
  const handleNewSessionInProject = async (projectPath: string) => {
    const session = await createSession(projectPath)
    if (session) {
      selectSession(session.id)
    }
  }
  
  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* 标题栏 */}
      <TitleBar />
      
      <div className="flex-1 flex gap-4 p-4 min-h-0">
        {/* 侧边栏 */}
        <aside className="w-64 shrink-0">
          <SessionList
            projects={projects}
            activeSessionId={activeSessionId || undefined}
            onSelectSession={selectSession}
            onNewSession={handleNewSession}
            onNewSessionInProject={handleNewSessionInProject}
            onDeleteSession={deleteSession}
            onDeleteAllSessionsInProject={deleteAllSessionsInProject}
            onRenameSession={renameSession}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        </aside>

        {/* 主内容区域 */}
        <main className="flex-1 min-h-0 bg-card rounded-2xl flex flex-col shadow-sm relative overflow-hidden border border-border">
          <Header
            session={currentSession}
            isDark={isDark}
            onToggleTheme={toggleDark}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenStats={() => setIsStatsOpen(true)}
            onOpenSkills={() => setIsSkillsOpen(true)}
          />
          <TabBar
            tabs={tabSessions}
            activeSessionId={activeSessionId || undefined}
            onSelect={selectSession}
            onClose={(sessionId) => {
              const nextId = closeTab(sessionId, activeSessionId || undefined)
              // 如果关闭的是当前活跃标签，切换到下一个标签
              if (sessionId === activeSessionId && nextId) {
                selectSession(nextId)
              }
            }}
          />
          <ChatArea
            messages={messages}
            isStreaming={isStreaming}
            currentModel={currentModel}
            models={models}
            sessionId={activeSessionId || undefined}
            onSend={sendMessage}
            onAbort={abortMessage}
            onSelectModel={selectModel}
          />
        </main>
      </div>

      {/* 设置弹窗 */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
      
      {/* 统计面板 */}
      <StatsModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
      />
      
      {/* Skills 面板 */}
      <SkillsModal
        isOpen={isSkillsOpen}
        onClose={() => setIsSkillsOpen(false)}
      />
    </div>
  )
}
