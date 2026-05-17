import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, renderHook, act, screen } from '@testing-library/react'
import {
  GlobalStreamProvider,
  useGlobalStream,
  useSessionStream,
} from '@/renderer/contexts/GlobalStreamContext'
import type { ReactNode } from 'react'

const mockCallbacks: Record<string, (event: any) => void> = {}

vi.mock('@/renderer/ipc-client', () => ({
  ipcClient: {
    onMessageStart: vi.fn((cb: any) => { mockCallbacks.onMessageStart = cb; return vi.fn() }),
    onTextDelta: vi.fn((cb: any) => { mockCallbacks.onTextDelta = cb; return vi.fn() }),
    onThinkingDelta: vi.fn((cb: any) => { mockCallbacks.onThinkingDelta = cb; return vi.fn() }),
    onMessageEnd: vi.fn((cb: any) => { mockCallbacks.onMessageEnd = cb; return vi.fn() }),
    onToolStart: vi.fn((cb: any) => { mockCallbacks.onToolStart = cb; return vi.fn() }),
    onToolEnd: vi.fn((cb: any) => { mockCallbacks.onToolEnd = cb; return vi.fn() }),
    onAgentStart: vi.fn((cb: any) => { mockCallbacks.onAgentStart = cb; return vi.fn() }),
    onAgentEnd: vi.fn((cb: any) => { mockCallbacks.onAgentEnd = cb; return vi.fn() }),
  }
}))

function wrapper({ children }: { children: ReactNode }) {
  return <GlobalStreamProvider>{children}</GlobalStreamProvider>
}

function renderUseGlobalStream() {
  return renderHook(() => useGlobalStream(), { wrapper })
}

describe('GlobalStreamContext', () => {
  beforeEach(() => {
    Object.keys(mockCallbacks).forEach(k => { delete mockCallbacks[k] })
  })

  // ── 1. Default state ──
  describe('default state', () => {
    it('should return undefined for unknown session getStreamState', () => {
      const { result } = renderUseGlobalStream()
      expect(result.current.getStreamState('unknown')).toBeUndefined()
    })

    it('should return undefined for unknown session getStreamingMessage', () => {
      const { result } = renderUseGlobalStream()
      expect(result.current.getStreamingMessage('unknown')).toBeUndefined()
    })

    it('should return false for unknown session isSessionStreaming', () => {
      const { result } = renderUseGlobalStream()
      expect(result.current.isSessionStreaming('unknown')).toBe(false)
    })

    it('should return idle for unknown session getSessionStatus', () => {
      const { result } = renderUseGlobalStream()
      expect(result.current.getSessionStatus('unknown')).toBe('idle')
    })

    it('should return empty array from getStreamingSessionIds', () => {
      const { result } = renderUseGlobalStream()
      expect(result.current.getStreamingSessionIds()).toEqual([])
    })
  })

  // ── 2. setSessionStatus / getSessionStatus ──
  describe('setSessionStatus and getSessionStatus', () => {
    it('should set and get status', () => {
      const { result } = renderUseGlobalStream()
      act(() => { result.current.setSessionStatus('session-1', 'streaming') })
      expect(result.current.getSessionStatus('session-1')).toBe('streaming')
    })

    it('should update status from streaming to completed', () => {
      const { result } = renderUseGlobalStream()
      act(() => { result.current.setSessionStatus('session-1', 'streaming') })
      act(() => { result.current.setSessionStatus('session-1', 'completed') })
      expect(result.current.getSessionStatus('session-1')).toBe('completed')
    })

    it('should set error status', () => {
      const { result } = renderUseGlobalStream()
      act(() => { result.current.setSessionStatus('session-1', 'error') })
      expect(result.current.getSessionStatus('session-1')).toBe('error')
    })

    it('should handle multiple sessions independently', () => {
      const { result } = renderUseGlobalStream()
      act(() => { result.current.setSessionStatus('a', 'streaming') })
      act(() => { result.current.setSessionStatus('b', 'completed') })
      act(() => { result.current.setSessionStatus('c', 'error') })

      expect(result.current.getSessionStatus('a')).toBe('streaming')
      expect(result.current.getSessionStatus('b')).toBe('completed')
      expect(result.current.getSessionStatus('c')).toBe('error')
      expect(result.current.getSessionStatus('d')).toBe('idle')
    })
  })

  // ── 3. isSessionStreaming ──
  describe('isSessionStreaming', () => {
    it('should return true when session is streaming', () => {
      const { result } = renderUseGlobalStream()
      act(() => { result.current.setSessionStatus('s', 'streaming') })
      // isSessionStreaming checks streaming.isStreaming, not status
      // It defaults to false until streaming actually starts
      expect(result.current.isSessionStreaming('s')).toBe(false)
    })

    it('should return false after clearStreamState', () => {
      const { result } = renderUseGlobalStream()
      act(() => { result.current.setSessionStatus('s', 'streaming') })
      act(() => { result.current.clearStreamState('s') })
      expect(result.current.isSessionStreaming('s')).toBe(false)
    })
  })

  // ── 4. getStreamingSessionIds ──
  describe('getStreamingSessionIds', () => {
    it('should return empty when no sessions are streaming', () => {
      const { result } = renderUseGlobalStream()
      act(() => { result.current.setSessionStatus('s', 'completed') })
      expect(result.current.getStreamingSessionIds()).toEqual([])
    })

    it('should include session with streaming state set by IPC', () => {
      const { result } = renderUseGlobalStream()
      // Simulate message_start via ipcClient callback
      act(() => {
        mockCallbacks.onMessageStart?.({ sessionId: 'streaming-session', messageId: 'msg-1' })
      })
      expect(result.current.getStreamingSessionIds()).toContain('streaming-session')
    })

    it('should exclude stopped session', () => {
      const { result } = renderUseGlobalStream()
      act(() => {
        mockCallbacks.onMessageStart?.({ sessionId: 's', messageId: 'msg-1' })
      })
      act(() => {
        mockCallbacks.onMessageEnd?.({ sessionId: 's', messageId: 'msg-1' })
      })
      // After message_end, isStreaming becomes false
      expect(result.current.getStreamingSessionIds()).not.toContain('s')
    })
  })

  // ── 5. clearStreamState ──
  describe('clearStreamState', () => {
    it('should reset status to idle', () => {
      const { result } = renderUseGlobalStream()
      act(() => { result.current.setSessionStatus('s', 'streaming') })
      act(() => { result.current.clearStreamState('s') })
      expect(result.current.getSessionStatus('s')).toBe('idle')
    })

    it('should clear streaming message', () => {
      const { result } = renderUseGlobalStream()
      act(() => {
        mockCallbacks.onMessageStart?.({ sessionId: 's', messageId: 'msg-1' })
      })
      act(() => { result.current.clearStreamState('s') })
      expect(result.current.getStreamingMessage('s')).toBeUndefined()
    })

    it('should not affect other sessions', () => {
      const { result } = renderUseGlobalStream()
      act(() => { result.current.setSessionStatus('a', 'streaming') })
      act(() => { result.current.setSessionStatus('b', 'streaming') })
      act(() => { result.current.clearStreamState('a') })
      expect(result.current.getSessionStatus('b')).toBe('streaming')
    })

    it('should not throw for unknown session', () => {
      const { result } = renderUseGlobalStream()
      expect(() => act(() => { result.current.clearStreamState('unknown') })).not.toThrow()
    })
  })

  // ── 6. subscribe / notify ──
  describe('subscribe/notify pattern', () => {
    it('should call subscriber on state change', () => {
      const { result } = renderUseGlobalStream()
      const subscriber = vi.fn()
      act(() => { result.current.subscribe('s', subscriber) })
      act(() => { result.current.setSessionStatus('s', 'streaming') })
      expect(subscriber).toHaveBeenCalled()
    })

    it('should not call subscriber for different session', () => {
      const { result } = renderUseGlobalStream()
      const subscriber = vi.fn()
      act(() => { result.current.subscribe('s', subscriber) })
      act(() => { result.current.setSessionStatus('other', 'streaming') })
      expect(subscriber).not.toHaveBeenCalled()
    })

    it('should support unsubscribe', () => {
      const { result } = renderUseGlobalStream()
      const subscriber = vi.fn()
      const unsub = result.current.subscribe('s', subscriber)
      act(() => { unsub() })
      act(() => { result.current.setSessionStatus('s', 'streaming') })
      expect(subscriber).not.toHaveBeenCalled()
    })

    it('should support multiple subscribers for same session', () => {
      const { result } = renderUseGlobalStream()
      const sub1 = vi.fn()
      const sub2 = vi.fn()
      act(() => { result.current.subscribe('s', sub1) })
      act(() => { result.current.subscribe('s', sub2) })
      act(() => { result.current.setSessionStatus('s', 'streaming') })
      expect(sub1).toHaveBeenCalledTimes(1)
      expect(sub2).toHaveBeenCalledTimes(1)
    })
  })

  // ── 7. useGlobalStream error ──
  describe('useGlobalStream outside Provider', () => {
    it('should throw when used without GlobalStreamProvider', () => {
      expect(() => renderHook(() => useGlobalStream())).toThrow(
        'useGlobalStream must be used within a GlobalStreamProvider'
      )
    })
  })

  // ── 8. useSessionStream ──
  describe('useSessionStream', () => {
    it('should return idle status for null sessionId', () => {
      const { result } = renderHook(() => useSessionStream(null), { wrapper })
      expect(result.current.status).toBe('idle')
      expect(result.current.isStreaming).toBe(false)
      expect(result.current.streamingMessage).toBeUndefined()
    })

    it('should return idle for default session', () => {
      const { result } = renderHook(() => useSessionStream('s'), { wrapper })
      expect(result.current.status).toBe('idle')
      expect(result.current.isStreaming).toBe(false)
    })

    it('should react to status changes', () => {
      const { result } = renderHook(
        () => ({ global: useGlobalStream(), stream: useSessionStream('s') }),
        { wrapper },
      )

      act(() => { result.current.global.setSessionStatus('s', 'streaming') })
      expect(result.current.stream.status).toBe('streaming')

      act(() => { result.current.global.setSessionStatus('s', 'completed') })
      expect(result.current.stream.status).toBe('completed')
    })

    it('should react to streaming state from IPC events', () => {
      const { result } = renderHook(
        () => ({ global: useGlobalStream(), stream: useSessionStream('s') }),
        { wrapper },
      )

      expect(result.current.stream.isStreaming).toBe(false)

      act(() => {
        mockCallbacks.onMessageStart?.({ sessionId: 's', messageId: 'msg-1' })
      })
      expect(result.current.stream.isStreaming).toBe(true)

      act(() => {
        mockCallbacks.onMessageEnd?.({ sessionId: 's', messageId: 'msg-1' })
      })
      expect(result.current.stream.isStreaming).toBe(false)
    })
  })

  // ── 9. IPC event integration ──
  describe('IPC event integration', () => {
    it('should handle message_start and create streaming state', () => {
      const { result } = renderUseGlobalStream()
      act(() => {
        mockCallbacks.onMessageStart?.({ sessionId: 's', messageId: 'msg-1' })
      })
      const streamState = result.current.getStreamState('s')
      expect(streamState).toBeDefined()
      expect(streamState!.status).toBe('streaming')
      expect(streamState!.streaming.isStreaming).toBe(true)
      expect(streamState!.streaming.message?.id).toBe('msg-1')
    })

    it('should accumulate text_delta', () => {
      const { result } = renderUseGlobalStream()
      act(() => {
        mockCallbacks.onMessageStart?.({ sessionId: 's', messageId: 'msg-1' })
      })
      act(() => {
        mockCallbacks.onTextDelta?.({ sessionId: 's', delta: 'Hello' })
      })
      act(() => {
        mockCallbacks.onTextDelta?.({ sessionId: 's', delta: ' World' })
      })

      const msg = result.current.getStreamingMessage('s')
      expect(msg?.content).toBe('Hello World')
    })

    it('should accumulate thinking_delta', () => {
      const { result } = renderUseGlobalStream()
      act(() => {
        mockCallbacks.onMessageStart?.({ sessionId: 's', messageId: 'msg-1' })
      })
      act(() => {
        mockCallbacks.onThinkingDelta?.({ sessionId: 's', delta: 'Step 1...' })
      })
      act(() => {
        mockCallbacks.onThinkingDelta?.({ sessionId: 's', delta: 'Step 2...' })
      })

      const msg = result.current.getStreamingMessage('s')
      expect(msg?.thinking).toBe('Step 1...Step 2...')
    })

    it('should handle message_end and flush buffers', () => {
      const { result } = renderUseGlobalStream()
      act(() => {
        mockCallbacks.onMessageStart?.({ sessionId: 's', messageId: 'msg-1' })
      })
      act(() => {
        mockCallbacks.onTextDelta?.({ sessionId: 's', delta: 'Final text' })
      })
      act(() => {
        mockCallbacks.onThinkingDelta?.({ sessionId: 's', delta: 'Thinking...' })
      })
      act(() => {
        mockCallbacks.onMessageEnd?.({ sessionId: 's', messageId: 'msg-1' })
      })

      const msg = result.current.getStreamingMessage('s')
      expect(msg?.content).toBe('Final text')
      expect(msg?.thinking).toBe('Thinking...')
      expect(msg?.isStreaming).toBe(false)
      expect(result.current.isSessionStreaming('s')).toBe(false)
    })

    it('should handle tool_start and tool_end', () => {
      const { result } = renderUseGlobalStream()
      act(() => {
        mockCallbacks.onToolStart?.({
          sessionId: 's',
          toolCallId: 'tc-1',
          toolName: 'read_file',
          args: { path: '/test.txt' },
        })
      })

      let state = result.current.getStreamState('s')
      expect(state?.toolCalls).toHaveLength(1)
      expect(state?.toolCalls[0].name).toBe('read_file')
      expect(state?.toolCalls[0].status).toBe('running')

      act(() => {
        mockCallbacks.onToolEnd?.({
          sessionId: 's',
          toolCallId: 'tc-1',
          result: 'file contents',
          isError: false,
        })
      })

      state = result.current.getStreamState('s')
      expect(state?.toolCalls[0].status).toBe('success')
      expect(state?.toolCalls[0].result).toBe('file contents')
    })

    it('should handle tool_end with error', () => {
      const { result } = renderUseGlobalStream()
      act(() => {
        mockCallbacks.onToolStart?.({
          sessionId: 's',
          toolCallId: 'tc-1',
          toolName: 'read_file',
          args: { path: '/missing.txt' },
        })
      })
      act(() => {
        mockCallbacks.onToolEnd?.({
          sessionId: 's',
          toolCallId: 'tc-1',
          result: 'File not found',
          isError: true,
        })
      })

      const state = result.current.getStreamState('s')
      expect(state?.toolCalls[0].status).toBe('error')
      expect(state?.toolCalls[0].error).toBe('File not found')
    })

    it('should handle agent_start and agent_end cycle', () => {
      const { result } = renderUseGlobalStream()

      act(() => {
        mockCallbacks.onAgentStart?.({ sessionId: 's' })
      })
      expect(result.current.getSessionStatus('s')).toBe('streaming')

      act(() => {
        mockCallbacks.onAgentEnd?.({ sessionId: 's' })
      })
      expect(result.current.getSessionStatus('s')).toBe('completed')
    })

    it('should clear toolCalls on new agent_start', () => {
      const { result } = renderUseGlobalStream()

      act(() => {
        mockCallbacks.onToolStart?.({
          sessionId: 's',
          toolCallId: 'tc-1',
          toolName: 'old_tool',
          args: {},
        })
      })

      act(() => {
        mockCallbacks.onAgentStart?.({ sessionId: 's' })
      })

      const state = result.current.getStreamState('s')
      expect(state?.toolCalls).toHaveLength(0)
    })

    it('should handle full conversation flow', () => {
      const { result } = renderUseGlobalStream()

      act(() => { mockCallbacks.onAgentStart?.({ sessionId: 's' }) })
      expect(result.current.getSessionStatus('s')).toBe('streaming')

      act(() => { mockCallbacks.onMessageStart?.({ sessionId: 's', messageId: 'msg-1' }) })
      act(() => { mockCallbacks.onThinkingDelta?.({ sessionId: 's', delta: 'Thinking...' }) })
      act(() => { mockCallbacks.onTextDelta?.({ sessionId: 's', delta: 'Reply' }) })
      act(() => { mockCallbacks.onMessageEnd?.({ sessionId: 's', messageId: 'msg-1' }) })

      act(() => { mockCallbacks.onAgentEnd?.({ sessionId: 's' }) })
      expect(result.current.getSessionStatus('s')).toBe('completed')

      const msg = result.current.getStreamingMessage('s')
      expect(msg?.content).toBe('Reply')
      expect(msg?.thinking).toBe('Thinking...')

      act(() => { result.current.clearStreamState('s') })
      expect(result.current.getSessionStatus('s')).toBe('idle')
      expect(result.current.getStreamingMessage('s')).toBeUndefined()
    })
  })
})
