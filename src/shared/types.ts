// 会话信息
export interface SessionInfo {
  id: string;
  name: string;
  projectPath: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  model: string;
  summary?: string;
  sessionFile?: string;  // 会话文件路径（用于持久化）
}

// 项目会话列表
export interface ProjectSessions {
  projectPath: string;
  projectName: string;
  sessions: SessionInfo[];
}

// 消息类型
export type MessageRole = 'user' | 'assistant' | 'system';

// 工具调用状态
export type ToolCallStatus = 'pending' | 'running' | 'success' | 'error';

// 工具调用
export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: ToolCallStatus;
  result?: string;
  error?: string;
  startTime?: Date;
  endTime?: Date;
}

// Token 使用情况
export interface Usage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
}

// 消息
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  thinking?: string;  // thinking 内容（Claude 等模型的思考过程）
  timestamp: Date;
  toolCalls?: ToolCall[];
  usage?: Usage;
  isStreaming?: boolean;
  streamingStartTime?: Date;  // 流式开始时间
  streamingEndTime?: Date;    // 流式结束时间
}

// 模型信息
export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  description?: string;
  contextWindow?: number;  // 上下文窗口大小
}

// 应用设置
export interface AppSettings {
  theme: 'dark' | 'light';
  fontSize: number;
  model: string;
  apiKey?: string;
}
