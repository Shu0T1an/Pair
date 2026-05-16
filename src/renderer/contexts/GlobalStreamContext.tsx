import { createContext, useContext, useRef, useCallback, useEffect, useReducer, type ReactNode } from 'react'
import { ipcClient } from '@/renderer/ipc-client'
import type { Message } from '@/shared/types'

// 工具调用状态
interface ToolCallState {
  id: string
  name: string
  args: Record<string, unknown>
  status: 'running' | 'success' | 'error'
  result?: string
  error?: string
  startTime: Date
  endTime?: Date
}

// 流式消息状态
interface StreamingState {
  message: Message | null
  textBuffer: string
  thinkingBuffer: string
  isStreaming: boolean
  lastUpdateTime: number
}

// 完整的会话流式状态
interface SessionStreamState {
  streaming: StreamingState
  toolCalls: ToolCallState[]
}

// 订阅回调类型
type Subscriber = () => void

interface GlobalStreamContextValue {
  // 获取指定会话的流式状态
  getStreamState: (sessionId: string) => SessionStreamState | undefined

  // 获取指定会话正在流式输出的消息（包含缓冲区内容）
  getStreamingMessage: (sessionId: string) => Message | undefined

  // 检查指定会话是否正在流式输出
  isSessionStreaming: (sessionId: string) => boolean

  // 清除指定会话的流式状态（消息完成后调用）
  clearStreamState: (sessionId: string) => void

  // 获取所有正在流式输出的会话ID
  getStreamingSessionIds: () => string[]

  // 订阅指定会话的状态变化
  subscribe: (sessionId: string, callback: Subscriber) => () => void
}

const GlobalStreamContext = createContext<GlobalStreamContextValue | null>(null)

// 工具结果转换为字符串
function toolResultToString(result: unknown): string {
  if (typeof result === 'string') {
    return result
  }
  if (typeof result === 'object' && result !== null) {
    const obj = result as Record<string, unknown>
    if ('text' in obj && typeof obj.text === 'string') {
      return obj.text
    }
    if ('content' in obj && typeof obj.content === 'string') {
      return obj.content
    }
    return JSON.stringify(result, null, 2)
  }
  return String(result)
}

export function GlobalStreamProvider({ children }: { children: ReactNode }) {
  // 使用 ref 存储所有会话的流式状态，避免不必要的 re-render
  const statesRef = useRef<Map<string, SessionStreamState>>(new Map())

  // 用于通知订阅者的回调集合
  const subscribersRef = useRef<Map<string, Set<Subscriber>>>(new Map())

  // 订阅指定会话的状态变化
  const subscribe = useCallback((sessionId: string, callback: Subscriber) => {
    if (!subscribersRef.current.has(sessionId)) {
      subscribersRef.current.set(sessionId, new Set())
    }
    subscribersRef.current.get(sessionId)!.add(callback)

    return () => {
      subscribersRef.current.get(sessionId)?.delete(callback)
    }
  }, [])

  // 通知指定会话的订阅者
  const notify = useCallback((sessionId: string) => {
    subscribersRef.current.get(sessionId)?.forEach(cb => {
      try {
        cb()
      } catch (error) {
        console.error('[GlobalStream] 订阅者回调错误:', error)
      }
    })
  }, [])

  // 获取或创建会话状态
  const getOrCreateState = useCallback((sessionId: string): SessionStreamState => {
    if (!statesRef.current.has(sessionId)) {
      statesRef.current.set(sessionId, {
        streaming: {
          message: null,
          textBuffer: '',
          thinkingBuffer: '',
          isStreaming: false,
          lastUpdateTime: Date.now(),
        },
        toolCalls: [],
      })
    }
    return statesRef.current.get(sessionId)!
  }, [])

  // 全局事件监听
  useEffect(() => {
    console.log('[GlobalStream] 注册全局事件监听器')

    // message_start
    const unsubMessageStart = ipcClient.onMessageStart((event) => {
      console.log('[GlobalStream] message_start:', event.sessionId)
      const state = getOrCreateState(event.sessionId)

      // 创建新的流式消息
      state.streaming.message = {
        id: event.messageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
        streamingStartTime: new Date(),
      }
      state.streaming.isStreaming = true
      state.streaming.textBuffer = ''
      state.streaming.thinkingBuffer = ''
      state.toolCalls = []

      notify(event.sessionId)
    })

    // text_delta
    const unsubTextDelta = ipcClient.onTextDelta((event) => {
      const state = getOrCreateState(event.sessionId)
      state.streaming.textBuffer += event.delta
      state.streaming.lastUpdateTime = Date.now()
      notify(event.sessionId)
    })

    // thinking_delta
    const unsubThinkingDelta = ipcClient.onThinkingDelta((event) => {
      const state = getOrCreateState(event.sessionId)
      state.streaming.thinkingBuffer += event.delta
      state.streaming.lastUpdateTime = Date.now()
      notify(event.sessionId)
    })

    // message_end
    const unsubMessageEnd = ipcClient.onMessageEnd((event) => {
      console.log('[GlobalStream] message_end:', event.sessionId)
      const state = statesRef.current.get(event.sessionId)
      if (state && state.streaming.message) {
        // 合并缓冲区到消息
        state.streaming.message.content += state.streaming.textBuffer
        state.streaming.message.thinking = state.streaming.thinkingBuffer || undefined
        state.streaming.message.isStreaming = false
        state.streaming.message.streamingEndTime = new Date()
        state.streaming.message.usage = event.usage

        // 清空缓冲区
        state.streaming.textBuffer = ''
        state.streaming.thinkingBuffer = ''
        state.streaming.isStreaming = false
      }
      notify(event.sessionId)
    })

    // tool_start
    const unsubToolStart = ipcClient.onToolStart((event) => {
      console.log('[GlobalStream] tool_start:', event.sessionId, event.toolName)
      const state = getOrCreateState(event.sessionId)
      state.toolCalls.push({
        id: event.toolCallId,
        name: event.toolName,
        args: event.args,
        status: 'running',
        startTime: new Date(),
      })
      notify(event.sessionId)
    })

    // tool_end
    const unsubToolEnd = ipcClient.onToolEnd((event) => {
      console.log('[GlobalStream] tool_end:', event.sessionId, event.toolCallId)
      const state = statesRef.current.get(event.sessionId)
      if (state) {
        const toolCall = state.toolCalls.find(tc => tc.id === event.toolCallId)
        if (toolCall) {
          toolCall.status = event.isError ? 'error' : 'success'
          toolCall.result = toolResultToString(event.result)
          toolCall.error = event.isError ? toolCall.result : undefined
          toolCall.endTime = new Date()
        }
      }
      notify(event.sessionId)
    })

    return () => {
      console.log('[GlobalStream] 注销全局事件监听器')
      unsubMessageStart()
      unsubTextDelta()
      unsubThinkingDelta()
      unsubMessageEnd()
      unsubToolStart()
      unsubToolEnd()
    }
  }, [getOrCreateState, notify])

  // 公共方法
  const getStreamState = useCallback((sessionId: string) => {
    return statesRef.current.get(sessionId)
  }, [])

  const getStreamingMessage = useCallback((sessionId: string) => {
    const state = statesRef.current.get(sessionId)
    if (!state?.streaming.message) return undefined

    // 返回带有当前缓冲区内容和工具调用的消息
    return {
      ...state.streaming.message,
      content: state.streaming.message.content + state.streaming.textBuffer,
      thinking: state.streaming.thinkingBuffer
        ? (state.streaming.message.thinking || '') + state.streaming.thinkingBuffer
        : state.streaming.message.thinking,
      toolCalls: state.toolCalls.length > 0 ? state.toolCalls.map(tc => ({
        ...tc,
        status: tc.status as 'running' | 'success' | 'error',
      })) : undefined,
    }
  }, [])

  const isSessionStreaming = useCallback((sessionId: string) => {
    return statesRef.current.get(sessionId)?.streaming.isStreaming ?? false
  }, [])

  const clearStreamState = useCallback((sessionId: string) => {
    console.log('[GlobalStream] 清除流式状态:', sessionId)
    statesRef.current.delete(sessionId)
    notify(sessionId)
  }, [notify])

  const getStreamingSessionIds = useCallback(() => {
    const ids: string[] = []
    statesRef.current.forEach((state, id) => {
      if (state.streaming.isStreaming) {
        ids.push(id)
      }
    })
    return ids
  }, [])

  const value: GlobalStreamContextValue = {
    getStreamState,
    getStreamingMessage,
    isSessionStreaming,
    clearStreamState,
    getStreamingSessionIds,
    subscribe,
  }

  return (
    <GlobalStreamContext.Provider value={value}>
      {children}
    </GlobalStreamContext.Provider>
  )
}

export function useGlobalStream() {
  const context = useContext(GlobalStreamContext)
  if (!context) {
    throw new Error('useGlobalStream must be used within a GlobalStreamProvider')
  }
  return context
}

// 用于订阅指定会话流式状态变化的 hook
export function useSessionStream(sessionId: string | null) {
  const { getStreamState, getStreamingMessage, isSessionStreaming, subscribe } = useGlobalStream()

  // 使用 forceUpdate 来触发组件更新
  const [, forceUpdate] = useReducer(x => x + 1, 0)

  useEffect(() => {
    if (!sessionId) return

    // 订阅状态变化
    const unsubscribe = subscribe(sessionId, forceUpdate)
    return unsubscribe
  }, [sessionId, subscribe])

  return {
    streamState: sessionId ? getStreamState(sessionId) : undefined,
    streamingMessage: sessionId ? getStreamingMessage(sessionId) : undefined,
    isStreaming: sessionId ? isSessionStreaming(sessionId) : false,
  }
}
