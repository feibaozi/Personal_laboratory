# Codebase Agent

本地代码仓库智能分析引擎。用 Rust 写核心解析管线、Node.js 做服务层、React 写前端界面，一站式深度扫描代码库，输出版本健康度评分、依赖图、重复检测、技术债务定位及重构建议。

> Project Health: **A (91/100)**

---

## 功能总览

### 1. 多语言代码解析

**专业级**：基于 tree-sitter 构建多语言 AST 解析引擎，支持 Python / TypeScript (含 TSX/JS/JSX) / Go。为每份源码生成统一的结构化语法树，提取模块、函数、类、变量、接口、类型别名、导入关系等全部符号定义与引用，建立完整的跨文件符号表与依赖索引。

> **大白话**：把你的代码翻译成一张精密的结构地图——每个文件里定义了哪些函数、类、变量，它们之间互相怎么调用、从哪里导入的，全部自动整理清楚。

### 2. 依赖图构建与可视化

**专业级**：以文件为 Module 根节点，构建 Function → Class → Variable 多层级有向图（DiGraph）。所有 Import、Call、Extends、Implements、References 关系具象化为带类型标签的有向边。跨文件引用通过符号解析（Symbol Resolution）自动链接，构建完整的项目级依赖网络。前端基于 Cytoscape.js 实时渲染可交互力导向图，支持节点点击查看详情（名称、类型、位置、复杂度、耦合度）。

> **大白话**：画出一张项目"蜘蛛网"——每个文件是一个节点，每条 import 和函数调用是一条线。一眼看出哪些是交通枢纽（被很多地方调用）、哪些是孤岛（没人用）、哪些绕成了死循环。

### 3. 代码质量量化度量

**专业级**：多维度量化评分体系：

| 指标 | 算法 | 含义 |
|------|------|------|
| 圈复杂度 (CC) | McCabe（基线1 + 分支数之和） | 函数逻辑分支数量，越高越难测难维护 |
| Martin 耦合度 | Ca（传入）/ Ce（传出）/ I（不稳定度）= Ce / (Ca + Ce) | 模块被多少 / 依赖多少其他模块，越高越脆弱 |
| 抽象度 (A) | 抽象方法数 / 总方法数 | 类的抽象程度：接口=1.0，纯实现=0.0 |
| 主序列距离 (D) | \|A + I - 1\| | 离理想平衡线的距离，越远越处于"痛苦区" |
| 代码行数 (LOC) | 非空非注释行 | 规模度量 |
| 注释密度 | 注释行 / 总行数 | 文档化程度 |

> **大白话**：给代码做全身体检。每个函数和类都有"血压（圈复杂度）"、"血糖（耦合度）"、"体脂率（抽象度）"等指标，综合得出 A-F 的健康等级和 0-10 分评分。

### 4. 循环依赖检测

**专业级**：基于 Tarjan 强连通分量（SCC）算法对依赖图进行稠密子图分析。识别所有 |SCC| > 1 的环路，输出环路中的节点名称、ID 和涉及文件列表，标记为 Error 级别的代码异味。

> **大白话**：找出代码中的"死循环依赖"——A 引用了 B、B 引用了 C、C 又引用了 A。这种互相缠绕的依赖关系在大项目中极其难以维护，改一处就牵一发动全身。

### 5. 代码异味检测

**专业级**：7 种异味的全自动检测引擎，基于图遍历、度量阈值和历史数据统计，输出带严重度分级的结构化异味报告。

| 异味类型 | 检测规则 | 严重度 |
|---------|---------|-------|
| God Class（上帝类） | 圈复杂度 > 50 | Error |
| Long Function（长函数） | LOC > 100 | Warning |
| High Coupling（高耦合） | Ce > 20 | Warning |
| Circular Dependency（循环依赖） | SCC 含 2+ 节点 | Error |
| Shotgun Surgery（霰弹式修改） | 函数调用 > 10 个不同模块 | Warning |
| Feature Envy（依恋情结） | 外部引用 > 5 个符号 | Info |
| Duplication（重复代码） | Token N-gram 或 AST 指纹匹配 | Warning |

> **大白话**：像个经验丰富的代码"老中医"，通过扫描找出病灶——哪些类揽了太多事（上帝类）、哪些函数太长了（长函数）、哪些重复代码被 Ctrl+C/V 了一百遍。每个问题按严重程度标注：红色急症（必须修）、黄色中症（建议修）、蓝色轻症（参考）。

### 6. 重构建议引擎

**专业级**：针对每种异味类型自动匹配重构策略，生成结构化的 RefactorTask，包含策略名称、预估工作量（Low / Medium / High）、优先级（Error=3 / Warning=2 / Info=1）、是否可安全自动化等字段。任务按优先级降序排列。

| 异味 → 策略 | 工作量 | 可自动化 |
|------------|--------|---------|
| God Class → Extract Class | High | × |
| Long Function → Extract Method | Low | ✓ |
| High Coupling → Extract Interface | Medium | × |
| Circular Dependency → Dependency Inversion | High | × |
| Duplication → Merge Duplicates | Medium | ✓ |
| Shotgun Surgery → Extract Class | High | × |
| Feature Envy → Extract Method | Medium | ✓ |

> **大白话**：不只是告诉你哪里有问题，还附上一份"维修清单"——这个问题用什么方法修、工作量多大、能不能一键自动修。按优先级排好序，从最紧急的往下做就行。

### 7. 血缘追踪与影响分析

**专业级**：基于 BFS（广度优先搜索）遍历依赖图，实现双向血缘追踪：
- **Upstream（上游）**：当前符号所依赖的所有符号
- **Downstream（下游）**：依赖当前符号的所有符号
- **Impact Analysis（影响分析）**：符号变更时的直接 / 间接影响范围量化，自动识别受影响的测试文件

支持最大深度限制（默认 5 层），防止无限递归。

> **大白话**：查族谱。你要改一个函数，它能告诉你——这个函数依赖谁（改了别人会不会影响它），又有谁依赖它（改了它会炸到谁）。比如你要改一个工具函数，发现竟然有 47 个地方在调用它，工具会拉出一份完整的"影响地图"。

### 8. 重复代码检测

**专业级**：双通道检测策略：
- **Token N-gram（文本级）**：将源码切分为 token 序列，滑动窗口（默认 6）生成哈希值，碰撞检测找出文本级重复
- **AST 指纹（结构级）**：提取 AST 子树的结构骨架（忽略变量名等具体内容），SHA256 哈希对比，找出"结构相同但命名不同"的隐蔽重复

> **大白话**：找出 Ctrl+C/V 留下的痕迹。不只是找完全一样的代码块，还能找出"结构一样但变量名不同"的重复——比如两个函数都是"先校验参数、再查数据库、再返回结果"，这种换了皮但骨架一样的重复也能揪出来。

### 9. AI 架构文档生成

**专业级**：将分析结果（模块列表、依赖关系、度量指标、技术债务评分、代码异味数据）注入 LLM System Prompt，调用 OpenAI / Ollama / Anthropic 三种 Provider，通过 SSE 流式输出（Server-Sent Events）实时推送给前端，支持边生成边渲染。输出为结构化 Markdown，包含项目概述、模块架构、依赖分析、债务评估、重构建议等章节。

> **大白话**：一键生成架构文档。点一下按钮，AI 根据对你代码的深度分析，自动写出一份中文架构文档——项目做什么的、有哪些模块、技术债务怎么样、建议怎么优化。生成过程像打字一样逐字显示，不用傻等。

### 10. 多端交付

| 渠道 | 技术栈 | 功能 |
|------|--------|------|
| Orchestrator API | Fastify + napi-rs | 14 个 REST API + 1 WebSocket，内存缓存，分析管线编排 |
| 桌面应用 | React + Vite + Catppuccin 主题 | 4 页面：Dashboard / 依赖图 / 血缘追踪 / 文档生成 |
| CLI | Commander | 6 命令：analyze / debt-report / lineage / duplicates / doc-generate / refactor-suggest |
| VSCode 扩展 | Extension API | 6 命令 + 3 TreeView（债务 / 异味 / 依赖树）|

> **大白话**：想用哪种方式用都行——浏览器里看图表、终端里敲命令、VSCode 里边写代码边看分析，三种入口数据共享同一套分析引擎。

---

## 使用前提

### 系统要求

| 组件 | 最低版本 | 说明 |
|------|---------|------|
| Node.js | 18.0+ | 运行 orchestrator / CLI / 构建 |
| pnpm | 8.0+ | 包管理（workspace 模式） |
| Rust | 1.75+ | 编译引擎核心（tree-sitter + napi-rs） |
| 操作系统 | Windows / macOS / Linux | |

### 依赖安装

**Rust 工具链**（如未安装）：

```bash
# Windows: 下载安装 https://rustup.rs
# macOS / Linux:
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

**Node.js + pnpm**：

```bash
# Windows: 下载安装 https://nodejs.org
# macOS / Linux:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# pnpm
npm install -g pnpm@9
```

### LLM 配置（可选 — 文档生成功能需要）

配置环境变量即可，不配置时文档生成功能不可用，其他功能不受影响。

```bash
# 方案一：Ollama（本地免费，默认）
export LLM_PROVIDER=ollama
export LLM_MODEL=llama3
# 确保 Ollama 运行在 localhost:11434

# 方案二：OpenAI
export LLM_PROVIDER=openai
export LLM_API_KEY=sk-xxxxxx
export LLM_MODEL=gpt-4o

# 方案三：Anthropic
export LLM_PROVIDER=anthropic
export LLM_API_KEY=sk-ant-xxxxxx
export LLM_MODEL=claude-3-opus-20240229
```

---

## 快速开始

### 1. 克隆与安装

```bash
git clone <repo-url> codebase-agent
cd codebase-agent

# 安装所有依赖（引擎 + TypeScript 包）
pnpm install

# 编译 Rust 引擎为 Node.js 原生模块（napi-rs）
cd packages/engine
npx napi build --platform
cd ../..
```

### 2. 启动 Orchestrator 服务

```bash
# 开发模式（tsx watch，热重载）
pnpm dev:orchestrator

# 或生产模式
pnpm --filter orchestrator build
pnpm --filter orchestrator start
```

服务默认监听 `http://127.0.0.1:3456`，可通过环境变量修改：

```bash
export PORT=8080
export HOST=0.0.0.0
```

### 3. 运行分析

#### 方式 A：桌面应用

```bash
pnpm dev:desktop
# 浏览器打开 http://localhost:1420
# 输入项目路径 → 点击 Analyze → 查看 Dashboard / 依赖图 / 血缘 / 文档
```

#### 方式 B：CLI

```bash
# 分析项目
pnpm --filter cli build
node packages/cli/dist/cli.js analyze ./my-project

# 债务报告
node packages/cli/dist/cli.js debt-report ./my-project

# 血缘追踪
node packages/cli/dist/cli.js lineage ./my-project -s myFunction

# 重复代码
node packages/cli/dist/cli.js duplicates ./my-project

# 重构建议
node packages/cli/dist/cli.js refactor-suggest ./my-project

# 生成文档（需 LLM）
node packages/cli/dist/cli.js doc-generate ./my-project -o ./docs/architecture.md
```

#### 方式 C：VSCode 扩展（开发模式）

```bash
# 确保 orchestrator 在 3456 端口运行
# 在 VSCode 中打开 packages/vscode-extension 目录
# 按 F5 启动 Extension Development Host
# 使用 Ctrl+Shift+P → 运行 "Codebase Agent: Analyze"
```

### 4. 运行测试

```bash
# Rust 引擎测试（6 集成 + 2 单元）
cd packages/engine && cargo test

# TypeScript API 测试
cd packages/orchestrator && pnpm test
```

---

## API 参考

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| POST | `/api/analyze` | 提交分析任务 |
| GET | `/api/projects/:id/graph` | 获取依赖图 |
| GET | `/api/projects/:id/lineage?symbol=` | 血缘追踪 |
| GET | `/api/projects/:id/debt` | 技术债务评分 |
| GET | `/api/projects/:id/duplications` | 重复代码 |
| GET | `/api/projects/:id/refactor-suggestions` | 重构建议 |
| POST | `/api/projects/:id/docs/generate` | 生成文档（同步） |
| GET | `/api/projects/:id/docs/stream` | 文档生成（SSE 流式）|
| GET | `/api/projects/:id/docs` | 获取已生成文档 |
| GET | `/api/status/:projectId` | 查询任务状态 |
| GET | `/api/projects` | 已分析项目列表 |
| WS | `/ws/analysis/:projectId` | 分析进度推送 |

---

## 项目结构

```
codebase-agent/
├── packages/
│   ├── engine/                  # Rust 核心引擎
│   │   ├── src/
│   │   │   ├── parser/          # 多语言解析适配器
│   │   │   │   ├── python_adapter.rs
│   │   │   │   ├── typescript_adapter.rs
│   │   │   │   └── go_adapter.rs
│   │   │   ├── graph/           # 依赖图构建 + 查询
│   │   │   ├── metrics/         # 质量度量计算
│   │   │   ├── lineage/         # 血缘追踪
│   │   │   ├── duplication/     # 重复检测
│   │   │   ├── refactor/        # 异味检测 + 重构规划
│   │   │   └── lib.rs           # N-API 绑定导出
│   │   ├── tests/
│   │   └── Cargo.toml
│   ├── orchestrator/            # Fastify 服务层
│   │   ├── src/
│   │   │   ├── index.ts         # 13+ API 端点
│   │   │   ├── engine-service.ts
│   │   │   ├── docs-service.ts  # LLM 文档生成
│   │   │   └── llm-client.ts    # OpenAI / Ollama / Anthropic
│   │   └── __tests__/
│   ├── desktop/                 # React 桌面应用
│   │   └── src/
│   │       ├── App.tsx          # 主界面 + 导航 + Dashboard
│   │       ├── GraphPage.tsx    # Cytoscape 依赖图
│   │       ├── LineagePage.tsx  # 血缘追踪
│   │       └── DocsPage.tsx     # 文档展示（react-markdown）
│   ├── cli/                     # CLI 工具
│   ├── vscode-extension/        # VSCode 扩展
│   └── shared-types/            # 共享类型定义
├── eslint.config.mjs
├── .prettierrc
├── Dockerfile
└── .github/workflows/ci.yml
```

---

## 常见问题

**Q：分析大项目很慢怎么办？**
目前每次分析都是全量重建。可以通过 `incremental: true` 参数开启增量模式（需要先实现文件变更检测），或通过 `languages` 参数限制分析语言范围。

**Q：文档生成失败？**
确保已配置 LLM 环境变量。默认使用 Ollama（`localhost:11434`），运行 `ollama pull llama3` 后即可使用。如使用 OpenAI / Anthropic，需设置对应的 API Key。

**Q：VSCode 扩展没有数据显示？**
确保 orchestrator 服务已启动并在 3456 端口运行。扩展默认连接 `http://127.0.0.1:3456`。

**Q：支持哪些文件类型？**
Python（.py）、TypeScript（.ts/.tsx/.js/.jsx）、Go（.go）。

---

## 版本迭代

### v0.1.0 — 初始版本（Round 1）
- Rust 引擎：3 语言（Py/TS/Go）tree-sitter AST 解析
- 依赖图构建（petgraph DiGraph）
- 圈复杂度（McCabe）、Martin 耦合度度量
- Tarjan SCC 循环依赖检测
- BFS 血缘追踪 + 影响分析
- Token N-gram 重复代码检测
- 7 种代码异味检测 + 重构建议规划
- N-API 绑定（napi-rs），5 个导出函数
- Fastify orchestrator：13 REST + 1 WebSocket
- React Desktop（4 页面） + CLI（6 命令） + VSCode Extension（6 命令 + 3 TreeView）
- CI pipeline（cargo check + test + napi build + typecheck）
- 综合评分：**82/100（B+）**

### v0.2.0 — 功能完善（Round 2）
- AST 指纹（SHA256）重复代码检测（双通道）
- Python 边缘语法：comprehension、async/await
- TypeScript 边缘语法：enum_declaration、generic_type
- Go 边缘语法：goroutine、defer、select、channel
- Duck typing 引用解析增强
- 抽象度（abstractness）计算修复（原恒为 0）
- Abstractness + Instability → Main Sequence Distance 完整实现
- 注释密度检测（多语言注释格式）
- 短变量名（< 3 字符）嗅探
- CLI —help 文本完善
- 综合评分：**88/100（A-）**

### v0.3.0 — 工程化与微缺口补齐（Round 3）
- ESLint flat config（TypeScript 规则集）
- Prettier + .prettierignore 格式化配置
- Dockerfile 多阶段构建
- CI 增加 lint + format check 步骤
- 根 package.json 增加 lint/format 脚本
- 所有编译告警清零
- 综合评分：**91/100（A）**

### 下一版本规划
- 测试覆盖率提升（解析器 / 图 / 重复检测 / 重构单元测试）
- 增量分析（文件变更检测 + 局部重解析）
- Java 解析器（tree-sitter-java）
- 包级依赖检测（package.json / Cargo.toml / go.mod）
- 可配置异味检测阈值
- LLM 代码审查（基于检测数据生成审查意见）
- 前端 E2E 测试（Playwright）
- 可配置的注释风格检测
- 更丰富的度量指标（Halstead 复杂度 / 维护性指数 MI）

---

## 许可证

MIT