import { useState, useEffect } from 'react'
import { BarChart3, X } from 'lucide-react'
import { StatsOverview } from './stats/StatsOverview'
import { HeatmapChart } from './stats/HeatmapChart'
import { TrendChart } from './stats/TrendChart'
import { ModelPieChart } from './stats/ModelPieChart'
import { TokenBreakdown } from './stats/TokenBreakdown'
import type { OverviewStats } from '@/shared/types'

interface StatsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function StatsModal({ isOpen, onClose }: StatsModalProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [overview, setOverview] = useState<OverviewStats | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadStats()
    }
  }, [isOpen])

  const loadStats = async () => {
    setIsLoading(true)
    try {
      const data = await window.electronAPI.stats.getOverview()
      setOverview(data)
    } catch (error) {
      console.error('加载统计数据失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 统计面板 */}
      <div className="relative w-[900px] h-[640px] bg-background rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 h-14 border-b border-border">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-foreground" />
            <span className="text-sm font-semibold">使用统计</span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center transition-colors"
          >
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 p-6 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-muted-foreground">加载中...</span>
            </div>
          ) : overview ? (
            <div className="space-y-6">
              {/* 概览卡片 */}
              <StatsOverview
                totalTokens={overview.totalTokens}
                todayTokens={overview.todayTokens}
                totalSessions={overview.totalSessions}
              />

              {/* 热力图 */}
              <HeatmapChart dailyStats={overview.dailyStats} />

              {/* 趋势图和模型分布 */}
              <div className="grid grid-cols-2 gap-4">
                <TrendChart trendData={overview.trendData} />
                <ModelPieChart modelStats={overview.modelStats} />
              </div>

              {/* 细分统计 */}
              <TokenBreakdown dailyStats={overview.dailyStats} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="text-muted-foreground">暂无数据</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
