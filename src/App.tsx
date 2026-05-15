import { useState, useCallback, useEffect, useRef } from 'react'
import { SessionList } from '@/renderer/components/SessionList'
import { ChatArea } from '@/renderer/components/ChatArea'
import { Header } from '@/renderer/components/Header'
import { TitleBar } from '@/renderer/components/TitleBar'
import { SettingsModal } from '@/renderer/components/SettingsModal'
import type { Message, ProjectSessions, ModelInfo } from '@/shared/types'
import { ipcClient } from '@/renderer/ipc-client'
import type { TextDeltaEvent, ThinkingDeltaEvent, MessageStartEvent, MessageEndEvent, ToolStartEvent, ToolEndEvent } from '@/renderer/ipc-client'
import { useModelContext } from '@/renderer/contexts/ModelContext'

// 默认模型列表（当没有配置模型时显示）
const FALLBACK_MODELS: ModelInfo[] = []

// localStorage key for persisting selected model
const SELECTED_MODEL_KEY = 'pair-selected-model'
const LAST_SESSION_KEY = 'pair-last-session'

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

function App() {
  const { getEnabledModels, modelConfigs } = useModelContext()
  
  // 状态管理
  const [projects, setProjects] = useState<ProjectSessions[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [currentModelId, setCurrentModelId] = useState<string>(() => {
    // 优先使用持久化的模型，否则使用空字符串等待模型列表加载
    return loadPersistedModel() || ''
  })
  const [isStreaming, setIsStreaming] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoadingSession, setIsLoadingSession] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [models, setModels] = useState<ModelInfo[]>(FALLBACK_MODELS)

  // 引用当前流式消息 ID（由后端 message_start 事件分配）
  const streamingMessageRef = useRef<{ id: string } | null>(null)
  
  // 流式内容缓冲区 - 用于批量更新，减少重新渲染
  const streamBufferRef = useRef<string>('')
  const streamThinkingBufferRef = useRef<string>('')
  const rafIdRef = useRef<number | null>(null)
  const lastUpdateRef = useRef<number>(0)

  // 获取当前模型
  const currentModel = models.find((m) => m.id === currentModelId) || models[0]

  // 获取当前会话信息
  const currentSession = projects
    .flatMap(p => p.sessions)
    .find(s => s.id === activeSessionId) || null

  // 主题状态
  const [isDark, setIsDark] = useState(true)

  // 加载会话列表和模型列表
  useEffect(() => {
    loadSessions()
    loadModels()
  }, [getEnabledModels, modelConfigs])

  // 恢复上次的会话
  useEffect(() => {
    if (projects.length > 0 && !activeSessionId) {
      const lastSessionId = loadLastSession()
      if (lastSessionId) {
        // 检查会话是否存在
        const sessionExists = projects.some(p => p.sessions.some(s => s.id === lastSessionId))
        if (sessionExists) {
          handleSelectSession(lastSessionId)
        }
      }
    }
  }, [projects])

  // 设置事件监听器
  useEffect(() => {
    if (!activeSessionId) return
    
    console.log('[App] 注册事件监听器, activeSessionId:', activeSessionId)

    // 批量更新函数 - 使用 requestAnimationFrame 节流
    const flushStreamBuffer = () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      
      const now = Date.now()
      const timeSinceLastUpdate = now - lastUpdateRef.current
      
      // 如果距离上次更新不足 16ms（约60fps），延迟更新
      if (timeSinceLastUpdate < 16) {
        rafIdRef.current = requestAnimationFrame(() => {
          flushStreamBuffer()
        })
        return
      }
      
      lastUpdateRef.current = now
      const bufferedContent = streamBufferRef.current
      const bufferedThinking = streamThinkingBufferRef.current
      
      // 清空缓冲区
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
    
    // 监听流式文本增量
    const unsubscribeTextDelta = ipcClient.onTextDelta((event: TextDeltaEvent) => {
      console.log('[App] 收到 text_delta 事件:', event)
      if (event.sessionId !== activeSessionId) return
      
      // 更新缓冲区而不是直接更新状态
      streamBufferRef.current += event.delta
      
      // 使用 requestAnimationFrame 节流更新
      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(() => {
          flushStreamBuffer()
        })
      }
    })

    // 监听 thinking 增量（Claude 等模型的思考过程）
    const unsubscribeThinkingDelta = ipcClient.onThinkingDelta((event: ThinkingDeltaEvent) => {
      console.log('[App] 收到 thinking_delta 事件:', event)
      if (event.sessionId !== activeSessionId) return
      
      // 更新缓冲区
      streamThinkingBufferRef.current += event.delta
      
      // 使用 requestAnimationFrame 节流更新
      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(() => {
          flushStreamBuffer()
        })
      }
    })

    // 监听消息开始 —— 后端分配了真实消息 ID，更新占位符或创建新消息
    const unsubscribeMessageStart = ipcClient.onMessageStart((event: MessageStartEvent) => {
      console.log('[App] 收到 message_start 事件:', event)
      if (event.sessionId !== activeSessionId) return
      
      streamingMessageRef.current = { id: event.messageId }
      // 重置缓冲区
      streamBufferRef.current = ''
      streamThinkingBufferRef.current = ''
      const now = new Date()
      
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1]
        
        // 如果最后一条是助手消息
        if (lastMessage && lastMessage.role === 'assistant') {
          // 如果 ID 相同，说明是同一个消息的继续
          if (lastMessage.id === event.messageId) {
            return [...prev.slice(0, -1), {
              ...lastMessage,
              isStreaming: true,
            }]
          }
          
          // 如果是空内容的占位符（用户发送后创建的），更新它的 ID
          if (!lastMessage.content && (!lastMessage.toolCalls || lastMessage.toolCalls.length === 0)) {
            return [...prev.slice(0, -1), {
              ...lastMessage,
              id: event.messageId,
              isStreaming: true,
            }]
          }
          
          // 否则是新的消息（比如工具调用后的第二轮），创建新消息
          return [...prev, {
            id: event.messageId,
            role: 'assistant' as const,
            content: '',
            timestamp: now,
            isStreaming: true,
            toolCalls: [],
            streamingStartTime: now,
          }]
        }
        
        // 如果最后一条不是助手消息，创建新的助手消息占位符
        return [...prev, {
          id: event.messageId,
          role: 'assistant' as const,
          content: '',
          timestamp: now,
          isStreaming: true,
          toolCalls: [],
          streamingStartTime: now,
        }]
      })
    })

    // 监听消息结束
    // message_end 表示当前消息块的文本/thinking 内容结束
    // 但工具调用可能还在继续，所以不设置 isStreaming = false
    // isStreaming 只在 turn_end 或 agent_end 时设置为 false
    const unsubscribeMessageEnd = ipcClient.onMessageEnd((event: MessageEndEvent) => {
      console.log('[App] 收到 message_end 事件:', event)
      if (event.sessionId !== activeSessionId) return
      
      // 更新 usage 信息，但不设置 isStreaming = false
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1]
        if (lastMessage && lastMessage.role === 'assistant') {
          return [...prev.slice(0, -1), {
            ...lastMessage,
            usage: event.usage ? {
              promptTokens: event.usage.input,
              completionTokens: event.usage.output,
              totalTokens: event.usage.totalTokens,
              cacheCreationInputTokens: event.usage.cacheWrite,
              cacheReadInputTokens: event.usage.cacheRead,
            } : lastMessage.usage,
            streamingEndTime: new Date(),
            // 不设置 isStreaming = false，等待 turn_end 或 agent_end
          }]
        }
        return prev
      })
      
      streamingMessageRef.current = null
    })

    // 监听工具开始
    // 工具调用可能发生在 message_end 之后，此时需要创建新的助手消息占位符
    const unsubscribeToolStart = ipcClient.onToolStart((event: ToolStartEvent) => {
      console.log('[App] 收到 tool_start 事件:', event)
      if (event.sessionId !== activeSessionId) return
      
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1]
        const toolCall = {
          id: event.toolCallId,
          name: event.toolName,
          args: event.args,
          status: 'running' as const,
          startTime: new Date(),
        }
        
        // 如果最后一条是助手消息且正在流式传输，添加工具调用到它
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
          return [...prev.slice(0, -1), {
            ...lastMessage,
            toolCalls: [...(lastMessage.toolCalls || []), toolCall],
          }]
        }
        
        // 如果最后一条是助手消息但已完成（message_end 之后），创建新的助手消息
        // 或者如果最后一条不是助手消息，也创建新的助手消息
        return [...prev, {
          id: `msg-assistant-${Date.now()}`,
          role: 'assistant' as const,
          content: '',
          timestamp: new Date(),
          isStreaming: true,
          toolCalls: [toolCall],
          streamingStartTime: new Date(),
        }]
      })
    })

    // 监听工具结束
    const unsubscribeToolEnd = ipcClient.onToolEnd((event: ToolEndEvent) => {
      console.log('[App] 收到 tool_end 事件:', event)
      if (event.sessionId !== activeSessionId) return
      
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1]
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.toolCalls) {
          const updatedToolCalls = lastMessage.toolCalls.map(tool => 
            tool.id === event.toolCallId 
              ? { 
                  ...tool, 
                  status: event.isError ? 'error' as const : 'success' as const,
                  result: event.result,
                  endTime: new Date(),
                }
              : tool
          )
          
          return [...prev.slice(0, -1), {
            ...lastMessage,
            toolCalls: updatedToolCalls,
          }]
        }
        return prev
      })
    })

    // 监听代理状态
    const unsubscribeAgentStart = ipcClient.onAgentStart((event) => {
      console.log('[App] 收到 agent_start 事件:', event)
      if (event.sessionId !== activeSessionId) return
      setIsStreaming(true)
    })

    // agent_end 表示整个 agent turn 结束，此时才设置 isStreaming 为 false
    const unsubscribeAgentEnd = ipcClient.onAgentEnd((event) => {
      console.log('[App] 收到 agent_end 事件:', event)
      if (event.sessionId !== activeSessionId) return
      
      // 确保最后一条消息的 isStreaming 被设置为 false
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1]
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
          return [...prev.slice(0, -1), {
            ...lastMessage,
            isStreaming: false,
          }]
        }
        return prev
      })
      
      setIsStreaming(false)
      streamingMessageRef.current = null
    })

    // 清理函数
    return () => {
      unsubscribeTextDelta()
      unsubscribeThinkingDelta()
      unsubscribeMessageStart()
      unsubscribeMessageEnd()
      unsubscribeToolStart()
      unsubscribeToolEnd()
      unsubscribeAgentStart()
      unsubscribeAgentEnd()
    }
  }, [activeSessionId])

  // 加载模型列表
  const loadModels = () => {
    try {
      // 从上下文获取已配置的模型
      const contextModels = getEnabledModels()
      
      if (contextModels.length > 0) {
        const modelInfos: ModelInfo[] = contextModels.map(m => ({
          id: m.id,
          name: m.name,
          provider: m.provider,
        }))
        setModels(modelInfos)
        if (!modelInfos.find(m => m.id === currentModelId)) {
          setCurrentModelId(modelInfos[0].id)
        }
      } else {
        // 没有配置模型时显示空列表
        setModels([])
      }
    } catch (error) {
      console.error('加载模型列表失败:', error)
      setModels([])
    }
  }

  // 加载会话列表
  const loadSessions = async () => {
    try {
      const sessions = await ipcClient.listSessions()
      setProjects(sessions)
      
      // 如果没有会话，创建一个默认项目
      if (sessions.length === 0) {
        // 可以选择自动创建会话或等待用户创建
      }
    } catch (error) {
      console.error('加载会话列表失败:', error)
    }
  }

  // 消息缓存 - 避免重复 IPC 请求
  const messagesCacheRef = useRef<Map<string, Message[]>>(new Map())

  // 切换会话
  const handleSelectSession = useCallback(async (sessionId: string) => {
    // 1. 立即切换会话 ID（触发 UI 更新选中态）
    setActiveSessionId(sessionId)
    saveLastSession(sessionId)
    
    // 2. 检查缓存，如果有缓存直接使用
    const cached = messagesCacheRef.current.get(sessionId)
    if (cached) {
      setMessages(cached)
      setIsLoadingSession(false)
      return
    }
    
    // 3. 没有缓存，显示 loading 并异步加载
    setMessages([])
    setIsLoadingSession(true)
    
    try {
      const historyMessages = await ipcClient.getSessionMessages(sessionId)
      // 只在 sessionId 仍然匹配时才更新（防止快速切换时旧请求覆盖新数据）
      setActiveSessionId(current => {
        if (current === sessionId) {
          setMessages(historyMessages)
          setIsLoadingSession(false)
        }
        return current
      })
      // 缓存消息
      messagesCacheRef.current.set(sessionId, historyMessages)
    } catch (error) {
      console.error('加载会话消息失败:', error)
      setActiveSessionId(current => {
        if (current === sessionId) {
          setMessages([])
          setIsLoadingSession(false)
        }
        return current
      })
    }
  }, [])

  // 新建工作区（选择文件夹后创建新项目和会话）
  const handleNewSession = useCallback(async (projectPath: string) => {
    try {
      // 创建新会话
      const sessionInfo = await ipcClient.createSession({
        projectPath: projectPath,
        name: `新会话 ${new Date().toLocaleTimeString()}`,
        modelId: currentModelId,
      })
      
      // 更新会话列表
      await loadSessions()
      
      // 激活新会话
      setActiveSessionId(sessionInfo.id)
      setMessages([])
    } catch (error) {
      console.error('创建会话失败:', error)
    }
  }, [currentModelId])

  // 在指定项目下新建会话
  const handleNewSessionInProject = useCallback(async (projectPath: string) => {
    try {
      // 在指定项目下创建新会话
      const sessionInfo = await ipcClient.createSession({
        projectPath: projectPath,
        name: `新会话 ${new Date().toLocaleTimeString()}`,
        modelId: currentModelId,
      })
      
      // 更新会话列表
      await loadSessions()
      
      // 激活新会话
      setActiveSessionId(sessionInfo.id)
      setMessages([])
    } catch (error) {
      console.error('创建会话失败:', error)
    }
  }, [currentModelId])

  // 删除会话
  const handleDeleteSession = useCallback(async (sessionId: string) => {
    try {
      await ipcClient.deleteSession(sessionId)
      
      // 清除该会话的消息缓存
      messagesCacheRef.current.delete(sessionId)
      
      // 如果删除的是当前会话，清空状态
      if (sessionId === activeSessionId) {
        setActiveSessionId(null)
        setMessages([])
      }
      
      // 重新加载会话列表
      await loadSessions()
    } catch (error) {
      console.error('删除会话失败:', error)
    }
  }, [activeSessionId])

  // 重命名会话
  const handleRenameSession = useCallback(async (sessionId: string, newName: string) => {
    try {
      await ipcClient.updateSession(sessionId, { name: newName })
      // 重新加载会话列表以更新 UI
      await loadSessions()
    } catch (error) {
      console.error('重命名会话失败:', error)
    }
  }, [])

  // 发送消息
  const handleSend = useCallback(async (text: string) => {
    if (!activeSessionId) {
      // 如果没有活跃会话，先创建一个（使用默认路径）
      await handleNewSession('/default/project')
      // 等待状态更新
      return
    }
    
    const now = new Date()
    
    // 添加用户消息到界面
    const userMessage: Message = {
      id: `msg-user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: now,
    }
    
    // 立即创建助手消息占位符 —— 用户发送后马上看到 agent working 状态
    const assistantPlaceholder: Message = {
      id: `msg-assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: now,
      isStreaming: true,
      toolCalls: [],
    }
    
    // 清除当前会话的消息缓存（因为会有新消息）
    if (activeSessionId) {
      messagesCacheRef.current.delete(activeSessionId)
    }
    
    setMessages(prev => [...prev, userMessage, assistantPlaceholder])
    setIsStreaming(true)
    console.log('[App] 发送消息, activeSessionId:', activeSessionId, 'text:', text)
    
    // 调用后端发送消息，传递当前选中的模型配置
    try {
      // 从 modelConfigs 中找到当前模型的完整配置
      const currentModelConfig = modelConfigs.find(config => 
        config.isEnabled && config.enabledModels.includes(currentModelId)
      )
      
      let modelConfigToSend: string | { provider: string; baseUrl: string; apiKey: string; modelId: string; api?: string } = currentModelId
      
      // 如果找到完整配置，直接传递给后端（不依赖 ModelRegistry）
      if (currentModelConfig) {
        modelConfigToSend = {
          provider: currentModelConfig.provider,
          baseUrl: currentModelConfig.baseUrl,
          apiKey: currentModelConfig.apiKey,
          modelId: currentModelId,
          api: currentModelConfig.api,
        }
      }
      
      await ipcClient.sendMessage(activeSessionId, text, modelConfigToSend)
    } catch (error) {
      console.error('发送消息失败:', error)
      // 将占位符替换为错误消息
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1]
        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isStreaming) {
          return [...prev.slice(0, -1), {
            ...lastMsg,
            content: `发送失败: ${error instanceof Error ? error.message : '未知错误'}`,
            isStreaming: false,
          }]
        }
        return [...prev, {
          id: `msg-error-${Date.now()}`,
          role: 'system' as const,
          content: `发送失败: ${error instanceof Error ? error.message : '未知错误'}`,
          timestamp: new Date(),
        }]
      })
      setIsStreaming(false)
    }
  }, [activeSessionId, handleNewSession, currentModelId])

  // 停止生成
  const handleAbort = useCallback(async () => {
    if (!activeSessionId) return
    
    try {
      await ipcClient.abortMessage(activeSessionId)
      // 将最后一条流式消息标记为完成
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1]
        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isStreaming) {
          return [...prev.slice(0, -1), { ...lastMsg, isStreaming: false }]
        }
        return prev
      })
      setIsStreaming(false)
    } catch (error) {
      console.error('停止生成失败:', error)
    }
  }, [activeSessionId])

  // 重试
  const handleRetry = useCallback(async () => {
    if (!activeSessionId || messages.length === 0) return
    
    // 获取最后一条用户消息
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
    if (lastUserMessage) {
      await handleSend(lastUserMessage.content)
    }
  }, [activeSessionId, messages, handleSend])

  // 选择模型
  const handleSelectModel = useCallback((modelId: string) => {
    setCurrentModelId(modelId)
    savePersistedModel(modelId)
    
    if (activeSessionId) {
      // 从 modelConfigs 中找到当前模型的完整配置
      const currentModelConfig = modelConfigs.find(config => 
        config.isEnabled && config.enabledModels.includes(modelId)
      )
      
      let modelConfigToSend: string | { provider: string; baseUrl: string; apiKey: string; modelId: string; api?: string } = modelId
      
      // 如果找到完整配置，直接传递给后端（不依赖 ModelRegistry）
      if (currentModelConfig) {
        modelConfigToSend = {
          provider: currentModelConfig.provider,
          baseUrl: currentModelConfig.baseUrl,
          apiKey: currentModelConfig.apiKey,
          modelId: modelId,
          api: currentModelConfig.api,
        }
      }
      
      ipcClient.setModel(activeSessionId, modelId, modelConfigToSend).catch(console.error)
    }
  }, [activeSessionId, modelConfigs])

  // 切换主题
  const handleToggleTheme = useCallback(() => {
    setIsDark(prev => !prev)
    // 这里可以添加实际的主题切换逻辑
  }, [])

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background text-foreground">
      {/* 独立的窗口标题栏 - 固定在最顶部 */}
      <TitleBar />
      
      {/* 主体内容区域 */}
      <div className="flex-1 flex overflow-hidden p-2 gap-2">
        {/* 侧边栏 */}
        <aside className="w-64 bg-sidebar rounded-2xl flex flex-col shadow-sm shrink-0">
          <SessionList
            projects={projects}
            activeSessionId={activeSessionId || undefined}
            onSelectSession={handleSelectSession}
            onNewSession={handleNewSession}
            onNewSessionInProject={handleNewSessionInProject}
            onDeleteSession={handleDeleteSession}
            onRenameSession={handleRenameSession}
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
            isLoading={isLoadingSession}
            currentModel={currentModel}
            models={models}
            onSend={handleSend}
            onAbort={handleAbort}
            onRetry={handleRetry}
            onSelectModel={handleSelectModel}
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

export default App
