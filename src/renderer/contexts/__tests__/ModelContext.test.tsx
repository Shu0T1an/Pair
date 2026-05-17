import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, renderHook, act } from '@testing-library/react'
import { ModelProvider, useModelContext, type ModelConfig } from '../ModelContext'

function renderUseModelContext() {
  return renderHook(() => useModelContext(), { wrapper: ModelProvider })
}

function makeConfig(overrides: Partial<ModelConfig> = {}): ModelConfig {
  const now = new Date()
  return {
    id: `config_${now.getTime()}_test123`,
    name: 'Test Model',
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'sk-test123',
    api: 'openai-completions',
    isEnabled: true,
    enabledModels: ['gpt-4', 'gpt-3.5-turbo'],
    createdAt: now,
    ...overrides,
  }
}

const STORAGE_KEY = 'pair-model-configs'

describe('ModelContext', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // ── 1. Default ──
  describe('default state', () => {
    it('should start with empty configs', () => {
      const { result } = renderUseModelContext()
      expect(result.current.modelConfigs).toEqual([])
    })

    it('should return empty array from getEnabledModels', () => {
      const { result } = renderUseModelContext()
      expect(result.current.getEnabledModels()).toEqual([])
    })
  })

  // ── 2. localStorage restoration ──
  describe('localStorage restoration', () => {
    it('should restore saved configs on mount', () => {
      const saved = [makeConfig({ id: 'saved-1', name: 'Saved Model' })]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))

      const { result } = renderUseModelContext()
      expect(result.current.modelConfigs).toHaveLength(1)
      expect(result.current.modelConfigs[0].name).toBe('Saved Model')
    })

    it('should handle corrupt localStorage gracefully', () => {
      localStorage.setItem(STORAGE_KEY, '{invalid json!!!}')

      const { result } = renderUseModelContext()
      expect(result.current.modelConfigs).toEqual([])
    })

    it('should handle empty string in localStorage', () => {
      localStorage.setItem(STORAGE_KEY, '')

      const { result } = renderUseModelContext()
      expect(result.current.modelConfigs).toEqual([])
    })

    it('should restore multiple configs', () => {
      const saved = [
        makeConfig({ id: 'cfg-1', name: 'Model A' }),
        makeConfig({ id: 'cfg-2', name: 'Model B' }),
        makeConfig({ id: 'cfg-3', name: 'Model C' }),
      ]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))

      const { result } = renderUseModelContext()
      expect(result.current.modelConfigs).toHaveLength(3)
    })
  })

  // ── 3. addModelConfig ──
  describe('addModelConfig', () => {
    it('should add a new config to the list', async () => {
      const { result } = renderUseModelContext()
      const input = {
        name: 'New Model',
        provider: 'anthropic',
        baseUrl: 'https://api.anthropic.com',
        apiKey: 'sk-anthropic',
        api: 'anthropic-messages' as const,
        isEnabled: true,
        enabledModels: ['claude-3-opus', 'claude-3-sonnet'],
      }

      await act(async () => {
        await result.current.addModelConfig(input)
      })

      expect(result.current.modelConfigs).toHaveLength(1)
      expect(result.current.modelConfigs[0].name).toBe('New Model')
      expect(result.current.modelConfigs[0].provider).toBe('anthropic')
    })

    it('should generate unique id for new config', async () => {
      const { result } = renderUseModelContext()
      const input = {
        name: 'Model 1',
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-1',
        api: 'openai-completions' as const,
        isEnabled: true,
        enabledModels: ['gpt-4'],
      }

      await act(async () => {
        await result.current.addModelConfig(input)
      })

      const id = result.current.modelConfigs[0].id
      expect(id).toContain('config_')
      expect(typeof id).toBe('string')
    })

    it('should set createdAt on new config', async () => {
      const { result } = renderUseModelContext()
      const input = {
        name: 'Timed Model',
        provider: 'google',
        baseUrl: 'https://generativelanguage.googleapis.com',
        apiKey: 'sk-google',
        api: 'google-generative-ai' as const,
        isEnabled: true,
        enabledModels: ['gemini-pro'],
      }

      await act(async () => {
        await result.current.addModelConfig(input)
      })

      expect(result.current.modelConfigs[0].createdAt).toBeInstanceOf(Date)
    })

    it('should add multiple configs independently', async () => {
      const { result } = renderUseModelContext()
      const base = {
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
        api: 'openai-completions' as const,
        isEnabled: true,
        enabledModels: ['gpt-4'],
      }

      await act(async () => {
        await result.current.addModelConfig({ ...base, name: 'First' })
      })
      await act(async () => {
        await result.current.addModelConfig({ ...base, name: 'Second' })
      })

      expect(result.current.modelConfigs).toHaveLength(2)
      expect(result.current.modelConfigs[0].name).toBe('First')
      expect(result.current.modelConfigs[1].name).toBe('Second')
    })

    it('should persist to localStorage after add', async () => {
      const { result } = renderUseModelContext()
      const input = {
        name: 'Persistent',
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-persist',
        api: 'openai-completions' as const,
        isEnabled: true,
        enabledModels: ['gpt-4'],
      }

      await act(async () => {
        await result.current.addModelConfig(input)
      })

      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(saved).toHaveLength(1)
      expect(saved[0].name).toBe('Persistent')
    })
  })

  // ── 4. removeModelConfig ──
  describe('removeModelConfig', () => {
    it('should remove a config by id', async () => {
      const { result } = renderUseModelContext()
      await act(async () => {
        await result.current.addModelConfig({
          name: 'To Remove',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-rm',
          api: 'openai-completions' as const,
          isEnabled: true,
          enabledModels: ['gpt-4'],
        })
      })

      const id = result.current.modelConfigs[0].id
      await act(async () => {
        await result.current.removeModelConfig(id)
      })

      expect(result.current.modelConfigs).toHaveLength(0)
    })

    it('should only remove the target config', async () => {
      const { result } = renderUseModelContext()
      await act(async () => {
        await result.current.addModelConfig({
          name: 'Keep',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-keep',
          api: 'openai-completions' as const,
          isEnabled: true,
          enabledModels: ['gpt-4'],
        })
        await result.current.addModelConfig({
          name: 'Remove',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-rm',
          api: 'openai-completions' as const,
          isEnabled: true,
          enabledModels: ['gpt-4'],
        })
      })

      const removeId = result.current.modelConfigs.find(c => c.name === 'Remove')!.id
      await act(async () => {
        await result.current.removeModelConfig(removeId)
      })

      expect(result.current.modelConfigs).toHaveLength(1)
      expect(result.current.modelConfigs[0].name).toBe('Keep')
    })

    it('should do nothing when removing non-existent id', async () => {
      const { result } = renderUseModelContext()
      await act(async () => {
        await result.current.addModelConfig({
          name: 'Sole',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-sole',
          api: 'openai-completions' as const,
          isEnabled: true,
          enabledModels: ['gpt-4'],
        })
      })

      await act(async () => {
        await result.current.removeModelConfig('non-existent-id')
      })

      expect(result.current.modelConfigs).toHaveLength(1)
    })

    it('should update localStorage after remove', async () => {
      const { result } = renderUseModelContext()
      await act(async () => {
        await result.current.addModelConfig({
          name: 'Will be removed',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-wbr',
          api: 'openai-completions' as const,
          isEnabled: true,
          enabledModels: ['gpt-4'],
        })
      })

      const id = result.current.modelConfigs[0].id
      await act(async () => {
        await result.current.removeModelConfig(id)
      })

      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(saved).toHaveLength(0)
    })
  })

  // ── 5. updateModelConfig ──
  describe('updateModelConfig', () => {
    it('should update a single field', async () => {
      const { result } = renderUseModelContext()
      await act(async () => {
        await result.current.addModelConfig({
          name: 'Original',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-orig',
          api: 'openai-completions' as const,
          isEnabled: true,
          enabledModels: ['gpt-4'],
        })
      })

      const id = result.current.modelConfigs[0].id
      await act(async () => {
        await result.current.updateModelConfig(id, { name: 'Updated' })
      })

      expect(result.current.modelConfigs[0].name).toBe('Updated')
    })

    it('should update multiple fields', async () => {
      const { result } = renderUseModelContext()
      await act(async () => {
        await result.current.addModelConfig({
          name: 'Multi',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-multi',
          api: 'openai-completions' as const,
          isEnabled: true,
          enabledModels: ['gpt-4'],
        })
      })

      const id = result.current.modelConfigs[0].id
      await act(async () => {
        await result.current.updateModelConfig(id, {
          name: 'Updated Multi',
          provider: 'anthropic',
          baseUrl: 'https://api.anthropic.com',
          apiKey: 'sk-new',
        })
      })

      const cfg = result.current.modelConfigs[0]
      expect(cfg.name).toBe('Updated Multi')
      expect(cfg.provider).toBe('anthropic')
      expect(cfg.baseUrl).toBe('https://api.anthropic.com')
      expect(cfg.apiKey).toBe('sk-new')
    })

    it('should not affect other configs', async () => {
      const { result } = renderUseModelContext()
      await act(async () => {
        await result.current.addModelConfig({
          name: 'Unchanged',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-unchanged',
          api: 'openai-completions' as const,
          isEnabled: true,
          enabledModels: ['gpt-4'],
        })
        await result.current.addModelConfig({
          name: 'Changed',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-changed',
          api: 'openai-completions' as const,
          isEnabled: true,
          enabledModels: ['gpt-4'],
        })
      })

      const changeId = result.current.modelConfigs.find(c => c.name === 'Changed')!.id
      await act(async () => {
        await result.current.updateModelConfig(changeId, { name: 'Done' })
      })

      expect(result.current.modelConfigs.find(c => c.name === 'Unchanged')).toBeDefined()
      expect(result.current.modelConfigs.find(c => c.name === 'Done')).toBeDefined()
    })

    it('should do nothing for non-existent id', async () => {
      const { result } = renderUseModelContext()
      await act(async () => {
        await result.current.addModelConfig({
          name: 'Sole',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-sole',
          api: 'openai-completions' as const,
          isEnabled: true,
          enabledModels: ['gpt-4'],
        })
      })

      await act(async () => {
        await result.current.updateModelConfig('non-existent', { name: 'Nope' })
      })

      expect(result.current.modelConfigs).toHaveLength(1)
      expect(result.current.modelConfigs[0].name).toBe('Sole')
    })

    it('should update localStorage after update', async () => {
      const { result } = renderUseModelContext()
      await act(async () => {
        await result.current.addModelConfig({
          name: 'Persist',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-persist',
          api: 'openai-completions' as const,
          isEnabled: true,
          enabledModels: ['gpt-4'],
        })
      })

      const id = result.current.modelConfigs[0].id
      await act(async () => {
        await result.current.updateModelConfig(id, { name: 'Persisted' })
      })

      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(saved[0].name).toBe('Persisted')
    })
  })

  // ── 6. getEnabledModels ──
  describe('getEnabledModels', () => {
    it('should return models from enabled configs', async () => {
      const { result } = renderUseModelContext()
      await act(async () => {
        await result.current.addModelConfig({
          name: 'Enabled',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-en',
          api: 'openai-completions' as const,
          isEnabled: true,
          enabledModels: ['gpt-4', 'gpt-4o', 'gpt-3.5-turbo'],
        })
      })

      const models = result.current.getEnabledModels()
      expect(models).toHaveLength(3)
      expect(models[0].id).toBe('gpt-4')
      expect(models[1].id).toBe('gpt-4o')
      expect(models[2].id).toBe('gpt-3.5-turbo')
    })

    it('should not return models from disabled configs', async () => {
      const { result } = renderUseModelContext()
      await act(async () => {
        await result.current.addModelConfig({
          name: 'Disabled',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-dis',
          api: 'openai-completions' as const,
          isEnabled: false,
          enabledModels: ['gpt-4'],
        })
      })

      expect(result.current.getEnabledModels()).toHaveLength(0)
    })

    it('should mix models from multiple enabled configs', async () => {
      const { result } = renderUseModelContext()
      await act(async () => {
        await result.current.addModelConfig({
          name: 'OpenAI',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-oa',
          api: 'openai-completions' as const,
          isEnabled: true,
          enabledModels: ['gpt-4', 'gpt-3.5-turbo'],
        })
        await result.current.addModelConfig({
          name: 'Anthropic',
          provider: 'anthropic',
          baseUrl: 'https://api.anthropic.com',
          apiKey: 'sk-an',
          api: 'anthropic-messages' as const,
          isEnabled: true,
          enabledModels: ['claude-3-opus', 'claude-3-sonnet'],
        })
      })

      const models = result.current.getEnabledModels()
      expect(models).toHaveLength(4)
      const providers = models.map(m => m.provider)
      expect(providers.filter(p => p === 'openai')).toHaveLength(2)
      expect(providers.filter(p => p === 'anthropic')).toHaveLength(2)
    })

    it('should exclude models from disabled configs in mixed setup', async () => {
      const { result } = renderUseModelContext()
      await act(async () => {
        await result.current.addModelConfig({
          name: 'Enabled',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-en',
          api: 'openai-completions' as const,
          isEnabled: true,
          enabledModels: ['gpt-4'],
        })
        await result.current.addModelConfig({
          name: 'Disabled',
          provider: 'anthropic',
          baseUrl: 'https://api.anthropic.com',
          apiKey: 'sk-dis',
          api: 'anthropic-messages' as const,
          isEnabled: false,
          enabledModels: ['claude-3-opus'],
        })
      })

      const models = result.current.getEnabledModels()
      expect(models).toHaveLength(1)
      expect(models[0].id).toBe('gpt-4')
    })

    it('should return each model with provider info', async () => {
      const { result } = renderUseModelContext()
      await act(async () => {
        await result.current.addModelConfig({
          name: 'My OpenAI',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-oa',
          api: 'openai-completions' as const,
          isEnabled: true,
          enabledModels: ['gpt-4'],
        })
      })

      const models = result.current.getEnabledModels()
      expect(models[0]).toEqual({
        id: 'gpt-4',
        name: 'gpt-4',
        provider: 'openai',
      })
    })
  })

  // ── 7. localStorage persistence chain ──
  describe('localStorage persistence chain', () => {
    it('should persist after add then remove then add', async () => {
      const { result } = renderUseModelContext()
      await act(async () => {
        await result.current.addModelConfig({
          name: 'Temp',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-temp',
          api: 'openai-completions' as const,
          isEnabled: true,
          enabledModels: ['gpt-4'],
        })
      })

      const id = result.current.modelConfigs[0].id
      await act(async () => {
        await result.current.removeModelConfig(id)
      })

      await act(async () => {
        await result.current.addModelConfig({
          name: 'Final',
          provider: 'anthropic',
          baseUrl: 'https://api.anthropic.com',
          apiKey: 'sk-fin',
          api: 'anthropic-messages' as const,
          isEnabled: true,
          enabledModels: ['claude-3-opus'],
        })
      })

      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(saved).toHaveLength(1)
      expect(saved[0].name).toBe('Final')
    })
  })

  // ── 8. useModelContext error ──
  describe('useModelContext outside Provider', () => {
    it('should throw when used without ModelProvider', () => {
      expect(() => renderHook(() => useModelContext())).toThrow(
        'useModelContext must be used within a ModelProvider'
      )
    })
  })

  // ── 9. Children rendering ──
  describe('children rendering', () => {
    it('should render children inside ModelProvider', () => {
      render(
        <ModelProvider>
          <div data-testid="child">Hello</div>
        </ModelProvider>
      )
      expect(screen.getByTestId('child')).toHaveTextContent('Hello')
    })

    it('should provide context to deeply nested children', () => {
      function DeepChild() {
        const { modelConfigs } = useModelContext()
        return <span data-testid="count">{modelConfigs.length}</span>
      }
      render(
        <ModelProvider>
          <DeepChild />
        </ModelProvider>
      )
      expect(screen.getByTestId('count')).toHaveTextContent('0')
    })
  })

  // ── 10. isEnabled toggle ──
  describe('isEnabled toggle', () => {
    it('should toggle isEnabled via updateModelConfig', async () => {
      const { result } = renderUseModelContext()
      await act(async () => {
        await result.current.addModelConfig({
          name: 'Toggleable',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-tog',
          api: 'openai-completions' as const,
          isEnabled: true,
          enabledModels: ['gpt-4'],
        })
      })

      const id = result.current.modelConfigs[0].id
      expect(result.current.getEnabledModels()).toHaveLength(1)

      await act(async () => {
        await result.current.updateModelConfig(id, { isEnabled: false })
      })

      expect(result.current.getEnabledModels()).toHaveLength(0)

      await act(async () => {
        await result.current.updateModelConfig(id, { isEnabled: true })
      })

      expect(result.current.getEnabledModels()).toHaveLength(1)
    })
  })
})
