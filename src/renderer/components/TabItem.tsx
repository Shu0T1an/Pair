import { useState, useEffect, useRef } from 'react'
import { X, MessageSquare } from 'lucide-react'
import type { SessionInfo } from '@/shared/types'
import { cn } from '@/renderer/lib/utils'

interface TabItemProps {
  session: SessionInfo
  isActive: boolean
  onSelect: () => void
  onClose: () => void
  onCloseAll: () => void
}

export function TabItem({ session, isActive, onSelect, onClose, onCloseAll }: TabItemProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 })
  const contextMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showContextMenu) return
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setShowContextMenu(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowContextMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [showContextMenu])

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    const x = Math.min(e.clientX, window.innerWidth - 160)
    const y = Math.min(e.clientY, window.innerHeight - 100)
    setContextMenuPos({ x, y })
    setShowContextMenu(true)
  }

  return (
    <div className="relative">
      <div
        className={cn(
          'group flex items-center gap-2 px-3 py-1.5 min-w-[120px] max-w-[200px] cursor-pointer transition-all border-b-2',
          isActive
            ? 'bg-card text-foreground border-primary'
            : 'bg-transparent text-muted-foreground border-transparent hover:bg-muted'
        )}
        onClick={onSelect}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onContextMenu={handleContextMenu}
        title={session.name}
      >
        <MessageSquare size={14} className="shrink-0" />
        <span className="truncate text-sm">{session.name}</span>
        <button
          className={cn(
            'ml-auto shrink-0 p-0.5 rounded hover:bg-destructive hover:text-destructive-foreground transition-opacity',
            isHovered ? 'opacity-100' : 'opacity-0'
          )}
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
        >
          <X size={12} />
        </button>
      </div>

      {showContextMenu && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setShowContextMenu(false)} />
          <div
            ref={contextMenuRef}
            className="fixed z-[9999] min-w-[140px] overflow-hidden rounded-lg border p-1 bg-white dark:bg-[hsl(240,10%,3.9%)] shadow-[0_8px_30px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.3)]"
            style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
          >
            <button
              className="w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors hover:bg-accent hover:text-accent-foreground"
              onClick={() => { onClose(); setShowContextMenu(false) }}
            >
              关闭当前标签
            </button>
            <div className="h-px bg-muted my-1" />
            <button
              className="w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors hover:bg-accent hover:text-accent-foreground"
              onClick={() => { onCloseAll(); setShowContextMenu(false) }}
            >
              关闭全部标签
            </button>
          </div>
        </>
      )}
    </div>
  )
}
