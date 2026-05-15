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
