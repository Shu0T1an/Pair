import { useState, useRef } from 'react'
import {
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  MoreHorizontal,
  Trash2,
  Edit3,
  Settings,
} from 'lucide-react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/renderer/components/ui/dropdown-menu'
import { Button } from '@/renderer/components/ui/button'
import { ScrollArea } from '@/renderer/components/ui/scroll-area'
import { Badge } from '@/renderer/components/ui/badge'
import type { ProjectSessions, SessionInfo } from '@/shared/types'
import { cn } from '@/renderer/lib/utils'

interface SessionListProps {
  projects: ProjectSessions[]
  activeSessionId?: string
  onSelectSession: (sessionId: string) => void
  onNewSession: (projectPath: string) => void
  onNewSessionInProject: (projectPath: string) => void
  onDeleteSession: (sessionId: string) => void
  onRenameSession: (sessionId: string, newName: string) => void
  onOpenSettings: () => void
}

export function SessionList({
  projects,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onNewSessionInProject,
  onDeleteSession,
  onRenameSession,
  onOpenSettings,
}: SessionListProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set(projects.map((p) => p.projectPath))
  )
  const [searchQuery, _setSearchQuery] = useState('')

  const toggleProject = (projectPath: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectPath)) {
        next.delete(projectPath)
      } else {
        next.add(projectPath)
      }
      return next
    })
  }

  const filteredProjects = projects
    .map((project) => ({
      ...project,
      sessions: project.sessions.filter(
        (s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.summary?.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((p) => p.sessions.length > 0 || !searchQuery)

  const handleNewSession = async () => {
    try {
      // 调用 Electron 文件夹选择对话框
      const electronAPI = (window as any).electronAPI
      if (electronAPI?.dialog?.selectFolder) {
        const folderPath = await electronAPI.dialog.selectFolder()
        if (folderPath) {
          // 用户选择了文件夹，调用父组件的 onNewSession 并传递路径
          onNewSession(folderPath)
        }
      } else {
        // 非 Electron 环境，使用默认路径
        onNewSession('/default/project')
      }
    } catch (error) {
      console.error('选择文件夹失败:', error)
      // 出错时也调用 onNewSession，保证功能可用
      onNewSession('/default/project')
    }
  }

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground p-3">
      {/* 头部 - 新会话按钮 */}
      <div className="mb-4">
        <Button 
          variant="outline" 
          className="w-full justify-between h-10 text-sm bg-white border-border shadow-sm hover:shadow-md transition-all rounded-xl"
          onClick={handleNewSession}
        >
          <div className="flex items-center gap-2">
            <Plus size={14} className="text-muted-foreground" />
            <span>新建工作区</span>
          </div>
          <Search size={14} className="text-muted-foreground" />
        </Button>
      </div>

      {/* 分类标题 */}
      <div className="flex items-center justify-between px-2 mb-2">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">工作区</span>
        <span className="text-[10px] text-muted-foreground">置顶</span>
      </div>

      {/* 会话列表 */}
      <ScrollArea className="flex-1">
        <div className="space-y-1">
          {filteredProjects.map((project) => (
            <div key={project.projectPath} className="mb-2">
              {/* 项目标题 */}
              <div className="flex items-center group">
                <button
                  onClick={() => toggleProject(project.projectPath)}
                  className="flex items-center gap-1.5 flex-1 px-2 py-1.5 rounded-lg text-left transition-colors hover:bg-white/50"
                >
                  {expandedProjects.has(project.projectPath) ? (
                    <ChevronDown size={12} className="text-muted-foreground" />
                  ) : (
                    <ChevronRight size={12} className="text-muted-foreground" />
                  )}
                  <span className="text-xs font-medium truncate">{project.projectName}</span>
                  <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 bg-muted">
                    {project.sessions.length}
                  </Badge>
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="opacity-0 group-hover:opacity-100 h-6 w-6 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    onNewSessionInProject(project.projectPath)
                  }}
                  title="新建会话"
                >
                  <Plus size={12} />
                </Button>
              </div>

              {/* 会话列表 */}
              {expandedProjects.has(project.projectPath) && (
                <div className="mt-1">
                  {project.sessions.map((session) => (
                    <SessionItem
                      key={session.id}
                      session={session}
                      isActive={session.id === activeSessionId}
                      onSelect={() => onSelectSession(session.id)}
                      onDelete={() => onDeleteSession(session.id)}
                      onRename={(newName) => onRenameSession(session.id, newName)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}

          {filteredProjects.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare size={24} className="mx-auto mb-2 opacity-50" />
              <p className="text-xs">暂无会话</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* 底部 - 设置按钮 */}
      <div className="mt-auto pt-3 border-t border-border">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-white/50 transition-colors"
        >
          <Settings size={16} />
          <span>设置</span>
        </button>
      </div>
    </div>
  )
}

interface SessionItemProps {
  session: SessionInfo
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
  onRename: (newName: string) => void
}

function SessionItem({ session, isActive, onSelect, onDelete, onRename }: SessionItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(session.name)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleStartRename = () => {
    setEditName(session.name)
    setIsEditing(true)
    // 延迟聚焦，等待 DOM 更新
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
  }

  const handleConfirmRename = () => {
    const trimmedName = editName.trim()
    if (trimmedName && trimmedName !== session.name) {
      onRename(trimmedName)
    }
    setIsEditing(false)
  }

  const handleCancelRename = () => {
    setEditName(session.name)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirmRename()
    } else if (e.key === 'Escape') {
      handleCancelRename()
    }
  }

  return (
    <div
      className={cn(
        'group flex items-start gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all',
        isActive
          ? 'bg-white/80 shadow-sm border border-border'
          : 'hover:bg-white/50'
      )}
      onClick={onSelect}
    >
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleConfirmRename}
            onKeyDown={handleKeyDown}
            className="w-full text-sm font-medium bg-white border border-primary rounded px-1.5 py-0.5 outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className={cn('text-sm font-medium truncate', isActive ? 'text-foreground' : 'text-foreground/80')}>
            {session.name}
            <span className="text-[9px] bg-muted px-1 rounded text-muted-foreground ml-2">默认</span>
          </div>
        )}
      </div>

      {/* 操作菜单 */}
      {!isEditing && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="opacity-0 group-hover:opacity-100 h-6 w-6"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal size={12} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent sideOffset={5}>
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleStartRename() }}>
              <Edit3 size={12} />
              重命名
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onSelect={onDelete}>
              <Trash2 size={12} />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
