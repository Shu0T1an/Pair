import { useState } from 'react'
import { Brain, ChevronDown } from 'lucide-react'
import { cn } from '@/renderer/lib/utils'

interface ThinkingBlockProps {
  thinking: string
  isStreaming?: boolean
  defaultExpanded?: boolean
  fontSize?: number
}

export function ThinkingBlock({ thinking, isStreaming, defaultExpanded = false, fontSize }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const iconScale = fontSize ? fontSize / 14 : 1
  
  return (
    <div className="mb-0" style={fontSize ? { fontSize: `${fontSize}px` } : undefined}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Brain size={Math.round(14 * iconScale)} className={cn(isStreaming && 'animate-pulse')} />
        <span>Thinking</span>
        <ChevronDown 
          size={Math.round(12 * iconScale)} 
          className={cn(
            'transition-transform',
            isExpanded && 'rotate-180'
          )} 
        />
      </button>
      
      {isExpanded && (
        <div className="mt-1.5 pl-5 text-muted-foreground border-l-2 border-muted">
          <div className="whitespace-pre-wrap">{thinking}</div>
        </div>
      )}
    </div>
  )
}
