import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, renderHook, act } from '@testing-library/react'
import { ThemeProvider, useTheme, themes, type ThemeName, DEFAULT_FONT_SIZE, MIN_FONT_SIZE, MAX_FONT_SIZE } from '../ThemeContext'

function renderWithProvider(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>)
}

function renderUseTheme() {
  return renderHook(() => useTheme(), { wrapper: ThemeProvider })
}

function spySetProperty() {
  return vi.spyOn(document.documentElement.style, 'setProperty')
}

// ── Tests ──

describe('ThemeContext', () => {
  // ── Storage helpers ──
  const STORAGE_KEYS = {
    theme: 'theme-name',
    mode: 'theme-mode',
    fontSize: 'font-size',
  }

  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    // Reset any inline styles set by previous tests
    document.documentElement.style.cssText = ''
  })

  // ── 1. Default values ──
  describe('default values', () => {
    it('should default to "default" theme when nothing is saved', () => {
      const { result } = renderUseTheme()
      expect(result.current.currentTheme).toBe('default')
    })

    it('should default to light mode when nothing is saved', () => {
      const { result } = renderUseTheme()
      expect(result.current.isDark).toBe(false)
    })

    it('should default to DEFAULT_FONT_SIZE when nothing is saved', () => {
      const { result } = renderUseTheme()
      expect(result.current.fontSize).toBe(DEFAULT_FONT_SIZE)
    })
  })

  // ── 2. Restore from localStorage ──
  describe('localStorage restoration on mount', () => {
    it('should restore saved theme from localStorage', () => {
      localStorage.setItem(STORAGE_KEYS.theme, 'blue')
      const { result } = renderUseTheme()
      expect(result.current.currentTheme).toBe('blue')
    })

    it('should restore saved dark mode from localStorage', () => {
      localStorage.setItem(STORAGE_KEYS.mode, 'dark')
      const { result } = renderUseTheme()
      expect(result.current.isDark).toBe(true)
    })

    it('should restore saved font size from localStorage', () => {
      localStorage.setItem(STORAGE_KEYS.fontSize, '16')
      const { result } = renderUseTheme()
      expect(result.current.fontSize).toBe(16)
    })

    it('should apply CSS variables for restored theme on mount', () => {
      localStorage.setItem(STORAGE_KEYS.theme, 'green')
      const spy = spySetProperty()
      renderUseTheme()
      expect(spy).toHaveBeenCalled()
      expect(spy).toHaveBeenCalledWith('--background', expect.any(String))
    })

    it('should add .dark class on mount when mode is dark', () => {
      localStorage.setItem(STORAGE_KEYS.mode, 'dark')
      renderUseTheme()
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('should allow non-standard theme name from localStorage', () => {
      localStorage.setItem(STORAGE_KEYS.theme, 'nonexistent')
      const { result } = renderUseTheme()
      expect(result.current.currentTheme).toBe('nonexistent')
    })
  })

  // ── 3. setTheme ──
  describe('setTheme', () => {
    it('should update currentTheme', () => {
      const { result } = renderUseTheme()
      act(() => { result.current.setTheme('blue') })
      expect(result.current.currentTheme).toBe('blue')
    })

    it('should apply CSS variables from the selected theme (light)', () => {
      const { result } = renderUseTheme()
      const spy = spySetProperty()
      act(() => { result.current.setTheme('purple') })
      expect(spy).toHaveBeenCalledWith('--primary', expect.stringContaining('270'))
    })

    it('should NOT toggle .dark class when only theme changes', () => {
      const { result } = renderUseTheme()
      act(() => { result.current.setTheme('warm') })
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('should persist to localStorage', () => {
      const { result } = renderUseTheme()
      act(() => { result.current.setTheme('green') })
      expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe('green')
    })
  })

  // ── 4. toggleDark ──
  describe('toggleDark', () => {
    it('should flip isDark from false to true', () => {
      const { result } = renderUseTheme()
      expect(result.current.isDark).toBe(false)
      act(() => { result.current.toggleDark() })
      expect(result.current.isDark).toBe(true)
    })

    it('should flip isDark from true to false', () => {
      localStorage.setItem(STORAGE_KEYS.mode, 'dark')
      const { result } = renderUseTheme()
      expect(result.current.isDark).toBe(true)
      act(() => { result.current.toggleDark() })
      expect(result.current.isDark).toBe(false)
    })

    it('should add .dark class when toggling to dark', () => {
      const { result } = renderUseTheme()
      act(() => { result.current.toggleDark() })
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('should remove .dark class when toggling to light', () => {
      localStorage.setItem(STORAGE_KEYS.mode, 'dark')
      const { result } = renderUseTheme()
      act(() => { result.current.toggleDark() })
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('should apply dark CSS variables when toggling to dark', () => {
      const { result } = renderUseTheme()
      const spy = spySetProperty()
      act(() => { result.current.toggleDark() })
      expect(spy).toHaveBeenCalledWith('--background', expect.stringContaining('3.9%'))
    })

    it('should persist mode to localStorage', () => {
      const { result } = renderUseTheme()
      act(() => { result.current.toggleDark() })
      expect(localStorage.getItem(STORAGE_KEYS.mode)).toBe('dark')
    })
  })

  // ── 5. setFontSize ──
  describe('setFontSize', () => {
    it('should update fontSize', () => {
      const { result } = renderUseTheme()
      act(() => { result.current.setFontSize(18) })
      expect(result.current.fontSize).toBe(18)
    })

    it('should apply --chat-font-size CSS variable', () => {
      const { result } = renderUseTheme()
      const spy = spySetProperty()
      act(() => { result.current.setFontSize(12) })
      expect(spy).toHaveBeenCalledWith('--chat-font-size', '12px')
    })

    it('should persist to localStorage', () => {
      const { result } = renderUseTheme()
      act(() => { result.current.setFontSize(16) })
      expect(localStorage.getItem(STORAGE_KEYS.fontSize)).toBe('16')
    })

    it('should accept valid values across the range', () => {
      const { result } = renderUseTheme()
      act(() => { result.current.setFontSize(MIN_FONT_SIZE) })
      expect(result.current.fontSize).toBe(MIN_FONT_SIZE)
      act(() => { result.current.setFontSize(MAX_FONT_SIZE) })
      expect(result.current.fontSize).toBe(MAX_FONT_SIZE)
    })
  })

  // ── 6. CSS variable application (full theme) ──
  describe('CSS variable application', () => {
    it('should apply all light CSS vars for the default theme', () => {
      const spy = spySetProperty()
      renderUseTheme()
      const defaultTheme = themes.find(t => t.name === 'default')!
      const lightKeys = Object.keys(defaultTheme.light)
      lightKeys.forEach(key => {
        expect(spy).toHaveBeenCalledWith(key, defaultTheme.light[key])
      })
    })

    it('should apply all dark CSS vars when isDark is true', () => {
      localStorage.setItem(STORAGE_KEYS.mode, 'dark')
      const spy = spySetProperty()
      renderUseTheme()
      const defaultTheme = themes.find(t => t.name === 'default')!
      const darkKeys = Object.keys(defaultTheme.dark)
      darkKeys.forEach(key => {
        expect(spy).toHaveBeenCalledWith(key, defaultTheme.dark[key])
      })
    })

    it('should apply all themes correctly', () => {
      const { result } = renderUseTheme()
      for (const theme of themes) {
        const spy = spySetProperty()
        act(() => { result.current.setTheme(theme.name) })
        expect(spy).toHaveBeenCalledWith('--primary', theme.light['--primary'])
        spy.mockClear()
      }
    })
  })

  // ── 7. .dark class management ──
  describe('.dark class management', () => {
    it('should NOT have .dark class in light mode by default', () => {
      renderUseTheme()
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('should have .dark class when localStorage has dark mode', () => {
      localStorage.setItem(STORAGE_KEYS.mode, 'dark')
      renderUseTheme()
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('should toggle .dark class correctly with multiple toggles', () => {
      const { result } = renderUseTheme()
      act(() => { result.current.toggleDark() })
      expect(document.documentElement.classList.contains('dark')).toBe(true)
      act(() => { result.current.toggleDark() })
      expect(document.documentElement.classList.contains('dark')).toBe(false)
      act(() => { result.current.toggleDark() })
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })
  })

  // ── 8. localStorage persistence ──
  describe('localStorage persistence', () => {
    it('should persist theme on mount', () => {
      renderUseTheme()
      expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe('default')
    })

    it('should persist mode on mount (light)', () => {
      renderUseTheme()
      expect(localStorage.getItem(STORAGE_KEYS.mode)).toBe('light')
    })

    it('should persist mode on mount (dark)', () => {
      localStorage.setItem(STORAGE_KEYS.mode, 'dark')
      renderUseTheme()
      expect(localStorage.getItem(STORAGE_KEYS.mode)).toBe('dark')
    })

    it('should persist font size on mount', () => {
      renderUseTheme()
      expect(localStorage.getItem(STORAGE_KEYS.fontSize)).toBe(String(DEFAULT_FONT_SIZE))
    })

    it('should update localStorage when setTheme is called multiple times', () => {
      const { result } = renderUseTheme()
      const themeNames = themes.map(t => t.name)
      for (const name of themeNames) {
        act(() => { result.current.setTheme(name) })
        expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe(name)
      }
    })
  })

  // ── 9. useTheme error case ──
  describe('useTheme outside Provider', () => {
    it('should throw when used without ThemeProvider', () => {
      expect(() => renderHook(() => useTheme())).toThrow('useTheme must be used within a ThemeProvider')
    })
  })

  // ── 10. Children rendering ──
  describe('children rendering', () => {
    it('should render children inside ThemeProvider', () => {
      renderWithProvider(<div data-testid="child">Hello</div>)
      expect(screen.getByTestId('child')).toHaveTextContent('Hello')
    })

    it('should provide theme context to deeply nested children', () => {
      function DeepChild() {
        const { currentTheme } = useTheme()
        return <span data-testid="deep-theme">{currentTheme}</span>
      }
      renderWithProvider(<DeepChild />)
      expect(screen.getByTestId('deep-theme')).toHaveTextContent('default')
    })
  })

  // ── 11. Theme switching with dark mode combined ──
  describe('theme + dark mode interaction', () => {
    it('should switch theme while staying in dark mode', () => {
      const { result } = renderUseTheme()
      act(() => { result.current.toggleDark() })
      act(() => { result.current.setTheme('blue') })
      expect(result.current.isDark).toBe(true)
      expect(result.current.currentTheme).toBe('blue')
      const blueTheme = themes.find(t => t.name === 'blue')!
      expect(document.documentElement.style.getPropertyValue('--primary')).toBe(blueTheme.dark['--primary'])
    })

    it('should toggle dark mode while keeping the selected theme', () => {
      const { result } = renderUseTheme()
      act(() => { result.current.setTheme('green') })
      act(() => { result.current.toggleDark() })
      expect(result.current.currentTheme).toBe('green')
      expect(result.current.isDark).toBe(true)
    })
  })

  // ── 12. Multiple ThemeProviders isolation ──
  describe('multiple ThemeProviders isolation', () => {
    it('should allow independent ThemeProvider instances', () => {
      function ThemeDisplay({ id }: { id: string }) {
        const { currentTheme, isDark, fontSize } = useTheme()
        return <div data-testid={`display-${id}`}>{currentTheme}-{isDark ? 'dark' : 'light'}-{fontSize}</div>
      }

      render(
        <div>
          <ThemeProvider><ThemeDisplay id="a" /></ThemeProvider>
          <ThemeProvider><ThemeDisplay id="b" /></ThemeProvider>
        </div>
      )

      expect(screen.getByTestId('display-a')).toHaveTextContent('default-light-14')
      expect(screen.getByTestId('display-b')).toHaveTextContent('default-light-14')
    })
  })
})

// ── migrateFontSize tests (exported helper) ──
describe('migrateFontSize', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should map "small" to 13', () => {
    localStorage.setItem('font-size', 'small')
    const { result } = renderUseTheme()
    expect(result.current.fontSize).toBe(13)
  })

  it('should map "medium" to 14', () => {
    localStorage.setItem('font-size', 'medium')
    const { result } = renderUseTheme()
    expect(result.current.fontSize).toBe(14)
  })

  it('should map "large" to 16', () => {
    localStorage.setItem('font-size', 'large')
    const { result } = renderUseTheme()
    expect(result.current.fontSize).toBe(16)
  })

  it('should return default for null/undefined', () => {
    const { result } = renderUseTheme()
    expect(result.current.fontSize).toBe(DEFAULT_FONT_SIZE)
  })

  it('should return default for empty string', () => {
    localStorage.setItem('font-size', '')
    const { result } = renderUseTheme()
    expect(result.current.fontSize).toBe(DEFAULT_FONT_SIZE)
  })

  it('should return default for NaN string', () => {
    localStorage.setItem('font-size', 'abc')
    const { result } = renderUseTheme()
    expect(result.current.fontSize).toBe(DEFAULT_FONT_SIZE)
  })

  it('should clamp below MIN_FONT_SIZE', () => {
    localStorage.setItem('font-size', '5')
    const { result } = renderUseTheme()
    expect(result.current.fontSize).toBe(MIN_FONT_SIZE)
  })

  it('should clamp above MAX_FONT_SIZE', () => {
    localStorage.setItem('font-size', '99')
    const { result } = renderUseTheme()
    expect(result.current.fontSize).toBe(MAX_FONT_SIZE)
  })

  it('should accept boundary values', () => {
    localStorage.setItem('font-size', String(MIN_FONT_SIZE))
    const { result: minResult } = renderUseTheme()
    expect(minResult.current.fontSize).toBe(MIN_FONT_SIZE)

    localStorage.setItem('font-size', String(MAX_FONT_SIZE))
    const { result: maxResult } = renderUseTheme()
    expect(maxResult.current.fontSize).toBe(MAX_FONT_SIZE)
  })
})
