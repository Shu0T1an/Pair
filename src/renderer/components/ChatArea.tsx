import { useTheme } from '@/renderer/contexts/ThemeContext'
import type { Message, ModelInfo } from '@/shared/types'
import { MessageList } from './chat/MessageList'
import { ChatInput } from './chat/ChatInput'

interface ChatAreaProps {
  messages: Message[]
  isStreaming?: boolean
  currentModel: ModelInfo | null
  models: ModelInfo[]
  sessionId?: string
  onSend: (text: string) => void
  onAbort: () => void
  onSelectModel: (modelId: string) => void
  onOpenSettings?: () => void
  onNewSession?: () => void
}

export function ChatArea({
  messages,
  isStreaming,
  currentModel,
  models,
  sessionId,
  onSend,
  onAbort,
  onSelectModel,
  onOpenSettings,
  onNewSession,
}: ChatAreaProps) {
  const { fontSize } = useTheme()
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* 消息列表 */}
      <MessageList 
        messages={messages}
        modelName={currentModel?.name}
        isStreaming={isStreaming}
        onSendMessage={onSend}
        fontSize={fontSize}
      />
      
      {/* 输入框 — 用 key 隔离不同会话的输入状态 */}
      <ChatInput
        key={sessionId || 'no-session'}
        currentModel={currentModel}
        models={models}
        isStreaming={isStreaming}
        sessionId={sessionId}
        onSend={onSend}
        onAbort={onAbort}
        onSelectModel={onSelectModel}
        onOpenSettings={onOpenSettings}
        onNewSession={onNewSession}
      />
    </div>
  )
}
