import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IPCClient } from '@/renderer/ipc-client'

describe('IPCClient', () => {
  let client: IPCClient

  beforeEach(() => {
    // Ensure electronAPI is defined (from setup.ts mock)
    client = new IPCClient()
  })

  // ── 1. Non-Electron environment ──
  describe('non-Electron environment (electronAPI exists)', () => {
    it('should create session via electronAPI', async () => {
      const mockSession = { id: 'sess-1', projectPath: '/test', name: 'Test', createdAt: new Date() }
      vi.spyOn(window.electronAPI.session, 'create').mockResolvedValueOnce(mockSession as any)

      const result = await client.createSession({ projectPath: '/test' })
      expect(result.id).toBe('sess-1')
    })

    it('should list sessions', async () => {
      vi.spyOn(window.electronAPI.session, 'list').mockResolvedValueOnce([])

      const result = await client.listSessions()
      expect(result).toEqual([])
    })

    it('should send message', async () => {
      const spy = vi.spyOn(window.electronAPI.message, 'send').mockResolvedValueOnce()

      await client.sendMessage('sess-1', 'hello')
      expect(spy).toHaveBeenCalledWith('sess-1', 'hello', undefined)
    })

    it('should abort message', async () => {
      const spy = vi.spyOn(window.electronAPI.message, 'abort').mockResolvedValueOnce()

      await client.abortMessage('sess-1')
      expect(spy).toHaveBeenCalledWith('sess-1')
    })

    it('should list models', async () => {
      vi.spyOn(window.electronAPI.model, 'list').mockResolvedValueOnce([{ id: 'gpt-4' }])

      const result = await client.listModels()
      expect(result).toHaveLength(1)
    })

    it('should test connection', async () => {
      vi.spyOn(window.electronAPI.model, 'testConnection').mockResolvedValueOnce({ success: true })

      const result = await client.testConnection({ provider: 'openai', baseUrl: '', apiKey: 'sk-test' })
      expect(result.success).toBe(true)
    })

    it('should get storage config', async () => {
      vi.spyOn(window.electronAPI.storage, 'getConfig').mockResolvedValueOnce({ dataRoot: '/data', defaultDataRoot: '/default' })

      const result = await client.getStorageConfig()
      expect(result.dataRoot).toBe('/data')
    })

    it('should search files', async () => {
      vi.spyOn(window.electronAPI.file, 'search').mockResolvedValueOnce([{ path: '/file.ts' }])

      const result = await client.searchFiles('/project', 'query')
      expect(result).toHaveLength(1)
    })
  })

  // ── 2. Event subscription ──
  describe('event subscription', () => {
    it('should subscribe to channel via on()', () => {
      const spy = vi.spyOn(window.electronAPI, 'on').mockReturnValueOnce(vi.fn())

      const unsub = client.on('agent:message_start', vi.fn())
      expect(spy).toHaveBeenCalledWith('agent:message_start', expect.any(Function))
      expect(typeof unsub).toBe('function')
    })

    it('should provide convenience event methods', () => {
      const spy = vi.spyOn(window.electronAPI, 'on').mockReturnValue(vi.fn())

      const subs = [
        client.onMessageStart(vi.fn()),
        client.onTextDelta(vi.fn()),
        client.onThinkingDelta(vi.fn()),
        client.onMessageEnd(vi.fn()),
        client.onToolStart(vi.fn()),
        client.onToolUpdate(vi.fn()),
        client.onToolEnd(vi.fn()),
        client.onAgentStart(vi.fn()),
        client.onAgentEnd(vi.fn()),
        client.onTurnStart(vi.fn()),
        client.onTurnEnd(vi.fn()),
      ]

      expect(spy).toHaveBeenCalled()
      subs.forEach(s => expect(typeof s).toBe('function'))
    })

    it('should unsubscribe via off()', () => {
      const unsubMock = vi.fn()
      vi.spyOn(window.electronAPI, 'on').mockReturnValueOnce(unsubMock)

      client.on('agent:message_start', vi.fn())
      client.off('agent:message_start')
      expect(unsubMock).toHaveBeenCalled()
    })

    it('should remove all listeners', () => {
      const unsubMock = vi.fn()
      vi.spyOn(window.electronAPI, 'on').mockReturnValue(unsubMock)

      client.on('agent:message_start', vi.fn())
      client.on('agent:text_delta', vi.fn())

      client.removeAllListeners()
      expect(unsubMock).toHaveBeenCalledTimes(2)
    })
  })

  // ── 3. Platform and version ──
  describe('platform and version', () => {
    it('should return platform from electronAPI', () => {
      expect(client.platform).toBe('win32')
    })

    it('should return versions from electronAPI', () => {
      expect(client.versions).toBeDefined()
    })
  })

  // ── 4. Window control ──
  describe('window control', () => {
    it('should minimize', async () => {
      const spy = vi.spyOn(window.electronAPI, 'minimize').mockResolvedValueOnce()
      await client.minimizeWindow()
      expect(spy).toHaveBeenCalled()
    })

    it('should maximize', async () => {
      const spy = vi.spyOn(window.electronAPI, 'maximize').mockResolvedValueOnce()
      await client.maximizeWindow()
      expect(spy).toHaveBeenCalled()
    })

    it('should close', async () => {
      const spy = vi.spyOn(window.electronAPI, 'close').mockResolvedValueOnce()
      await client.closeWindow()
      expect(spy).toHaveBeenCalled()
    })
  })
})
