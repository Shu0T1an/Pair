import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTabState } from '../useTabState'
import type { SessionInfo } from '@/shared/types'

const STORAGE_KEY = 'pair-open-tabs'
const MAX_TABS = 10

function makeSession(id: string, overrides: Partial<SessionInfo> = {}): SessionInfo {
  return {
    id,
    name: `Session ${id}`,
    projectPath: '/test',
    createdAt: new Date(),
    updatedAt: new Date(),
    messageCount: 0,
    model: 'gpt-4',
    ...overrides,
  }
}

describe('useTabState', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // ── 1. Default ──
  describe('default state', () => {
    it('should start with empty tabs', () => {
      const { result } = renderHook(() => useTabState())
      expect(result.current.openTabIds).toEqual([])
    })

    it('should report no tab exists', () => {
      const { result } = renderHook(() => useTabState())
      expect(result.current.hasTab('any')).toBe(false)
    })

    it('should return empty getTabSessions', () => {
      const { result } = renderHook(() => useTabState())
      expect(result.current.getTabSessions([])).toEqual([])
    })
  })

  // ── 2. localStorage restoration ──
  describe('localStorage restoration', () => {
    it('should restore saved tab IDs', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionIds: ['tab-1', 'tab-2'] }))
      const { result } = renderHook(() => useTabState())
      expect(result.current.openTabIds).toEqual(['tab-1', 'tab-2'])
    })

    it('should handle corrupt localStorage', () => {
      localStorage.setItem(STORAGE_KEY, '{corrupt}')
      const { result } = renderHook(() => useTabState())
      expect(result.current.openTabIds).toEqual([])
    })

    it('should handle empty string in localStorage', () => {
      localStorage.setItem(STORAGE_KEY, '')
      const { result } = renderHook(() => useTabState())
      expect(result.current.openTabIds).toEqual([])
    })

    it('should restore single tab', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionIds: ['only-tab'] }))
      const { result } = renderHook(() => useTabState())
      expect(result.current.openTabIds).toEqual(['only-tab'])
    })
  })

  // ── 3. addTab ──
  describe('addTab', () => {
    it('should add tab to the front', () => {
      const { result } = renderHook(() => useTabState())
      act(() => { result.current.addTab('tab-1') })
      expect(result.current.openTabIds).toEqual(['tab-1'])
    })

    it('should prepend new tabs', () => {
      const { result } = renderHook(() => useTabState())
      act(() => { result.current.addTab('tab-1') })
      act(() => { result.current.addTab('tab-2') })
      expect(result.current.openTabIds).toEqual(['tab-2', 'tab-1'])
    })

    it('should not add duplicate', () => {
      const { result } = renderHook(() => useTabState())
      act(() => { result.current.addTab('tab-1') })
      act(() => { result.current.addTab('tab-2') })
      act(() => { result.current.addTab('tab-1') })
      expect(result.current.openTabIds).toEqual(['tab-2', 'tab-1'])
    })

    it('should not reorder existing tab when re-adding', () => {
      const { result } = renderHook(() => useTabState())
      act(() => { result.current.addTab('tab-1') })
      act(() => { result.current.addTab('tab-2') })
      act(() => { result.current.addTab('tab-3') })
      act(() => { result.current.addTab('tab-1') })
      expect(result.current.openTabIds).toEqual(['tab-3', 'tab-2', 'tab-1'])
    })

    it('should limit tabs to MAX_TABS', () => {
      const { result } = renderHook(() => useTabState())
      for (let i = 0; i < MAX_TABS + 5; i++) {
        act(() => { result.current.addTab(`tab-${i}`) })
      }
      expect(result.current.openTabIds).toHaveLength(MAX_TABS)
      expect(result.current.openTabIds[0]).toBe(`tab-${MAX_TABS + 4}`)
    })

    it('should keep last opened tabs when exceeding limit', () => {
      const { result } = renderHook(() => useTabState())
      for (let i = 0; i < MAX_TABS + 3; i++) {
        act(() => { result.current.addTab(`tab-${i}`) })
      }
      expect(result.current.openTabIds).toHaveLength(MAX_TABS)
      expect(result.current.openTabIds[MAX_TABS - 1]).toBe(`tab-${3}`)
    })
  })

  // ── 4. closeTab ──
  describe('closeTab', () => {
    function setupTabs(tabIds: string[]) {
      const { result } = renderHook(() => useTabState())
      for (const id of tabIds) {
        act(() => { result.current.addTab(id) })
      }
      return result
    }

    it('should remove the tab', () => {
      const result = setupTabs(['tab-1', 'tab-2', 'tab-3'])
      act(() => { result.current.closeTab('tab-2') })
      expect(result.current.openTabIds).toEqual(['tab-3', 'tab-1'])
    })

    it('should do nothing for non-existent tab', () => {
      const result = setupTabs(['tab-1', 'tab-2'])
      act(() => { result.current.closeTab('non-existent') })
      expect(result.current.openTabIds).toEqual(['tab-2', 'tab-1'])
    })

    it('should return undefined when closing non-current tab', () => {
      const result = setupTabs(['tab-1', 'tab-2', 'tab-3'])
      let nextTab: string | undefined
      act(() => {
        nextTab = result.current.closeTab('tab-3', 'tab-1')
      })
      expect(nextTab).toBeUndefined()
    })

    it('should return next tab when closing first current tab', () => {
      const result = setupTabs(['tab-1', 'tab-2', 'tab-3'])
      let nextTab: string | undefined
      act(() => {
        nextTab = result.current.closeTab('tab-3', 'tab-3')
      })
      expect(nextTab).toBe('tab-2')
    })

    it('should return previous tab when closing middle current tab', () => {
      const result = setupTabs(['tab-1', 'tab-2', 'tab-3'])
      let nextTab: string | undefined
      act(() => {
        nextTab = result.current.closeTab('tab-2', 'tab-2')
      })
      expect(nextTab).toBe('tab-3')
    })

    it('should return last tab when closing last current tab', () => {
      const result = setupTabs(['tab-1', 'tab-2', 'tab-3'])
      let nextTab: string | undefined
      act(() => {
        nextTab = result.current.closeTab('tab-1', 'tab-1')
      })
      expect(nextTab).toBe('tab-2')
    })

    it('should return undefined when closing last remaining current tab', () => {
      const result = setupTabs(['only-one'])
      let nextTab: string | undefined
      act(() => {
        nextTab = result.current.closeTab('only-one', 'only-one')
      })
      expect(nextTab).toBeUndefined()
    })
  })

  // ── 5. closeAllTabs ──
  describe('closeAllTabs', () => {
    it('should clear all tabs', () => {
      const { result } = renderHook(() => useTabState())
      act(() => { result.current.addTab('tab-1') })
      act(() => { result.current.addTab('tab-2') })
      act(() => { result.current.closeAllTabs() })
      expect(result.current.openTabIds).toEqual([])
    })

    it('should work with empty tabs', () => {
      const { result } = renderHook(() => useTabState())
      act(() => { result.current.closeAllTabs() })
      expect(result.current.openTabIds).toEqual([])
    })
  })

  // ── 6. hasTab ──
  describe('hasTab', () => {
    it('should return true for existing tab', () => {
      const { result } = renderHook(() => useTabState())
      act(() => { result.current.addTab('exists') })
      expect(result.current.hasTab('exists')).toBe(true)
    })

    it('should return false for non-existing tab', () => {
      const { result } = renderHook(() => useTabState())
      act(() => { result.current.addTab('exists') })
      expect(result.current.hasTab('non-existent')).toBe(false)
    })

    it('should return false after tab is closed', () => {
      const { result } = renderHook(() => useTabState())
      act(() => { result.current.addTab('temp') })
      act(() => { result.current.closeTab('temp') })
      expect(result.current.hasTab('temp')).toBe(false)
    })
  })

  // ── 7. getTabSessions ──
  describe('getTabSessions', () => {
    it('should map tab IDs to session info', () => {
      const { result } = renderHook(() => useTabState())
      act(() => { result.current.addTab('sess-1') })
      act(() => { result.current.addTab('sess-2') })

      const sessions = [
        makeSession('sess-1', { name: 'Session One' }),
        makeSession('sess-2', { name: 'Session Two' }),
      ]

      const tabSessions = result.current.getTabSessions(sessions)
      expect(tabSessions).toHaveLength(2)
      expect(tabSessions[0].name).toBe('Session Two')
      expect(tabSessions[1].name).toBe('Session One')
    })

    it('should ignore sessions that no longer exist', () => {
      const { result } = renderHook(() => useTabState())
      act(() => { result.current.addTab('existing') })
      act(() => { result.current.addTab('deleted') })

      const sessions = [makeSession('existing', { name: 'Still Here' })]
      const tabSessions = result.current.getTabSessions(sessions)

      expect(tabSessions).toHaveLength(1)
      expect(tabSessions[0].name).toBe('Still Here')
    })

    it('should maintain tab order', () => {
      const { result } = renderHook(() => useTabState())
      act(() => { result.current.addTab('a') })
      act(() => { result.current.addTab('b') })
      act(() => { result.current.addTab('c') })

      const sessions = [
        makeSession('a'),
        makeSession('b'),
        makeSession('c'),
      ]

      const tabSessions = result.current.getTabSessions(sessions)
      expect(tabSessions.map(s => s.id)).toEqual(['c', 'b', 'a'])
    })

    it('should return empty array when no tabs', () => {
      const { result } = renderHook(() => useTabState())
      expect(result.current.getTabSessions([])).toEqual([])
    })
  })

  // ── 8. localStorage persistence ──
  describe('localStorage persistence', () => {
    it('should persist after addTab', () => {
      const { result } = renderHook(() => useTabState())
      act(() => { result.current.addTab('persist-tab') })

      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(saved.sessionIds).toEqual(['persist-tab'])
    })

    it('should persist after closeTab', () => {
      const { result } = renderHook(() => useTabState())
      act(() => { result.current.addTab('tab-1') })
      act(() => { result.current.addTab('tab-2') })
      act(() => { result.current.closeTab('tab-1') })

      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(saved.sessionIds).toEqual(['tab-2'])
    })

    it('should persist after closeAllTabs', () => {
      const { result } = renderHook(() => useTabState())
      act(() => { result.current.addTab('tab-1') })
      act(() => { result.current.closeAllTabs() })

      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(saved.sessionIds).toEqual([])
    })

    it('should restore persisted tabs on new hook instance', () => {
      const { result: first } = renderHook(() => useTabState())
      act(() => { first.current.addTab('survive-restart') })

      const { result: second } = renderHook(() => useTabState())
      expect(second.current.openTabIds).toEqual(['survive-restart'])
    })
  })
})
