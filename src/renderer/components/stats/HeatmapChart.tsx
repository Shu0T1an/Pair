import { ActivityCalendar, type Activity } from 'react-activity-calendar'

interface HeatmapChartProps {
  dailyStats: Array<{
    date: string
    totalTokens: number
  }>
}

export function HeatmapChart({ dailyStats }: HeatmapChartProps) {
  // 转换为 react-activity-calendar 格式
  const activities: Activity[] = dailyStats.map(day => ({
    date: day.date,
    count: day.totalTokens,
    level: getLevel(day.totalTokens)
  }))

  return (
    <div className="bg-muted/50 rounded-xl p-4">
      <h3 className="text-sm font-medium mb-4">过去 365 天使用情况</h3>
      <ActivityCalendar
        data={activities}
        labels={{
          months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
          weekdays: ['日', '一', '二', '三', '四', '五', '六'],
          totalCount: '{{year}} 年共使用 {{count}} tokens',
          legend: {
            less: '少',
            more: '多'
          }
        }}
        theme={{
          light: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
          dark: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353']
        }}
        fontSize={12}
        blockSize={12}
        blockMargin={2}
      />
    </div>
  )
}

function getLevel(tokens: number): 0 | 1 | 2 | 3 | 4 {
  if (tokens === 0) return 0
  if (tokens < 1000) return 1
  if (tokens < 5000) return 2
  if (tokens < 10000) return 3
  return 4
}
