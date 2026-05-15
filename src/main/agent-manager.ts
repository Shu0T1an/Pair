import { 
  createAgentSession, 
  SessionManager, 
  AuthStorage, 
  ModelRegistry,
  type AgentSession,
  type CreateAgentSessionOptions
} from '@earendil-works/pi-coding-agent';
import type { Model, Api } from '@earendil-works/pi-ai';
import { EventEmitter } from 'events';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import type { SessionInfo, ProjectSessions } from '../shared/types';

// 自定义模型配置接口
interface CustomModelConfig {
  id: string;
  name?: string;
  reasoning?: boolean;
  input?: string[];
  contextWindow?: number;
  maxTokens?: number;
  cost?: { input: number; output: number; cacheRead: number; cacheWrite: number };
}

// 上下文使用情况接口
export interface ContextUsage {
  usedTokens: number;      // 已使用的 tokens
  totalTokens: number;     // 总上下文窗口大小
  percentage: number;      // 使用百分比 (0-100)
  lastUsageId?: string;    // 最后一次有 usage 数据的消息 ID
}

interface CustomProviderConfig {
  baseUrl: string;
  api: string;
  apiKey: string;
  models: CustomModelConfig[];
}

interface ModelsJsonConfig {
  providers: Record<string, CustomProviderConfig>;
}

interface SessionEntry {
  session: AgentSession;
  info: SessionInfo;
  unsubscribe?: () => void;
}

// 会话元数据存储文件
const METADATA_FILE = 'session-metadata.json';

export class AgentManager extends EventEmitter {
  private sessions: Map<string, SessionEntry> = new Map();
  private currentMessageIds: Map<string, string> = new Map();
  private authStorage: AuthStorage;
  private modelRegistry: ModelRegistry;
  private metadataPath: string;
  private modelsJsonPath: string;
  private sessionMetadata: Map<string, SessionInfo> = new Map();

  constructor() {
    super();
    this.authStorage = AuthStorage.create();
    this.modelRegistry = ModelRegistry.create(this.authStorage);
    
    // 设置元数据存储路径
    const userDataPath = app.getPath('userData');
    this.metadataPath = path.join(userDataPath, METADATA_FILE);
    
    // 设置 models.json 路径
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    this.modelsJsonPath = path.join(homeDir, '.pi', 'agent', 'models.json');
    
    // 加载已有的会话元数据
    this.loadMetadata();
  }

  /**
   * 加载会话元数据
   */
  private loadMetadata(): void {
    try {
      if (fs.existsSync(this.metadataPath)) {
        const data = fs.readFileSync(this.metadataPath, 'utf-8');
        const metadata = JSON.parse(data);
        for (const [id, info] of Object.entries(metadata)) {
          this.sessionMetadata.set(id, info as SessionInfo);
        }
        console.log(`加载了 ${this.sessionMetadata.size} 个会话元数据`);
      }
    } catch (error) {
      console.error('加载会话元数据失败:', error);
    }
  }

  /**
   * 保存会话元数据
   */
  private saveMetadata(): void {
    try {
      const metadata: Record<string, SessionInfo> = {};
      for (const [id, info] of this.sessionMetadata.entries()) {
        metadata[id] = info;
      }
      // 确保目录存在
      const dir = path.dirname(this.metadataPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
    } catch (error) {
      console.error('保存会话元数据失败:', error);
    }
  }

  /**
   * 创建新的会话（持久化）
   */
  async createSession(options: { projectPath: string; name?: string; modelId?: string }): Promise<SessionInfo> {
    // 使用 SessionManager.create() 启用持久化
    const sessionManager = SessionManager.create(options.projectPath);
    
    const sessionOptions: CreateAgentSessionOptions = {
      sessionManager,
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      cwd: options.projectPath,
    };

    const { session } = await createAgentSession(sessionOptions);

    // 生成会话名称: 新会话-YYMMDD
    const now = new Date();
    const dateStr = `${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
    const defaultName = `新会话-${dateStr}`;
    
    const sessionInfo: SessionInfo = {
      id: session.sessionId,
      name: options.name || defaultName,
      projectPath: options.projectPath,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      model: session.model?.id || 'unknown',
      sessionFile: session.sessionManager.getSessionFile(),
    };

    // 保存到内存和元数据
    this.sessions.set(session.sessionId, { session, info: sessionInfo });
    this.sessionMetadata.set(session.sessionId, sessionInfo);
    this.saveMetadata();
    this.setupSessionEventHandlers(session.sessionId);
    
    return sessionInfo;
  }

  /**
   * 恢复已有的会话
   */
  async resumeSession(sessionId: string): Promise<AgentSession> {
    // 如果会话已经在内存中，直接返回
    const entry = this.sessions.get(sessionId);
    if (entry) {
      return entry.session;
    }

    // 从元数据中获取会话信息
    const metadata = this.sessionMetadata.get(sessionId);
    if (!metadata || !metadata.sessionFile) {
      throw new Error(`会话 ${sessionId} 不存在或没有会话文件`);
    }

    // 打开已有的会话文件
    const sessionManager = SessionManager.open(metadata.sessionFile);
    
    const sessionOptions: CreateAgentSessionOptions = {
      sessionManager,
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      cwd: metadata.projectPath,
    };

    const { session } = await createAgentSession(sessionOptions);

    // 更新元数据
    metadata.updatedAt = new Date();
    metadata.messageCount = session.messages.length;

    // 保存到内存
    this.sessions.set(sessionId, { session, info: metadata });
    this.setupSessionEventHandlers(sessionId);
    
    return session;
  }

  /**
   * 获取当前会话信息
   */
  getSessionInfo(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId)?.info || this.sessionMetadata.get(sessionId);
  }

  /**
   * 列出所有会话（按项目分组）
   */
  async listSessions(): Promise<ProjectSessions[]> {
    const projectMap = new Map<string, SessionInfo[]>();

    // 使用元数据（包含持久化的会话）
    for (const info of this.sessionMetadata.values()) {
      const sessions = projectMap.get(info.projectPath) || [];
      sessions.push(info);
      projectMap.set(info.projectPath, sessions);
    }

    return Array.from(projectMap.entries()).map(([projectPath, sessions]) => ({
      projectPath,
      projectName: projectPath.split('/').pop() || projectPath.split('\\').pop() || '',
      // 按更新时间降序排列，新创建的会话排在最前面
      sessions: sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    }));
  }

  /**
   * 获取会话的历史消息
   */
  getMessages(sessionId: string): any[] {
    const entry = this.sessions.get(sessionId);
    if (entry) {
      return this.extractMessagesFromSession(entry.session, sessionId);
    }
    
    // 会话不在内存中，尝试从文件轻量级读取
    return this.getMessagesFromFile(sessionId);
  }

  /**
   * 从会话文件轻量级读取消息（不需要创建完整 AgentSession）
   */
  getMessagesFromFile(sessionId: string): any[] {
    const metadata = this.sessionMetadata.get(sessionId);
    if (!metadata?.sessionFile) return [];

    try {
      // 使用 SessionManager.open() 打开会话文件，然后使用 buildSessionContext() 获取消息
      const sessionManager = SessionManager.open(metadata.sessionFile);
      const sessionContext = sessionManager.buildSessionContext();
      return this.convertAgentMessages(sessionContext.messages, sessionId);
    } catch (error) {
      console.error('从文件读取消息失败:', error);
      return [];
    }
  }

  /**
   * 从已加载的 AgentSession 提取消息
   */
  private extractMessagesFromSession(session: AgentSession, sessionId: string): any[] {
    const messages = session.messages;
    return this.convertAgentMessages(messages, sessionId);
  }

  /**
   * 将 AgentMessage[] 转换为 UI 消息格式
   */
  private convertAgentMessages(messages: any[], sessionId: string): any[] {
    const result: any[] = [];
    
    // 先收集所有 toolResult 消息，按 toolCallId 索引
    const toolResults = new Map<string, { result: string; isError: boolean }>();
    for (const msg of messages) {
      if (msg.role === 'toolResult') {
        const resultContent = this.extractMessageContent(msg);
        toolResults.set(msg.toolCallId, {
          result: resultContent,
          isError: msg.isError || false,
        });
      }
    }
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const msgId = `msg_${sessionId}_${i}`;
      if (msg.role === 'user') {
        result.push({
          id: msgId,
          role: 'user',
          content: this.extractMessageContent(msg),
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
        });
      } else if (msg.role === 'assistant') {
        // 从 assistant 消息中提取文本、thinking 和工具调用
        const { text, thinking, toolCalls } = this.extractAssistantContent(msg);
        
        // 将 toolResult 关联到对应的工具调用
        const enrichedToolCalls = toolCalls.map(tc => {
          const toolResult = toolResults.get(tc.id);
          return {
            ...tc,
            result: toolResult?.result,
            error: toolResult?.isError ? toolResult.result : undefined,
            status: toolResult ? (toolResult.isError ? 'error' : 'success') : 'success',
          };
        });
        
        // 提取 usage 数据
        const usage = 'usage' in msg ? msg.usage : undefined;
        
        result.push({
          id: msgId,
          role: 'assistant',
          content: text,
          thinking: thinking || undefined,
          toolCalls: enrichedToolCalls.length > 0 ? enrichedToolCalls : undefined,
          usage: usage ? {
            promptTokens: usage.input,
            completionTokens: usage.output,
            totalTokens: usage.totalTokens,
            cacheCreationInputTokens: usage.cacheWrite,
            cacheReadInputTokens: usage.cacheRead,
          } : undefined,
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
        });
      } else if (msg.role === 'toolResult') {
        // 工具结果消息 - 跳过，已关联到工具调用
        continue;
      }
    }
    
    return result;
  }

  /**
   * 提取消息内容
   */
  private extractMessageContent(msg: any): string {
    if (typeof msg.content === 'string') {
      return msg.content;
    }
    if (Array.isArray(msg.content)) {
      return msg.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('');
    }
    return '';
  }

  /**
   * 从 assistant 消息中提取文本、thinking 和工具调用
   */
  private extractAssistantContent(msg: any): { text: string; thinking: string; toolCalls: any[] } {
    let text = '';
    let thinking = '';
    const toolCalls: any[] = [];

    if (!Array.isArray(msg.content)) {
      return { text: typeof msg.content === 'string' ? msg.content : '', thinking, toolCalls };
    }

    for (const block of msg.content) {
      switch (block.type) {
        case 'text':
          text += block.text || '';
          break;
        case 'thinking':
          thinking += block.thinking || '';
          break;
        case 'toolCall':
          toolCalls.push({
            id: block.id,
            name: block.name,
            args: block.arguments || {},
            status: 'success', // 历史消息中的工具调用都是已完成的
          });
          break;
      }
    }

    return { text, thinking, toolCalls };
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<void> {
    const entry = this.sessions.get(sessionId);
    
    // 检查会话是否存在
    if (!this.sessionMetadata.has(sessionId)) {
      throw new Error(`会话 ${sessionId} 不存在`);
    }
    
    try {
      if (entry) {
        if (entry.unsubscribe) {
          entry.unsubscribe();
        }
        entry.session.dispose();
        this.sessions.delete(sessionId);
      }
    } finally {
      // 无论 dispose() 是否失败，都要清理元数据
      this.sessionMetadata.delete(sessionId);
      this.saveMetadata();
      this.currentMessageIds.delete(sessionId);
    }
  }

  /**
   * 删除所有会话
   */
  async deleteAllSessions(): Promise<void> {
    // 清空元数据（先清理，确保即使 dispose 失败也不留脏数据）
    this.sessionMetadata.clear();
    this.saveMetadata();
    
    // 清理所有内存中的会话
    for (const [sessionId, entry] of this.sessions.entries()) {
      try {
        if (entry.unsubscribe) {
          entry.unsubscribe();
        }
        entry.session.dispose();
      } catch (error) {
        console.error(`销毁会话 ${sessionId} 时失败:`, error);
      }
      this.currentMessageIds.delete(sessionId);
    }
    this.sessions.clear();
  }

  /**
   * 删除指定项目下的所有会话
   */
  async deleteAllSessionsInProject(projectPath: string): Promise<void> {
    const sessionIdsToDelete: string[] = [];
    
    // 找出该项目下的所有会话
    for (const [sessionId, info] of this.sessionMetadata.entries()) {
      if (info.projectPath === projectPath) {
        sessionIdsToDelete.push(sessionId);
      }
    }
    
    // 从元数据中移除（先清理，确保即使 dispose 失败也不留脏数据）
    for (const sessionId of sessionIdsToDelete) {
      this.sessionMetadata.delete(sessionId);
    }
    this.saveMetadata();
    
    // 清理内存中的会话
    for (const sessionId of sessionIdsToDelete) {
      const entry = this.sessions.get(sessionId);
      if (entry) {
        try {
          if (entry.unsubscribe) {
            entry.unsubscribe();
          }
          entry.session.dispose();
        } catch (error) {
          console.error(`销毁会话 ${sessionId} 时失败:`, error);
        }
        this.sessions.delete(sessionId);
      }
      this.currentMessageIds.delete(sessionId);
    }
  }

  /**
   * 向会话发送消息
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
    // 如果会话不在内存中，先恢复
    if (!this.sessions.has(sessionId)) {
      await this.resumeSession(sessionId);
    }
    
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      throw new Error(`会话 ${sessionId} 不存在`);
    }

    // 如果指定了模型，先切换模型
    if (modelConfig) {
      let model: Model<any> | undefined;
      
      if (typeof modelConfig === 'string') {
        // 字符串格式：从 ModelRegistry 查找
        model = this.findModel(modelConfig);
        if (!model) {
          console.warn(`未找到模型: ${modelConfig}，使用当前模型`);
        }
      } else {
        // 对象格式：直接构造 Model
        model = this.createCustomModel(modelConfig);
        console.log(`已创建自定义模型: ${modelConfig.modelId}`);
      }
      
      if (model) {
        await entry.session.setModel(model);
        entry.info.model = typeof modelConfig === 'string' ? modelConfig : modelConfig.modelId;
      }
    }

    await entry.session.prompt(text);
    entry.info.updatedAt = new Date();
    entry.info.messageCount++;
    
    // 保存元数据
    this.sessionMetadata.set(sessionId, entry.info);
    this.saveMetadata();
  }

  /**
   * 查找模型
   */
  private findModel(modelId: string): Model<any> | undefined {
    // 刷新模型注册表
    this.modelRegistry.refresh();
    
    // 尝试按 provider/modelId 格式查找
    const parts = modelId.split('/');
    if (parts.length === 2) {
      return this.modelRegistry.find(parts[0], parts[1]);
    }
    
    // 尝试直接查找
    const allModels = this.modelRegistry.getAll();
    return allModels.find(m => m.id === modelId);
  }

  /**
   * 直接构造 Model 对象（不依赖 ModelRegistry）
   */
  createCustomModel(config: {
    provider: string;
    baseUrl: string;
    apiKey: string;
    modelId: string;
    modelName?: string;
    api?: string;
    contextWindow?: number;  // 新增：支持自定义上下文窗口大小
  }): Model<any> {
    const model: Model<any> = {
      id: config.modelId,
      name: config.modelName || config.modelId,
      api: (config.api || 'openai-completions') as Api,
      provider: config.provider,
      baseUrl: config.baseUrl,
      reasoning: true,
      input: ['text', 'image'],
      contextWindow: config.contextWindow || 128000,  // 使用配置的值或默认 128k
      maxTokens: 16384,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    };
    
    // 设置运行时 API Key
    this.authStorage.setRuntimeApiKey(config.provider, config.apiKey);
    
    return model;
  }

  /**
   * 中止当前操作
   */
  async abortSession(sessionId: string): Promise<void> {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      throw new Error(`会话 ${sessionId} 不存在`);
    }

    await entry.session.abort();
  }

  /**
   * 订阅会话事件
   */
  subscribeToSession(sessionId: string, listener: (event: any) => void): () => void {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      throw new Error(`会话 ${sessionId} 不存在`);
    }

    return entry.session.subscribe(listener);
  }

  /**
   * 获取所有可用模型列表
   */
  getModels(): Array<{ id: string; name: string; provider: string }> {
    try {
      const models = this.modelRegistry.getAll();
      return models.map(model => ({
        id: model.id,
        name: model.name,
        provider: model.provider,
      }));
    } catch (error) {
      console.error('获取模型列表失败:', error);
      return [];
    }
  }

  /**
   * 更新会话信息
   */
  updateSessionInfo(sessionId: string, updates: Partial<SessionInfo>): void {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      throw new Error(`会话 ${sessionId} 不存在`);
    }

    entry.info = { ...entry.info, ...updates };
    
    // 更新元数据
    this.sessionMetadata.set(sessionId, entry.info);
    this.saveMetadata();
  }

  /**
   * 设置会话使用的模型
   */
  async setModel(sessionId: string, modelId: string): Promise<void> {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      throw new Error(`会话 ${sessionId} 不存在`);
    }

    // 从模型注册表中查找模型
    const parts = modelId.split('/');
    let model;
    
    if (parts.length === 2) {
      model = this.modelRegistry.find(parts[0], parts[1]);
    } else {
      const allModels = this.modelRegistry.getAll();
      model = allModels.find(m => m.id === modelId);
    }

    if (!model) {
      throw new Error(`未找到模型: ${modelId}`);
    }

    await entry.session.setModel(model);
    
    entry.info.model = modelId;
    entry.info.updatedAt = new Date();
    
    // 保存元数据
    this.sessionMetadata.set(sessionId, entry.info);
    this.saveMetadata();
  }

  /**
   * 设置会话使用的模型（支持完整配置）
   * @param sessionId 会话ID
   * @param modelConfig 模型配置，支持两种格式：
   *   - 字符串: modelId (从 ModelRegistry 查找)
   *   - 对象: { provider, baseUrl, apiKey, modelId } (直接构造 Model)
   */
  async setModelWithConfig(
    sessionId: string, 
    modelConfig: string | {
      provider: string;
      baseUrl: string;
      apiKey: string;
      modelId: string;
      modelName?: string;
      api?: string;
    }
  ): Promise<void> {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      throw new Error(`会话 ${sessionId} 不存在`);
    }

    let model: Model<any> | undefined;
    let modelId: string;
    
    if (typeof modelConfig === 'string') {
      // 字符串格式：从 ModelRegistry 查找
      modelId = modelConfig;
      model = this.findModel(modelConfig);
      if (!model) {
        throw new Error(`未找到模型: ${modelConfig}`);
      }
    } else {
      // 对象格式：直接构造 Model
      modelId = modelConfig.modelId;
      model = this.createCustomModel(modelConfig);
      console.log(`已创建自定义模型: ${modelId}`);
    }

    await entry.session.setModel(model);
    
    entry.info.model = modelId;
    entry.info.updatedAt = new Date();
    
    // 保存元数据
    this.sessionMetadata.set(sessionId, entry.info);
    this.saveMetadata();
  }

  /**
   * 设置会话事件处理器
   */
  private setupSessionEventHandlers(sessionId: string) {
    const entry = this.sessions.get(sessionId);
    if (!entry) return;

    const unsubscribe = entry.session.subscribe((event) => {
      console.log('[AgentManager] 收到 SDK 事件:', event.type, event)
      switch (event.type) {
        case 'message_start':
          const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          this.currentMessageIds.set(sessionId, messageId);
          this.emit('message_start', {
            sessionId,
            messageId,
            timestamp: new Date(),
          });
          break;

        case 'message_update':
          const currentMessageId = this.currentMessageIds.get(sessionId);
          if (event.assistantMessageEvent.type === 'text_delta') {
            this.emit('text_delta', {
              sessionId,
              messageId: currentMessageId,
              delta: event.assistantMessageEvent.delta,
              timestamp: new Date(),
            });
          } else if (event.assistantMessageEvent.type === 'thinking_delta') {
            this.emit('thinking_delta', {
              sessionId,
              messageId: currentMessageId,
              delta: event.assistantMessageEvent.delta,
              timestamp: new Date(),
            });
          }
          break;

        case 'message_end':
          // 提取 usage 数据（如果存在）
          const message = event.message;
          const usage = message.role === 'assistant' && 'usage' in message ? message.usage : undefined;
          
          this.emit('message_end', {
            sessionId,
            messageId: this.currentMessageIds.get(sessionId),
            usage,
            timestamp: new Date(),
          });
          this.currentMessageIds.delete(sessionId);
          break;

        case 'tool_execution_start':
          this.emit('tool_start', {
            sessionId,
            toolName: event.toolName,
            toolCallId: event.toolCallId,
            args: event.args,
            timestamp: new Date(),
          });
          break;

        case 'tool_execution_update':
          this.emit('tool_update', {
            sessionId,
            toolCallId: event.toolCallId,
            output: event.partialResult,
            timestamp: new Date(),
          });
          break;

        case 'tool_execution_end':
          this.emit('tool_end', {
            sessionId,
            toolCallId: event.toolCallId,
            result: event.result,
            isError: event.isError,
            timestamp: new Date(),
          });
          break;

        case 'agent_start':
          this.emit('agent_start', {
            sessionId,
            timestamp: new Date(),
          });
          break;

        case 'agent_end':
          this.emit('agent_end', {
            sessionId,
            messages: event.messages,
            timestamp: new Date(),
          });
          break;

        case 'turn_start':
          this.emit('turn_start', {
            sessionId,
            timestamp: new Date(),
          });
          break;

        case 'turn_end':
          this.emit('turn_end', {
            sessionId,
            message: event.message,
            toolResults: event.toolResults,
            timestamp: new Date(),
          });
          break;
      }
    });

    entry.unsubscribe = unsubscribe;
  }

  /**
   * 设置运行时 API Key（不会持久化到磁盘）
   */
  setRuntimeApiKey(provider: string, apiKey: string): void {
    this.authStorage.setRuntimeApiKey(provider, apiKey);
    console.log(`已设置运行时 API Key: ${provider}`);
  }

  /**
   * 移除运行时 API Key
   */
  removeRuntimeApiKey(provider: string): void {
    this.authStorage.removeRuntimeApiKey(provider);
    console.log(`已移除运行时 API Key: ${provider}`);
  }

  /**
   * 同步模型配置到 models.json
   */
  syncModelConfigToModelsJson(config: {
    provider: string;
    baseUrl: string;
    apiKey: string;
    models: Array<{ id: string; name?: string }>;
  }): void {
    try {
      // 读取现有的 models.json
      let modelsJson: ModelsJsonConfig = { providers: {} };
      if (fs.existsSync(this.modelsJsonPath)) {
        const data = fs.readFileSync(this.modelsJsonPath, 'utf-8');
        modelsJson = JSON.parse(data);
      }

      // 确保 providers 对象存在
      if (!modelsJson.providers) {
        modelsJson.providers = {};
      }

      // 更新或添加 provider 配置
      modelsJson.providers[config.provider] = {
        baseUrl: config.baseUrl,
        api: 'openai-completions', // 默认使用 OpenAI 兼容 API
        apiKey: config.apiKey,
        models: config.models.map(m => ({
          id: m.id,
          name: m.name || m.id,
          reasoning: true,
          input: ['text', 'image'],
          contextWindow: 128000,
          maxTokens: 16384,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        })),
      };

      // 确保目录存在
      const dir = path.dirname(this.modelsJsonPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 写入文件
      fs.writeFileSync(this.modelsJsonPath, JSON.stringify(modelsJson, null, 2), 'utf-8');
      console.log(`已同步模型配置到 models.json: ${config.provider}`);
    } catch (error) {
      console.error('同步模型配置到 models.json 失败:', error);
      throw error;
    }
  }

  /**
   * 从 models.json 移除 provider
   */
  removeProviderFromModelsJson(provider: string): void {
    try {
      if (!fs.existsSync(this.modelsJsonPath)) {
        return;
      }

      const data = fs.readFileSync(this.modelsJsonPath, 'utf-8');
      const modelsJson: ModelsJsonConfig = JSON.parse(data);

      if (modelsJson.providers && modelsJson.providers[provider]) {
        delete modelsJson.providers[provider];
        fs.writeFileSync(this.modelsJsonPath, JSON.stringify(modelsJson, null, 2), 'utf-8');
        console.log(`已从 models.json 移除 provider: ${provider}`);
      }
    } catch (error) {
      console.error('从 models.json 移除 provider 失败:', error);
    }
  }

  /**
   * 测试 API 连接
   */
  async testConnection(options: {
    provider: string;
    baseUrl: string;
    apiKey: string;
  }): Promise<{ success: boolean; error?: string }> {
    const { provider, baseUrl, apiKey } = options;

    try {
      let testUrl = '';
      let headers: Record<string, string> = {};

      // 根据供应商构建测试请求
      switch (provider) {
        case 'anthropic':
          // Anthropic 使用 messages API 测试
          testUrl = `${baseUrl}/v1/messages`;
          headers = {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          };
          // 发送一个最小请求来测试连接
          const anthropicResponse = await fetch(testUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model: 'claude-3-haiku-20240307',
              max_tokens: 1,
              messages: [{ role: 'user', content: 'hi' }],
            }),
          });
          // 401 表示 API Key 无效
          if (anthropicResponse.status === 401) {
            return { success: false, error: 'API Key 无效' };
          }
          // 200 表示成功
          if (anthropicResponse.status === 200) {
            return { success: true };
          }
          // 其他状态码表示连接成功但请求有问题
          return { success: true, error: `服务器返回状态码 ${anthropicResponse.status}，但连接正常` };

        case 'openai':
          // OpenAI 使用 models API 测试
          testUrl = `${baseUrl}/models`;
          headers = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          };
          const openaiResponse = await fetch(testUrl, {
            method: 'GET',
            headers,
          });
          // 401 表示 API Key 无效
          if (openaiResponse.status === 401) {
            return { success: false, error: 'API Key 无效' };
          }
          // 403 表示权限不足
          if (openaiResponse.status === 403) {
            return { success: false, error: 'API Key 权限不足' };
          }
          // 200 表示成功
          if (openaiResponse.status === 200) {
            return { success: true };
          }
          // 其他状态码表示连接成功但请求有问题
          return { success: true, error: `服务器返回状态码 ${openaiResponse.status}，但连接正常` };

        case 'google':
          // Google Gemini 使用 models API 测试
          testUrl = `${baseUrl}/v1/models?key=${apiKey}`;
          const googleResponse = await fetch(testUrl, {
            method: 'GET',
          });
          // 400 表示 API Key 无效
          if (googleResponse.status === 400) {
            return { success: false, error: 'API Key 无效' };
          }
          // 403 表示权限不足
          if (googleResponse.status === 403) {
            return { success: false, error: 'API Key 权限不足或无效' };
          }
          // 200 表示成功
          if (googleResponse.status === 200) {
            return { success: true };
          }
          // 其他状态码表示连接成功但请求有问题
          return { success: true, error: `服务器返回状态码 ${googleResponse.status}，但连接正常` };

        case 'custom':
          // 自定义供应商，尝试多种端点来测试 API key
          // 首先尝试 /v1/models 端点（OpenAI 兼容）
          testUrl = `${baseUrl}/v1/models`;
          headers = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          };
          
          try {
            const modelsResponse = await fetch(testUrl, {
              method: 'GET',
              headers,
            });
            
            // 401 表示 API Key 无效
            if (modelsResponse.status === 401) {
              return { success: false, error: 'API Key 无效' };
            }
            // 403 表示权限不足
            if (modelsResponse.status === 403) {
              return { success: false, error: 'API Key 权限不足' };
            }
            // 200 表示成功
            if (modelsResponse.status === 200) {
              return { success: true };
            }
            // 其他状态码表示连接成功但请求有问题
            return { success: true, error: `服务器返回状态码 ${modelsResponse.status}，但连接正常` };
          } catch (modelError) {
            // 如果 /v1/models 失败，尝试根路径
            try {
              const rootResponse = await fetch(baseUrl, {
                method: 'GET',
                headers,
              });
              
              // 401 表示 API Key 无效
              if (rootResponse.status === 401) {
                return { success: false, error: 'API Key 无效' };
              }
              // 403 表示权限不足
              if (rootResponse.status === 403) {
                return { success: false, error: 'API Key 权限不足' };
              }
              // 只要能连接上就认为成功
              return { success: true };
            } catch (rootError) {
              // 如果都失败，返回网络错误
              throw rootError;
            }
          }

        default:
          return { success: false, error: `不支持的供应商: ${provider}` };
      }
    } catch (error: any) {
      // 网络错误
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return { success: false, error: '无法连接到服务器，请检查 Base URL' };
      }
      if (error.code === 'ETIMEDOUT') {
        return { success: false, error: '连接超时' };
      }
      return { success: false, error: error.message || '连接失败' };
    }
  }

  /**
   * 清理所有会话
   */
  dispose(): void {
    for (const { session, unsubscribe } of this.sessions.values()) {
      if (unsubscribe) unsubscribe();
      session.dispose();
    }
    this.sessions.clear();
    this.currentMessageIds.clear();
  }

  /**
   * 获取会话的上下文使用情况
   */
  getContextUsage(sessionId: string): ContextUsage {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      return { usedTokens: 0, totalTokens: 128000, percentage: 0 };
    }

    const session = entry.session;
    const model = session.model;
    const totalTokens = model?.contextWindow || 128000;

    // 从消息中提取 usage 数据
    let usedTokens = 0;
    let lastUsageId: string | undefined;
    const messages = session.messages;

    // 从后向前查找最后一条有 usage 的 assistant 消息
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'assistant' && 'usage' in msg) {
        const usage = (msg as any).usage;
        if (usage && usage.totalTokens) {
          usedTokens = usage.totalTokens;
          lastUsageId = `msg_${sessionId}_${i}`;
          break;
        }
      }
    }

    // 如果没有 usage 数据，使用启发式估算（字符数 / 4）
    if (usedTokens === 0) {
      let totalChars = 0;
      for (const msg of messages) {
        // 处理不同类型的消息
        if ('content' in msg) {
          const content = msg.content;
          if (typeof content === 'string') {
            totalChars += content.length;
          } else if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === 'text' && block.text) {
                totalChars += block.text.length;
              } else if (block.type === 'thinking' && block.thinking) {
                totalChars += block.thinking.length;
              }
            }
          }
        }
        // 处理 BashExecutionMessage
        if ('command' in msg && typeof msg.command === 'string') {
          totalChars += msg.command.length;
        }
        if ('output' in msg && typeof msg.output === 'string') {
          totalChars += msg.output.length;
        }
      }
      usedTokens = Math.ceil(totalChars / 4);
    }

    const percentage = Math.min(100, Math.round((usedTokens / totalTokens) * 100));

    return {
      usedTokens,
      totalTokens,
      percentage,
      lastUsageId,
    };
  }
}
