import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentManager } from '../agent-manager';
import { StorageManager } from '../storage-manager';
import path from 'path';
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
});