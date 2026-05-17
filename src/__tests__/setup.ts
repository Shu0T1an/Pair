// Jest DOM matchers (toBeInTheDocument, etc.)
import '@testing-library/jest-dom'

// ── Mock localStorage ──
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (index: number) => Object.keys(store)[index] ?? null,
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// ── Mock electronAPI ──
Object.defineProperty(window, 'electronAPI', {
  value: {
    on: () => () => {},
    platform: 'win32',
    versions: { node: '', chrome: '', electron: '' },
    minimize: async () => {},
    maximize: async () => {},
    close: async () => {},
    session: {
      create: async () => ({}),
      list: async () => [],
      delete: async () => {},
      deleteAll: async () => {},
      deleteAllInProject: async () => {},
      info: async () => undefined,
      update: async () => {},
      messages: async () => [],
    },
    message: {
      send: async () => {},
      abort: async () => {},
    },
    model: {
      list: async () => [],
      current: async () => undefined,
      set: async () => {},
      testConnection: async () => ({ success: true }),
      setApiKey: async () => {},
      removeApiKey: async () => {},
      syncConfig: async () => {},
      removeConfig: async () => {},
    },
    notification: {
      getConfig: async () => ({ enabled: true, title: '', body: '', triggerEvent: 'agent_end' as const }),
      updateConfig: async () => {},
    },
    storage: {
      getConfig: async () => ({ dataRoot: '', defaultDataRoot: '' }),
      setDataRoot: async () => ({ success: true }),
      selectFolder: async () => null,
    },
    stats: {
      getOverview: async () => ({}),
    },
    skills: {
      list: async () => [],
    },
    context: {
      usage: async () => ({ usedTokens: 0, totalTokens: 128000, percentage: 0 }),
    },
    file: {
      search: async () => [],
      readContent: async () => null,
    },
  },
})

// ── Mock IntersectionObserver ──
class MockIntersectionObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
})

// ── Mock ResizeObserver ──
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: MockResizeObserver,
})

// ── Mock matchMedia ──
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})
