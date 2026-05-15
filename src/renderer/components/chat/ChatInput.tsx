import { useState, useRef, useCallback } from 'react'
import { ArrowUp, StopCircle, Mic, Paperclip, Brain } from 'lucide-react'
import { Button } from '@/renderer/components/ui/button'
import { cn } from '@/renderer/lib/utils'
import type { ModelInfo } from '@/shared/types'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/renderer/components/ui/dropdown-menu'

interface ChatInputProps {
  currentModel: ModelInfo | null
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
