import { useRef, useCallback, useEffect, useState } from 'react'
import { ArrowDown } from 'lucide-react'
import { Button } from '@/renderer/components/ui/button'
import type { Message } from '@/shared/types'
import { MessageGroup } from './MessageGroup'
import { WelcomeView } from './WelcomeView'
import { useMessageSettings } from '@/renderer/contexts/MessageSettingsContext'

interface MessageListProps {
  messages: Message[]
  modelName?: string
  isStreaming?: boolean
  onSendMessage?: (text: string) => void
  fontSize?: number
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

export function MessageList({ messages, modelName, isStreaming, onSendMessage, fontSize }: MessageListProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const userScrolledUpRef = useRef(false)
  const isScrollingToBottomRef = useRef(false)
  
  // 直接滚动到底部（无动画，更可靠）
  const scrollToBottomImmediate = useCallback(() => {
    const container = viewportRef.current
    if (!container) return
    
    isScrollingToBottomRef.current = true
    container.scrollTop = container.scrollHeight
    // 使用 requestAnimationFrame 重置标记
    requestAnimationFrame(() => {
      isScrollingToBottomRef.current = false
    })
  }, [])
  
  // 监听滚动事件
  const handleScroll = useCallback(() => {
    const container = viewportRef.current
    if (!container) return
    
    // 忽略自动滚动触发的事件
    if (isScrollingToBottomRef.current) return
    
    const { scrollTop, scrollHeight, clientHeight } = container
    const isBottom = scrollHeight - scrollTop - clientHeight < 50
    
    setShowScrollButton(!isBottom)
    
    // 如果用户向上滚动（不在底部），标记用户已向上滚动
    if (!isBottom) {
      userScrolledUpRef.current = true
    } else {
      // 如果用户滚动到底部，重置用户滚动状态
      userScrolledUpRef.current = false
    }
  }, [])
  
  useEffect(() => {
    const container = viewportRef.current
    if (!container) return
    
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [handleScroll])
  
  // 流式消息时自动滚动到底部
  // 策略：只要用户向上滚动过（不在底部），就停止自动滚动；用户滚回底部后重新启用
  useEffect(() => {
    const container = viewportRef.current
    if (!container) return
    
    const { scrollTop, scrollHeight, clientHeight } = container
    const isBottom = scrollHeight - scrollTop - clientHeight < 50
    
    if (isStreaming) {
      // 流式期间：只有用户没有向上滚动过（仍在底部）时才自动滚动
      if (!userScrolledUpRef.current && isBottom) {
        scrollToBottomImmediate()
      }
    } else if (!isStreaming) {
      // 流式结束后（agent_end）：如果用户之前没主动向上滚动，确认滚到底部
      if (!userScrolledUpRef.current && !isBottom) {
        scrollToBottomImmediate()
      }
      // 重置用户滚动状态（只在 agent_end 时执行一次）
      userScrolledUpRef.current = false
    }
  }, [messages, isStreaming])
  
  // 滚动到底部（带动画）
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    userScrolledUpRef.current = false
  }, [])
  
  const { settings } = useMessageSettings()

  // 消息分组
  const groups = groupMessages(messages)
  
  // 如果没有消息，显示欢迎界面
  if (messages.length === 0) {
    return <WelcomeView onSendMessage={onSendMessage} />
  }
  
  return (
    <div className="relative flex-1 min-h-0 overflow-hidden">
      <div 
        ref={viewportRef}
        className="h-full overflow-y-auto px-4 py-6"
        style={fontSize ? { fontSize: `${fontSize}px` } : undefined}
      >
        <div className="mx-auto space-y-6" style={{ maxWidth: settings.messageWidth }}>
          {groups.map((group, index) => (
            <MessageGroup
              key={`${group.messages[0].id}-${index}`}
              role={group.role}
              messages={group.messages}
              modelName={modelName}
              fontSize={fontSize}
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
