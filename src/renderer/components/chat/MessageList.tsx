import { useRef, useCallback, useEffect, useState } from 'react'
import { ArrowDown } from 'lucide-react'
import { Button } from '@/renderer/components/ui/button'
import type { Message } from '@/shared/types'
import { MessageGroup } from './MessageGroup'

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
  // 策略：流式中只要用户没滚远（>50%视口高度），就继续跟随；流式结束确认滚到底部
  useEffect(() => {
    const container = viewportRef.current
    if (!container) return
    
    const { scrollTop, scrollHeight, clientHeight } = container
    const isBottom = scrollHeight - scrollTop - clientHeight < 50
    
    if (isStreaming) {
      // 流式期间：如果用户没明确向上滚动过（距离底部>50%视口高度），就自动滚动
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight
      const userScrolledFarUp = userScrolledUpRef.current && distanceFromBottom > clientHeight * 0.5
      
      if (!userScrolledFarUp) {
        scrollToBottomImmediate()
      }
    } else if (!isStreaming) {
      // 流式结束后：如果用户之前没主动向上滚远，确认滚到底部
      if (!userScrolledUpRef.current && !isBottom) {
        scrollToBottomImmediate()
      }
      // 重置用户滚动状态
      userScrolledUpRef.current = false
    }
  }, [messages, isStreaming])
  
  // 滚动到底部（带动画）
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    userScrolledUpRef.current = false
  }, [])
  
  // 消息分组
  const groups = groupMessages(messages)
  
  return (
    <div className="relative flex-1 min-h-0 overflow-hidden">
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
