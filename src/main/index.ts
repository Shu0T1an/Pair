import { app, BrowserWindow, shell, session } from 'electron';
import path from 'path';
import { AgentManager } from './agent-manager.js';
import { IPCHandler } from './ipc-handler.js';

// 禁用 GPU 加速（可选，解决某些显卡问题）
// app.disableHardwareAcceleration();

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
const agentManager = new AgentManager();
const ipcHandler = new IPCHandler(agentManager);

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
