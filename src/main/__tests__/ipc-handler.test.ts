import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IPCHandler } from '../ipc-handler';
import { AgentManager } from '../agent-manager';
import { ipcMain } from 'electron';

// 模拟 electron
vi.mock('electron', () => {
  return {
    ipcMain: {
      handle: vi.fn(),
      removeHandler: vi.fn(),
    },
    BrowserWindow: vi.fn(),
  };
});

describe('IPCHandler', () => {
  let agentManager: AgentManager;
  let ipcHandler: IPCHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    agentManager = new AgentManager();
    ipcHandler = new IPCHandler(agentManager);
  });

  it('should create IPCHandler instance', () => {
    expect(ipcHandler).toBeDefined();
  });

  it('should register handlers on creation', () => {
    expect(ipcMain.handle).toHaveBeenCalled();
  });

  it('should set main window', () => {
    const mockWindow = {} as any;
    expect(() => ipcHandler.setMainWindow(mockWindow)).not.toThrow();
  });

  it('should dispose handlers', () => {
    ipcHandler.dispose();
    expect(ipcMain.removeHandler).toHaveBeenCalled();
  });
});