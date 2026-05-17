import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { ModelProvider, useModelContext } from '@/renderer/contexts/ModelContext'
import { useModels } from '../useModels'
import type { ReactNode } from 'react'

const SELECTED_MODEL_KEY = 'pair-selected-model'

function wrapper({ children }: { children: ReactNode }) {
  return <ModelProvider>{children}</ModelProvider>
}

function renderUseModelsWithCtx() {
  return renderHook(
    () => ({
      models: useModels(),
      ctx: useModelContext(),
    }),
    { wrapper },
  )
}

describe('useModels', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // ── 1. Default state ──
  describe('default state', () => {
    it('should start with empty models', () => {
      const { result } = renderUseModelsWithCtx()
      expect(result.current.models.models).toEqual([])
    })

    it('should start with no currentModel', () => {
      const { result } = renderUseModelsWithCtx()
      expect(result.current.models.currentModel).toBeNull()
    })

    it('should start with empty currentModelId', () => {
      const { result } = renderUseModelsWithCtx()
      expect(result.current.models.currentModelId).toBe('')
    })
  })

  // ── 2. Load models from context ──
  describe('model loading from context', () => {
    it('should load models from enabled configs', async () => {
      const { result } = renderUseModelsWithCtx()

      await act(async () => {
        await result.current.ctx.addModelConfig({
          name: 'OpenAI',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-test',
          api: 'openai-completions',
          isEnabled: true,
          enabledModels: ['gpt-4', 'gpt-3.5-turbo'],
        })
      })

      expect(result.current.models.models).toHaveLength(2)
      expect(result.current.models.models[0].id).toBe('gpt-4')
      expect(result.current.models.models[1].id).toBe('gpt-3.5-turbo')
    })

    it('should auto-select first model when current is empty', async () => {
      const { result } = renderUseModelsWithCtx()

      await act(async () => {
        await result.current.ctx.addModelConfig({
          name: 'Anthropic',
          provider: 'anthropic',
          baseUrl: 'https://api.anthropic.com',
          apiKey: 'sk-test',
          api: 'anthropic-messages',
          isEnabled: true,
          enabledModels: ['claude-3-opus'],
        })
      })

      expect(result.current.models.currentModelId).toBe('claude-3-opus')
      expect(result.current.models.currentModel?.provider).toBe('anthropic')
    })

    it('should include contextWindow from config', async () => {
      const { result } = renderUseModelsWithCtx()

      await act(async () => {
        await result.current.ctx.addModelConfig({
          name: 'OpenAI',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-test',
          api: 'openai-completions',
          isEnabled: true,
          enabledModels: ['gpt-4'],
          contextWindow: 8192,
        })
      })

      expect(result.current.models.models[0].contextWindow).toBe(8192)
    })

    it('should handle empty enabled configs', () => {
      const { result } = renderUseModelsWithCtx()
      expect(result.current.models.models).toEqual([])
    })
  })

  // ── 3. selectModel ──
  describe('selectModel', () => {
    it('should switch current model', async () => {
      const { result } = renderUseModelsWithCtx()

      await act(async () => {
        await result.current.ctx.addModelConfig({
          name: 'OpenAI',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-test',
          api: 'openai-completions',
          isEnabled: true,
          enabledModels: ['gpt-4', 'gpt-3.5-turbo'],
        })
      })

      act(() => { result.current.models.selectModel('gpt-3.5-turbo') })
      expect(result.current.models.currentModelId).toBe('gpt-3.5-turbo')
      expect(result.current.models.currentModel?.id).toBe('gpt-3.5-turbo')
    })

    it('should persist selected model to localStorage', async () => {
      const { result } = renderUseModelsWithCtx()

      await act(async () => {
        await result.current.ctx.addModelConfig({
          name: 'OpenAI',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-test',
          api: 'openai-completions',
          isEnabled: true,
          enabledModels: ['gpt-4', 'gpt-3.5-turbo'],
        })
      })

      act(() => { result.current.models.selectModel('gpt-3.5-turbo') })
      expect(localStorage.getItem(SELECTED_MODEL_KEY)).toBe('gpt-3.5-turbo')
    })
  })

  // ── 4. localStorage restore ──
  describe('localStorage restore', () => {
    it('should restore selected model from localStorage', async () => {
      localStorage.setItem(SELECTED_MODEL_KEY, 'gpt-4')
      const { result } = renderUseModelsWithCtx()

      await act(async () => {
        await result.current.ctx.addModelConfig({
          name: 'OpenAI',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-test',
          api: 'openai-completions',
          isEnabled: true,
          enabledModels: ['gpt-4', 'gpt-3.5-turbo'],
        })
      })

      expect(result.current.models.currentModelId).toBe('gpt-4')
    })

    it('should fallback to first model when restored ID does not exist', async () => {
      localStorage.setItem(SELECTED_MODEL_KEY, 'non-existent-model')
      const { result } = renderUseModelsWithCtx()

      await act(async () => {
        await result.current.ctx.addModelConfig({
          name: 'OpenAI',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-test',
          api: 'openai-completions',
          isEnabled: true,
          enabledModels: ['gpt-4', 'gpt-3.5-turbo'],
        })
      })

      expect(result.current.models.currentModelId).toBe('gpt-4')
    })

    it('should restore nothing when localStorage is empty', () => {
      const { result } = renderUseModelsWithCtx()
      expect(result.current.models.currentModelId).toBe('')
    })
  })

  // ── 5. Multiple providers ──
  describe('multiple providers', () => {
    it('should aggregate models from multiple providers', async () => {
      const { result } = renderUseModelsWithCtx()

      await act(async () => {
        await result.current.ctx.addModelConfig({
          name: 'OpenAI',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-oa',
          api: 'openai-completions',
          isEnabled: true,
          enabledModels: ['gpt-4', 'gpt-3.5-turbo'],
        })
        await result.current.ctx.addModelConfig({
          name: 'Anthropic',
          provider: 'anthropic',
          baseUrl: 'https://api.anthropic.com',
          apiKey: 'sk-an',
          api: 'anthropic-messages',
          isEnabled: true,
          enabledModels: ['claude-3-opus'],
        })
      })

      expect(result.current.models.models).toHaveLength(3)
      const providers = result.current.models.models.map(m => m.provider)
      expect(providers.filter(p => p === 'openai')).toHaveLength(2)
      expect(providers.filter(p => p === 'anthropic')).toHaveLength(1)
    })

    it('should not include models from disabled configs', async () => {
      const { result } = renderUseModelsWithCtx()

      await act(async () => {
        await result.current.ctx.addModelConfig({
          name: 'OpenAI',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-oa',
          api: 'openai-completions',
          isEnabled: true,
          enabledModels: ['gpt-4'],
        })
        await result.current.ctx.addModelConfig({
          name: 'Disabled',
          provider: 'disabled-provider',
          baseUrl: 'https://api.disabled.com',
          apiKey: 'sk-dis',
          api: 'openai-completions',
          isEnabled: false,
          enabledModels: ['model-from-disabled'],
        })
      })

      const ids = result.current.models.models.map(m => m.id)
      expect(ids).not.toContain('model-from-disabled')
      expect(ids).toContain('gpt-4')
    })
  })

  // ── 6. Model change reactivity ──
  describe('model change reactivity', () => {
    it('should re-load models when configs change', async () => {
      const { result } = renderUseModelsWithCtx()

      await act(async () => {
        await result.current.ctx.addModelConfig({
          name: 'OpenAI',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-test',
          api: 'openai-completions',
          isEnabled: true,
          enabledModels: ['gpt-4'],
        })
      })

      expect(result.current.models.models).toHaveLength(1)

      await act(async () => {
        await result.current.ctx.addModelConfig({
          name: 'Anthropic',
          provider: 'anthropic',
          baseUrl: 'https://api.anthropic.com',
          apiKey: 'sk-test',
          api: 'anthropic-messages',
          isEnabled: true,
          enabledModels: ['claude-3-opus', 'claude-3-sonnet'],
        })
      })

      expect(result.current.models.models).toHaveLength(3)
    })

    it('should handle model config removal', async () => {
      const { result } = renderUseModelsWithCtx()

      await act(async () => {
        await result.current.ctx.addModelConfig({
          name: 'OpenAI',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-test',
          api: 'openai-completions',
          isEnabled: true,
          enabledModels: ['gpt-4'],
        })
      })

      const id = result.current.ctx.modelConfigs[0].id
      await act(async () => {
        await result.current.ctx.removeModelConfig(id)
      })

      expect(result.current.models.models).toHaveLength(0)
      expect(result.current.models.currentModel).toBeNull()
    })
  })
})
