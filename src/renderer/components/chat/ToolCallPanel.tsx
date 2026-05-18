import { useState } from 'react'
import { 
  Wrench, 
  ChevronDown, 
  ChevronRight,
  Loader2, 
  CheckCircle2, 
  XCircle,
  Copy,
  Check,
  FileText,
  Terminal,
  FileEdit,
  FilePlus,
  Search,
  FolderOpen,
  List,
  Code,
  Clock,
  BookOpen,
  Globe
} from 'lucide-react'
import { PatchDiff } from '@pierre/diffs/react'
import { cn } from '@/renderer/lib/utils'
import type { ToolCall } from '@/shared/types'
import { MarkdownViewer } from './MarkdownViewer'
import { useTheme } from '@/renderer/contexts/ThemeContext'
import { customDiffToUnifiedPatch } from '@/renderer/lib/diff-utils'

// 格式化结果
function formatResult(result: string | { content?: string | unknown[]; details?: unknown; type?: string; text?: string }): string {
  if (typeof result === 'string') {
    return result
  }
  if (typeof result === 'object' && result !== null) {
    if ('text' in result && typeof result.text === 'string') {
      return result.text
    }
    if ('content' in result && typeof result.content === 'string') {
      return result.content
    }
    if ('content' in result && Array.isArray(result.content)) {
      return result.content
        .filter((b: any) => b?.type === 'text' && typeof b.text === 'string')
        .map((b: any) => b.text)
        .join('')
    }
    return JSON.stringify(result, null, 2)
  }
  return String(result)
}

// 格式化执行时长
function formatDuration(startTime?: Date, endTime?: Date): string {
  if (!startTime) return ''
  const end = endTime || new Date()
  const duration = end.getTime() - new Date(startTime).getTime()
  if (duration < 1000) return `${duration}ms`
  if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`
  const minutes = Math.floor(duration / 60000)
  const seconds = Math.floor((duration % 60000) / 1000)
  return `${minutes}m ${seconds}s`
}

// 提取工具关键参数摘要
function getToolSummary(toolName: string, args?: Record<string, unknown>): string {
  if (!args) return ''
  const name = toolName.toLowerCase()
  const parts = name.split('__')
  const baseName = parts.length > 1 ? parts[1] : name
  
  if (baseName === 'tavily_search') {
    const query = args.query
    return query ? String(query) : ''
  }
  if (baseName === 'tavily_extract') {
    const urls = args.urls
    if (Array.isArray(urls) && urls.length > 0) {
      const url = String(urls[0])
      return url.length > 60 ? url.slice(0, 57) + '...' : url
    }
    return ''
  }
  
  switch (name) {
    case 'read': {
      const path = args.path || args.file || args.filePath
      return path ? String(path) : ''
    }
    case 'edit': {
      const path = args.path || args.file || args.filePath
      return path ? String(path) : ''
    }
    case 'write': {
      const path = args.path || args.file || args.filePath
      return path ? String(path) : ''
    }
    case 'bash': {
      const cmd = args.command || args.cmd
      if (cmd) {
        const cmdStr = String(cmd)
        // 截断过长的命令（必要，避免 UI 溢出）
        return cmdStr.length > 60 ? cmdStr.slice(0, 57) + '...' : cmdStr
      }
      return ''
    }
    case 'grep': {
      const pattern = args.pattern || args.query
      const path = args.path || args.dir
      if (pattern && path) return `${pattern} @ ${path}`
      if (pattern) return String(pattern)
      return ''
    }
    case 'find': {
      const path = args.path || args.dir || args.root
      const name = args.name || args.pattern
      if (path && name) return `${path} · ${name}`
      if (path) return String(path)
      return ''
    }
    case 'ls': {
      const path = args.path || args.dir
      return path ? String(path) : ''
    }
    default:
      return ''
  }
}

// 工具图标映射
function getToolIcon(toolName: string, iconScale: number) {
  const s = Math.round(14 * iconScale)
  const name = toolName.toLowerCase()
  const parts = name.split('__')
  const baseName = parts.length > 1 ? parts[1] : name
  if (baseName.startsWith('tavily_')) {
    return <Globe size={s} className="text-sky-500" />
  }
  switch (name) {
    case 'read':
      return <FileText size={s} className="text-blue-500" />
    case 'bash':
      return <Terminal size={s} className="text-green-500" />
    case 'edit':
      return <FileEdit size={s} className="text-orange-500" />
    case 'write':
      return <FilePlus size={s} className="text-purple-500" />
    case 'grep':
      return <Search size={s} className="text-yellow-500" />
    case 'find':
      return <FolderOpen size={s} className="text-cyan-500" />
    case 'ls':
      return <List size={s} className="text-pink-500" />
    case 'code':
    case 'code-xml':
      return <Code size={s} className="text-indigo-500" />
    default:
      return <Wrench size={s} className="text-muted-foreground" />
  }
}

interface ToolCallPanelProps {
  toolCalls: ToolCall[]
  isStreaming?: boolean
  defaultExpanded?: boolean
  fontSize?: number
}

function getStatusIcon(status: ToolCall['status'], iconScale: number) {
  const s = Math.round(12 * iconScale)
  switch (status) {
    case 'pending':
    case 'running':
      return <Loader2 size={s} className="animate-spin text-blue-500" />
    case 'success':
      return <CheckCircle2 size={s} className="text-green-500" />
    case 'error':
      return <XCircle size={s} className="text-red-500" />
  }
}

function getReadPath(toolCall: ToolCall): string {
  return String(toolCall.args?.path ?? toolCall.args?.file ?? toolCall.args?.filePath ?? '')
}

function isMarkdownRead(toolCall: ToolCall): boolean {
  if (toolCall.name !== 'read') return false
  const path = getReadPath(toolCall)
  return typeof path === 'string' && path.toLowerCase().endsWith('.md')
}

function getSkillName(toolCall: ToolCall): string | null {
  const path = getReadPath(toolCall)
  if (!path) return null
  const normalized = path.replace(/\\/g, '/').toLowerCase()
  if (!normalized.endsWith('skill.md')) return null
  const marker = '/skills/'
  const idx = normalized.indexOf(marker)
  if (idx === -1) return null
  const after = normalized.slice(idx + marker.length).split('/')
  after.pop()
  return after[after.length - 1] || null
}

function getEditFilePath(toolCall: ToolCall): string {
  return (toolCall.args?.path as string) || (toolCall.args?.file as string) || 'file'
}

export function ToolCallPanel({ toolCalls, isStreaming, defaultExpanded = false, fontSize }: ToolCallPanelProps) {
  const [isListExpanded, setIsListExpanded] = useState(defaultExpanded)
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const { isDark } = useTheme()
  const iconScale = fontSize ? fontSize / 14 : 1
  const s14 = Math.round(14 * iconScale)
  const s12 = Math.round(12 * iconScale)
  const s10 = Math.round(10 * iconScale)
  
  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }
  
  const runningCount = toolCalls.filter(tc => tc.status === 'running').length
  const errorCount = toolCalls.filter(tc => tc.status === 'error').length
  
  return (
    <div className="mb-0" style={fontSize ? { fontSize: `${fontSize}px` } : undefined}>
      {/* 第一层：概要 */}
      <button
        onClick={() => setIsListExpanded(!isListExpanded)}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Wrench size={s14} className={cn(isStreaming && runningCount > 0 && 'animate-pulse')} />
        <span>已调用 {toolCalls.length} 个工具</span>
        
        {isStreaming && runningCount > 0 && (
          <span className="text-blue-500">
            · {runningCount} 执行中
          </span>
        )}
        {!isStreaming && errorCount > 0 && (
          <span className="text-red-500">
            · {errorCount} 失败
          </span>
        )}
        
        <ChevronDown 
          size={s12} 
          className={cn(
            'transition-transform',
            isListExpanded && 'rotate-180'
          )} 
        />
      </button>
      
      {/* 第二层：工具列表 */}
      {isListExpanded && (
        <div className="mt-1.5 pl-5 border-l-2 border-muted space-y-0.5">
          {toolCalls.map((toolCall) => {
            const duration = formatDuration(toolCall.startTime, toolCall.endTime)
            const isSelected = selectedToolId === toolCall.id
            const summary = getToolSummary(toolCall.name, toolCall.args)
            const skillName = getSkillName(toolCall)
            
            return (
              <div key={toolCall.id}>
                {/* 工具项 */}
                  <button
                    onClick={() => setSelectedToolId(isSelected ? null : toolCall.id)}
                    className={cn(
                      'w-full flex items-center gap-2 py-1 transition-colors rounded',
                      'hover:bg-muted/50 px-1.5',
                      isSelected && 'bg-muted/50',
                      toolCall.status === 'running' && 'text-blue-500'
                    )}
                  >
                  {skillName ? (
                    <BookOpen size={s14} className="text-purple-500" />
                  ) : (
                    getToolIcon(toolCall.name, iconScale)
                  )}
                  
                  <span className="font-mono text-left">
                    {skillName ? `skill[${skillName}]` : toolCall.name}
                  </span>
                  
                  {!skillName && summary && (
                    <span className="text-muted-foreground truncate max-w-[200px]">
                      {summary}
                    </span>
                  )}
                  
                    {duration && (
                      <span className="flex items-center gap-0.5 text-muted-foreground">
                        <Clock size={s10} />
                        {duration}
                      </span>
                    )}
                  
                  {getStatusIcon(toolCall.status, iconScale)}
                  
                  <ChevronRight 
                    size={s10} 
                    className={cn(
                      'transition-transform text-muted-foreground',
                      isSelected && 'rotate-90'
                    )}
                  />
                </button>
                
                {/* 第三层：工具详情 */}
                  {isSelected && (
                    <div className="ml-6 mt-1 mb-2 space-y-3">
                    {/* 参数 */}
                    {toolCall.args && Object.keys(toolCall.args).length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-foreground font-medium">输入参数</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCopy(JSON.stringify(toolCall.args, null, 2), `args-${toolCall.id}`)
                            }}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {copiedId === `args-${toolCall.id}` ? <Check size={s10} /> : <Copy size={s10} />}
                          </button>
                        </div>
                        <pre className="text-foreground bg-muted p-2 rounded-md overflow-x-auto max-h-32 font-mono border border-border/50">
                          {JSON.stringify(toolCall.args, null, 2)}
                        </pre>
                      </div>
                    )}
                    
                    {/* 结果 */}
                    {(toolCall.result || (toolCall.name === 'write' && toolCall.args?.content)) && (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-foreground font-medium">输出结果</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const copyContent = toolCall.name === 'write' && toolCall.args?.content
                                ? String(toolCall.args.content)
                                : formatResult(toolCall.result!)
                              handleCopy(copyContent, `result-${toolCall.id}`)
                            }}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {copiedId === `result-${toolCall.id}` ? <Check size={s10} /> : <Copy size={s10} />}
                          </button>
                        </div>
                        {toolCall.name === 'edit' && toolCall.details?.diff ? (
                          <div className="rounded-md border border-border/50 max-h-96 overflow-y-auto scrollbar-thin">
                            <PatchDiff
                              patch={customDiffToUnifiedPatch(toolCall.details.diff, getEditFilePath(toolCall))}
                              options={{
                                themeType: isDark ? 'dark' : 'light',
                                disableLineNumbers: false,
                                overflow: 'scroll',
                              }}
                            />
                          </div>
                        ) : toolCall.name === 'write' && toolCall.args?.content ? (
                          <pre className="text-foreground bg-muted p-2 rounded-md overflow-x-auto max-h-96 font-mono whitespace-pre-wrap border border-border/50">
                            {String(toolCall.args.content)}
                          </pre>
                        ) : isMarkdownRead(toolCall) ? (
                          <MarkdownViewer content={toolCall.result} title={skillName} />
                        ) : (
                          <pre className="text-foreground bg-muted p-2 rounded-md overflow-x-auto max-h-48 font-mono whitespace-pre-wrap border border-border/50">
                            {formatResult(toolCall.result)}
                          </pre>
                        )}
                      </div>
                    )}
                    
                    {/* 错误 */}
                    {toolCall.error && (
                      <div>
                        <div className="text-red-500 font-medium mb-1">错误</div>
                        <pre className="text-red-500 bg-red-500/10 p-2 rounded-md overflow-x-auto max-h-32 font-mono border border-red-500/30">
                          {formatResult(toolCall.error)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
