import type { Message, ModelInfo } from '@/shared/types'
import { MessageList } from './chat/MessageList'
import { ChatInput } from './chat/ChatInput'

interface ChatAreaProps {
  messages: Message[]
  isStreaming?: boolean
  currentModel: ModelInfo | null
  models: ModelInfo[]
  onSend: (text: string) => void
  onAbort: () => void
  onSelectModel: (modelId: string) => void
}

export function ChatArea({
  messages,
  isStreaming,
  currentModel,
  models,
  onSend,
  onAbort,
  onSelectModel,
}: ChatAreaProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* 消息列表 */}
      <MessageList 
        messages={messages}
        modelName={currentModel?.name}
        isStreaming={isStreaming}
      />
      
      {/* 输入框 */}
      <ChatInput
        currentModel={currentModel}
        models={models}
        isStreaming={isStreaming}
        onSend={onSend}
        onAbort={onAbort}
        onSelectModel={onSelectModel}
      />
    </div>
  )
}
