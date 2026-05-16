import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

// 消息设置接口
export interface MessageSettings {
  // 消息背景
  messageBackground: 'default' | 'transparent' | 'subtle'
  
  // 折叠框默认状态
  thinkingDefaultExpanded: boolean
  toolCallsDefaultExpanded: boolean
  
  // 消息气泡样式
  bubbleStyle: 'modern' | 'classic' | 'minimal'
  
  // 流式光标
  showStreamingCursor: boolean
  
  // 时间戳
  showTimestamp: boolean

  // 消息内容宽度 (px)
  messageWidth: number
}

// 默认设置
const defaultSettings: MessageSettings = {
  messageBackground: 'default',
  thinkingDefaultExpanded: false,
  toolCallsDefaultExpanded: true,
  bubbleStyle: 'modern',
  showStreamingCursor: true,
  showTimestamp: true,
  messageWidth: 768,
}

// 本地存储键
const STORAGE_KEY = 'pair-message-settings'

// 加载设置
function loadSettings(): MessageSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) }
    }
  } catch {
    // ignore
  }
  return defaultSettings
}

// 保存设置
function saveSettings(settings: MessageSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // ignore
  }
}

// Context 类型
interface MessageSettingsContextType {
  settings: MessageSettings
  updateSettings: (updates: Partial<MessageSettings>) => void
  resetSettings: () => void
}

// 创建 Context
const MessageSettingsContext = createContext<MessageSettingsContextType | null>(null)

// Provider 组件
export function MessageSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<MessageSettings>(loadSettings)

  // 设置变化时保存
  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  // 更新设置
  const updateSettings = (updates: Partial<MessageSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }))
  }

  // 重置设置
  const resetSettings = () => {
    setSettings(defaultSettings)
  }

  return (
    <MessageSettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </MessageSettingsContext.Provider>
  )
}

// Hook
export function useMessageSettings() {
  const context = useContext(MessageSettingsContext)
  if (!context) {
    throw new Error('useMessageSettings must be used within MessageSettingsProvider')
  }
  return context
}
