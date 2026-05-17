import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, renderHook, act } from '@testing-library/react'
import {
  MessageSettingsProvider,
  useMessageSettings,
  type MessageSettings,
} from '../MessageSettingsContext'

const STORAGE_KEY = 'pair-message-settings'

const DEFAULT_SETTINGS: MessageSettings = {
  messageBackground: 'default',
  thinkingDefaultExpanded: false,
  toolCallsDefaultExpanded: true,
  bubbleStyle: 'modern',
  showStreamingCursor: true,
  showTimestamp: true,
  messageWidth: 768,
}

function renderUseMessageSettings() {
  return renderHook(() => useMessageSettings(), { wrapper: MessageSettingsProvider })
}

describe('MessageSettingsContext', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // ── 1. Default settings ──
  describe('default settings', () => {
    it('should start with default settings when nothing is saved', () => {
      const { result } = renderUseMessageSettings()
      expect(result.current.settings).toEqual(DEFAULT_SETTINGS)
    })

    it('should provide default showTimestamp as true', () => {
      const { result } = renderUseMessageSettings()
      expect(result.current.settings.showTimestamp).toBe(true)
    })

    it('should provide default showStreamingCursor as true', () => {
      const { result } = renderUseMessageSettings()
      expect(result.current.settings.showStreamingCursor).toBe(true)
    })

    it('should provide default messageWidth as 768', () => {
      const { result } = renderUseMessageSettings()
      expect(result.current.settings.messageWidth).toBe(768)
    })
  })

  // ── 2. localStorage restoration ──
  describe('localStorage restoration', () => {
    it('should restore saved settings from localStorage', () => {
      const saved = { ...DEFAULT_SETTINGS, showTimestamp: false, messageWidth: 1024 }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))

      const { result } = renderUseMessageSettings()
      expect(result.current.settings.showTimestamp).toBe(false)
      expect(result.current.settings.messageWidth).toBe(1024)
    })

    it('should merge partial saved settings with defaults', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ showTimestamp: false }))

      const { result } = renderUseMessageSettings()
      expect(result.current.settings.showTimestamp).toBe(false)
      expect(result.current.settings.messageWidth).toBe(768)
      expect(result.current.settings.showStreamingCursor).toBe(true)
    })

    it('should handle corrupt localStorage gracefully', () => {
      localStorage.setItem(STORAGE_KEY, '{corrupt}')

      const { result } = renderUseMessageSettings()
      expect(result.current.settings).toEqual(DEFAULT_SETTINGS)
    })

    it('should handle empty string in localStorage', () => {
      localStorage.setItem(STORAGE_KEY, '')

      const { result } = renderUseMessageSettings()
      expect(result.current.settings).toEqual(DEFAULT_SETTINGS)
    })
  })

  // ── 3. updateSettings ──
  describe('updateSettings', () => {
    it('should update a single setting', () => {
      const { result } = renderUseMessageSettings()
      act(() => { result.current.updateSettings({ showTimestamp: false }) })
      expect(result.current.settings.showTimestamp).toBe(false)
    })

    it('should preserve other settings when updating one', () => {
      const { result } = renderUseMessageSettings()
      act(() => { result.current.updateSettings({ showTimestamp: false }) })
      expect(result.current.settings.showStreamingCursor).toBe(true)
      expect(result.current.settings.messageWidth).toBe(768)
      expect(result.current.settings.bubbleStyle).toBe('modern')
    })

    it('should update multiple settings at once', () => {
      const { result } = renderUseMessageSettings()
      act(() => {
        result.current.updateSettings({
          showTimestamp: false,
          showStreamingCursor: false,
          bubbleStyle: 'minimal',
          messageWidth: 1024,
        })
      })
      expect(result.current.settings.showTimestamp).toBe(false)
      expect(result.current.settings.showStreamingCursor).toBe(false)
      expect(result.current.settings.bubbleStyle).toBe('minimal')
      expect(result.current.settings.messageWidth).toBe(1024)
    })

    it('should allow all messageBackground values', () => {
      const { result } = renderUseMessageSettings()
      const backgrounds: MessageSettings['messageBackground'][] = ['default', 'transparent', 'subtle']
      for (const bg of backgrounds) {
        act(() => { result.current.updateSettings({ messageBackground: bg }) })
        expect(result.current.settings.messageBackground).toBe(bg)
      }
    })

    it('should allow all bubbleStyle values', () => {
      const { result } = renderUseMessageSettings()
      const styles: MessageSettings['bubbleStyle'][] = ['modern', 'classic', 'minimal']
      for (const style of styles) {
        act(() => { result.current.updateSettings({ bubbleStyle: style }) })
        expect(result.current.settings.bubbleStyle).toBe(style)
      }
    })
  })

  // ── 4. resetSettings ──
  describe('resetSettings', () => {
    it('should reset all settings to defaults', () => {
      const { result } = renderUseMessageSettings()
      act(() => {
        result.current.updateSettings({
          showTimestamp: false,
          showStreamingCursor: false,
          bubbleStyle: 'minimal',
          messageWidth: 500,
        })
      })

      act(() => { result.current.resetSettings() })

      expect(result.current.settings).toEqual(DEFAULT_SETTINGS)
    })

    it('should reset after multiple changes', () => {
      const { result } = renderUseMessageSettings()
      act(() => { result.current.updateSettings({ showTimestamp: false }) })
      act(() => { result.current.updateSettings({ bubbleStyle: 'classic' }) })
      act(() => { result.current.updateSettings({ messageWidth: 600 }) })

      act(() => { result.current.resetSettings() })

      expect(result.current.settings).toEqual(DEFAULT_SETTINGS)
    })

    it('should reset thinkingDefaultExpanded to false', () => {
      const { result } = renderUseMessageSettings()
      act(() => { result.current.updateSettings({ thinkingDefaultExpanded: true }) })
      act(() => { result.current.resetSettings() })
      expect(result.current.settings.thinkingDefaultExpanded).toBe(false)
    })

    it('should reset toolCallsDefaultExpanded to true', () => {
      const { result } = renderUseMessageSettings()
      act(() => { result.current.updateSettings({ toolCallsDefaultExpanded: false }) })
      act(() => { result.current.resetSettings() })
      expect(result.current.settings.toolCallsDefaultExpanded).toBe(true)
    })
  })

  // ── 5. localStorage persistence ──
  describe('localStorage persistence', () => {
    it('should persist after updateSettings', () => {
      const { result } = renderUseMessageSettings()
      act(() => { result.current.updateSettings({ showTimestamp: false }) })

      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(saved.showTimestamp).toBe(false)
    })

    it('should persist after resetSettings', () => {
      const { result } = renderUseMessageSettings()
      act(() => { result.current.updateSettings({ showTimestamp: false }) })
      act(() => { result.current.resetSettings() })

      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(saved.showTimestamp).toBe(true)
    })

    it('should persist the full settings object', () => {
      const { result } = renderUseMessageSettings()
      act(() => {
        result.current.updateSettings({
          messageBackground: 'transparent',
          bubbleStyle: 'classic',
          messageWidth: 1024,
        })
      })

      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(saved.messageBackground).toBe('transparent')
      expect(saved.bubbleStyle).toBe('classic')
      expect(saved.messageWidth).toBe(1024)
    })

    it('should restore previously persisted settings on new mount', () => {
      const { result: first } = renderUseMessageSettings()
      act(() => { first.current.updateSettings({ showTimestamp: false, messageWidth: 900 }) })

      const { result: second } = renderUseMessageSettings()
      expect(second.current.settings.showTimestamp).toBe(false)
      expect(second.current.settings.messageWidth).toBe(900)
    })
  })

  // ── 6. useMessageSettings error ──
  describe('useMessageSettings outside Provider', () => {
    it('should throw when used without MessageSettingsProvider', () => {
      expect(() => renderHook(() => useMessageSettings())).toThrow(
        'useMessageSettings must be used within MessageSettingsProvider'
      )
    })
  })

  // ── 7. Children rendering ──
  describe('children rendering', () => {
    it('should render children', () => {
      render(
        <MessageSettingsProvider>
          <div data-testid="child">Hello</div>
        </MessageSettingsProvider>
      )
      expect(screen.getByTestId('child')).toHaveTextContent('Hello')
    })
  })

  // ── 8. Multiple updates chain ──
  describe('update chain', () => {
    it('should handle sequential updates correctly', () => {
      const { result } = renderUseMessageSettings()

      act(() => { result.current.updateSettings({ showTimestamp: false }) })
      act(() => { result.current.updateSettings({ showTimestamp: true }) })
      expect(result.current.settings.showTimestamp).toBe(true)

      act(() => { result.current.updateSettings({ showTimestamp: false }) })
      expect(result.current.settings.showTimestamp).toBe(false)
    })

    it('should handle update then reset then update', () => {
      const { result } = renderUseMessageSettings()

      act(() => { result.current.updateSettings({ messageWidth: 500 }) })
      act(() => { result.current.resetSettings() })
      act(() => { result.current.updateSettings({ messageWidth: 900 }) })

      expect(result.current.settings.messageWidth).toBe(900)
      expect(result.current.settings.showTimestamp).toBe(true)
    })
  })

  // ── 9. thinking/tool calls defaults ──
  describe('thinking and tool call defaults', () => {
    it('should default thinkingDefaultExpanded to false', () => {
      const { result } = renderUseMessageSettings()
      expect(result.current.settings.thinkingDefaultExpanded).toBe(false)
    })

    it('should default toolCallsDefaultExpanded to true', () => {
      const { result } = renderUseMessageSettings()
      expect(result.current.settings.toolCallsDefaultExpanded).toBe(true)
    })

    it('should toggle thinkingDefaultExpanded', () => {
      const { result } = renderUseMessageSettings()
      act(() => { result.current.updateSettings({ thinkingDefaultExpanded: true }) })
      expect(result.current.settings.thinkingDefaultExpanded).toBe(true)
    })

    it('should toggle toolCallsDefaultExpanded', () => {
      const { result } = renderUseMessageSettings()
      act(() => { result.current.updateSettings({ toolCallsDefaultExpanded: false }) })
      expect(result.current.settings.toolCallsDefaultExpanded).toBe(false)
    })
  })
})
