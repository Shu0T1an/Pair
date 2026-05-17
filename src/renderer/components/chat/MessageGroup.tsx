import { useState, memo } from 'react'
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
import { FileChangesPanel } from './FileChangesPanel'

interface MessageGroupProps {
  role: 'user' | 'assistant' | 'system'
  messages: Message[]
  modelName?: string
  fontSize?: number
  showTimestamp?: boolean
}

// Memoized Markdown 组件
const MemoizedMarkdown = memo(function MemoizedMarkdown({ 
  content
}: { 
  content: string
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

export const MessageGroup = memo(function MessageGroup({ role, messages, modelName, fontSize, showTimestamp }: MessageGroupProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const { settings } = useMessageSettings()
  
  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }
  
  const allToolCalls = messages.flatMap(m => m.toolCalls || [])
  
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
              <div className="whitespace-pre-wrap" style={fontSize ? { fontSize: `${fontSize}px` } : undefined}>{message.content}</div>
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
      <div className="min-w-0 mr-9">
        {/* 角色标注 */}
        <div className="text-[11px] font-medium mb-1.5 px-1 text-muted-foreground">
          {modelName || 'AI 助手'}
        </div>
        
        {/* 多条消息堆叠 */}
        <div className="space-y-1">
          {messages.map((message) => {
            const isStreamingMsg = message.isStreaming
            const hasContent = message.content.length > 0
            const hasThinking = !!message.thinking && message.thinking.length > 0
            const hasToolCalls = message.toolCalls && message.toolCalls.length > 0
            
            return (
              <div key={message.id} className="space-y-0.5">
                {/* Thinking 内容 */}
                {hasThinking && (
                  <ThinkingBlock 
                    thinking={message.thinking!} 
                    isStreaming={isStreamingMsg}
                    defaultExpanded={settings.thinkingDefaultExpanded}
                    fontSize={fontSize}
                  />
                )}
                
                <div className={cn('group relative', 'text-foreground px-1', hasContent && 'py-0.5')}>
                  {/* 正文内容 */}
                  {hasContent ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none" style={fontSize ? { fontSize: `${fontSize}px` } : undefined}>
                      <MemoizedMarkdown content={message.content} />
                    </div>
                  ) : isStreamingMsg && !hasThinking && !hasToolCalls ? (
                    null
                  ) : !hasThinking && !hasToolCalls ? (
                    <div className="min-h-[1.5rem]" />
                  ) : (
                    null
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
                    fontSize={fontSize}
                  />
                )}
              </div>
            )
          })}
        </div>
        
        {allToolCalls.length > 0 && (
          <FileChangesPanel
            toolCalls={allToolCalls}
            isStreaming={isGroupStreaming}
            defaultExpanded={settings.toolCallsDefaultExpanded}
            fontSize={fontSize}
          />
        )}
        
        {/* 时间戳 */}
        {showTimestamp && !isGroupStreaming && (
          <div className="text-[10px] text-muted-foreground mt-1 px-1">
            {formatTimestamp(lastMessage.timestamp)}
          </div>
        )}
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // 自定义比较函数，避免不必要的重渲染
  return (
    prevProps.role === nextProps.role &&
    prevProps.messages === nextProps.messages &&
    prevProps.modelName === nextProps.modelName &&
    prevProps.fontSize === nextProps.fontSize &&
    prevProps.showTimestamp === nextProps.showTimestamp
  )
})
