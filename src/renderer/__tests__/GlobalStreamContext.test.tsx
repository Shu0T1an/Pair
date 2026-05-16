import { describe, it, expect, vi } from 'vitest'

// Mock ipcClient
vi.mock('@/renderer/ipc-client', () => ({
  ipcClient: {
    onMessageStart: vi.fn(() => vi.fn()),
    onTextDelta: vi.fn(() => vi.fn()),
    onThinkingDelta: vi.fn(() => vi.fn()),
    onMessageEnd: vi.fn(() => vi.fn()),
    onToolStart: vi.fn(() => vi.fn()),
    onToolEnd: vi.fn(() => vi.fn()),
  }
}))

describe('GlobalStreamContext', () => {
  it('should export GlobalStreamProvider and useGlobalStream', async () => {
    const module = await import('../contexts/GlobalStreamContext')
    expect(module.GlobalStreamProvider).toBeDefined()
    expect(module.useGlobalStream).toBeDefined()
    expect(typeof module.GlobalStreamProvider).toBe('function')
    expect(typeof module.useGlobalStream).toBe('function')
  })

  it('should export useSessionStream', async () => {
    const module = await import('../contexts/GlobalStreamContext')
    expect(module.useSessionStream).toBeDefined()
    expect(typeof module.useSessionStream).toBe('function')
  })
})
