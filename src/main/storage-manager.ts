import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';

export interface StorageConfig {
  dataRoot: string;
}

export class StorageManager {
  private configPath: string;
  private config: StorageConfig;
  
  constructor() {
    // 配置文件存储在 userData 目录
    this.configPath = path.join(app.getPath('userData'), 'storage-config.json');
    this.config = this.loadConfig();
  }
  
  /**
   * 加载配置
   */
  private loadConfig(): StorageConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('加载存储配置失败:', error);
    }
    
    // 返回默认配置
    return { dataRoot: '' };
  }
  
  /**
   * 保存配置
   */
  private saveConfig(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (error) {
      console.error('保存存储配置失败:', error);
    }
  }
  
  /**
   * 获取默认数据根目录 (~/Pair/)
   */
  getDefaultDataRoot(): string {
    const homeDir = os.homedir();
    return path.join(homeDir, 'Pair');
  }
  
  /**
   * 获取当前数据根目录
   */
  getDataRoot(): string {
    return this.config.dataRoot || this.getDefaultDataRoot();
  }
  
  /**
   * 获取 sessions 目录路径
   */
  getSessionsDir(): string {
    return path.join(this.getDataRoot(), 'sessions');
  }
  
  /**
   * 更新数据根目录
   */
  setDataRoot(newRoot: string): void {
    this.config.dataRoot = newRoot;
    this.saveConfig();
  }
  
  /**
   * 获取指定项目的 session 子目录路径
   * 目录名由 projectPath 编码生成，确保文件系统安全
   */
  getProjectSessionsDir(projectPath: string): string {
    const encoded = Buffer.from(projectPath).toString('base64url');
    return path.join(this.getSessionsDir(), encoded);
  }

  /**
   * 确保目录存在
   */
  ensureDirectories(): void {
    const sessionsDir = this.getSessionsDir();
    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
    }
  }
  
  /**
   * 迁移数据到新目录
   */
  async migrateData(oldRoot: string, newRoot: string): Promise<void> {
    const oldSessionsDir = path.join(oldRoot, 'sessions');
    const newSessionsDir = path.join(newRoot, 'sessions');
    
    // 如果旧目录不存在，跳过
    if (!fs.existsSync(oldSessionsDir)) {
      return;
    }
    
    // 确保新目录存在
    if (!fs.existsSync(newSessionsDir)) {
      fs.mkdirSync(newSessionsDir, { recursive: true });
    }
    
    // 复制所有文件
    await this.copyDirectory(oldSessionsDir, newSessionsDir);
  }
  
  /**
   * 递归复制目录
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    const entries = await fs.promises.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await fs.promises.mkdir(destPath, { recursive: true });
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.promises.copyFile(srcPath, destPath);
      }
    }
  }
}
