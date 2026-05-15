import { useRef, useCallback, useEffect, useState } from 'react'
import { ArrowDown } from 'lucide-react'
import { Button } from '@/renderer/components/ui/button'
import type { Message } from '@/shared/types'
import { MessageGroup } from './MessageGroup'
import { useMessageSettings } from '@/renderer/contexts/MessageSettingsContext'

interface MessageListProps {
  messages: Message[]
  modelName?: string
  isStreaming?: boolean
}

interface MessageGroupType {
  role: 'user' | 'assistant' | 'system'
  messages: Message[]
}

// 消息分组函数
function groupMessages(messages: Message[]): MessageGroupType[] {
  const groups: MessageGroupType[] = []
  
  for (const message of messages) {
    const lastGroup = groups[groups.length - 1]
    
    if (lastGroup && lastGroup.role === message.role && message.role === 'assistant') {
      // 连续的助手消息合并为一组
      lastGroup.messages.push(message)
    } else {
      // 否则创建新组
      groups.push({ role: message.role, messages: [message] })
    }
  }
  
  return groups
}

export function MessageList({ messages, modelName, isStreaming }: MessageListProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const { settings } = useMessageSettings()
  
  // 监听滚动事件
  const handleScroll = useCallback(() => {
    const container = viewportRef.current
    if (!container) return
    
    const { scrollTop, scrollHeight, clientHeight } = container
    const isBottom = scrollHeight - scrollTop - clientHeight < 50
    
    setIsAtBottom(isBottom)
    setShowScrollButton(!isBottom)
  }, [])
  
  useEffect(() => {
    const container = viewportRef.current
    if (!container) return
    
    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [handleScroll])
  
  // 流式消息时自动滚动到底部
  useEffect(() => {
    if (isStreaming && isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isStreaming, isAtBottom])
  
  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])
  
  // 消息分组
  const groups = groupMessages(messages)
  
  return (
    <div className="relative flex-1">
      <div 
        ref={viewportRef}
        className="h-full overflow-y-auto px-4 py-6"
      >
        <div className="max-w-3xl mx-auto space-y-6">
          {groups.map((group, index) => (
            <MessageGroup
              key={`${group.messages[0].id}-${index}`}
              role={group.role}
              messages={group.messages}
              modelName={modelName}
              showTimestamp={
                group.role === 'assistant' 
                  ? index === groups.length - 1 
                  : index === groups.length - 1
              }
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* 滚动到底部按钮 */}
      {showScrollButton && (
        <Button
          variant="outline"
          size="icon"
          className="absolute bottom-4 left-1/2 -translate-x-1/2 shadow-lg"
          onClick={scrollToBottom}
        >
          <ArrowDown size={16} />
        </Button>
      )}
    </div>
  )
}
