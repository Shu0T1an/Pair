import { useState } from 'react'
import { Brain, ChevronDown } from 'lucide-react'
import { cn } from '@/renderer/lib/utils'

interface ThinkingBlockProps {
  thinking: string
  isStreaming?: boolean
  defaultExpanded?: boolean
}

export function ThinkingBlock({ thinking, isStreaming, defaultExpanded = false }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  
  return (
    <div className="mb-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Brain size={14} className={cn(isStreaming && 'animate-pulse')} />
        <span>Thinking</span>
        <ChevronDown 
          size={12} 
          className={cn(
            'transition-transform',
            isExpanded && 'rotate-180'
          )} 
        />
      </button>
      
      {isExpanded && (
        <div className="mt-1.5 pl-5 text-sm text-muted-foreground border-l-2 border-muted">
          <div className="whitespace-pre-wrap">{thinking}</div>
        </div>
      )}
    </div>
  )
}
