import type { SessionStatus } from '@/shared/types'
import { cn } from '@/renderer/lib/utils'

interface SessionStatusIndicatorProps {
  status: SessionStatus
  className?: string
}

/**
 * 会话状态指示器
 * - working: 绿色旋转弧线
 * - completed: 绿色对钩
 * - error: 红色感叹号
 * - idle: 不显示
 */
export function SessionStatusIndicator({ status, className }: SessionStatusIndicatorProps) {
  if (status === 'idle') return null

  return (
    <div className={cn('flex items-center justify-center w-4 h-4 shrink-0', className)}>
      {status === 'working' && (
        <svg
          className="animate-spin text-green-500"
          viewBox="0 0 24 24"
          width={14}
          height={14}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          {/* 弧线：约70%的圆，旋转形成扫描效果 */}
          <circle
            cx="12"
            cy="12"
            r="10"
            strokeDasharray="44 18.83"
            strokeDashoffset="0"
          />
        </svg>
      )}

      {status === 'completed' && (
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

      {status === 'error' && (
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
