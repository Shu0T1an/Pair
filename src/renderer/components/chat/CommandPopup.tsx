import { useEffect, useRef } from 'react'
import { Terminal } from 'lucide-react'
import { cn } from '@/renderer/lib/utils'

export interface SlashCommand {
  name: string
  label: string
  description: string
  handler: () => void
}

interface CommandPopupProps {
  commands: SlashCommand[]
  selectedIndex: number
  onSelect: (command: SlashCommand) => void
}

export function CommandPopup({ commands, selectedIndex, onSelect }: CommandPopupProps) {
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  useEffect(() => {
    if (selectedIndex < 0) return
    const el = itemRefs.current.get(selectedIndex)
    if (el) {
      el.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  if (commands.length === 0) return null

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 z-50 bg-popover border border-border rounded-xl shadow-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground border-b border-border">
        <span>命令 ({commands.length})</span>
        <span className="text-[10px]">↑↓ 选择 · Enter 执行 · Esc 关闭</span>
      </div>

      <div className="max-h-48 overflow-y-auto">
        {commands.map((cmd, index) => (
          <button
            key={cmd.name}
            ref={(el) => { if (el) itemRefs.current.set(index, el); else itemRefs.current.delete(index) }}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
              index === selectedIndex
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-muted'
            )}
            onMouseDown={(e) => {
              e.preventDefault()
              onSelect(cmd)
            }}
          >
            <Terminal size={14} className="shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <span className="font-medium text-primary">/{cmd.label}</span>
              <span className="ml-2 text-xs text-muted-foreground">{cmd.description}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
