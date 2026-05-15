import { Minus, Square, X } from 'lucide-react'

/**
 * 独立的窗口标题栏组件
 * 固定在窗口最上方，不受页面内容滚动或切换影响
 */
export function TitleBar() {
  return (
    <div 
      className="flex items-center justify-end h-8 bg-muted/30 shrink-0 select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div 
        className="flex items-center"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          className="inline-flex items-center justify-center h-7 w-7 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          onClick={() => (window as any).electronAPI?.minimize()}
          title="最小化"
        >
          <Minus size={14} />
        </button>
        <button
          className="inline-flex items-center justify-center h-7 w-7 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          onClick={() => (window as any).electronAPI?.maximize()}
          title="最大化"
        >
          <Square size={12} />
        </button>
        <button
          className="inline-flex items-center justify-center h-7 w-7 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
          onClick={() => (window as any).electronAPI?.close()}
          title="关闭"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
