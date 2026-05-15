# 代码重构设计方案

> 创建日期: 2026-05-15
> 状态: 已确认

## 1. 背景与目标

### 当前问题

| 文件 | 行数 | 问题 |
|------|------|------|
| `ChatArea.tsx` | 1022 | 过大，包含多种职责 |
| `App.tsx` | 741 | 业务逻辑密集 |
| `SettingsModal.tsx` | 598 | 较大 |
| `AddModelModal.tsx` | 522 | 与 EditModelModal 重复 |
| `EditModelModal.tsx` | 547 | 与 AddModelModal 重复 |

### 重构目标

1. **清晰分层** - UI 组件、业务逻辑、状态管理分离明确
2. **职责单一** - 每个组件/模块只负责一件事
3. **良好可测试性** - 便于编写单元测试

## 2. 目标架构

### 目录结构

```
src/
├── shared/                    # 共享类型和工具
│   ├── types.ts              # 类型定义
│   └── utils.ts              # 通用工具函数
│
├── renderer/
│   ├── hooks/                # 自定义 Hooks（业务逻辑层）
│   │   ├── useSessions.ts    # 会话管理（创建、切换、删除、重命名）
│   │   ├── useMessages.ts    # 消息状态（发送、流式更新、缓存）
│   │   ├── useModels.ts      # 模型管理（加载、切换）
│   │   └── useStreaming.ts   # 流式事件处理
│   │
│   ├── contexts/             # Context（全局状态）
│   │   ├── ModelContext.tsx   # 模型配置
│   │   └── MessageSettingsContext.tsx  # 消息显示设置
│   │
│   ├── components/           # 纯 UI 组件（无业务逻辑）
│   │   ├── chat/             # 聊天相关组件
│   │   │   ├── MessageList.tsx      # 消息列表（分组、滚动）
│   │   │   ├── MessageGroup.tsx     # 消息组（头像、时间戳）
│   │   │   ├── ChatInput.tsx        # 输入框和工具栏
│   │   │   ├── ToolCallPanel.tsx    # 工具调用展示
│   │   │   └── ThinkingBlock.tsx    # 思考过程展示
│   │   ├── session/          # 会话相关组件
│   │   │   └── SessionList.tsx
│   │   ├── modals/           # 弹窗组件
│   │   │   ├── SettingsModal.tsx
│   │   │   └── ModelModal.tsx       # 合并 Add/Edit
│   │   └── ui/               # 基础 UI 组件
│   │
│   └── pages/                # 页面组件（组合层）
│       └── ChatPage.tsx      # 主聊天页面（组合 hooks + 组件）
│
└── main/                     # Electron 主进程（不变）
```

### 分层设计

```
┌─────────────────────────────────────────────────────────┐
│  ChatPage (组合层)                                       │
│  ├── useSessions()                                       │
│  ├── useMessages(activeSessionId)                        │
│  └── useModels()                                         │
├─────────────────────────────────────────────────────────┤
│  纯 UI 组件                                              │
│  ├── MessageList ← messages, onScroll                   │
│  ├── ChatInput ← onSend, currentModel, models           │
│  └── ToolCallPanel ← toolCalls                          │
└─────────────────────────────────────────────────────────┘
```

## 3. Hooks 设计

### useSessions.ts

```typescript
export function useSessions() {
  return {
    projects,           // ProjectSessions[]
    activeSessionId,    // string | null
    selectSession,      // (sessionId: string) => Promise<void>
    createSession,      // (options: SessionOptions) => Promise<SessionInfo>
    deleteSession,      // (sessionId: string) => Promise<void>
    renameSession,      // (sessionId: string, name: string) => Promise<void>
    isLoading,          // boolean
  }
}
```

### useMessages.ts

```typescript
export function useMessages(sessionId: string | null) {
  return {
    messages,           // Message[]
    sendMessage,        // (text: string) => Promise<void>
    abortMessage,       // () => void
    retryMessage,       // () => Promise<void>
    isLoading,          // boolean
    isStreaming,        // boolean
  }
}
```

### useModels.ts

```typescript
export function useModels() {
  return {
    models,             // ModelInfo[]
    currentModel,       // ModelInfo
    selectModel,        // (modelId: string) => void
    loadModels,         // () => void
  }
}
```

## 4. 组件拆分

### ChatArea 拆分

| 新组件 | 职责 | 来源 |
|--------|------|------|
| `MessageList` | 消息列表展示、分组、滚动控制 | ChatArea 部分 |
| `MessageGroup` | 单个消息组（头像、时间戳） | ChatArea 部分 |
| `ChatInput` | 输入框、模型选择、工具栏 | ChatArea 部分 |
| `ToolCallPanel` | 工具调用列表展示 | ChatArea 部分 |
| `ThinkingBlock` | 思考过程展示 | ChatArea 部分 |

### 弹窗合并

将 `AddModelModal.tsx` 和 `EditModelModal.tsx` 合并为 `ModelModal.tsx`：
- 通过 `mode: 'add' | 'edit'` 区分模式
- 共享表单逻辑和验证

## 5. 执行计划

| 阶段 | 任务 | 产出 |
|------|------|------|
| **阶段 1** | 提取 Hooks | `useSessions`, `useMessages`, `useModels` |
| **阶段 2** | 拆分 ChatArea | `MessageList`, `ChatInput`, `ToolCallPanel`, `ThinkingBlock` |
| **阶段 3** | 重构 App.tsx | 提取 `ChatPage`，App 只负责布局和 Context |
| **阶段 4** | 合并弹窗 | `ModelModal` 替代 Add/Edit ModelModal |
| **阶段 5** | 清理优化 | 删除冗余代码，统一命名 |

## 6. 验收标准

- [ ] 每个文件不超过 300 行
- [ ] 组件只包含 UI 逻辑，业务逻辑在 Hooks 中
- [ ] 所有 Hooks 可独立测试
- [ ] 功能行为与重构前完全一致
- [ ] 无 TypeScript 错误
