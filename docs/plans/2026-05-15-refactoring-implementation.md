# 代码重构实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 通过提取 Hooks 和拆分组件，将项目重构为清晰的分层架构，提高可维护性。

**Architecture:** 自底向上重构 - 先提取业务逻辑到 Hooks，再拆分 UI 组件，最后整合为页面组件。每个阶段独立可测试，确保功能不变。

**Tech Stack:** React 19, TypeScript, Vite, Vitest

---

## 阶段 1: 提取 Hooks

### Task 1.1: 创建 useSessions Hook

**Files:**
- Create: `src/renderer/hooks/useSessions.ts`
- Test: `src/renderer/__tests__/hooks/useSessions.test.ts`
- Modify: `src/App.tsx` (后续任务)

**Step 1: 创建 Hook 文件骨架**

```typescript
// src/renderer/hooks/useSessions.ts
import { useState, useCallback, useEffect, useRef } from 'react'
import type { ProjectSessions, SessionInfo, Message } from '@/shared/types'
import { ipcClient } from '@/renderer/ipc-client'

// localStorage keys
const LAST_SESSION_KEY = 'pair-last-session'

function loadLastSession(): string | null {
  try {
    return localStorage.getItem(LAST_SESSION_KEY)
  } catch {
    return null
  }
}

function saveLastSession(sessionId: string) {
  try {
    localStorage.setItem(LAST_SESSION_KEY, sessionId)
  } catch {
    // ignore
  }
}

export function useSessions() {
  const [projects, setProjects] = useState<ProjectSessions[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  
  // 消息缓存
  const messagesCacheRef = useRef<Map<string, Message[]>>(new Map())

  // 加载会话列表
  const loadSessions = useCallback(async () => {
    try {
      const sessions = await ipcClient.listSessions()
      setProjects(sessions)
      return sessions
    } catch (error) {
      console.error('加载会话列表失败:', error)
      return []
    }
  }, [])

  // 切换会话
  const selectSession = useCallback(async (sessionId: string) => {
    setActiveSessionId(sessionId)
    saveLastSession(sessionId)
  }, [])

  // 创建会话
  const createSession = useCallback(async (projectPath?: string, model?: string): Promise<SessionInfo | null> => {
    try {
      const session = await ipcClient.createSession(projectPath, model)
      await loadSessions()
      return session
    } catch (error) {
      console.error('创建会话失败:', error)
      return null
    }
  }, [loadSessions])

  // 删除会话
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await ipcClient.deleteSession(sessionId)
      messagesCacheRef.current.delete(sessionId)
      
      if (activeSessionId === sessionId) {
        setActiveSessionId(null)
      }
      
      await loadSessions()
    } catch (error) {
      console.error('删除会话失败:', error)
    }
  }, [activeSessionId, loadSessions])

  // 重命名会话
  const renameSession = useCallback(async (sessionId: string, newName: string) => {
    try {
      await ipcClient.renameSession(sessionId, newName)
      await loadSessions()
    } catch (error) {
      console.error('重命名会话失败:', error)
    }
  }, [loadSessions])

  // 初始化：加载会话列表
  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  // 恢复上次会话
  useEffect(() => {
    if (projects.length > 0 && !activeSessionId) {
      const lastSessionId = loadLastSession()
      if (lastSessionId) {
        const sessionExists = projects.some(p => p.sessions.some(s => s.id === lastSessionId))
        if (sessionExists) {
          selectSession(lastSessionId)
        }
      }
    }
  }, [projects, activeSessionId, selectSession])

  return {
    projects,
    activeSessionId,
    isLoading,
    loadSessions,
    selectSession,
    createSession,
    deleteSession,
    renameSession,
    messagesCache: messagesCacheRef.current,
  }
}
```

**Step 2: Commit**

```bash
git add src/renderer/hooks/useSessions.ts
git commit -m "feat: 提取 useSessions Hook"
```

---

### Task 1.2: 创建 useModels Hook

**Files:**
- Create: `src/renderer/hooks/useModels.ts`
- Modify: `src/App.tsx` (后续任务)

**Step 1: 创建 Hook**

```typescript
// src/renderer/hooks/useModels.ts
import { useState, useCallback, useEffect } from 'react'
import type { ModelInfo } from '@/shared/types'
import { useModelContext } from '@/renderer/contexts/ModelContext'

// localStorage key
const SELECTED_MODEL_KEY = 'pair-selected-model'

function loadPersistedModel(): string | null {
  try {
    return localStorage.getItem(SELECTED_MODEL_KEY)
  } catch {
    return null
  }
}

function savePersistedModel(modelId: string) {
  try {
    localStorage.setItem(SELECTED_MODEL_KEY, modelId)
  } catch {
    // ignore
  }
}

export function useModels() {
  const { getEnabledModels, modelConfigs } = useModelContext()
  const [models, setModels] = useState<ModelInfo[]>([])
  const [currentModelId, setCurrentModelId] = useState<string>(() => {
    return loadPersistedModel() || ''
  })

  // 当前模型
  const currentModel = models.find((m) => m.id === currentModelId) || models[0] || null

  // 加载模型列表
  const loadModels = useCallback(() => {
    try {
      const contextModels = getEnabledModels()
      
      if (contextModels.length > 0) {
        const modelInfos: ModelInfo[] = contextModels.map(m => ({
          id: m.id,
          name: m.name,
          provider: m.provider,
        }))
        setModels(modelInfos)
        
        // 如果当前模型不在列表中，选择第一个
        if (!modelInfos.find(m => m.id === currentModelId)) {
          setCurrentModelId(modelInfos[0].id)
        }
      } else {
        setModels([])
      }
    } catch (error) {
      console.error('加载模型列表失败:', error)
      setModels([])
    }
  }, [getEnabledModels, currentModelId])

  // 切换模型
  const selectModel = useCallback((modelId: string) => {
    setCurrentModelId(modelId)
    savePersistedModel(modelId)
  }, [])

  // 监听模型配置变化
  useEffect(() => {
    loadModels()
  }, [loadModels, modelConfigs])

  return {
    models,
    currentModel,
    currentModelId,
    selectModel,
    loadModels,
  }
}
```

**Step 2: Commit**

```bash
git add src/renderer/hooks/useModels.ts
git commit -m "feat: 提取 useModels Hook"
```

---

### Task 1.3: 创建 useMessages Hook

**Files:**
- Create: `src/renderer/hooks/useMessages.ts`
- Modify: `src/App.tsx` (后续任务)

**Step 1: 创建 Hook**

```typescript
// src/renderer/hooks/useMessages.ts
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

  // 刷新流缓冲区
  const flushStreamBuffer = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    
    const now = Date.now()
    const timeSinceLastUpdate = now - lastUpdateRef.current
    
    if (timeSinceLastUpdate < 16) {
      rafIdRef.current = requestAnimationFrame(() => {
        flushStreamBuffer()
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
  }, [])

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
      
      streamBufferRef.current += event.text
      flushStreamBuffer()
    })

    // thinking_delta
    const unsubThinkingDelta = ipcClient.onThinkingDelta((event: ThinkingDeltaEvent) => {
      if (event.sessionId !== sessionId) return
      
      streamThinkingBufferRef.current += event.thinking
      flushStreamBuffer()
    })

    // message_end
    const unsubMessageEnd = ipcClient.onMessageEnd((event: MessageEndEvent) => {
      if (event.sessionId !== sessionId) return
      
      flushStreamBuffer()
      
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
                status: event.error ? 'error' as const : 'success' as const,
                result: event.result,
                error: event.error,
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
  }, [sessionId, flushStreamBuffer])

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
```

**Step 2: Commit**

```bash
git add src/renderer/hooks/useMessages.ts
git commit -m "feat: 提取 useMessages Hook"
```

---

## 阶段 2: 拆分 ChatArea 组件

### Task 2.1: 创建 ThinkingBlock 组件

**Files:**
- Create: `src/renderer/components/chat/ThinkingBlock.tsx`
- Test: `src/renderer/__tests__/components/chat/ThinkingBlock.test.tsx`

**Step 1: 创建组件**

```typescript
// src/renderer/components/chat/ThinkingBlock.tsx
import { useState } from 'react'
import { Brain, ChevronDown } from 'lucide-react'
import { cn } from '@/renderer/lib/utils'

interface ThinkingBlockProps {
  thinking: string
  isStreaming?: boolean
  defaultExpanded?: boolean
}

export function ThinkingBlock({ thinking, isStreaming, defaultExpanded = false }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  
  return (
    <div className="mb-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Brain size={14} className={cn(isStreaming && 'animate-pulse')} />
        <span>Thinking</span>
        <ChevronDown 
          size={12} 
          className={cn(
            'transition-transform',
            isExpanded && 'rotate-180'
          )} 
        />
      </button>
      
      {isExpanded && (
        <div className="mt-1.5 pl-5 text-sm text-muted-foreground border-l-2 border-muted">
          <div className="whitespace-pre-wrap">{thinking}</div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/renderer/components/chat/ThinkingBlock.tsx
git commit -m "feat: 提取 ThinkingBlock 组件"
```

---

### Task 2.2: 创建 ToolCallPanel 组件

**Files:**
- Create: `src/renderer/components/chat/ToolCallPanel.tsx`
- Modify: `src/renderer/components/ChatArea.tsx` (后续任务)

**Step 1: 创建组件**

```typescript
// src/renderer/components/chat/ToolCallPanel.tsx
import { useState } from 'react'
import { 
  Wrench, 
  ChevronDown, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  Copy,
  Check 
} from 'lucide-react'
import { cn } from '@/renderer/lib/utils'
import type { ToolCall } from '@/shared/types'

interface ToolCallPanelProps {
  toolCalls: ToolCall[]
  isStreaming?: boolean
  defaultExpanded?: boolean
}

function getStatusIcon(status: ToolCall['status']) {
  switch (status) {
    case 'pending':
    case 'running':
      return <Loader2 size={14} className="animate-spin text-blue-500" />
    case 'success':
      return <CheckCircle2 size={14} className="text-green-500" />
    case 'error':
      return <XCircle size={14} className="text-red-500" />
  }
}

function getStatusText(status: ToolCall['status']) {
  switch (status) {
    case 'pending':
      return '等待中'
    case 'running':
      return '执行中'
    case 'success':
      return '完成'
    case 'error':
      return '失败'
  }
}

export function ToolCallPanel({ toolCalls, isStreaming, defaultExpanded = false }: ToolCallPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  
  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }
  
  const runningCount = toolCalls.filter(tc => tc.status === 'running').length
  const completedCount = toolCalls.filter(tc => tc.status === 'success').length
  
  return (
    <div className="mt-2 border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-muted/50 hover:bg-muted transition-colors text-sm"
      >
        <Wrench size={14} />
        <span className="font-medium">
          工具调用 ({toolCalls.length})
        </span>
        {isStreaming && runningCount > 0 && (
          <span className="text-blue-500 text-xs">
            {runningCount} 个执行中
          </span>
        )}
        {!isStreaming && completedCount > 0 && (
          <span className="text-green-500 text-xs">
            {completedCount} 个完成
          </span>
        )}
        <ChevronDown 
          size={14} 
          className={cn(
            'ml-auto transition-transform',
            isExpanded && 'rotate-180'
          )} 
        />
      </button>
      
      {isExpanded && (
        <div className="divide-y">
          {toolCalls.map((toolCall) => (
            <div key={toolCall.id} className="px-3 py-2">
              <div className="flex items-center gap-2">
                {getStatusIcon(toolCall.status)}
                <span className="font-mono text-sm">{toolCall.name}</span>
                <span className="text-xs text-muted-foreground">
                  {getStatusText(toolCall.status)}
                </span>
              </div>
              
              {/* 参数 */}
              {toolCall.args && Object.keys(toolCall.args).length > 0 && (
                <div className="mt-1.5 pl-6">
                  <div className="text-xs text-muted-foreground mb-1">参数:</div>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                    {JSON.stringify(toolCall.args, null, 2)}
                  </pre>
                </div>
              )}
              
              {/* 结果 */}
              {toolCall.result && (
                <div className="mt-1.5 pl-6">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <span>结果:</span>
                    <button
                      onClick={() => handleCopy(toolCall.result!, toolCall.id)}
                      className="hover:text-foreground"
                    >
                      {copiedId === toolCall.id ? <Check size={10} /> : <Copy size={10} />}
                    </button>
                  </div>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-40">
                    {toolCall.result}
                  </pre>
                </div>
              )}
              
              {/* 错误 */}
              {toolCall.error && (
                <div className="mt-1.5 pl-6">
                  <div className="text-xs text-red-500 mb-1">错误:</div>
                  <pre className="text-xs bg-red-500/10 p-2 rounded text-red-500 overflow-x-auto">
                    {toolCall.error}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/renderer/components/chat/ToolCallPanel.tsx
git commit -m "feat: 提取 ToolCallPanel 组件"
```

---

### Task 2.3: 创建 ChatInput 组件

**Files:**
- Create: `src/renderer/components/chat/ChatInput.tsx`
- Modify: `src/renderer/components/ChatArea.tsx` (后续任务)

**Step 1: 创建组件**

```typescript
// src/renderer/components/chat/ChatInput.tsx
import { useState, useRef, useCallback } from 'react'
import { ArrowUp, StopCircle, Mic, Paperclip, Brain } from 'lucide-react'
import { Button } from '@/renderer/components/ui/button'
import { cn } from '@/renderer/lib/utils'
import type { ModelInfo } from '@/shared/types'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/renderer/components/ui/dropdown-menu'

interface ChatInputProps {
  currentModel: ModelInfo
  models: ModelInfo[]
  isStreaming?: boolean
  onSend: (text: string) => void
  onAbort: () => void
  onSelectModel: (modelId: string) => void
}

export function ChatInput({ 
  currentModel, 
  models, 
  isStreaming, 
  onSend, 
  onAbort,
  onSelectModel 
}: ChatInputProps) {
  const [inputText, setInputText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const handleSend = useCallback(() => {
    if (!inputText.trim() || isStreaming) return
    onSend(inputText)
    setInputText('')
    
    // 重置 textarea 高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [inputText, isStreaming, onSend])
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])
  
  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value)
    
    // 自动调整高度
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
  }, [])
  
  return (
    <div className="border-t bg-background p-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-2 bg-muted rounded-xl p-2">
          {/* 附件按钮 */}
          <Button variant="ghost" size="icon" className="shrink-0">
            <Paperclip size={18} />
          </Button>
          
          {/* 输入框 */}
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            className="flex-1 bg-transparent resize-none outline-none min-h-[24px] max-h-[200px] py-1"
            rows={1}
          />
          
          {/* 发送/停止按钮 */}
          {isStreaming ? (
            <Button 
              variant="destructive" 
              size="icon" 
              onClick={onAbort}
              className="shrink-0"
            >
              <StopCircle size={18} />
            </Button>
          ) : (
            <Button 
              size="icon" 
              onClick={handleSend}
              disabled={!inputText.trim()}
              className="shrink-0"
            >
              <ArrowUp size={18} />
            </Button>
          )}
        </div>
        
        {/* 底部工具栏 */}
        <div className="flex items-center gap-2 mt-2 px-1">
          {/* 模型选择 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                <Brain size={12} />
                {currentModel?.name || '选择模型'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {models.map((model) => (
                <DropdownMenuItem 
                  key={model.id}
                  onClick={() => onSelectModel(model.id)}
                  className={cn(
                    currentModel?.id === model.id && 'bg-accent'
                  )}
                >
                  <div>
                    <div className="font-medium">{model.name}</div>
                    <div className="text-xs text-muted-foreground">{model.provider}</div>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* 语音按钮 */}
          <Button variant="ghost" size="icon" className="ml-auto">
            <Mic size={16} />
          </Button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/renderer/components/chat/ChatInput.tsx
git commit -m "feat: 提取 ChatInput 组件"
```

---

### Task 2.4: 创建 MessageList 组件

**Files:**
- Create: `src/renderer/components/chat/MessageList.tsx`
- Modify: `src/renderer/components/ChatArea.tsx` (后续任务)

**Step 1: 创建组件**

```typescript
// src/renderer/components/chat/MessageList.tsx
import { useRef, useCallback, useEffect, useState } from 'react'
import { ArrowDown } from 'lucide-react'
import { Button } from '@/renderer/components/ui/button'
import { cn } from '@/renderer/lib/utils'
import type { Message } from '@/shared/types'
import { MessageGroup } from './MessageGroup'
import { useMessageSettings } from '@/renderer/contexts/MessageSettingsContext'

interface MessageListProps {
  messages: Message[]
  modelName?: string
  isStreaming?: boolean
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

// 消息分组函数
interface MessageGroup {
  role: 'user' | 'assistant' | 'system'
  messages: Message[]
}

function groupMessages(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = []
  
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
```

**Step 2: Commit**

```bash
git add src/renderer/components/chat/MessageList.tsx
git commit -m "feat: 提取 MessageList 组件"
```

---

### Task 2.5: 创建 MessageGroup 组件

**Files:**
- Create: `src/renderer/components/chat/MessageGroup.tsx`
- Modify: `src/renderer/components/ChatArea.tsx` (后续任务)

**Step 1: 创建组件**

```typescript
// src/renderer/components/chat/MessageGroup.tsx
import { useState, memo, useMemo } from 'react'
import { Copy, Check } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Button } from '@/renderer/components/ui/button'
import { cn, formatTimestamp } from '@/renderer/lib/utils'
import type { Message } from '@/shared/types'
import { useMessageSettings } from '@/renderer/contexts/MessageSettingsContext'
import { ThinkingBlock } from './ThinkingBlock'
import { ToolCallPanel } from './ToolCallPanel'

interface MessageGroupProps {
  role: 'user' | 'assistant' | 'system'
  messages: Message[]
  modelName?: string
  showTimestamp?: boolean
}

// Memoized Markdown 组件
const MemoizedMarkdown = memo(function MemoizedMarkdown({ 
  content, 
  isStreaming 
}: { 
  content: string
  isStreaming?: boolean 
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
    >
      {content}
    </ReactMarkdown>
  )
})

export function MessageGroup({ role, messages, modelName, showTimestamp }: MessageGroupProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const { settings } = useMessageSettings()
  
  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }
  
  // 判断是否是流式消息（取最后一个）
  const lastMessage = messages[messages.length - 1]
  const isGroupStreaming = lastMessage.isStreaming
  
  if (role === 'user') {
    // 用户消息 - 右对齐
    return (
      <div className="grid grid-cols-[1fr_36px] gap-3">
        <div className="max-w-[80%] ml-auto">
          {messages.map((message) => (
            <div 
              key={message.id}
              className="group relative bg-primary text-primary-foreground rounded-2xl px-4 py-2"
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100"
                onClick={() => handleCopy(message.content, message.id)}
              >
                {copiedId === message.id ? <Check size={12} /> : <Copy size={12} />}
              </Button>
            </div>
          ))}
          {showTimestamp && (
            <div className="text-[10px] text-muted-foreground mt-1 text-right px-1">
              {formatTimestamp(lastMessage.timestamp)}
            </div>
          )}
        </div>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border bg-muted border-border">
          <span className="text-sm">👤</span>
        </div>
      </div>
    )
  }
  
  // 助手消息 - 左对齐
  return (
    <div className="grid grid-cols-[36px_1fr] gap-3">
      {/* 头像 */}
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border bg-muted border-border">
        <span className="text-sm">🤖</span>
      </div>
      
      {/* 消息内容 */}
      <div className="max-w-[80%] min-w-0">
        {/* 角色标注 */}
        <div className="text-[11px] font-medium mb-1.5 px-1 text-muted-foreground">
          {modelName || 'AI 助手'}
        </div>
        
        {/* 多条消息堆叠 */}
        <div className="space-y-2">
          {messages.map((message) => {
            const isStreamingMsg = message.isStreaming
            const hasContent = message.content.length > 0
            const hasThinking = !!message.thinking && message.thinking.length > 0
            const hasToolCalls = message.toolCalls && message.toolCalls.length > 0
            
            return (
              <div key={message.id}>
                {/* Thinking 内容 */}
                {hasThinking && (
                  <ThinkingBlock 
                    thinking={message.thinking!} 
                    isStreaming={isStreamingMsg}
                    defaultExpanded={settings.thinkingDefaultExpanded}
                  />
                )}
                
                <div className={cn('group relative', 'text-foreground px-1')}>
                  {/* 正文内容 */}
                  {hasContent ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <MemoizedMarkdown content={message.content} isStreaming={isStreamingMsg} />
                    </div>
                  ) : isStreamingMsg && !hasThinking && !hasToolCalls ? (
                    null
                  ) : !hasThinking && !hasToolCalls ? (
                    <div className="min-h-[1.5rem]" />
                  ) : (
                    <div className="min-h-[0.5rem]" />
                  )}
                  
                  {/* 复制按钮 */}
                  {hasContent && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100"
                      onClick={() => handleCopy(message.content, message.id)}
                    >
                      {copiedId === message.id ? <Check size={12} /> : <Copy size={12} />}
                    </Button>
                  )}
                </div>
                
                {/* 工具调用列表 */}
                {hasToolCalls && (
                  <ToolCallPanel
                    toolCalls={message.toolCalls!}
                    isStreaming={isStreamingMsg}
                    defaultExpanded={settings.toolCallsDefaultExpanded}
                  />
                )}
              </div>
            )
          })}
        </div>
        
        {/* 时间戳 */}
        {showTimestamp && !isGroupStreaming && (
          <div className="text-[10px] text-muted-foreground mt-1 px-1">
            {formatTimestamp(lastMessage.timestamp)}
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/renderer/components/chat/MessageGroup.tsx
git commit -m "feat: 提取 MessageGroup 组件"
```

---

### Task 2.6: 重构 ChatArea 使用新组件

**Files:**
- Modify: `src/renderer/components/ChatArea.tsx`

**Step 1: 重写 ChatArea**

```typescript
// src/renderer/components/ChatArea.tsx
import type { Message, ModelInfo } from '@/shared/types'
import { MessageList } from './chat/MessageList'
import { ChatInput } from './chat/ChatInput'

interface ChatAreaProps {
  messages: Message[]
  isStreaming?: boolean
  isLoading?: boolean
  currentModel: ModelInfo
  models: ModelInfo[]
  onSend: (text: string) => void
  onAbort: () => void
  onSelectModel: (modelId: string) => void
}

export function ChatArea({
  messages,
  isStreaming,
  isLoading,
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
```

**Step 2: Commit**

```bash
git add src/renderer/components/ChatArea.tsx
git commit -m "refactor: 重构 ChatArea 使用拆分的子组件"
```

---

## 阶段 3: 重构 App.tsx

### Task 3.1: 创建 ChatPage 组件

**Files:**
- Create: `src/renderer/pages/ChatPage.tsx`
- Modify: `src/App.tsx`

**Step 1: 创建 ChatPage**

```typescript
// src/renderer/pages/ChatPage.tsx
import { ChatArea } from '@/renderer/components/ChatArea'
import { SessionList } from '@/renderer/components/SessionList'
import { Header } from '@/renderer/components/Header'
import { SettingsModal } from '@/renderer/components/SettingsModal'
import { useSessions } from '@/renderer/hooks/useSessions'
import { useMessages } from '@/renderer/hooks/useMessages'
import { useModels } from '@/renderer/hooks/useModels'
import { useState } from 'react'

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
    messagesCache 
  } = useSessions()
  
  const { 
    messages, 
    isLoading, 
    isStreaming, 
    sendMessage, 
    abortMessage 
  } = useMessages({ sessionId: activeSessionId, messagesCache })
  
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
            isLoading={isLoading}
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
```

**Step 2: 更新 App.tsx**

```typescript
// src/App.tsx
import { ModelProvider } from '@/renderer/contexts/ModelContext'
import { MessageSettingsProvider } from '@/renderer/contexts/MessageSettingsContext'
import { ChatPage } from '@/renderer/pages/ChatPage'

function App() {
  return (
    <ModelProvider>
      <MessageSettingsProvider>
        <ChatPage />
      </MessageSettingsProvider>
    </ModelProvider>
  )
}

export default App
```

**Step 3: Commit**

```bash
git add src/renderer/pages/ChatPage.tsx src/App.tsx
git commit -m "refactor: 提取 ChatPage，简化 App.tsx"
```

---

## 阶段 4: 合并弹窗

### Task 4.1: 创建 ModelModal 组件

**Files:**
- Create: `src/renderer/components/modals/ModelModal.tsx`
- Delete: `src/renderer/components/AddModelModal.tsx`
- Delete: `src/renderer/components/EditModelModal.tsx`

**Step 1: 创建统一的 ModelModal**

```typescript
// src/renderer/components/modals/ModelModal.tsx
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/renderer/components/ui/button'
import { Input } from '@/renderer/components/ui/input'
import { cn } from '@/renderer/lib/utils'
import type { ModelConfig } from '@/renderer/contexts/ModelContext'

interface ModelModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'add' | 'edit'
  initialConfig?: Partial<ModelConfig>
  onSave: (config: Omit<ModelConfig, 'id' | 'createdAt'>) => Promise<void>
}

const API_TYPES = [
  { value: 'openai-completions', label: 'OpenAI Compatible' },
  { value: 'anthropic-messages', label: 'Anthropic' },
  { value: 'google-generative-ai', label: 'Google AI' },
]

export function ModelModal({ isOpen, onClose, mode, initialConfig, onSave }: ModelModalProps) {
  const [name, setName] = useState(initialConfig?.name || '')
  const [provider, setProvider] = useState(initialConfig?.provider || '')
  const [baseUrl, setBaseUrl] = useState(initialConfig?.baseUrl || '')
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey || '')
  const [api, setApi] = useState(initialConfig?.api || 'openai-completions')
  const [isEnabled, setIsEnabled] = useState(initialConfig?.isEnabled ?? true)
  const [isSaving, setIsSaving] = useState(false)
  
  useEffect(() => {
    if (isOpen && initialConfig) {
      setName(initialConfig.name || '')
      setProvider(initialConfig.provider || '')
      setBaseUrl(initialConfig.baseUrl || '')
      setApiKey(initialConfig.apiKey || '')
      setApi(initialConfig.api || 'openai-completions')
      setIsEnabled(initialConfig.isEnabled ?? true)
    }
  }, [isOpen, initialConfig])
  
  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave({
        name,
        provider,
        baseUrl,
        apiKey,
        api,
        isEnabled,
        enabledModels: initialConfig?.enabledModels || [],
      })
      onClose()
    } catch (error) {
      console.error('保存模型配置失败:', error)
    } finally {
      setIsSaving(false)
    }
  }
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {mode === 'add' ? '添加模型' : '编辑模型'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        
        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium">名称</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Model"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium">提供商</label>
            <Input
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="OpenAI"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium">API 类型</label>
            <select
              value={api}
              onChange={(e) => setApi(e.target.value)}
              className="w-full p-2 border rounded-md bg-background"
            >
              {API_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="text-sm font-medium">Base URL</label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium">API Key</label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isEnabled"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
            />
            <label htmlFor="isEnabled" className="text-sm">
              启用此模型
            </label>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 p-4 border-t">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: 删除旧文件并 Commit**

```bash
rm src/renderer/components/AddModelModal.tsx
rm src/renderer/components/EditModelModal.tsx
git add src/renderer/components/modals/ModelModal.tsx
git rm src/renderer/components/AddModelModal.tsx src/renderer/components/EditModelModal.tsx
git commit -m "refactor: 合并 Add/Edit ModelModal 为统一组件"
```

---

## 阶段 5: 清理优化

### Task 5.1: 清理冗余代码

**Files:**
- Various files as needed

**Step 1: 检查并删除未使用的代码**

```bash
# 检查是否有未使用的导入
npm run lint

# 运行测试确保功能正常
npm test
```

**Step 2: 统一命名和格式**

```bash
# 格式化代码
npm run lint -- --fix
```

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: 清理冗余代码，统一格式"
```

---

## 验收检查

- [ ] 每个文件不超过 300 行
- [ ] 组件只包含 UI 逻辑，业务逻辑在 Hooks 中
- [ ] 所有 Hooks 可独立测试
- [ ] 功能行为与重构前完全一致
- [ ] 无 TypeScript 错误
- [ ] 所有测试通过
- [ ] Git 提交历史清晰
