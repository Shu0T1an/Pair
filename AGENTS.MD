# AGENTS.MD - Pair 项目开发指南

> 本文件为 AI 助手提供项目上下文和开发规范，帮助理解代码库并高效协作。

## 项目概述

**Pair** 是一个通用 AI 助手 PC 客户端，让用户可以在桌面端与 AI 进行交互式对话和代码协作。

- **技术栈**: Electron + React + TypeScript
- **Agent 引擎**: @earendil-works/pi-coding-agent SDK
- **构建工具**: Vite + Electron Builder
- **CSS 方案**: Tailwind CSS v4 + `@tailwindcss/vite` 插件
- **测试框架**: Vitest

## 项目结构

```
Pair/
├── src/
│   ├── main/                        # Electron 主进程
│   │   ├── index.ts                 # 主进程入口
│   │   ├── agent-manager.ts         # Agent 管理器（核心）
│   │   ├── ipc-handler.ts           # IPC 通信处理
│   │   ├── preload.ts               # preload 脚本 (contextBridge)
│   │   └── __tests__/               # 主进程测试
│   ├── renderer/                    # 渲染进程（前端）
│   │   ├── index.tsx                # 渲染进程入口
│   │   ├── App.tsx                  # 根组件
│   │   ├── ipc-client.ts            # IPC 客户端（单例）
│   │   ├── pages/
│   │   │   └── ChatPage.tsx         # 主页面（聊天）
│   │   ├── components/
│   │   │   ├── ChatArea.tsx         # 聊天区域
│   │   │   ├── SessionList.tsx      # 会话侧边栏
│   │   │   ├── Header.tsx           # 顶部导航
│   │   │   ├── TitleBar.tsx         # 窗口标题栏
│   │   │   ├── SettingsModal.tsx     # 设置弹窗
│   │   │   ├── chat/                # 聊天子组件
│   │   │   │   ├── ChatInput.tsx     # 输入框
│   │   │   │   ├── MessageList.tsx   # 消息列表
│   │   │   │   ├── MessageGroup.tsx  # 消息组
│   │   │   │   ├── ThinkingBlock.tsx # 思考块
│   │   │   │   └── ToolCallPanel.tsx # 工具调用面板
│   │   │   ├── modals/
│   │   │   │   └── ModelModal.tsx    # 模型管理弹窗（添加/编辑）
│   │   │   └── ui/                  # 基础 UI 组件
│   │   │       ├── button.tsx
│   │   │       ├── dropdown-menu.tsx
│   │   │       ├── scroll-area.tsx
│   │   │       └── ...
│   │   ├── hooks/
│   │   │   ├── useSessions.ts        # 会话管理
│   │   │   ├── useMessages.ts        # 消息/流式
│   │   │   └── useModels.ts          # 模型切换
│   │   ├── contexts/
│   │   │   ├── ModelContext.tsx       # 模型配置（localStorage 持久化）
│   │   │   ├── ThemeContext.tsx       # 主题（7 套预设主题）
│   │   │   └── MessageSettingsContext.tsx # 消息显示设置
│   │   ├── lib/
│   │   │   ├── utils.ts              # 工具函数（cn）
│   │   │   └── mock-data.ts          # 模拟数据
│   │   ├── utils/
│   │   │   └── model-fetcher.ts       # 模型获取工具
│   │   └── __tests__/
│   └── shared/
│       └── types.ts                  # 共享类型定义
├── docs/
│   └── plans/                        # 设计和实现文档
├── build/                            # 构建资源（图标等）
├── release/                          # 打包输出
├── package.json
├── tsconfig.json
├── tsconfig.electron.json            # 主进程 TS 配置
├── vite.config.ts
└── electron-builder.json
```

## 核心架构

### 分层设计

```
┌─────────────────────────────────────────────┐
│  渲染进程 (React UI)                         │
│  - ChatPage / SessionList / ChatArea         │
│  - hooks (useSessions/useMessages/useModels) │
│  - contexts (Model/Theme/MessageSettings)    │
├─────────────────────────────────────────────┤
│  preload.ts (contextBridge)                  │
│  - 暴露 electronAPI 到 window                │
│  - 白名单过滤 IPC 通道                       │
├─────────────────────────────────────────────┤
│  IPC 通信层 (ipc-handler.ts / ipc-client.ts) │
│  - 双向 invoke/handle 模式                   │
│  - 事件推送 (main → renderer)                │
├─────────────────────────────────────────────┤
│  Agent Manager (agent-manager.ts)            │
│  - 会话生命周期、工具调度                     │
│  - 元数据持久化 (session-metadata.json)      │
│  - 模型管理 (ModelRegistry ＋ custom models) │
├─────────────────────────────────────────────┤
│  pi SDK 核心                                 │
│  - AgentSession, SessionManager, ModelReg.   │
└─────────────────────────────────────────────┘
```

### 构建流程

```
tsc -p tsconfig.electron.json     → dist/main/       (主进程 + preload)
vite build                        → dist/            (渲染进程)
echo {"type":"module"} > dist/main/package.json       (ESM)
electron-builder                  → release/         (安装包)
```

### 关键接口

**AgentManager** — 核心管理器
```typescript
interface AgentManager {
  createSession(options): Promise<SessionInfo>
  resumeSession(sessionId): Promise<AgentSession>
  listSessions(): Promise<ProjectSessions[]>
  deleteSession(sessionId): Promise<void>
  deleteAllSessions(): Promise<void>
  deleteAllSessionsInProject(projectPath): Promise<void>
  sendMessage(sessionId, text, modelConfig?): Promise<void>
  abortSession(sessionId): Promise<void>
  getMessages(sessionId): any[]
  getSessionInfo(sessionId): SessionInfo | undefined
  updateSessionInfo(sessionId, updates): void
  setModelWithConfig(sessionId, config): Promise<void>
  getModels(): ModelInfo[]
  getContextUsage(sessionId): ContextUsage
}
```

**NotificationManager** - 通知管理器
```typescript
// 负责发送系统通知，当应用在后台且 AI 完成回复时弹出通知
// 主要功能:
// - 检查窗口状态（是否在后台）
// - 发送 Windows 系统原生通知
// - 管理通知配置（启用/禁用、标题、正文）
// - 处理通知点击事件（聚焦窗口）
interface NotificationManager {
  shouldNotify(): boolean;
  sendNotification(title?: string, body?: string): void;
  updateConfig(config: Partial<NotificationConfig>): void;
  getConfig(): NotificationConfig;
}
```

**IPC API** — 前后端通信（preload 白名单）

| 通道 | 方向 | 说明 |
|------|------|------|
| `session:create` | → | 创建会话 |
| `session:list` | → | 列出会话 |
| `session:delete` | → | 删除单个会话 |
| `session:deleteAll` | → | 删除所有会话 |
| `session:deleteAllInProject` | → | 删除项目下所有会话 |
| `session:info` | → | 获取会话信息 |
| `session:update` | → | 更新会话（重命名） |
| `session:messages` | → | 获取历史消息 |
| `message:send` | → | 发送消息 |
| `message:abort` | → | 中止消息 |
| `model:list` | → | 列出可用模型 |
| `model:current` | → | 当前模型 |
| `model:set` | → | 设置模型 |
| `model:testConnection` | → | 测试 API 连接 |
| `model:setApiKey` | → | 设置运行时 API Key |
| `model:removeApiKey` | → | 移除 API Key |
| `model:syncConfig` | → | 同步到 models.json |
| `model:removeConfig` | → | 从 models.json 移除 |
| `dialog:selectFolder` | → | 选择文件夹 |
| `context:usage` | → | 上下文使用情况 |
| `window:minimize/maximize/close` | → | 窗口控制 |
| `agent:message_start/text_delta/thinking_delta/message_end` | ← | 消息流式事件 |
| `agent:tool_start/tool_update/tool_end` | ← | 工具调用事件 |
| `agent:agent_start/agent_end` | ← | Agent 生命周期 |
| `agent:turn_start/turn_end` | ← | 对话轮次事件 |

### 事件通信（ipcClient）

```typescript
// 渲染进程订阅事件
const unsub = ipcClient.onMessageStart((event) => { ... })
const unsub = ipcClient.onTextDelta((event) => { ... })
const unsub = ipcClient.onToolStart((event) => { ... })
// 返回取消订阅函数
```

## Hooks 架构

### useSessions
- 状态: `projects`, `activeSessionId`
- 方法: `createSession`, `deleteSession`, `deleteAllSessions`, `deleteAllSessionsInProject`, `renameSession`, `selectSession`
- 特性: 消息缓存 (`messagesCacheRef`)、上次会话恢复 (`localStorage`)

### useMessages
- 状态: `messages`, `isLoading`, `isStreaming`
- 方法: `sendMessage`, `abortMessage`, `loadMessages`
- 特性: 流式渲染（RAF 节流 buffer）、事件订阅、消息缓存同步

### useModels
- 状态: `models`, `currentModel`, `currentModelId`
- 方法: `selectModel`, `refreshModels`

### useGlobalStream
- 状态: 全局流式消息状态（按 sessionId 索引）
- 方法: `getStreamingMessage`, `isSessionStreaming`, `clearStreamState`, `getStreamingSessionIds`
- 特性: 
  - 应用级别事件监听，不随会话切换而中断
  - 实时更新流式消息内容（文本、思考、工具调用）
  - 支持多会话并行流式输出
  - 订阅机制：组件可订阅指定会话的状态变化

### useSessionStream
- 状态: 指定会话的流式状态
- 特性: 自动订阅和取消订阅，组件卸载时自动清理

## Contexts

| Context | 用途 | 持久化 |
|---------|------|--------|
| `ModelContext` | 自定义模型 CRUD（Provider/BaseUrl/ApiKey） | localStorage |
| `ThemeContext` | 7 套预设主题切换 | CSS 变量 + localStorage |
| `MessageSettingsContext` | 消息显示设置 | React state |
| `GlobalStreamContext` | 全局流式状态管理（多会话并行） | 内存（ref） |
| `SessionStateContext` | 会话状态管理（idle/working/completed） | 内存 |

## 开发规范

### 代码风格

- 使用 TypeScript 严格模式
- 组件使用函数式组件 + Hooks
- 异步操作使用 async/await
- 错误处理要完善，分类处理不同错误类型

### 命名约定

| 类型 | 规范 | 示例 |
|------|------|------|
| 文件名 | kebab-case | `agent-manager.ts` |
| 组件名 | PascalCase | `SessionList.tsx` |
| 接口名 | PascalCase 可选 Interface 后缀 | `SessionInfo` |
| 常量 | UPPER_SNAKE_CASE | `MAX_SESSIONS` |
| 函数/方法 | camelCase | `createSession` |

### Git 提交规范

**提交信息必须使用中文**，格式如下：

```
feat: 新功能
fix: 修复
test: 测试
docs: 文档
refactor: 重构
chore: 构建/工具
```

示例：`fix: 修复 session 删除功能 — 元数据清理 + 前端按钮可见性`

## 测试

### 测试文件位置

- 主进程: `src/main/__tests__/*.test.ts`
- 渲染进程: `src/renderer/__tests__/*.test.tsx`

### 注意事项（重要）

**AgentManager 测试必须 mock electron.app.getPath：**
```typescript
vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/test-path' },
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
  BrowserWindow: vi.fn(),
}));
```

缺少 `app` mock 会导致 `Cannot read properties of undefined (reading 'getPath')`。

## 常用命令

```bash
# 开发
npm run dev              # Vite 开发服务器（仅前端）
npm run dev:electron     # Electron 开发模式（tsc --watch + vite + electron）
npm run build            # 编译 TS + Vite 构建
npm test                 # Vitest 运行全部测试
npm run test:watch       # 监听模式
npm run test:coverage    # 覆盖率报告
npm run package          # 打包
```

## 依赖说明

### 核心依赖

| 包 | 用途 |
|----|------|
| `electron` | 桌面框架 |
| `@earendil-works/pi-coding-agent` | AI Agent SDK |
| `react` / `react-dom` | UI 框架 |
| `@radix-ui/*` | 无样式可访问组件 |
| `@tiptap/*` | 富文本编辑器 |
| `react-markdown` | Markdown 渲染 |
| `shiki` | 代码语法高亮 |
| `lucide-react` | 图标库 |
| `tailwindcss` v4 | CSS 工具类 |

### 开发依赖

| 包 | 用途 |
|----|------|
| `vite` | 构建工具 |
| `typescript` | 类型系统 |
| `electron-builder` | 打包 |
| `vitest` | 单元测试 |
| `playwright` | E2E 测试 |

## 注意事项

1. **进程隔离**: 主进程和渲染进程通过 IPC 通信，不要直接共享状态
2. **安全性**: 默认启用 contextIsolation，通过 preload.ts 白名单暴露 API
3. **会话管理**:
   - 会话按项目分组（文件夹路径），每个项目可有多个会话
   - **新会话命名规则**: `新会话-YYMMDD`（例如: 新会话-260515）
   - 元数据持久化在 `userData/session-metadata.json`
4. **模型管理**: 两种模型来源 — ModelRegistry（.pi/agent/models.json）+ 自定义模型（localStorage）
5. **工具调用**: UI 需要可视化工具调用状态（执行中/成功/失败）
6. **错误处理**: 网络错误重试、认证错误提示登录、会话错误尝试恢复

## 已知陷阱（Gotchas）

### 🔴 saveMetadata 必须确保目录存在

```typescript
// 错误：目录不存在时 writeFileSync 会抛异常
fs.writeFileSync(this.metadataPath, ...)

// 正确：先 mkdirSync
const dir = path.dirname(this.metadataPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(this.metadataPath, ...)
```

### 🔴 deleteSession 必须用 try/finally

```typescript
// 错误：dispose() 抛异常会导致元数据残留
entry.session.dispose();
this.sessionMetadata.delete(sessionId);
this.saveMetadata();

// 正确：finally 保证元数据始终被清理
try {
  entry.session.dispose();
} finally {
  this.sessionMetadata.delete(sessionId);
  this.saveMetadata();
}
```

### 🔴 deleteAllSessions — 先清元数据再 dispose

避免 dispose 异常导致部分会话残留。先清空 `this.sessionMetadata.clear()` 并 `saveMetadata()`，再逐个 dispose。

### 🟡 CSS Grid 1fr 比 flex-1 min-w-0 更可靠

Flexbox 的 `flex-1 min-w-0` 在某些环境下（Electron + Tailwind v4）可能不按预期截断文本，导致布局溢出。对于"左列撑满、右列自适应"的布局，使用 CSS Grid：

```tsx
<div className="grid grid-cols-[1fr_auto] gap-2">
  <div className="min-w-0 truncate">文本内容</div>
  <div className="flex items-center gap-0.5">按钮组</div>
</div>
```

### 🟡 ScrollArea 的 overflow-hidden 会裁剪内容

Radix UI 的 ScrollArea 根节点默认有 `overflow-hidden`，任何超出视口边界的内容都会被裁剪。确保子元素宽度不超过 `w-[inherit]`。

### 🟡 避免 opacity-0 group-hover 在 Electron 中

Electron 的渲染进程可能因为 GPU 合成或 Chromium 版本差异导致 `group-hover:opacity-100` 不触发。建议操作按钮默认常显或使用更可靠的显隐方案。

### 🟡 Electron vitest mock 需要完整

AgentManager 构造函数依赖 `app.getPath('userData')`，测试时必须 mock：

```typescript
vi.mock('electron', () => ({
  app: { getPath: () => os.tmpdir() + '/pair-test-' + Date.now() },
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
  BrowserWindow: vi.fn(),
}));
```

`vi.mock` 工厂函数会被 hoist 到文件顶部，内部不能引用外部变量（需用 `require` 或内联值）。

## ChatArea 消息布局规范

### CSS Grid 布局

消息区域使用 CSS Grid 实现头像与内容的分列布局：

- **助手消息**: `grid-cols-[36px_1fr]` — 头像在左，内容在右
- **用户消息**: `grid-cols-[1fr_36px]` — 内容在左，头像在右（通过 `ml-auto` 推到右侧）

```
助手消息:                        用户消息:
┌──────┬──────────────────┐    ┌──────────────────┬──────┐
│ 🤖  │ AI 助手           │    │           用户 │ 👤  │
│      │ ┌─ Thinking ───┐ │    │  消息内容...     │      │
│      │ │ 思考内容...   │ │    └──────────────────┴──────┘
│      │ └─────────────┘ │
│      │ 正文内容...      │
│      │ ┌─ 工具调用 ───┐ │
│      │ │ 1. ✓ read    │ │
│      │ └─────────────┘ │
└──────┴──────────────────┘
```

### 元素对齐规则

| 元素 | 对齐方式 | 说明 |
|------|---------|------|
| 头像 | 独立列，固定 36px | 不随内容缩进 |
| Thinking 块 | 内容列左对齐 | 与头像左边缘对齐 |
| 工具调用列表 | 内容列左对齐 | 与头像左边缘对齐 |
| 正文内容 | 内容列内 | 保持自然流动 |
| 时间戳 | 内容列左对齐 | 只在组内最后一条消息显示 |

### 时间戳显示规则

- **助手消息组**: 只在组内最后一条消息显示时间戳
- **用户消息**: 只在全局最后一条消息显示 `isLastMessage` prop
- **流式消息**: 流式期间不显示时间戳
- 通过 `settings.showTimestamp` 全局开关控制

### 消息分组逻辑

`groupMessages()` 将连续的助手消息合并为一组，共享一个头像：

```typescript
type MessageGroup = { role: 'user' | 'assistant' | 'system'; messages: Message[] }
```

- 连续的助手消息合并为一组
- 用户消息每条独立成组
- 每组最多显示一个头像

## 扩展系统

支持两类扩展：
- **pi 原生扩展**: 技能、工具、命令
- **UI 扩展**: 面板、主题、布局

## 参考文档

- 设计文档: `docs/plans/2026-05-14-agent-pc-client-design.md`
- 实现计划: `docs/plans/2026-05-14-agent-pc-client-implementation.md`
