import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentManager } from '../agent-manager';
import { StorageManager } from '../storage-manager';
import path from 'path';
import fs from 'fs';
import os from 'os';

// vi.mock 工厂会被 hoist 到文件顶部，所以路径定义必须用 var 确保可用
var testDir = '';
var storageManager: StorageManager;
vi.mock('electron', () => {
  return {
    app: {
      getPath: () => testDir,
    },
    ipcMain: {
      handle: vi.fn(),
      removeHandler: vi.fn(),
    },
    BrowserWindow: vi.fn(),
  };
});

function createAgentManager(overrideRoot?: string): AgentManager {
  storageManager = new StorageManager();
  // 如果传入了 overrideRoot，则设置 dataRoot 到临时目录
  if (overrideRoot) {
    storageManager.setDataRoot(overrideRoot);
  }
  return new AgentManager(storageManager);
}

/**
 * 从 session 文件中读取 session_info 的 name
 */
function readNameFromFile(sessionFile: string): string | undefined {
  if (!fs.existsSync(sessionFile)) return undefined;
  const content = fs.readFileSync(sessionFile, 'utf-8');
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const entry = JSON.parse(trimmed);
      if (entry.type === 'session_info') {
        return entry.name;
      }
    } catch {
      // skip
    }
  }
  return undefined;
}

describe('AgentManager', () => {
  beforeEach(() => {
    // 每个测试用例使用独立的 temp 目录
    testDir = path.join(os.tmpdir(), 'pair-agent-test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
  });

  it('should create a new session', async () => {
    const manager = createAgentManager(testDir);
    const session = await manager.createSession({
      projectPath: '/test/project',
    });
    expect(session).toBeDefined();
    expect(session.id).toBeDefined();
    expect(session.projectPath).toBe('/test/project');
  });

  it('should list sessions by project', async () => {
    const manager = createAgentManager(testDir);
    
    await manager.createSession({ projectPath: '/project1' });
    await manager.createSession({ projectPath: '/project1' });
    await manager.createSession({ projectPath: '/project2' });
    
    const sessions = await manager.listSessions();
    expect(sessions).toHaveLength(2);
    const p1 = sessions.find(p => p.projectPath === '/project1');
    const p2 = sessions.find(p => p.projectPath === '/project2');
    expect(p1?.sessions).toHaveLength(2);
    expect(p2?.sessions).toHaveLength(1);
  });

  it('should delete a session', async () => {
    const manager = createAgentManager(testDir);
    const session = await manager.createSession({ projectPath: '/test' });
    
    await manager.deleteSession(session.id);
    
    const sessions = await manager.listSessions();
    expect(sessions).toHaveLength(0);
  });

  it('should throw when deleting non-existent session', async () => {
    const manager = createAgentManager(testDir);
    
    await expect(manager.deleteSession('non-existent')).rejects.toThrow();
  });

  // ── rename / updateSessionInfo 测试 ──

  it('should rename a session that is in memory', async () => {
    const manager = createAgentManager(testDir);
    const session = await manager.createSession({ projectPath: '/test' });

    manager.updateSessionInfo(session.id, { name: '新名称' });

    const info = manager.getSessionInfo(session.id);
    expect(info?.name).toBe('新名称');
  });

  it('should persist rename to session file', async () => {
    const manager = createAgentManager(testDir);
    const session = await manager.createSession({ projectPath: '/test' });

    manager.updateSessionInfo(session.id, { name: '持久化测试' });

    // 从文件中读取验证
    const info = manager.getSessionInfo(session.id);
    const file = info?.sessionFile;
    expect(file).toBeDefined();
    expect(readNameFromFile(file!)).toBe('持久化测试');
  });

  it('should rename a session that is NOT in memory (only scanned from file)', async () => {
    // 第一个 manager 创建 session 并写入文件
    const manager1 = createAgentManager(testDir);
    const session = await manager1.createSession({ projectPath: '/test' });
    const sessionId = session.id;
    const sessionFile = session.sessionFile;

    // 第二个 manager 不 resume，session 不在内存中
    const manager2 = createAgentManager(testDir);
    // updateSessionInfo 应该不抛异常，直接写文件
    expect(() => {
      manager2.updateSessionInfo(sessionId, { name: '文件重命名' });
    }).not.toThrow();

    // 验证文件中的名称已更新
    expect(readNameFromFile(sessionFile!)).toBe('文件重命名');
  });

  it('should keep renamed name after listSessions (file rescan)', async () => {
    const manager = createAgentManager(testDir);
    const session = await manager.createSession({ projectPath: '/test' });

    manager.updateSessionInfo(session.id, { name: '重命名后列表' });

    // listSessions 会重新扫描文件
    const projects = await manager.listSessions();
    const found = projects
      .flatMap(p => p.sessions)
      .find(s => s.id === session.id);

    expect(found?.name).toBe('重命名后列表');
  });

  it('should keep renamed name after resumeSession (simulating app restart)', async () => {
    // 第一个 manager 创建并重命名
    const manager1 = createAgentManager(testDir);
    const session = await manager1.createSession({ projectPath: '/test' });
    manager1.updateSessionInfo(session.id, { name: '重启后名称' });

    // 第二个 manager 模拟重启，resume session
    const manager2 = createAgentManager(testDir);
    await manager2.resumeSession(session.id);
    const info = manager2.getSessionInfo(session.id);

    expect(info?.name).toBe('重启后名称');
  });

  it('should update session_info line when file already has one', async () => {
    const manager = createAgentManager(testDir);
    const session = await manager.createSession({ projectPath: '/test' });
    // createSession 已经写入了 session_info 行

    // 重命名两次
    manager.updateSessionInfo(session.id, { name: '第一次' });
    manager.updateSessionInfo(session.id, { name: '第二次' });

    const file = session.sessionFile!;
    const content = fs.readFileSync(file, 'utf-8');
    // 确保只有一个 session_info 行
    const matches = content.match(/"type":"session_info"/g);
    expect(matches?.length).toBe(1);
    expect(readNameFromFile(file)).toBe('第二次');
  });

  it('should not throw when renaming session with non-existent sessionId', async () => {
    const manager = createAgentManager(testDir);
    // 不存在的 session，文件也找不到，应该静默处理
    expect(() => {
      manager.updateSessionInfo('non-existent-id', { name: '不存在' });
    }).not.toThrow();
  });
});
