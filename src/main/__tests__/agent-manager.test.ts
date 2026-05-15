import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentManager } from '../agent-manager';
import path from 'path';
import os from 'os';
import fs from 'fs';

// vi.mock 工厂会被 hoist 到文件顶部，所以路径定义必须用 var 确保可用
var testDir = '';
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

describe('AgentManager', () => {
  beforeEach(() => {
    // 每个测试用例使用独立的 temp 目录
    testDir = path.join(os.tmpdir(), 'pair-agent-test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
    // 清理可能的残留文件
    try {
      const metadataFile = path.join(testDir, 'session-metadata.json');
      if (fs.existsSync(metadataFile)) {
        fs.unlinkSync(metadataFile);
      }
    } catch (e) {
      // ignore
    }
  });

  it('should create a new session', async () => {
    const manager = new AgentManager();
    const session = await manager.createSession({
      projectPath: '/test/project',
    });
    expect(session).toBeDefined();
    expect(session.id).toBeDefined();
    expect(session.projectPath).toBe('/test/project');
  });

  it('should list sessions by project', async () => {
    const manager = new AgentManager();
    
    await manager.createSession({ projectPath: '/project1' });
    await manager.createSession({ projectPath: '/project1' });
    await manager.createSession({ projectPath: '/project2' });
    
    const sessions = await manager.listSessions();
    expect(sessions).toHaveLength(2);
    expect(sessions[0].sessions).toHaveLength(2);
    expect(sessions[1].sessions).toHaveLength(1);
  });

  it('should delete a session', async () => {
    const manager = new AgentManager();
    const session = await manager.createSession({ projectPath: '/test' });
    
    await manager.deleteSession(session.id);
    
    const sessions = await manager.listSessions();
    expect(sessions).toHaveLength(0);
  });

  it('should throw when deleting non-existent session', async () => {
    const manager = new AgentManager();
    
    await expect(manager.deleteSession('non-existent')).rejects.toThrow();
  });
});