import { useState, useEffect } from 'react'
import { X, RefreshCw, Check, Loader2 } from 'lucide-react'
import { Button } from '@/renderer/components/ui/button'
import { Input } from '@/renderer/components/ui/input'
import type { ModelConfig } from '@/renderer/contexts/ModelContext'
import { fetchModels, type ModelInfo } from '@/renderer/utils/model-fetcher'

interface ModelModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'add' | 'edit'
  initialConfig?: Partial<ModelConfig>
  onSave: (config: Omit<ModelConfig, 'id' | 'createdAt'>) => Promise<void>
}

const API_TYPES = [
  { value: 'openai-completions', label: 'OpenAI Compatible' },
  { value: 'anthropic-messages', label: 'Anthropic' },
  { value: 'google-generative-ai', label: 'Google AI' },
]

export function ModelModal({ isOpen, onClose, mode, initialConfig, onSave }: ModelModalProps) {
  const [name, setName] = useState('')
  const [provider, setProvider] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [api, setApi] = useState('openai-completions')
  const [isEnabled, setIsEnabled] = useState(true)
  const [contextWindow, setContextWindow] = useState(128000)
  const [modelIdsText, setModelIdsText] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isFetchingModels, setIsFetchingModels] = useState(false)
  const [fetchedModels, setFetchedModels] = useState<ModelInfo[]>([])
  const [showModelList, setShowModelList] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  
  // 当弹窗打开时，从 initialConfig 初始化状态
  useEffect(() => {
    if (isOpen) {
      setName(initialConfig?.name || '')
      setProvider(initialConfig?.provider || '')
      setBaseUrl(initialConfig?.baseUrl || '')
      setApiKey(initialConfig?.apiKey || '')
      setApi(initialConfig?.api || 'openai-completions')
      setIsEnabled(initialConfig?.isEnabled ?? true)
      setContextWindow(initialConfig?.contextWindow || 128000)
      setModelIdsText(initialConfig?.enabledModels?.join(', ') || '')
    }
  }, [isOpen, initialConfig])
  
  const handleSave = async () => {
    setIsSaving(true)
    try {
      // 解析模型 ID：按逗号分割，去除空格，过滤空值
      const parsedModelIds = modelIdsText
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0)

      await onSave({
        name,
        provider,
        baseUrl,
        apiKey,
        api,
        isEnabled,
        enabledModels: parsedModelIds,
        contextWindow,
      })
      onClose()
    } catch (error) {
      console.error('保存模型配置失败:', error)
    } finally {
      setIsSaving(false)
    }
  }
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {mode === 'add' ? '添加模型' : '编辑模型'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        
        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium">名称</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Model"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium">提供商</label>
            <Input
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="OpenAI"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium">API 类型</label>
            <select
              value={api}
              onChange={(e) => setApi(e.target.value)}
              className="w-full p-2 border rounded-md bg-background"
            >
              {API_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="text-sm font-medium">Base URL</label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium">API Key</label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />
          </div>
          
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">模型 ID（多个用逗号分隔）</label>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!baseUrl || !apiKey) {
                    setFetchError('请先填写 Base URL 和 API Key')
                    return
                  }
                  
                  setIsFetchingModels(true)
                  setFetchError(null)
                  setFetchedModels([])
                  
                  try {
                    const result = await fetchModels(api, baseUrl, apiKey)
                    if (result.success && result.models) {
                      setFetchedModels(result.models)
                      setShowModelList(true)
                    } else {
                      setFetchError(result.error || '获取模型列表失败')
                    }
                  } catch (error) {
                    setFetchError(error instanceof Error ? error.message : '获取模型列表失败')
                  } finally {
                    setIsFetchingModels(false)
                  }
                }}
                disabled={isFetchingModels || !baseUrl || !apiKey}
              >
                {isFetchingModels ? (
                  <>
                    <Loader2 size={14} className="mr-1 animate-spin" />
                    获取中...
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} className="mr-1" />
                    获取模型
                  </>
                )}
              </Button>
            </div>
            
            <Input
              value={modelIdsText}
              onChange={(e) => setModelIdsText(e.target.value)}
              placeholder="gpt-4, gpt-3.5-turbo"
              className="mt-1"
            />
            
            {fetchError && (
              <p className="text-xs text-destructive mt-1">
                {fetchError}
              </p>
            )}
            
            {showModelList && fetchedModels.length > 0 && (
              <div className="mt-2 border rounded-md p-2 max-h-40 overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    可用模型 (点击选择)
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowModelList(false)}
                    className="h-6 px-2 text-xs"
                  >
                    关闭
                  </Button>
                </div>
                <div className="space-y-1">
                  {fetchedModels.map((model) => {
                    const isSelected = modelIdsText.split(',').map(id => id.trim()).includes(model.id)
                    return (
                      <div
                        key={model.id}
                        className={`flex items-center justify-between p-1.5 rounded cursor-pointer hover:bg-accent ${
                          isSelected ? 'bg-accent' : ''
                        }`}
                        onClick={() => {
                          const currentIds = modelIdsText
                            .split(',')
                            .map(id => id.trim())
                            .filter(id => id.length > 0)
                          
                          if (isSelected) {
                            // 移除已选择的模型
                            const newIds = currentIds.filter(id => id !== model.id)
                            setModelIdsText(newIds.join(', '))
                          } else {
                            // 添加新模型
                            const newIds = [...currentIds, model.id]
                            setModelIdsText(newIds.join(', '))
                          }
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {model.name || model.id}
                          </div>
                          {model.description && (
                            <div className="text-xs text-muted-foreground truncate">
                              {model.description}
                            </div>
                          )}
                        </div>
                        {isSelected && (
                          <Check size={14} className="ml-2 text-primary flex-shrink-0" />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            
            <p className="text-xs text-muted-foreground mt-1">
              输入该提供商可用的模型 ID，多个用逗号分隔，或点击"获取模型"自动获取
            </p>
          </div>
          
          <div>
            <label className="text-sm font-medium">上下文窗口大小 (tokens)</label>
            <Input
              type="number"
              value={contextWindow}
              onChange={(e) => setContextWindow(Number(e.target.value))}
              placeholder="128000"
              min="1000"
              step="1000"
            />
            <p className="text-xs text-muted-foreground mt-1">
              常见值: GPT-4: 128k, Claude: 200k, Gemini: 1M
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isEnabled"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
            />
            <label htmlFor="isEnabled" className="text-sm">
              启用此模型
            </label>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 p-4 border-t">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    </div>
  )
}
