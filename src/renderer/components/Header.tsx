import {
  BarChart3,
  BookOpen,
  Settings,
  Moon,
  Sun,
  Zap,
} from 'lucide-react'
import { Button } from '@/renderer/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/renderer/components/ui/tooltip'
import type { SessionInfo } from '@/shared/types'

interface HeaderProps {
  session?: SessionInfo | null
  isDark?: boolean
  onToggleTheme: () => void
  onOpenSettings: () => void
  onOpenStats: () => void
  onOpenSkills: () => void
}

export function Header({
  session,
  isDark = true,
  onToggleTheme,
  onOpenSettings,
  onOpenStats,
  onOpenSkills,
}: HeaderProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center justify-between h-10 px-4 select-none" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
          {/* 左侧：应用信息 */}
          <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
                <Zap size={14} className="text-primary-foreground" />
              </div>
              <span className="text-sm font-semibold">Pair</span>
            </div>

            {session && (
              <>
                <span className="text-muted-foreground">|</span>
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                  {session.name}
                </span>
              </>
            )}
          </div>

          {/* 右侧：操作按钮 */}
          <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={onToggleTheme}>
                  {isDark ? <Sun size={14} /> : <Moon size={14} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isDark ? '切换到浅色模式' : '切换到深色模式'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={onOpenStats}>
                  <BarChart3 size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>统计</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={onOpenSkills}>
                  <BookOpen size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Skills</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={onOpenSettings}>
                  <Settings size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>设置</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </TooltipProvider>
  )
}
