import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { StatsManager, type StatsRecord } from '../stats-manager'

describe('StatsManager', () => {
  let tmpDir: string
  let statsManager: StatsManager

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stats-test-'))
    statsManager = new StatsManager(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('appendRecords', () => {
    it('应该追加记录到 stats.jsonl', () => {
      const records: StatsRecord[] = [{
        timestamp: '2026-05-16T06:30:00.000Z',
        sessionId: 'session-1',
        model: 'mimo-v2.5-pro',
        provider: 'Mimo',
        input: 42,
        output: 136,
        cacheRead: 9920,
        cacheWrite: 0,
        totalTokens: 10098
      }]

      statsManager.appendRecords(records)

      const content = fs.readFileSync(path.join(tmpDir, 'stats.jsonl'), 'utf-8')
      const lines = content.trim().split('\n')
      expect(lines).toHaveLength(1)
      expect(JSON.parse(lines[0])).toEqual(records[0])
    })

    it('应该追加多条记录', () => {
      const records: StatsRecord[] = [
        {
          timestamp: '2026-05-16T06:30:00.000Z',
          sessionId: 'session-1',
          model: 'mimo-v2.5-pro',
          provider: 'Mimo',
          input: 42,
          output: 136,
          cacheRead: 9920,
          cacheWrite: 0,
          totalTokens: 10098
        },
        {
          timestamp: '2026-05-16T06:35:00.000Z',
          sessionId: 'session-1',
          model: 'mimo-v2.5-pro',
          provider: 'Mimo',
          input: 100,
          output: 500,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 600
        }
      ]

      statsManager.appendRecords(records)

      const content = fs.readFileSync(path.join(tmpDir, 'stats.jsonl'), 'utf-8')
      const lines = content.trim().split('\n')
      expect(lines).toHaveLength(2)
    })

    it('空记录数组不应写入文件', () => {
      statsManager.appendRecords([])

      expect(fs.existsSync(path.join(tmpDir, 'stats.jsonl'))).toBe(false)
    })
  })

  describe('getOverview', () => {
    it('应该正确聚合统计数据', () => {
      // 准备测试数据（使用过去的日期）
      const records: StatsRecord[] = [
        {
          timestamp: '2026-01-15T06:30:00.000Z',
          sessionId: 'session-1',
          model: 'mimo-v2.5-pro',
          provider: 'Mimo',
          input: 100,
          output: 200,
          cacheRead: 1000,
          cacheWrite: 0,
          totalTokens: 1300
        },
        {
          timestamp: '2026-01-15T07:30:00.000Z',
          sessionId: 'session-1',
          model: 'mimo-v2.5-pro',
          provider: 'Mimo',
          input: 50,
          output: 100,
          cacheRead: 500,
          cacheWrite: 0,
          totalTokens: 650
        },
        {
          timestamp: '2026-01-14T10:00:00.000Z',
          sessionId: 'session-2',
          model: 'claude-opus-4-7',
          provider: 'anthropic',
          input: 200,
          output: 400,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 600
        }
      ]

      statsManager.appendRecords(records)
      const overview = statsManager.getOverview()

      // 验证总 Token 数
      expect(overview.totalTokens).toBe(2550) // 1300 + 650 + 600

      // 验证今日消耗（因为测试数据不是今天的，所以应该是 0）
      expect(overview.todayTokens).toBe(0)

      // 验证会话数
      expect(overview.totalSessions).toBe(2)

      // 验证模型分布
      expect(overview.modelStats).toHaveLength(2)
      expect(overview.modelStats[0].model).toBe('mimo-v2.5-pro')
      expect(overview.modelStats[0].totalTokens).toBe(1950)
      expect(overview.modelStats[0].percentage).toBe(76) // 1950/2550 ≈ 76%
      expect(overview.modelStats[1].model).toBe('claude-opus-4-7')
      expect(overview.modelStats[1].totalTokens).toBe(600)
      expect(overview.modelStats[1].percentage).toBe(24) // 600/2550 ≈ 24%
    })

    it('应该生成 365 天的热力图数据', () => {
      statsManager.appendRecords([{
        timestamp: '2026-05-16T06:30:00.000Z',
        sessionId: 'session-1',
        model: 'mimo-v2.5-pro',
        provider: 'Mimo',
        input: 100,
        output: 200,
        cacheRead: 1000,
        cacheWrite: 0,
        totalTokens: 1300
      }])

      const overview = statsManager.getOverview()

      // 验证 365 天数据
      expect(overview.dailyStats).toHaveLength(365)
      
      // 验证最后一天（今天）有数据
      const today = overview.dailyStats[overview.dailyStats.length - 1]
      expect(today.totalTokens).toBe(1300)
      
      // 验证其他天为 0
      const yesterday = overview.dailyStats[overview.dailyStats.length - 2]
      expect(yesterday.totalTokens).toBe(0)
    })

    it('空数据应返回空概览', () => {
      const overview = statsManager.getOverview()

      expect(overview.totalTokens).toBe(0)
      expect(overview.todayTokens).toBe(0)
      expect(overview.totalSessions).toBe(0)
      expect(overview.modelStats).toHaveLength(0)
      expect(overview.dailyStats).toHaveLength(365) // 仍然生成 365 天框架
    })
  })
})
