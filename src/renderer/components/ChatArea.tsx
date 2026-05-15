import { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react'
import {
  Paperclip,
  FolderOpen,
  Mic,
  Brain,
  Zap,
  Eye,
  Copy,
  Check,
  ChevronDown,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Wrench,
  StopCircle,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/renderer/components/ui/dropdown-menu'
import { Button } from '@/renderer/components/ui/button'
import { ScrollArea } from '@/renderer/components/ui/scroll-area'
import { cn, formatTimestamp } from '@/renderer/lib/utils'
import type { Message, ToolCall, ModelInfo, Usage } from '@/shared/types'
import { useMessageSettings } from '@/renderer/contexts/MessageSettingsContext'

interface ChatAreaProps {
  messages: Message[]
  isStreaming?: boolean
  isLoading?: boolean
  currentModel: ModelInfo
  models: ModelInfo[]
  onSend: (text: string) => void
  onAbort: () => void
  onRetry: () => void
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
  onRetry: _onRetry,
  onSelectModel,
}: ChatAreaProps) {
  const [inputText, setInputText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [showScrollButtons, setShowScrollButtons] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [isAtTop, setIsAtTop] = useState(true)
  
  // 滚动节流 - 避免频繁调用 scrollIntoView
  const scrollRafRef = useRef<number | null>(null)
  const lastScrollTimeRef = useRef<number>(0)

  // 监听滚动事件
  const handleScroll = useCallback(() => {
    const container = viewportRef.current
    if (!container) return
    
    const { scrollTop, scrollHeight, clientHeight } = container
    const isBottom = scrollHeight - scrollTop - clientHeight < 50
    const isTop = scrollTop < 50
    
    setIsAtBottom(isBottom)
    setIsAtTop(isTop)
    setShowScrollButtons(!isBottom || !isTop)
  }, [])

  useEffect(() => {
    const container = viewportRef.current
    if (!container) return
    
    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // 优化的滚动到底部函数 - 使用节流
  const scrollToBottomSmooth = useCallback(() => {
    if (scrollRafRef.current) {
      cancelAnimationFrame(scrollRafRef.current)
    }
    
    const now = Date.now()
    const timeSinceLastScroll = now - lastScrollTimeRef.current
    
    // 节流：至少间隔 50ms 才滚动一次
    if (timeSinceLastScroll < 50) {
      scrollRafRef.current = requestAnimationFrame(() => {
        scrollToBottomSmooth()
      })
      return
    }
    
    lastScrollTimeRef.current = now
    
    // 使用 instant 行为避免平滑滚动动画导致的抖动
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [])

  useEffect(() => {
    // 只在用户已经在底部时自动滚动
    if (isAtBottom) {
      scrollToBottomSmooth()
    }
  }, [messages, isAtBottom, scrollToBottomSmooth])

  // 监听 Escape 键中断生成
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isStreaming) {
        e.preventDefault()
        onAbort()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isStreaming, onAbort])

  // 滚动到顶部
  const scrollToTop = () => {
    viewportRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSend = () => {
    if (inputText.trim() && !isStreaming) {
      onSend(inputText.trim())
      setInputText('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    // 在输入框中按 Escape 也可以中断生成
    if (e.key === 'Escape' && isStreaming) {
      e.preventDefault()
      onAbort()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value)
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
  }

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* 消息区域 */}
      <ScrollArea className="flex-1" viewportRef={viewportRef}>
        <div className="p-4 space-y-4">
          {isLoading ? (
            <LoadingSessionState />
          ) : messages.length === 0 ? (
            <EmptyState />
          ) : (
            (() => {
              const groups = groupMessages(messages)
              return groups.map((group, groupIndex) => (
                group.role === 'user' ? (
                  // 用户消息：每个都独立显示
                  group.messages.map((message, index) => (
                    <MessageBubble 
                      key={message.id} 
                      message={message} 
                      modelName={currentModel?.name}
                      isLastMessage={groupIndex === groups.length - 1 && index === group.messages.length - 1}
                    />
                  ))
                ) : (
                  // 助手消息：同组只显示一个头像
                  <AssistantMessageGroup
                    key={`group-${groupIndex}`}
                    messages={group.messages}
                    modelName={currentModel?.name}
                  />
                )
              ))
            })()
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* 浮动滚动按钮 */}
      {showScrollButtons && (
        <div className="absolute right-4 bottom-28 flex flex-col gap-2 z-10">
          {/* 滚动到顶部按钮 */}
          {!isAtTop && (
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full shadow-lg bg-white/90 backdrop-blur-sm border-border hover:bg-muted"
              onClick={scrollToTop}
              title="滚动到顶部"
            >
              <ArrowUp size={16} />
            </Button>
          )}
          {/* 滚动到底部按钮 */}
          {!isAtBottom && (
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full shadow-lg bg-white/90 backdrop-blur-sm border-border hover:bg-muted"
              onClick={scrollToBottom}
              title="滚动到底部"
            >
              <ArrowDown size={16} />
            </Button>
          )}
        </div>
      )}

      {/* 输入区域 - 专业布局 */}
      <div className="p-4 bg-background">
        <div className="rounded-3xl border border-border bg-input shadow-sm overflow-hidden">
          {/* 输入框区域 */}
          <div className="p-4">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={isStreaming ? "AI 正在生成中... 按 Esc 中断生成" : "输入消息... (Enter 发送, Shift+Enter 换行, @ 引用文件, / 调用 Skill, # 调用 MCP, & 引用会话)"}
              className="w-full min-h-[80px] max-h-[200px] resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground leading-relaxed"
              rows={3}
              disabled={isStreaming}
            />
          </div>

          {/* 底部工具栏 */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border relative z-10">
            {/* 左侧：模型选择 + 功能按钮 */}
            <div className="flex items-center gap-1">
              {/* 模型选择 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 h-7 px-2.5 text-xs font-medium bg-white border-border hover:bg-muted">
                    <div className="w-3.5 h-3.5 bg-primary rounded-sm flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                    </div>
                    <span>{currentModel?.name || '未选择模型'}</span>
                    <ChevronDown size={10} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent sideOffset={5} align="start">
                  {models.length > 0 ? (
                    models.map((model) => (
                      <DropdownMenuItem
                        key={model.id}
                        className={cn(
                          'text-xs',
                          model.id === currentModel?.id && 'bg-accent text-accent-foreground'
                        )}
                        onSelect={() => onSelectModel(model.id)}
                      >
                        <span className="font-medium">{model.name}</span>
                        <span className="ml-auto text-[10px] text-muted-foreground">{model.provider}</span>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                      请先在设置中配置模型
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* 分隔线 */}
              <div className="w-px h-4 bg-border mx-1" />

              {/* 快速模式 */}
              <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="快速模式">
                <Zap size={14} />
              </Button>

              {/* 推理模式 */}
              <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="推理模式">
                <Brain size={14} />
              </Button>

              {/* 语音输入 */}
              <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="语音输入">
                <Mic size={14} />
              </Button>

              {/* 添加附件 */}
              <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="添加附件">
                <Paperclip size={14} />
              </Button>

              {/* 引用文件 */}
              <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="引用文件">
                <FolderOpen size={14} />
              </Button>

              {/* 分隔线 */}
              <div className="w-px h-4 bg-border mx-1" />

              {/* 停止（流式时显示） */}
              {isStreaming && (
                <>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-7 w-7 text-destructive"
                    onClick={onAbort}
                    title="停止生成 (Esc)"
                  >
                    <StopCircle size={14} />
                  </Button>
                  <span className="text-[10px] text-muted-foreground">按 Esc 中断</span>
                </>
              )}

              {/* 预览 */}
              <Button variant="ghost" size="icon-sm" className="h-7 w-7" title="预览">
                <Eye size={14} />
              </Button>
            </div>

            {/* 右侧：发送按钮 */}
            <Button
              variant="default"
              size="sm"
              className="h-7 px-3 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleSend}
              disabled={!inputText.trim() || isStreaming}
            >
              <span className="text-xs">⏎</span>
              <span className="text-xs">发送</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 优化的 Markdown 渲染组件 - 使用 memo 避免不必要的重新渲染
 */
const MemoizedMarkdown = memo(function MemoizedMarkdown({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  // 使用 useMemo 缓存渲染结果
  const renderedContent = useMemo(() => {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {content}
      </ReactMarkdown>
    )
  }, [content])
  
  return (
    <>
      {renderedContent}
      {isStreaming && <StreamingCursor />}
    </>
  )
})

/**
 * 消息分组：将连续的相同角色消息合并为一组
 * 这样可以让同一轮对话的助手消息共享一个头像
 */
type MessageGroup = { role: 'user' | 'assistant' | 'system'; messages: Message[] }

function groupMessages(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = []
  
  for (const message of messages) {
    const lastGroup = groups[groups.length - 1]
    
    // 如果上一组的角色与当前消息相同，且都是助手消息，则合并
    if (lastGroup && lastGroup.role === message.role && message.role === 'assistant') {
      lastGroup.messages.push(message)
    } else {
      // 否则创建新组
      groups.push({ role: message.role, messages: [message] })
    }
  }
  
  return groups
}

/**
 * 助手消息组组件：多个助手消息共享一个头像
 */
function AssistantMessageGroup({ messages, modelName }: { messages: Message[]; modelName?: string }) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const { settings } = useMessageSettings()
  
  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }
  
  // 获取气泡背景样式（助手消息使用透明/无背景）
  const getBackgroundStyle = () => 'text-foreground px-1'
  
  // 判断是否是流式消息（取最后一个）
  const lastMessage = messages[messages.length - 1]
  const isGroupStreaming = lastMessage.isStreaming
  
  return (
    <div className="grid grid-cols-[36px_1fr] gap-3">
      {/* 头像 - 独立列，与内容顶部对齐 */}
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border bg-muted border-border">
        <span className="text-sm">🤖</span>
      </div>
      
      {/* 消息内容 - 独立列 */}
      <div className="max-w-[80%] min-w-0">
        {/* 角色标注 */}
        <div className="text-[11px] font-medium mb-1.5 px-1 text-muted-foreground">
          {modelName || 'AI 助手'}
        </div>
        
        {/* 多条消息堆叠 */}
        <div className="space-y-2">
          {messages.map((message, index) => {
            const isStreamingMsg = message.isStreaming
            const hasContent = message.content.length > 0
            const hasThinking = !!message.thinking && message.thinking.length > 0
            const hasToolCalls = message.toolCalls && message.toolCalls.length > 0
            
            return (
              <div key={message.id}>
                {/* Thinking 内容 */}
                {hasThinking && (
                  <ThinkingBlock thinking={message.thinking!} isStreaming={isStreamingMsg} />
                )}
                
                <div
                  className={cn(
                    'group relative',
                    getBackgroundStyle()
                  )}
                >
                  {/* 正文内容 */}
                  {hasContent ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <MemoizedMarkdown content={message.content} isStreaming={isStreamingMsg} />
                    </div>
                  ) : isStreamingMsg && !hasThinking && !hasToolCalls ? (
                    /* 流式传输中且没有内容时，不渲染空白 div，由底部的 AgentWorkingIndicator 处理 */
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
                  <ToolCallList
                    toolCalls={message.toolCalls!}
                    isStreaming={isStreamingMsg}
                  />
                )}
                
                {/* 时间戳 - 只在流式结束后且是组内最后一条消息时显示 */}
                {settings.showTimestamp && !isStreamingMsg && index === messages.length - 1 && (
                  <div className="text-[10px] mt-1 px-1 text-muted-foreground text-left">
                    {formatTimestamp(message.timestamp)}
                  </div>
                )}
              </div>
            )
          })}
          
          {/* Agent 工作中指示器 - 只在整组流式时显示一个 */}
          {isGroupStreaming && (
            <div className="mt-2">
              <AgentWorkingIndicator />
            </div>
          )}
          
          {/* 聚合的 Usage 信息 - 只在整组流式结束后显示 */}
          {!isGroupStreaming && lastMessage.usage && (
            <div className="mt-1">
              <UsageDisplay 
                usage={lastMessage.usage} 
                startTime={messages[0]?.streamingStartTime}
                endTime={lastMessage.streamingEndTime}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-20">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4 border border-border">
        <span className="text-3xl">🤖</span>
      </div>
      <h3 className="text-lg font-semibold mb-2">开始新对话</h3>
      <p className="text-sm text-muted-foreground max-w-md">
        输入你的问题或需求，AI 助手会帮助你完成任务。
        <br />
        支持代码生成、文件操作、问题解答等多种场景。
      </p>
      <div className="flex flex-wrap gap-2 mt-6">
        {['帮我写一个函数', '解释这段代码', '修复这个 bug'].map((suggestion) => (
          <Button key={suggestion} variant="outline" size="sm" className="bg-white border-border hover:bg-muted">
            {suggestion}
          </Button>
        ))}
      </div>
    </div>
  )
}

function LoadingSessionState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-20">
      <Loader2 size={32} className="animate-spin text-primary mb-4" />
      <p className="text-sm text-muted-foreground">加载会话历史...</p>
    </div>
  )
}

function MessageBubble({ message, modelName, isLastMessage }: { message: Message; modelName?: string; isLastMessage?: boolean }) {
  const [copied, setCopied] = useState(false)
  const { settings } = useMessageSettings()
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const isStreamingMsg = isAssistant && message.isStreaming
  const hasContent = isAssistant && message.content.length > 0
  const hasThinking = isAssistant && !!message.thinking && message.thinking.length > 0
  const hasToolCalls = isAssistant && message.toolCalls && message.toolCalls.length > 0

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // 对于流式中的助手消息且没有内容、没有工具调用、没有 thinking → 显示 agent working 指示器
  const showAgentWorking = isStreamingMsg && !hasContent && !hasToolCalls && !hasThinking

  // 根据消息背景设置获取样式
  const getBackgroundStyle = () => {
    if (isUser) {
      switch (settings.messageBackground) {
        case 'transparent':
          return 'bg-muted/40 text-foreground border border-border/50 px-4 py-3 rounded-2xl'
        case 'subtle':
          return 'bg-muted/60 text-foreground border border-border px-4 py-3 rounded-2xl'
        default:
          return 'bg-muted/80 text-foreground border border-border px-4 py-3 rounded-2xl'
      }
    }
    return 'text-foreground px-1'
  }

  // 根据气泡样式设置获取样式
  const getBubbleStyle = () => {
    switch (settings.bubbleStyle) {
      case 'classic':
        return isUser ? 'rounded-lg' : ''
      case 'minimal':
        return isUser ? 'rounded-none border-l-2' : ''
      default:
        return isUser ? 'rounded-2xl' : ''
    }
  }

  return (
    <div className={cn('grid gap-3', isUser ? 'grid-cols-[1fr_36px]' : 'grid-cols-[36px_1fr]')}>
      {/* 头像 */}
      <div
        className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border',
          isUser ? 'bg-muted border-border' : 'bg-muted border-border',
          isUser ? 'order-2' : 'order-1'
        )}
      >
        <span className="text-sm">{isUser ? '👤' : '🤖'}</span>
      </div>

      {/* 消息内容 */}
      <div className={cn('max-w-[80%] min-w-0', isUser ? 'order-1 ml-auto flex flex-col items-end' : 'order-2 items-start')}>
        {/* 角色标注 */}
        <div className={cn(
          'text-[11px] font-medium mb-1.5 px-1',
          isUser ? 'text-foreground' : 'text-muted-foreground'
        )}>
          {isUser ? '用户' : (modelName || 'AI 助手')}
        </div>

        {/* Thinking 内容 */}
        {hasThinking && (
          <ThinkingBlock thinking={message.thinking!} isStreaming={isStreamingMsg} />
        )}

        <div
          className={cn(
            'group relative',
            getBackgroundStyle(),
            getBubbleStyle()
          )}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          ) : showAgentWorking ? (
            /* Agent 正在工作 —— 无内容无工具调用时的占位状态 */
            <AgentWorkingIndicator />
          ) : (
            <>
              {/* 正文内容 */}
              {hasContent ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <MemoizedMarkdown content={message.content} isStreaming={isStreamingMsg} />
                </div>
              ) : !hasThinking && !hasToolCalls ? (
                /* 无内容且无 thinking 且无工具调用 */
                <div className="min-h-[1.5rem]" />
              ) : (
                /* 有 thinking 或有工具调用但没有内容 - 显示最小占位 */
                <div className="min-h-[0.5rem]" />
              )}
            </>
          )}

          {/* 复制按钮 */}
          {!isUser && hasContent && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100"
              onClick={handleCopy}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </Button>
          )}
        </div>

        {/* 工具调用列表 */}
        {hasToolCalls && (
          <ToolCallList
            toolCalls={message.toolCalls!}
            isStreaming={isStreamingMsg}
          />
        )}

        {/* Agent 工作中指示器（有工具调用时显示在工具列表下方） */}
        {isStreamingMsg && hasToolCalls && (
          <div className="mt-2 px-1">
            <AgentWorkingInline />
          </div>
        )}

        {/* 时间戳 - 只在最后一条消息显示 */}
        {settings.showTimestamp && isLastMessage && (
          <div
            className={cn(
              'text-[10px] mt-1 px-1 text-muted-foreground',
              isUser ? 'text-right' : 'text-left'
            )}
          >
            {formatTimestamp(message.timestamp)}
          </div>
        )}

        {/* Usage 信息 */}
        {isAssistant && message.usage && (
          <UsageDisplay 
            usage={message.usage} 
            startTime={message.streamingStartTime}
            endTime={message.streamingEndTime}
          />
        )}
      </div>
    </div>
  )
}

/**
 * Agent 正在工作的完整占位指示器（大块状态）
 */
function AgentWorkingIndicator() {
  const [elapsed, setElapsed] = useState(0)
  
  useEffect(() => {
    const startTime = Date.now()
    const timer = setInterval(() => {
      setElapsed((Date.now() - startTime) / 1000)
    }, 100)
    
    return () => clearInterval(timer)
  }, [])
  
  return (
    <div className="flex items-center gap-3 py-2 px-1">
      <div className="flex items-center gap-2">
        <Loader2 size={14} className="animate-spin text-primary" />
        <span className="text-sm text-muted-foreground font-medium">Agent working</span>
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">
        {elapsed.toFixed(1)}s
      </span>
    </div>
  )
}

/**
 * 行内 Agent 工作指示器（小号，用于工具调用下方）
 */
function AgentWorkingInline() {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Loader2 size={12} className="animate-spin text-primary" />
      <span>Agent working</span>
      <BouncingDots size="sm" />
    </div>
  )
}

/**
 * Token 使用情况显示
 */
function UsageDisplay({ usage, startTime, endTime }: { usage: Usage; startTime?: Date; endTime?: Date }) {
  if (!usage.totalTokens) return null
  
  // 计算 token/s
  const tokensPerSecond = startTime && endTime && usage.completionTokens
    ? (usage.completionTokens / ((endTime.getTime() - startTime.getTime()) / 1000)).toFixed(1)
    : null
  
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 px-1 text-[10px] text-muted-foreground">
      <div className="flex items-center gap-1">
        <Zap size={10} className="text-amber-500" />
        <span>{usage.totalTokens.toLocaleString()} tokens</span>
      </div>
      
      {usage.promptTokens != null && (
        <span>输入: {usage.promptTokens.toLocaleString()}</span>
      )}
      
      {usage.completionTokens != null && (
        <span>输出: {usage.completionTokens.toLocaleString()}</span>
      )}
      
      {usage.cacheReadInputTokens != null && usage.cacheReadInputTokens > 0 && (
        <span>缓存读: {usage.cacheReadInputTokens.toLocaleString()}</span>
      )}
      
      {usage.cacheCreationInputTokens != null && usage.cacheCreationInputTokens > 0 && (
        <span>缓存写: {usage.cacheCreationInputTokens.toLocaleString()}</span>
      )}
      
      {tokensPerSecond && (
        <span>{tokensPerSecond} tok/s</span>
      )}
    </div>
  )
}

/**
 * 六个点转圈动画 - 模拟正在工作
 */
function BouncingDots({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const dotSize = size === 'sm' ? 'w-1 h-1' : 'w-1.5 h-1.5'
  const gap = size === 'sm' ? 'gap-[3px]' : 'gap-1'
  
  return (
    <span className={cn('inline-flex items-center', gap)}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={cn(
            dotSize,
            'rounded-full bg-primary/60 animate-bounce'
          )}
          style={{ animationDelay: `${i * 100}ms`, animationDuration: '1.2s' }}
        />
      ))}
    </span>
  )
}

/**
 * 流式文本末尾的闪烁光标
 */
function StreamingCursor() {
  const { settings } = useMessageSettings()
  
  if (!settings.showStreamingCursor) return null
  
  return (
    <span className="inline-block w-[2px] h-[1em] bg-primary animate-pulse ml-0.5 align-text-bottom" />
  )
}

function ToolCallList({ toolCalls, isStreaming }: { toolCalls: ToolCall[]; isStreaming?: boolean }) {
  const { settings } = useMessageSettings()
  const [expanded, setExpanded] = useState(isStreaming || settings.toolCallsDefaultExpanded) // 流式时或设置中默认展开
  const runningCount = toolCalls.filter((t) => t.status === 'running').length
  const successCount = toolCalls.filter((t) => t.status === 'success').length
  const errorCount = toolCalls.filter((t) => t.status === 'error').length

  return (
    <div className="mt-2 rounded-xl overflow-hidden border border-border bg-card">
      {/* 折叠头部 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Wrench size={12} />
        <span>已运行 {toolCalls.length} 个工具</span>
        {runningCount > 0 && (
          <span className="flex items-center gap-1 text-amber-500">
            <Loader2 size={10} className="animate-spin" />
            {runningCount}
          </span>
        )}
        {successCount > 0 && (
          <span className="flex items-center gap-1 text-green-500">
            <CheckCircle2 size={10} />
            {successCount}
          </span>
        )}
        {errorCount > 0 && (
          <span className="flex items-center gap-1 text-red-500">
            <XCircle size={10} />
            {errorCount}
          </span>
        )}
        <ChevronDown className={cn('ml-auto transition-transform', expanded && 'rotate-180')} size={12} />
      </button>

      {/* 展开内容 */}
      {expanded && (
        <div className="border-t border-border">
          {toolCalls.map((toolCall, index) => (
            <ToolCallItem key={toolCall.id} toolCall={toolCall} index={index + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function ToolCallItem({ toolCall, index }: { toolCall: ToolCall; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const hasResult = toolCall.result || toolCall.error
  
  const statusIcon = {
    pending: <AlertCircle size={12} className="text-muted-foreground" />,
    running: <Loader2 size={12} className="animate-spin text-amber-500" />,
    success: <CheckCircle2 size={12} className="text-green-500" />,
    error: <XCircle size={12} className="text-red-500" />,
  }

  // 获取参数摘要
  const getArgsSummary = () => {
    if (toolCall.args.path != null) return String(toolCall.args.path)
    if (toolCall.args.command != null) return String(toolCall.args.command)
    if (toolCall.args.pattern != null) return String(toolCall.args.pattern)
    if (toolCall.args.file_path != null) return String(toolCall.args.file_path)
    return null
  }
  const argsSummary = getArgsSummary()

  return (
    <div className="border-t">
      {/* 工具调用头部 - 可点击 */}
      <button
        onClick={() => hasResult && setExpanded(!expanded)}
        className={cn(
          'flex items-center gap-2 w-full px-3 py-2 text-xs',
          hasResult ? 'hover:bg-muted/50 cursor-pointer' : 'cursor-default'
        )}
      >
        <span className="text-muted-foreground w-5 text-right">{index}.</span>
        {statusIcon[toolCall.status]}
        <span className="font-medium">{toolCall.name}</span>
        {argsSummary && (
          <span className="truncate text-muted-foreground flex-1 text-left">- {argsSummary}</span>
        )}
        {hasResult && (
          <ChevronDown
            className={cn('transition-transform text-muted-foreground', expanded && 'rotate-180')}
            size={12}
          />
        )}
      </button>
      
      {/* 工具调用结果 - 展开显示 */}
      {expanded && hasResult && (
        <div className="px-3 pb-3 border-t border-border/40">
          <ToolCallResult result={toolCall.result} error={toolCall.error} />
        </div>
      )}
    </div>
  )
}

/**
 * 工具调用结果展示
 */
function ToolCallResult({ result, error }: { result?: string | { content?: string; details?: unknown; type?: string; text?: string }; error?: string }) {
  // 处理 result 可能是对象的情况
  let resultContent = ''
  if (typeof result === 'object' && result !== null) {
    // 优先使用 text 字段（{type, text} 结构）
    if ('text' in result && typeof result.text === 'string') {
      resultContent = result.text
    }
    // 其次使用 content 字段
    else if ('content' in result && typeof result.content === 'string') {
      resultContent = result.content
    }
    // 兜底：JSON 序列化
    else {
      resultContent = JSON.stringify(result, null, 2)
    }
  } else if (typeof result === 'string') {
    resultContent = result
  }
  
  const content = error || resultContent
  const isError = !!error
  
  if (!content) return null
  
  return (
    <div className={cn(
      'mt-2 rounded-lg p-3 text-xs font-mono whitespace-pre-wrap max-h-[300px] overflow-auto',
      isError 
        ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
        : 'bg-muted/50 text-muted-foreground border border-border/50'
    )}>
      {content}
    </div>
  )
}

/**
 * Thinking 内容块 - 可折叠显示模型的思考过程
 */
function ThinkingBlock({ thinking, isStreaming }: { thinking: string; isStreaming?: boolean }) {
  const { settings } = useMessageSettings()
  const [expanded, setExpanded] = useState(settings.thinkingDefaultExpanded)
  
  // 检查 thinking 内容是否有实际内容（去除空白后不为空）
  const hasThinkingContent = thinking.trim().length > 0
  
  // 清理 thinking 内容：移除多余的空行，保留单个换行
  const cleanedThinking = thinking.replace(/\n{3,}/g, '\n\n').trim()
  
  return (
    <div className="mb-2 rounded-xl overflow-hidden border border-border/60 bg-muted/30">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Brain size={12} />
        <span>Thinking</span>
        {isStreaming && !expanded && (
          <Loader2 size={10} className="animate-spin text-primary" />
        )}
        <ChevronDown
          className={cn('ml-auto transition-transform', expanded && 'rotate-180')}
          size={12}
        />
      </button>
      
      {expanded && hasThinkingContent && (
        <div className="px-3 pb-3 border-t border-border/40">
          <div className="prose prose-sm dark:prose-invert max-w-none mt-2 text-muted-foreground [&_p]:mb-1 [&_p:last-child]:mb-0">
            <MemoizedMarkdown content={cleanedThinking} isStreaming={isStreaming} />
          </div>
        </div>
      )}
    </div>
  )
}
