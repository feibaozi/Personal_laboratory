# 🎤 Interview Coach — 个人求职智能助手

基于 AI 的个人求职面试练习系统。上传简历，构建数字分身，模拟真实面试对话，随时纠正、保存、迭代你的面试回答。

## 核心功能

### 三层知识架构

| 层级 | 功能 | 说明 |
|------|------|------|
| **知识库** | 文档上传 + RAG 检索 | 支持 PDF/Word/Markdown/TXT，自动解析、分块、向量化 |
| **深度档案** | Agentic 结构化解析 | DeepSeek 从文档中提取结构化个人档案（经历、技能、项目、职业叙事） |
| **话题卡片** | Q&A 素材管理 | 分类管理面试问答，支持手动创建和从对话中一键保存 |

### 数字分身对话

- **面试官身份**：你扮演面试官提问，Agent 扮演你回答
- **本人身份**：以本人身份纠正 Agent 的回答、补充信息、调整风格
- **自由切换**：两种身份在同一对话中随时切换，无需创建新会话
- **消息操作**：一键纠正回答、一键保存为话题卡片

### 本地嵌入模型

使用 `all-MiniLM-L6-v2` 在本地生成文档嵌入向量（384 维），无需调用外部 API。首次运行自动下载模型（~23MB），之后从缓存秒级加载。

## 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Next.js 16 (App Router) + TypeScript |
| UI | Tailwind CSS + 深色主题 |
| 数据库 | SQLite (better-sqlite3) |
| LLM | DeepSeek API (OpenAI 兼容) |
| 嵌入模型 | Xenova/all-MiniLM-L6-v2 (本地, 384 维) |
| 文档解析 | pdf-parse + mammoth (PDF/Word) |
| 状态管理 | Zustand |

## 快速开始

```bash
# 1. 安装依赖
cd my-interview-coach
npm install

# 2. 配置 API Key
cp .env.local.example .env.local
# 编辑 .env.local，填入 DEEPSEEK_API_KEY

# 3. 启动
npm run dev
# 访问 http://localhost:3000
```

首次使用流程：**设置页配置 API Key → 上传简历 → 构建档案 → 创建卡片 → 开始模拟面试**

## 项目结构

```
src/
├── app/
│   ├── api/
│   │   ├── knowledge/         # 知识库 CRUD + RAG 问答 + 构建档案
│   │   ├── cards/             # 话题卡片 CRUD
│   │   ├── chat/              # 对话管理 + 统一发送端点 + 纠正
│   │   └── settings/          # 应用配置
│   ├── knowledge/             # 知识库页面
│   ├── cards/                 # 卡片列表 + 编辑页
│   ├── chat/                  # 对话列表 + 对话界面
│   └── settings/              # 设置页
├── lib/
│   ├── types.ts               # 类型定义 (含 PersonProfile 结构化档案)
│   ├── db.ts                  # SQLite 初始化 + 迁移
│   ├── llm.ts                 # DeepSeek 客户端 + 本地嵌入模型
│   ├── embeddings.ts          # 分块 + 向量检索 + 关键词 fallback
│   ├── prompts.ts             # System prompt 模板
│   ├── profile-engine.ts      # Agentic 档案提取 + 合并 + 纠正
│   ├── profile-store.ts       # 结构化档案持久化
│   └── file-parser.ts         # PDF/DOCX/TXT/MD 文件解析
├── components/                # UI 组件
└── store/                     # Zustand 状态管理
```

## API 路由 (22 条)

| 模块 | 路由 | 方法 |
|------|------|------|
| 知识库 | `/api/knowledge/documents` | GET/POST |
| | `/api/knowledge/documents/[id]` | GET/DELETE |
| | `/api/knowledge/query` | POST |
| | `/api/knowledge/rebuild-index` | POST |
| | `/api/knowledge/build-profile` | POST |
| 卡片 | `/api/cards` | GET/POST |
| | `/api/cards/[id]` | GET/PUT/DELETE |
| 对话 | `/api/chat/history` | GET/POST |
| | `/api/chat/history/[sessionId]` | GET/DELETE |
| | `/api/chat/send` | POST |
| | `/api/chat/correct` | POST |
| 设置 | `/api/settings` | GET/PUT |

## 核心设计

### RAG 检索策略
```
提问 → 本地模型 embed → 余弦相似度 (语义检索)
                     ↘ 失败 → 关键词匹配 (词重叠打分)
→ 结合结构化档案 + 话题卡片 → DeepSeek 生成回答
```

### Agentic 档案解析
```
上传文档 → DeepSeek 深度解析 (3 轮推理)
  → 提取: person / workHistory / projects / skills / education
  → 推理: careerNarrative / coreStrengths / growthAreas / targetRoles
  → 存入 profile_data 表
  → 所有后续对话以档案为主知识源，RAG 退居补位
```
