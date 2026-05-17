import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchModels } from '../model-fetcher'

describe('fetchModels', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // ── 1. anthropic ──
  describe('anthropic-messages', () => {
    it('should return known Anthropic models', async () => {
      const result = await fetchModels('anthropic-messages', '', '')
      expect(result.success).toBe(true)
      expect(result.models).toBeDefined()
      expect(result.models!.length).toBeGreaterThan(0)
      expect(result.models![0].id).toContain('claude')
    })
  })

  // ── 2. openai-completions ──
  describe('openai-completions', () => {
    it('should fetch and parse OpenAI models', async () => {
      const mockModels = {
        data: [
          { id: 'gpt-4', owned_by: 'openai' },
          { id: 'gpt-3.5-turbo', owned_by: 'openai' },
        ],
      }
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockModels),
      } as Response)

      const result = await fetchModels(
        'openai-completions',
        'https://api.openai.com/v1',
        'sk-test',
      )

      expect(result.success).toBe(true)
      expect(result.models).toHaveLength(2)
      expect(result.models![0].id).toBe('gpt-4')
      expect(result.models![1].id).toBe('gpt-3.5-turbo')
    })

    it('should handle array response format', async () => {
      const mockModels = ['model-a', 'model-b']
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockModels),
      } as Response)

      const result = await fetchModels(
        'openai-completions',
        'https://api.custom.com/v1',
        'sk-test',
      )

      expect(result.success).toBe(true)
      expect(result.models).toHaveLength(2)
      expect(result.models![0].id).toBe('model-a')
    })

    it('should handle API error response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Invalid API key'),
      } as Response)

      const result = await fetchModels(
        'openai-completions',
        'https://api.openai.com/v1',
        'bad-key',
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('401')
    })
  })

  // ── 3. google-generative-ai ──
  describe('google-generative-ai', () => {
    it('should fetch and parse Google AI models', async () => {
      const mockModels = {
        models: [
          { name: 'models/gemini-pro', displayName: 'Gemini Pro', description: 'Best model' },
          { name: 'models/gemini-pro-vision', displayName: 'Gemini Pro Vision' },
        ],
      }
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockModels),
      } as Response)

      const result = await fetchModels(
        'google-generative-ai',
        '',
        'google-key',
      )

      expect(result.success).toBe(true)
      expect(result.models).toHaveLength(2)
      expect(result.models![0].id).toBe('gemini-pro')
      expect(result.models![0].name).toBe('Gemini Pro')
    })

    it('should handle API error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Forbidden'),
      } as Response)

      const result = await fetchModels(
        'google-generative-ai',
        '',
        'bad-key',
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('403')
    })
  })

  // ── 4. unknown type ──
  describe('unknown API type', () => {
    it('should return error for unsupported API type', async () => {
      const result = await fetchModels('unknown-type', '', '')
      expect(result.success).toBe(false)
      expect(result.error).toContain('不支持的 API 类型')
    })
  })

  // ── 5. network error ──
  describe('network error handling', () => {
    it('should handle network failure for OpenAI', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network failure'))

      const result = await fetchModels(
        'openai-completions',
        'https://api.openai.com/v1',
        'sk-test',
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('网络错误')
    })

    it('should handle network failure for Google', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('timeout'))

      const result = await fetchModels(
        'google-generative-ai',
        '',
        'key',
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('网络错误')
    })
  })

  // ── 6. URL handling ──
  describe('URL handling', () => {
    it('should handle trailing slash in baseUrl', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: 'gpt-4', owned_by: 'openai' }] }),
      } as Response)

      const result = await fetchModels(
        'openai-completions',
        'https://api.openai.com/v1/',
        'sk-test',
      )

      expect(result.success).toBe(true)
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        expect.any(Object),
      )
    })

    it('should handle baseUrl without trailing slash', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: 'gpt-4', owned_by: 'openai' }] }),
      } as Response)

      const result = await fetchModels(
        'openai-completions',
        'https://api.openai.com/v1',
        'sk-test',
      )

      expect(result.success).toBe(true)
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        expect.any(Object),
      )
    })
  })
})
