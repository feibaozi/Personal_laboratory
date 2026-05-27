# Vibecoding 实践框架 — 项目实施方案

> **文档状态：** 方案设计阶段  
> **创建日期：** 2026-05-26  
> **当前阶段：** 不做编码开发，仅完成方案设计

---

## 目录

1. [项目背景分析](#1-项目背景分析)
2. [目标设定](#2-目标设定)
3. [需求拆解](#3-需求拆解)
4. [技术选型](#4-技术选型)
5. [架构设计](#5-架构设计)
6. [数据模型设计](#6-数据模型设计)
7. [模块划分](#7-模块划分)
8. [AI 交互协议设计](#8-ai-交互协议设计)
9. [UI/UX 设计概要](#9-uiux-设计概要)
10. [进度规划与里程碑](#10-进度规划与里程碑)
11. [风险评估及应对策略](#11-风险评估及应对策略)
12. [附录](#12-附录)

---

## 1. 项目背景分析

### 1.1 用户画像

- **角色：** Vibecoding 实践者，通过 AI Agent 辅助开发各类小工具和小程序
- **技术栈：** Electron + Next.js + TypeScript + Tailwind CSS
- **工程能力：** 中等偏基础，能理解和修改 AI 生成的代码，但不擅长独立架构设计
- **核心痛点：** 积累了大量碎片化的实践经验，但缺乏系统化的整理和沉淀手段

### 1.2 痛点分析

| 痛点 | 现状 | 影响 |
|------|------|------|
| 经验碎片化 | 心得散落在聊天记录、代码注释、大脑里 | 下次遇到同类问题需要重新踩坑 |
| 无结构沉淀 | 没有统一的框架把经验组织成可复用的知识 | 知识无法积累和迭代 |
| 缺乏 AI 辅助整理 | 写完笔记就完了，没有智能分类和关联 | 零散的笔记无法形成体系 |
| 个性化不足 | 通用教程不贴合自己的技术栈和习惯 | 别人的经验不能直接套用 |

### 1.3 核心洞察

用户的本质需求不是“做笔记”，而是**借助 AI 构建一个活的知识框架**：

- **初始框架**由 AI 根据 vibecoding 最佳实践生成（思维导图/流程图）
- **个性化经验**被 AI 自动归位到框架的正确节点
- **AI 发散推荐**相关知识点，帮助用户查漏补缺
- 框架随时间**持续演化**，最终形成带有个人风格的实践方法论

---

## 2. 目标设定

### 2.1 产品目标

打造一个 **AI 驱动的 Vibecoding 实践框架管理工具**，帮助用户：

1. **结构化沉淀：** 将碎片化的 vibecoding 经验转化为有层级、可检索的知识树
2. **智能归位：** AI 自动理解用户输入的笔记内容，将其挂载到框架的正确位置
3. **主动发散：** AI 根据用户新增的经验，推荐可能相关的补充知识点
4. **持续演化：** 框架随着实践积累不断生长，从通用模板变为个人方法论

### 2.2 成功标准

- 用户能在 **30 秒内** 完成一条经验的输入和归位
- AI 归位的准确率 > 80%（用户无需手动调整节点位置）
- 框架在积累 **50 条以上** 个人经验后，能形成明显的个人风格特征
- 用户能在 **3 秒内** 通过搜索或导航找到任意一条已记录的经验

### 2.3 非目标（本期不做）

- 多用户协作 / 团队共享
- 导出为 PDF / Notion / Obsidian
- 移动端适配
- 离线 AI 模型（依赖云端 API）

---

## 3. 需求拆解

### 3.1 功能需求全景

```
┌──────────────────────────────────────────────────────────────┐
│                    Vibecoding 实践框架                        │
├───────────────┬───────────────┬───────────────┬──────────────┤
│  框架视图     │  笔记输入     │  AI 归位      │  知识检索     │
│  (随时可看)   │  (随时可写)   │  (自动内化)   │  (随时可查)   │
├───────────────┼───────────────┼───────────────┼──────────────┤
│ · 思维导图    │ · 快速输入框  │ · 分析笔记    │ · 全文搜索    │
│ · 节点展开    │ · 标签选择    │ · 推荐节点    │ · 标签过滤    │
│ · 缩放拖拽    │ · 来源标记    │ · 生成摘要    │ · 时间线      │
│ · 搜索高亮    │ · Markdown    │ · 发散推荐    │ · 来源筛选    │
└───────────────┴───────────────┴───────────────┴──────────────┘
```

### 3.2 详细功能需求

#### FR-1: 框架初始化
- **FR-1.1** 应用首次启动时，调用 AI 生成一份 Vibecoding 标准实践流程思维导图
- **FR-1.2** 导图以树形结构存储，覆盖：需求分析、技术选型、原型搭建、迭代开发、测试调试、部署发布 等阶段
- **FR-1.3** 用户可对 AI 生成的框架进行确认、微调后正式启用

#### FR-2: 随手记录
- **FR-2.1** 提供全局快捷键或快捷入口，一键打开输入面板
- **FR-2.2** 输入支持纯文本和 Markdown 格式
- **FR-2.3** 可为笔记附加标签和来源信息（哪个项目/哪次对话）
- **FR-2.4** 支持暂存草稿，稍后再提交 AI 处理

#### FR-3: AI 智能归位
- **FR-3.1** 用户提交笔记后，AI 分析内容语义，推荐最佳挂载节点
- **FR-3.2** 推荐结果以可视化方式展示（高亮目标节点、显示路径）
- **FR-3.3** 用户可确认推荐、手动调整节点、或拒绝归位（笔记仅保存在收件箱）
- **FR-3.4** AI 同时生成该笔记的标题和摘要

#### FR-4: AI 发散推荐
- **FR-4.1** 在归位完成后，AI 主动推荐 2-3 条可能相关的补充知识点
- **FR-4.2** 推荐内容以卡片形式展示，用户可勾选加入框架
- **FR-4.3** 推荐逻辑基于：同父节点下的其他知识、框架中已有的关联节点

#### FR-5: 框架浏览与探索
- **FR-5.1** 以思维导图/树形图形式展示整个框架
- **FR-5.2** 支持节点展开/折叠、拖拽平移、缩放
- **FR-5.3** 点击节点查看详情（标题、内容、标签、来源、创建时间）
- **FR-5.4** 支持搜索并高亮匹配节点
- **FR-5.5** 区分 AI 生成节点和用户添加节点的视觉样式

#### FR-6: 知识检索
- **FR-6.1** 全文搜索：搜索标题、内容、摘要
- **FR-6.2** 标签过滤：按标签筛选节点
- **FR-6.3** 来源筛选：按项目/工具筛选
- **FR-6.4** 时间线视图：按时间查看所有笔记

#### FR-7: 框架管理
- **FR-7.1** 手动添加/编辑/删除节点
- **FR-7.2** 拖拽调整节点位置
- **FR-7.3** 合并重复节点
- **FR-7.4** 导出/导入框架数据（备份迁移）

---

## 4. 技术选型

### 4.1 技术栈总览

| 层级 | 技术选型 | 选型理由 |
|------|---------|---------|
| 桌面框架 | **Electron** | 用户已熟悉，可复用 mood-radio 的 Electron 配置经验 |
| 前端框架 | **Next.js (App Router)** + **React 18** | 用户现有技术栈，SSG 模式打包为静态文件给 Electron 加载 |
| 样式方案 | **Tailwind CSS** | 用户现有方案，快速构建 UI |
| 思维导图渲染 | **D3.js** 或 **ReactFlow** | 树形图可视化，ReactFlow 更适合交互式节点操作 |
| 本地数据库 | **better-sqlite3** | 单文件数据库，支持 FTS5 全文搜索，性能优异 |
| AI 接口 | **兼容 OpenAI 协议的 API** | 灵活可替换（OpenAI / Claude / 本地模型），用户可根据实际情况配置 |
| Markdown 渲染 | **react-markdown** + **remark-gfm** | 轻量级 Markdown 渲染 |
| 状态管理 | **React Context + useReducer** | 应用规模不大，无需引入 Redux/Zustand |

### 4.2 关键依赖版本（建议）

```json
{
  "electron": "^28.0.0",
  "next": "^14.0.0",
  "react": "^18.2.0",
  "better-sqlite3": "^11.0.0",
  "reactflow": "^11.10.0",
  "react-markdown": "^9.0.0",
  "tailwindcss": "^3.4.0",
  "typescript": "^5.3.0"
}
```

### 4.3 技术选型对比分析

#### 思维导图渲染库

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **ReactFlow** | 原生 React 支持，节点可自定义，交互丰富 | 包体积偏大 (~500KB) | ⭐⭐⭐⭐⭐ |
| D3.js | 灵活度最高，社区庞大 | 学习曲线陡，需手动处理交互 | ⭐⭐⭐ |
| 纯 CSS + SVG | 无依赖，轻量 | 复杂交互需大量自研 | ⭐⭐ |

**推荐 ReactFlow**：它提供开箱即用的节点拖拽、连线、缩放平移，且节点组件完全可自定义，适合构建思维导图式界面。

#### 数据库方案确认

选用 **better-sqlite3**，在 Electron 主进程中运行：
- 同步 API 简单直接，无需处理异步回调
- 单文件存储，备份迁移方便
- FTS5 全文搜索引擎支持中文
- 通过 IPC 暴露给渲染进程

### 4.4 项目结构预览

```
vibecoding-framework/
├── electron/
│   ├── main.ts              # Electron 主进程入口
│   ├── preload.ts           # 预加载脚本（IPC 桥接）
│   ├── db/
│   │   ├── database.ts      # 数据库初始化、迁移
│   │   ├── nodes.ts         # 框架节点 CRUD
│   │   ├── notes.ts         # 笔记/收件箱 CRUD
│   │   ├── tags.ts          # 标签 CRUD
│   │   └── search.ts        # FTS5 搜索
│   ├── ipc-handlers.ts      # IPC 处理器注册
│   └── ai-service.ts        # AI API 调用封装
├── src/
│   ├── app/
│   │   ├── layout.tsx       # 根布局
│   │   └── page.tsx         # 主页面
│   ├── components/
│   │   ├── framework/
│   │   │   ├── MindMap.tsx          # 思维导图主组件
│   │   │   ├── MindMapNode.tsx      # 单个节点组件
│   │   │   └── MindMapControls.tsx  # 缩放/导航控件
│   │   ├── input/
│   │   │   ├── QuickInput.tsx       # 快速输入面板
│   │   │   └── InputDraft.tsx       # 草稿箱
│   │   ├── ai/
│   │   │   ├── PlacementResult.tsx  # AI 归位结果展示
│   │   │   └── SuggestionCards.tsx  # AI 发散推荐卡片
│   │   ├── search/
│   │   │   ├── SearchBar.tsx        # 搜索栏
│   │   │   └── SearchResults.tsx    # 搜索结果列表
│   │   └── common/
│   │       ├── NodeDetail.tsx       # 节点详情面板
│   │       ├── TagBadge.tsx         # 标签徽章
│   │       └── Timeline.tsx         # 时间线视图
│   ├── hooks/
│   │   ├── useFramework.ts  # 框架数据获取
│   │   ├── useSearch.ts     # 搜索逻辑
│   │   └── useAI.ts         # AI 交互逻辑
│   ├── lib/
│   │   ├── types.ts         # 类型定义
│   │   └── electron.d.ts    # Electron API 类型声明
│   └── styles/
│       └── globals.css
├── package.json
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## 5. 架构设计

### 5.1 整体架构图

```
┌─────────────────────────────────────────────────────────┐
│                     Electron 桌面壳                      │
│  ┌───────────────────────────────────────────────────┐  │
│  │              Next.js 渲染进程                      │  │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────────────┐   │  │
│  │  │思维导图  │ │ 输入面板  │ │  搜索/时间线     │   │  │
│  │  │(ReactFlow)│ │(Markdown)│ │  (列表+过滤)     │   │  │
│  │  └────┬─────┘ └────┬─────┘ └───────┬──────────┘   │  │
│  │       └──────────────┼──────────────┘              │  │
│  │                      │ IPC                         │  │
│  └──────────────────────┼────────────────────────────┘  │
│  ┌──────────────────────┼────────────────────────────┐  │
│  │              Electron 主进程                       │  │
│  │  ┌───────────────────┼─────────────────────────┐  │  │
│  │  │           IPC Handlers                       │  │  │
│  │  └───────┬───────────┼───────────┬─────────────┘  │  │
│  │          │           │           │                 │  │
│  │  ┌───────┴───┐ ┌─────┴─────┐ ┌───┴──────────┐   │  │
│  │  │ SQLite DB  │ │ AI Service│ │  File I/O     │   │  │
│  │  │(better-    │ │(OpenAI    │ │  (导出/导入)   │   │  │
│  │  │ sqlite3)   │ │ Comp. API)│ │               │   │  │
│  │  └───────────┘ └───────────┘ └───────────────┘   │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 5.2 数据流设计

#### 核心数据流：用户笔记 → AI 归位

```
用户输入笔记
    │
    ▼
渲染进程 QuickInput 组件
    │  IPC: 'submit-note'
    ▼
主进程 receive-note handler
    │
    ├──(1)──► 存入 notes 表（状态=待处理）
    │
    ├──(2)──► AI Service.analyze(note_content, framework_context)
    │              │
    │              ▼
    │         调用 LLM API，传入：
    │           - 用户笔记内容
    │           - 当前框架节点树摘要
    │           - System prompt（归位 + 发散推荐）
    │              │
    │              ▼
    │         AI 返回结构化 JSON：
    │           {
    │             target_node_id: "...",        // 推荐挂载节点
    │             confidence: 0.85,             // 置信度
    │             generated_title: "...",       // AI 生成的标题
    │             generated_summary: "...",     // AI 生成的摘要
    │             suggested_tags: ["...", "..."],
    │             related_suggestions: [         // 发散推荐
    │               { title: "...", description: "..." },
    │               { title: "...", description: "..." }
    │             ]
    │           }
    │
    └──(3)──► 通过 IPC 返回结果给渲染进程
                    │
                    ▼
            渲染进程展示 PlacementResult + SuggestionCards
                    │
              用户确认 / 调整 / 拒绝
                    │
                    ▼
            主进程：在框架树中创建节点，关联标签
```

#### 搜索数据流

```
用户输入搜索词
    │
    ▼
渲染进程 SearchBar
    │  IPC: 'search'
    ▼
主进程 search handler
    │
    └──► FTS5 MATCH 查询 entries_fts
         + 标签过滤
         + 来源过滤
              │
              ▼
         返回匹配的节点列表 + 节点在树中的路径
              │
              ▼
         渲染进程：列表中高亮，树中高亮对应节点
```

### 5.3 IPC 通道设计

| 通道名称 | 方向 | 用途 |
|---------|------|------|
| `db:init-framework` | 渲染→主 | 初始化/重置框架（调用 AI 生成初始树） |
| `db:get-framework` | 渲染→主 | 获取完整框架树 |
| `db:get-node` | 渲染→主 | 获取单个节点详情 |
| `db:submit-note` | 渲染→主 | 提交笔记，触发 AI 分析 |
| `db:confirm-placement` | 渲染→主 | 确认 AI 归位结果，创建节点 |
| `db:add-node` | 渲染→主 | 手动添加节点 |
| `db:update-node` | 渲染→主 | 编辑节点内容 |
| `db:delete-node` | 渲染→主 | 删除节点及子树 |
| `db:move-node` | 渲染→主 | 移动节点到新父节点 |
| `db:search` | 渲染→主 | 搜索节点 |
| `db:get-tags` | 渲染→主 | 获取所有标签 |
| `db:export-data` | 渲染→主 | 导出框架数据 |
| `db:import-data` | 渲染→主 | 导入框架数据 |
| `ai:analyze-note` | 渲染→主 | 仅分析笔记（不存入 DB，用于预览） |
| `app:get-config` | 渲染→主 | 获取应用配置（API Key 等） |
| `app:set-config` | 渲染→主 | 更新应用配置 |

---

## 6. 数据模型设计

### 6.1 SQLite 表结构

```sql
-- ============================================================
-- 1. 框架节点表
--    存储思维导图中每一个节点的信息
--    使用 parent_id 形成树形结构
-- ============================================================
CREATE TABLE framework_nodes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id   INTEGER REFERENCES framework_nodes(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,                        -- 节点标题
  content     TEXT NOT NULL DEFAULT '',             -- 详细内容（Markdown）
  summary     TEXT,                                 -- 一句话摘要
  node_type   TEXT NOT NULL DEFAULT 'step'
                CHECK(node_type IN (
                  'category',     -- 大类/阶段（如"需求分析阶段"）
                  'step',         -- 具体步骤（如"用AI写PRD"）
                  'principle',    -- 原则/方法论
                  'tip',          -- 实用技巧
                  'warning',      -- 避坑警告
                  'user_note'     -- 用户的个性化笔记
                )),
  source_type TEXT NOT NULL DEFAULT 'ai'
                CHECK(source_type IN ('ai', 'user', 'ai_suggested')),
  source_ref  TEXT,                                 -- 来源说明（如"mood-radio项目"）
  sort_order  INTEGER NOT NULL DEFAULT 0,           -- 同级排序
  icon        TEXT,                                 -- 可选图标 emoji
  color       TEXT,                                 -- 可选节点颜色
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ============================================================
-- 2. 标签表
-- ============================================================
CREATE TABLE tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  color      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ============================================================
-- 3. 节点-标签关联表
-- ============================================================
CREATE TABLE node_tags (
  node_id INTEGER NOT NULL REFERENCES framework_nodes(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (node_id, tag_id)
);

-- ============================================================
-- 4. 收件箱表（待处理的笔记）
--    用户在归位确认前，笔记先存在这里
-- ============================================================
CREATE TABLE inbox_notes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  content        TEXT NOT NULL,                     -- 原始笔记内容
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK(status IN ('pending', 'analyzed', 'confirmed', 'rejected')),
  ai_result      TEXT,                              -- AI 分析结果（JSON）
  result_node_id INTEGER REFERENCES framework_nodes(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ============================================================
-- 5. 应用配置表
-- ============================================================
CREATE TABLE app_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 预置配置项：
-- 'api_endpoint'   - AI API 地址
-- 'api_key'        - API 密钥
-- 'api_model'      - 模型名称
-- 'first_run'      - 是否首次运行（控制是否弹出初始化向导）

-- ============================================================
-- 6. 全文搜索虚拟表（FTS5）
-- ============================================================
CREATE VIRTUAL TABLE nodes_fts USING fts5(
  title,
  content,
  summary,
  source_ref,
  tokenize='unicode61 remove_diacritics 2'
);

-- FTS 同步触发器
CREATE TRIGGER nodes_fts_ai AFTER INSERT ON framework_nodes BEGIN
  INSERT INTO nodes_fts(rowid, title, content, summary, source_ref)
  VALUES (new.id, new.title, new.content, new.summary, new.source_ref);
END;

CREATE TRIGGER nodes_fts_ad AFTER DELETE ON framework_nodes BEGIN
  INSERT INTO nodes_fts(nodes_fts, rowid, title, content, summary, source_ref)
  VALUES ('delete', old.id, old.title, old.content, old.summary, old.source_ref);
END;

CREATE TRIGGER nodes_fts_au AFTER UPDATE ON framework_nodes BEGIN
  INSERT INTO nodes_fts(nodes_fts, rowid, title, content, summary, source_ref)
  VALUES ('delete', old.id, old.title, old.content, old.summary, old.source_ref);
  INSERT INTO nodes_fts(rowid, title, content, summary, source_ref)
  VALUES (new.id, new.title, new.content, new.summary, new.source_ref);
END;

-- ============================================================
-- 7. 索引
-- ============================================================
CREATE INDEX idx_nodes_parent    ON framework_nodes(parent_id);
CREATE INDEX idx_nodes_type      ON framework_nodes(node_type);
CREATE INDEX idx_nodes_source    ON framework_nodes(source_type);
CREATE INDEX idx_nodes_sort      ON framework_nodes(parent_id, sort_order);
CREATE INDEX idx_nodes_created   ON framework_nodes(created_at);
CREATE INDEX idx_inbox_status    ON inbox_notes(status);
```

### 6.2 AI 初始化生成的框架示例

AI 在首次启动时生成的初始框架树结构示意：

```
Vibecoding 实践框架 (root, type=category)
├── 1. 需求分析与规划 (category)
│   ├── 1.1 用 AI 梳理需求 (step)
│   ├── 1.2 生成 PRD/功能清单 (step)
│   ├── 1.3 评估可行性与范围 (step)
│   └── 1.4 制定 MVP 边界 (principle)
├── 2. 技术选型 (category)
│   ├── 2.1 让 AI 给多种方案对比 (step)
│   ├── 2.2 选择自己熟悉的技术栈 (principle)
│   └── 2.3 注意依赖的兼容性 (warning)
├── 3. 原型搭建 (category)
│   ├── 3.1 用 AI 生成项目脚手架 (step)
│   ├── 3.2 先跑通最小可运行版本 (principle)
│   └── 3.3 配置开发环境 (step)
├── 4. 迭代开发 (category)
│   ├── 4.1 Prompt 编写技巧 (category)
│   │   ├── 4.1.1 分步骤给指令 (tip)
│   │   ├── 4.1.2 提供上下文代码 (tip)
│   │   └── 4.1.3 要求 AI 先给方案再编码 (principle)
│   ├── 4.2 代码审查 (category)
│   │   ├── 4.2.1 AI 生成代码后必做 review (principle)
│   │   └── 4.2.2 关注安全与边界情况 (warning)
│   └── 4.3 调试与排错 (category)
│       ├── 4.3.1 把报错直接贴给 AI (tip)
│       └── 4.3.2 让 AI 解释而非直接修复 (tip)
├── 5. 测试与验证 (category)
│   ├── 5.1 让 AI 写测试用例 (step)
│   └── 5.2 手动验证关键路径 (principle)
└── 6. 部署与发布 (category)
    ├── 6.1 让 AI 生成部署脚本 (step)
    └── 6.2 版本管理与发布说明 (step)
```

---

## 7. 模块划分

### 7.1 模块依赖关系

```
┌──────────────┐
│   UI 层      │  React 组件，纯展示 + 用户交互
├──────────────┤
│   Hooks 层   │  状态管理、数据获取、用户操作逻辑
├──────────────┤
│   IPC 桥接层 │  preload.ts 暴露的安全 API
├──────────────┤
│   主进程层   │
│ ┌──────────┐ │
│ │ DB 模块  │ │  better-sqlite3 操作、FTS5 搜索
│ ├──────────┤ │
│ │ AI 模块  │ │  API 调用、Prompt 构建、响应解析
│ ├──────────┤ │
│ │ 配置模块 │ │  读取/写入应用配置
│ └──────────┘ │
└──────────────┘
```

### 7.2 各模块职责

#### M1: 数据库模块 (`electron/db/`)

| 文件 | 职责 |
|------|------|
| `database.ts` | 初始化数据库连接、执行建表迁移、提供数据库实例 |
| `nodes.ts` | 框架节点的 CRUD、树形查询、排序调整 |
| `notes.ts` | 收件箱笔记的 CRUD、状态流转 |
| `tags.ts` | 标签的 CRUD、关联查询 |
| `search.ts` | FTS5 全文搜索（含高亮片段提取） |

**验收标准：**
- 所有 CRUD 方法有对应的单元测试
- FTS5 搜索支持中文关键词，返回结果正确排序
- 删除节点时级联删除子节点

#### M2: AI 服务模块 (`electron/ai-service.ts`)

| 功能 | 说明 |
|------|------|
| `generateInitialFramework()` | 调用 AI 生成初始框架树结构 |
| `analyzeNote(content, framework)` | 分析笔记内容，返回归位建议 + 发散推荐 |
| `buildSystemPrompt()` | 构建 system prompt（包含框架上下文） |
| `parseAIResponse(raw)` | 解析 AI 返回的 JSON / 代码块 |

**Prompt 设计要点：**
- System prompt 需包含框架当前结构摘要（树形路径列表）
- 明确要求 AI 返回严格 JSON 格式
- 温度参数设低（0.3-0.5），保证归位一致性
- 发散推荐要求 AI 基于框架中已有但用户笔记未覆盖的相邻节点

**验收标准：**
- API 调用失败时有重试和错误提示
- AI 返回格式解析有容错处理（提取 JSON 代码块）
- 支持用户自定义 API endpoint 和 model

#### M3: IPC 通信模块 (`electron/ipc-handlers.ts`)

**验收标准：**
- 所有 IPC 通道正确注册
- 渲染进程无法直接访问 Node.js API（通过 preload 白名单暴露）
- 错误在 IPC 通道中正确传递

#### M4: 思维导图 UI 模块 (`src/components/framework/`)

**核心组件：**

| 组件 | 功能 |
|------|------|
| `MindMap.tsx` | ReactFlow 容器，管理节点和边的渲染 |
| `MindMapNode.tsx` | 自定义节点组件，根据 node_type 区分样式 |
| `MindMapControls.tsx` | 缩放滑块、适应视图、展开/折叠全部 |

**交互设计：**
- 点击节点 → 右侧弹出详情面板
- 双击节点 → 节点进入编辑模式
- 右键节点 → 上下文菜单（编辑/删除/添加子节点）
- 拖拽节点 → 改变父子关系
- 搜索时 → 匹配节点高亮，非匹配节点半透明

**验收标准：**
- 100+ 节点时渲染流畅（60fps）
- 节点可拖拽排序
- 搜索高亮响应及时（< 200ms）

#### M5: 输入面板模块 (`src/components/input/`)

| 组件 | 功能 |
|------|------|
| `QuickInput.tsx` | 快速输入框 + 提交按钮 + 标签/来源选择 |
| `InputDraft.tsx` | 暂存草稿列表 |

**验收标准：**
- 支持 `Ctrl+Enter` 提交
- 支持 Markdown 语法（实时预览可选）
- 提交后清空输入框，显示 AI 分析 loading 状态

#### M6: AI 交互 UI 模块 (`src/components/ai/`)

| 组件 | 功能 |
|------|------|
| `PlacementResult.tsx` | 展示 AI 推荐的挂载位置（节点路径面包屑） |
| `SuggestionCards.tsx` | 横向滚动的推荐卡片列表 |

**验收标准：**
- 推荐节点在导图中高亮闪烁
- 推荐卡片可一键添加/忽略
- 用户确认后节点出现在正确位置

#### M7: 搜索模块 (`src/components/search/`)

**验收标准：**
- 搜索结果实时更新（debounce 300ms）
- 搜索结果包含节点路径信息
- 点击结果跳转到对应节点并展开路径

---

## 8. AI 交互协议设计

### 8.1 初始化框架的 Prompt 设计

```
System:
你是一个资深的 Vibecoding 实践专家。Vibecoding 是指通过 AI Agent 辅助进行软件开发的工作方式。

请为 Vibecoding 的实践者生成一份完整的开发流程框架，以树形结构组织。

要求：
1. 覆盖从需求分析到部署发布的完整流程
2. 每个阶段包含具体的操作步骤和注意事项
3. 使用以下 JSON 格式返回：

{
  "framework": {
    "title": "Vibecoding 实践框架",
    "children": [
      {
        "title": "...",
        "node_type": "category",
        "children": [
          {
            "title": "...",
            "node_type": "step|principle|tip|warning",
            "content": "...",
            "summary": "..."
          }
        ]
      }
    ]
  }
}

User:
请生成 Vibecoding 实践框架
```

### 8.2 笔记归位分析的 Prompt 设计

```
System:
你是一个 Vibecoding 知识管理助手。用户有一个实践框架（树形结构），
用户会写下一段自己的实践经验，你需要：

1. 分析这段经验属于框架中的哪个节点
2. 为用户生成一个合适的标题和摘要
3. 推荐 2-3 条用户可能还需要补充的相关知识

当前框架结构如下（只显示节点路径）：
{framework_tree_paths}

请严格按以下 JSON 格式返回（不要包含其他文字）：

{
  "target_node_path": ["父节点", "目标节点"],
  "target_node_id": 123,
  "confidence": 0.85,
  "generated_title": "用 AI 生成代码前先让 AI 给方案",
  "generated_summary": "一条prompt技巧：...",
  "suggested_tags": ["prompt技巧", "代码生成"],
  "related_suggestions": [
    {
      "title": "如何写出好的 system prompt",
      "content": "...",
      "node_type": "tip",
      "reason": "你提到了 prompt 技巧，这条基础原则可能对你有帮助"
    }
  ]
}

User:
{user_note_content}
```

### 8.3 LLM 调用封装

```typescript
// electron/ai-service.ts 核心接口设计

interface AIServiceConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

interface PlacementResult {
  targetNodePath: string[];
  targetNodeId: number | null;
  confidence: number;
  generatedTitle: string;
  generatedSummary: string;
  suggestedTags: string[];
  relatedSuggestions: Suggestion[];
}

interface Suggestion {
  title: string;
  content: string;
  nodeType: 'step' | 'principle' | 'tip' | 'warning';
  reason: string;
}

class AIService {
  constructor(config: AIServiceConfig);
  
  // 生成初始框架
  async generateInitialFramework(): Promise<FrameworkTree>;
  
  // 分析笔记并返回归位建议
  async analyzeNote(
    content: string,
    frameworkContext: string
  ): Promise<PlacementResult>;
  
  // 底层调用
  private async callLLM(
    systemPrompt: string, 
    userMessage: string
  ): Promise<string>;
  
  // 安全解析 AI 返回的 JSON
  private parseJSONResponse(raw: string): any;
}
```

---

## 9. UI/UX 设计概要

### 9.1 布局设计

```
┌─────────────────────────────────────────────────┐
│  Title Bar (自定义标题栏)           [_][□][×]    │
├─────────────┬───────────────────────────────────┤
│  Sidebar    │                                   │
│ ┌─────────┐ │     ┌───────────────────────┐    │
│ │ 搜索框   │ │     │                       │    │
│ └─────────┘ │     │    思维导图主视图       │    │
│ ┌─────────┐ │     │    (ReactFlow)          │    │
│ │ 标签列表 │ │     │                       │    │
│ │         │ │     │   [节点]──[节点]       │    │
│ │ #prompt │ │     │     ├──[子节点]        │    │
│ │ #debug  │ │     │     └──[子节点]        │    │
│ │ #css    │ │     │                       │    │
│ └─────────┘ │     └───────────────────────┘    │
│ ┌─────────┐ │                                   │
│ │ 来源列表 │ │     ┌───────────────────────┐    │
│ └─────────┘ │     │  快速输入              │    │
│             │     │  [________________]     │    │
│             │     │  [标签] [来源] [提交]   │    │
│             │     └───────────────────────┘    │
├─────────────┴───────────────────────────────────┤
│  Status Bar (节点数 / 最近更新 / AI状态)         │
└─────────────────────────────────────────────────┘
```

### 9.2 核心交互流程

#### 首次使用流程
```
启动应用 → 欢迎页 → 配置 API Key → AI 生成初始框架
→ 展示思维导图 → 用户确认/微调 → 进入主界面
```

#### 日常使用流程
```
打开应用 → 浏览框架 / 搜索知识点
         → 有心得时：点击快速输入 (或 Ctrl+N)
         → 写笔记 → Ctrl+Enter 提交
         → AI 分析中... (loading)
         → 展示归位结果 + 发散推荐
         → 用户确认 → 框架更新
```

### 9.3 节点视觉区分

| node_type | 图标 | 颜色 | 形状 |
|-----------|------|------|------|
| category | 📁 | 蓝色 | 圆角矩形 |
| step | 📋 | 绿色 | 圆角矩形 |
| principle | 💡 | 紫色 | 菱形 |
| tip | ✨ | 黄色 | 圆角矩形 |
| warning | ⚠️ | 红色 | 六边形 |
| user_note | 👤 | 橙色 | 圆角矩形(虚线边框) |

### 9.4 关键交互细节

- **节点搜索高亮：** 输入搜索词后，匹配的节点以脉冲动画高亮，非匹配节点降低 opacity 到 0.3
- **AI 归位动画：** 新节点从输入面板位置"飞入"到框架中的目标位置
- **拖拽排序：** 同级节点可拖拽调整顺序，拖拽时显示插入指示线
- **空状态：** 首次使用前展示引导插图 + "点击开始构建你的实践框架"

---

## 10. 进度规划与里程碑

### 10.1 阶段总览

```
Phase 0: 方案设计    ████████████ 已完成 (当前文档)
Phase 1: 项目搭建    [████████████] 2-3 天
Phase 2: 数据层      [████████████] 3-4 天
Phase 3: AI 集成     [████████████] 3-4 天
Phase 4: 导图 UI     [████████████] 4-5 天
Phase 5: 输入 & 搜索 [████████████] 3-4 天
Phase 6: 联调打磨    [████████████] 3-4 天
Phase 7: 测试发布    [████████████] 2-3 天
─────────────────────────────────────────
总计预估：           20-27 天 (业余时间)
```

### 10.2 各阶段详细任务

---

#### Phase 1: 项目搭建（2-3 天）

**目标：** 搭建可运行的 Electron + Next.js 空壳项目，验证技术栈可行性。

| 任务 | 输出物 | 验收标准 |
|------|--------|---------|
| 1.1 初始化 Next.js + Electron 项目 | 项目目录结构 | `npm run dev` 能启动 Electron 窗口 |
| 1.2 配置 TypeScript + Tailwind | tsconfig, tailwind.config | 编译无报错，Tailwind 样式生效 |
| 1.3 安装 better-sqlite3 + ReactFlow | package.json | 依赖安装成功，Electron 能加载原生模块 |
| 1.4 配置 preload + IPC 基础通道 | main.ts, preload.ts | 渲染进程能调用 `db:ping` 返回 "pong" |
| 1.5 搭建基础布局组件 | layout.tsx, page.tsx | 显示空白的三栏布局 |

**检查点：** Electron 窗口打开 → 显示 Next.js 页面 → IPC 通信正常

---

#### Phase 2: 数据层（3-4 天）

**目标：** 完成数据库初始化、所有 CRUD 操作、FTS5 搜索。

| 任务 | 输出物 | 验收标准 |
|------|--------|---------|
| 2.1 实现 database.ts 初始化+迁移 | database.ts | 首次启动自动建表，重启不重复建表 |
| 2.2 实现 nodes.ts CRUD | nodes.ts | 能增删改查节点，支持树形查询 |
| 2.3 实现 tags.ts CRUD | tags.ts | 标签增删改查，关联查询 |
| 2.4 实现 search.ts FTS5 搜索 | search.ts | 中文搜索返回正确结果+排序 |
| 2.5 实现 inbox_notes CRUD | notes.ts | 笔记存入/取出/状态更新 |
| 2.6 实现 app_config 读写 | database.ts | 配置读写正常 |
| 2.7 注册所有 IPC 处理器 | ipc-handlers.ts | 所有通道正确注册并可调用 |
| 2.8 编写数据层单元测试 | *.test.ts | 核心 CRUD 方法覆盖率 > 80% |

**检查点：** 通过 IPC 能在渲染进程调用所有 DB 操作 → 数据正确持久化

---

#### Phase 3: AI 集成（3-4 天）

**目标：** 完成 AI 服务封装，实现框架初始化和笔记分析两大核心能力。

| 任务 | 输出物 | 验收标准 |
|------|--------|---------|
| 3.1 实现 AIService 基础封装 | ai-service.ts | 能调用 LLM API 并接收响应 |
| 3.2 实现 generateInitialFramework | ai-service.ts | 返回结构化框架 JSON |
| 3.3 实现 analyzeNote | ai-service.ts | 返回归位建议 + 发散推荐 |
| 3.4 实现 JSON 解析容错 | ai-service.ts | 能从各种格式中提取 JSON |
| 3.5 实现错误处理+重试 | ai-service.ts | 网络错误重试3次，超时提示 |
| 3.6 实现 API 配置界面 | Settings.tsx | 用户能配置 endpoint/key/model |
| 3.7 实现框架初始化流程 | IPC + UI | 首次启动 → 配置 API → 生成框架 → 写入DB |

**检查点：** 配置 API → 点击"生成框架" → 数据库中出现完整框架树

---

#### Phase 4: 思维导图 UI（4-5 天）

**目标：** 实现可交互的思维导图视图，支持浏览、搜索高亮、节点操作。

| 任务 | 输出物 | 验收标准 |
|------|--------|---------|
| 4.1 实现 MindMap 容器组件 | MindMap.tsx | 从 DB 加载数据渲染树形图 |
| 4.2 实现自定义节点组件 | MindMapNode.tsx | 不同 node_type 显示不同样式 |
| 4.3 实现缩放平移控件 | MindMapControls.tsx | 缩放 25%-200%，按钮+滚轮 |
| 4.4 实现节点详情面板 | NodeDetail.tsx | 点击节点显示完整信息 |
| 4.5 实现节点手动增删改 | MindMap.tsx | 右键菜单操作 |
| 4.6 实现搜索高亮 | MindMap.tsx | 搜索时匹配节点高亮 |
| 4.7 实现新节点飞入动画 | MindMap.tsx | AI 归位后新节点动画展示 |
| 4.8 性能优化（虚拟化？） | MindMap.tsx | 100+ 节点流畅渲染 |

**检查点：** 思维导图完整展示 → 交互流畅 → 搜索高亮正确

---

#### Phase 5: 输入面板 & 搜索（3-4 天）

**目标：** 完成快速输入、AI 归位结果展示、搜索功能。

| 任务 | 输出物 | 验收标准 |
|------|--------|---------|
| 5.1 实现快速输入面板 | QuickInput.tsx | 输入+标签选择+来源选择+提交 |
| 5.2 实现提交→AI分析→结果展示 | PlacementResult.tsx | 完整流程跑通 |
| 5.3 实现发散推荐卡片 | SuggestionCards.tsx | 卡片点击添加/忽略 |
| 5.4 实现全局搜索 | SearchBar + Results | 实时搜索+结果列表+点击跳转 |
| 5.5 实现标签过滤侧边栏 | TagFilter.tsx | 点击标签筛选节点 |
| 5.6 实现时间线视图 | Timeline.tsx | 按时间倒序展示所有笔记 |
| 5.7 实现全局快捷键 | main.ts | `Ctrl+N` 打开输入，`Ctrl+F` 搜索 |

**检查点：** 输入笔记 → AI 归位 → 确认 → 框架更新 → 搜索能找到

---

#### Phase 6: 联调打磨（3-4 天）

**目标：** 全流程联调，修复体验问题，补充边界情况。

| 任务 | 输出物 | 验收标准 |
|------|--------|---------|
| 6.1 全流程联调测试 | 测试清单 | 所有主流程跑通无报错 |
| 6.2 空状态与错误提示 | 各组件 | 无数据时显示引导，出错显示友好提示 |
| 6.3 拖拽排序实现 | MindMap.tsx | 同级节点可拖拽重排 |
| 6.4 数据导出/导入 | IPC + UI | 完整备份和恢复 |
| 6.5 性能优化 | 全部组件 | 启动 < 3s，操作响应 < 300ms |
| 6.6 UI 细节打磨 | 全部组件 | 动画流畅，间距统一，字体适配 |

**检查点:** 从零开始完整走一遍 → 无 bug → 体验流畅

---

#### Phase 7: 测试与发布（2-3 天）

**目标：** 打包发布第一个可用版本。

| 任务 | 输出物 | 验收标准 |
|------|--------|---------|
| 7.1 编写 E2E 测试（可选） | e2e/*.test.ts | 主流程自动化测试通过 |
| 7.2 Electron 打包配置 | electron-builder 配置 | 生成 .exe 安装包 |
| 7.3 Windows 平台测试 | 安装包 | 安装/运行/卸载正常 |
| 7.4 编写 README | README.md | 安装和使用说明清晰 |
| 7.5 发布 v0.1.0 | GitHub Release | 可下载使用 |

**检查点:** 能在另一台电脑上安装运行

---

## 11. 风险评估及应对策略

### 11.1 风险矩阵

| 风险 | 可能性 | 影响 | 等级 | 应对策略 |
|------|--------|------|------|---------|
| AI 归位准确率不达标 | 中 | 高 | 🔴 高 | 1) 优化 prompt 多次迭代 2) 提供手动调整作为降级方案 3) 收集归位数据反馈微调 prompt |
| AI API 调用成本过高 | 中 | 中 | 🟡 中 | 1) 笔记批量提交 2) 缓存重复分析结果 3) 支持本地模型 |
| better-sqlite3 原生模块编译问题 | 低 | 高 | 🟡 中 | 1) 使用 electron-rebuild 2) 备选：sql.js（纯 JS 实现） |
| ReactFlow 百节点性能问题 | 低 | 中 | 🟢 低 | 1) 默认折叠深层节点 2) 虚拟化渲染 3) 懒加载子树 |
| 用户学习成本高 | 中 | 中 | 🟡 中 | 1) 首次使用引导 2) 示例数据预置 3) 空状态引导文案 |
| 框架数据损坏/丢失 | 低 | 高 | 🟡 中 | 1) 自动备份 2) 导出功能 3) WAL 模式防崩溃 |

### 11.2 技术风险详细应对

#### 风险 1: AI 归位准确率不达标

**缓解措施：**
- **置信度阈值：** AI 返回的 confidence < 0.6 时，不自动推荐，而是列出 top 3 候选让用户选
- **上下文增强：** 每次提交笔记时，除框架树路径外，还附带用户最近的 3-5 条笔记，让 AI 理解用户风格
- **反馈循环：** 记录用户是"确认"还是"手动调整"，将这些数据用于优化 prompt
- **降级方案：** 用户始终可以手动选择父节点，不依赖 AI

#### 风险 2: better-sqlite3 在 Electron 中原生模块编译

**缓解措施：**
- 使用 `electron-rebuild` 在 postinstall 中自动重编译
- 在 `package.json` 中配置正确的 Electron 版本
- 备选方案：`sql.js`（纯 JS 的 SQLite 实现，无需编译，性能稍低但仍可用）

#### 风险 3: AI API 成本

**估算：**
- 初始化框架：1 次调用，约 2000-4000 tokens 输入 + 1000-2000 tokens 输出
- 每次笔记分析：约 1000-3000 tokens 输入 + 500-1000 tokens 输出
- 按 GPT-4o-mini 价格：每百次笔记分析约 $0.05-0.10

**应对：**
- 默认使用性价比高的模型（如 GPT-4o-mini, Claude Haiku）
- 支持用户自行配置模型和 endpoint
- 未来考虑支持 Ollama 等本地模型

### 11.3 项目风险应对

- **范围蔓延：** 严格按照 Phase 规划执行，Phase 1-5 以外的功能一律标记为 "v2"
- **技术阻塞：** 每个 Phase 结束设置检查点，问题不积累到下一阶段
- **用户反馈缺失：** Phase 5 完成后尽早让身边朋友试用，收集反馈

---

## 12. 附录

### 12.1 名词定义

| 术语 | 定义 |
|------|------|
| Vibecoding | 通过自然语言与 AI Agent 交互来辅助或主导软件开发的工作方式 |
| 实践框架 | 以树形结构组织的开发流程知识体系，包含步骤、原则、技巧和警告 |
| 节点 | 框架树中的一个知识单元，可以是流程步骤、方法论原则或实用技巧 |
| 归位 | AI 分析用户笔记后，自动将其放置到框架树的正确位置 |
| 发散推荐 | AI 在归位后主动推荐的补充知识点 |
| 收件箱 | 用户提交但尚未确认归位的笔记暂存区 |

### 12.2 参考项目 & 灵感来源

- **Obsidian:** 本地 Markdown 知识库 + 图谱视图
- **Heptabase:** 白板式知识管理 + 卡片
- **Notion AI:** AI 辅助内容整理和写作
- **Mermaid.js:** 文本生成思维导图/流程图
- **ReactFlow Examples:** 交互式节点图参考实现

### 12.3 变更记录

| 日期 | 版本 | 变更内容 | 变更人 |
|------|------|---------|--------|
| 2026-05-26 | v0.1 | 初始方案文档创建 | AI Assistant |

---

> **下一步：** 方案确认后，进入 Phase 1 项目搭建。建议先将本文档提交到本地 Git，作为项目的设计基准。
