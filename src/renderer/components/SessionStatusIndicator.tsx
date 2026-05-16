import { useGlobalStream } from '@/renderer/contexts/GlobalStreamContext'
import { cn } from '@/renderer/lib/utils'

interface SessionStatusIndicatorProps {
  sessionId: string
  className?: string
}

/**
 * 统一的会话状态指示器
 * - streaming: 蓝色呼吸灯（动画）
 * - completed: 绿色对钩
 * - error: 红色感叹号
 * - idle: 不显示
 */
export function SessionStatusIndicator({ sessionId, className }: SessionStatusIndicatorProps) {
  const { getSessionStatus, isSessionStreaming } = useGlobalStream()
  const status = getSessionStatus(sessionId)
  const isStreaming = isSessionStreaming(sessionId)

  // idle 状态不显示
  if (status === 'idle') return null

  return (
    <div className={cn('flex items-center justify-center w-4 h-4 shrink-0', className)}>
      {/* streaming 状态：蓝色呼吸灯 */}
      {(status === 'streaming' || isStreaming) && (
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
        </span>
      )}

      {/* completed 状态：绿色对钩 */}
      {status === 'completed' && !isStreaming && (
        <svg
          viewBox="0 0 24 24"
          width={14}
          height={14}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-green-500"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      )}

      {/* error 状态：红色感叹号 */}
      {status === 'error' && !isStreaming && (
        <svg
          viewBox="0 0 24 24"
          width={14}
          height={14}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-red-500"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      )}
    </div>
  )
}
