import { useState, useCallback, useEffect, useRef } from 'react'
import type { Message } from '@/shared/types'
import { ipcClient } from '@/renderer/ipc-client'
import type { 
  TextDeltaEvent, 
  ThinkingDeltaEvent, 
  MessageStartEvent, 
  MessageEndEvent,
  ToolStartEvent,
  ToolEndEvent 
} from '@/renderer/ipc-client'

interface UseMessagesOptions {
  sessionId: string | null
  messagesCache: Map<string, Message[]>
}

export function useMessages({ sessionId, messagesCache }: UseMessagesOptions) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  
  // 流式消息引用
  const streamingMessageRef = useRef<{ id: string } | null>(null)
  
  // 流式内容缓冲区
  const streamBufferRef = useRef<string>('')
  const streamThinkingBufferRef = useRef<string>('')
  const rafIdRef = useRef<number | null>(null)
  const lastUpdateRef = useRef<number>(0)

  // 刷新流缓冲区 - 使用 ref 来避免依赖问题
  const flushStreamBufferRef = useRef<() => void>(() => {})
  
  // 在 effect 中更新 ref，避免在渲染期间更新
  useEffect(() => {
    flushStreamBufferRef.current = () => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    
    const now = Date.now()
    const timeSinceLastUpdate = now - lastUpdateRef.current
    
    if (timeSinceLastUpdate < 16) {
      rafIdRef.current = requestAnimationFrame(() => {
        flushStreamBufferRef.current()
      })
      return
    }
    
    lastUpdateRef.current = now
    const bufferedContent = streamBufferRef.current
    const bufferedThinking = streamThinkingBufferRef.current
    
    streamBufferRef.current = ''
    streamThinkingBufferRef.current = ''
    
    if (bufferedContent || bufferedThinking) {
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1]
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
          return [...prev.slice(0, -1), {
            ...lastMessage,
            content: lastMessage.content + bufferedContent,
            thinking: bufferedThinking ? (lastMessage.thinking || '') + bufferedThinking : lastMessage.thinking,
          }]
        }
        return prev
      })
    }
  }
  }, []) // 空依赖数组，只在挂载时设置一次

  // 加载会话消息
  const loadMessages = useCallback(async (sid: string) => {
    // 检查缓存
    const cached = messagesCache.get(sid)
    if (cached) {
      setMessages(cached)
      return
    }
    
    setIsLoading(true)
    setMessages([])
    
    try {
      const historyMessages = await ipcClient.getSessionMessages(sid)
      setMessages(historyMessages)
      messagesCache.set(sid, historyMessages)
    } catch (error) {
      console.error('加载消息失败:', error)
    } finally {
      setIsLoading(false)
    }
  }, [messagesCache])

  // 发送消息
  const sendMessage = useCallback(async (text: string) => {
    if (!sessionId || !text.trim()) return
    
    // 添加用户消息
    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    }
    
    setMessages(prev => [...prev, userMessage])
    setIsStreaming(true)
    
    try {
      await ipcClient.sendMessage(sessionId, text)
    } catch (error) {
      console.error('发送消息失败:', error)
      setIsStreaming(false)
    }
  }, [sessionId])

  // 中止消息
  const abortMessage = useCallback(async () => {
    if (!sessionId) return
    
    try {
      await ipcClient.abortMessage(sessionId)
      setIsStreaming(false)
    } catch (error) {
      console.error('中止消息失败:', error)
    }
  }, [sessionId])

  // 切换会话时加载消息
  useEffect(() => {
    if (sessionId) {
      loadMessages(sessionId)
    } else {
      setMessages([])
    }
  }, [sessionId, loadMessages])

  // 注册流式事件监听
  useEffect(() => {
    if (!sessionId) return

    // message_start
    const unsubMessageStart = ipcClient.onMessageStart((event: MessageStartEvent) => {
      if (event.sessionId !== sessionId) return
      
      streamingMessageRef.current = { id: event.messageId }
      
      const assistantMessage: Message = {
        id: event.messageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
        streamingStartTime: new Date(),
      }
      
      setMessages(prev => [...prev, assistantMessage])
    })

    // text_delta
    const unsubTextDelta = ipcClient.onTextDelta((event: TextDeltaEvent) => {
      if (event.sessionId !== sessionId) return
      
      streamBufferRef.current += event.delta
      flushStreamBufferRef.current()
    })

    // thinking_delta
    const unsubThinkingDelta = ipcClient.onThinkingDelta((event: ThinkingDeltaEvent) => {
      if (event.sessionId !== sessionId) return
      
      streamThinkingBufferRef.current += event.delta
      flushStreamBufferRef.current()
    })

    // message_end
    const unsubMessageEnd = ipcClient.onMessageEnd((event: MessageEndEvent) => {
      if (event.sessionId !== sessionId) return
      
      flushStreamBufferRef.current()
      
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1]
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
          return [...prev.slice(0, -1), {
            ...lastMessage,
            isStreaming: false,
            streamingEndTime: new Date(),
            usage: event.usage,
          }]
        }
        return prev
      })
      
      streamingMessageRef.current = null
      setIsStreaming(false)
    })

    // tool_start
    const unsubToolStart = ipcClient.onToolStart((event: ToolStartEvent) => {
      if (event.sessionId !== sessionId) return
      
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1]
        if (lastMessage && lastMessage.role === 'assistant') {
          const toolCall = {
            id: event.toolCallId,
            name: event.toolName,
            args: event.args,
            status: 'running' as const,
            startTime: new Date(),
          }
          
          return [...prev.slice(0, -1), {
            ...lastMessage,
            toolCalls: [...(lastMessage.toolCalls || []), toolCall],
          }]
        }
        return prev
      })
    })

    // tool_end
    const unsubToolEnd = ipcClient.onToolEnd((event: ToolEndEvent) => {
      if (event.sessionId !== sessionId) return
      
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1]
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.toolCalls) {
          const updatedToolCalls = lastMessage.toolCalls.map(tc => {
            if (tc.id === event.toolCallId) {
              return {
                ...tc,
                status: event.isError ? 'error' as const : 'success' as const,
                result: event.result,
                error: event.isError ? event.result : undefined,
                endTime: new Date(),
              }
            }
            return tc
          })
          
          return [...prev.slice(0, -1), {
            ...lastMessage,
            toolCalls: updatedToolCalls,
          }]
        }
        return prev
      })
    })

    return () => {
      unsubMessageStart()
      unsubTextDelta()
      unsubThinkingDelta()
      unsubMessageEnd()
      unsubToolStart()
      unsubToolEnd()
    }
  }, [sessionId])

  // 缓存消息
  useEffect(() => {
    if (sessionId && messages.length > 0) {
      messagesCache.set(sessionId, messages)
    }
  }, [sessionId, messages, messagesCache])

  return {
    messages,
    isLoading,
    isStreaming,
    sendMessage,
    abortMessage,
    loadMessages,
  }
}
