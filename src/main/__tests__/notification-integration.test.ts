import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationManager } from '../notification.js';
import type { BrowserWindow } from 'electron';

// Mock Electron Notification
const mockShow = vi.fn();
const mockOn = vi.fn();

vi.mock('electron', () => {
  return {
    Notification: class MockNotification {
      show = mockShow;
      on = mockOn;
      constructor() {}
    },
  };
});

describe('NotificationManager 集成测试', () => {
  let mockMainWindow: BrowserWindow;
  let notificationManager: NotificationManager;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockMainWindow = {
      isFocused: vi.fn().mockReturnValue(false),
      isMinimized: vi.fn().mockReturnValue(false),
      restore: vi.fn(),
      focus: vi.fn(),
    } as unknown as BrowserWindow;

    notificationManager = new NotificationManager(mockMainWindow);
  });

  it('应该在窗口后台且通知启用时发送通知', () => {
    vi.mocked(mockMainWindow.isFocused).mockReturnValue(false);
    notificationManager.updateConfig({ enabled: true });
    
    notificationManager.sendNotification();
    
    // 验证 show 被调用
    expect(mockShow).toHaveBeenCalled();
  });

  it('应该在窗口前台时不发送通知', () => {
    vi.mocked(mockMainWindow.isFocused).mockReturnValue(true);
    
    notificationManager.sendNotification();
    
    // 验证 show 未被调用
    expect(mockShow).not.toHaveBeenCalled();
  });

  it('应该在通知禁用时不发送通知', () => {
    notificationManager.updateConfig({ enabled: false });
    
    notificationManager.sendNotification();
    
    // 验证 show 未被调用
    expect(mockShow).not.toHaveBeenCalled();
  });

  it('应该支持自定义标题和正文', () => {
    vi.mocked(mockMainWindow.isFocused).mockReturnValue(false);
    
    notificationManager.sendNotification('自定义标题', '自定义正文');
    
    // 验证 show 被调用
    expect(mockShow).toHaveBeenCalled();
  });
});
