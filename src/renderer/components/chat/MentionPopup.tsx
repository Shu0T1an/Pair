import { useState, useEffect, useRef, useCallback } from 'react'
import { File, Folder } from 'lucide-react'
import { cn } from '@/renderer/lib/utils'
import { ipcClient } from '@/renderer/ipc-client'

export interface FileSearchItem {
  relativePath: string
  absolutePath: string
  isDirectory: boolean
}

interface MentionPopupProps {
  query: string
  projectPath: string
  selectedIndex: number
  onSelect: (item: FileSearchItem) => void
  onResultsChange: (results: FileSearchItem[]) => void
}

export function MentionPopup({
  query,
  projectPath,
  selectedIndex,
  onSelect,
  onResultsChange,
}: MentionPopupProps) {
  const [results, setResults] = useState<FileSearchItem[]>([])
  const [loading, setLoading] = useState(false)
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  useEffect(() => {
    if (selectedIndex < 0) return
    const el = itemRefs.current.get(selectedIndex)
    if (el) {
      el.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  useEffect(() => {
    setLoading(true)
    if (!query.trim()) {
      // 空查询时直接返回空结果，但 loading 标记会触发渲染
      // 稍后 loading 结束时再用空结果渲染 null
      const timer = setTimeout(() => {
        setResults([])
        onResultsChange([])
        setLoading(false)
      }, 50)
      return () => clearTimeout(timer)
    }

    const timer = setTimeout(async () => {
      try {
        const items = await ipcClient.searchFiles(projectPath, query) as FileSearchItem[]
        setResults(items)
        onResultsChange(items)
      } catch {
        setResults([])
        onResultsChange([])
      }
      setLoading(false)
    }, 100)

    return () => clearTimeout(timer)
  }, [query, projectPath]) // eslint-disable-line react-hooks/exhaustive-deps

  const highlightMatch = useCallback((text: string, query: string) => {
    if (!query) return text
    const idx = text.toLowerCase().indexOf(query.toLowerCase())
    if (idx < 0) return text
    return (
      <>
        {text.slice(0, idx)}
        <span className="text-primary font-medium">{text.slice(idx, idx + query.length)}</span>
        {text.slice(idx + query.length)}
      </>
    )
  }, [])

  if (results.length === 0 && !loading) return null

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 z-50 bg-popover border border-border rounded-xl shadow-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground border-b border-border">
        <span>{loading ? '搜索中...' : `文件 (${results.length})`}</span>
        <span className="text-[10px]">↑↓ 选择 · Enter 确认 · Esc 关闭</span>
      </div>

      <div className="max-h-60 overflow-y-auto">
        {results.map((item, index) => (
          <button
            key={item.absolutePath}
            ref={(el) => { if (el) itemRefs.current.set(index, el); else itemRefs.current.delete(index) }}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
              index === selectedIndex
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-muted'
            )}
            onMouseDown={(e) => {
              e.preventDefault()
              onSelect(item)
            }}
          >
            {item.isDirectory ? (
              <Folder size={14} className="shrink-0 text-muted-foreground" />
            ) : (
              <File size={14} className="shrink-0 text-muted-foreground" />
            )}
            <span className="truncate font-mono text-xs">
              {highlightMatch(item.relativePath, query)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
