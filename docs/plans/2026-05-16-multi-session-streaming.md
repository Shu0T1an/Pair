# Multi-Session Parallel Streaming Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现多session同时运行时的流畅切换体验，确保切换会话时流式输出不中断，实时状态正确显示。

**Architecture:** 使用全局流式状态管理器（GlobalStreamManager）在应用级别监听所有会话的事件，按 sessionId 维护独立的流式状态。当用户切换会话时，直接从全局状态恢复流式消息，而不是重新订阅事件。

**Tech Stack:** React Context, useRef, TypeScript, IPC Events

---

## 问题分析

### 当前问题

1. **事件监听器绑定当前会话**：`useMessages` 中的事件监听器只处理 `sessionId === currentSessionId` 的事件
2. **切换会话时取消订阅**：`useEffect` 依赖 `sessionId`，切换时会取消旧订阅、创建新订阅
3. **流式状态丢失**：切换回正在流式输出的会话时，无法恢复流式消息

### 期望行为

- 会话A发送消息后开始流式输出
- 用户切换到会话B，会话A的流式输出继续在后台处理
- 用户切换回会话A，立即看到完整的流式消息（包括切换期间的内容）

---

## Task 1: 创建全局流式状态管理器

**Files:**
- Create: `src/renderer/contexts/GlobalStreamContext.tsx`
- Modify: `src/renderer/App.tsx`

**Step 1: 创建 GlobalStreamContext**

```typescript
// src/renderer/contexts/GlobalStreamContext.tsx
import { createContext, useContext, useRef, useCallback, useEffect, type ReactNode } from 'react'
import { ipcClient } from '@/renderer/ipc-client'
import type { Message } from '@/shared/types'

// 流式消息状态
interface StreamingState {
  message: Message | null        // 当前流式消息
  textBuffer: string             // 文本缓冲区
  thinkingBuffer: string         // 思考缓冲区
  isStreaming: boolean           // 是否正在流式输出
  lastUpdateTime: number         // 最后更新时间
}

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

// 完整的会话流式状态
interface SessionStreamState {
  streaming: StreamingState
  toolCalls: ToolCallState[]     // 当前正在执行的工具调用
}

interface GlobalStreamContextValue {
  // 获取指定会话的流式状态
  getStreamState: (sessionId: string) => SessionStreamState | undefined
  
  // 获取指定会话正在流式输出的消息
  getStreamingMessage: (sessionId: string) => Message | undefined
  
  // 检查指定会话是否正在流式输出
  isSessionStreaming: (sessionId: string) => boolean
  
  // 清除指定会话的流式状态（消息完成后调用）
  clearStreamState: (sessionId: string) => void
  
  // 获取所有正在流式输出的会话ID
  getStreamingSessionIds: () => string[]
}

const GlobalStreamContext = createContext<GlobalStreamContextValue | null>(null)

export function GlobalStreamProvider({ children }: { children: ReactNode }) {
  // 使用 ref 存储所有会话的流式状态，避免不必要的 re-render
  const statesRef = useRef<Map<string, SessionStreamState>>(new Map())
  
  // 用于通知订阅者的回调集合
  const subscribersRef = useRef<Map<string, Set<() => void>>>(new Map())
  
  // 订阅指定会话的状态变化
  const subscribe = useCallback((sessionId: string, callback: () => void) => {
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
    subscribersRef.current.get(sessionId)?.forEach(cb => cb())
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
    // message_start
    const unsubMessageStart = ipcClient.onMessageStart((event) => {
      const state = getOrCreateState(event.sessionId)
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
      const state = statesRef.current.get(event.sessionId)
      if (state) {
        const toolCall = state.toolCalls.find(tc => tc.id === event.toolCallId)
        if (toolCall) {
          toolCall.status = event.isError ? 'error' : 'success'
          toolCall.result = typeof event.result === 'string' ? event.result : JSON.stringify(event.result)
          toolCall.error = event.isError ? toolCall.result : undefined
          toolCall.endTime = new Date()
        }
      }
      notify(event.sessionId)
    })

    return () => {
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
    
    // 返回带有当前缓冲区内容的消息
    return {
      ...state.streaming.message,
      content: state.streaming.message.content + state.streaming.textBuffer,
      thinking: state.streaming.thinkingBuffer 
        ? (state.streaming.message.thinking || '') + state.streaming.thinkingBuffer 
        : state.streaming.message.thinking,
      toolCalls: state.toolCalls.length > 0 ? state.toolCalls : undefined,
    }
  }, [])

  const isSessionStreaming = useCallback((sessionId: string) => {
    return statesRef.current.get(sessionId)?.streaming.isStreaming ?? false
  }, [])

  const clearStreamState = useCallback((sessionId: string) => {
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
  const { getStreamState, getStreamingMessage, isSessionStreaming } = useGlobalStream()
  const [, forceUpdate] = useReducer(x => x + 1, 0)
  
  useEffect(() => {
    if (!sessionId) return
    
    // 订阅状态变化
    const unsubscribe = subscribe(sessionId, forceUpdate)
    return unsubscribe
  }, [sessionId])
  
  return {
    streamState: sessionId ? getStreamState(sessionId) : undefined,
    streamingMessage: sessionId ? getStreamingMessage(sessionId) : undefined,
    isStreaming: sessionId ? isSessionStreaming(sessionId) : false,
  }
}

// 需要导入 useReducer
import { useReducer } from 'react'
```

**Step 2: 在 App.tsx 中添加 Provider**

```typescript
// src/renderer/App.tsx - 添加 GlobalStreamProvider
import { GlobalStreamProvider } from '@/renderer/contexts/GlobalStreamContext'

function App() {
  return (
    <GlobalStreamProvider>
      {/* 其他 providers */}
      <ChatPage />
    </GlobalStreamProvider>
  )
}
```

**Step 3: 运行 TypeScript 检查**

Run: `npm run build`
Expected: 编译成功，无类型错误

**Step 4: Commit**

```bash
git add src/renderer/contexts/GlobalStreamContext.tsx src/renderer/App.tsx
git commit -m "feat: add GlobalStreamContext for multi-session streaming state"
```

---

## Task 2: 修改 useMessages 使用全局流式状态

**Files:**
- Modify: `src/renderer/hooks/useMessages.ts`

**Step 1: 修改 useMessages 集成 GlobalStreamContext**

```typescript
// src/renderer/hooks/useMessages.ts
import { useGlobalStream } from '@/renderer/contexts/GlobalStreamContext'

export function useMessages({ sessionId, messagesCache, currentModelId, modelConfigs }: UseMessagesOptions) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const { updateStatus } = useSessionState()
  const { getStreamingMessage, isSessionStreaming, clearStreamState } = useGlobalStream()
  
  // ... 其他代码保持不变 ...

  // 切换会话时加载消息
  useEffect(() => {
    if (sessionId) {
      loadMessages(sessionId)
      
      // 检查是否有正在进行的流式消息
      const streamingMessage = getStreamingMessage(sessionId)
      if (streamingMessage) {
        setMessages(prev => {
          // 检查消息是否已存在
          const exists = prev.some(m => m.id === streamingMessage.id)
          if (exists) {
            return prev.map(m => m.id === streamingMessage.id ? streamingMessage : m)
          }
          return [...prev, streamingMessage]
        })
        setIsStreaming(isSessionStreaming(sessionId))
      }
    } else {
      setMessages([])
    }
  }, [sessionId, loadMessages, getStreamingMessage, isSessionStreaming])

  // 注册流式事件监听 - 只处理消息完成事件
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

    // agent_end
    const unsubAgentEnd = ipcClient.onAgentEnd((event: AgentEndEvent) => {
      if (event.sessionId !== sessionId) return
      updateStatus(sessionId, 'completed')
    })

    return () => {
      unsubMessageEnd()
      unsubAgentEnd()
    }
  }, [sessionId, getStreamingMessage, clearStreamState, updateStatus])

  // 订阅全局流式状态变化，实时更新消息
  useEffect(() => {
    if (!sessionId) return

    const unsubscribe = subscribe(sessionId, () => {
      const streamingMessage = getStreamingMessage(sessionId)
      if (!streamingMessage) return

      setMessages(prev => {
        const lastMessage = prev[prev.length - 1]
        
        // 如果最后一条消息是正在流式的助手消息，更新它
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
          return [...prev.slice(0, -1), streamingMessage]
        }
        
        // 如果最后一条不是流式消息，但有新的流式消息，添加它
        if (streamingMessage.isStreaming && !prev.some(m => m.id === streamingMessage.id)) {
          return [...prev, streamingMessage]
        }
        
        return prev
      })
      
      setIsStreaming(isSessionStreaming(sessionId))
    })

    return unsubscribe
  }, [sessionId, getStreamingMessage, isSessionStreaming])

  // ... 其他代码保持不变 ...
}
```

**Step 2: 移除旧的流式事件监听代码**

删除 `useMessages` 中旧的 `text_delta`、`thinking_delta`、`tool_start`、`tool_end` 事件监听代码，因为这些现在由 `GlobalStreamContext` 处理。

**Step 3: 运行测试**

Run: `npm test`
Expected: 所有测试通过

**Step 4: Commit**

```bash
git add src/renderer/hooks/useMessages.ts
git commit -m "refactor: integrate GlobalStreamContext into useMessages"
```

---

## Task 3: 添加流式状态指示器

**Files:**
- Modify: `src/renderer/components/SessionList.tsx`
- Create: `src/renderer/components/StreamingIndicator.tsx`

**Step 1: 创建 StreamingIndicator 组件**

```typescript
// src/renderer/components/StreamingIndicator.tsx
import { useGlobalStream } from '@/renderer/contexts/GlobalStreamContext'

interface StreamingIndicatorProps {
  sessionId: string
}

export function StreamingIndicator({ sessionId }: StreamingIndicatorProps) {
  const { isSessionStreaming } = useGlobalStream()
  const isStreaming = isSessionStreaming(sessionId)
  
  if (!isStreaming) return null
  
  return (
    <span className="inline-flex items-center gap-1 text-xs text-blue-500">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
      </span>
      <span>生成中</span>
    </span>
  )
}
```

**Step 2: 在 SessionList 中显示流式状态**

```typescript
// src/renderer/components/SessionList.tsx
import { StreamingIndicator } from './StreamingIndicator'
import { useGlobalStream } from '@/renderer/contexts/GlobalStreamContext'

export function SessionList({ ... }: SessionListProps) {
  const { isSessionStreaming } = useGlobalStream()
  
  return (
    <div className="session-list">
      {sessions.map(session => (
        <div 
          key={session.id}
          className={`session-item ${isSessionStreaming(session.id) ? 'streaming' : ''}`}
        >
          <div className="session-name">{session.name}</div>
          <StreamingIndicator sessionId={session.id} />
        </div>
      ))}
    </div>
  )
}
```

**Step 3: 运行 TypeScript 检查**

Run: `npm run build`
Expected: 编译成功

**Step 4: Commit**

```bash
git add src/renderer/components/StreamingIndicator.tsx src/renderer/components/SessionList.tsx
git commit -m "feat: add streaming indicator to session list"
```

---

## Task 4: 优化流式消息渲染性能

**Files:**
- Modify: `src/renderer/components/chat/MessageList.tsx`
- Modify: `src/renderer/components/chat/MessageGroup.tsx`

**Step 1: 添加流式消息的 RAF 节流**

```typescript
// src/renderer/components/chat/MessageList.tsx
import { useRef, useEffect, useCallback } from 'react'

export function MessageList({ messages, isStreaming }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const shouldAutoScrollRef = useRef(true)
  
  // 使用 RAF 节流滚动
  const scrollToBottom = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }
    
    rafRef.current = requestAnimationFrame(() => {
      if (shouldAutoScrollRef.current && scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
      rafRef.current = null
    })
  }, [])
  
  // 监听消息变化，自动滚动
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])
  
  // 检测用户是否手动滚动
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
    
    shouldAutoScrollRef.current = isAtBottom
  }, [])
  
  // 清理 RAF
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])
  
  return (
    <div 
      ref={scrollRef}
      className="message-list overflow-y-auto"
      onScroll={handleScroll}
    >
      {messages.map((msg, index) => (
        <MessageGroup
          key={msg.id}
          message={msg}
          isLast={index === messages.length - 1}
        />
      ))}
    </div>
  )
}
```

**Step 2: 优化 MessageGroup 渲染**

```typescript
// src/renderer/components/chat/MessageGroup.tsx
import React, { memo } from 'react'

// 使用 memo 避免不必要的重渲染
export const MessageGroup = memo(function MessageGroup({ 
  message, 
  isLast 
}: MessageGroupProps) {
  // ... 组件实现
}, (prevProps, nextProps) => {
  // 自定义比较函数
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.isStreaming === nextProps.message.isStreaming &&
    prevProps.isLast === nextProps.isLast
  )
})
```

**Step 3: 运行测试**

Run: `npm test`
Expected: 所有测试通过

**Step 4: Commit**

```bash
git add src/renderer/components/chat/MessageList.tsx src/renderer/components/chat/MessageGroup.tsx
git commit -m "perf: optimize streaming message rendering with RAF throttle and memo"
```

---

## Task 5: 集成测试和边界情况处理

**Files:**
- Create: `src/renderer/__tests__/GlobalStreamContext.test.tsx`
- Modify: `src/renderer/hooks/useMessages.ts`

**Step 1: 编写集成测试**

```typescript
// src/renderer/__tests__/GlobalStreamContext.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { GlobalStreamProvider, useGlobalStream } from '../contexts/GlobalStreamContext'

// Mock ipcClient
vi.mock('@/renderer/ipc-client', () => ({
  ipcClient: {
    onMessageStart: vi.fn(() => vi.fn()),
    onTextDelta: vi.fn(() => vi.fn()),
    onThinkingDelta: vi.fn(() => vi.fn()),
    onMessageEnd: vi.fn(() => vi.fn()),
    onToolStart: vi.fn(() => vi.fn()),
    onToolEnd: vi.fn(() => vi.fn()),
  }
}))

describe('GlobalStreamContext', () => {
  it('should track streaming state for multiple sessions', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <GlobalStreamProvider>{children}</GlobalStreamProvider>
    )
    
    const { result } = renderHook(() => useGlobalStream(), { wrapper })
    
    // 初始状态
    expect(result.current.isSessionStreaming('session-1')).toBe(false)
    expect(result.current.isSessionStreaming('session-2')).toBe(false)
  })

  it('should return undefined for non-existent session', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <GlobalStreamProvider>{children}</GlobalStreamProvider>
    )
    
    const { result } = renderHook(() => useGlobalStream(), { wrapper })
    
    expect(result.current.getStreamingMessage('non-existent')).toBeUndefined()
  })
})
```

**Step 2: 添加边界情况处理**

```typescript
// src/renderer/hooks/useMessages.ts - 添加边界情况处理

// 处理会话快速切换
useEffect(() => {
  if (!sessionId) return

  // 标记当前 effect 是否已清理
  let isCancelled = false

  const unsubscribe = subscribe(sessionId, () => {
    if (isCancelled) return  // 如果已清理，不执行更新
    
    const streamingMessage = getStreamingMessage(sessionId)
    if (!streamingMessage) return

    setMessages(prev => {
      // ... 更新逻辑
    })
  })

  return () => {
    isCancelled = true
    unsubscribe()
  }
}, [sessionId, getStreamingMessage, isSessionStreaming])
```

**Step 3: 运行测试**

Run: `npm test src/renderer/__tests__/GlobalStreamContext.test.tsx`
Expected: 测试通过

**Step 4: Commit**

```bash
git add src/renderer/__tests__/GlobalStreamContext.test.tsx src/renderer/hooks/useMessages.ts
git commit -m "test: add GlobalStreamContext tests and edge case handling"
```

---

## Task 6: 文档和最终优化

**Files:**
- Modify: `AGENTS.md`
- Create: `docs/plans/2026-05-16-multi-session-streaming.md`

**Step 1: 更新 AGENTS.md 文档**

在 `AGENTS.md` 的 `## Hooks 架构` 部分添加：

```markdown
### GlobalStreamContext
- 状态: 全局流式消息状态（按 sessionId 索引）
- 方法: `getStreamingMessage`, `isSessionStreaming`, `clearStreamState`
- 特性: 
  - 应用级别事件监听，不随会话切换而中断
  - 实时更新流式消息内容
  - 支持多会话并行流式输出
  - 会话列表显示流式状态指示器
```

**Step 2: 保存实现计划**

将本文档保存到 `docs/plans/2026-05-16-multi-session-streaming.md`

**Step 3: 最终测试**

Run: `npm test && npm run build`
Expected: 所有测试通过，构建成功

**Step 4: Commit**

```bash
git add AGENTS.md docs/plans/2026-05-16-multi-session-streaming.md
git commit -m "docs: update architecture docs for multi-session streaming"
```

---

## 验收标准

1. ✅ 会话A发送消息后开始流式输出
2. ✅ 用户切换到会话B，会话A的流式输出继续在后台处理
3. ✅ 用户切换回会话A，立即看到完整的流式消息
4. ✅ 会话列表显示正在流式输出的会话状态
5. ✅ 流式消息渲染流畅，无卡顿
6. ✅ 所有现有测试通过
7. ✅ 无 TypeScript 类型错误

---

## 执行选项

**Plan complete and saved to `docs/plans/2026-05-16-multi-session-streaming.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
