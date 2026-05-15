import { cn } from '@/renderer/lib/utils'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6',
  }

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div className="grid grid-cols-3 gap-[2px]">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'rounded-full bg-current animate-pulse',
              sizeClasses[size]
            )}
            style={{
              animationDelay: `${i * 0.1}s`,
              animationDuration: '0.8s',
            }}
          />
        ))}
      </div>
    </div>
  )
}

interface LoadingIndicatorProps {
  label?: string
  className?: string
}

export function LoadingIndicator({ label = '加载中...', className }: LoadingIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Spinner size="sm" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  )
}
