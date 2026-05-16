import path from 'path'
import fs from 'fs'

export interface StatsRecord {
  timestamp: string
  sessionId: string
  model: string
  provider: string
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  totalTokens: number
}

export interface DailyStats {
  date: string
  totalTokens: number
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

export interface ModelStats {
  model: string
  provider: string
  totalTokens: number
  percentage: number
}

export interface OverviewStats {
  totalTokens: number
  todayTokens: number
  totalSessions: number
  dailyStats: DailyStats[]
  modelStats: ModelStats[]
  trendData: {
    daily: DailyStats[]
    weekly: DailyStats[]
    monthly: DailyStats[]
  }
}

export class StatsManager {
  private statsPath: string

  constructor(dataRoot: string) {
    this.statsPath = path.join(dataRoot, 'stats.jsonl')
    console.log('[StatsManager] 初始化, statsPath:', this.statsPath)
  }

  /**
   * 追加记录到 stats.jsonl
   */
  appendRecords(records: StatsRecord[]): void {
    if (records.length === 0) return

    // 确保目录存在
    const dir = path.dirname(this.statsPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // 追加写入
    const lines = records.map(r => JSON.stringify(r)).join('\n') + '\n'
    fs.appendFileSync(this.statsPath, lines, 'utf-8')
  }

  /**
   * 获取概览统计数据
   */
  getOverview(): OverviewStats {
    const records = this.loadAllRecords()
    
    // 按日期聚合
    const dailyMap = new Map<string, DailyStats>()
    // 按模型聚合
    const modelMap = new Map<string, ModelStats>()
    // 会话集合
    const sessionSet = new Set<string>()
    
    for (const record of records) {
      // 日期聚合
      const date = record.timestamp.split('T')[0]
      let daily = dailyMap.get(date)
      if (!daily) {
        daily = { date, totalTokens: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
        dailyMap.set(date, daily)
      }
      daily.totalTokens += record.totalTokens
      daily.input += record.input
      daily.output += record.output
      daily.cacheRead += record.cacheRead
      daily.cacheWrite += record.cacheWrite
      
      // 模型聚合
      let model = modelMap.get(record.model)
      if (!model) {
        model = { model: record.model, provider: record.provider, totalTokens: 0, percentage: 0 }
        modelMap.set(record.model, model)
      }
      model.totalTokens += record.totalTokens
      
      // 会话统计
      sessionSet.add(record.sessionId)
    }
    
    // 计算百分比
    const totalTokens = records.reduce((sum, r) => sum + r.totalTokens, 0)
    for (const model of modelMap.values()) {
      model.percentage = totalTokens > 0 ? Math.round((model.totalTokens / totalTokens) * 100) : 0
    }
    
    // 计算今日消耗
    const today = new Date().toISOString().split('T')[0]
    const todayStats = dailyMap.get(today)
    const todayTokens = todayStats ? todayStats.totalTokens : 0
    
    // 生成 365 天数据（热力图用）
    const dailyStats = this.generateLast365Days(dailyMap)
    
    // 生成趋势数据
    const trendData = {
      daily: dailyStats,
      weekly: this.aggregateByWeek(dailyMap),
      monthly: this.aggregateByMonth(dailyMap)
    }
    
    return {
      totalTokens,
      todayTokens,
      totalSessions: sessionSet.size,
      dailyStats,
      modelStats: Array.from(modelMap.values()).sort((a, b) => b.totalTokens - a.totalTokens),
      trendData
    }
  }

  /**
   * 加载所有记录
   */
  private loadAllRecords(): StatsRecord[] {
    if (!fs.existsSync(this.statsPath)) {
      return []
    }
    
    const content = fs.readFileSync(this.statsPath, 'utf-8')
    const lines = content.trim().split('\n').filter(line => line)
    
    return lines.map(line => {
      try {
        return JSON.parse(line) as StatsRecord
      } catch {
        return null
      }
    }).filter((r): r is StatsRecord => r !== null)
  }

  /**
   * 生成最近 365 天的数据
   */
  private generateLast365Days(dailyMap: Map<string, DailyStats>): DailyStats[] {
    const result: DailyStats[] = []
    const today = new Date()
    
    for (let i = 364; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      
      const existing = dailyMap.get(dateStr)
      result.push(existing || {
        date: dateStr,
        totalTokens: 0,
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0
      })
    }
    
    return result
  }

  /**
   * 按周聚合
   */
  private aggregateByWeek(dailyMap: Map<string, DailyStats>): DailyStats[] {
    const weekMap = new Map<string, DailyStats>()
    
    for (const daily of dailyMap.values()) {
      const date = new Date(daily.date)
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay()) // 周日为一周开始
      const weekStr = weekStart.toISOString().split('T')[0]
      
      let week = weekMap.get(weekStr)
      if (!week) {
        week = { date: weekStr, totalTokens: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
        weekMap.set(weekStr, week)
      }
      week.totalTokens += daily.totalTokens
      week.input += daily.input
      week.output += daily.output
      week.cacheRead += daily.cacheRead
      week.cacheWrite += daily.cacheWrite
    }
    
    return Array.from(weekMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  }

  /**
   * 按月聚合
   */
  private aggregateByMonth(dailyMap: Map<string, DailyStats>): DailyStats[] {
    const monthMap = new Map<string, DailyStats>()
    
    for (const daily of dailyMap.values()) {
      const monthStr = daily.date.substring(0, 7) // "2026-05"
      
      let month = monthMap.get(monthStr)
      if (!month) {
        month = { date: monthStr, totalTokens: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
        monthMap.set(monthStr, month)
      }
      month.totalTokens += daily.totalTokens
      month.input += daily.input
      month.output += daily.output
      month.cacheRead += daily.cacheRead
      month.cacheWrite += daily.cacheWrite
    }
    
    return Array.from(monthMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  }
}
