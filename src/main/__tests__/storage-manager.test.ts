import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StorageManager } from '../storage-manager';
import path from 'path';
import fs from 'fs';
import os from 'os';

var testDir = '';
vi.mock('electron', () => {
  return {
    app: { getPath: () => testDir },
    ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
    BrowserWindow: vi.fn(),
  };
});

describe('StorageManager', () => {
  let storageManager: StorageManager;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), 'pair-storage-test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
    fs.mkdirSync(testDir, { recursive: true });
    storageManager = new StorageManager();
  });

  afterEach(() => {
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch { /* ignore cleanup errors */ }
  });

  it('should use default data root when config is empty', () => {
    const dataRoot = storageManager.getDataRoot();
    expect(dataRoot).toBe(path.join(os.homedir(), 'Pair'));
  });

  it('should return custom data root after setting', () => {
    const customPath = path.join(testDir, 'custom-data');
    storageManager.setDataRoot(customPath);
    expect(storageManager.getDataRoot()).toBe(customPath);
  });

  it('should return sessions directory path', () => {
    storageManager.setDataRoot(testDir);
    expect(storageManager.getSessionsDir()).toBe(path.join(testDir, 'sessions'));
  });

  it('should encode project path for sessions dir', () => {
    storageManager.setDataRoot(testDir);
    const encoded = Buffer.from('/test/project').toString('base64url');
    expect(storageManager.getProjectSessionsDir('/test/project'))
      .toBe(path.join(testDir, 'sessions', encoded));
  });

  it('should create sessions directory', () => {
    storageManager.setDataRoot(testDir);
    storageManager.ensureDirectories();
    expect(fs.existsSync(path.join(testDir, 'sessions'))).toBe(true);
  });

  it('should persist config to file', () => {
    const customPath = path.join(testDir, 'persisted-data');
    storageManager.setDataRoot(customPath);

    // 创建新的 StorageManager 实例验证持久化
    const storageManager2 = new StorageManager();
    expect(storageManager2.getDataRoot()).toBe(customPath);
  });

  it('should migrate data from old root to new root', async () => {
    const oldRoot = path.join(testDir, 'old');
    const newRoot = path.join(testDir, 'new');

    fs.mkdirSync(path.join(oldRoot, 'sessions', 'sub'), { recursive: true });
    fs.writeFileSync(path.join(oldRoot, 'sessions', 'session-1.jsonl'), 'test content');
    fs.writeFileSync(path.join(oldRoot, 'sessions', 'sub', 'session-2.jsonl'), 'sub content');

    storageManager.setDataRoot(oldRoot);
    await storageManager.migrateData(oldRoot, newRoot);

    expect(fs.existsSync(path.join(newRoot, 'sessions', 'session-1.jsonl'))).toBe(true);
    expect(fs.existsSync(path.join(newRoot, 'sessions', 'sub', 'session-2.jsonl'))).toBe(true);
  });

  it('should skip migration when old root does not exist', async () => {
    const nonExistent = path.join(testDir, 'non-existent');
    await expect(
      storageManager.migrateData(nonExistent, path.join(testDir, 'new'))
    ).resolves.not.toThrow();
  });
});
