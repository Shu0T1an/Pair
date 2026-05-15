# Pair - 通用AI助手PC客户端设计文档

## 项目概述

构建一个通用AI助手PC客户端，使用Electron + TypeScript前端，后端基于@earendil-works/pi-coding-agent SDK实现agent管理和逻辑。

## 技术栈

- **前端**: Electron + React/Vue + TypeScript
- **后端**: TypeScript (Node.js)
- **Agent SDK**: @earendil-works/pi-coding-agent
- **构建工具**: Vite + Electron Builder
- **测试**: Vitest + Playwright

## 架构设计

### 整体架构（混合方案）

```
┌─────────────────────────────────────────────────────────┐
│                    Electron 应用                        │
├─────────────────────────────────────────────────────────┤
│  渲染进程 (前端)                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  聊天界面   │  │  文件浏览器 │  │  工具面板   │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
├─────────────────────────────────────────────────────────┤
│  主进程 (后端)                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Agent Manager (自定义层)                        │   │
│  │  - 会话生命周期管理                              │   │
│  │  - 工具注册和调度                                │   │
│  │  - 扩展加载和管理                                │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  pi SDK 核心                                     │   │
│  │  - AgentSession                                  │   │
│  │  - ModelRegistry                                 │   │
│  │  - SessionManager                                │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 核心组件

#### 1. Agent Manager

Agent Manager是连接Electron和pi SDK的桥梁。

**会话生命周期管理**
```typescript
interface AgentManager {
  createSession(options?: SessionOptions): Promise<AgentSession>;
  resumeSession(sessionId: string): Promise<AgentSession>;
  getCurrentSession(): AgentSession | null;
  listSessions(): Promise<ProjectSessions[]>;
  deleteSession(sessionId: string): Promise<void>;
}
```

**工具注册和调度**
```typescript
interface ToolRegistry {
  registerTool(tool: ToolDefinition): void;
  getTools(): ToolDefinition[];
  getToolsByCategory(category: string): ToolDefinition[];
}
```

**扩展加载和管理**
```typescript
interface ExtensionManager {
  loadExtension(path: string): Promise<void>;
  unloadExtension(name: string): void;
  getExtensions(): Extension[];
}
```

#### 2. UI组件设计

**主界面布局**
```
┌─────────────────────────────────────────────────────────┐
│  标题栏 - 会话名称、模型选择、设置                      │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│  侧边栏      │  主聊天区域                              │
│  - 会话列表  │  - 消息流                                │
│  - 文件树    │  - 工具调用可视化                        │
│  - 工具面板  │  - 代码高亮                              │
│              │                                          │
│              ├──────────────────────────────────────────┤
│              │  输入区域 - 多行编辑器、文件附件          │
└──────────────┴──────────────────────────────────────────┘
```

**核心UI组件**
- **MessageList**: 消息流，支持Markdown渲染、代码高亮
- **ToolCallVisualizer**: 工具调用可视化
- **InputEditor**: 多行输入编辑器
- **SessionList**: 会话列表（按项目分组）
- **FileTree**: 文件浏览器
- **ModelSelector**: 模型选择器

#### 3. 会话管理设计

**层级结构**
```
项目（工作目录）
├── 会话1 - "修复登录bug"
├── 会话2 - "添加用户管理功能"
├── 会话3 - "重构数据库层"
└── 会话4 - "编写单元测试"
```

**数据结构**
```typescript
interface ProjectSessions {
  projectPath: string;
  projectName: string;
  sessions: SessionInfo[];
}

interface SessionInfo {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  model: string;
  summary?: string;
}
```

#### 4. 工具调用UI设计

**折叠状态（默认）**
```
┌─────────────────────────────────────────────────────────┐
│  🔧 已运行 3 条执行                                      │
│     ▶ 点击展开查看详情                                   │
└─────────────────────────────────────────────────────────┘
```

**展开状态**
```
┌─────────────────────────────────────────────────────────┐
│  🔧 已运行 3 条执行                                      │
│     ▼ 点击收起                                           │
├─────────────────────────────────────────────────────────┤
│  1. ✅ read_file - /src/index.ts                        │
│  2. ✅ write_file - /src/utils.ts                       │
│  3. ⏳ bash - npm install                               │
└─────────────────────────────────────────────────────────┘
```

**状态图标**
- ⏳ 执行中
- ✅ 执行成功
- ❌ 执行失败
- ⚠️ 需要确认

### 数据流和通信机制

#### IPC通信架构
```
渲染进程 (前端)                    主进程 (后端)
┌─────────────────┐               ┌─────────────────┐
│  React/Vue UI   │               │  Agent Manager  │
│                 │   IPC调用      │                 │
│  - 发送消息     │──────────────▶│  - 处理请求     │
│  - 获取状态     │◀──────────────│  - 返回结果     │
│  - 订阅事件     │   事件推送     │  - 发送事件     │
└─────────────────┘               └─────────────────┘
```

#### IPC通道设计

**请求/响应通道**
```typescript
interface AgentAPI {
  session: {
    create(options?: SessionOptions): Promise<SessionInfo>;
    resume(sessionId: string): Promise<SessionInfo>;
    list(): Promise<ProjectSessions[]>;
    delete(sessionId: string): Promise<void>;
    rename(sessionId: string, name: string): Promise<void>;
  };
  
  message: {
    send(text: string, options?: MessageOptions): Promise<void>;
    abort(): Promise<void>;
    steer(text: string): Promise<void>;
    followUp(text: string): Promise<void>;
  };
  
  model: {
    list(): Promise<ModelInfo[]>;
    getCurrent(): Promise<ModelInfo>;
    set(modelId: string): Promise<void>;
    cycle(): Promise<void>;
  };
  
  settings: {
    get(): Promise<Settings>;
    update(settings: Partial<Settings>): Promise<void>;
  };
}
```

**事件订阅通道**
```typescript
interface AgentEvents {
  'message:update': (event: MessageUpdateEvent) => void;
  'message:start': (event: MessageStartEvent) => void;
  'message:end': (event: MessageEndEvent) => void;
  
  'tool:start': (event: ToolStartEvent) => void;
  'tool:update': (event: ToolUpdateEvent) => void;
  'tool:end': (event: ToolEndEvent) => void;
  
  'session:created': (event: SessionCreatedEvent) => void;
  'session:switched': (event: SessionSwitchedEvent) => void;
  
  'status:streaming': (isStreaming: boolean) => void;
  'status:error': (error: ErrorEvent) => void;
}
```

### 扩展系统（混合方案）

#### 架构
```
┌─────────────────────────────────────────────────────────┐
│                    扩展系统                              │
├─────────────────────────────────────────────────────────┤
│  pi原生扩展层                                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  技能扩展   │  │  工具扩展   │  │  命令扩展   │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
├─────────────────────────────────────────────────────────┤
│  自定义UI扩展层                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  面板扩展   │  │  主题扩展   │  │  布局扩展   │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
```

#### 内置工具（pi原生）
- read, write, edit (文件操作)
- grep, find, ls (搜索)
- bash (执行)

#### 自定义工具（桌面端特有）
- file_explorer: 文件浏览
- system_info: 系统信息
- clipboard: 剪贴板操作

### 错误处理

#### 错误分类
```typescript
enum ErrorCategory {
  NETWORK = 'network',
  AUTH = 'auth',
  SESSION = 'session',
  MODEL = 'model',
  TOOL = 'tool',
  IPC = 'ipc',
  UI = 'ui',
  FILE = 'file',
}
```

#### 恢复策略
- 网络错误：重试机制
- 认证错误：提示重新登录
- 会话错误：尝试恢复或新建会话
- 工具错误：跳过或重试

### 测试策略

| 测试类型 | 工具 | 覆盖率目标 |
|---------|------|-----------|
| 单元测试 | Vitest | 80%+ |
| 集成测试 | Vitest + Electron | 70%+ |
| E2E测试 | Playwright | 核心流程100% |

### 部署和分发

#### 安装包格式
| 平台 | 格式 |
|------|------|
| Windows | .exe, .msi |
| macOS | .dmg, .pkg |
| Linux | .AppImage, .deb, .rpm |

#### 自动更新
- 使用electron-updater
- 支持GitHub Releases或自建服务器
- 增量更新减少下载量

#### 预期安装包大小
- ~150-200MB (各平台)

## 下一步

1. 创建项目脚手架
2. 实现Agent Manager核心
3. 开发UI组件
4. 集成pi SDK
5. 测试和优化
6. 打包和发布
