import { useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { PatchDiff } from '@pierre/diffs/react'
import { useTheme } from '@/renderer/contexts/ThemeContext'

interface DiffReviewModalProps {
  isOpen: boolean
  onClose: () => void
  diff: string
  filePath: string
}

export function DiffReviewModal({ isOpen, onClose, diff, filePath }: DiffReviewModalProps) {
  const { isDark } = useTheme()

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-medium text-muted-foreground shrink-0">文件审阅</span>
          <span className="font-mono text-sm truncate text-foreground">{filePath}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title="关闭 (Esc)"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-5xl mx-auto">
          {diff ? (
            <PatchDiff
              patch={diff}
              options={{
                themeType: isDark ? 'dark' : 'light',
                disableLineNumbers: false,
                overflow: 'auto',
                diffStyle: 'split',
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              无可用的 diff 内容
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
