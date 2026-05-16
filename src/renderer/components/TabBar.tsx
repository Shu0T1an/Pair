import { useRef, useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { TabItem } from './TabItem'
import type { SessionInfo } from '@/shared/types'

interface TabBarProps {
  tabs: SessionInfo[]
  activeSessionId?: string
  onSelect: (sessionId: string) => void
  onClose: (sessionId: string) => void
  onCloseAll: () => void
}

export function TabBar({ tabs, activeSessionId, onSelect, onClose, onCloseAll }: TabBarProps) {
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
    <div className="flex items-center bg-muted/50 border-b border-border pr-4">
      {/* 滚动按钮 - 左 */}
      {canScrollLeft && (
        <button
          className="shrink-0 p-1 hover:bg-muted transition-colors"
          onClick={() => scroll('left')}
        >
          <ChevronLeft size={16} />
        </button>
      )}

      {/* 标签容器 */}
      <div
        ref={scrollContainerRef}
        className="flex-1 flex justify-start overflow-x-auto scrollbar-hide"
      >
        {tabs.map((session) => (
          <TabItem
            key={session.id}
            session={session}
            isActive={session.id === activeSessionId}
            onSelect={() => onSelect(session.id)}
            onClose={() => onClose(session.id)}
            onCloseAll={onCloseAll}
          />
        ))}
      </div>

      {/* 滚动按钮 - 右 */}
      {canScrollRight && (
        <button
          className="shrink-0 p-1 hover:bg-muted transition-colors"
          onClick={() => scroll('right')}
        >
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  )
}
