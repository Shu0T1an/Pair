import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'

interface ContextRingProps {
  percentage: number
  totalTokens: number
  usedTokens: number
  compactionThreshold?: number  // 压缩触发阈值（默认87%）
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`
  return tokens.toString()
}

export function ContextRing({ 
  percentage, 
  totalTokens, 
  usedTokens, 
  compactionThreshold = 87 
}: ContextRingProps) {
  const circumference = 2 * Math.PI * 18 // 半径18
  const offset = circumference - (percentage / 100) * circumference
  
  // 计算距离压缩还有多少
  const remaining = compactionThreshold - percentage
  const isNearCompaction = remaining < 20 && remaining > 0
  const isCompacting = percentage >= compactionThreshold
  
  // 颜色逻辑
  const getStrokeColor = () => {
    if (isCompacting) return '#ef4444' // 红色
    if (isNearCompaction) return '#eab308' // 黄色
    return '#22c55e' // 绿色
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative w-10 h-10 cursor-help">
            <svg className="w-full h-full -rotate-90">
              {/* 背景圆环 */}
              <circle 
                cx="20" cy="20" r="18" 
                stroke="currentColor" 
                strokeWidth="3" 
                fill="none" 
                className="text-muted-foreground/20" 
              />
              {/* 进度圆环 */}
              <circle 
                cx="20" cy="20" r="18" 
                stroke={getStrokeColor()}
                strokeWidth="3" 
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="transition-all duration-300"
              />
            </svg>
            
            {/* 中心内容 */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] font-mono">{percentage}%</span>
              {isNearCompaction && (
                <span className="text-[8px] text-yellow-500">-{remaining}%</span>
              )}
              {isCompacting && (
                <span className="text-[8px] text-red-500">压缩中</span>
              )}
            </div>
          </div>
        </TooltipTrigger>
        
        <TooltipContent side="top" className="w-64">
          <div className="space-y-2">
            <div className="font-medium">上下文使用情况</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>已使用:</div>
              <div className="font-mono">{formatTokens(usedTokens)}</div>
              <div>总容量:</div>
              <div className="font-mono">{formatTokens(totalTokens)}</div>
              <div>使用率:</div>
              <div className="font-mono">{percentage}%</div>
              <div>压缩阈值:</div>
              <div className="font-mono">{compactionThreshold}%</div>
            </div>
            
            {isNearCompaction && (
              <div className="text-yellow-500 text-sm">
                ⚠️ 距离自动压缩还有 {remaining}%
              </div>
            )}
            
            {isCompacting && (
              <div className="text-red-500 text-sm">
                🔄 正在压缩上下文...
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
