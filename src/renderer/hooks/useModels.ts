import { useState, useCallback, useEffect } from 'react'
import type { ModelInfo } from '@/shared/types'
import { useModelContext } from '@/renderer/contexts/ModelContext'

// localStorage key
const SELECTED_MODEL_KEY = 'pair-selected-model'

function loadPersistedModel(): string | null {
  try {
    return localStorage.getItem(SELECTED_MODEL_KEY)
  } catch {
    return null
  }
}

function savePersistedModel(modelId: string) {
  try {
    localStorage.setItem(SELECTED_MODEL_KEY, modelId)
  } catch {
    // ignore
  }
}

export function useModels() {
  const { getEnabledModels, modelConfigs } = useModelContext()
  const [models, setModels] = useState<ModelInfo[]>([])
  const [currentModelId, setCurrentModelId] = useState<string>(() => {
    return loadPersistedModel() || ''
  })

  // 当前模型
  const currentModel = models.find((m) => m.id === currentModelId) || models[0] || null

  // 加载模型列表
  const loadModels = useCallback(() => {
    try {
      const contextModels = getEnabledModels()
      
      if (contextModels.length > 0) {
        const modelInfos: ModelInfo[] = contextModels.map(m => ({
          id: m.id,
          name: m.name,
          provider: m.provider,
        }))
        setModels(modelInfos)
        
        // 如果当前模型不在列表中，选择第一个
        if (!modelInfos.find(m => m.id === currentModelId)) {
          setCurrentModelId(modelInfos[0].id)
        }
      } else {
        setModels([])
      }
    } catch (error) {
      console.error('加载模型列表失败:', error)
      setModels([])
    }
  }, [getEnabledModels, currentModelId])

  // 切换模型
  const selectModel = useCallback((modelId: string) => {
    setCurrentModelId(modelId)
    savePersistedModel(modelId)
  }, [])

  // 监听模型配置变化
  useEffect(() => {
    loadModels()
  }, [loadModels, modelConfigs])

  return {
    models,
    currentModel,
    currentModelId,
    selectModel,
    loadModels,
  }
}
