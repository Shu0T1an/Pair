import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export interface ModelConfig {
  id: string
  name: string
  provider: string
  baseUrl: string
  apiKey: string
  api: string  // API 类型: 'openai-completions' | 'anthropic-messages' | 'google-generative-ai'
  isEnabled: boolean
  enabledModels: string[]
  createdAt: Date
}

interface ModelContextType {
  modelConfigs: ModelConfig[]
  addModelConfig: (config: Omit<ModelConfig, 'id' | 'createdAt'>) => Promise<ModelConfig>
  removeModelConfig: (id: string) => Promise<void>
  updateModelConfig: (id: string, updates: Partial<ModelConfig>) => Promise<void>
  getEnabledModels: () => Array<{ id: string; name: string; provider: string }>
}

const ModelContext = createContext<ModelContextType | null>(null)

const STORAGE_KEY = 'pair-model-configs'

function loadConfigs(): ModelConfig[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.error('Failed to load model configs:', e)
  }
  return []
}

function saveConfigs(configs: ModelConfig[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs))
  } catch (e) {
    console.error('Failed to save model configs:', e)
  }
}

export function ModelProvider({ children }: { children: ReactNode }) {
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>(loadConfigs)

  useEffect(() => {
    saveConfigs(modelConfigs)
  }, [modelConfigs])

  const addModelConfig = async (config: Omit<ModelConfig, 'id' | 'createdAt'>): Promise<ModelConfig> => {
    const newConfig: ModelConfig = {
      ...config,
      id: `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
    }
    setModelConfigs(prev => [...prev, newConfig])
    return newConfig
  }

  const removeModelConfig = async (id: string) => {
    setModelConfigs(prev => prev.filter(c => c.id !== id))
    // 配置已从 localStorage 移除
  }

  const updateModelConfig = async (id: string, updates: Partial<ModelConfig>) => {
    setModelConfigs(prev =>
      prev.map(c => (c.id === id ? { ...c, ...updates } : c))
    )
    // 配置已更新到 localStorage
  }

  const getEnabledModels = () => {
    return modelConfigs
      .filter(config => config.isEnabled)
      .flatMap(config =>
        config.enabledModels.map(modelId => ({
          id: modelId,
          name: modelId,
          provider: config.provider,
        }))
      )
  }

  return (
    <ModelContext.Provider
      value={{
        modelConfigs,
        addModelConfig,
        removeModelConfig,
        updateModelConfig,
        getEnabledModels,
      }}
    >
      {children}
    </ModelContext.Provider>
  )
}

export function useModelContext() {
  const context = useContext(ModelContext)
  if (!context) {
    throw new Error('useModelContext must be used within a ModelProvider')
  }
  return context
}
