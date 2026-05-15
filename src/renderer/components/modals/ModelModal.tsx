import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/renderer/components/ui/button'
import { Input } from '@/renderer/components/ui/input'
import type { ModelConfig } from '@/renderer/contexts/ModelContext'

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
  const [name, setName] = useState(initialConfig?.name || '')
  const [provider, setProvider] = useState(initialConfig?.provider || '')
  const [baseUrl, setBaseUrl] = useState(initialConfig?.baseUrl || '')
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey || '')
  const [api, setApi] = useState(initialConfig?.api || 'openai-completions')
  const [isEnabled, setIsEnabled] = useState(initialConfig?.isEnabled ?? true)
  const [isSaving, setIsSaving] = useState(false)
  
  useEffect(() => {
    if (isOpen && initialConfig) {
      setName(initialConfig.name || '')
      setProvider(initialConfig.provider || '')
      setBaseUrl(initialConfig.baseUrl || '')
      setApiKey(initialConfig.apiKey || '')
      setApi(initialConfig.api || 'openai-completions')
      setIsEnabled(initialConfig.isEnabled ?? true)
    }
  }, [isOpen, initialConfig])
  
  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave({
        name,
        provider,
        baseUrl,
        apiKey,
        api,
        isEnabled,
        enabledModels: initialConfig?.enabledModels || [],
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
