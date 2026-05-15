import { Notification, BrowserWindow } from 'electron';
import type { NotificationConfig } from '../shared/types.js';
import { DEFAULT_NOTIFICATION_CONFIG } from '../shared/types.js';

/**
 * 通知管理器 - 负责发送系统通知
 */
export class NotificationManager {
  private config: NotificationConfig;
  private mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow, initialConfig?: Partial<NotificationConfig>) {
    this.mainWindow = mainWindow;
    this.config = { ...DEFAULT_NOTIFICATION_CONFIG, ...initialConfig };
  }

  /**
   * 检查是否应该发送通知
   */
  shouldNotify(): boolean {
    // 通知禁用时不需要发送
    if (!this.config.enabled) {
      return false;
    }

    // 窗口在前台时不需要发送
    if (this.mainWindow.isFocused()) {
      return false;
    }

    return true;
  }

  /**
   * 发送系统通知
   */
  sendNotification(title?: string, body?: string): void {
    if (!this.shouldNotify()) {
      return;
    }

    const notificationTitle = title || this.config.title;
    const notificationBody = body || this.config.body;

    const notification = new Notification({
      title: notificationTitle,
      body: notificationBody,
      silent: true,
    });

    notification.on('click', () => {
      if (this.mainWindow) {
        if (this.mainWindow.isMinimized()) {
          this.mainWindow.restore();
        }
        this.mainWindow.focus();
      }
    });

    notification.show();
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): NotificationConfig {
    return { ...this.config };
  }
}
