# Pair - 通用AI助手PC客户端实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建一个通用AI助手PC客户端，使用Electron + TypeScript前端，后端基于@earendil-works/pi-coding-agent SDK

**Architecture:** 混合架构，核心逻辑在Electron主进程，长时间任务作为独立进程。使用pi SDK作为agent引擎，自定义Agent Manager作为桥梁。

**Tech Stack:** Electron, React, TypeScript, @earendil-works/pi-coding-agent, Vite, Vitest

---

## 项目初始化

### Task 1: 创建项目脚手架

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `electron-builder.json`

**Step 1: 使用Vite初始化项目**

```bash
npm create vite@latest Pair -- --template react-ts
cd Pair
npm install
```

**Step 2: 安装核心依赖**

```bash
npm install electron @earendil-works/pi-coding-agent
npm install -D electron-builder
```

**Step 3: 更新package.json**

```json
{
  "name": "Pair",
  "version": "1.0.0",
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "package": "electron-builder",
    "package:win": "electron-builder --win",
    "package:mac": "electron-builder --mac",
    "package:linux": "electron-builder --linux"
  }
}
```

**Step 4: 创建tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

**Step 5: 提交**

```bash
git init
git add .
git commit -m "feat: initialize project scaffolding"
```

### Task 2: 创建目录结构

**Files:**
- Create: `src/main/`
- Create: `src/renderer/`
- Create: `src/shared/`
- Create: `src/main/index.ts`
- Create: `src/renderer/index.tsx`

**Step 1: 创建目录**

```bash
mkdir -p src/main src/renderer src/shared
```

**Step 2: 创建主进程入口**

```typescript
// src/main/index.ts
import { app, BrowserWindow } from 'electron';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile('dist/renderer/index.html');
}

app.whenReady().then(createWindow);
```

**Step 3: 创建渲染进程入口**

```tsx
// src/renderer/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Step 4: 提交**

```bash
git add .
git commit -m "feat: create directory structure"
```

## Agent Manager核心

### Task 3: 实现Agent Manager基础

**Files:**
- Create: `src/main/agent-manager.ts`
- Create: `src/shared/types.ts`
- Test: `src/main/__tests__/agent-manager.test.ts`

**Step 1: 定义共享类型**

```typescript
// src/shared/types.ts
export interface SessionInfo {
  id: string;
  name: string;
  projectPath: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  model: string;
}

export interface ProjectSessions {
  projectPath: string;
  projectName: string;
  sessions: SessionInfo[];
}
```

**Step 2: 写失败的测试**

```typescript
// src/main/__tests__/agent-manager.test.ts
import { describe, it, expect } from 'vitest';
import { AgentManager } from '../agent-manager';

describe('AgentManager', () => {
  it('should create a new session', async () => {
    const manager = new AgentManager();
    const session = await manager.createSession({
      projectPath: '/test/project',
    });
    expect(session).toBeDefined();
    expect(session.id).toBeDefined();
  });
});
```

**Step 3: 运行测试验证失败**

```bash
npm test
```

Expected: FAIL with "AgentManager not defined"

**Step 4: 实现Agent Manager**

```typescript
// src/main/agent-manager.ts
import { createAgentSession, SessionManager } from '@earendil-works/pi-coding-agent';
import { SessionInfo, ProjectSessions } from '../shared/types';

export class AgentManager {
  private sessions: Map<string, any> = new Map();

  async createSession(options: { projectPath: string }): Promise<SessionInfo> {
    const { session } = await createAgentSession({
      sessionManager: SessionManager.inMemory(),
    });

    const sessionInfo: SessionInfo = {
      id: session.sessionId,
      name: 'New Session',
      projectPath: options.projectPath,
      createdAt: new Date(),
      updatedAt: new Date(),
      messageCount: 0,
      model: 'default',
    };

    this.sessions.set(session.sessionId, { session, info: sessionInfo });
    return sessionInfo;
  }
}
```

**Step 5: 运行测试验证通过**

```bash
npm test
```

Expected: PASS

**Step 6: 提交**

```bash
git add .
git commit -m "feat: implement Agent Manager base"
```

### Task 4: 实现会话列表功能

**Files:**
- Modify: `src/main/agent-manager.ts`
- Test: `src/main/__tests__/agent-manager.test.ts`

**Step 1: 写失败的测试**

```typescript
// 在agent-manager.test.ts中添加
it('should list sessions by project', async () => {
  const manager = new AgentManager();
  
  await manager.createSession({ projectPath: '/project1' });
  await manager.createSession({ projectPath: '/project1' });
  await manager.createSession({ projectPath: '/project2' });
  
  const sessions = await manager.listSessions();
  expect(sessions).toHaveLength(2);
  expect(sessions[0].sessions).toHaveLength(2);
  expect(sessions[1].sessions).toHaveLength(1);
});
```

**Step 2: 运行测试验证失败**

```bash
npm test
```

Expected: FAIL with "listSessions not defined"

**Step 3: 实现会话列表**

```typescript
// 在agent-manager.ts中添加
async listSessions(): Promise<ProjectSessions[]> {
  const projectMap = new Map<string, SessionInfo[]>();
  
  for (const { info } of this.sessions.values()) {
    const sessions = projectMap.get(info.projectPath) || [];
    sessions.push(info);
    projectMap.set(info.projectPath, sessions);
  }
  
  return Array.from(projectMap.entries()).map(([projectPath, sessions]) => ({
    projectPath,
    projectName: projectPath.split('/').pop() || '',
    sessions,
  }));
}
```

**Step 4: 运行测试验证通过**

```bash
npm test
```

Expected: PASS

**Step 5: 提交**

```bash
git add .
git commit -m "feat: implement session listing by project"
```

## IPC通信层

### Task 5: 实现IPC通信

**Files:**
- Create: `src/main/ipc-handler.ts`
- Create: `src/renderer/ipc-client.ts`
- Modify: `src/main/index.ts`

**Step 1: 创建IPC处理器**

```typescript
// src/main/ipc-handler.ts
import { ipcMain } from 'electron';
import { AgentManager } from './agent-manager';

export class IPCHandler {
  private agentManager: AgentManager;

  constructor(agentManager: AgentManager) {
    this.agentManager = agentManager;
    this.registerHandlers();
  }

  private registerHandlers() {
    ipcMain.handle('session:create', async (event, options) => {
      return await this.agentManager.createSession(options);
    });

    ipcMain.handle('session:list', async () => {
      return await this.agentManager.listSessions();
    });
  }
}
```

**Step 2: 创建IPC客户端**

```typescript
// src/renderer/ipc-client.ts
import { ipcRenderer } from 'electron';
import { SessionInfo, ProjectSessions } from '../shared/types';

export class IPCClient {
  async createSession(options: { projectPath: string }): Promise<SessionInfo> {
    return await ipcRenderer.invoke('session:create', options);
  }

  async listSessions(): Promise<ProjectSessions[]> {
    return await ipcRenderer.invoke('session:list');
  }
}
```

**Step 3: 集成到主进程**

```typescript
// 修改src/main/index.ts
import { app, BrowserWindow } from 'electron';
import { AgentManager } from './agent-manager';
import { IPCHandler } from './ipc-handler';

const agentManager = new AgentManager();
const ipcHandler = new IPCHandler(agentManager);

function createWindow() {
  // ... 原有代码
}
```

**Step 4: 提交**

```bash
git add .
git commit -m "feat: implement IPC communication layer"
```

## UI组件

### Task 6: 创建基础UI组件

**Files:**
- Create: `src/renderer/App.tsx`
- Create: `src/renderer/components/SessionList.tsx`
- Create: `src/renderer/components/ChatArea.tsx`

**Step 1: 创建App组件**

```tsx
// src/renderer/App.tsx
import React from 'react';
import SessionList from './components/SessionList';
import ChatArea from './components/ChatArea';

export default function App() {
  return (
    <div className="app">
      <div className="sidebar">
        <SessionList />
      </div>
      <div className="main">
        <ChatArea />
      </div>
    </div>
  );
}
```

**Step 2: 创建SessionList组件**

```tsx
// src/renderer/components/SessionList.tsx
import React, { useEffect, useState } from 'react';
import { IPCClient } from '../ipc-client';
import { ProjectSessions } from '../../shared/types';

const ipcClient = new IPCClient();

export default function SessionList() {
  const [projects, setProjects] = useState<ProjectSessions[]>([]);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const sessions = await ipcClient.listSessions();
    setProjects(sessions);
  };

  return (
    <div className="session-list">
      <h2>会话列表</h2>
      {projects.map((project) => (
        <div key={project.projectPath} className="project">
          <h3>{project.projectName}</h3>
          {project.sessions.map((session) => (
            <div key={session.id} className="session">
              {session.name}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

**Step 3: 创建ChatArea组件**

```tsx
// src/renderer/components/ChatArea.tsx
import React from 'react';

export default function ChatArea() {
  return (
    <div className="chat-area">
      <div className="messages">
        {/* 消息列表 */}
      </div>
      <div className="input">
        <textarea placeholder="输入消息..." />
      </div>
    </div>
  );
}
```

**Step 4: 提交**

```bash
git add .
git commit -m "feat: create basic UI components"
```

## 测试和优化

### Task 7: 添加单元测试

**Files:**
- Create: `src/main/__tests__/ipc-handler.test.ts`
- Create: `src/renderer/__tests__/SessionList.test.tsx`

**Step 1: 测试IPC处理器**

```typescript
// src/main/__tests__/ipc-handler.test.ts
import { describe, it, expect, vi } from 'vitest';
import { IPCHandler } from '../ipc-handler';

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

describe('IPCHandler', () => {
  it('should register handlers', () => {
    const mockManager = {
      createSession: vi.fn(),
      listSessions: vi.fn(),
    };
    
    const handler = new IPCHandler(mockManager as any);
    expect(handler).toBeDefined();
  });
});
```

**Step 2: 运行测试**

```bash
npm test
```

**Step 3: 提交**

```bash
git add .
git commit -m "test: add unit tests for IPC handler"
```

## 打包和发布

### Task 8: 配置Electron Builder

**Files:**
- Modify: `electron-builder.json`
- Modify: `package.json`

**Step 1: 创建electron-builder配置**

```json
{
  "appId": "com.pair",
  "productName": "Pair",
  "directories": {
    "output": "release"
  },
  "files": [
    "dist/**/*",
    "package.json"
  ],
  "win": {
    "target": ["nsis"],
    "icon": "build/icon.ico"
  },
  "mac": {
    "target": ["dmg"],
    "icon": "build/icon.icns"
  },
  "linux": {
    "target": ["AppImage"],
    "icon": "build/icon.png"
  }
}
```

**Step 2: 更新package.json脚本**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "package": "electron-builder",
    "package:win": "electron-builder --win",
    "package:mac": "electron-builder --mac",
    "package:linux": "electron-builder --linux"
  }
}
```

**Step 3: 提交**

```bash
git add .
git commit -m "feat: configure electron-builder for packaging"
```

## 下一步执行

**Plan complete and saved to `docs/plans/2026-05-14-agent-pc-client-implementation.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
