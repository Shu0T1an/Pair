# Pair 前端布局文档

> 更新日期：2026-05-16

## 整体布局结构

Pair 的页面采用 **全屏纵向布局**，内部嵌套 **横向双栏** 结构：

```
┌─────────────────────────────────────────────────────────────────┐
│  TitleBar (h-8, shrink-0)                    ─ □ ×             │
├─────────────────────────────────────────────────────────────────┤
│  flex-1 flex gap-4 p-4                                          │
│                                                                 │
│  ┌────────────┐  ┌───────────────────────────────────────────┐  │
│  │ SessionList│  │  main (flex-1, rounded-2xl, border)       │  │
│  │  (w-64)    │  │                                           │  │
│  │  shrink-0  │  │  ┌───────────────────────────────────┐    │  │
│  │            │  │  │ Header (h-10)                      │    │  │
│  │ ┌────────┐ │  │  │ ⚡ Pair │ 当前会话名      ☀ ⚙     │    │  │
│  │ │新建    │ │  │  └───────────────────────────────────┘    │  │
│  │ │工作区  │ │  │                                           │  │
│  │ └────────┘ │  │  ┌───────────────────────────────────┐    │  │
│  │            │  │  │ TabBar (标签栏，可横向滚动)        │    │  │
│  │ 工作区     │  │  │ [会话1] [会话2] [会话3] ...        │    │  │
│  │            │  │  └───────────────────────────────────┘    │  │
│  │ ▼ 项目A   │  │                                           │  │
│  │   会话1    │  │  ┌───────────────────────────────────┐    │  │
│  │   会话2    │  │  │                                   │    │  │
│  │            │  │  │     MessageList (flex-1)          │    │  │
│  │ ▶ 项目B   │  │  │                                   │    │  │
│  │            │  │  │     消息气泡区域                   │    │  │
│  │            │  │  │                                   │    │  │
│  │            │  │  └───────────────────────────────────┘    │  │
│  │            │  │                                           │  │
│  │ ────────── │  │  ┌───────────────────────────────────┐    │  │
│  │ ⚙ 设置    │  │  │ ChatInput (输入框)                 │    │  │
│  └────────────┘  │  │ [模型▾] [输入区域...] [发送 ▶]    │    │  │
│                  │  └───────────────────────────────────┘    │  │
│                  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 层级说明

### 第 1 层：页面根容器

```tsx
// ChatPage.tsx
<div className="h-screen flex flex-col bg-background text-foreground">
```

- 全屏高度 (`h-screen`)
- 纵向 flex 布局
- 使用主题 CSS 变量 (`bg-background`, `text-foreground`)

### 第 2 层：TitleBar — 窗口标题栏

```tsx
// TitleBar.tsx
<div className="flex items-center justify-end h-8 bg-muted/30 shrink-0 select-none"
     style={{ WebkitAppRegion: 'drag' }}>
```

| 属性 | 值 | 说明 |
|------|-----|------|
| 高度 | `h-8` (32px) | 固定高度 |
| 布局 | `flex justify-end` | 按钮靠右 |
| 拖拽 | `WebkitAppRegion: drag` | 整行可拖拽窗口 |
| 按钮区 | `WebkitAppRegion: no-drag` | 最小化/最大化/关闭不触发拖拽 |

按钮组：`Minus` / `Square` / `X`，hover 时关闭按钮变红 (`hover:bg-destructive`)。

### 第 3 层：主内容区

```tsx
// ChatPage.tsx
<div className="flex-1 flex gap-4 p-4 min-h-0">
```

- `flex-1` 撑满剩余空间
- `flex` 横向排列（左栏 + 右栏）
- `gap-4` 左右栏间距 16px
- `p-4` 四周内边距 16px

---

## 左栏：SessionList — 会话侧边栏

```tsx
// ChatPage.tsx
<aside className="w-64 shrink-0">
```

| 属性 | 值 | 说明 |
|------|-----|------|
| 宽度 | `w-64` (256px) | 固定宽度 |
| 收缩 | `shrink-0` | 不随窗口缩小 |

### SessionList 内部结构

```tsx
<div className="flex flex-col h-full bg-card rounded-2xl shadow-sm border border-border p-3 overflow-hidden">
```

```
┌──────────────────────────┐
│ [＋ 新建工作区]    🔍    │  ← 顶部按钮 (h-10, rounded-xl)
├──────────────────────────┤
│ 工作区           置顶     │  ← 分类标题 (text-[11px], uppercase)
├──────────────────────────┤
│                          │
│ ▼ 项目A              [2] │  ← 项目标题（可折叠）
│   [status] 会话1    [⋯]  │    - 左侧：Chevron + 名称 + Badge
│   [status] 会话2    [⋯]  │    - 右侧：新增(+) + 删除(🗑)
│                          │
│ ▶ 项目B              [1] │  ← 折叠状态
│                          │
│        (ScrollArea)      │  ← 滚动区域 (flex-1)
│                          │
├──────────────────────────┤
│ ⚙ 设置                   │  ← 底部固定 (mt-auto, border-t)
└──────────────────────────┘
```

### SessionItem 布局

```tsx
<div className="grid grid-cols-[auto_1fr_auto] gap-2 px-3 py-2.5 rounded-xl">
```

```
┌─────────────────────────────────────┐
│ [●]  会话名称                  [🗑][⋯] │
│  ↑    ↑                         ↑   ↑
│ 状态  flex-1                   删除  更多菜单
│ 指示器 (truncate)                   (重命名)
└─────────────────────────────────────┘
```

- 活跃状态：`bg-white/80 shadow-sm border`
- 非活跃：`hover:bg-white/50`
- 编辑态：input 替换名称文本，`onBlur` 或 `Enter` 确认，`Escape` 取消

---

## 右栏：main — 主内容区

```tsx
// ChatPage.tsx
<main className="flex-1 min-h-0 bg-card rounded-2xl flex flex-col shadow-sm relative overflow-hidden border border-border">
```

| 属性 | 值 | 说明 |
|------|-----|------|
| 宽度 | `flex-1` | 自适应撑满 |
| 高度 | `min-h-0` | 允许 flex 子元素收缩 |
| 圆角 | `rounded-2xl` | 16px 圆角 |
| 溢出 | `overflow-hidden` | 裁剪子元素溢出 |

### 右栏内部三层结构

```
main (flex flex-col)
├── Header    (shrink-0, h-10)
├── TabBar    (shrink-0)
└── ChatArea  (flex-1, min-h-0)
    ├── MessageList  (flex-1)
    └── ChatInput    (shrink-0)
```

### Header — 顶部导航

```tsx
// Header.tsx
<div className="flex items-center justify-between h-10 px-4 select-none"
     style={{ WebkitAppRegion: 'drag' }}>
```

```
┌─────────────────────────────────────────────────────┐
│ [⚡ Pair] │ [会话名称...]           [☀/🌙] [⚙]    │
│  Logo      当前会话 (max-w-[200px])  主题切换  设置  │
└─────────────────────────────────────────────────────┘
```

- 左侧：Logo (6×6 圆角方块 + Zap 图标) + 应用名 + 当前会话名
- 右侧：主题切换按钮 + 设置按钮
- 整行可拖拽，按钮区域 `no-drag`

### TabBar — 标签栏

```tsx
// TabBar.tsx
<div className="flex items-center bg-muted/50 border-b border-border pr-4">
```

```
┌─────────────────────────────────────────────────────┐
│ [◀]  [会话1 ×] [会话2 ×] [会话3 ×] ...         [▶] │
│ 左滚   TabItem    TabItem    TabItem           右滚  │
└─────────────────────────────────────────────────────┘
```

- 标签超出时显示左右滚动按钮 (`ChevronLeft` / `ChevronRight`)
- 每个标签可关闭 (`×`)
- 无标签时不渲染 (`if (tabs.length === 0) return null`)

### ChatArea — 聊天区域

```tsx
// ChatArea.tsx
<div className="flex-1 flex flex-col min-h-0">
```

#### MessageList — 消息列表

- 使用 CSS Grid 布局：助手消息 `grid-cols-[36px_1fr]`，用户消息 `grid-cols-[1fr_36px]`
- 连续助手消息合并为一组，共享一个头像
- 支持 Thinking 块、工具调用面板
- 流式消息使用 RAF 节流

#### ChatInput — 输入框

- 底部固定，包含模型选择下拉、文本输入区、发送/中止按钮

---

## 响应式与主题

### 主题系统

通过 CSS 变量实现，7 套预设主题（`ThemeContext`）：

```css
--background / --foreground
--card / --card-foreground
--muted / --muted-foreground
--primary / --primary-foreground
--destructive / --destructive-foreground
--border / --ring
```

### 关键 CSS 类映射

| 类名 | 用途 |
|------|------|
| `bg-background` | 页面背景 |
| `bg-card` | 卡片背景（侧边栏、主内容区） |
| `bg-muted` / `bg-muted/50` | 次要背景（标签栏、标题栏） |
| `text-foreground` | 主文字色 |
| `text-muted-foreground` | 次要文字色 |
| `border-border` | 边框色 |
| `rounded-2xl` | 大圆角 (16px) |
| `rounded-xl` | 中圆角 (12px) |

## 组件依赖关系

```
ChatPage
├── TitleBar              (窗口控制)
├── SessionList           (会话管理)
│   ├── ScrollArea        (滚动容器)
│   ├── Button            (按钮)
│   ├── Badge             (计数徽章)
│   ├── DropdownMenu      (右键菜单)
│   └── SessionStatusIndicator (状态指示器)
├── Header                (顶部导航)
│   ├── Button
│   └── Tooltip
├── TabBar                (标签栏)
│   └── TabItem           (单个标签)
├── ChatArea              (聊天区域)
│   ├── MessageList       (消息列表)
│   │   ├── MessageGroup  (消息组)
│   │   ├── ThinkingBlock (思考块)
│   │   └── ToolCallPanel (工具调用面板)
│   └── ChatInput         (输入框)
└── SettingsModal         (设置弹窗)
```
