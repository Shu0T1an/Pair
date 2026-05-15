import { ipcMain, BrowserWindow, dialog } from 'electron';
import { AgentManager } from './agent-manager.js';
import type { SessionInfo, ProjectSessions } from '../shared/types.js';

export class IPCHandler {
  private agentManager: AgentManager;
  private mainWindow: BrowserWindow | null = null;
  private eventListeners: Map<string, (...args: any[]) => void> = new Map();

  constructor(agentManager: AgentManager) {
    this.agentManager = agentManager;
    this.registerHandlers();
  }

  /**
   * 设置主窗口引用（用于发送事件）
   */
  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
    this.startEventForwarding();
  }

  /**
   * 开始转发 AgentManager 事件到渲染进程
   */
  private startEventForwarding() {
    if (!this.mainWindow) return;

    // 定义要转发的事件
    const eventsToForward = [
      'message_start',
      'text_delta',
      'thinking_delta',
      'message_end',
      'tool_start',
      'tool_update',
      'tool_end',
      'agent_start',
      'agent_end',
      'turn_start',
      'turn_end',
    ];

    // 为每个事件添加监听器
    eventsToForward.forEach(eventName => {
      const listener = (...args: any[]) => {
        console.log('[IPCHandler] 转发事件:', eventName, args)
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send(`agent:${eventName}`, ...args);
        }
      };
      this.agentManager.on(eventName, listener);
      this.eventListeners.set(eventName, listener);
    });
  }

  /**
   * 停止事件转发
   */
  private stopEventForwarding() {
    this.eventListeners.forEach((listener, eventName) => {
      this.agentManager.removeListener(eventName, listener);
    });
    this.eventListeners.clear();
  }

  /**
   * 注册所有 IPC 处理器
   */
  private registerHandlers() {
    // 会话管理
    ipcMain.handle('session:create', this.handleCreateSession.bind(this));
    ipcMain.handle('session:list', this.handleListSessions.bind(this));
    ipcMain.handle('session:delete', this.handleDeleteSession.bind(this));
    ipcMain.handle('session:deleteAll', this.handleDeleteAllSessions.bind(this));
    ipcMain.handle('session:deleteAllInProject', this.handleDeleteAllSessionsInProject.bind(this));
    ipcMain.handle('session:info', this.handleGetSessionInfo.bind(this));
    ipcMain.handle('session:update', this.handleUpdateSession.bind(this));
    ipcMain.handle('session:messages', this.handleGetSessionMessages.bind(this));

    // 消息处理
    ipcMain.handle('message:send', this.handleSendMessage.bind(this));
    ipcMain.handle('message:abort', this.handleAbortMessage.bind(this));

    // 模型管理
    ipcMain.handle('model:list', this.handleListModels.bind(this));
    ipcMain.handle('model:current', this.handleGetCurrentModel.bind(this));
    ipcMain.handle('model:set', this.handleSetModel.bind(this));
    ipcMain.handle('model:testConnection', this.handleTestConnection.bind(this));
    ipcMain.handle('model:setApiKey', this.handleSetApiKey.bind(this));
    ipcMain.handle('model:removeApiKey', this.handleRemoveApiKey.bind(this));
    ipcMain.handle('model:syncConfig', this.handleSyncModelConfig.bind(this));
    ipcMain.handle('model:removeConfig', this.handleRemoveModelConfig.bind(this));

    // 对话框
    ipcMain.handle('dialog:selectFolder', this.handleSelectFolder.bind(this));
    
    // 上下文使用情况
    ipcMain.handle('context:usage', this.handleGetContextUsage.bind(this));
    
    // 窗口控制
    ipcMain.handle('window:minimize', this.handleMinimize.bind(this));
    ipcMain.handle('window:maximize', this.handleMaximize.bind(this));
    ipcMain.handle('window:close', this.handleClose.bind(this));
  }

  /**
   * 创建会话
   */
  private async handleCreateSession(_event: any, options: { projectPath: string; name?: string; modelId?: string }): Promise<SessionInfo> {
    try {
      const sessionInfo = await this.agentManager.createSession(options);
      return sessionInfo;
    } catch (error) {
      console.error('创建会话失败:', error);
      throw error;
    }
  }

  /**
   * 列出会话
   */
  private async handleListSessions(): Promise<ProjectSessions[]> {
    try {
      return await this.agentManager.listSessions();
    } catch (error) {
      console.error('列出会话失败:', error);
      throw error;
    }
  }

  /**
   * 删除会话
   */
  private async handleDeleteSession(_event: any, sessionId: string): Promise<void> {
    try {
      await this.agentManager.deleteSession(sessionId);
    } catch (error) {
      console.error('删除会话失败:', error);
      throw error;
    }
  }

  /**
   * 删除所有会话
   */
  private async handleDeleteAllSessions(): Promise<void> {
    try {
      await this.agentManager.deleteAllSessions();
    } catch (error) {
      console.error('删除所有会话失败:', error);
      throw error;
    }
  }

  /**
   * 删除指定项目下的所有会话
   */
  private async handleDeleteAllSessionsInProject(_event: any, projectPath: string): Promise<void> {
    try {
      await this.agentManager.deleteAllSessionsInProject(projectPath);
    } catch (error) {
      console.error('删除项目会话失败:', error);
      throw error;
    }
  }

  /**
   * 获取会话信息
   */
  private async handleGetSessionInfo(_event: any, sessionId: string): Promise<SessionInfo | undefined> {
    try {
      return this.agentManager.getSessionInfo(sessionId);
    } catch (error) {
      console.error('获取会话信息失败:', error);
      throw error;
    }
  }

  /**
   * 更新会话信息
   */
  private async handleUpdateSession(_event: any, sessionId: string, updates: Partial<SessionInfo>): Promise<void> {
    try {
      this.agentManager.updateSessionInfo(sessionId, updates);
    } catch (error) {
      console.error('更新会话信息失败:', error);
      throw error;
    }
  }

  /**
   * 获取会话历史消息
   */
  private async handleGetSessionMessages(_event: any, sessionId: string): Promise<any[]> {
    try {
      // getMessages 内部会自动处理：优先从内存读取，否则从文件轻量级读取
      return this.agentManager.getMessages(sessionId);
    } catch (error) {
      console.error('获取会话消息失败:', error);
      throw error;
    }
  }

  /**
   * 发送消息
   */
  private async handleSendMessage(
    _event: any, 
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
    try {
      await this.agentManager.sendMessage(sessionId, text, modelConfig);
    } catch (error) {
      console.error('发送消息失败:', error);
      throw error;
    }
  }

  /**
   * 中止消息
   */
  private async handleAbortMessage(_event: any, sessionId: string): Promise<void> {
    try {
      await this.agentManager.abortSession(sessionId);
    } catch (error) {
      console.error('中止消息失败:', error);
      throw error;
    }
  }

  /**
   * 列出可用模型
   */
  private async handleListModels(): Promise<any[]> {
    try {
      return this.agentManager.getModels();
    } catch (error) {
      console.error('列出模型失败:', error);
      throw error;
    }
  }

  /**
   * 获取当前模型
   */
  private async handleGetCurrentModel(_event: any, sessionId: string): Promise<string | undefined> {
    try {
      const info = this.agentManager.getSessionInfo(sessionId);
      return info?.model;
    } catch (error) {
      console.error('获取当前模型失败:', error);
      throw error;
    }
  }

  /**
   * 设置模型
   * @param sessionId 会话ID
   * @param modelId 模型ID
   * @param modelConfig 可选的模型配置，支持两种格式：
   *   - 字符串: modelId (从 ModelRegistry 查找)
   *   - 对象: { provider, baseUrl, apiKey, modelId } (直接构造 Model)
   */
  private async handleSetModel(
    _event: any, 
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
    try {
      // 如果没有提供配置，使用 modelId 作为配置
      if (!modelConfig) {
        modelConfig = modelId;
      }
      await this.agentManager.setModelWithConfig(sessionId, modelConfig);
    } catch (error) {
      console.error('设置模型失败:', error);
      throw error;
    }
  }

  /**
   * 选择文件夹对话框
   */
  private async handleSelectFolder(): Promise<string | null> {
    try {
      if (!this.mainWindow) {
        return null;
      }
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openDirectory'],
        title: '选择工作区文件夹',
        buttonLabel: '选择',
      });
      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }
      return result.filePaths[0];
    } catch (error) {
      console.error('选择文件夹失败:', error);
      throw error;
    }
  }

  /**
   * 获取上下文使用情况
   */
  private handleGetContextUsage(_event: any, sessionId: string): any {
    try {
      return this.agentManager.getContextUsage(sessionId);
    } catch (error) {
      console.error('获取上下文使用情况失败:', error);
      return { usedTokens: 0, totalTokens: 128000, percentage: 0 };
    }
  }

  /**
   * 最小化窗口
   */
  private handleMinimize() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.minimize();
    }
  }

  /**
   * 最大化/还原窗口
   */
  private handleMaximize() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      if (this.mainWindow.isMaximized()) {
        this.mainWindow.unmaximize();
      } else {
        this.mainWindow.maximize();
      }
    }
  }

  /**
   * 关闭窗口
   */
  private handleClose() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.close();
    }
  }

  /**
   * 测试 API 连接
   */
  private async handleTestConnection(
    _event: any,
    options: {
      provider: string;
      baseUrl: string;
      apiKey: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      return await this.agentManager.testConnection(options);
    } catch (error: any) {
      console.error('测试连接失败:', error);
      return { success: false, error: error.message || '测试连接失败' };
    }
  }

  /**
   * 设置 API Key
   */
  private handleSetApiKey(_event: any, provider: string, apiKey: string): void {
    try {
      this.agentManager.setRuntimeApiKey(provider, apiKey);
    } catch (error) {
      console.error('设置 API Key 失败:', error);
      throw error;
    }
  }

  /**
   * 移除 API Key
   */
  private handleRemoveApiKey(_event: any, provider: string): void {
    try {
      this.agentManager.removeRuntimeApiKey(provider);
    } catch (error) {
      console.error('移除 API Key 失败:', error);
      throw error;
    }
  }

  /**
   * 同步模型配置到 models.json
   */
  private handleSyncModelConfig(_event: any, config: {
    provider: string;
    baseUrl: string;
    apiKey: string;
    models: Array<{ id: string; name?: string }>;
  }): void {
    try {
      this.agentManager.syncModelConfigToModelsJson(config);
    } catch (error) {
      console.error('同步模型配置失败:', error);
      throw error;
    }
  }

  /**
   * 从 models.json 移除配置
   */
  private handleRemoveModelConfig(_event: any, provider: string): void {
    try {
      this.agentManager.removeProviderFromModelsJson(provider);
    } catch (error) {
      console.error('移除模型配置失败:', error);
      throw error;
    }
  }

  /**
   * 清理资源
   */
  dispose() {
    this.stopEventForwarding();
    ipcMain.removeHandler('session:create');
    ipcMain.removeHandler('session:list');
    ipcMain.removeHandler('session:delete');
    ipcMain.removeHandler('session:deleteAll');
    ipcMain.removeHandler('session:deleteAllInProject');
    ipcMain.removeHandler('session:info');
    ipcMain.removeHandler('session:update');
    ipcMain.removeHandler('session:messages');
    ipcMain.removeHandler('message:send');
    ipcMain.removeHandler('message:abort');
    ipcMain.removeHandler('model:list');
    ipcMain.removeHandler('model:current');
    ipcMain.removeHandler('model:set');
    ipcMain.removeHandler('model:testConnection');
    ipcMain.removeHandler('model:setApiKey');
    ipcMain.removeHandler('model:removeApiKey');
    ipcMain.removeHandler('model:syncConfig');
    ipcMain.removeHandler('model:removeConfig');
    ipcMain.removeHandler('context:usage');
    ipcMain.removeHandler('window:minimize');
    ipcMain.removeHandler('window:maximize');
    ipcMain.removeHandler('window:close');
  }
}