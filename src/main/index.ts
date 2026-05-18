import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { AgentManager } from './agent-manager.js';
import { IPCHandler } from './ipc-handler.js';
import { StorageManager } from './storage-manager.js';
import { McpServerRegistry } from './mcp/mcp-server-registry.js';

// 禁用 GPU 加速（可选，解决某些显卡问题）
// app.disableHardwareAcceleration();

const isDev = !app.isPackaged;

// 设置应用 ID（Windows 任务栏图标必须）
app.setAppUserModelId('com.pair');

let mainWindow: BrowserWindow | null = null;

// 先创建 StorageManager，再注入 AgentManager
const storageManager = new StorageManager();
const mcpRegistry = new McpServerRegistry();
const agentManager = new AgentManager(storageManager, mcpRegistry);
const ipcHandler = new IPCHandler(agentManager, storageManager);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: false, // 无边框窗口
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: isDev 
        ? path.join(app.getAppPath(), 'dist/main/main/preload.js') 
        : path.join(__dirname, 'preload.js'),
    },
    backgroundColor: '#1a1a2e',
    show: false,
    icon: isDev
      ? path.join(process.cwd(), 'build/icon.ico')
      : path.join(__dirname, '../../build/icon.ico'),
  });

  // 设置 IPC 处理器的主窗口引用
  ipcHandler.setMainWindow(mainWindow);

  // 加载应用
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // 打开外部链接时用浏览器
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 应用准备好后创建窗口
app.whenReady().then(() => {
  createWindow();

  // 自动连接 MCP 服务器
  mcpRegistry.connectAllAutoStart().catch(err =>
    console.error('[Main] 自动连接 MCP 服务器失败:', err)
  );

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭时退出（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 应用退出前断开所有 MCP 连接
app.on('before-quit', async () => {
  await mcpRegistry.disconnectAll();
});
