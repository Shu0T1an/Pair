import { ChevronDown, ChevronRight, Folder } from 'lucide-react'

interface SkillItemProps {
  name: string
  description: string
  filePath: string
  scope: 'user' | 'project' | 'temporary'
  isExpanded: boolean
  onToggle: () => void
}

export function SkillItem({
  name,
  description,
  filePath,
  scope,
  isExpanded,
  onToggle,
}: SkillItemProps) {
  const scopeColors = {
    user: 'bg-blue-500/10 text-blue-500',
    project: 'bg-green-500/10 text-green-500',
    temporary: 'bg-yellow-500/10 text-yellow-500',
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* 头部 - 始终显示 */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown size={14} className="text-muted-foreground" />
          ) : (
            <ChevronRight size={14} className="text-muted-foreground" />
          )}
          <span className="text-sm font-medium">{name}</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${scopeColors[scope]}`}>
          {scope}
        </span>
      </button>

      {/* 展开内容 */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border">
          <p className="text-sm text-muted-foreground mb-3 whitespace-pre-wrap">
            {description}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Folder size={12} />
            <span className="truncate">{filePath}</span>
          </div>
        </div>
      )}
    </div>
  )
}
