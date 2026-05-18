import { Brain } from 'lucide-react'
import { Button } from './button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './dropdown-menu'
import { cn } from '@/renderer/lib/utils'
import type { ThinkingLevel } from '@/shared/types'
import { DEFAULT_THINKING_BUDGETS } from '@/shared/types'

interface ThinkingLevelSelectorProps {
  currentLevel: ThinkingLevel
  onLevelChange: (level: ThinkingLevel) => void
  disabled?: boolean
}

const THINKING_LEVELS: ThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh']

export function ThinkingLevelSelector({ 
  currentLevel, 
  onLevelChange, 
  disabled 
}: ThinkingLevelSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-xs gap-1"
          disabled={disabled}
        >
          <Brain size={12} />
          {currentLevel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {THINKING_LEVELS.map((level) => (
          <DropdownMenuItem 
            key={level}
            onClick={() => onLevelChange(level)}
            className={cn(currentLevel === level && 'bg-accent')}
          >
            <div>
              <div className="font-medium">{level}</div>
              <div className="text-xs text-muted-foreground">
                {DEFAULT_THINKING_BUDGETS[level]} tokens
              </div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
