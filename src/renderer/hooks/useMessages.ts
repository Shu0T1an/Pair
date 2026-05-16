import { useState, useCallback, useEffect, useRef } from 'react'
import type { Message } from '@/shared/types'
import { ipcClient } from '@/renderer/ipc-client'
import type { ModelConfig } from '@/renderer/contexts/ModelContext'
import { useGlobalStream } from '@/renderer/contexts/GlobalStreamContext'
import type { 
  MessageEndEvent,
  AgentEndEvent 
} from '@/renderer/ipc-client'

interface UseMessagesOptions {
  sessionId: string | null
  messagesCache: Map<string, Message[]>
  currentModelId?: string
  modelConfigs?: ModelConfig[]  // 自定义模型配置列表
}

export function useMessages({ sessionId, messagesCache, currentModelId, modelConfigs }: UseMessagesOptions) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const { getStreamingMessage, isSessionStreaming, clearStreamState, subscribe, setSessionStatus } = useGlobalStream()
  
  // 标记当前 effect 是否已清理
  const isCancelledRef = useRef(false)

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
    setSessionStatus(sessionId, 'streaming')
    
    try {
      // 如果当前模型有对应的项目配置，传完整配置对象（走 createCustomModel 路径）
      // 模型列表来自 ModelContext（localStorage），同源保证总能找到匹配的配置
      if (currentModelId && modelConfigs) {
        const matchedConfig = modelConfigs.find(c => c.enabledModels.includes(currentModelId))
        if (matchedConfig) {
          await ipcClient.sendMessage(sessionId, text, {
            provider: matchedConfig.provider,
            baseUrl: matchedConfig.baseUrl,
            apiKey: matchedConfig.apiKey,
            modelId: currentModelId,
            modelName: currentModelId,
            api: matchedConfig.api,
            contextWindow: matchedConfig.contextWindow,
          })
        } else {
          // 模型不在项目配置中，不传 modelConfig，使用会话当前模型
          await ipcClient.sendMessage(sessionId, text)
        }
      } else {
        // 没有模型 ID，直接发送
        await ipcClient.sendMessage(sessionId, text)
      }
    } catch (error) {
      console.error('发送消息失败:', error)
      setIsStreaming(false)
    }
  }, [sessionId, currentModelId, modelConfigs, setSessionStatus])

  // 中止消息
  const abortMessage = useCallback(async () => {
    if (!sessionId) return
    
    try {
      await ipcClient.abortMessage(sessionId)
      setIsStreaming(false)
      setSessionStatus(sessionId, 'idle')
    } catch (error) {
      console.error('中止消息失败:', error)
    }
  }, [sessionId, setSessionStatus])

  // 切换会话时加载消息
  useEffect(() => {
    isCancelledRef.current = false
    
    if (sessionId) {
      loadMessages(sessionId)
      
      // 检查是否有正在进行的流式消息
      const streamingMessage = getStreamingMessage(sessionId)
      if (streamingMessage && !isCancelledRef.current) {
        setMessages(prev => {
          // 检查消息是否已存在
          const exists = prev.some(m => m.id === streamingMessage.id)
          if (exists) {
            // 更新已存在的消息
            return prev.map(m => m.id === streamingMessage.id ? streamingMessage : m)
          }
          // 添加新的流式消息
          return [...prev, streamingMessage]
        })
        setIsStreaming(isSessionStreaming(sessionId))
      }
    } else {
      setMessages([])
    }
    
    return () => {
      isCancelledRef.current = true
    }
  }, [sessionId, loadMessages, getStreamingMessage, isSessionStreaming])

  // 注册消息完成事件监听
  useEffect(() => {
    if (!sessionId) return

    // message_end - 处理消息完成
    const unsubMessageEnd = ipcClient.onMessageEnd((event: MessageEndEvent) => {
      if (event.sessionId !== sessionId) return
      
      // 从全局状态获取完整消息
      const streamingMessage = getStreamingMessage(sessionId)
      
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1]
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
          return [...prev.slice(0, -1), {
            ...lastMessage,
            content: streamingMessage?.content || lastMessage.content,
            thinking: streamingMessage?.thinking || lastMessage.thinking,
            isStreaming: false,
            streamingEndTime: new Date(),
            usage: event.usage,
            toolCalls: streamingMessage?.toolCalls || lastMessage.toolCalls,
          }]
        }
        return prev
      })
      
      setIsStreaming(false)
      clearStreamState(sessionId)  // 清除全局流式状态
    })

    // agent_end — 整个 agent 处理完成，更新状态为 completed
    const unsubAgentEnd = ipcClient.onAgentEnd((event: AgentEndEvent) => {
      if (event.sessionId !== sessionId) return
      setSessionStatus(sessionId, 'completed')
    })

    return () => {
      unsubMessageEnd()
      unsubAgentEnd()
    }
  }, [sessionId, getStreamingMessage, clearStreamState, setSessionStatus])

  // 订阅全局流式状态变化，实时更新消息
  useEffect(() => {
    if (!sessionId) return

    let cancelled = false

    const unsubscribe = subscribe(sessionId, () => {
      if (cancelled) return
      
      const streamingMessage = getStreamingMessage(sessionId)
      if (!streamingMessage) return
      
      console.log('[useMessages] subscribe callback - toolCalls:', streamingMessage.toolCalls?.length || 0, 'isStreaming:', streamingMessage.isStreaming)

      setMessages(prev => {
        const lastMessage = prev[prev.length - 1]
        
        // 如果最后一条消息是助手消息（无论是否 streaming），更新它
        // 这样可以确保 toolCalls 被正确添加
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.id === streamingMessage.id) {
          return [...prev.slice(0, -1), streamingMessage]
        }
        
        // 如果有新的流式消息，添加它
        if (streamingMessage.isStreaming && !prev.some(m => m.id === streamingMessage.id)) {
          return [...prev, streamingMessage]
        }
        
        return prev
      })
      
      setIsStreaming(isSessionStreaming(sessionId))
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [sessionId, getStreamingMessage, isSessionStreaming, subscribe])

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
