import { useState, useRef, useCallback, useEffect } from 'react'
import { ArrowUp, StopCircle, Mic, Paperclip, Brain } from 'lucide-react'
import { Button } from '@/renderer/components/ui/button'
import { cn } from '@/renderer/lib/utils'
import type { ModelInfo } from '@/shared/types'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/renderer/components/ui/dropdown-menu'
import { ipcClient } from '@/renderer/ipc-client'
import { MentionPopup, type FileSearchItem } from './MentionPopup'
import { CommandPopup, type SlashCommand } from './CommandPopup'

interface ChatInputProps {
  currentModel: ModelInfo | null
  models: ModelInfo[]
  isStreaming?: boolean
  sessionId?: string
  onSend: (text: string) => void
  onAbort: () => void
  onSelectModel: (modelId: string) => void
  onOpenSettings?: () => void
  onNewSession?: () => void
}

// 格式化 token 数量
function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
}

export function ChatInput({ 
  currentModel, 
  models, 
  isStreaming, 
  sessionId,
  onSend, 
  onAbort,
  onSelectModel,
  onOpenSettings,
  onNewSession,
}: ChatInputProps) {
  const [inputText, setInputText] = useState('')
  const [contextUsage, setContextUsage] = useState<{ usedTokens: number; totalTokens: number; percentage: number } | null>(null)
  const [projectPath, setProjectPath] = useState<string>('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 弹出层状态
  const [mentionState, setMentionState] = useState<{
    type: 'file' | 'command'
    query: string
  } | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [resultCount, setResultCount] = useState(0)
  const [mentionResults, setMentionResults] = useState<FileSearchItem[]>([])
  
  useEffect(() => {
    if (!sessionId) return;
    ipcClient.getSessionInfo(sessionId).then(info => {
      if (info?.projectPath) {
        setProjectPath(info.projectPath);
      }
    }).catch(() => {});
    
    // 切换会话时自动聚焦输入框
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [sessionId]);

  // 获取上下文使用情况
  useEffect(() => {
    if (!sessionId) return;
    
    const fetchContextUsage = async () => {
      try {
        const usage = await ipcClient.getContextUsage(sessionId);
        setContextUsage(usage);
      } catch (error) {
        console.error('获取上下文使用情况失败:', error);
      }
    };
    
    fetchContextUsage();
    
    const interval = setInterval(fetchContextUsage, 30000);
    
    return () => clearInterval(interval);
  }, [sessionId]);
  
  // 消息发送后更新上下文使用情况
  const handleSend = useCallback(() => {
    if (!inputText.trim() || isStreaming) return
    onSend(inputText)
    setInputText('')
    
    // 重置 textarea 高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    
    // 延迟更新上下文使用情况
    setTimeout(async () => {
      if (sessionId) {
        try {
          const usage = await ipcClient.getContextUsage(sessionId);
          setContextUsage(usage);
        } catch (error) {
          console.error('更新上下文使用情况失败:', error);
        }
      }
    }, 1000);
  }, [inputText, isStreaming, onSend, sessionId])
  
  const commands: SlashCommand[] = [
    { name: 'settings', label: 'settings', description: '打开设置', handler: () => onOpenSettings?.() },
    { name: 'new', label: 'new', description: '新建会话', handler: () => onNewSession?.() },
    { name: 'clear', label: 'clear', description: '清空输入', handler: () => setInputText('') },
  ]

  const handleFileSelect = useCallback((item: FileSearchItem) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPos = textarea.selectionStart
    const textBeforeCursor = textarea.value.slice(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    if (lastAtIndex < 0) return

    const beforeAt = textarea.value.slice(0, lastAtIndex)
    const afterCursor = textarea.value.slice(cursorPos)
    const newText = `${beforeAt}@${item.relativePath} ${afterCursor}`

    setInputText(newText)
    setMentionState(null)
    setSelectedIndex(0)

    requestAnimationFrame(() => {
      textarea.focus()
      const newPos = lastAtIndex + item.relativePath.length + 2
      textarea.setSelectionRange(newPos, newPos)
    })
  }, [])

  const handleCommandSelect = useCallback((command: SlashCommand) => {
    command.handler()
    setMentionState(null)
    setSelectedIndex(0)
    const textarea = textareaRef.current
    if (!textarea) return
    const cursorPos = textarea.selectionStart
    const newText = textarea.value.slice(0, 1) === '/'
      ? textarea.value.slice(cursorPos)
      : textarea.value
    setInputText(newText)
    requestAnimationFrame(() => textarea.focus())
  }, [])

  const detectTrigger = useCallback((value: string, cursorPos: number) => {
    const textBeforeCursor = value.slice(0, cursorPos)

    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    if (lastAtIndex >= 0) {
      const charBefore = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' '
      if (charBefore === ' ' || charBefore === '\n' || charBefore === '\t') {
        const query = textBeforeCursor.slice(lastAtIndex + 1)
        if (!query.includes(' ') && projectPath) {
          return { type: 'file' as const, query }
        }
      }
    }

    if (textBeforeCursor === '/') {
      return { type: 'command' as const, query: '' }
    }

    return null
  }, [projectPath])

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setInputText(value)
    
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`

    const cursorPos = textarea.selectionStart
    const trigger = detectTrigger(value, cursorPos)
    if (trigger) {
      setMentionState(trigger)
      setSelectedIndex(0)
    } else {
      setMentionState(null)
    }
  }, [detectTrigger])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionState) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          if (resultCount > 0) {
            setSelectedIndex(prev => (prev + 1) % resultCount)
          }
          break
        case 'ArrowUp':
          e.preventDefault()
          if (resultCount > 0) {
            setSelectedIndex(prev => (prev - 1 + resultCount) % resultCount)
          }
          break
        case 'Enter': {
          e.preventDefault()
          if (mentionState.type === 'file') {
            const item = mentionResults[selectedIndex]
            if (item) handleFileSelect(item)
          } else {
            const cmd = commands[selectedIndex]
            if (cmd) handleCommandSelect(cmd)
          }
          break
        }
        case 'Escape':
          e.preventDefault()
          setMentionState(null)
          setSelectedIndex(0)
          break
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [mentionState, selectedIndex, resultCount, mentionResults, commands, handleFileSelect, handleCommandSelect, handleSend])

  return (
    <div className="border-t bg-background p-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-2 bg-muted rounded-xl p-2 relative">
          <Button variant="ghost" size="icon" className="shrink-0">
            <Paperclip size={18} />
          </Button>
          
          <div className="flex-1 relative">
            {mentionState?.type === 'file' && (
              <MentionPopup
                query={mentionState.query}
                projectPath={projectPath}
                selectedIndex={selectedIndex}
                onSelect={handleFileSelect}
                onResultsChange={(results) => {
                  setMentionResults(results)
                  setResultCount(results.length)
                  if (selectedIndex >= results.length) setSelectedIndex(0)
                }}
              />
            )}

            {mentionState?.type === 'command' && (
              <CommandPopup
                commands={commands}
                selectedIndex={selectedIndex}
                onSelect={handleCommandSelect}
              />
            )}
            
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="输入消息... (@ 引用文件, / 执行命令)"
              className="flex-1 w-full bg-transparent resize-none outline-none min-h-[24px] max-h-[200px] py-1"
              rows={1}
            />
          </div>
          
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
          
          {/* 上下文使用情况 */}
          {contextUsage && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <span>上下文:</span>
                <span className={cn(
                  'font-mono',
                  contextUsage.percentage > 90 ? 'text-red-500' : 
                  contextUsage.percentage > 70 ? 'text-yellow-500' : 
                  'text-green-500'
                )}>
                  {formatTokens(contextUsage.usedTokens)}
                </span>
                <span>/</span>
                <span className="font-mono">{formatTokens(contextUsage.totalTokens)}</span>
              </div>
              
              {/* 进度条 */}
              <div className="w-16 h-1.5 bg-muted-foreground/20 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    contextUsage.percentage > 90 ? 'bg-red-500' : 
                    contextUsage.percentage > 70 ? 'bg-yellow-500' : 
                    'bg-green-500'
                  )}
                  style={{ width: `${Math.min(100, contextUsage.percentage)}%` }}
                />
              </div>
              
              <span className="font-mono">{contextUsage.percentage}%</span>
            </div>
          )}
          
          {/* 语音按钮 */}
          <Button variant="ghost" size="icon" className="ml-auto">
            <Mic size={16} />
          </Button>
        </div>
      </div>
    </div>
  )
}
