import { useGlobalStream } from '@/renderer/contexts/GlobalStreamContext'

interface StreamingIndicatorProps {
  sessionId: string
  className?: string
}

/**
 * 流式状态指示器
 * 当会话正在流式输出时显示动画点和"生成中"文字
 */
export function StreamingIndicator({ sessionId, className = '' }: StreamingIndicatorProps) {
  const { isSessionStreaming } = useGlobalStream()
  const isStreaming = isSessionStreaming(sessionId)
  
  if (!isStreaming) return null
  
  return (
    <span className={`inline-flex items-center gap-1 text-xs text-blue-500 ${className}`}>
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
      </span>
      <span>生成中</span>
    </span>
  )
}

/**
 * 简化版流式状态点（无文字）
 */
export function StreamingDot({ sessionId, className = '' }: StreamingIndicatorProps) {
  const { isSessionStreaming } = useGlobalStream()
  const isStreaming = isSessionStreaming(sessionId)
  
  if (!isStreaming) return null
  
  return (
    <span className={`relative flex h-2 w-2 ${className}`}>
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
    </span>
  )
}
