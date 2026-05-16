import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface DailyStats {
  date: string
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

interface TokenBreakdownProps {
  dailyStats: DailyStats[]
}

export function TokenBreakdown({ dailyStats }: TokenBreakdownProps) {
  // 只显示最近 30 天
  const recentStats = dailyStats.slice(-30)

  return (
    <div className="bg-muted/50 rounded-xl p-4">
      <h3 className="text-sm font-medium mb-4">Token 细分（最近 30 天）</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={recentStats}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" fontSize={10} />
          <YAxis fontSize={10} />
          <Tooltip
            formatter={(value, name) => {
              const labels: Record<string, string> = {
                input: '输入',
                output: '输出',
                cacheRead: '缓存读取',
                cacheWrite: '缓存写入'
              }
              return [`${Number(value).toLocaleString()} tokens`, labels[String(name)] || name]
            }}
          />
          <Legend
            formatter={(value: string) => {
              const labels: Record<string, string> = {
                input: '输入',
                output: '输出',
                cacheRead: '缓存读取',
                cacheWrite: '缓存写入'
              }
              return <span className="text-xs">{labels[value] || value}</span>
            }}
          />
          <Bar dataKey="input" stackId="a" fill="#8884d8" />
          <Bar dataKey="output" stackId="a" fill="#82ca9d" />
          <Bar dataKey="cacheRead" stackId="a" fill="#ffc658" />
          <Bar dataKey="cacheWrite" stackId="a" fill="#ff7300" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
