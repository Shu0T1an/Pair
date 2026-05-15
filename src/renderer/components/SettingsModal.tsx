import { useState } from 'react'
import {
  Settings,
  X,
  Monitor,
  Palette,
  Info,
  ChevronRight,
  Moon,
  Sun,
  Globe,
  Shield,
  Bell,
  Database,
  Plus,
  Trash2,
  Zap,
  Edit2,
  MessageSquare,
  Brain,
  Wrench,
  Eye,
  RotateCcw,
} from 'lucide-react'
import { cn } from '@/renderer/lib/utils'
import { AddModelModal } from './AddModelModal'
import { EditModelModal } from './EditModelModal'
import { useModelContext, type ModelConfig } from '@/renderer/contexts/ModelContext'
import { useMessageSettings } from '@/renderer/contexts/MessageSettingsContext'

type SettingsTab = 'general' | 'model' | 'message' | 'appearance' | 'about'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [isAddModelOpen, setIsAddModelOpen] = useState(false)
  const [isEditModelOpen, setIsEditModelOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<ModelConfig | null>(null)

  const handleEditConfig = (config: ModelConfig) => {
    setEditingConfig(config)
    setIsEditModelOpen(true)
  }

  if (!isOpen) return null

  const tabs = [
    { id: 'general' as const, label: '通用设置', icon: Monitor },
    { id: 'model' as const, label: '模型设置', icon: Database },
    { id: 'message' as const, label: '消息设置', icon: MessageSquare },
    { id: 'appearance' as const, label: '外观设置', icon: Palette },
    { id: 'about' as const, label: '关于/更新', icon: Info },
  ]

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 设置面板 */}
      <div className="relative w-[800px] h-[560px] bg-white rounded-2xl shadow-2xl flex overflow-hidden">
        {/* 左侧导航 */}
        <div className="w-[200px] bg-muted/50 border-r border-border flex flex-col">
          {/* 标题 */}
          <div className="flex items-center justify-between px-4 h-14 border-b border-border">
            <div className="flex items-center gap-2">
              <Settings size={16} className="text-foreground" />
              <span className="text-sm font-semibold">设置</span>
            </div>
            <button
              onClick={onClose}
              className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center transition-colors"
            >
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>

          {/* 导航列表 */}
          <div className="flex-1 p-2 space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                    activeTab === tab.id
                      ? 'bg-white text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
                  )}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 右侧内容 */}
        <div className="flex-1 flex flex-col">
          {/* 内容头部 */}
          <div className="flex items-center px-6 h-14 border-b border-border">
            <h2 className="text-base font-semibold">
              {tabs.find((t) => t.id === activeTab)?.label}
            </h2>
          </div>

          {/* 内容区域 */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'general' && <GeneralSettings />}
            {activeTab === 'model' && <ModelSettings onAddModel={() => setIsAddModelOpen(true)} onEditConfig={handleEditConfig} />}
            {activeTab === 'message' && <MessageSettings />}
            {activeTab === 'appearance' && <AppearanceSettings />}
            {activeTab === 'about' && <AboutSettings />}
          </div>
        </div>
      </div>

      {/* 添加模型弹窗 */}
      <AddModelModal
        isOpen={isAddModelOpen}
        onClose={() => setIsAddModelOpen(false)}
      />

      {/* 编辑模型弹窗 */}
      <EditModelModal
        isOpen={isEditModelOpen}
        onClose={() => {
          setIsEditModelOpen(false)
          setEditingConfig(null)
        }}
        config={editingConfig}
      />
    </div>
  )
}

function GeneralSettings() {
  return (
    <div className="space-y-6">
      <SettingsGroup title="基本设置">
        <SettingsItem
          icon={Globe}
          label="语言"
          description="界面显示语言"
          action={
            <select className="text-sm border border-border rounded-md px-2 py-1 bg-white">
              <option>简体中文</option>
              <option>English</option>
            </select>
          }
        />
        <SettingsItem
          icon={Bell}
          label="通知"
          description="接收消息通知"
          action={<ToggleSwitch defaultChecked />}
        />
        <SettingsItem
          icon={Shield}
          label="隐私模式"
          description="不保存聊天记录"
          action={<ToggleSwitch />}
        />
      </SettingsGroup>

      <SettingsGroup title="快捷键">
        <SettingsItem
          label="发送消息"
          description="Enter 发送，Shift+Enter 换行"
          action={
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              Enter
            </span>
          }
        />
        <SettingsItem
          label="打开设置"
          description="快速打开设置面板"
          action={
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              Ctrl + ,
            </span>
          }
        />
      </SettingsGroup>
    </div>
  )
}

function ModelSettings({ onAddModel, onEditConfig }: { onAddModel: () => void; onEditConfig: (config: ModelConfig) => void }) {
  const { modelConfigs, removeModelConfig, getEnabledModels } = useModelContext()
  const enabledModels = getEnabledModels()

  const handleRemoveConfig = (config: ModelConfig) => {
    // 从前端 localStorage 移除
    removeModelConfig(config.id)
  }

  return (
    <div className="space-y-6">
      <SettingsGroup title="默认模型">
        <SettingsItem
          icon={Database}
          label="默认模型"
          description="新建会话时使用的模型"
          action={
            <select className="text-sm border border-border rounded-md px-2 py-1 bg-white">
              {enabledModels.length > 0 ? (
                enabledModels.map(model => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))
              ) : (
                <option value="">暂无可用模型</option>
              )}
            </select>
          }
        />
      </SettingsGroup>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            模型配置
          </h3>
          <button
            onClick={onAddModel}
            className="flex items-center gap-1.5 text-xs text-primary hover:bg-primary/10 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={14} />
            添加模型
          </button>
        </div>
        <div className="bg-muted/30 rounded-xl border border-border p-4">
          {modelConfigs.length > 0 ? (
            <div className="space-y-3">
              {modelConfigs.map(config => (
                <div
                  key={config.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-border"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Zap size={14} className="text-primary" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{config.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {config.provider} • {config.enabledModels.length} 个模型
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs px-2 py-1 rounded-full',
                      config.isEnabled
                        ? 'bg-green-100 text-green-700'
                        : 'bg-muted text-muted-foreground'
                    )}>
                      {config.isEnabled ? '已启用' : '已禁用'}
                    </span>
                    <button
                      onClick={() => onEditConfig(config)}
                      className="w-7 h-7 rounded-lg hover:bg-primary/10 flex items-center justify-center transition-colors"
                      title="编辑配置"
                    >
                      <Edit2 size={14} className="text-primary" />
                    </button>
                    <button
                      onClick={() => handleRemoveConfig(config)}
                      className="w-7 h-7 rounded-lg hover:bg-destructive/10 flex items-center justify-center transition-colors"
                      title="删除配置"
                    >
                      <Trash2 size={14} className="text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Database size={32} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm mb-1">还没有配置任何模型</p>
              <p className="text-xs">点击上方"添加模型"按钮开始配置</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MessageSettings() {
  const { settings, updateSettings, resetSettings } = useMessageSettings()

  return (
    <div className="space-y-6">
      <SettingsGroup title="消息背景">
        <SettingsItem
          icon={MessageSquare}
          label="消息背景样式"
          description="设置消息气泡的背景样式"
          action={
            <select 
              className="text-sm border border-border rounded-md px-2 py-1 bg-white"
              value={settings.messageBackground}
              onChange={(e) => updateSettings({ messageBackground: e.target.value as any })}
            >
              <option value="default">默认</option>
              <option value="transparent">透明</option>
              <option value="subtle">淡色</option>
            </select>
          }
        />
        <SettingsItem
          icon={Palette}
          label="气泡样式"
          description="消息气泡的视觉风格"
          action={
            <select 
              className="text-sm border border-border rounded-md px-2 py-1 bg-white"
              value={settings.bubbleStyle}
              onChange={(e) => updateSettings({ bubbleStyle: e.target.value as any })}
            >
              <option value="modern">现代</option>
              <option value="classic">经典</option>
              <option value="minimal">简约</option>
            </select>
          }
        />
      </SettingsGroup>

      <SettingsGroup title="折叠框默认状态">
        <SettingsItem
          icon={Brain}
          label="Thinking 默认展开"
          description="思考过程折叠框是否默认展开"
          action={
            <ToggleSwitch 
              checked={settings.thinkingDefaultExpanded}
              onChange={(checked) => updateSettings({ thinkingDefaultExpanded: checked })}
            />
          }
        />
        <SettingsItem
          icon={Wrench}
          label="工具调用默认展开"
          description="工具调用折叠框是否默认展开"
          action={
            <ToggleSwitch 
              checked={settings.toolCallsDefaultExpanded}
              onChange={(checked) => updateSettings({ toolCallsDefaultExpanded: checked })}
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup title="显示选项">
        <SettingsItem
          icon={Eye}
          label="流式光标"
          description="流式输出时显示闪烁光标"
          action={
            <ToggleSwitch 
              checked={settings.showStreamingCursor}
              onChange={(checked) => updateSettings({ showStreamingCursor: checked })}
            />
          }
        />
        <SettingsItem
          label="时间戳"
          description="显示消息发送时间"
          action={
            <ToggleSwitch 
              checked={settings.showTimestamp}
              onChange={(checked) => updateSettings({ showTimestamp: checked })}
            />
          }
        />
      </SettingsGroup>

      <div className="flex justify-end">
        <button
          onClick={resetSettings}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-muted transition-colors"
        >
          <RotateCcw size={14} />
          重置为默认设置
        </button>
      </div>
    </div>
  )
}

function AppearanceSettings() {
  return (
    <div className="space-y-6">
      <SettingsGroup title="主题">
        <SettingsItem
          icon={Sun}
          label="浅色模式"
          description="使用浅色主题"
          action={<RadioCircle name="theme" defaultChecked />}
        />
        <SettingsItem
          icon={Moon}
          label="深色模式"
          description="使用深色主题"
          action={<RadioCircle name="theme" />}
        />
      </SettingsGroup>

      <SettingsGroup title="布局">
        <SettingsItem
          label="侧边栏宽度"
          description="调整左侧会话列表宽度"
          action={
            <select className="text-sm border border-border rounded-md px-2 py-1 bg-white">
              <option>窄</option>
              <option defaultChecked>标准</option>
              <option>宽</option>
            </select>
          }
        />
        <SettingsItem
          label="字体大小"
          description="调整界面文字大小"
          action={
            <select className="text-sm border border-border rounded-md px-2 py-1 bg-white">
              <option>小</option>
              <option defaultChecked>中</option>
              <option>大</option>
            </select>
          }
        />
      </SettingsGroup>
    </div>
  )
}

function AboutSettings() {
  return (
    <div className="space-y-6">
      <div className="text-center py-8">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4 border border-border">
          <span className="text-3xl">🤖</span>
        </div>
        <h3 className="text-lg font-semibold mb-1">Pair</h3>
        <p className="text-sm text-muted-foreground mb-4">AI 智能助手客户端</p>
        <div className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
          <span>版本 0.1.0</span>
          <span>•</span>
          <span>最新版本</span>
        </div>
      </div>

      <SettingsGroup title="检查更新">
        <SettingsItem
          label="自动更新"
          description="有新版本时自动更新"
          action={<ToggleSwitch defaultChecked />}
        />
        <SettingsItem
          label="检查更新"
          description="手动检查是否有新版本"
          action={
            <button className="text-xs text-primary border border-border px-3 py-1.5 rounded-md hover:bg-muted transition-colors">
              检查
            </button>
          }
        />
      </SettingsGroup>

      <SettingsGroup title="相关链接">
        <LinkItem label="官方网站" href="#" />
        <LinkItem label="使用文档" href="#" />
        <LinkItem label="反馈问题" href="#" />
        <LinkItem label="隐私政策" href="#" />
      </SettingsGroup>
    </div>
  )
}

// 通用组件
function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        {title}
      </h3>
      <div className="bg-muted/30 rounded-xl border border-border divide-y divide-border">
        {children}
      </div>
    </div>
  )
}

function SettingsItem({
  icon: Icon,
  label,
  description,
  action,
}: {
  icon?: React.ComponentType<{ size?: number; className?: string }>
  label: string
  description: string
  action: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        {Icon && <Icon size={16} className="text-muted-foreground" />}
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      {action}
    </div>
  )
}

function LinkItem({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
    >
      <span className="text-sm">{label}</span>
      <ChevronRight size={14} className="text-muted-foreground" />
    </a>
  )
}

function ToggleSwitch({ defaultChecked, checked, onChange }: { defaultChecked?: boolean; checked?: boolean; onChange?: (checked: boolean) => void }) {
  const isControlled = checked !== undefined
  const [internalChecked, setInternalChecked] = useState(defaultChecked ?? false)
  const isChecked = isControlled ? checked : internalChecked
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isControlled) {
      setInternalChecked(e.target.checked)
    }
    onChange?.(e.target.checked)
  }
  
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input 
        type="checkbox" 
        checked={isChecked}
        onChange={handleChange}
        className="sr-only peer" 
      />
      <div className={cn(
        "w-9 h-5 rounded-full border transition-colors relative",
        isChecked 
          ? "bg-blue-500 border-blue-500" 
          : "bg-gray-400 border-gray-400"
      )}>
        <div className={cn(
          "absolute top-[2px] start-[2px] w-4 h-4 bg-white rounded-full transition-transform shadow-sm",
          isChecked ? "translate-x-[16px]" : "translate-x-0"
        )}></div>
      </div>
    </label>
  )
}

function RadioCircle({ name, defaultChecked = false }: { name: string; defaultChecked?: boolean }) {
  const [isChecked, setIsChecked] = useState(defaultChecked)
  
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input 
        type="radio" 
        name={name} 
        checked={isChecked}
        onChange={() => setIsChecked(true)}
        className="sr-only peer" 
      />
      <div className="w-5 h-5 border-2 border-border rounded-full peer-checked:border-primary relative">
        {isChecked && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-primary rounded-full"></div>
        )}
      </div>
    </label>
  )
}
