import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

// 主题类型定义
export type ThemeName = 'default' | 'blue' | 'green' | 'purple' | 'warm' | 'dark'

export interface ThemeColors {
  name: ThemeName
  label: string
  preview: string  // 预览色块
  light: Record<string, string>
  dark: Record<string, string>
}

// 预设主题
export const themes: ThemeColors[] = [
  {
    name: 'white',
    label: '纯白',
    preview: '#ffffff',
    light: {
      '--background': '0 0% 100%',
      '--foreground': '0 0% 15%',
      '--muted': '0 0% 96%',
      '--muted-foreground': '0 0% 50%',
      '--border': '0 0% 92%',
      '--input': '0 0% 97%',
      '--ring': '0 0% 10%',
      '--primary': '0 0% 10%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '0 0% 98%',
      '--secondary-foreground': '0 0% 10%',
      '--accent': '0 0% 10%',
      '--accent-foreground': '0 0% 100%',
      '--card': '0 0% 100%',
      '--card-foreground': '0 0% 15%',
      '--sidebar': '0 0% 98%',
      '--sidebar-foreground': '0 0% 15%',
    },
    dark: {
      '--background': '0 0% 7%',
      '--foreground': '0 0% 95%',
      '--muted': '0 0% 15%',
      '--muted-foreground': '0 0% 60%',
      '--border': '0 0% 18%',
      '--input': '0 0% 15%',
      '--ring': '0 0% 80%',
      '--primary': '0 0% 95%',
      '--primary-foreground': '0 0% 10%',
      '--secondary': '0 0% 15%',
      '--secondary-foreground': '0 0% 95%',
      '--accent': '0 0% 25%',
      '--accent-foreground': '0 0% 95%',
      '--card': '0 0% 10%',
      '--card-foreground': '0 0% 95%',
      '--sidebar': '0 0% 8%',
      '--sidebar-foreground': '0 0% 95%',
    },
  },
  {
    name: 'default',
    label: '经典灰',
    preview: '#f5f5f5',
    light: {
      '--background': '0 0% 96%',
      '--foreground': '0 0% 20%',
      '--muted': '0 0% 93%',
      '--muted-foreground': '0 0% 60%',
      '--border': '0 0% 90%',
      '--input': '0 0% 94%',
      '--ring': '0 0% 10%',
      '--primary': '0 0% 10%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '0 0% 100%',
      '--secondary-foreground': '0 0% 10%',
      '--accent': '0 0% 10%',
      '--accent-foreground': '0 0% 100%',
      '--card': '0 0% 100%',
      '--card-foreground': '0 0% 20%',
      '--sidebar': '0 0% 93%',
      '--sidebar-foreground': '0 0% 20%',
    },
    dark: {
      '--background': '240 10% 3.9%',
      '--foreground': '0 0% 98%',
      '--muted': '240 3.7% 15.9%',
      '--muted-foreground': '240 5% 64.9%',
      '--border': '240 3.7% 15.9%',
      '--input': '240 3.7% 15.9%',
      '--ring': '240 4.9% 83.9%',
      '--primary': '0 0% 98%',
      '--primary-foreground': '240 5.9% 10%',
      '--secondary': '240 3.7% 15.9%',
      '--secondary-foreground': '0 0% 98%',
      '--accent': '240 3.7% 25%',
      '--accent-foreground': '0 0% 98%',
      '--card': '240 10% 3.9%',
      '--card-foreground': '0 0% 98%',
      '--sidebar': '240 5% 8%',
      '--sidebar-foreground': '0 0% 98%',
    },
  },
  {
    name: 'blue',
    label: '清新蓝',
    preview: '#3b82f6',
    light: {
      '--background': '210 20% 95%',
      '--foreground': '210 30% 20%',
      '--muted': '210 15% 90%',
      '--muted-foreground': '210 10% 50%',
      '--border': '210 15% 85%',
      '--input': '210 15% 92%',
      '--ring': '210 60% 50%',
      '--primary': '210 60% 50%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '210 15% 95%',
      '--secondary-foreground': '210 30% 30%',
      '--accent': '210 50% 45%',
      '--accent-foreground': '0 0% 100%',
      '--card': '0 0% 100%',
      '--card-foreground': '210 30% 20%',
      '--sidebar': '210 20% 92%',
      '--sidebar-foreground': '210 30% 20%',
    },
    dark: {
      '--background': '220 20% 7%',
      '--foreground': '210 20% 95%',
      '--muted': '220 15% 15%',
      '--muted-foreground': '210 10% 60%',
      '--border': '220 15% 18%',
      '--input': '220 15% 15%',
      '--ring': '210 60% 50%',
      '--primary': '210 60% 50%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '220 15% 15%',
      '--secondary-foreground': '210 20% 95%',
      '--accent': '210 50% 45%',
      '--accent-foreground': '0 0% 100%',
      '--card': '220 18% 10%',
      '--card-foreground': '210 20% 95%',
      '--sidebar': '220 20% 8%',
      '--sidebar-foreground': '210 20% 95%',
    },
  },
  {
    name: 'green',
    label: '自然绿',
    preview: '#22c55e',
    light: {
      '--background': '150 15% 95%',
      '--foreground': '150 20% 20%',
      '--muted': '150 12% 90%',
      '--muted-foreground': '150 8% 50%',
      '--border': '150 12% 85%',
      '--input': '150 12% 92%',
      '--ring': '150 50% 40%',
      '--primary': '150 50% 40%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '150 12% 95%',
      '--secondary-foreground': '150 20% 30%',
      '--accent': '150 40% 35%',
      '--accent-foreground': '0 0% 100%',
      '--card': '0 0% 100%',
      '--card-foreground': '150 20% 20%',
      '--sidebar': '150 15% 92%',
      '--sidebar-foreground': '150 20% 20%',
    },
    dark: {
      '--background': '150 15% 7%',
      '--foreground': '150 15% 95%',
      '--muted': '150 10% 15%',
      '--muted-foreground': '150 8% 60%',
      '--border': '150 10% 18%',
      '--input': '150 10% 15%',
      '--ring': '150 50% 40%',
      '--primary': '150 50% 40%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '150 10% 15%',
      '--secondary-foreground': '150 15% 95%',
      '--accent': '150 40% 35%',
      '--accent-foreground': '0 0% 100%',
      '--card': '150 12% 10%',
      '--card-foreground': '150 15% 95%',
      '--sidebar': '150 15% 8%',
      '--sidebar-foreground': '150 15% 95%',
    },
  },
  {
    name: 'purple',
    label: '优雅紫',
    preview: '#a855f7',
    light: {
      '--background': '270 15% 95%',
      '--foreground': '270 20% 20%',
      '--muted': '270 12% 90%',
      '--muted-foreground': '270 8% 50%',
      '--border': '270 12% 85%',
      '--input': '270 12% 92%',
      '--ring': '270 50% 50%',
      '--primary': '270 50% 50%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '270 12% 95%',
      '--secondary-foreground': '270 20% 30%',
      '--accent': '270 40% 45%',
      '--accent-foreground': '0 0% 100%',
      '--card': '0 0% 100%',
      '--card-foreground': '270 20% 20%',
      '--sidebar': '270 15% 92%',
      '--sidebar-foreground': '270 20% 20%',
    },
    dark: {
      '--background': '270 15% 7%',
      '--foreground': '270 15% 95%',
      '--muted': '270 10% 15%',
      '--muted-foreground': '270 8% 60%',
      '--border': '270 10% 18%',
      '--input': '270 10% 15%',
      '--ring': '270 50% 50%',
      '--primary': '270 50% 50%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '270 10% 15%',
      '--secondary-foreground': '270 15% 95%',
      '--accent': '270 40% 45%',
      '--accent-foreground': '0 0% 100%',
      '--card': '270 12% 10%',
      '--card-foreground': '270 15% 95%',
      '--sidebar': '270 15% 8%',
      '--sidebar-foreground': '270 15% 95%',
    },
  },
  {
    name: 'warm',
    label: '暖阳橙',
    preview: '#f59e0b',
    light: {
      '--background': '30 20% 95%',
      '--foreground': '30 20% 20%',
      '--muted': '30 15% 90%',
      '--muted-foreground': '30 10% 50%',
      '--border': '30 15% 85%',
      '--input': '30 15% 92%',
      '--ring': '30 60% 50%',
      '--primary': '30 60% 50%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '30 15% 95%',
      '--secondary-foreground': '30 20% 30%',
      '--accent': '30 50% 45%',
      '--accent-foreground': '0 0% 100%',
      '--card': '0 0% 100%',
      '--card-foreground': '30 20% 20%',
      '--sidebar': '30 20% 92%',
      '--sidebar-foreground': '30 20% 20%',
    },
    dark: {
      '--background': '30 15% 7%',
      '--foreground': '30 15% 95%',
      '--muted': '30 10% 15%',
      '--muted-foreground': '30 8% 60%',
      '--border': '30 10% 18%',
      '--input': '30 10% 15%',
      '--ring': '30 60% 50%',
      '--primary': '30 60% 50%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '30 10% 15%',
      '--secondary-foreground': '30 15% 95%',
      '--accent': '30 50% 45%',
      '--accent-foreground': '0 0% 100%',
      '--card': '30 12% 10%',
      '--card-foreground': '30 15% 95%',
      '--sidebar': '30 15% 8%',
      '--sidebar-foreground': '30 15% 95%',
    },
  },
]

// 字体大小类型
export type FontSize = 'small' | 'medium' | 'large'

export const fontSizeMap: Record<FontSize, { label: string; value: string; preview: string }> = {
  small: { label: '小', value: '13px', preview: 'A' },
  medium: { label: '中', value: '14px', preview: 'A' },
  large: { label: '大', value: '16px', preview: 'A' },
}

interface ThemeContextType {
  currentTheme: ThemeName
  isDark: boolean
  fontSize: FontSize
  setTheme: (theme: ThemeName) => void
  toggleDark: () => void
  setFontSize: (size: FontSize) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<ThemeName>(() => {
    const saved = localStorage.getItem('theme-name')
    return (saved as ThemeName) || 'default'
  })
  
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme-mode')
    return saved === 'dark'
  })

  const [fontSize, setFontSize] = useState<FontSize>(() => {
    const saved = localStorage.getItem('font-size')
    return (saved as FontSize) || 'medium'
  })

  // 应用主题到 CSS 变量
  useEffect(() => {
    const theme = themes.find(t => t.name === currentTheme)
    if (!theme) return

    const root = document.documentElement
    const colors = isDark ? theme.dark : theme.light

    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(key, value)
    })

    // 切换 dark 类
    if (isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }

    // 保存到 localStorage
    localStorage.setItem('theme-name', currentTheme)
    localStorage.setItem('theme-mode', isDark ? 'dark' : 'light')
  }, [currentTheme, isDark])

  // 应用字体大小
  useEffect(() => {
    const root = document.documentElement
    const size = fontSizeMap[fontSize].value
    root.style.setProperty('--font-size', size)
    root.style.fontSize = size
    localStorage.setItem('font-size', fontSize)
  }, [fontSize])

  const setTheme = (theme: ThemeName) => {
    setCurrentTheme(theme)
  }

  const toggleDark = () => {
    setIsDark(prev => !prev)
  }

  return (
    <ThemeContext.Provider value={{ currentTheme, isDark, fontSize, setTheme, toggleDark, setFontSize }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
