import { 
  createAgentSession, 
  SessionManager, 
  AuthStorage, 
  ModelRegistry,
  loadSkills as loadPiSkills,
  type AgentSession,
  type CreateAgentSessionOptions,
  type ToolDefinition,
} from '@earendil-works/pi-coding-agent';
import type { Model, Api } from '@earendil-works/pi-ai';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
import type { SessionInfo, ProjectSessions } from '../shared/types';
import { StorageManager } from './storage-manager.js';
import { listAllSessions, findSessionFile, readSessionHeader } from './session-scanner.js';
import { StatsManager } from './stats-manager.js';
import { McpServerRegistry, getAllMcpAgentTools } from './mcp/index.js';

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

export class AgentManager extends EventEmitter {
  private sessions: Map<string, SessionEntry> = new Map();
  private currentMessageIds: Map<string, string> = new Map();
  private authStorage: AuthStorage;
  private modelRegistry: ModelRegistry;
  private storageManager: StorageManager;
  private statsManager: StatsManager;
  private modelsJsonPath: string;
  private mcpRegistry: McpServerRegistry;

  constructor(storageManager: StorageManager, mcpRegistry?: McpServerRegistry) {
    super();
    this.storageManager = storageManager;
    this.mcpRegistry = mcpRegistry || new McpServerRegistry();
    this.authStorage = AuthStorage.create();
    this.modelRegistry = ModelRegistry.create(this.authStorage);
    this.statsManager = new StatsManager(storageManager.getDataRoot());
    
    // 设置 models.json 路径
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    this.modelsJsonPath = path.join(homeDir, '.pi', 'agent', 'models.json');
  }

  /**
   * 获取统计管理器
   */
  getStatsManager(): StatsManager {
    return this.statsManager;
  }

  /**
   * 获取 MCP 注册表
   */
  getMcpRegistry(): McpServerRegistry {
    return this.mcpRegistry;
  }

  getMcpToolDefinitions(): ToolDefinition[] {
    return getAllMcpAgentTools(this.mcpRegistry);
  }

  /**
   * 连接项目级 MCP 服务器并获取所有可用工具
   */
  private async ensureProjectMcpTools(projectPath: string): Promise<ToolDefinition[]> {
    // 连接项目级 MCP 服务器（已有连接时 registry 内部会跳过）
    await this.mcpRegistry.connectProjectServers(projectPath);
    return this.getMcpToolDefinitions();
  }

  /**
   * 加载所有可用的 skills
   */
  async loadSkills(): Promise<any[]> {
    try {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      const agentDir = path.join(homeDir, '.agents');
      const cwd = process.cwd();
      
      const result = loadPiSkills({
        cwd,
        agentDir,
        skillPaths: [],
        includeDefaults: true,
      });
      
      return result.skills.map(skill => ({
        name: skill.name,
        description: skill.description,
        filePath: skill.filePath,
        baseDir: skill.baseDir,
        scope: skill.sourceInfo?.scope || 'user',
        disableModelInvocation: skill.disableModelInvocation,
      }));
    } catch (error) {
      console.error('[AgentManager] 加载 skills 失败:', error);
      return [];
    }
  }

  /**
   * 创建新的会话（持久化）
   */
  async createSession(options: { projectPath: string; name?: string; modelId?: string }): Promise<SessionInfo> {
    // 确保目录存在
    this.storageManager.ensureDirectories();
    
    const sessionDir = this.storageManager.getProjectSessionsDir(options.projectPath);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    const sessionManager = SessionManager.create(options.projectPath, sessionDir);
    
    const mcpTools = await this.ensureProjectMcpTools(options.projectPath);

    const sessionOptions: CreateAgentSessionOptions = {
      sessionManager,
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      cwd: options.projectPath,
      ...(mcpTools.length > 0 ? { customTools: mcpTools } : {}),
    };

    const { session } = await createAgentSession(sessionOptions);

    // 生成会话名称: 新会话-YYMMDD
    const now = new Date();
    const dateStr = `${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
    const defaultName = `新会话-${dateStr}`;
    
    const sessionFile = session.sessionManager.getSessionFile();
    const sessionInfo: SessionInfo = {
      id: session.sessionId,
      name: options.name || defaultName,
      projectPath: options.projectPath,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      model: session.model?.id || 'unknown',
      sessionFile,
    };

    // 写入 session 文件头，确保文件系统中有正确的格式
    // SDK 的 SessionManager 创建后不会立即写文件，需要用消息后才能写入
    if (sessionFile) {
      try {
        const sessionHeader = JSON.stringify({
          type: 'session',
          id: session.sessionId,
          cwd: options.projectPath,
          timestamp: sessionInfo.createdAt.toISOString(),
        });
        const nameEntry = JSON.stringify({ type: 'session_info', name: sessionInfo.name });
        fs.writeFileSync(sessionFile, sessionHeader + '\n' + nameEntry + '\n');
      } catch (error) {
        console.error('写入 session 文件失败:', error);
      }
    }

    // 只保存到内存（不再写 session-metadata.json）
    this.sessions.set(session.sessionId, { session, info: sessionInfo });
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

    // 从所有会话中查找文件路径
    const sessionsDir = this.storageManager.getSessionsDir();
    const sessionFile = await findSessionFile(sessionsDir, sessionId);
    
    if (!sessionFile) {
      throw new Error(`会话 ${sessionId} 不存在`);
    }

    // 先读取 session 文件 header，获取 cwd（工作目录）和名称
    let sessionCwd = '';
    let sessionName = '未命名会话';
    try {
      const header = await readSessionHeader(sessionFile);
      if (header) {
        sessionCwd = header.cwd || '';
        sessionName = header.name || '未命名会话';
      }
    } catch (error) {
      console.error('读取会话 header 失败:', error);
    }

    const sessionManager = SessionManager.open(sessionFile);

    // 恢复会话时也确保项目 MCP 连接
    let mcpTools: ToolDefinition[] = [];
    if (sessionCwd) {
      mcpTools = await this.ensureProjectMcpTools(sessionCwd);
    } else {
      mcpTools = this.getMcpToolDefinitions();
    }

    const sessionOptions: CreateAgentSessionOptions = {
      sessionManager,
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      cwd: sessionCwd,
      ...(mcpTools.length > 0 ? { customTools: mcpTools } : {}),
    };

    const { session } = await createAgentSession(sessionOptions);

    // 构建 SessionInfo
    const now = new Date();
    const info: SessionInfo = {
      id: session.sessionId,
      name: sessionName,
      projectPath: sessionCwd,
      createdAt: now,
      updatedAt: now,
      messageCount: session.messages.length,
      model: session.model?.id || 'unknown',
      sessionFile: sessionFile,
    };

    // 保存到内存
    this.sessions.set(sessionId, { session, info });
    this.setupSessionEventHandlers(sessionId);
    
    return session;
  }

  /**
   * 获取当前会话信息
   */
  getSessionInfo(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId)?.info;
  }

  /**
   * 列出所有会话（按项目分组）
   */
  async listSessions(): Promise<ProjectSessions[]> {
    const sessionsDir = this.storageManager.getSessionsDir();
    const scannedProjects = await listAllSessions(sessionsDir);
    
    // 合并内存中的会话（新创建但可能尚未完全持久化的会话）
    const projectMap = new Map<string, ProjectSessions>();
    
    // 先从扫描结果构建
    for (const project of scannedProjects) {
      projectMap.set(project.projectPath, {
        projectPath: project.projectPath,
        projectName: project.projectName,
        sessions: project.sessions.map(s => ({
          id: s.id,
          name: s.name || '未命名会话',
          projectPath: s.cwd,
          createdAt: s.created,
          updatedAt: s.modified,
          messageCount: s.messageCount,
          model: s.model || 'unknown',
          sessionFile: s.sessionFile,
        })),
      });
    }
    
    // 再合并内存中的会话（覆盖扫描结果，确保最新状态）
    for (const [, entry] of this.sessions) {
      const { info } = entry;
      let project = projectMap.get(info.projectPath);
      if (!project) {
        const projectName = info.projectPath.split(/[/\\]/).pop() || info.projectPath;
        project = {
          projectPath: info.projectPath,
          projectName,
          sessions: [],
        };
        projectMap.set(info.projectPath, project);
      }
      
      // 替换或添加
      const existingIndex = project.sessions.findIndex(s => s.id === info.id);
      if (existingIndex >= 0) {
        project.sessions[existingIndex] = info;
      } else {
        project.sessions.push(info);
      }
    }
    
    // 排序：项目按最新会话时间降序，会话按更新时间降序
    const result = Array.from(projectMap.values());
    for (const project of result) {
      project.sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    result.sort((a, b) => {
      const aLatest = a.sessions[0]?.updatedAt?.getTime() || 0;
      const bLatest = b.sessions[0]?.updatedAt?.getTime() || 0;
      return bLatest - aLatest;
    });
    
    return result;
  }

  /**
   * 获取会话的历史消息
   */
  async getMessages(sessionId: string): Promise<any[]> {
    const entry = this.sessions.get(sessionId);
    if (entry) {
      return this.extractMessagesFromSession(entry.session, sessionId);
    }
    
    // 会话不在内存中，从文件系统扫描查找 session 文件
    return await this.getMessagesFromFile(sessionId);
  }

  /**
   * 从会话文件轻量级读取消息（不需要创建完整 AgentSession）
   */
  async getMessagesFromFile(sessionId: string): Promise<any[]> {
    const sessionsDir = this.storageManager.getSessionsDir();
    const sessionFile = await findSessionFile(sessionsDir, sessionId);

    if (!sessionFile) {
      console.error(`会话文件不存在: ${sessionId}`);
      return [];
    }

    try {
      const sessionManager = SessionManager.open(sessionFile);
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
    const toolResults = new Map<string, { result: string; isError: boolean; details?: { diff?: string; firstChangedLine?: number } }>();
    for (const msg of messages) {
      if (msg.role === 'toolResult') {
        const resultContent = this.extractMessageContent(msg);
        toolResults.set(msg.toolCallId, {
          result: resultContent,
          isError: msg.isError || false,
          details: msg.details,
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
            details: toolResult?.details,
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
    
    if (entry) {
      // 会话在内存中，正常删除
      this.sessions.delete(sessionId);
      this.currentMessageIds.delete(sessionId);
      
      // 删除 session 文件
      const sessionFile = entry.session.sessionManager.getSessionFile();
      if (sessionFile && fs.existsSync(sessionFile)) {
        try {
          entry.session.dispose();
          fs.unlinkSync(sessionFile);
        } catch (error) {
          console.error('删除会话文件失败:', error);
        }
      } else {
        entry.session.dispose();
      }
    } else {
      // 会话不在内存中，尝试从磁盘查找并删除
      const sessionsDir = this.storageManager.getSessionsDir();
      const sessionFile = await findSessionFile(sessionsDir, sessionId);
      
      if (!sessionFile) {
        throw new Error(`会话 ${sessionId} 不存在`);
      }
      
      try {
        fs.unlinkSync(sessionFile);
        console.log(`已删除磁盘上的会话文件: ${sessionFile}`);
      } catch (error) {
        console.error('删除会话文件失败:', error);
        throw new Error(`删除会话文件失败: ${error}`);
      }
    }
  }

  /**
   * 删除所有会话
   */
  async deleteAllSessions(): Promise<void> {
    // 清理所有内存中的会话
    for (const [sessionId, entry] of this.sessions.entries()) {
      try {
        if (entry.unsubscribe) {
          entry.unsubscribe();
        }
        // 尝试删除文件
        const sessionFile = entry.session.sessionManager.getSessionFile();
        if (sessionFile && fs.existsSync(sessionFile)) {
          fs.unlinkSync(sessionFile);
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
    for (const [sessionId, entry] of this.sessions.entries()) {
      if (entry.info.projectPath === projectPath) {
        sessionIdsToDelete.push(sessionId);
      }
    }
    
    // 清理
    for (const sessionId of sessionIdsToDelete) {
      const entry = this.sessions.get(sessionId);
      if (entry) {
        try {
          if (entry.unsubscribe) {
            entry.unsubscribe();
          }
          const sessionFile = entry.session.sessionManager.getSessionFile();
          if (sessionFile && fs.existsSync(sessionFile)) {
            fs.unlinkSync(sessionFile);
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
    contextWindow?: number;
  }): Model<any> {
    const model: Model<any> = {
      id: config.modelId,
      name: config.modelName || config.modelId,
      api: (config.api || 'openai-completions') as Api,
      provider: config.provider,
      baseUrl: config.baseUrl,
      reasoning: true,
      input: ['text', 'image'],
      contextWindow: config.contextWindow || 128000,
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
   * 更新会话信息（内存 + 文件持久化）
   */
  updateSessionInfo(sessionId: string, updates: Partial<SessionInfo>): void {
    const entry = this.sessions.get(sessionId);

    // 更新内存中的 info
    if (entry) {
      entry.info = { ...entry.info, ...updates };
    }

    // 持久化 name 变更到 session 文件
    if (updates.name !== undefined) {
      this.persistSessionName(sessionId, updates.name, entry?.info.sessionFile);
    }
  }

  /**
   * 将 session 名称持久化到 .jsonl 文件
   * 在文件中查找或插入 session_info 行
   */
  private persistSessionName(sessionId: string, name: string, sessionFile?: string): void {
    // 如果没有传入 sessionFile，尝试查找
    let filePath = sessionFile;
    if (!filePath) {
      const sessionsDir = this.storageManager.getSessionsDir();
      // 同步查找（使用 readdirSync）
      filePath = this.findSessionFileSync(sessionsDir, sessionId) ?? undefined;
    }

    if (!filePath || !fs.existsSync(filePath)) {
      console.warn(`无法找到会话文件进行重命名: ${sessionId}`);
      return;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      let found = false;

      // 查找并替换已有的 session_info 行
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
          const entry = JSON.parse(line);
          if (entry.type === 'session_info') {
            lines[i] = JSON.stringify({ type: 'session_info', name });
            found = true;
            break;
          }
        } catch {
          // 跳过解析失败的行
        }
      }

      // 如果没有找到 session_info，在 header 后插入
      if (!found) {
        lines.splice(1, 0, JSON.stringify({ type: 'session_info', name }));
      }

      fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
    } catch (error) {
      console.error('持久化会话名称失败:', error);
    }
  }

  /**
   * 同步查找 session 文件（用于 persistSessionName）
   */
  private findSessionFileSync(sessionsRoot: string, sessionId: string): string | null {
    if (!fs.existsSync(sessionsRoot)) return null;

    try {
      const entries = fs.readdirSync(sessionsRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirPath = path.join(sessionsRoot, entry.name);
          const files = fs.readdirSync(dirPath);
          const jsonlFile = files.find(f => f.endsWith('.jsonl') && f.includes(sessionId));
          if (jsonlFile) return path.join(dirPath, jsonlFile);
        } else if (entry.isFile() && entry.name.endsWith('.jsonl') && entry.name.includes(sessionId)) {
          return path.join(sessionsRoot, entry.name);
        }
      }
    } catch (error) {
      console.error(`同步查找会话文件失败: ${sessionId}`, error);
    }
    return null;
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
  }

  /**
   * 设置会话使用的模型（支持完整配置）
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
      modelId = modelConfig;
      model = this.findModel(modelConfig);
      if (!model) {
        throw new Error(`未找到模型: ${modelConfig}`);
      }
    } else {
      modelId = modelConfig.modelId;
      model = this.createCustomModel(modelConfig);
      console.log(`已创建自定义模型: ${modelId}`);
    }

    await entry.session.setModel(model);
    entry.info.model = modelId;
    entry.info.updatedAt = new Date();
  }

  /**
   * 采集统计数据
   */
  private collectStats(sessionId: string, messages: any[]): void {
    const records = messages
      .filter((msg: any) => msg.role === 'assistant' && msg.usage)
      .map((msg: any) => ({
        timestamp: new Date().toISOString(),
        sessionId,
        model: msg.model || 'unknown',
        provider: msg.provider || 'unknown',
        input: msg.usage.input || 0,
        output: msg.usage.output || 0,
        cacheRead: msg.usage.cacheRead || 0,
        cacheWrite: msg.usage.cacheWrite || 0,
        totalTokens: msg.usage.totalTokens || 0
      }))
    
    if (records.length > 0) {
      this.statsManager.appendRecords(records)
    }
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
          // 采集统计数据
          this.collectStats(sessionId, event.messages);
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
      let modelsJson: ModelsJsonConfig = { providers: {} };
      if (fs.existsSync(this.modelsJsonPath)) {
        const data = fs.readFileSync(this.modelsJsonPath, 'utf-8');
        modelsJson = JSON.parse(data);
      }

      if (!modelsJson.providers) {
        modelsJson.providers = {};
      }

      modelsJson.providers[config.provider] = {
        baseUrl: config.baseUrl,
        api: 'openai-completions',
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

      const dir = path.dirname(this.modelsJsonPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

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

      switch (provider) {
        case 'anthropic':
          testUrl = `${baseUrl}/v1/messages`;
          headers = {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          };
          const anthropicResponse = await fetch(testUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model: 'claude-3-haiku-20240307',
              max_tokens: 1,
              messages: [{ role: 'user', content: 'hi' }],
            }),
          });
          if (anthropicResponse.status === 401) {
            return { success: false, error: 'API Key 无效' };
          }
          if (anthropicResponse.status === 200) {
            return { success: true };
          }
          return { success: true, error: `服务器返回状态码 ${anthropicResponse.status}，但连接正常` };

        case 'openai':
          testUrl = `${baseUrl}/models`;
          headers = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          };
          const openaiResponse = await fetch(testUrl, {
            method: 'GET',
            headers,
          });
          if (openaiResponse.status === 401) {
            return { success: false, error: 'API Key 无效' };
          }
          if (openaiResponse.status === 403) {
            return { success: false, error: 'API Key 权限不足' };
          }
          if (openaiResponse.status === 200) {
            return { success: true };
          }
          return { success: true, error: `服务器返回状态码 ${openaiResponse.status}，但连接正常` };

        case 'google':
          testUrl = `${baseUrl}/v1/models?key=${apiKey}`;
          const googleResponse = await fetch(testUrl, {
            method: 'GET',
          });
          if (googleResponse.status === 400) {
            return { success: false, error: 'API Key 无效' };
          }
          if (googleResponse.status === 403) {
            return { success: false, error: 'API Key 权限不足或无效' };
          }
          if (googleResponse.status === 200) {
            return { success: true };
          }
          return { success: true, error: `服务器返回状态码 ${googleResponse.status}，但连接正常` };

        case 'custom':
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
            
            if (modelsResponse.status === 401) {
              return { success: false, error: 'API Key 无效' };
            }
            if (modelsResponse.status === 403) {
              return { success: false, error: 'API Key 权限不足' };
            }
            if (modelsResponse.status === 200) {
              return { success: true };
            }
            return { success: true, error: `服务器返回状态码 ${modelsResponse.status}，但连接正常` };
          } catch (modelError) {
            try {
              const rootResponse = await fetch(baseUrl, {
                method: 'GET',
                headers,
              });
              
              if (rootResponse.status === 401) {
                return { success: false, error: 'API Key 无效' };
              }
              if (rootResponse.status === 403) {
                return { success: false, error: 'API Key 权限不足' };
              }
              return { success: true };
            } catch (rootError) {
              throw rootError;
            }
          }

        default:
          return { success: false, error: `不支持的供应商: ${provider}` };
      }
    } catch (error: any) {
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

    let usedTokens = 0;
    let lastUsageId: string | undefined;
    const messages = session.messages;

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

    if (usedTokens === 0) {
      let totalChars = 0;
      for (const msg of messages) {
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
