import { describe, it, expect } from 'vitest'

/**
 * 滑动逻辑核心测试
 * 
 * 测试矩阵：
 * | 场景 | userScrolledUp | isBottom | isStreaming | hasContentChanged | 预期结果 |
 * |------|----------------|----------|-------------|-------------------|----------|
 * | 用户在底部，流式输出 | false | true | true | true | ✅ 滚动 |
 * | 用户向上滚动，流式输出 | true | false | true | true | ❌ 不滚动 |
 * | 用户向上滚动，工具调用 | true | false | true | false | ❌ 不滚动 |
 * | 用户滚回底部，流式输出 | false | true | true | true | ✅ 滚动 |
 * | Thinking 内容增加 | false | true | true | true | ✅ 滚动 |
 * | 工具调用开始/结束 | false | true | true | false | ❌ 不滚动 |
 */

interface ScrollState {
  userScrolledUp: boolean
  isBottom: boolean
  isStreaming: boolean
  hasContentChanged: boolean
}

function shouldAutoScroll(state: ScrollState): boolean {
  const { userScrolledUp, isBottom, isStreaming, hasContentChanged } = state
  
  // 内容没变化，不滚动
  if (!hasContentChanged) return false
  
  if (isStreaming) {
    // 流式期间：只有用户没有向上滚动过（仍在底部）时才自动滚动
    return !userScrolledUp && isBottom
  } else {
    // 流式结束后（agent_end）：如果用户之前没主动向上滚动，确认滚到底部
    return !userScrolledUp && !isBottom
  }
}

describe('滑动逻辑核心测试', () => {
  describe('场景1: 用户在底部，流式输出 → 自动跟随', () => {
    it('应该自动滚动', () => {
      const result = shouldAutoScroll({
        userScrolledUp: false,
        isBottom: true,
        isStreaming: true,
        hasContentChanged: true,
      })
      expect(result).toBe(true)
    })
  })

  describe('场景2: 用户向上滚动，流式输出 → 停止自动滚动', () => {
    it('不应该自动滚动', () => {
      const result = shouldAutoScroll({
        userScrolledUp: true,
        isBottom: false,
        isStreaming: true,
        hasContentChanged: true,
      })
      expect(result).toBe(false)
    })
  })

  describe('场景3: 用户向上滚动，工具调用 → 不会强制滚动', () => {
    it('不应该自动滚动（内容没变化）', () => {
      const result = shouldAutoScroll({
        userScrolledUp: true,
        isBottom: false,
        isStreaming: true,
        hasContentChanged: false,
      })
      expect(result).toBe(false)
    })
  })

  describe('场景4: 用户滚回底部，流式输出 → 重新自动跟随', () => {
    it('应该自动滚动', () => {
      const result = shouldAutoScroll({
        userScrolledUp: false,
        isBottom: true,
        isStreaming: true,
        hasContentChanged: true,
      })
      expect(result).toBe(true)
    })
  })

  describe('场景5: Thinking 内容增加 → 正常滚动（内容有变化）', () => {
    it('用户在底部，应该自动滚动', () => {
      const result = shouldAutoScroll({
        userScrolledUp: false,
        isBottom: true,
        isStreaming: true,
        hasContentChanged: true,
      })
      expect(result).toBe(true)
    })

    it('用户向上滚动，不应该自动滚动', () => {
      const result = shouldAutoScroll({
        userScrolledUp: true,
        isBottom: false,
        isStreaming: true,
        hasContentChanged: true,
      })
      expect(result).toBe(false)
    })
  })

  describe('场景6: 工具调用开始/结束 → 不会强制滚动（内容没变化）', () => {
    it('不应该自动滚动', () => {
      const result = shouldAutoScroll({
        userScrolledUp: false,
        isBottom: true,
        isStreaming: true,
        hasContentChanged: false,
      })
      expect(result).toBe(false)
    })
  })

  describe('流式结束后（agent_end）的行为', () => {
    it('用户没滚远，应该确认滚到底部', () => {
      const result = shouldAutoScroll({
        userScrolledUp: false,
        isBottom: false,
        isStreaming: false,
        hasContentChanged: true,
      })
      expect(result).toBe(true)
    })

    it('用户主动向上滚动过，不应该自动滚动', () => {
      const result = shouldAutoScroll({
        userScrolledUp: true,
        isBottom: false,
        isStreaming: false,
        hasContentChanged: true,
      })
      expect(result).toBe(false)
    })

    it('用户在底部，不应该自动滚动（已经在底部了）', () => {
      const result = shouldAutoScroll({
        userScrolledUp: false,
        isBottom: true,
        isStreaming: false,
        hasContentChanged: true,
      })
      expect(result).toBe(false)
    })
  })
})

describe('内容变化检测逻辑', () => {
  interface ContentState {
    lastContent: string
    lastThinking: string
    lastToolCallsLength: number
    lastToolCallsStatus: string
  }

  function checkHasChanged(
    state: ContentState,
    content: string,
    thinking: string,
    toolCallsLength: number,
    toolCallsStatus: string
  ): { hasChanged: boolean; newState: ContentState } {
    const hasChanged = content !== state.lastContent || 
                       thinking !== state.lastThinking || 
                       toolCallsLength !== state.lastToolCallsLength ||
                       toolCallsStatus !== state.lastToolCallsStatus
    
    return {
      hasChanged,
      newState: hasChanged ? {
        lastContent: content,
        lastThinking: thinking,
        lastToolCallsLength: toolCallsLength,
        lastToolCallsStatus: toolCallsStatus,
      } : state,
    }
  }

  it('content 变化应该触发更新', () => {
    let state: ContentState = {
      lastContent: '',
      lastThinking: '',
      lastToolCallsLength: 0,
      lastToolCallsStatus: '',
    }

    // 初始状态
    const r1 = checkHasChanged(state, '', '', 0, '')
    expect(r1.hasChanged).toBe(false)

    // content 变化
    const r2 = checkHasChanged(r1.newState, 'hello', '', 0, '')
    expect(r2.hasChanged).toBe(true)
    state = r2.newState

    // 重复调用不变
    const r3 = checkHasChanged(state, 'hello', '', 0, '')
    expect(r3.hasChanged).toBe(false)
  })

  it('thinking 变化应该触发更新', () => {
    let state: ContentState = {
      lastContent: 'hello',
      lastThinking: '',
      lastToolCallsLength: 0,
      lastToolCallsStatus: '',
    }

    const r1 = checkHasChanged(state, 'hello', 'thinking...', 0, '')
    expect(r1.hasChanged).toBe(true)
    state = r1.newState

    const r2 = checkHasChanged(state, 'hello', 'thinking...', 0, '')
    expect(r2.hasChanged).toBe(false)
  })

  it('toolCalls 数量变化应该触发更新', () => {
    let state: ContentState = {
      lastContent: 'hello',
      lastThinking: 'thinking...',
      lastToolCallsLength: 0,
      lastToolCallsStatus: '',
    }

    const r1 = checkHasChanged(state, 'hello', 'thinking...', 1, 'running')
    expect(r1.hasChanged).toBe(true)
    state = r1.newState

    const r2 = checkHasChanged(state, 'hello', 'thinking...', 1, 'running')
    expect(r2.hasChanged).toBe(false)
  })

  it('toolCalls 状态变化应该触发更新', () => {
    let state: ContentState = {
      lastContent: 'hello',
      lastThinking: 'thinking...',
      lastToolCallsLength: 1,
      lastToolCallsStatus: 'running',
    }

    const r1 = checkHasChanged(state, 'hello', 'thinking...', 1, 'success')
    expect(r1.hasChanged).toBe(true)
    state = r1.newState

    const r2 = checkHasChanged(state, 'hello', 'thinking...', 1, 'success')
    expect(r2.hasChanged).toBe(false)
  })

  it('多个工具调用状态变化应该触发更新', () => {
    let state: ContentState = {
      lastContent: '',
      lastThinking: '',
      lastToolCallsLength: 0,
      lastToolCallsStatus: '',
    }

    const r1 = checkHasChanged(state, '', '', 2, 'running,running')
    expect(r1.hasChanged).toBe(true)
    state = r1.newState

    const r2 = checkHasChanged(state, '', '', 2, 'success,running')
    expect(r2.hasChanged).toBe(true)
    state = r2.newState

    const r3 = checkHasChanged(state, '', '', 2, 'success,success')
    expect(r3.hasChanged).toBe(true)
    state = r3.newState

    const r4 = checkHasChanged(state, '', '', 2, 'success,success')
    expect(r4.hasChanged).toBe(false)
  })
})