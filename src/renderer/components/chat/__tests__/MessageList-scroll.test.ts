import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * MessageList 滑动逻辑单元测试
 * 
 * 测试场景：
 * 1. 用户在底部，流式输出 → 自动跟随
 * 2. 用户向上滚动，流式输出 → 停止自动滚动
 * 3. 用户向上滚动，工具调用 → 不会强制滚动
 * 4. 用户滚回底部，流式输出 → 重新自动跟随
 * 5. Thinking 内容增加 → 正常滚动（内容有变化）
 * 6. 工具调用开始/结束 → 不会强制滚动（内容没变化）
 */

// 模拟滚动容器
interface MockContainer {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
}

// 滚动逻辑的核心实现（从 MessageList.tsx 提取）
function createScrollLogic() {
  let userScrolledUp = false
  let isScrollingToBottom = false
  const scrollLog: string[] = []

  const scrollToBottomImmediate = (container: MockContainer) => {
    isScrollingToBottom = true
    container.scrollTop = container.scrollHeight
    scrollLog.push('scrollToBottom')
    // 模拟 requestAnimationFrame 重置
    setTimeout(() => {
      isScrollingToBottom = false
    }, 0)
  }

  const handleScroll = (container: MockContainer) => {
    if (isScrollingToBottom) return scrollLog

    const { scrollTop, scrollHeight, clientHeight } = container
    const isBottom = scrollHeight - scrollTop - clientHeight <= 50

    if (!isBottom) {
      userScrolledUp = true
    } else {
      userScrolledUp = false
    }

    return scrollLog
  }

  const shouldAutoScroll = (
    container: MockContainer,
    isStreaming: boolean,
    hasContentChanged: boolean
  ): boolean => {
    if (!hasContentChanged) return false

    const { scrollTop, scrollHeight, clientHeight } = container
    const isBottom = scrollHeight - scrollTop - clientHeight <= 50

    if (isStreaming) {
      // 流式期间：只要用户没主动向上滚动，就一直跟随底部
      // 不检查 isBottom —— 内容增长后 scrollTop 不会自动更新，isBottom 会变成 false
      return !userScrolledUp
    } else {
      // 流式结束后（agent_end）：如果用户之前没主动向上滚动，确认滚到底部
      return !userScrolledUp && !isBottom
    }
  }

  const resetUserScrolledUp = () => {
    userScrolledUp = false
  }

  const getUserScrolledUp = () => userScrolledUp

  return {
    scrollToBottomImmediate,
    handleScroll,
    shouldAutoScroll,
    resetUserScrolledUp,
    getUserScrolledUp,
    scrollLog,
  }
}

describe('MessageList 滑动逻辑', () => {
  let scrollLogic: ReturnType<typeof createScrollLogic>
  let container: MockContainer

  beforeEach(() => {
    scrollLogic = createScrollLogic()
    container = {
      scrollTop: 0,
      scrollHeight: 1000,
      clientHeight: 500,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('场景1: 用户在底部，流式输出 → 自动跟随', () => {
    it('用户在底部，isStreaming=true，内容变化时应该自动滚动', () => {
      // 用户在底部（scrollTop + clientHeight >= scrollHeight - 50）
      container.scrollTop = 500
      container.scrollHeight = 1000
      container.clientHeight = 500

      const result = scrollLogic.shouldAutoScroll(container, true, true)
      expect(result).toBe(true)
    })
  })

  describe('场景2: 用户向上滚动，流式输出 → 停止自动滚动', () => {
    it('用户向上滚动后，isStreaming=true，内容变化时不应该自动滚动', () => {
      // 用户向上滚动
      container.scrollTop = 200
      container.scrollHeight = 1000
      container.clientHeight = 500

      // 触发 handleScroll，标记用户已向上滚动
      scrollLogic.handleScroll(container)

      // 此时 userScrolledUp 应该为 true
      expect(scrollLogic.getUserScrolledUp()).toBe(true)

      // 即使内容变化，也不应该自动滚动
      const result = scrollLogic.shouldAutoScroll(container, true, true)
      expect(result).toBe(false)
    })
  })

  describe('场景3: 用户向上滚动，工具调用 → 不会强制滚动', () => {
    it('用户向上滚动后，工具调用时内容没变化，不应该自动滚动', () => {
      // 用户向上滚动
      container.scrollTop = 200
      container.scrollHeight = 1000
      container.clientHeight = 500

      // 触发 handleScroll，标记用户已向上滚动
      scrollLogic.handleScroll(container)

      // 工具调用时内容没变化
      const result = scrollLogic.shouldAutoScroll(container, true, false)
      expect(result).toBe(false)
    })
  })

  describe('场景4: 用户滚回底部，流式输出 → 重新自动跟随', () => {
    it('用户滚回底部后，isStreaming=true，内容变化时应该自动滚动', () => {
      // 用户先向上滚动
      container.scrollTop = 200
      container.scrollHeight = 1000
      container.clientHeight = 500
      scrollLogic.handleScroll(container)
      expect(scrollLogic.getUserScrolledUp()).toBe(true)

      // 用户滚回底部
      container.scrollTop = 500
      scrollLogic.handleScroll(container)
      expect(scrollLogic.getUserScrolledUp()).toBe(false)

      // 此时内容变化，应该自动滚动
      const result = scrollLogic.shouldAutoScroll(container, true, true)
      expect(result).toBe(true)
    })
  })

  describe('场景5: Thinking 内容增加 → 正常滚动（内容有变化）', () => {
    it('用户在底部，Thinking 内容变化时应该自动滚动', () => {
      // 用户在底部
      container.scrollTop = 500
      container.scrollHeight = 1000
      container.clientHeight = 500

      // Thinking 内容变化
      const result = scrollLogic.shouldAutoScroll(container, true, true)
      expect(result).toBe(true)
    })

    it('用户向上滚动，Thinking 内容变化时不应该自动滚动', () => {
      // 用户向上滚动
      container.scrollTop = 200
      container.scrollHeight = 1000
      container.clientHeight = 500
      scrollLogic.handleScroll(container)

      // Thinking 内容变化
      const result = scrollLogic.shouldAutoScroll(container, true, true)
      expect(result).toBe(false)
    })
  })

  describe('场景6: 工具调用开始/结束 → 不会强制滚动（内容没变化）', () => {
    it('工具调用开始时，内容没变化，不应该自动滚动', () => {
      // 用户在底部
      container.scrollTop = 500
      container.scrollHeight = 1000
      container.clientHeight = 500

      // 工具调用开始，但内容没变化
      const result = scrollLogic.shouldAutoScroll(container, true, false)
      expect(result).toBe(false)
    })

    it('工具调用结束时，内容没变化，不应该自动滚动', () => {
      // 用户在底部
      container.scrollTop = 500
      container.scrollHeight = 1000
      container.clientHeight = 500

      // 工具调用结束，但内容没变化
      const result = scrollLogic.shouldAutoScroll(container, true, false)
      expect(result).toBe(false)
    })

    it('用户向上滚动，工具调用开始/结束，不应该自动滚动', () => {
      // 用户向上滚动
      container.scrollTop = 200
      container.scrollHeight = 1000
      container.clientHeight = 500
      scrollLogic.handleScroll(container)

      // 工具调用开始
      const result1 = scrollLogic.shouldAutoScroll(container, true, false)
      expect(result1).toBe(false)

      // 工具调用结束
      const result2 = scrollLogic.shouldAutoScroll(container, true, false)
      expect(result2).toBe(false)
    })
  })

  describe('流式结束后（agent_end）的行为', () => {
    it('流式结束后，用户没滚远，应该确认滚到底部', () => {
      // 用户在中间位置（不是底部，但也没滚很远）
      container.scrollTop = 300
      container.scrollHeight = 1000
      container.clientHeight = 500

      // 流式结束，用户没主动向上滚动过
      const result = scrollLogic.shouldAutoScroll(container, false, true)
      expect(result).toBe(true)
    })

    it('流式结束后，用户主动向上滚动过，不应该自动滚动', () => {
      // 用户先向上滚动
      container.scrollTop = 200
      container.scrollHeight = 1000
      container.clientHeight = 500
      scrollLogic.handleScroll(container)

      // 流式结束
      const result = scrollLogic.shouldAutoScroll(container, false, true)
      expect(result).toBe(false)
    })

    it('流式结束后，用户在底部，不应该自动滚动（已经在底部了）', () => {
      // 用户在底部
      container.scrollTop = 500
      container.scrollHeight = 1000
      container.clientHeight = 500

      // 流式结束
      const result = scrollLogic.shouldAutoScroll(container, false, true)
      expect(result).toBe(false)
    })
  })

  describe('边界条件', () => {
    it('距离底部刚好 50px，应该认为是在底部', () => {
      // 距离底部 50px
      container.scrollTop = 450
      container.scrollHeight = 1000
      container.clientHeight = 500

      const result = scrollLogic.shouldAutoScroll(container, true, true)
      expect(result).toBe(true)
    })

    it('距离底部 51px（内容增长导致），应该继续滚动', () => {
      // 距离底部 51px — 用户没滚走，是内容增长导致的偏移
      container.scrollTop = 449
      container.scrollHeight = 1000
      container.clientHeight = 500

      const result = scrollLogic.shouldAutoScroll(container, true, true)
      expect(result).toBe(true) // 用户没主动滚走，内容增长导致偏移，应该继续跟随
    })

    it('距离底部 51px 且用户向上滚动过，不应该自动滚动', () => {
      // 距离底部 51px
      container.scrollTop = 449
      container.scrollHeight = 1000
      container.clientHeight = 500

      // 触发 handleScroll，标记用户已向上滚动
      scrollLogic.handleScroll(container)

      const result = scrollLogic.shouldAutoScroll(container, true, true)
      expect(result).toBe(false)
    })
  })
})

describe('内容变化检测逻辑', () => {
  it('content 变化应该触发更新', () => {
    let lastContent = ''
    let lastThinking = ''
    let lastToolCallsLength = 0
    let lastToolCallsStatus = ''

    const checkHasChanged = (
      content: string,
      thinking: string,
      toolCallsLength: number,
      toolCallsStatus: string
    ) => {
      const hasChanged = content !== lastContent || 
                         thinking !== lastThinking || 
                         toolCallsLength !== lastToolCallsLength ||
                         toolCallsStatus !== lastToolCallsStatus
      
      if (hasChanged) {
        lastContent = content
        lastThinking = thinking
        lastToolCallsLength = toolCallsLength
        lastToolCallsStatus = toolCallsStatus
      }
      
      return hasChanged
    }

    // 初始状态
    expect(checkHasChanged('', '', 0, '')).toBe(false)

    // content 变化
    expect(checkHasChanged('hello', '', 0, '')).toBe(true)
    expect(checkHasChanged('hello', '', 0, '')).toBe(false) // 重复调用不变

    // thinking 变化
    expect(checkHasChanged('hello', 'thinking...', 0, '')).toBe(true)
    expect(checkHasChanged('hello', 'thinking...', 0, '')).toBe(false)

    // toolCalls 数量变化
    expect(checkHasChanged('hello', 'thinking...', 1, 'running')).toBe(true)
    expect(checkHasChanged('hello', 'thinking...', 1, 'running')).toBe(false)

    // toolCalls 状态变化（数量不变，状态变化）
    expect(checkHasChanged('hello', 'thinking...', 1, 'success')).toBe(true)
    expect(checkHasChanged('hello', 'thinking...', 1, 'success')).toBe(false)
  })

  it('toolCalls 状态变化应该触发更新', () => {
    let lastContent = ''
    let lastThinking = ''
    let lastToolCallsLength = 0
    let lastToolCallsStatus = ''

    const checkHasChanged = (
      content: string,
      thinking: string,
      toolCallsLength: number,
      toolCallsStatus: string
    ) => {
      const hasChanged = content !== lastContent || 
                         thinking !== lastThinking || 
                         toolCallsLength !== lastToolCallsLength ||
                         toolCallsStatus !== lastToolCallsStatus
      
      if (hasChanged) {
        lastContent = content
        lastThinking = thinking
        lastToolCallsLength = toolCallsLength
        lastToolCallsStatus = toolCallsStatus
      }
      
      return hasChanged
    }

    // 初始状态：1个工具调用，状态为 running
    expect(checkHasChanged('', '', 1, 'running')).toBe(true)

    // 工具调用状态变为 success
    expect(checkHasChanged('', '', 1, 'success')).toBe(true)

    // 多个工具调用状态变化
    expect(checkHasChanged('', '', 2, 'running,running')).toBe(true)
    expect(checkHasChanged('', '', 2, 'success,running')).toBe(true)
    expect(checkHasChanged('', '', 2, 'success,success')).toBe(true)
  })
})