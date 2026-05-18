import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronRight, Plug, X, Plus, Trash2, Power, PowerOff, RefreshCw, Loader2, Server, Terminal, Wrench } from 'lucide-react'
import type { McpServerConfig, McpServerStatus } from '@/shared/types'

interface McpModalProps {
  isOpen: boolean
  onClose: () => void
}

export function McpModal({ isOpen, onClose }: McpModalProps) {
  const [servers, setServers] = useState<McpServerConfig[]>([])
  const [statuses, setStatuses] = useState<Map<string, McpServerStatus>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [connectingIds, setConnectingIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set())
  const [toolsCache, setToolsCache] = useState<Map<string, any[]>>(new Map())
  const [toolLoadingIds, setToolLoadingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  const loadData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [configs, allStatuses] = await Promise.all([
        window.electronAPI.mcp.listServers(),
        window.electronAPI.mcp.getAllStatuses(),
      ])
      setServers(configs)
      const statusMap = new Map<string, McpServerStatus>()
      for (const s of allStatuses) {
        statusMap.set(s.id, s)
      }
      setStatuses(statusMap)
    } catch (err) {
      console.error('加载 MCP 服务器列表失败:', err)
      setError('加载失败')
    } finally {
      setIsLoading(false)
    }
  }

  const refreshStatuses = useCallback(async () => {
    try {
      const allStatuses = await window.electronAPI.mcp.getAllStatuses()
      const statusMap = new Map<string, McpServerStatus>()
      for (const s of allStatuses) {
        statusMap.set(s.id, s)
      }
      setStatuses(statusMap)
    } catch (err) {
      console.error('刷新状态失败:', err)
    }
  }, [])

  const handleConnect = async (config: McpServerConfig) => {
    setConnectingIds(prev => new Set(prev).add(config.id))
    setError(null)
    try {
      await window.electronAPI.mcp.connect(config)
      await refreshStatuses()
    } catch (err: any) {
      setError(`${config.name} 连接失败: ${err.message}`)
      await refreshStatuses()
    } finally {
      setConnectingIds(prev => {
        const next = new Set(prev)
        next.delete(config.id)
        return next
      })
    }
  }

  const handleDisconnect = async (id: string) => {
    setError(null)
    try {
      await window.electronAPI.mcp.disconnect(id)
      await refreshStatuses()
    } catch (err: any) {
      setError(`断开连接失败: ${err.message}`)
    }
  }

  const handleRemove = async (id: string) => {
    setError(null)
    try {
      await window.electronAPI.mcp.removeServer(id)
      setServers(prev => prev.filter(s => s.id !== id))
      setStatuses(prev => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
    } catch (err: any) {
      setError(`删除失败: ${err.message}`)
    }
  }

  const handleToggleTools = async (serverId: string) => {
    const isExpanded = expandedServers.has(serverId)
    if (isExpanded) {
      setExpandedServers(prev => {
        const next = new Set(prev)
        next.delete(serverId)
        return next
      })
      return
    }

    setExpandedServers(prev => new Set(prev).add(serverId))

    if (!toolsCache.has(serverId)) {
      setToolLoadingIds(prev => new Set(prev).add(serverId))
      try {
        const tools = await window.electronAPI.mcp.getTools(serverId)
        setToolsCache(prev => {
          const next = new Map(prev)
          next.set(serverId, tools)
          return next
        })
      } catch (err) {
        console.error(`获取 MCP 工具列表失败 (${serverId}):`, err)
      } finally {
        setToolLoadingIds(prev => {
          const next = new Set(prev)
          next.delete(serverId)
          return next
        })
      }
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">已连接</span>
      case 'connecting':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">连接中</span>
      case 'error':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">错误</span>
      default:
        return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">未连接</span>
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-[700px] h-[500px] bg-background rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 h-14 border-b border-border">
          <div className="flex items-center gap-2">
            <Plug size={16} className="text-foreground" />
            <span className="text-sm font-semibold">MCP 服务器</span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center transition-colors"
          >
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 p-6 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <span className="text-sm text-red-500">{error}</span>
              <button
                onClick={loadData}
                className="text-sm text-primary hover:underline"
              >
                重试
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  服务器列表 {servers.length > 0 && `(${servers.length})`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={refreshStatuses}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors"
                    title="刷新状态"
                  >
                    <RefreshCw size={12} />
                    刷新
                  </button>
                  <button
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-1.5 text-xs text-primary hover:bg-primary/10 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    <Plus size={14} />
                    添加 MCP 服务器
                  </button>
                </div>
              </div>

              {isAdding && (
                <AddServerForm
                  onSave={async (config) => {
                    try {
                      await window.electronAPI.mcp.addServer(config)
                      setServers(prev => {
                        const idx = prev.findIndex(s => s.id === config.id)
                        if (idx >= 0) {
                          const next = [...prev]
                          next[idx] = config
                          return next
                        }
                        return [...prev, config]
                      })
                      setIsAdding(false)
                    } catch (err: any) {
                      setError(`添加失败: ${err.message}`)
                    }
                  }}
                  onCancel={() => setIsAdding(false)}
                />
              )}

              {servers.length === 0 && !isAdding ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Server size={40} className="mb-3 opacity-30" />
                  <p className="text-sm mb-1">还没有配置 MCP 服务器</p>
                  <p className="text-xs">点击上方"添加 MCP 服务器"按钮开始配置</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {servers.map(config => {
                    const status = statuses.get(config.id)
                    const isConnecting = connectingIds.has(config.id)
                    const isExpanded = expandedServers.has(config.id)
                    const tools = toolsCache.get(config.id)
                    const isLoadingTools = toolLoadingIds.has(config.id)
                    return (
                      <div key={config.id}>
                        {/* 服务器卡片行 */}
                        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* 展开/收起按钮 */}
                            <button
                              onClick={() => handleToggleTools(config.id)}
                              className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center shrink-0 transition-colors"
                              title={isExpanded ? '收起工具列表' : '展开工具列表'}
                            >
                              {isExpanded ? (
                                <ChevronDown size={14} className="text-muted-foreground" />
                              ) : (
                                <ChevronRight size={14} className="text-muted-foreground" />
                              )}
                            </button>
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Terminal size={14} className="text-primary" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">{config.name}</span>
                                {getStatusBadge(status?.status || 'disconnected')}
                                {config.scope === 'project' && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 leading-none">项目</span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                                {config.command} {config.args?.join(' ')}
                              </div>
                              {status && status.toolCount > 0 && (
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {status.toolCount} 个工具
                                </div>
                              )}
                              {status?.status === 'error' && status.error && (
                                <div className="text-xs text-red-500 mt-0.5 truncate max-w-[300px]">
                                  {status.error}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            {status?.status === 'connected' ? (
                              <button
                                onClick={() => handleDisconnect(config.id)}
                                disabled={isConnecting}
                                className="w-7 h-7 rounded-lg hover:bg-orange-100 flex items-center justify-center transition-colors disabled:opacity-50"
                                title="断开连接"
                              >
                                <PowerOff size={14} className="text-orange-500" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleConnect(config)}
                                disabled={isConnecting}
                                className="w-7 h-7 rounded-lg hover:bg-green-100 flex items-center justify-center transition-colors disabled:opacity-50"
                                title="连接"
                              >
                                {isConnecting ? (
                                  <Loader2 size={14} className="animate-spin text-green-600" />
                                ) : (
                                  <Power size={14} className="text-green-600" />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => handleRemove(config.id)}
                              className="w-7 h-7 rounded-lg hover:bg-destructive/10 flex items-center justify-center transition-colors"
                              title="删除"
                            >
                              <Trash2 size={14} className="text-destructive" />
                            </button>
                          </div>
                        </div>

                        {/* 工具列表展开区 */}
                        {isExpanded && (
                          <div className="ml-10 mt-1 mb-2 p-3 bg-background rounded-xl border border-border space-y-1.5">
                            {isLoadingTools ? (
                              <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                                <Loader2 size={12} className="animate-spin" />
                                加载工具列表...
                              </div>
                            ) : tools && tools.length > 0 ? (
                              tools.map((tool: any, i: number) => (
                                <div
                                  key={tool.name || i}
                                  className="flex items-start gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                  <Wrench size={13} className="mt-0.5 shrink-0 text-muted-foreground" />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium">{tool.name}</span>
                                      {tool.inputSchema?.required && tool.inputSchema.required.length > 0 && (
                                        <span className="text-[10px] text-muted-foreground">
                                          req: {tool.inputSchema.required.join(', ')}
                                        </span>
                                      )}
                                    </div>
                                    {tool.description && (
                                      <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                        {tool.description}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="py-2 text-xs text-muted-foreground text-center">
                                该服务器没有提供工具
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {servers.length} 个服务器{isLoading ? '' : `，${Array.from(statuses.values()).filter(s => s.status === 'connected').length} 个已连接`}
          </span>
        </div>
      </div>
    </div>
  )
}

interface AddServerFormProps {
  onSave: (config: McpServerConfig) => Promise<void>
  onCancel: () => void
}

function AddServerForm({ onSave, onCancel }: AddServerFormProps) {
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('')
  const [env, setEnv] = useState('{}')
  const [autoStart, setAutoStart] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setFormError(null)
    if (!id.trim()) { setFormError('请输入服务器 ID'); return }
    if (!name.trim()) { setFormError('请输入服务器名称'); return }
    if (!command.trim()) { setFormError('请输入可执行文件路径'); return }

    let parsedEnv: Record<string, string> = {}
    if (env.trim()) {
      try {
        parsedEnv = JSON.parse(env.trim())
        if (typeof parsedEnv !== 'object' || Array.isArray(parsedEnv)) throw new Error()
      } catch {
        setFormError('环境变量格式错误，请输入有效的 JSON 对象')
        return
      }
    }

    setSaving(true)
    try {
      await onSave({
        id: id.trim(),
        name: name.trim(),
        command: command.trim(),
        args: args.trim() ? args.split(',').map(a => a.trim()).filter(Boolean) : [],
        env: Object.keys(parsedEnv).length > 0 ? parsedEnv : undefined,
        autoStart,
        disabled: false,
      })
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-border p-4 space-y-3">
      <h4 className="text-sm font-medium">添加 MCP 服务器</h4>

      {formError && (
        <div className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{formError}</div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">ID *</label>
          <input
            type="text"
            value={id}
            onChange={e => setId(e.target.value)}
            placeholder="my-server"
            className="w-full text-sm border border-border rounded-lg px-3 py-1.5 bg-white"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">名称 *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="My Server"
            className="w-full text-sm border border-border rounded-lg px-3 py-1.5 bg-white"
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground block mb-1">可执行文件路径 *</label>
          <input
            type="text"
            value={command}
            onChange={e => setCommand(e.target.value)}
            placeholder="node"
            className="w-full text-sm border border-border rounded-lg px-3 py-1.5 bg-white"
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground block mb-1">参数（逗号分隔）</label>
          <input
            type="text"
            value={args}
            onChange={e => setArgs(e.target.value)}
            placeholder="server.js, --port, 3000"
            className="w-full text-sm border border-border rounded-lg px-3 py-1.5 bg-white"
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground block mb-1">环境变量 (JSON)</label>
          <textarea
            value={env}
            onChange={e => setEnv(e.target.value)}
            rows={2}
            className="w-full text-sm border border-border rounded-lg px-3 py-1.5 bg-white font-mono resize-none"
          />
        </div>
        <div className="flex items-end pb-1.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoStart}
              onChange={e => setAutoStart(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-xs text-muted-foreground">自动连接</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          disabled={saving}
          className="text-xs text-muted-foreground border border-border px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="text-xs text-white bg-primary px-3 py-1.5 rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          {saving && <Loader2 size={12} className="animate-spin" />}
          保存
        </button>
      </div>
    </div>
  )
}
