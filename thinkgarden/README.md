# 🌱 ThinkGarden

> AI 驱动的知识框架引擎 — 让零散经验成长为体系化知识

ThinkGarden 是一款 **Electron 桌面应用**，帮助你为任意学习/工作领域搭建专属的知识框架。它以**水平树形思维导图**为核心载体，结合 **AI 大模型**自动分析、归位、发散你的个人实践经验，让知识不再是碎片化的笔记，而是一棵持续生长的知识树。

---

## 🧠 核心理念

1. **AI 生成知识框架** — 描述你的学习领域，AI 自动生成从入门到精通的结构化框架（思维导图）
2. **随时记录经验** — 随手写下实践心得，AI 自动定位经验在框架中的位置
3. **对话中提取知识** — 粘贴与 AI 的对话记录，自动提取可复用的经验节点
4. **AI 巡检与发散** — AI 定期检查框架健康度，推荐你可能需要的相关知识
5. **框架持续演化** — 支持多框架管理、版本快照、导入导出，框架随你的认知不断进化

---

## ✨ 主要功能

### 🗺️ 知识框架可视化
- 基于 **ReactFlow** 的交互式水平树形思维导图
- 支持 6 种节点类型：分类(category)、步骤(step)、原则(principle)、技巧(tip)、警告(warning)、个人笔记(user_note)
- 每种节点有独特的颜色和形状，直观区分知识类型
- 拖拽平移、滚轮缩放、点击查看详情
- 自动适配视口（fitView）

### 🤖 AI 能力矩阵
| 能力 | 说明 |
|------|------|
| **AI 对话式建框架** | 描述领域 → AI 生成初步框架 → 对话迭代优化 → 确认创建 |
| **经验智能归位** | 粘贴一条经验 → AI 分析语义 → 自动定位到框架正确位置 → 生成标题/摘要/标签 |
| **对话摘要提取** | 粘贴与 AI 的对话记录 → 自动提取关键经验节点 |
| **框架巡检** | AI 全面检查框架健康度（空洞检测、结构失衡、内容缺失、重复检测） |
| **实践提醒** | 描述即将开始的项目 → AI 根据框架中的 warning/principle 给出针对性提醒 |
| **语义搜索** | 用自然语言搜索框架内容 → AI 返回最相关节点 |

### 🏗️ 多框架管理
- 创建多个知识框架（不同领域独立管理）
- AI 对话式创建：输入领域描述，AI 生成并迭代优化
- 切换/重命名/删除框架
- 当前框架状态持久化记忆

### 📋 快照与导出
- 创建框架快照，随时回退到历史版本
- 导出为 **Markdown** 文档
- 导出为 **Mermaid 流程图**代码
- 全局数据导入/导出（JSON 格式，含完整备份）

### ✂️ 智能剪贴板
- 自动监听剪贴板变化
- 智能识别代码/错误/技术文本
- 捕获后弹出浮窗，一键提交为收件箱笔记

### 🎨 本地数据安全
- 基于 **sql.js**（纯 JS SQLite）的本地数据库
- 所有数据存储在本地，无需联网
- 暗色主题 UI，护眼舒适

---

## 🧰 技术栈

| 层级 | 技术 |
|------|------|
| **桌面框架** | Electron 35 |
| **前端框架** | Next.js 15 (App Router, SSG Export) |
| **UI 库** | React 18 + TypeScript |
| **样式** | Tailwind CSS (暗色主题) |
| **思维导图** | @xyflow/react v12 (ReactFlow) |
| **数据库** | sql.js（纯 JS 实现的 SQLite） |
| **Markdown 渲染** | react-markdown + remark-gfm |
| **AI 调用** | OpenAI 兼容协议（支持 7 家厂商） |

---

## 📁 项目结构

```
thinkgarden/
├── electron/                   # Electron 主进程
│   ├── main.ts                 # 主进程入口、窗口管理、自定义协议、剪贴板监听
│   ├── preload.ts              # 预加载脚本、contextBridge API 暴露
│   ├── constants.ts            # IPC 通道常量定义
│   ├── ipc-handlers.ts         # IPC 处理器注册
│   ├── ai-service.ts           # AI 服务层（LLM 调用、Prompt 工程、重试机制）
│   ├── db/
│   │   ├── database.ts         # 数据库初始化、自动迁移、框架 CRUD、数据导入导出
│   │   ├── nodes.ts            # 框架节点 CRUD（树形结构操作、路径查询）
│   │   ├── notes.ts            # 收件箱笔记管理、AI 归位分析上下文
│   │   ├── tags.ts             # 标签 CRUD
│   │   ├── search.ts           # 搜索（LIKE + AI 语义搜索）
│   │   ├── snapshots.ts        # 快照创建与恢复
│   │   └── export.ts           # Markdown / Mermaid 导出
│   └── tsconfig.json
├── src/                        # Next.js 渲染进程
│   ├── app/
│   │   ├── page.tsx            # 主页面布局（侧边栏 + 思维导图）
│   │   ├── layout.tsx          # 根布局
│   │   └── globals.css         # 全局样式（暗色主题变量 + CSS 自定义属性）
│   ├── components/
│   │   ├── framework/
│   │   │   ├── MindMap.tsx     # ReactFlow 思维导图容器（水平树形布局 + 自动视口适配）
│   │   │   ├── MindMapNode.tsx # 自定义节点渲染组件
│   │   │   └── FrameworkWizard.tsx # AI 对话式框架创建向导（3 步流程）
│   │   ├── ai/
│   │   │   ├── InspectionPanel.tsx      # AI 巡检报告面板
│   │   │   ├── ConversationSummaryPanel.tsx # AI 对话摘要面板
│   │   │   ├── PracticeReminder.tsx     # 实践提醒面板
│   │   │   └── PlacementResult.tsx      # AI 归位结果展示
│   │   ├── input/
│   │   │   └── QuickInput.tsx  # 快速输入面板（含剪贴板捕获浮窗）
│   │   ├── common/
│   │   │   └── NodeDetail.tsx  # 节点详情面板
│   │   ├── Settings.tsx        # AI 模型设置（7 家厂商下拉选择）
│   │   ├── Sidebar.tsx         # 侧边栏（框架列表、搜索、标签、快照、导出）
│   │   └── TitleBar.tsx        # 自定义标题栏
│   ├── hooks/
│   │   ├── useFramework.ts     # 框架数据 hook
│   │   ├── useAI.ts            # AI 功能 hook
│   │   ├── useSearch.ts        # 搜索 hook
│   │   └── useTags.ts          # 标签 hook
│   └── lib/
│       ├── types.ts            # TypeScript 类型定义
│       └── electron.d.ts       # Electron API 类型声明
├── scripts/
│   └── dev.mjs                 # 开发启动脚本（Electron + Next.js 并行）
├── start.ps1                   # 桌面快捷方式启动脚本（PowerShell）
├── start.bat                   # 桌面快捷方式启动脚本（CMD）
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
└── next.config.ts
```

---

## 🚀 快速开始

### 环境要求

- **Node.js** >= 18
- **npm** >= 9
- （可选）**Ollama** — 如果使用本地模型

### 安装与运行

```bash
# 1. 进入项目目录
cd thinkgarden

# 2. 安装依赖
npm install

# 3. 启动开发模式（Electron + Next.js 同时启动）
npm run dev:desktop
```

### 桌面快捷方式

双击桌面上的 **ThinkGarden** 快捷方式即可直接启动。如果没有快捷方式，可以通过以下方式创建：

**Windows（PowerShell）：**
```powershell
.\start.ps1
```

**或命令行：**
```cmd
start.bat
```

### 配置 AI 模型

首次使用需要配置 AI 模型：

1. 点击左上角 **⚙️ 设置** 按钮
2. 选择 AI 服务商（支持 DeepSeek、OpenAI、智谱 AI、Moonshot、通义千问、豆包、Ollama、自定义）
3. 填写对应平台的 API Key
4. 选择模型后点击保存

---

## 🤖 支持的 AI 服务商

| 服务商 | 可用模型 | API Key 获取 |
|--------|---------|-------------|
| **DeepSeek** | deepseek-chat, deepseek-reasoner | [platform.deepseek.com](https://platform.deepseek.com) |
| **OpenAI** | gpt-4o-mini, gpt-4o, gpt-4-turbo | [platform.openai.com](https://platform.openai.com) |
| **智谱 AI (GLM)** | glm-4-flash, glm-4-air, glm-4-plus | [open.bigmodel.cn](https://open.bigmodel.cn) |
| **Moonshot (Kimi)** | moonshot-v1-8k, moonshot-v1-32k | [platform.moonshot.cn](https://platform.moonshot.cn) |
| **通义千问 (Qwen)** | qwen-turbo, qwen-plus, qwen-max | [dashscope.console.aliyun.com](https://dashscope.console.aliyun.com) |
| **豆包 (Doubao)** | doubao-1.5-pro-32k, doubao-1.5-lite-32k | [console.volcengine.com/ark](https://console.volcengine.com/ark) |
| **Ollama (本地)** | qwen2.5:7b, llama3.1:8b, deepseek-r1:7b 等 | 本地安装，无需 Key |

所有服务商均通过 **OpenAI 兼容协议** (`/v1/chat/completions`) 调用，也支持自定义兼容 endpoint。

---

## 📖 使用指南

### 1. 创建知识框架

点击侧边栏 **「+ 新建框架」** → 输入你想学习的领域（如"Python 后端开发"、"摄影后期处理"）→ AI 生成初步框架 → 你可以继续与 AI 对话调整框架 → 确认后框架即创建完毕。

### 2. 记录实践经验

- **快捷输入**：点击侧边栏「快速输入」，写下你的经验心得
- **AI 归位**：AI 会分析你的经验，定位它在框架中的正确位置，同时推荐 2-3 条相关知识
- 确认归位后，节点会自动添加到思维导图中的对应位置

### 3. 提取对话经验

点击思维导图顶部的 **「对话摘要」** 按钮 → 粘贴你与 AI（如 ChatGPT、Claude）的对话记录 → AI 自动提取其中有价值的经验节点 → 一键添加到框架。

### 4. AI 框架巡检

点击 **「AI 巡检」** → AI 检查框架健康度：
- 🔴 空洞分支：某分类下缺少你的个人经验
- 🟡 结构失衡：分支过深或节点过多
- 🔵 内容缺失：重要阶段内容不足
- 🟣 重复检测：语义相似的节点

### 5. 实践前的提醒

开始新项目前，点击 **「实践提醒」** → 描述你即将做什么 → AI 根据框架中的警告和原则节点，提醒你注意事项。

### 6. 框架演化

- **手动编辑**：点击任意节点可修改标题、内容、类型
- **拖拽重组**：可调整节点在框架中的位置
- **快照备份**：重要版本创建快照，随时恢复
- **导出分享**：导出为 Markdown 文档或 Mermaid 流程图

---

## 🗄️ 数据库结构

```
frameworks         # 框架表（id, name, description, icon, created_at）
  └── framework_nodes  # 节点表（title, content, node_type, parent_id, framework_id）
        └── node_tags   # 节点-标签关联表
  └── inbox_notes     # 收件箱笔记表（content, status, ai_result）
  └── snapshots       # 快照表（name, data, framework_id）
tags              # 标签表（name, color）
app_config        # 应用配置表（key, value）
```

数据文件自动存储在 Electron `userData` 目录下的 `thinkgarden.db`。

---

## 🔧 构建与打包

```bash
# 构建 Next.js + 编译 Electron TypeScript
npm run build:desktop

# 打包为可运行目录（不安装）
npm run pack

# 打包为分发包（安装包）
npm run dist

# 仅启动 Electron（需要先 build）
npm start
```

---

## 📋 版本迭代

### v0.1.0 (2026-05-28) — 首个可用版本

**✅ 已完成的核心功能：**

| 模块 | 状态 | 说明 |
|------|:----:|------|
| Electron 桌面框架 | ✅ | 无边框窗口、自定义标题栏、自定义 `app://` 协议、GPU 加速 |
| 数据库层 | ✅ | sql.js（纯 JS SQLite）、自动迁移、7 张表完整 CRUD |
| 多框架管理 | ✅ | 创建/切换/重命名/删除框架、框架列表持久化 |
| AI 对话式建框架 | ✅ | 3 步向导：描述领域 → AI 对话优化 → 预览确认 |
| 水平树形思维导图 | ✅ | ReactFlow 自定义节点、6 种节点类型、自动布局、fitView |
| 经验智能归位 | ✅ | 输入经验 → AI 分析定位 → 自动添加节点 + 推荐相关知识 |
| AI 对话摘要 | ✅ | 粘贴对话 → AI 提取经验节点 → 批量添加 |
| AI 框架巡检 | ✅ | 健康评分 + 问题诊断 + 优化建议 |
| AI 实践提醒 | ✅ | 描述新项目 → AI 推荐框架中的 warnings 和 principles |
| 语义搜索 | ✅ | 自然语言搜索 + LIKE 全文搜索 |
| 多厂商 AI 适配 | ✅ | DeepSeek / OpenAI / 智谱 / Moonshot / 通义千问 / 豆包 / Ollama |
| 剪贴板监听 | ✅ | 智能识别代码/错误/技术文本，捕获后一键提交 |
| 快照管理 | ✅ | 创建/恢复框架快照 |
| 数据导出 | ✅ | Markdown / Mermaid / JSON 全量导入导出 |
| 标签系统 | ✅ | 标签 CRUD、节点标签关联、标签筛选搜索 |
| 节点详情编辑 | ✅ | 点击节点查看/修改标题、内容、类型 |
| 桌面快捷方式 | ✅ | PowerShell 启动脚本 + 桌面 .lnk 快捷方式 |

**🐛 已修复的关键问题：**

- 修复 Windows 下 better-sqlite3 编译失败 → 改用 sql.js
- 修复 Electron `loadFile` 静态资源路径解析失败 → 注册 `app://` 自定义协议
- 修复 ReactFlow 自定义节点不显示 → `useMemo` 副作用改为 `useEffect` + `applyNodeChanges`
- 修复 `useReactFlow()` context 错误 → 抽取 `AutoFitView` 子组件
- 修复框架创建后思维导图全黑 → flex 容器链断裂导致高度为 0
- 修复 AI 框架创建后节点不显示 → 异步插入竞态改为 `async/await` 顺序执行
- 修复思维导图布局简陋 → 重写为水平树形递归布局算法

**📐 当前架构：**

```
┌───────────── Electron Main Process ─────────────┐
│  main.ts    │  ipc-handlers.ts  │  ai-service.ts │
│  窗口管理    │  IPC 通道注册      │  LLM 调用/Prompt│
│  剪贴板监听  │                   │  重试/解析     │
├──────────────────────────────────────────────────┤
│  db/  (sql.js 纯 JS SQLite)                     │
│  database / nodes / notes / tags / search /     │
│  snapshots / export                              │
└──────────────────────────────────────────────────┘
         ↕ IPC (contextBridge)
┌──────────── Next.js Renderer Process ────────────┐
│  page.tsx ─┬─ Sidebar.tsx  (框架/搜索/标签)       │
│            ├─ MindMap.tsx   (ReactFlow 思维导图)  │
│            ├─ Settings.tsx  (AI 模型配置)         │
│            └─ TitleBar.tsx  (自定义标题栏)        │
│  components/ framework/ai/input/common/           │
│  hooks/ useFramework useAI useSearch useTags     │
└──────────────────────────────────────────────────┘
```

---

## 🗺️ 下一步计划

### v0.2.0 — 功能细节完善

| 优先级 | 计划 | 说明 |
|:------:|------|------|
| 🔴 高 | 节点交互增强 | 支持拖拽移动节点、调整父子关系、同级排序 |
| 🔴 高 | 编辑体验优化 | 富文本编辑器、Markdown 实时预览、节点内图片支持 |
| 🟡 中 | AI 能力深化 | AI 建议节点合并/拆分、自动补全框架空白区域 |
| 🟡 中 | 搜索体验增强 | 搜索结果高亮定位、搜索历史、最近查看 |
| 🟢 低 | 收件箱管理 | 批量确认/拒绝、已处理历史、笔记关联节点跳转 |

### v0.3.0 — 界面外观升级

| 优先级 | 计划 | 说明 |
|:------:|------|------|
| 🔴 高 | 主题系统 | 亮色/暗色主题切换、自定义主题色、多套预设主题 |
| 🔴 高 | 节点样式自定义 | 自定义节点颜色、图标选择器、连线样式配置 |
| 🟡 中 | 布局选项 | 切换垂直/水平/放射状布局、紧凑/宽松间距模式 |
| 🟡 中 | 动画与过渡 | 节点展开/折叠动画、连线流动效果、框架切换过渡 |
| 🟢 低 | 多语言支持 | 中/英界面切换、i18n 国际化框架 |

### 更远期规划

- **云端同步**：框架数据加密同步到云端，多设备共享
- **协作编辑**：邀请他人协作编辑框架，评论与批注
- **模板市场**：分享和下载社区贡献的框架模板
- **移动端**：React Native 或 PWA 移动端适配

---

## 📄 License

MIT

---

<p align="center">
  <sub>Built with 🌱 and AI</sub>
</p>