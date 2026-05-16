import { useRef, useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { TabItem } from './TabItem'
import type { SessionInfo } from '@/shared/types'
import { cn } from '@/renderer/lib/utils'

interface TabBarProps {
  tabs: SessionInfo[]
  activeSessionId?: string
  onSelect: (sessionId: string) => void
  onClose: (sessionId: string) => void
}

export function TabBar({ tabs, activeSessionId, onSelect, onClose }: TabBarProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = () => {
    const container = scrollContainerRef.current
    if (!container) return
    setCanScrollLeft(container.scrollLeft > 0)
    setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 1)
  }

  useEffect(() => {
    checkScroll()
    const container = scrollContainerRef.current
    if (container) {
      container.addEventListener('scroll', checkScroll)
      // 监听 resize 事件
      const resizeObserver = new ResizeObserver(checkScroll)
      resizeObserver.observe(container)
      return () => {
        container.removeEventListener('scroll', checkScroll)
        resizeObserver.disconnect()
      }
    }
  }, [tabs])

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current
    if (!container) return
    const scrollAmount = 200
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  if (tabs.length === 0) return null

  return (
    <div className="flex items-center bg-muted/50 border-b border-border">
      {/* 滚动按钮 - 左 */}
      <button
        className={cn(
          'shrink-0 p-1 hover:bg-muted transition-colors',
          canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => scroll('left')}
      >
        <ChevronLeft size={16} />
      </button>

      {/* 标签容器 */}
      <div
        ref={scrollContainerRef}
        className="flex-1 flex overflow-x-auto scrollbar-hide"
      >
        {tabs.map((session) => (
          <TabItem
            key={session.id}
            session={session}
            isActive={session.id === activeSessionId}
            onSelect={() => onSelect(session.id)}
            onClose={() => onClose(session.id)}
          />
        ))}
      </div>

      {/* 滚动按钮 - 右 */}
      <button
        className={cn(
          'shrink-0 p-1 hover:bg-muted transition-colors',
          canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => scroll('right')}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
