import { useState, useEffect } from 'react'
import {
  X,
  ChevronDown,
  Check,
  Loader2,
  Plug,
  Zap,
  Plus,
  RefreshCw,
  Database,
} from 'lucide-react'
import { cn } from '@/renderer/lib/utils'
import { useModelContext, type ModelConfig } from '@/renderer/contexts/ModelContext'
import { ipcClient } from '@/renderer/ipc-client'

interface EditModelModalProps {
  isOpen: boolean
  onClose: () => void
  config: ModelConfig | null
}

type ProviderType = 'anthropic' | 'openai' | 'google' | 'custom'

interface ModelOption {
  id: string
  name: string
  description: string
}

const providers: { id: ProviderType; name: string; baseUrl: string; api: string }[] = [
  { id: 'anthropic', name: 'Anthropic', baseUrl: 'https://api.anthropic.com', api: 'anthropic-messages' },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', api: 'openai-completions' },
  { id: 'google', name: 'Google', baseUrl: 'https://generativelanguage.googleapis.com', api: 'google-generative-ai' },
  { id: 'custom', name: '自定义', baseUrl: '', api: 'openai-completions' },
]

const availableModels: Record<ProviderType, ModelOption[]> = {
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: '最新一代，平衡性能与速度' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: '高性能，适合复杂任务' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: '快速响应，成本更低' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: '最强大，适合专业任务' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', description: '最新多模态模型' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: '快速且经济实惠' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: '高性能，支持长上下文' },
    { id: 'o1-preview', name: 'o1-preview', description: '推理能力最强' },
  ],
  google: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: '最新快速模型' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: '高性能，支持长上下文' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: '平衡性能与速度' },
  ],
  custom: [],
}

export function EditModelModal({ isOpen, onClose, config }: EditModelModalProps) {
  const { updateModelConfig } = useModelContext()
  const [configName, setConfigName] = useState('')
  const [provider, setProvider] = useState<ProviderType>('anthropic')
  const [baseUrl, setBaseUrl] = useState('https://api.anthropic.com')
  const [apiKey, setApiKey] = useState('')
  const [api, setApi] = useState('anthropic-messages')
  const [isEnabled, setIsEnabled] = useState(true)
  const [enabledModels, setEnabledModels] = useState<Set<string>>(new Set())
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [showProviderDropdown, setShowProviderDropdown] = useState(false)
  const [isFetchingModels, setIsFetchingModels] = useState(false)
  const [customModelId, setCustomModelId] = useState('')
  const [customModelName, setCustomModelName] = useState('')
  const [fetchedModels, setFetchedModels] = useState<ModelOption[]>([])

  // 初始化表单数据
  useEffect(() => {
    if (config && isOpen) {
      setConfigName(config.name)
      setProvider(config.provider as ProviderType)
      setApi(config.api || 'openai-completions')
      setBaseUrl(config.baseUrl)
      setApiKey(config.apiKey)
      setIsEnabled(config.isEnabled)
      setEnabledModels(new Set(config.enabledModels))
      setTestResult(null)
      
      // 把已启用的模型（包括自定义的）添加到 fetchedModels
      const predefinedModels = availableModels[config.provider as ProviderType] || []
      const customModels: ModelOption[] = config.enabledModels
        .filter(id => !predefinedModels.some(m => m.id === id))
        .map(id => ({
          id,
          name: id,
          description: '自定义模型',
        }))
      setFetchedModels([...predefinedModels, ...customModels])
    }
  }, [config, isOpen])

  if (!isOpen || !config) return null

  const handleProviderChange = (newProvider: ProviderType) => {
    setProvider(newProvider)
    const providerInfo = providers.find((p) => p.id === newProvider)
    if (providerInfo) {
      setBaseUrl(providerInfo.baseUrl)
      setApi(providerInfo.api)
    }
    setShowProviderDropdown(false)
    setTestResult(null)
    setFetchedModels([])
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult(null)
    try {
      const result = await ipcClient.testConnection({
        provider,
        baseUrl,
        apiKey,
      })
      setTestResult(result.success ? 'success' : 'error')
      if (!result.success && result.error) {
        console.error('连接测试失败:', result.error)
      }
    } catch (error: any) {
      setTestResult('error')
      console.error('连接测试异常:', error)
    } finally {
      setIsTesting(false)
    }
  }

  const handleFetchModels = async () => {
    setIsFetchingModels(true)
    setTestResult(null)
    try {
      // 调用后端测试连接
      const result = await ipcClient.testConnection({
        provider,
        baseUrl,
        apiKey,
      })
      
      if (result.success) {
        // 连接成功，使用预定义的模型列表
        setFetchedModels(availableModels[provider] || [])
        setTestResult('success')
      } else {
        // 连接失败
        setTestResult('error')
        console.error('获取模型失败:', result.error)
      }
    } catch (error: any) {
      setTestResult('error')
      console.error('获取模型异常:', error)
    } finally {
      setIsFetchingModels(false)
    }
  }

  const toggleModel = (modelId: string) => {
    setEnabledModels((prev) => {
      const next = new Set(prev)
      if (next.has(modelId)) {
        next.delete(modelId)
      } else {
        next.add(modelId)
      }
      return next
    })
  }

  const handleAddCustomModel = () => {
    if (customModelId && customModelName) {
      const newModel: ModelOption = {
        id: customModelId,
        name: customModelName,
        description: '自定义模型',
      }
      setFetchedModels((prev) => [...prev, newModel])
      // 自动启用添加的模型
      setEnabledModels((prev) => {
        const next = new Set(prev)
        next.add(customModelId)
        return next
      })
      setCustomModelId('')
      setCustomModelName('')
    }
  }

  const handleSave = () => {
    // 更新前端 localStorage
    updateModelConfig(config.id, {
      name: configName,
      provider,
      baseUrl,
      apiKey,
      api,
      isEnabled,
      enabledModels: Array.from(enabledModels),
    })
    onClose()
  }

  const models = fetchedModels.length > 0 ? fetchedModels : (availableModels[provider] || [])

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 设置面板 */}
      <div className="relative w-[640px] max-h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 h-14 border-b border-border">
          <h2 className="text-base font-semibold">编辑模型配置</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"
          >
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 基本信息 */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              基本信息
            </h3>
            <div className="space-y-4">
              {/* 配置名称 */}
              <div>
                <label className="block text-sm font-medium mb-1.5">配置名称</label>
                <input
                  type="text"
                  value={configName}
                  onChange={(e) => setConfigName(e.target.value)}
                  placeholder="例: My Anthropic"
                  className="w-full h-9 px-3 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-muted-foreground"
                />
              </div>

              {/* 供应商类型 */}
              <div>
                <label className="block text-sm font-medium mb-1.5">供应商类型</label>
                <div className="relative">
                  <button
                    onClick={() => setShowProviderDropdown(!showProviderDropdown)}
                    className="w-full h-9 px-3 text-sm border border-border rounded-lg bg-white flex items-center justify-between hover:border-primary/50 transition-colors"
                  >
                    <span>{providers.find((p) => p.id === provider)?.name}</span>
                    <ChevronDown size={14} className={cn('text-muted-foreground transition-transform', showProviderDropdown && 'rotate-180')} />
                  </button>
                  
                  {showProviderDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg z-10 overflow-hidden">
                      {providers.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => handleProviderChange(p.id)}
                          className={cn(
                            'w-full px-3 py-2 text-sm text-left hover:bg-muted transition-colors flex items-center justify-between',
                            provider === p.id && 'bg-muted'
                          )}
                        >
                          <span>{p.name}</span>
                          {provider === p.id && <Check size={14} className="text-primary" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Base URL */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Base URL</label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.example.com"
                  className="w-full h-9 px-3 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-muted-foreground font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  预览: <span className="text-foreground">{baseUrl}/v1/messages</span>
                </p>
              </div>

              {/* API 类型 */}
              <div>
                <label className="block text-sm font-medium mb-1.5">API 类型</label>
                <select
                  value={api}
                  onChange={(e) => setApi(e.target.value)}
                  className="w-full h-9 px-3 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                >
                  <option value="openai-completions">OpenAI Completions (兼容)</option>
                  <option value="anthropic-messages">Anthropic Messages</option>
                  <option value="google-generative-ai">Google Generative AI</option>
                  <option value="openai-responses">OpenAI Responses</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1.5">
                  选择与你的 API 兼容的格式
                </p>
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium mb-1.5">API Key</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value)
                      setTestResult(null)
                    }}
                    placeholder="输入API Key"
                    className="flex-1 h-9 px-3 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-muted-foreground"
                  />
                  <button
                    onClick={handleTestConnection}
                    disabled={!apiKey || isTesting}
                    className={cn(
                      'h-9 px-4 text-sm border border-border rounded-lg flex items-center gap-2 transition-colors',
                      !apiKey || isTesting
                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                        : 'bg-white hover:bg-muted text-foreground'
                    )}
                  >
                    {isTesting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        测试中
                      </>
                    ) : (
                      <>
                        <Plug size={14} />
                        测试连接
                      </>
                    )}
                  </button>
                </div>
                {testResult && (
                  <p className={cn(
                    'text-xs mt-1.5 flex items-center gap-1',
                    testResult === 'success' ? 'text-green-600' : 'text-destructive'
                  )}>
                    {testResult === 'success' ? (
                      <>
                        <Check size={12} />
                        连接成功，可以点击"从供应商获取"获取模型列表
                      </>
                    ) : (
                      <>
                        <X size={12} />
                        连接失败，请检查 API Key 和 Base URL
                      </>
                    )}
                  </p>
                )}
              </div>

              {/* 启用此配置 */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm font-medium">启用此配置</div>
                  <div className="text-xs text-muted-foreground">关闭后该配置的模型不会在选择列表中出现</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => setIsEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary border border-border"></div>
                </label>
              </div>
            </div>
          </div>

          {/* 已启用模型 */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              已启用模型
            </h3>
            {enabledModels.size > 0 ? (
              <div className="space-y-2">
                {Array.from(enabledModels).map((modelId) => {
                  const model = models.find((m) => m.id === modelId)
                  if (!model) return null
                  return (
                    <div
                      key={modelId}
                      className="flex items-center justify-between p-3 bg-muted/30 border border-border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Zap size={14} className="text-primary" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">{model.name}</div>
                          <div className="text-xs text-muted-foreground">{model.description}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleModel(modelId)}
                        className="text-xs text-destructive hover:bg-destructive/10 px-2 py-1 rounded transition-colors"
                      >
                        移除
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground text-sm bg-muted/20 rounded-lg border border-dashed border-border">
                还没有启用任何模型，从下方可用模型中选择
              </div>
            )}
          </div>

          {/* 可用模型 */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                可用模型
              </h3>
              <button
                onClick={handleFetchModels}
                disabled={isFetchingModels || !apiKey}
                className={cn(
                  'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors',
                  isFetchingModels || !apiKey
                    ? 'text-muted-foreground cursor-not-allowed'
                    : 'text-primary hover:bg-primary/10'
                )}
              >
                <RefreshCw size={12} className={cn(isFetchingModels && 'animate-spin')} />
                {isFetchingModels ? '获取中...' : '从供应商获取'}
              </button>
            </div>

            {/* 自定义添加 */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={customModelId}
                onChange={(e) => setCustomModelId(e.target.value)}
                placeholder="Model ID (如 gpt-4o)"
                className="flex-1 h-8 px-3 text-xs border border-border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-muted-foreground"
              />
              <input
                type="text"
                value={customModelName}
                onChange={(e) => setCustomModelName(e.target.value)}
                placeholder="显示名称"
                className="flex-1 h-8 px-3 text-xs border border-border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-muted-foreground"
              />
              <button
                onClick={handleAddCustomModel}
                disabled={!customModelId || !customModelName}
                className={cn(
                  'h-8 w-8 rounded-lg flex items-center justify-center transition-colors',
                  !customModelId || !customModelName
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                )}
              >
                <Plus size={14} />
              </button>
            </div>

            {models.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {models.map((model) => {
                  const isSelected = enabledModels.has(model.id)
                  return (
                    <button
                      key={model.id}
                      onClick={() => toggleModel(model.id)}
                      className={cn(
                        'p-3 rounded-lg border text-left transition-all',
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50 hover:bg-muted/30'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{model.name}</span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <Check size={12} className="text-white" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{model.description}</p>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm bg-muted/20 rounded-lg border border-dashed border-border">
                <Database size={24} className="mx-auto mb-2 opacity-50" />
                <p>暂无可用模型</p>
                <p className="text-xs mt-1">点击"从供应商获取"或手动添加模型</p>
              </div>
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/30">
          <button
            onClick={onClose}
            className="h-9 px-4 text-sm border border-border rounded-lg bg-white hover:bg-muted transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!configName || !apiKey || enabledModels.size === 0}
            className={cn(
              'h-9 px-4 text-sm rounded-lg transition-colors',
              !configName || !apiKey || enabledModels.size === 0
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
