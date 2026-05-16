import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type TimeGranularity = 'daily' | 'weekly' | 'monthly'

interface TrendChartProps {
  trendData: {
    daily: Array<{ date: string; totalTokens: number }>
    weekly: Array<{ date: string; totalTokens: number }>
    monthly: Array<{ date: string; totalTokens: number }>
  }
}

export function TrendChart({ trendData }: TrendChartProps) {
  const [granularity, setGranularity] = useState<TimeGranularity>('daily')

  const data = trendData[granularity]
  const granularityOptions: { key: TimeGranularity; label: string }[] = [
    { key: 'daily', label: '日' },
    { key: 'weekly', label: '周' },
    { key: 'monthly', label: '月' },
  ]

  return (
    <div className="bg-muted/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">使用趋势</h3>
        <div className="flex gap-1">
          {granularityOptions.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setGranularity(key)}
              className={`px-2 py-1 text-xs rounded ${
                granularity === key
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" fontSize={10} />
          <YAxis fontSize={10} />
          <Tooltip
            formatter={(value: number) => [`${value.toLocaleString()} tokens`, '使用量']}
            labelFormatter={(label) => `日期: ${label}`}
          />
          <Area
            type="monotone"
            dataKey="totalTokens"
            stroke="#8884d8"
            fill="#8884d8"
            fillOpacity={0.3}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
