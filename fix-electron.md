# 修复 Electron 安装和 Preload 脚本问题

## 问题分析

从错误信息看，有两个主要问题：

1. **Electron 二进制文件未正确安装**
   ```
   Error: Electron failed to install correctly. Please delete `node_modules/electron` and run "npx install-electron --no" manually.
   ```

2. **Preload 脚本加载问题**
   ```
   TypeError: Cannot read properties of undefined (reading 'session')
   ```
   这表明 `window.electronAPI.session` 未定义，说明 preload 脚本没有正确加载或执行出错。

## 解决方案

### 步骤 1: 手动安装 Electron 二进制文件

```bash
# 删除现有的 electron 模块
rm -rf node_modules/electron

# 重新安装 electron
npm install electron@42.0.1

# 或者使用 cnpm（如果 npm 下载慢）
# cnpm install electron@42.0.1
```

如果网络问题，可以尝试使用淘宝镜像：
```bash
npm config set electron_mirror https://cdn.npmmirror.com/binaries/electron/
npm install electron@42.0.1
```

### 步骤 2: 验证 Electron 安装

```bash
# 检查 electron 是否安装成功
npx electron --version
```

### 步骤 3: 修复 Preload 脚本路径问题

检查 `src/main/index.ts` 中的 preload 路径配置。当前配置可能有问题。

让我检查并修复：