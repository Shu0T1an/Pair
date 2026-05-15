import type { SessionInfo, ProjectSessions } from '@/shared/types';

// 事件数据类型定义
export interface MessageStartEvent {
  sessionId: string;
  messageId: string;
  timestamp: Date;
}

export interface TextDeltaEvent {
  sessionId: string;
  messageId: string;
  delta: string;
  timestamp: Date;
}

export interface ThinkingDeltaEvent {
  sessionId: string;
  messageId: string;
  delta: string;
  timestamp: Date;
}

export interface MessageEndEvent {
  sessionId: string;
  messageId: string;
  usage?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    totalTokens: number;
    cost: {
      input: number;
      output: number;
      cacheRead: number;
      cacheWrite: number;
      total: number;
    };
  };
  timestamp: Date;
}

export interface ToolStartEvent {
  sessionId: string;
  toolName: string;
  toolCallId: string;
  args: Record<string, unknown>;
  timestamp: Date;
}

export interface ToolUpdateEvent {
  sessionId: string;
  toolCallId: string;
  output: string;
  timestamp: Date;
}

export interface ToolEndEvent {
  sessionId: string;
  toolCallId: string;
  result: string;
  isError: boolean;
  timestamp: Date;
}

export interface AgentStartEvent {
  sessionId: string;
  timestamp: Date;
}

export interface AgentEndEvent {
  sessionId: string;
  messages: any[];
  timestamp: Date;
}

// 定义 Electron API 类型
interface ElectronAPI {
  // 窗口控制
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  
  // 平台信息
  platform: string;
  
  // 版本信息
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };

  // 会话管理
  session: {
    create: (options: { projectPath: string; name?: string; modelId?: string }) => Promise<SessionInfo>;
    list: () => Promise<ProjectSessions[]>;
    delete: (sessionId: string) => Promise<void>;
    info: (sessionId: string) => Promise<SessionInfo | undefined>;
    update: (sessionId: string, updates: Partial<SessionInfo>) => Promise<void>;
    messages: (sessionId: string) => Promise<any[]>;
  };

  // 消息处理
  message: {
    send: (sessionId: string, text: string, modelConfig?: string | { provider: string; baseUrl: string; apiKey: string; modelId: string; modelName?: string; api?: string }) => Promise<void>;
    abort: (sessionId: string) => Promise<void>;
  };

  // 模型管理
  model: {
    list: () => Promise<any[]>;
    current: (sessionId: string) => Promise<string | undefined>;
    set: (sessionId: string, modelId: string, modelConfig?: string | { provider: string; baseUrl: string; apiKey: string; modelId: string; modelName?: string; api?: string }) => Promise<void>;
    testConnection: (options: { provider: string; baseUrl: string; apiKey: string }) => Promise<{ success: boolean; error?: string }>;
    setApiKey: (provider: string, apiKey: string) => Promise<void>;
    removeApiKey: (provider: string) => Promise<void>;
    syncConfig: (config: { provider: string; baseUrl: string; apiKey: string; models: Array<{ id: string; name?: string }> }) => Promise<void>;
    removeConfig: (provider: string) => Promise<void>;
  };

  // 事件订阅
  on: (channel: string, callback: (...args: any[]) => void) => () => void;
}

// 声明全局变量
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

/**
 * IPC 客户端 - 渲染进程与主进程通信的桥梁
 */
export class IPCClient {
  private listeners: Map<string, () => void> = new Map();

  /**
   * 检查是否在 Electron 环境中
   */
  private isElectron(): boolean {
    return typeof window !== 'undefined' && window.electronAPI !== undefined;
  }

  /**
   * 创建会话
   */
  async createSession(options: { projectPath: string; name?: string; modelId?: string }): Promise<SessionInfo> {
    if (!this.isElectron()) {
      // 非 Electron 环境，返回模拟数据
      console.warn('非 Electron 环境，返回模拟数据');
      return {
        id: `session-${Date.now()}`,
        projectPath: options.projectPath,
        name: options.name || '新会话',
        createdAt: new Date(),
      } as SessionInfo;
    }
    return window.electronAPI.session.create(options);
  }

  /**
   * 列出会话
   */
  async listSessions(): Promise<ProjectSessions[]> {
    if (!this.isElectron()) {
      console.warn('非 Electron 环境，返回空数组');
      return [];
    }
    return window.electronAPI.session.list();
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<void> {
    if (!this.isElectron()) {
      console.warn('非 Electron 环境，跳过删除');
      return;
    }
    return window.electronAPI.session.delete(sessionId);
  }

  /**
   * 获取会话信息
   */
  async getSessionInfo(sessionId: string): Promise<SessionInfo | undefined> {
    if (!this.isElectron()) {
      console.warn('非 Electron 环境，返回 undefined');
      return undefined;
    }
    return window.electronAPI.session.info(sessionId);
  }

  /**
   * 更新会话信息
   */
  async updateSession(sessionId: string, updates: Partial<SessionInfo>): Promise<void> {
    if (!this.isElectron()) {
      console.warn('非 Electron 环境，跳过更新');
      return;
    }
    return window.electronAPI.session.update(sessionId, updates);
  }

  /**
   * 获取会话历史消息
   */
  async getSessionMessages(sessionId: string): Promise<any[]> {
    if (!this.isElectron()) {
      console.warn('非 Electron 环境，返回空数组');
      return [];
    }
    return window.electronAPI.session.messages(sessionId);
  }

  /**
   * 发送消息
   * @param sessionId 会话ID
   * @param text 消息内容
   * @param modelConfig 可选的模型配置，支持两种格式：
   *   - 字符串: modelId (从 ModelRegistry 查找)
   *   - 对象: { provider, baseUrl, apiKey, modelId } (直接构造 Model)
   */
  async sendMessage(
    sessionId: string, 
    text: string, 
    modelConfig?: string | {
      provider: string;
      baseUrl: string;
      apiKey: string;
      modelId: string;
      modelName?: string;
      api?: string;
    }
  ): Promise<void> {
    if (!this.isElectron()) {
      console.warn('非 Electron 环境，跳过发送');
      return;
    }
    return window.electronAPI.message.send(sessionId, text, modelConfig);
  }

  /**
   * 中止消息
   */
  async abortMessage(sessionId: string): Promise<void> {
    if (!this.isElectron()) {
      console.warn('非 Electron 环境，跳过中止');
      return;
    }
    return window.electronAPI.message.abort(sessionId);
  }

  /**
   * 获取可用模型列表
   */
  async listModels(): Promise<any[]> {
    if (!this.isElectron()) {
      console.warn('非 Electron 环境，返回空数组');
      return [];
    }
    return window.electronAPI.model.list();
  }

  /**
   * 获取当前模型
   */
  async getCurrentModel(sessionId: string): Promise<string | undefined> {
    if (!this.isElectron()) {
      console.warn('非 Electron 环境，返回 undefined');
      return undefined;
    }
    return window.electronAPI.model.current(sessionId);
  }

  /**
   * 设置模型
   * @param sessionId 会话ID
   * @param modelId 模型ID
   * @param modelConfig 可选的模型配置，支持两种格式：
   *   - 字符串: modelId (从 ModelRegistry 查找)
   *   - 对象: { provider, baseUrl, apiKey, modelId } (直接构造 Model)
   */
  async setModel(
    sessionId: string, 
    modelId: string, 
    modelConfig?: string | {
      provider: string;
      baseUrl: string;
      apiKey: string;
      modelId: string;
      modelName?: string;
      api?: string;
    }
  ): Promise<void> {
    if (!this.isElectron()) {
      console.warn('非 Electron 环境，跳过设置');
      return;
    }
    return window.electronAPI.model.set(sessionId, modelId, modelConfig);
  }

  /**
   * 测试 API 连接
   */
  async testConnection(options: {
    provider: string;
    baseUrl: string;
    apiKey: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (!this.isElectron()) {
      console.warn('非 Electron 环境，模拟测试连接');
      // 模拟测试：只要有 API Key 就认为成功
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { success: !!options.apiKey };
    }
    return window.electronAPI.model.testConnection(options);
  }

  /**
   * 设置运行时 API Key
   */
  async setApiKey(provider: string, apiKey: string): Promise<void> {
    if (!this.isElectron()) {
      console.warn('非 Electron 环境，跳过设置 API Key');
      return;
    }
    return window.electronAPI.model.setApiKey(provider, apiKey);
  }

  /**
   * 移除运行时 API Key
   */
  async removeApiKey(provider: string): Promise<void> {
    if (!this.isElectron()) {
      console.warn('非 Electron 环境，跳过移除 API Key');
      return;
    }
    return window.electronAPI.model.removeApiKey(provider);
  }

  /**
   * 同步模型配置到 models.json
   */
  async syncModelConfig(config: {
    provider: string;
    baseUrl: string;
    apiKey: string;
    models: Array<{ id: string; name?: string }>;
  }): Promise<void> {
    if (!this.isElectron()) {
      console.warn('非 Electron 环境，跳过同步模型配置');
      return;
    }
    return window.electronAPI.model.syncConfig(config);
  }

  /**
   * 从 models.json 移除配置
   */
  async removeModelConfig(provider: string): Promise<void> {
    if (!this.isElectron()) {
      console.warn('非 Electron 环境，跳过移除模型配置');
      return;
    }
    return window.electronAPI.model.removeConfig(provider);
  }

  // 便捷事件监听方法
  onMessageStart(callback: (event: MessageStartEvent) => void): () => void {
    return this.on('agent:message_start', callback);
  }

  onTextDelta(callback: (event: TextDeltaEvent) => void): () => void {
    return this.on('agent:text_delta', callback);
  }

  onThinkingDelta(callback: (event: ThinkingDeltaEvent) => void): () => void {
    return this.on('agent:thinking_delta', callback);
  }

  onMessageEnd(callback: (event: MessageEndEvent) => void): () => void {
    return this.on('agent:message_end', callback);
  }

  onToolStart(callback: (event: ToolStartEvent) => void): () => void {
    return this.on('agent:tool_start', callback);
  }

  onToolUpdate(callback: (event: ToolUpdateEvent) => void): () => void {
    return this.on('agent:tool_update', callback);
  }

  onToolEnd(callback: (event: ToolEndEvent) => void): () => void {
    return this.on('agent:tool_end', callback);
  }

  onAgentStart(callback: (event: AgentStartEvent) => void): () => void {
    return this.on('agent:agent_start', callback);
  }

  onAgentEnd(callback: (event: AgentEndEvent) => void): () => void {
    return this.on('agent:agent_end', callback);
  }

  /**
   * 订阅事件
   */
  on(channel: string, callback: (...args: any[]) => void): () => void {
    if (!this.isElectron()) {
      console.warn('非 Electron 环境，跳过事件订阅');
      return () => {};
    }
    const unsubscribe = window.electronAPI.on(channel, callback);
    this.listeners.set(channel, unsubscribe);
    return unsubscribe;
  }

  /**
   * 取消订阅
   */
  off(channel: string): void {
    const unsubscribe = this.listeners.get(channel);
    if (unsubscribe) {
      unsubscribe();
      this.listeners.delete(channel);
    }
  }

  /**
   * 取消所有订阅
   */
  removeAllListeners(): void {
    this.listeners.forEach((unsubscribe) => unsubscribe());
    this.listeners.clear();
  }

  /**
   * 获取平台信息
   */
  get platform(): string {
    return window.electronAPI.platform;
  }

  /**
   * 获取版本信息
   */
  get versions() {
    return window.electronAPI.versions;
  }

  /**
   * 窗口控制
   */
  async minimizeWindow(): Promise<void> {
    if (!this.isElectron()) {
      console.warn('非 Electron 环境，跳过最小化');
      return;
    }
    return window.electronAPI.minimize();
  }

  async maximizeWindow(): Promise<void> {
    if (!this.isElectron()) {
      console.warn('非 Electron 环境，跳过最大化');
      return;
    }
    return window.electronAPI.maximize();
  }

  async closeWindow(): Promise<void> {
    if (!this.isElectron()) {
      console.warn('非 Electron 环境，跳过关闭');
      return;
    }
    return window.electronAPI.close();
  }
}

// 创建单例实例
export const ipcClient = new IPCClient();