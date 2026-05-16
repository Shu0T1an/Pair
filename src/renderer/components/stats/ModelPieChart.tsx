import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

interface ModelStats {
  model: string
  provider: string
  totalTokens: number
  percentage: number
}

interface ModelPieChartProps {
  modelStats: ModelStats[]
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00C49F']

export function ModelPieChart({ modelStats }: ModelPieChartProps) {
  return (
    <div className="bg-muted/50 rounded-xl p-4">
      <h3 className="text-sm font-medium mb-4">模型分布</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={modelStats}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={2}
            dataKey="totalTokens"
            nameKey="model"
          >
            {modelStats.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [`${Number(value).toLocaleString()} tokens`, '使用量']}
          />
          <Legend
            formatter={(value: string) => (
              <span className="text-xs">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
