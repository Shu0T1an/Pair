import { useState } from 'react'
import { X, MessageSquare } from 'lucide-react'
import type { SessionInfo } from '@/shared/types'
import { cn } from '@/renderer/lib/utils'

interface TabItemProps {
  session: SessionInfo
  isActive: boolean
  onSelect: () => void
  onClose: () => void
}

export function TabItem({ session, isActive, onSelect, onClose }: TabItemProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
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
  )
}
