import { contextBridge, ipcRenderer } from 'electron';

// 暴露 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 测试属性
  test: 'preload-works',
  
  // 窗口控制
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  
  // 平台信息
  platform: process.platform,
  
  // 版本信息
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },

  // 会话管理
  session: {
    create: (options: { projectPath: string; name?: string; modelId?: string }) => 
      ipcRenderer.invoke('session:create', options),
    list: () => ipcRenderer.invoke('session:list'),
    delete: (sessionId: string) => ipcRenderer.invoke('session:delete', sessionId),
    info: (sessionId: string) => ipcRenderer.invoke('session:info', sessionId),
    update: (sessionId: string, updates: any) => 
      ipcRenderer.invoke('session:update', sessionId, updates),
    messages: (sessionId: string) => ipcRenderer.invoke('session:messages', sessionId),
  },

  // 消息处理
  message: {
    send: (sessionId: string, text: string, modelConfig?: string | { provider: string; baseUrl: string; apiKey: string; modelId: string; modelName?: string; api?: string }) => 
      ipcRenderer.invoke('message:send', sessionId, text, modelConfig),
    abort: (sessionId: string) => ipcRenderer.invoke('message:abort', sessionId),
  },

  // 模型管理
  model: {
    list: () => ipcRenderer.invoke('model:list'),
    current: (sessionId: string) => ipcRenderer.invoke('model:current', sessionId),
    set: (sessionId: string, modelId: string, modelConfig?: string | { provider: string; baseUrl: string; apiKey: string; modelId: string; modelName?: string; api?: string }) => 
      ipcRenderer.invoke('model:set', sessionId, modelId, modelConfig),
    testConnection: (options: { provider: string; baseUrl: string; apiKey: string }) => 
      ipcRenderer.invoke('model:testConnection', options),
    setApiKey: (provider: string, apiKey: string) => 
      ipcRenderer.invoke('model:setApiKey', provider, apiKey),
    removeApiKey: (provider: string) => 
      ipcRenderer.invoke('model:removeApiKey', provider),
    syncConfig: (config: { provider: string; baseUrl: string; apiKey: string; models: Array<{ id: string; name?: string }> }) => 
      ipcRenderer.invoke('model:syncConfig', config),
    removeConfig: (provider: string) => 
      ipcRenderer.invoke('model:removeConfig', provider),
  },

  // 对话框
  dialog: {
    selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  },

  // 事件订阅
  on: (channel: string, callback: (...args: any[]) => void) => {
    const validChannels = [
      'agent:message_start',
      'agent:text_delta',
      'agent:thinking_delta',
      'agent:message_end',
      'agent:tool_start',
      'agent:tool_update',
      'agent:tool_end',
      'agent:agent_start',
      'agent:agent_end',
      'agent:turn_start',
      'agent:turn_end',
      'message:update',
      'tool:start',
      'tool:end',
      'status:streaming',
      'status:error',
    ];
    if (validChannels.includes(channel)) {
      const subscription = (_event: any, ...args: any[]) => callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
    return () => {};
  },
});
