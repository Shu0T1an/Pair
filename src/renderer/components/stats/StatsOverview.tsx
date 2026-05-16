import { Zap, Calendar, MessageSquare, TrendingUp } from 'lucide-react'

interface StatsOverviewProps {
  totalTokens: number
  totalDays: number
  totalSessions: number
}

export function StatsOverview({ totalTokens, totalDays, totalSessions }: StatsOverviewProps) {
  const dailyAvg = totalDays > 0 ? Math.round(totalTokens / totalDays) : 0

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const cards = [
    { icon: Zap, label: '总 Token', value: formatNumber(totalTokens), color: 'text-yellow-500' },
    { icon: Calendar, label: '活跃天数', value: `${totalDays} 天`, color: 'text-blue-500' },
    { icon: MessageSquare, label: '会话数', value: `${totalSessions} 个`, color: 'text-green-500' },
    { icon: TrendingUp, label: '日均消耗', value: formatNumber(dailyAvg), color: 'text-purple-500' },
  ]

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map(({ icon: Icon, label, value, color }) => (
        <div key={label} className="bg-muted/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon size={16} className={color} />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
          <div className="text-2xl font-bold">{value}</div>
        </div>
      ))}
    </div>
  )
}
