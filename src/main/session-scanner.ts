import fs from 'fs';
import path from 'path';
import { readdir, stat } from 'fs/promises';

export interface ScannedSession {
  id: string;
  name?: string;
  cwd: string;
  created: Date;
  modified: Date;
  messageCount: number;
  firstMessage: string;
  sessionFile: string;
  model?: string;
}

export interface ScannedProject {
  projectPath: string;
  projectName: string;
  sessions: ScannedSession[];
}

/**
 * 从 session 文件读取头部信息
 */
export async function readSessionHeader(filePath: string): Promise<ScannedSession | null> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    
    if (lines.length === 0) return null;
    
    // 解析 header（第一行）
    const header = JSON.parse(lines[0]);
    if (header.type !== 'session' || !header.id) return null;
    
    // 统计消息数量和提取信息
    let messageCount = 0;
    let firstMessage = '';
    let name: string | undefined;
    let model: string | undefined;
    
    for (let i = 1; i < lines.length; i++) {
      try {
        const entry = JSON.parse(lines[i]);
        
        // 提取 session_info 中的 name
        if (entry.type === 'session_info' && entry.name) {
          name = entry.name;
        }
        
        // 提取最新的 model_change
        if (entry.type === 'model_change') {
          model = entry.modelId;
        }
        
        // 统计消息
        if (entry.type === 'message') {
          messageCount++;
          
          // 提取第一条用户消息
          if (!firstMessage && entry.message?.role === 'user') {
            const content = entry.message.content;
            if (typeof content === 'string') {
              firstMessage = content;
            } else if (Array.isArray(content)) {
              firstMessage = content
                .filter((c: any) => c.type === 'text')
                .map((c: any) => c.text)
                .join(' ');
            }
          }
        }
      } catch {
        // 跳过解析失败的行
      }
    }
    
    // 获取文件修改时间
    const stats = await stat(filePath);
    
    // 从 header 中提取时间
    const created = header.timestamp ? new Date(header.timestamp) : stats.birthtime;
    const modified = stats.mtime;
    
    return {
      id: header.id,
      name,
      cwd: header.cwd || '',
      created,
      modified,
      messageCount,
      firstMessage: firstMessage || '(无消息)',
      sessionFile: filePath,
      model,
    };
  } catch (error) {
    console.error(`读取 session 文件失败: ${filePath}`, error);
    return null;
  }
}

/**
 * 扫描指定目录下的所有 session 文件
 */
async function scanSessionDir(dirPath: string): Promise<ScannedSession[]> {
  const sessions: ScannedSession[] = [];
  
  try {
    const files = await readdir(dirPath);
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
    
    for (const file of jsonlFiles) {
      const filePath = path.join(dirPath, file);
      const session = await readSessionHeader(filePath);
      if (session) {
        sessions.push(session);
      }
    }
  } catch (error) {
    console.error(`扫描 session 目录失败: ${dirPath}`, error);
  }
  
  // 按修改时间降序排列
  sessions.sort((a, b) => b.modified.getTime() - a.modified.getTime());
  
  return sessions;
}

/**
 * 将扫描到的 session 按项目分组加入 projectMap
 */
function addSessionsToProjectMap(projectMap: Map<string, ScannedProject>, sessions: ScannedSession[], dirName: string): void {
  if (sessions.length === 0) return;

  // 以第一个 session 的 cwd 作为 project path；如果为空则用目录名
  const firstSession = sessions[0];
  const projectPath = firstSession.cwd || dirName;
  const projectName = projectPath.split(/[/\\]/).pop() || projectPath;

  let project = projectMap.get(projectPath);
  if (project) {
    project.sessions.push(...sessions);
    project.sessions.sort((a, b) => b.modified.getTime() - a.modified.getTime());
  } else {
    project = { projectPath, projectName, sessions };
    projectMap.set(projectPath, project);
  }
}

/**
 * 列出指定根目录下的所有会话（按项目分组）
 * 
 * 支持两种目录结构：
 * 1. 扁平结构：session 文件直接放在 sessionsRoot 下
 * 2. 嵌套结构：session 文件放在 sessionsRoot/<subdir>/ 下
 */
export async function listAllSessions(sessionsRoot: string): Promise<ScannedProject[]> {
  const projectMap = new Map<string, ScannedProject>();
  
  try {
    if (!fs.existsSync(sessionsRoot)) {
      return [];
    }
    
    const entries = await readdir(sessionsRoot, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        // 嵌套结构：子目录中的 session 文件
        const dirPath = path.join(sessionsRoot, entry.name);
        const sessions = await scanSessionDir(dirPath);
        addSessionsToProjectMap(projectMap, sessions, entry.name);
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        // 扁平结构：根目录下的 session 文件
        const filePath = path.join(sessionsRoot, entry.name);
        const session = await readSessionHeader(filePath);
        if (session) {
          addSessionsToProjectMap(projectMap, [session], session.cwd || sessionsRoot);
        }
      }
    }
  } catch (error) {
    console.error('列出会话失败:', error);
  }
  
  // 按最后修改时间降序排列项目
  const projects = Array.from(projectMap.values());
  projects.sort((a, b) => {
    const aLatest = a.sessions[0]?.modified.getTime() || 0;
    const bLatest = b.sessions[0]?.modified.getTime() || 0;
    return bLatest - aLatest;
  });
  
  return projects;
}

/**
 * 查找指定 sessionId 的会话文件路径
 * 
 * 支持扁平结构和嵌套结构
 */
export async function findSessionFile(sessionsRoot: string, sessionId: string): Promise<string | null> {
  if (!fs.existsSync(sessionsRoot)) {
    return null;
  }

  try {
    const entries = await readdir(sessionsRoot, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        // 嵌套结构
        const dirPath = path.join(sessionsRoot, entry.name);
        const files = await readdir(dirPath);
        const jsonlFile = files.find(f => f.endsWith('.jsonl') && f.includes(sessionId));
        if (jsonlFile) {
          return path.join(dirPath, jsonlFile);
        }
      } else if (entry.isFile() && entry.name.endsWith('.jsonl') && entry.name.includes(sessionId)) {
        // 扁平结构
        return path.join(sessionsRoot, entry.name);
      }
    }
  } catch (error) {
    console.error(`查找会话文件失败: ${sessionId}`, error);
  }
  
  return null;
}
