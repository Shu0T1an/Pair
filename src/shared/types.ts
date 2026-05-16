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

// 会话状态
export type SessionStatus = 'idle' | 'working' | 'completed' | 'error'

// 应用设置
export interface AppSettings {
  theme: 'dark' | 'light';
  fontSize: number;
  model: string;
  apiKey?: string;
}

/**
 * 通知配置
 */
export interface NotificationConfig {
  /** 是否启用系统通知 */
  enabled: boolean;
  /** 通知标题 */
  title: string;
  /** 通知正文 */
  body: string;
  /** 触发事件类型 */
  triggerEvent: 'agent_end' | 'message_end';
}

/**
 * 默认通知配置
 */
export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  enabled: true,
  title: 'Pair',
  body: 'AI 已完成回复',
  triggerEvent: 'agent_end',
};

// 存储配置
export interface StorageConfig {
  /** 数据根目录 */
  dataRoot: string;
  /** sessions 子目录名 */
  sessionsDir: string;
}

/** 默认存储配置 */
export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  dataRoot: '',  // 空字符串表示使用默认路径 ~/Pair/
  sessionsDir: 'sessions',
};

/** localStorage key */
export const STORAGE_CONFIG_KEY = 'pair-storage-config';

// 统计记录
export interface StatsRecord {
  timestamp: string
  sessionId: string
  model: string
  provider: string
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  totalTokens: number
}

// 每日统计
export interface DailyStats {
  date: string
  totalTokens: number
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

// 模型统计
export interface ModelStats {
  model: string
  provider: string
  totalTokens: number
  percentage: number
}

// 统计概览
export interface OverviewStats {
  totalTokens: number
  totalDays: number
  totalSessions: number
  dailyStats: DailyStats[]
  modelStats: ModelStats[]
  trendData: {
    daily: DailyStats[]
    weekly: DailyStats[]
    monthly: DailyStats[]
  }
}
