import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, renderHook, act } from '@testing-library/react'
import { SessionStateProvider, useSessionState } from '../SessionStateContext'

function renderUseSessionState() {
  return renderHook(() => useSessionState(), { wrapper: SessionStateProvider })
}

describe('SessionStateContext', () => {
  // ── 1. Default status ──
  describe('default status', () => {
    it('should return "idle" for unknown session', () => {
      const { result } = renderUseSessionState()
      expect(result.current.getStatus('nonexistent')).toBe('idle')
    })
  })

  // ── 2. updateStatus ──
  describe('updateStatus', () => {
    it('should change status for a session', () => {
      const { result } = renderUseSessionState()
      act(() => { result.current.updateStatus('session-1', 'working') })
      expect(result.current.getStatus('session-1')).toBe('working')
    })

    it('should handle status transitions', () => {
      const { result } = renderUseSessionState()
      act(() => { result.current.updateStatus('session-1', 'idle') })
      expect(result.current.getStatus('session-1')).toBe('idle')

      act(() => { result.current.updateStatus('session-1', 'working') })
      expect(result.current.getStatus('session-1')).toBe('working')

      act(() => { result.current.updateStatus('session-1', 'completed') })
      expect(result.current.getStatus('session-1')).toBe('completed')

      act(() => { result.current.updateStatus('session-1', 'error') })
      expect(result.current.getStatus('session-1')).toBe('error')

      act(() => { result.current.updateStatus('session-1', 'idle') })
      expect(result.current.getStatus('session-1')).toBe('idle')
    })

    it('should update status on same session multiple times', () => {
      const { result } = renderUseSessionState()
      act(() => { result.current.updateStatus('session-1', 'working') })
      act(() => { result.current.updateStatus('session-1', 'completed') })
      act(() => { result.current.updateStatus('session-1', 'working') })
      act(() => { result.current.updateStatus('session-1', 'error') })
      expect(result.current.getStatus('session-1')).toBe('error')
    })
  })

  // ── 3. Multiple sessions ──
  describe('multiple sessions', () => {
    it('should track sessions independently', () => {
      const { result } = renderUseSessionState()
      act(() => { result.current.updateStatus('session-a', 'working') })
      act(() => { result.current.updateStatus('session-b', 'completed') })
      act(() => { result.current.updateStatus('session-c', 'error') })

      expect(result.current.getStatus('session-a')).toBe('working')
      expect(result.current.getStatus('session-b')).toBe('completed')
      expect(result.current.getStatus('session-c')).toBe('error')
    })

    it('should not affect other sessions when updating one', () => {
      const { result } = renderUseSessionState()
      act(() => { result.current.updateStatus('session-a', 'working') })
      act(() => { result.current.updateStatus('session-b', 'completed') })

      act(() => { result.current.updateStatus('session-b', 'error') })

      expect(result.current.getStatus('session-a')).toBe('working')
      expect(result.current.getStatus('session-b')).toBe('error')
    })

    it('should return idle for unmodified session among modified ones', () => {
      const { result } = renderUseSessionState()
      act(() => { result.current.updateStatus('session-a', 'working') })
      act(() => { result.current.updateStatus('session-b', 'completed') })

      expect(result.current.getStatus('session-c')).toBe('idle')
    })
  })

  // ── 4. Consumer propagation ──
  describe('consumer propagation', () => {
    it('should propagate updates to all consumers within same provider', () => {
      function Consumer({ id, label }: { id: string; label: string }) {
        const { getStatus } = useSessionState()
        return <span data-testid={label}>{getStatus(id)}</span>
      }

      function TestHarness() {
        const { updateStatus } = useSessionState()
        return (
          <div>
            <Consumer id="test-session" label="c1" />
            <Consumer id="test-session" label="c2" />
            <button data-testid="update-btn" onClick={() => updateStatus('test-session', 'working')} />
          </div>
        )
      }

      render(
        <SessionStateProvider>
          <TestHarness />
        </SessionStateProvider>
      )

      expect(screen.getByTestId('c1')).toHaveTextContent('idle')
      expect(screen.getByTestId('c2')).toHaveTextContent('idle')

      act(() => { screen.getByTestId('update-btn').click() })

      expect(screen.getByTestId('c1')).toHaveTextContent('working')
      expect(screen.getByTestId('c2')).toHaveTextContent('working')
    })

    it('should allow independent consumer updates', () => {
      function Consumer({ id, label }: { id: string; label: string }) {
        const { getStatus } = useSessionState()
        return <span data-testid={label}>{getStatus(id)}</span>
      }

      function TestHarness() {
        const { updateStatus } = useSessionState()
        return (
          <div>
            <Consumer id="session-a" label="ca" />
            <Consumer id="session-b" label="cb" />
            <button data-testid="btn-a" onClick={() => updateStatus('session-a', 'working')} />
            <button data-testid="btn-b" onClick={() => updateStatus('session-b', 'completed')} />
          </div>
        )
      }

      render(
        <SessionStateProvider>
          <TestHarness />
        </SessionStateProvider>
      )

      act(() => { screen.getByTestId('btn-a').click() })
      expect(screen.getByTestId('ca')).toHaveTextContent('working')
      expect(screen.getByTestId('cb')).toHaveTextContent('idle')

      act(() => { screen.getByTestId('btn-b').click() })
      expect(screen.getByTestId('ca')).toHaveTextContent('working')
      expect(screen.getByTestId('cb')).toHaveTextContent('completed')
    })
  })

  // ── 5. useSessionState Error ──
  describe('useSessionState outside Provider', () => {
    it('should throw when used without SessionStateProvider', () => {
      expect(() => renderHook(() => useSessionState())).toThrow(
        'useSessionState must be used within a SessionStateProvider'
      )
    })
  })

  // ── 6. Children rendering ──
  describe('children rendering', () => {
    it('should render children', () => {
      render(
        <SessionStateProvider>
          <div data-testid="child">Hello</div>
        </SessionStateProvider>
      )
      expect(screen.getByTestId('child')).toHaveTextContent('Hello')
    })
  })

  // ── 7. Edge cases ──
  describe('edge cases', () => {
    it('should handle empty session ID', () => {
      const { result } = renderUseSessionState()
      act(() => { result.current.updateStatus('', 'working') })
      expect(result.current.getStatus('')).toBe('working')
    })

    it('should handle session ID with special characters', () => {
      const { result } = renderUseSessionState()
      act(() => { result.current.updateStatus('session-abc_123!@#', 'working') })
      expect(result.current.getStatus('session-abc_123!@#')).toBe('working')
    })
  })
})
