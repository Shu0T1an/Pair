import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationManager } from '../notification.js';
import type { BrowserWindow } from 'electron';
import type { NotificationConfig } from '../../shared/types.js';

// Mock Electron Notification
vi.mock('electron', () => ({
  Notification: vi.fn().mockImplementation(() => ({
    show: vi.fn(),
    on: vi.fn(),
  })),
}));

describe('NotificationManager', () => {
  let mockMainWindow: BrowserWindow;
  let notificationManager: NotificationManager;

  beforeEach(() => {
    mockMainWindow = {
      isFocused: vi.fn().mockReturnValue(false),
      isMinimized: vi.fn().mockReturnValue(false),
      restore: vi.fn(),
      focus: vi.fn(),
    } as unknown as BrowserWindow;

    notificationManager = new NotificationManager(mockMainWindow);
  });

  it('应该使用默认配置初始化', () => {
    const config = notificationManager.getConfig();
    expect(config).toEqual({
      enabled: true,
      title: 'Pair',
      body: 'AI 已完成回复',
      triggerEvent: 'agent_end',
    });
  });

  it('窗口在前台时不应该发送通知', () => {
    vi.mocked(mockMainWindow.isFocused).mockReturnValue(true);
    expect(notificationManager.shouldNotify()).toBe(false);
  });

  it('窗口在后台且通知启用时应该发送通知', () => {
    vi.mocked(mockMainWindow.isFocused).mockReturnValue(false);
    expect(notificationManager.shouldNotify()).toBe(true);
  });

  it('通知禁用时不应该发送通知', () => {
    notificationManager.updateConfig({ enabled: false });
    expect(notificationManager.shouldNotify()).toBe(false);
  });

  it('应该能更新配置', () => {
    const newConfig: Partial<NotificationConfig> = {
      title: '自定义标题',
      body: '自定义正文',
    };
    notificationManager.updateConfig(newConfig);
    const config = notificationManager.getConfig();
    expect(config.title).toBe('自定义标题');
    expect(config.body).toBe('自定义正文');
  });
});
