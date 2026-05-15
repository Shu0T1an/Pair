import type { ProjectSessions, Message, ModelInfo } from '@/shared/types';

// 模拟模型列表
export const mockModels: ModelInfo[] = [
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', description: '最新多模态模型' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI', description: '高性能模型' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic', description: '最强推理能力' },
  { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Anthropic', description: '平衡性能' },
  { id: 'deepseek-v3', name: 'DeepSeek V3', provider: 'DeepSeek', description: '国产开源模型' },
];

// 模拟会话数据
export const mockSessions: ProjectSessions[] = [
  {
    projectPath: '/home/user/projects/pair',
    projectName: 'Pair',
    sessions: [
      {
        id: 'session-1',
        name: '实现用户登录功能',
        projectPath: '/home/user/projects/pair',
        createdAt: new Date('2026-05-14T10:00:00'),
        updatedAt: new Date('2026-05-14T12:30:00'),
        messageCount: 24,
        model: 'gpt-4o',
        summary: '实现了基于 JWT 的用户认证系统',
      },
      {
        id: 'session-2',
        name: '修复数据库连接问题',
        projectPath: '/home/user/projects/pair',
        createdAt: new Date('2026-05-13T14:00:00'),
        updatedAt: new Date('2026-05-13T16:45:00'),
        messageCount: 18,
        model: 'claude-3-opus',
        summary: '解决了连接池溢出问题',
      },
    ],
  },
  {
    projectPath: '/home/user/projects/website',
    projectName: 'Website',
    sessions: [
      {
        id: 'session-3',
        name: '重构首页组件',
        projectPath: '/home/user/projects/website',
        createdAt: new Date('2026-05-12T09:00:00'),
        updatedAt: new Date('2026-05-12T11:20:00'),
        messageCount: 32,
        model: 'gpt-4-turbo',
      },
    ],
  },
  {
    projectPath: '/home/user/projects/api-server',
    projectName: 'API Server',
    sessions: [
      {
        id: 'session-4',
        name: '添加 REST API 端点',
        projectPath: '/home/user/projects/api-server',
        createdAt: new Date('2026-05-11T15:00:00'),
        updatedAt: new Date('2026-05-11T18:00:00'),
        messageCount: 45,
        model: 'deepseek-v3',
        summary: '完成了用户和订单模块的 API',
      },
      {
        id: 'session-5',
        name: '编写单元测试',
        projectPath: '/home/user/projects/api-server',
        createdAt: new Date('2026-05-10T10:00:00'),
        updatedAt: new Date('2026-05-10T12:30:00'),
        messageCount: 28,
        model: 'claude-3-sonnet',
      },
      {
        id: 'session-6',
        name: '性能优化讨论',
        projectPath: '/home/user/projects/api-server',
        createdAt: new Date('2026-05-09T16:00:00'),
        updatedAt: new Date('2026-05-09T17:30:00'),
        messageCount: 15,
        model: 'gpt-4o',
      },
    ],
  },
];

// 模拟消息数据
export const mockMessages: Record<string, Message[]> = {
  'session-1': [
    {
      id: 'msg-1',
      role: 'user',
      content: '帮我实现一个基于 JWT 的用户登录功能，需要包含注册、登录和 token 刷新。',
      timestamp: new Date('2026-05-14T10:00:00'),
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: `好的，我来帮你实现 JWT 认证系统。首先让我看看项目的当前结构。

## 设计方案

我会创建以下文件：

1. \`src/auth/jwt.ts\` - JWT 工具函数
2. \`src/auth/middleware.ts\` - 认证中间件
3. \`src/routes/auth.ts\` - 认证路由
4. \`src/models/user.ts\` - 用户模型

让我先检查一下现有的项目结构。`,
      timestamp: new Date('2026-05-14T10:01:00'),
      toolCalls: [
        {
          id: 'tool-1',
          name: 'read',
          args: { path: 'src/' },
          status: 'success',
          result: '目录结构已读取',
          startTime: new Date('2026-05-14T10:01:05'),
          endTime: new Date('2026-05-14T10:01:06'),
        },
        {
          id: 'tool-2',
          name: 'bash',
          args: { command: 'ls -la package.json' },
          status: 'success',
          result: 'package.json 存在',
          startTime: new Date('2026-05-14T10:01:07'),
          endTime: new Date('2026-05-14T10:01:08'),
        },
      ],
    },
    {
      id: 'msg-3',
      role: 'user',
      content: '项目已经初始化了，用的 Express + TypeScript，数据库是 PostgreSQL。',
      timestamp: new Date('2026-05-14T10:02:00'),
    },
    {
      id: 'msg-4',
      role: 'assistant',
      content: `明白了，让我开始实现。

首先创建 JWT 工具函数：

\`\`\`typescript
// src/auth/jwt.ts
import jwt from 'jsonwebtoken';
import { User } from '../models/user';

const SECRET = process.env.JWT_SECRET || 'your-secret-key';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export interface TokenPayload {
  userId: string;
  email: string;
}

export function generateAccessToken(user: User): string {
  return jwt.sign(
    { userId: user.id, email: user.email },
    SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

export function generateRefreshToken(user: User): string {
  return jwt.sign(
    { userId: user.id },
    SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, SECRET) as TokenPayload;
}
\`\`\`

接下来创建用户模型...`,
      timestamp: new Date('2026-05-14T10:03:00'),
      toolCalls: [
        {
          id: 'tool-3',
          name: 'write',
          args: { path: 'src/auth/jwt.ts', content: '...' },
          status: 'success',
          startTime: new Date('2026-05-14T10:03:05'),
          endTime: new Date('2026-05-14T10:03:10'),
        },
      ],
    },
  ],
};

// 获取当前时间的相对描述
export function getRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return date.toLocaleDateString('zh-CN');
}
