# 修复 Electron 和 Preload 脚本问题

## 问题分析

从错误信息看，有两个主要问题：

1. **Electron 二进制文件未安装**
   ```
   Error: Electron failed to install correctly. Please delete `node_modules/electron` and run "npx install-electron --no" manually.
   ```

2. **Preload 脚本未正确加载**
   ```
   TypeError: Cannot read properties of undefined (reading 'session')
   ```
   这表明 `window.electronAPI.session` 未定义，说明 preload 脚本没有正确加载或执行出错。

## 解决步骤

### 步骤 1: 手动安装 Electron 二进制文件

```bash
# 1. 删除现有的 electron 模块
rm -rf node_modules/electron

# 2. 清除 npm 缓存
npm cache clean --force

# 3. 重新安装 electron（使用淘宝镜像加速）
npm config set electron_mirror https://cdn.npmmirror.com/binaries/electron/
npm install electron@42.0.1

# 或者使用 cnpm
# npm install -g cnpm --registry=https://registry.npmmirror.com
# cnpm install electron@42.0.1
```

### 步骤 2: 验证 Electron 安装

```bash
# 检查 electron 是否安装成功
npx electron --version
# 应该输出：v42.0.1
```

### 步骤 3: 编译主进程代码

```bash
# 编译 TypeScript 主进程代码
npm run build:electron
```

### 步骤 4: 启动应用

```bash
# 开发模式（推荐）
npm run dev:electron

# 或者构建后启动
npm run build:electron
npx electron .
```

### 步骤 5: 测试 Preload 脚本

在浏览器控制台中，检查 `window.electronAPI` 是否存在：

```javascript
console.log('electronAPI:', window.electronAPI);
console.log('test:', window.electronAPI?.test); // 应该输出 'preload-works'
console.log('session:', window.electronAPI?.session); // 应该是一个对象
```

## 如果问题仍然存在

### 检查 Preload 脚本路径

在 `src/main/index.ts` 中，preload 路径已更新为：
```typescript
preload: isDev 
  ? path.join(app.getAppPath(), 'dist/main/main/preload.js') 
  : path.join(__dirname, 'preload.js'),
```

确保 `dist/main/main/preload.js` 文件存在：
```bash
ls -la dist/main/main/preload.js
```

### 检查 Electron 版本兼容性

确保 `package.json` 中的 electron 版本与安装的版本一致：
```json
"devDependencies": {
  "electron": "^42.0.1"
}
```

### 添加调试日志

在 `src/main/index.ts` 中添加日志：
```typescript
console.log('Preload path:', preloadPath);
console.log('App path:', app.getAppPath());
console.log('__dirname:', __dirname);
```

### 检查 Preload 脚本内容

确保 `dist/main/main/preload.js` 包含正确的暴露代码：
```javascript
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
  test: 'preload-works',
  session: { ... },
  // ...
});
```

## 常见问题

### 1. 网络问题导致 Electron 下载失败
- 使用淘宝镜像：`npm config set electron_mirror https://cdn.npmmirror.com/binaries/electron/`
- 或者手动下载 Electron 二进制文件并放到 `node_modules/electron/dist/` 目录

### 2. Preload 脚本路径错误
- 确保在开发模式下运行 `npm run dev:electron`（而不是 `npm run dev`）
- 检查 `dist/main/main/preload.js` 是否存在

### 3. 安全限制
- 确保 `contextIsolation: true` 和 `nodeIntegration: false`
- 使用 `contextBridge.exposeInMainWorld` 暴露 API

### 4. 缓存问题
- 清除 Electron 缓存：`rm -rf ~/.electron/`
- 重新安装 node_modules：`rm -rf node_modules && npm install`

## 验证修复

1. 启动应用：`npm run dev:electron`
2. 打开开发者工具（F12）
3. 在控制台中输入：`window.electronAPI`
4. 应该看到一个对象，包含 `test`、`session`、`message` 等属性

如果看到 `undefined`，说明 preload 脚本没有加载。检查控制台是否有错误信息。

## 联系支持

如果问题仍然存在，请提供：
1. 操作系统版本
2. Node.js 版本：`node --version`
3. npm 版本：`npm --version`
4. 完整的错误信息
5. `dist/main/main/preload.js` 的内容