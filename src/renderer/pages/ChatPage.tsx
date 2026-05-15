import { useState } from 'react'
import { ChatArea } from '@/renderer/components/ChatArea'
import { SessionList } from '@/renderer/components/SessionList'
import { Header } from '@/renderer/components/Header'
import { SettingsModal } from '@/renderer/components/SettingsModal'
import { useSessions } from '@/renderer/hooks/useSessions'
import { useMessages } from '@/renderer/hooks/useMessages'
import { useModels } from '@/renderer/hooks/useModels'

export function ChatPage() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isDark, setIsDark] = useState(true)
  
  // 使用 Hooks
  const { 
    projects, 
    activeSessionId, 
    selectSession, 
    createSession,
    deleteSession,
    renameSession,
    getMessagesCache 
  } = useSessions()
  
  const { 
    messages, 
    isStreaming, 
    sendMessage, 
    abortMessage 
  } = useMessages({ sessionId: activeSessionId, messagesCache: getMessagesCache() })
  
  const { 
    models, 
    currentModel, 
    selectModel 
  } = useModels()
  
  // 当前会话信息
  const currentSession = projects
    .flatMap(p => p.sessions)
    .find(s => s.id === activeSessionId) || null
  
  // 处理新建会话
  const handleNewSession = async () => {
    const session = await createSession()
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
  
  // 切换主题
  const handleToggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle('dark')
  }
  
  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
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
            onRenameSession={renameSession}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        </aside>

        {/* 主内容区域 */}
        <main className="flex-1 bg-card rounded-2xl flex flex-col shadow-sm relative overflow-hidden border border-border">
          <Header
            session={currentSession}
            isDark={isDark}
            onToggleTheme={handleToggleTheme}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
          <ChatArea
            messages={messages}
            isStreaming={isStreaming}
            currentModel={currentModel}
            models={models}
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
    </div>
  )
}
