<div align="center">
  <img src="build/icon.png" alt="Pair Logo" width="120" height="120" />
  <h1 align="center">Pair</h1>
  <p align="center">
    通用 AI 助手桌面客户端<br />
    <strong>智能对话 · 代码协作 · 多模型支持</strong>
  </p>
  <p align="center">
    <a href="#-主要特性">特性</a> •
    <a href="#-快速开始">快速开始</a> •
    <a href="#-模型配置">模型配置</a> •
    <a href="#-项目架构">架构</a> •
    <a href="#-开发指南">开发</a> •
    <a href="#-构建部署">构建</a>
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/Electron-42+-47848F?logo=electron&logoColor=white" alt="Electron" />
    <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
    <img src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" alt="Vite" />
  </p>
</div>

## 📖 简介

**Pair** 是一款基于 Electron 构建的通用 AI 助手桌面客户端，搭载 [`@earendil-works/pi-coding-agent`](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) Agent 引擎，提供流畅的 AI 对话体验和代码协作能力。

支持多种大语言模型（OpenAI、Anthropic Claude、Google Gemini 及任何 OpenAI 兼容 API），可在直观的桌面界面中与 AI 进行多会话、多模型并行交互。

### 为什么选择 Pair？

| 特性 | 说明 |
|------|------|
| 🎯 **开箱即用** | Electron 打包桌面应用，无需浏览器配置 |
| 🤖 **多模型** | 同时管理多个 AI 提供商和模型，一键切换 |
| 📂 **按项目组织** | 会话按项目文件夹分组，管理更清晰 |
| 🔄 **流式输出** | 实时查看 AI 思考、工具调用和文本生成 |
| 🛠 **工具调用可视化** | 逐步展示 AI 使用工具的输入输出 |
| 🎨 **7 套主题** | 深浅模式 + 多色系主题，全面个性化 |
| 🔔 **系统通知** | AI 完成回复时后台通知，不错过任何消息 |
| 🏷 **标签页管理** | 最多 10 个会话标签页，快速切换 |

## ✨ 主要特性

### 💬 智能对话

- 多会话并行管理，按项目（文件夹）分组
- 流式输出实时展示，支持思考过程（Thinking）和工具调用
- 消息气泡支持 Markdown 渲染、代码高亮
- 会话自动持久化，关闭应用后重新打开自动恢复

### 🧠 多模型管理

- 支持 **OpenAI**、**Anthropic Claude**、**Google Gemini** 及任何 **OpenAI 兼容 API**
- 通过设置面板添加/编辑/删除模型提供方
- 一键测试 API 连接
- 自动获取远程模型列表，智能选择
- 每个会话独立选择模型

### 🛠 工具调用面板

- 三级展开：概要 → 工具列表 → 详细参数/结果
- 实时状态指示（等待中 → 执行中 → 成功/失败）
- 支持常见 AI 工具：文件读写、终端执行、搜索、代码编辑
- 每个工具调用计时，显示执行时长

### 🎨 个性化定制

- **7 套颜色主题**：经典灰、清新蓝、自然绿、优雅紫、暖阳橙、纯白、深色
- **深浅模式**：一键切换
- **3 档字体大小**：小/中/大
- **消息显示设置**：折叠框默认状态、流式光标、时间戳

### 📋 标签页管理

- 多会话标签页快速切换（最多 10 个）
- 标签位置持久化，重启后保留
- 溢出滚动，便捷导航

### 🔔 系统通知

- AI 完成回复时弹出 Windows 原生通知
- 应用在后台时自动启用
- 通知标题、正文、触发事件自定义
- 点击通知聚焦应用窗口

## 🚀 快速开始

### 环境要求

- **Node.js** >= 18
- **npm** >= 9

### 安装

```bash
# 克隆仓库
git clone https://github.com/your-username/pair.git
cd pair

# 安装依赖
npm install
```

### 开发模式

```bash
# 仅启动前端开发服务器
npm run dev

# 启动完整 Electron 开发环境
npm run dev:electron
```

启动后会自动打开 Electron 窗口，连接 Vite 开发服务器，支持热更新。

### 构建

```bash
# 编译项目
npm run build

# 打包桌面应用
npm run package:win    # Windows
npm run package:mac    # macOS
npm run package:linux  # Linux
```

## 🔧 模型配置

### 添加模型提供方

1. 点击左下角 **设置** → **模型设置**
2. 点击 **添加模型**
3. 填写配置：

| 字段 | 说明 | 示例 |
|------|------|------|
| 名称 | 自定义标识 | `My OpenAI` |
| 提供商 | 提供商标识 | `openai`、`anthropic`、`custom` |
| API 类型 | 接口协议 | `OpenAI Compatible`、`Anthropic`、`Google AI` |
| Base URL | API 端点 | `https://api.openai.com/v1` |
| API Key | 认证密钥 | `sk-...` |
| 模型 ID | 可用模型列表 | `gpt-4, gpt-4o, gpt-3.5-turbo` |

也可以点击 **获取模型** 从 API 自动拉取模型列表。

### 测试连接

在设置面板中配置完 Base URL 和 API Key 后，系统会自动校验连接有效性，支持针对不同 API 提供商的智能检测。

### 切换模型

在聊天输入框底部工具栏点击模型名称，即可在当前会话中切换模型。每个会话独立记录使用的模型。

## 📁 会话管理

### 创建工作区

1. 点击侧边栏 **新建工作区** 按钮
2. 在弹出的对话框中选择项目文件夹
3. 自动创建新会话并激活

### 会话操作

- **切换会话**：在侧边栏点击任意会话
- **重命名**：右键会话 → 重命名
- **删除**：点击会话旁的删除按钮
- **标签页**：切换会话自动添加标签，支持多标签快速切换

### 数据持久化

会话数据存储在：

```
# 会话元数据（名称、路径、模型等）
%APPDATA%/pair/session-metadata.json

# 会话完整消息历史
.pair/sessions/<session-id>/<session-file>.json
```

## 🏗 项目架构

```
Pair/
├── src/
│   ├── main/                        # Electron 主进程
│   │   ├── index.ts                 # 主进程入口 + 窗口管理
│   │   ├── agent-manager.ts         # Agent 引擎管理器（核心）
│   │   ├── ipc-handler.ts           # IPC 通信处理器
│   │   ├── notification.ts          # 系统通知管理器
│   │   └── preload.ts               # 安全上下文桥接
│   ├── renderer/                    # 渲染进程（React 前端）
│   │   ├── pages/                   # 页面组件
│   │   ├── components/              # UI 组件
│   │   │   ├── chat/                # 聊天相关组件
│   │   │   ├── modals/              # 弹窗组件
│   │   │   └── ui/                  # 基础 UI 组件
│   │   ├── hooks/                   # 自定义 Hooks
│   │   ├── contexts/                # React Context 状态管理
│   │   ├── lib/                     # 工具函数
│   │   └── utils/                   # 业务工具
│   ├── shared/                      # 共享类型定义
│   │   └── types.ts
│   ├── App.tsx                      # 根组件
│   ├── main.tsx                     # React 入口
│   └── index.css                    # 全局样式 + Tailwind CSS
├── docs/                            # 设计文档
└── build/                           # 构建资源
```

### 核心架构图

```
┌─────────────────────────────────────────────┐
│  渲染进程 (React UI)                         │
│  - ChatPage / SessionList / ChatArea         │
│  - hooks (useSessions/useMessages/useModels) │
│  - contexts (Model/Theme/MessageSettings)    │
├─────────────────────────────────────────────┤
│  preload.ts (contextBridge)                  │
│  - 白名单暴露安全 API 到渲染进程              │
├─────────────────────────────────────────────┤
│  IPC 通信层 (ipc-handler + ipc-client)       │
│  - invoke/handle 双向通信                    │
│  - 事件推送 (main → renderer)                │
├─────────────────────────────────────────────┤
│  Agent Manager (agent-manager.ts)            │
│  - 会话生命周期管理                          │
│  - 模型注册表 + 自定义模型                    │
│  - 元数据持久化                              │
├─────────────────────────────────────────────┤
│  pi SDK 核心                                 │
│  - @earendil-works/pi-coding-agent           │
│  - AgentSession / SessionManager / ModelReg. │
└─────────────────────────────────────────────┘
```

### 技术栈

| 类别 | 技术 |
|------|------|
| **桌面框架** | Electron 42 |
| **UI 框架** | React 19 + TypeScript 5 |
| **构建工具** | Vite 8 + Electron Builder |
| **CSS 方案** | Tailwind CSS 4 + CSS 变量主题 |
| **AI 引擎** | `@earendil-works/pi-coding-agent` |
| **UI 组件** | Radix UI（无样式可访问组件）|
| **Markdown** | react-markdown + remark-gfm |
| **代码高亮** | shiki + highlight.js |
| **图标** | Lucide React |
| **编辑** | TipTap 富文本编辑器 |
| **测试** | Vitest + Playwright |

## 💻 开发指南

### 脚本命令

```bash
npm run dev              # 仅前端 Vite 开发
npm run dev:electron     # 完整 Electron 开发环境
npm run build            # 编译 TS + Vite 构建
npm run lint             # ESLint 代码检查
npm test                 # 运行测试
npm run test:watch       # 监听模式测试
npm run test:coverage    # 测试覆盖率
npm run package:win      # 打包 Windows 安装包
```

### 进程架构

- **主进程**：窗口管理、Agent 引擎、文件操作、系统通知
- **渲染进程**：React UI、状态管理、事件订阅
- **preload**：通过 contextBridge 暴露安全的 API 白名单

通信方式通过 `ipcMain.handle` / `ipcRenderer.invoke` 实现双向调用，事件推送通过 `webContents.send` 实现。

### 目录约定

| 类型 | 规范 | 示例 |
|------|------|------|
| 组件 | PascalCase | `SessionList.tsx` |
| Hook | camelCase + use 前缀 | `useSessions.ts` |
| 工具函数 | camelCase | `formatTimestamp.ts` |
| 类型定义 | PascalCase | `SessionInfo` |
| 常量 | UPPER_SNAKE_CASE | `MAX_SESSIONS` |

### Contexts

| Context | 用途 | 持久化 |
|---------|------|--------|
| `ModelContext` | 模型提供方 CRUD | localStorage |
| `ThemeContext` | 7 套主题 + 深浅模式 + 字体 | localStorage |
| `MessageSettingsContext` | 消息显示设置 | localStorage |
| `GlobalStreamContext` | 多会话并行流式状态 | 内存 (ref) |
| `SessionStateContext` | 会话状态 (idle/streaming/completed) | 内存 |

## 🧪 测试

```bash
# 运行所有测试
npm test

# 监听模式
npm run test:watch

# 覆盖率报告
npm run test:coverage
```

测试文件位置：
- 主进程：`src/main/__tests__/*.test.ts`
- 渲染进程：`src/renderer/__tests__/*.test.tsx`

## 🏗 构建部署

### 打包命令

```bash
# Windows (NSIS 安装包)
npm run package:win

# macOS (DMG)
npm run package:mac

# Linux (AppImage)
npm run package:linux
```

打包配置详见 `electron-builder.json`，输出目录为 `release/`。

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支: `git checkout -b feat/amazing-feature`
3. 提交更改: `git commit -m 'feat: 添加了某功能'`
4. 推送到分支: `git push origin feat/amazing-feature`
5. 提交 Pull Request

### 提交规范

使用中文描述，格式如下：

```
feat: 新功能
fix: 修复
test: 测试
docs: 文档
refactor: 重构
chore: 构建/工具
```

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

---

<div align="center">
  <sub>Built with ❤️ using Electron, React & TypeScript</sub>
</div>
