# AGENTS.MD - Pair 项目开发指南

> 本文件为 AI 助手提供项目上下文和开发规范，帮助理解代码库并高效协作。

## 项目概述

**Pair** 是一个通用 AI 助手 PC 客户端，让用户可以在桌面端与 AI 进行交互式对话和代码协作。

- **技术栈**: Electron + React + TypeScript
- **Agent 引擎**: @earendil-works/pi-coding-agent SDK
- **构建工具**: Vite + Electron Builder
- **测试框架**: Vitest + Playwright

## 项目结构

```
Pair/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             # 主进程入口
│   │   ├── agent-manager.ts     # Agent 管理器（核心）
│   │   ├── ipc-handler.ts       # IPC 通信处理
│   │   └── __tests__/           # 主进程测试
│   ├── renderer/                # 渲染进程（前端）
│   │   ├── index.tsx            # 渲染进程入口
│   │   ├── App.tsx              # 根组件
│   │   ├── ipc-client.ts        # IPC 客户端
│   │   ├── components/          # UI 组件
│   │   │   ├── ChatArea.tsx     # 聊天区域（消息布局、输入框、工具栏）
│   │   │   ├── SessionList.tsx  # 会话列表
│   │   │   ├── Header.tsx       # 顶部导航
│   │   │   ├── TitleBar.tsx     # 标题栏
│   │   │   ├── SettingsModal.tsx # 设置弹窗
│   │   │   ├── AddModelModal.tsx # 添加模型弹窗
│   │   │   ├── EditModelModal.tsx # 编辑模型弹窗
│   │   │   └── ui/              # 基础 UI 组件（Button, ScrollArea 等）
│   │   └── __tests__/           # 前端测试
│   └── shared/                  # 共享类型定义
│       └── types.ts
├── docs/
│   └── plans/                   # 设计和实现文档
├── build/                       # 构建资源（图标等）
├── release/                     # 打包输出
├── package.json
├── tsconfig.json
├── vite.config.ts
└── electron-builder.json
```

## 核心架构

### 分层设计

```
┌─────────────────────────────────────────────┐
│  渲染进程 (React UI)                         │
│  - 消息展示、输入、会话管理                   │
├─────────────────────────────────────────────┤
│  IPC 通信层                                  │
│  - 双向请求/响应 + 事件订阅                   │
├─────────────────────────────────────────────┤
│  Agent Manager (主进程)                      │
│  - 会话生命周期、工具调度、扩展管理           │
├─────────────────────────────────────────────┤
│  pi SDK 核心                                 │
│  - AgentSession, ModelRegistry               │
└─────────────────────────────────────────────┘
```

### 关键接口

**AgentManager** - 核心管理器
```typescript
interface AgentManager {
  createSession(options: SessionOptions): Promise<SessionInfo>;
  resumeSession(sessionId: string): Promise<AgentSession>;
  listSessions(): Promise<ProjectSessions[]>;
  deleteSession(sessionId: string): Promise<void>;
}
```

**IPC API** - 前后端通信
```typescript
// 请求通道
session.create / session.list / session.delete / session.resume
message.send / message.abort
model.list / model.set / model.get

// 事件通道
message:update / tool:start / tool:end / status:streaming
```

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
| 接口名 | PascalCase + Interface 后缀可选 | `SessionInfo` |
| 常量 | UPPER_SNAKE_CASE | `MAX_SESSIONS` |
| 函数/方法 | camelCase | `createSession` |

### Git 提交规范

```
feat: 新功能
fix: 修复
test: 测试
docs: 文档
refactor: 重构
chore: 构建/工具
```

示例：`feat: implement Agent Manager base`

## 测试要求

| 测试类型 | 覆盖目标 | 工具 |
|---------|---------|------|
| 单元测试 | 80%+ | Vitest |
| 集成测试 | 70%+ | Vitest + Electron |
| E2E 测试 | 核心流程 100% | Playwright |

### 测试文件位置

- 主进程: `src/main/__tests__/*.test.ts`
- 渲染进程: `src/renderer/__tests__/*.test.tsx`

### 测试命名

```typescript
describe('AgentManager', () => {
  it('should create a new session', async () => {
    // ...
  });
});
```

## 常用命令

```bash
# 开发
npm run dev              # 启动 Vite 开发服务器（仅前端）
npm run dev:electron     # 启动 Electron 开发模式（同时启动 Vite + Electron）

# 构建
npm run build            # 编译 TypeScript + Vite 构建
npm run build:electron   # 编译 Electron 主进程 + Vite 构建

# 测试
npm test                 # 运行所有测试
npm run test:watch       # 监听模式
npm run test:coverage    # 覆盖率报告

# 打包
npm run package          # 打包当前平台
npm run package:win      # Windows
npm run package:mac      # macOS
npm run package:linux    # Linux
```

## 依赖说明

### 核心依赖

- `electron` - 桌面应用框架
- `@earendil-works/pi-coding-agent` - AI Agent SDK
- `react` / `react-dom` - UI 框架

### UI 组件库

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| **UI 组件库** | Radix UI | - | 无样式可访问组件 |
| **富文本编辑器** | TipTap | 3.19.0 | 基于 ProseMirror 的编辑器 |
| **Markdown 渲染** | React Markdown | 10.1.0 | Markdown 解析渲染 |
| **代码高亮** | Shiki | 3.22.0 | 语法高亮 |
| **图表** | Beautiful Mermaid | 最新 | 流程图、时序图等 |
| **数学公式** | KaTeX | 0.16+ | LaTeX 公式渲染 |

### 开发依赖

- `vite` - 构建工具
- `typescript` - 类型系统
- `electron-builder` - 打包工具
- `vitest` - 测试框架
- `playwright` - E2E 测试

## 注意事项

1. **进程隔离**: 主进程和渲染进程通过 IPC 通信，不要直接共享状态
2. **安全性**: 默认启用 contextIsolation，谨慎使用 nodeIntegration
3. **会话管理**: 会话按项目分组，每个项目可有多个会话
4. **工具调用**: UI 需要可视化工具调用状态（执行中/成功/失败）
5. **错误处理**: 网络错误重试、认证错误提示登录、会话错误尝试恢复

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

### 消息显示设置（MessageSettingsContext）

```typescript
interface MessageSettings {
  showTimestamp: boolean           // 是否显示时间戳
  showStreamingCursor: boolean     // 是否显示流式光标
  messageBackground: 'default' | 'subtle' | 'transparent'  // 消息背景样式
  bubbleStyle: 'default' | 'classic' | 'minimal'           // 气泡样式
  thinkingDefaultExpanded: boolean // Thinking 块默认是否展开
  toolCallsDefaultExpanded: boolean // 工具调用默认是否展开
}
```

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
