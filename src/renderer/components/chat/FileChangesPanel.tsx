import { useState, useMemo } from 'react'
import {
  FileEdit,
  FilePlus,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { PatchDiff } from '@pierre/diffs/react'
import { cn } from '@/renderer/lib/utils'
import type { ToolCall } from '@/shared/types'
import { useTheme } from '@/renderer/contexts/ThemeContext'
import {
  customDiffToUnifiedPatch,
  countDiffLinesFromPatch,
  buildWriteDiff,
  getToolFilePath,
  getWriteContent,
} from '@/renderer/lib/diff-utils'

interface MergedFileChange {
  filePath: string
  additions: number
  deletions: number
  type: 'write' | 'edit'
  diff?: string
}

interface FileChangesPanelProps {
  toolCalls: ToolCall[]
  isStreaming?: boolean
  defaultExpanded?: boolean
  fontSize?: number
}

export function FileChangesPanel({ toolCalls, isStreaming, defaultExpanded = false, fontSize }: FileChangesPanelProps) {
  const [isListExpanded, setIsListExpanded] = useState(defaultExpanded)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const { isDark } = useTheme()
  const iconScale = fontSize ? fontSize / 14 : 1
  const s14 = Math.round(14 * iconScale)
  const s12 = Math.round(12 * iconScale)
  const s10 = Math.round(10 * iconScale)

  const mergedChanges = useMemo(() => {
    const fileMap = new Map<string, MergedFileChange>()

    for (const tc of toolCalls) {
      const name = tc.name?.toLowerCase()
      if (name !== 'write' && name !== 'edit') continue

      const filePath = getToolFilePath(tc.args)
      if (!filePath) continue

      const existing = fileMap.get(filePath)
      if (existing) {
        if (name === 'edit' && tc.details?.diff) {
          const { additions, deletions } = countDiffLinesFromPatch(
            customDiffToUnifiedPatch(tc.details.diff, filePath)
          )
          existing.additions += additions
          existing.deletions += deletions
          existing.diff = customDiffToUnifiedPatch(tc.details.diff, filePath)
        } else if (name === 'write') {
          const content = getWriteContent(tc.result)
          const lineCount = content ? content.split('\n').filter(l => l.trim()).length : 0
          existing.additions += lineCount
          existing.diff = buildWriteDiff(filePath, content)
        }
        continue
      }

      if (name === 'edit' && tc.details?.diff) {
        const unified = customDiffToUnifiedPatch(tc.details.diff, filePath)
        const { additions, deletions } = countDiffLinesFromPatch(unified)
        fileMap.set(filePath, {
          filePath,
          additions,
          deletions,
          type: 'edit',
          diff: unified,
        })
      } else if (name === 'write') {
        const content = getWriteContent(tc.result)
        const lineCount = content ? content.split('\n').filter(l => l.trim()).length : 0
        fileMap.set(filePath, {
          filePath,
          additions: lineCount,
          deletions: 0,
          type: 'write',
          diff: buildWriteDiff(filePath, content),
        })
      }
    }

    return Array.from(fileMap.values())
  }, [toolCalls])

  const totalAdditions = mergedChanges.reduce((sum, f) => sum + f.additions, 0)
  const totalDeletions = mergedChanges.reduce((sum, f) => sum + f.deletions, 0)

  if (mergedChanges.length === 0) return null

  return (
    <div className="mb-0" style={fontSize ? { fontSize: `${fontSize}px` } : undefined}>
      <button
        onClick={() => setIsListExpanded(!isListExpanded)}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        <FileEdit size={s14} className={cn(isStreaming && 'animate-pulse')} />
        <span>{mergedChanges.length} 个文件已更改</span>
        <span className="text-xs font-mono">
          <span className="text-emerald-600">+{totalAdditions}</span>
          <span className="text-muted-foreground mx-0.5">/</span>
          <span className="text-red-500">-{totalDeletions}</span>
        </span>
        <ChevronDown
          size={s12}
          className={cn(
            'transition-transform',
            isListExpanded && 'rotate-180'
          )}
        />
      </button>

      {isListExpanded && (
        <div className="mt-1.5 pl-5 border-l-2 border-muted space-y-0.5">
          {mergedChanges.map((file) => {
            const isSelected = selectedFile === file.filePath
            return (
              <div key={file.filePath}>
                <button
                  onClick={() => setSelectedFile(isSelected ? null : file.filePath)}
                  className={cn(
                    'w-full flex items-center gap-2 py-1 transition-colors rounded',
                    'hover:bg-muted/50 px-1.5',
                    isSelected && 'bg-muted/50'
                  )}
                >
                  {file.type === 'write' ? (
                    <FilePlus size={s14} className="text-purple-500 shrink-0" />
                  ) : (
                    <FileEdit size={s14} className="text-orange-500 shrink-0" />
                  )}

                  <span className="font-mono text-left truncate text-foreground">
                    {file.filePath}
                  </span>

                  <span className="text-xs font-mono font-semibold shrink-0">
                    <span className="text-emerald-600">+{file.additions}</span>
                    {file.deletions > 0 && (
                      <>
                        <span className="text-muted-foreground mx-0.5">/</span>
                        <span className="text-red-500">-{file.deletions}</span>
                      </>
                    )}
                  </span>

                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full shrink-0" />

                  <ChevronRight
                    size={s10}
                    className={cn(
                      'transition-transform text-muted-foreground shrink-0',
                      isSelected && 'rotate-90'
                    )}
                  />
                </button>

                {isSelected && file.diff && (
                  <div className="ml-2 mt-1 mb-2">
                    <div className="rounded-md border border-border/50 max-h-96 overflow-y-auto scrollbar-thin">
                      <PatchDiff
                        patch={file.diff}
                        options={{
                          themeType: isDark ? 'dark' : 'light',
                          disableLineNumbers: false,
                          overflow: 'scroll',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
