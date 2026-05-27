# 「智研工作台」— 全流程投研+舆情一体化 设计方案

> **状态：** 方案设计阶段，暂不实施  
> **创建日期：** 2026-01-26

---

## 一、项目概述

### 1.1 一句话定位

一个基于 Electron 的桌面端智能投研终端，覆盖「标的发现 → 深度研究 → 舆情监控 → 决策辅助」完整投资研究闭环，以 LLM Agent + RAG 作为 AI 引擎核心。

### 1.2 核心价值

- **数据双引擎：** 结构化财报数据 + 非结构化舆情/资讯文本，交叉验证
- **AI 深度融合：** LLM Agent 自主调用工具链完成研究任务，而非简单的 Chat 套壳
- **全流程闭环：** 不是单一功能的堆砌，而是围绕研究员工作流设计的完整工具体验
- **本地优先：** 基于 Electron 桌面端，数据本地存储，敏感策略不上云

### 1.3 目标用户画像

- **主要用户：** 独立投资者 / 个人研究员，需要对 A 股/港股标的进行深度研究
- **使用场景：** 盘前研究（30min 快速浏览关注列表舆情）、深度研究（周末 2-3h 深入分析单只标的）、实时监控（盘中异常推送）

---

## 二、技术架构总览

### 2.1 三层架构

```
┌─────────────────────────────────────────────────────┐
│                   Electron Shell                     │
│  ┌───────────────────────────────────────────────┐  │
│  │            Next.js 前端 (Renderer)             │  │
│  │   React + Tailwind + Zustand + Recharts       │  │
│  │   Dashboard │ 研究台 │ 舆情面板 │ 设置         │  │
│  └───────────────────────────────────────────────┘  │
│                         │ IPC                        │
│  ┌───────────────────────────────────────────────┐  │
│  │          Electron Main Process                 │  │
│  │  窗口管理 │ 文件系统 │ 通知 │ 调度控制         │  │
│  └───────────────────────────────────────────────┘  │
│                         │                            │
│  ┌───────────────────────────────────────────────┐  │
│  │          Python 后端服务 (Sidecar)             │  │
│  │   FastAPI │ 数据采集 │ NLP/AI │ 数据库         │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 2.2 技术选型

| 层级 | 技术 | 理由 |
|------|------|------|
| **桌面壳** | Electron 28+ | 你已有经验，跨平台 |
| **前端框架** | Next.js 15 (App Router) | 项目已有，SSR 在 Electron 中通过 `output: "export"` 静态导出 |
| **样式** | Tailwind CSS | 项目已有 |
| **状态管理** | Zustand | 轻量、TS 友好、适合 Electron 多窗口 |
| **图表** | Recharts | React 原生，轻量 |
| **Python 后端** | FastAPI + SQLAlchemy | AI/数据栈首选 Python，FastAPI 异步高性能 |
| **数据库** | SQLite (本地) + ChromaDB (向量) | 桌面端不依赖外部服务，SQLite 存结构化数据，ChromaDB 存向量嵌入 |
| **LLM 编排** | LangChain / LlamaIndex | Agent 工具调用 + RAG 检索 |
| **NLP 模型** | 本地微调 BERT + 远程 LLM API | 情绪分析本地跑（快且免费），深度分析调云端大模型 |
| **数据采集** | akshare (A股) + httpx + BeautifulSoup | akshare 覆盖 A 股数据，自建爬虫补充 |
| **进程通信** | Electron IPC + HTTP (localhost) | Electron 与 Python 通过 HTTP API 通信，Python 作为子进程启动 |

### 2.3 进程模型

```
启动流程:
1. Electron Main 启动
2. Main Process spawn Python FastAPI 子进程 (localhost:8765)
3. 等待 Python 服务健康检查通过
4. 创建 BrowserWindow，加载 Next.js 前端
5. 前端通过 IPC 或 fetch 与 Python 后端交互

关闭流程:
1. 用户关闭窗口 → Main Process 发送 SIGTERM 给 Python 进程
2. Python 优雅关闭（完成当前任务、关闭数据库连接）
3. Electron 退出
```

---

## 三、核心功能模块分解

### 模块一：Dashboard（首页驾驶舱）

**目的：** 打开应用后的第一屏，快速掌握全局状态

```
┌────────────────────────────────────────────────────┐
│  智研工作台                     [搜索标的...] [⚙]   │
├──────────────┬─────────────────────────────────────┤
│              │                                     │
│  关注列表     │         舆情热力地图                  │
│  ┌─────────┐ │  ┌─────────────────────────────┐   │
│  │ 贵州茅台  │ │  │  ██████ 新能源   🔴 热度高  │   │
│  │ 宁德时代  │ │  │  ████   消费电子  🟡 中     │   │
│  │ 腾讯控股  │ │  │  ███    医药     🟢 低     │   │
│  │ + 添加   │ │  │  ██     半导体   🟢 低     │   │
│  └─────────┘ │  └─────────────────────────────┘   │
│              │                                     │
│  ┌─────────┐ │        今日预警信号                   │
│  │ 组合概览 │ │  ┌─────────────────────────────┐   │
│  │ 收益+2.3%│ │  │ ⚠ 茅台：应收占比异常上升    │   │
│  │ 风险评分 │ │  │ ⚠ 宁德：大股东减持公告      │   │
│  └─────────┘ │  │ 📊 腾讯：超预期财报发布      │   │
│              │  └─────────────────────────────┘   │
└──────────────┴─────────────────────────────────────┘
```

**功能点：**
- 关注列表 CRUD，支持分组（重点关注 / 观察中 / 已清仓）
- 舆情热力地图：按行业/概念聚合情绪，雷达图展示
- 今日预警信号：财务异常 + 舆情异动 + 公告解读，按严重程度排序
- 快览卡片：自选组合当日收益、风险总评分

---

### 模块二：深度研究台（核心模块）

**目的：** 对标的研究的主战场，AI 辅助完成全面分析

#### 2.1 标的信息总览

```
┌────────────────────────────────────────────────────┐
│  ← 返回    贵州茅台 (600519)    ⭐ 已关注            │
│  ─────────────────────────────────────────────────  │
│  当前价: 1680.00  │  涨跌: +2.3%  │  总市值: 2.1万亿 │
├────────────────────────────────────────────────────┤
│  [概览] [财报分析] [估值模型] [AI 深度报告] [舆情]   │
├────────────────────────────────────────────────────┤
│                                                    │
│    标签页内容区域                                   │
│                                                    │
└────────────────────────────────────────────────────┘
```

**标签页详解：**

| 标签 | 内容 |
|------|------|
| **概览** | 公司简介、主营业务、管理层、股东结构、机构持仓 |
| **财报分析** | 近 5 年三表可视化、关键比率趋势（ROE/毛利率/负债率）、AI 解读 |
| **估值模型** | DCF 计算器、PE/PB Band、可比公司对比 |
| **AI 深度报告** | 一键生成 AI 研究报告（SWOT、竞争优势、风险点） |
| **舆情** | 该标的专属舆情时间线、情绪走势、关键词云 |

#### 2.2 AI 深度报告引擎（核心 AI 价值）

这是整个项目的 AI 能力集中体现。用户点击「生成深度报告」后：

```
用户触发
    ↓
┌─────────────────────────────────────┐
│        AI Agent 调度引擎            │
│                                     │
│  1. 数据采集 Agent                  │
│     - 获取最近 5 年财报 (akshare)   │
│     - 获取最近 3 个月新闻/研报      │
│     - 获取同行业可比公司数据        │
│     ↓                               │
│  2. 财务分析 Agent                  │
│     - 杜邦分析拆解                  │
│     - 成长性/盈利性/偿债能力评分    │
│     - 与行业均值对比                │
│     ↓                               │
│  3. 舆情分析 Agent                  │
│     - 情绪趋势分析                  │
│     - 关键词提取 + 事件聚类         │
│     - 机构观点汇总                  │
│     ↓                               │
│  4. 报告生成 Agent                  │
│     - RAG 检索历史研报写作风格      │
│     - LLM 生成结构化报告            │
│     - 图表自动插入                  │
│     ↓                               │
│  最终输出: Markdown 报告 + 数据附件 │
└─────────────────────────────────────┘
```

**报告章节模板：**
1. 公司概况与商业模式
2. 财务健康度评估（含杜邦分析图表）
3. 成长性分析（近 5 年营收/利润 CAGR）
4. 估值分析（DCF + 相对估值）
5. 竞争优势（护城河分析）
6. 舆情与市场情绪
7. 风险提示
8. 综合评分与投资建议

---

### 模块三：舆情监控中心

**目的：** 实时或准实时追踪全市场/关注列表的舆情动态

#### 3.1 舆情面板布局

```
┌────────────────────────────────────────────────────┐
│  舆情监控                              [实时 / 历史] │
├────────────────────┬───────────────────────────────┤
│                    │                               │
│  舆情信息流         │      舆情分析面板              │
│  ┌──────────────┐  │  ┌─────────────────────────┐ │
│  │🟢 10:30      │  │  │  近7日情绪趋势           │ │
│  │茅台提价预期   │  │  │  📈 ▁▂▃▄▅▆▇            │ │
│  │来源: 财联社   │  │  └─────────────────────────┘ │
│  │情绪: 正面     │  │                               │
│  ├──────────────┤  │  ┌─────────────────────────┐ │
│  │🔴 10:15      │  │  │  关键词云                │ │
│  │宁德大股东减持  │  │  │  提价 分红 渠道 经销商    │ │
│  │来源: 公告     │  │  └─────────────────────────┘ │
│  │情绪: 负面     │  │                               │
│  └──────────────┘  │  ┌─────────────────────────┐ │
│                    │  │  传播溯源图 (D3力导向)    │ │
│                    │  │  [来源 → 媒体 → 讨论]    │ │
│                    │  └─────────────────────────┘ │
└────────────────────┴───────────────────────────────┘
```

#### 3.2 舆情分析 Pipeline

```
数据源                            处理层                    输出
─────                            ──────                    ────
东方财富新闻 API ─┐
雪球热帖 API    ─┤
财联社 API      ─┼──→ 统一采集器 ──→ NLP Pipeline ──→ 结构化舆情
巨潮公告 API    ─┤      (Scheduler)     │               (SQLite)
微博热搜 API    ─┘                      │
                                        ├── 去重/去噪
                                        ├── 实体识别 (标的/人物/事件)
                                        ├── 情绪分类 (正面/负面/中性 + 强度)
                                        ├── 事件聚类 (同一事件不同来源归并)
                                        └── 影响度打分 (传播规模 × 情绪强度)
```

**NLP Pipeline 详细设计：**

| 步骤 | 技术方案 | 说明 |
|------|---------|------|
| 文本清洗 | Python re + jieba 分词 | 去除 HTML 标签、特殊字符 |
| 实体识别 (NER) | 微调 BERT-BiLSTM-CRF 或直接使用 HanLP | 识别公司名、人名、产品名、金额 |
| 情绪分类 | fine-tuned `bert-base-chinese` 三分类 | 正面/负面/中性，输出 confidence |
| 情绪强度 | 基于情感词典 + 程度副词规则 | 结合模型输出做 0-100 打分 |
| 事件聚类 | TF-IDF + DBSCAN 或 `sentence-transformers` | 同一事件的不同报道归并为一个事件 |
| 影响评估 | 规则引擎：传播量 × 情绪强度 × 信源权重 | 量化舆情影响力 |

#### 3.3 预警规则引擎

```
预警类型        触发条件                      严重度
────────       ─────────                     ────
财务异常       应收/营收比同比 > 30%           🔴 高
              经营现金流/净利润 < 0.5          🔴 高
              毛利率连续 3 季下降              🟡 中

舆情异动       单日负面舆情暴增 > 300%         🔴 高
              出现「调查/处罚/立案」关键词     🔴 高
              大股东减持/质押公告              🟡 中

关联传导       同行业龙头利空                  🟡 中
              上下游产业链负面新闻            🟢 低
```

---

### 模块四：数据管理系统

#### 4.1 数据源管理

| 数据类别 | 来源 | 更新频率 |
|---------|------|---------|
| **行情数据** | akshare (东方财富/新浪) | 盘中 5min / 盘后日更新 |
| **财务报表** | akshare (巨潮/新浪财经) | 季报发布后更新 |
| **机构研报** | 东方财富研报 API | 每日 |
| **新闻资讯** | 财联社/东方财富新闻 | 每 30min |
| **社交媒体** | 雪球热帖/微博 | 每 15min |
| **公司公告** | 巨潮资讯网 | 每日 |
| **行业数据** | akshare 行业板块 | 每日 |

#### 4.2 本地数据库 Schema

```sql
-- 标的/股票基础信息
CREATE TABLE stocks (
    id INTEGER PRIMARY KEY,
    code VARCHAR(10) NOT NULL UNIQUE,      -- 600519
    name VARCHAR(50) NOT NULL,             -- 贵州茅台
    market VARCHAR(10),                     -- SH/SZ/HK
    industry VARCHAR(50),                   -- 白酒
    watch_status VARCHAR(20),              -- focused/observing/closed
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 财务报表（按季度）
CREATE TABLE financials (
    id INTEGER PRIMARY KEY,
    stock_id INTEGER REFERENCES stocks(id),
    report_date DATE NOT NULL,             -- 2025-03-31
    report_type VARCHAR(20),               -- Q1/Q2/Q3/annual
    revenue DECIMAL(20,2),                  -- 营业收入
    net_profit DECIMAL(20,2),              -- 净利润
    total_assets DECIMAL(20,2),
    total_liabilities DECIMAL(20,2),
    operating_cf DECIMAL(20,2),            -- 经营现金流
    gross_margin DECIMAL(5,4),             -- 毛利率
    roe DECIMAL(5,4),                       -- ROE
    debt_ratio DECIMAL(5,4),               -- 资产负债率
    receivables DECIMAL(20,2),             -- 应收账款
    raw_json TEXT,                          -- 完整原始数据
    UNIQUE(stock_id, report_date, report_type)
);

-- 舆情记录
CREATE TABLE sentiment_events (
    id INTEGER PRIMARY KEY,
    stock_id INTEGER REFERENCES stocks(id),
    source VARCHAR(50),                     -- 财联社/雪球/东方财富
    source_url TEXT,
    title TEXT NOT NULL,
    content TEXT,
    sentiment VARCHAR(10),                  -- positive/negative/neutral
    sentiment_score DECIMAL(3,2),           -- 0.00-1.00 情绪强度
    impact_score DECIMAL(5,2),              -- 影响力评分
    event_cluster_id VARCHAR(64),           -- 事件聚类 ID
    published_at TIMESTAMP,
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 事件聚类
CREATE TABLE event_clusters (
    id INTEGER PRIMARY KEY,
    cluster_id VARCHAR(64) UNIQUE,
    title VARCHAR(200),                     -- 聚类后的事件标题（LLM生成）
    stock_ids TEXT,                         -- JSON: [1, 2, 3] 涉及标的
    event_type VARCHAR(50),                 -- earnings/news/regulation/rumor
    severity VARCHAR(10),                   -- high/medium/low
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    summary TEXT,                           -- LLM 生成的事件摘要
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI 生成的报告
CREATE TABLE reports (
    id INTEGER PRIMARY KEY,
    stock_id INTEGER REFERENCES stocks(id),
    report_type VARCHAR(50),               -- quick/snapshot/deep_research
    title VARCHAR(200),
    content_markdown TEXT,                  -- Markdown 格式报告正文
    data_snapshot TEXT,                     -- JSON: 报告生成时的数据快照
    model_used VARCHAR(50),                -- 使用的 LLM 模型
    tokens_used INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 预警记录
CREATE TABLE alerts (
    id INTEGER PRIMARY KEY,
    stock_id INTEGER REFERENCES stocks(id),
    alert_type VARCHAR(50),                -- financial/sentiment/correlation
    severity VARCHAR(10),                  -- high/medium/low
    title VARCHAR(200),
    description TEXT,
    related_data TEXT,                      -- JSON: 触发预警的数据
    is_read BOOLEAN DEFAULT FALSE,
    dismissed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 四、AI 深度融合设计（核心竞争力）

### 4.1 LLM Agent 工具调用体系

这是整个项目 AI 能力的核心架构。我们不是简单地把数据喂给 LLM 聊天，而是构建一个 **Agent 工具调用链**：

```
用户请求: "帮我深度分析贵州茅台"
                │
                ▼
    ┌────────────────────────────┐
    │     Agent Orchestrator     │  ← LangChain AgentExecutor
    │  (决定调用哪些工具/顺序)    │
    └────────────┬───────────────┘
                 │
    ┌────────────┼────────────┬──────────────┐
    ▼            ▼            ▼              ▼
┌─────────┐ ┌─────────┐ ┌─────────┐  ┌──────────┐
│财报工具  │ │行情工具  │ │舆情工具  │  │搜索工具   │
│get_fin   │ │get_price │ │get_sent  │  │search_web │
│ancials   │ │_history  │ │iment     │  │           │
└─────────┘ └─────────┘ └─────────┘  └──────────┘
     │           │           │             │
     ▼           ▼           ▼             ▼
   所有数据汇聚 → LLM 综合分析 → 生成报告
```

**Agent 工具定义（LangChain Tool）：**

```python
tools = [
    Tool(name="get_financials", 
         description="获取指定股票近N年财务报表，返回杜邦分析指标",
         func=fetch_financial_data),
    
    Tool(name="get_price_history",
         description="获取指定股票的行情历史，返回OHLCV数据",
         func=fetch_price_history),
    
    Tool(name="get_sentiment",
         description="获取指定股票的舆情分析，返回情绪趋势和关键词",
         func=fetch_sentiment_analysis),
    
    Tool(name="search_news",
         description="搜索与指定股票相关的最新新闻和公告",
         func=search_latest_news),
    
    Tool(name="compare_peers",
         description="对比同行业可比公司的关键财务指标",
         func=compare_with_peers),
    
    Tool(name="calculate_valuation",
         description="使用DCF模型计算估值，返回估值区间和假设条件",
         func=run_dcf_valuation),
    
    Tool(name="detect_anomalies",
         description="检测财务数据中的异常信号，返回异常指标列表",
         func=detect_financial_anomalies),
]
```

### 4.2 RAG 检索增强生成

**应用场景：**
- 回答「这家公司的竞争优势是什么？」时，自动检索历史研报中的相关段落
- 生成报告时，参考同行业研报的写作框架和专业表述
- 用户追问财务细节时，精确检索对应季度的财报原文

**技术架构：**

```
文档预处理:
  财报PDF → pymupdf 提取文本 → text splitter (按章节切割)
  研报/新闻 → HTML→Markdown → text splitter (按段落切割)
            ↓
  嵌入向量化:
  句子 → bge-large-zh-v1.5 → 1024维向量 → ChromaDB 存储
            ↓
  检索流程:
  用户Query → 向量化 → ChromaDB相似度检索 (top_k=10)
  → 重排序 (BGE Reranker) → top_k=3 → 注入 LLM Context
```

### 4.3 多模型策略

不同任务使用不同模型，兼顾效果和成本：

| 场景 | 模型选择 | 理由 |
|------|---------|------|
| 情绪分类 | 本地 fine-tuned `bert-base-chinese` | 毫秒级响应、免费、数据不出本地 |
| NER 实体识别 | HanLP 本地模型 | 金融实体识别开箱即用 |
| 事件聚类 | `bge-base-zh-v1.5` + DBSCAN | 本地向量化，聚类快速 |
| 财务解读 | `glm-4-flash` / `deepseek-chat` API | 成本低、中文财报理解好 |
| 深度研究报告生成 | `claude-sonnet-4-20250514` / `deepseek-r1` | 长文本连贯性、推理深度 |
| Agent 调度 | `claude-sonnet-4-20250514` | 工具调用稳定、复杂推理强 |

### 4.4 Prompt 工程示例

**财报解读 Prompt：**
```
你是一位资深证券分析师，擅长用通俗语言解读财务报表。

请分析以下数据：
{financial_data}

分析要求：
1. 用 2-3 句话概括公司最新一季的经营状况
2. 指出最值得关注的 3 个积极变化和 3 个潜在风险
3. 用百分比说明关键指标的同比/环比变化
4. 如果发现异常指标（偏差超过行业均值 30%），请特别标出

语言风格：专业但不晦涩，适合有基础财务知识的个人投资者阅读。
```

---

## 五、前端界面详细设计

### 5.1 路由设计 (Next.js App Router)

```
/                           → Dashboard 驾驶舱首页
/research/[code]            → 单只标的深度研究台
/research/[code]/financials → 财报分析子页
/research/[code]/valuation  → 估值模型子页
/research/[code]/sentiment  → 标的舆情子页
/research/[code]/report     → AI 报告查看
/sentiment                  → 全市场舆情监控中心
/sentiment/events/[id]      → 事件详情页
/alerts                     → 预警中心
/settings                   → 设置（API Key、数据源、采集频率）
/reports                    → 历史报告列表
```

### 5.2 组件树（核心组件）

```
Layout
├── Sidebar (导航栏)
│   ├── NavLogo
│   ├── NavItem (Dashboard / 研究 / 舆情 / 预警 / 报告 / 设置)
│   └── WatchListMini (侧边栏迷你关注列表)
│
├── Dashboard Page
│   ├── MarketHeatMap (舆情热力地图)
│   ├── AlertFeed (预警信号流)
│   ├── WatchListCard (关注列表卡片)
│   └── PortfolioSnapshot (组合快览)
│
├── Research Page (研究台)
│   ├── StockHeader (标的信息头：价格/涨跌/市值)
│   ├── ResearchTabs (研究标签页导航)
│   ├── FinancialChart (财务指标可视化)
│   ├── AIReportViewer (AI 报告渲染器 - Markdown→React)
│   ├── DCFCalculator (DCF 估值计算器)
│   └── StockSentimentPanel (标的舆情面板)
│
├── Sentiment Page (舆情中心)
│   ├── SentimentTimeline (舆情时间线)
│   ├── SentimentTrendChart (情绪趋势图)
│   ├── WordCloud (关键词词云)
│   ├── PropagationGraph (传播溯源图)
│   └── EventCard (事件卡片)
│
├── Alerts Page
│   ├── AlertList (预警列表，支持筛选/排序)
│   └── AlertDetail (预警详情)
│
└── Settings Page
    ├── LLMConfig (API Key / 模型选择)
    ├── DataSourceConfig (数据源开关)
    └── NotificationConfig (通知设置)
```

### 5.3 状态管理设计 (Zustand Store)

```typescript
interface AppStore {
  // 关注列表
  watchlist: Stock[];
  addToWatchlist: (stock: Stock) => void;
  removeFromWatchlist: (code: string) => void;
  
  // 当前研究标的
  currentStock: Stock | null;
  setCurrentStock: (stock: Stock) => void;
  
  // 舆情数据
  sentimentEvents: SentimentEvent[];
  sentimentStats: SentimentStats | null;
  
  // 预警
  alerts: Alert[];
  unreadAlertCount: number;
  markAlertRead: (id: number) => void;
  
  // AI 状态
  isGenerating: boolean;
  generationProgress: string;  // Agent 当前步骤描述
  
  // 设置
  settings: AppSettings;
}

interface AppSettings {
  llmProvider: 'deepseek' | 'zhipu' | 'openai';
  llmApiKey: string;
  llmModel: string;
  dataRefreshInterval: number;  // 数据更新间隔（分钟）
  pythonPort: number;
}
```

---

## 六、数据流与时序设计

### 6.1 实时舆情采集流程

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ APScheduler  │────→│ DataFetcher  │────→│ NLP Pipeline │
│ (定时触发)    │     │ (多源采集)    │     │ (分析处理)    │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                    ┌────────────────────────────┘
                    ▼
            ┌──────────────┐     ┌──────────────┐
            │   SQLite     │     │  预警引擎     │
            │  (持久化)     │     │  (规则匹配)   │
            └──────┬───────┘     └──────┬───────┘
                   │                    │
                   ▼                    ▼
            ┌──────────────┐     ┌──────────────┐
            │  API 接口     │     │ Electron通知  │
            │  (供前端查询)  │     │  (桌面推送)   │
            └──────────────┘     └──────────────┘
```

### 6.2 AI 报告生成流程

```
用户点击「生成深度报告」
        │
        ▼
前端 → POST /api/research/generate { stock_code: "600519" }
        │
        ▼
Python AgentOrchestrator:
  ├── Step 1: get_financials("600519", years=5)    [5s]
  ├── Step 2: get_price_history("600519", period="5y")  [2s]
  ├── Step 3: get_sentiment("600519", days=90)     [3s]
  ├── Step 4: search_news("贵州茅台", days=30)     [3s]
  ├── Step 5: compare_peers("白酒", metrics=[...]) [5s]
  ├── Step 6: detect_anomalies(financial_data)     [2s]
  └── Step 7: LLM.generate_report(all_data)        [30-60s]
        │
        ▼
返回: { report_id, markdown_content, data_snapshot }
        │
        ▼
前端 Markdown 渲染 → AIReportViewer
同时保存到 SQLite reports 表 + 本地 .md 文件
```

### 6.3 前后端通信时序

```
Electron Main          Python Backend         Next.js Renderer
     │                      │                      │
     │── spawn python ────→│                      │
     │                      │                      │
     │←── health check ────│                      │
     │   (GET /health)     │                      │
     │                      │                      │
     │── create window ──────────────────────────→│
     │                      │                      │
     │                      │←── fetch data ───────│
     │                      │   GET /api/stocks    │
     │                      │── JSON response ────→│
     │                      │                      │
     │←── IPC: notify ──────│                      │
     │   (新预警)           │                      │
     │── desktop notification                      │
     │── IPC: push ──────────────────────────────→│
     │   alert_update                             │
```

---

## 七、项目目录结构

```
mood-radio/
├── electron/
│   ├── main.ts              # Electron 主进程入口
│   ├── preload.ts           # 预加载脚本
│   ├── python-manager.ts    # Python 子进程生命周期管理
│   └── ipc-handlers.ts      # IPC 事件处理器
│
├── src/
│   ├── app/                 # Next.js App Router 页面
│   │   ├── page.tsx         # Dashboard
│   │   ├── layout.tsx       # 根布局（含 Sidebar）
│   │   ├── research/
│   │   │   ├── [code]/
│   │   │   │   ├── page.tsx           # 研究台主页
│   │   │   │   ├── financials/page.tsx
│   │   │   │   ├── valuation/page.tsx
│   │   │   │   ├── sentiment/page.tsx
│   │   │   │   └── report/page.tsx
│   │   ├── sentiment/
│   │   │   ├── page.tsx       # 舆情中心
│   │   │   └── events/[id]/page.tsx
│   │   ├── alerts/page.tsx
│   │   ├── reports/page.tsx
│   │   └── settings/page.tsx
│   │
│   ├── components/           # 可复用组件
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   ├── dashboard/
│   │   │   ├── MarketHeatMap.tsx
│   │   │   ├── AlertFeed.tsx
│   │   │   ├── WatchListCard.tsx
│   │   │   └── PortfolioSnapshot.tsx
│   │   ├── research/
│   │   │   ├── StockHeader.tsx
│   │   │   ├── FinancialChart.tsx
│   │   │   ├── AIReportViewer.tsx
│   │   │   ├── DCFCalculator.tsx
│   │   │   └── StockSentimentPanel.tsx
│   │   ├── sentiment/
│   │   │   ├── SentimentTimeline.tsx
│   │   │   ├── SentimentTrendChart.tsx
│   │   │   ├── WordCloud.tsx
│   │   │   ├── PropagationGraph.tsx
│   │   │   └── EventCard.tsx
│   │   ├── alerts/
│   │   │   ├── AlertList.tsx
│   │   │   └── AlertDetail.tsx
│   │   └── common/
│   │       ├── SearchBar.tsx
│   │       ├── LoadingSpinner.tsx
│   │       ├── ErrorBoundary.tsx
│   │       └── EmptyState.tsx
│   │
│   ├── store/                # Zustand 状态管理
│   │   ├── index.ts
│   │   ├── watchlist.ts
│   │   ├── sentiment.ts
│   │   ├── alerts.ts
│   │   └── settings.ts
│   │
│   ├── hooks/                # 自定义 Hooks
│   │   ├── useStockData.ts
│   │   ├── useSentiment.ts
│   │   ├── useAIReport.ts
│   │   └── useAlerts.ts
│   │
│   ├── lib/                  # 工具函数
│   │   ├── api.ts            # Python 后端 API 封装
│   │   ├── formatters.ts     # 数字/日期格式化
│   │   └── constants.ts
│   │
│   └── styles/
│       └── globals.css       # Tailwind 全局样式
│
├── python-backend/           # Python 后端（独立子项目）
│   ├── main.py               # FastAPI 入口
│   ├── requirements.txt
│   ├── config.py             # 配置管理
│   ├── database/
│   │   ├── models.py         # SQLAlchemy 模型
│   │   ├── connection.py     # 数据库连接管理
│   │   └── migrations/       # Alembic 迁移
│   ├── collectors/
│   │   ├── base.py           # 采集器基类
│   │   ├── stock_info.py     # 股票基础信息采集
│   │   ├── financials.py     # 财报数据采集
│   │   ├── news.py           # 新闻资讯采集
│   │   ├── social.py         # 社交媒体采集
│   │   └── scheduler.py      # APScheduler 定时任务
│   ├── nlp/
│   │   ├── sentiment.py      # 情绪分类器
│   │   ├── ner.py            # 实体识别
│   │   ├── clustering.py     # 事件聚类
│   │   └── preprocessor.py   # 文本预处理
│   ├── ai/
│   │   ├── agent.py          # LangChain Agent 编排
│   │   ├── tools.py          # Agent 工具定义
│   │   ├── prompts.py        # Prompt 模板
│   │   ├── report_generator.py  # 报告生成器
│   │   ├── anomaly_detector.py  # 财务异常检测
│   │   └── models/           # 本地模型存储
│   ├── api/
│   │   ├── stocks.py         # 股票相关 API
│   │   ├── sentiment.py      # 舆情相关 API
│   │   ├── research.py       # 研究报告 API
│   │   ├── alerts.py         # 预警 API
│   │   └── settings.py       # 设置 API
│   └── tests/
│       ├── test_collectors.py
│       ├── test_nlp.py
│       └── test_ai.py
│
├── data/                     # 本地数据目录 (gitignore)
│   ├── chromadb/             # 向量数据库文件
│   └── sqlite/               # SQLite 数据库文件
│
├── docs/
│   └── plans/
│       └── 2026-01-26-zhizhan-workbench-design.md
│
├── package.json
├── tsconfig.json
├── next.config.ts
└── tailwind.config.ts
```

---

## 八、实施路线图

### Phase 1：基础设施搭建（约 2 周）

- [ ] Electron + Next.js 基础框架搭建（复用现有结构）
- [ ] Python 后端项目初始化（FastAPI + SQLite + 基础 CRUD）
- [ ] Electron Main 进程集成 Python 子进程管理
- [ ] 前后端通信链路打通（IPC + HTTP）
- [ ] Sidebar 导航 + 页面路由框架
- [ ] Zustand 状态管理初始化

### Phase 2：数据层构建（约 2 周）

- [ ] SQLAlchemy 模型定义 + 数据库初始化
- [ ] akshare 数据采集器（股票信息、财务数据）
- [ ] 新闻/公告采集器（东方财富、巨潮）
- [ ] APScheduler 定时任务框架
- [ ] 数据库基础 CRUD API
- [ ] 前端关注列表 + 标的信息页面的数据联调

### Phase 3：舆情系统（约 3 周）

- [ ] 文本预处理 Pipeline
- [ ] NER 实体识别集成（HanLP）
- [ ] 情绪分类模型训练/部署（bert-base-chinese）
- [ ] 事件聚类实现
- [ ] 舆情 API 开发
- [ ] 前端舆情面板 UI（时间线 + 趋势图 + 关键词云）
- [ ] 预警规则引擎 + 桌面推送

### Phase 4：AI 深度集成（约 3 周）

- [ ] LangChain Agent 框架搭建
- [ ] 核心 Tool 实现（财报、行情、舆情、搜索）
- [ ] RAG Pipeline（文档向量化 + ChromaDB + 检索）
- [ ] 报告生成 Agent（深度研究报告）
- [ ] 前端 AIReportViewer（Markdown 渲染）
- [ ] DCF 估值计算器 + 可视化

### Phase 5：打磨交付（约 2 周）

- [ ] Dashboard 整合（热力地图 + 预警流 + 组合快览）
- [ ] 设置页面（API Key 管理、数据源配置）
- [ ] 性能优化（数据采集批处理、前端虚拟列表）
- [ ] 错误处理 + 日志系统
- [ ] Electron 打包配置（electron-builder）
- [ ] 用户文档（内置帮助页面）

---

## 九、关键技术风险与应对

| 风险 | 影响 | 应对策略 |
|------|------|---------|
| akshare API 不稳定 | 数据采集中断 | 多数据源冗余 + 本地缓存 + 降级策略 |
| LLM API 调用成本 | 高频使用费用高 | 本地小模型处理高频任务，大模型仅用于报告生成 |
| Python 进程崩溃 | 应用不可用 | Electron auto-restart + 健康检查 + 错误边界 |
| 数据采集被反爬 | 数据缺失 | 控制频率 + User-Agent 轮换 + 备用数据源 |
| 情绪模型准确率不足 | 误报/漏报 | 引入人工校验标记 + 持续 fine-tune |

---

## 十、未覆盖但可扩展的方向

以下功能暂不纳入首版，但架构设计已预留扩展空间：

- **多账户/组合管理** — stocks 表已有 watch_status 字段，可扩展为多策略组合
- **回测引擎** — 基于历史情绪数据回测交易策略
- **实时行情推送** — WebSocket 接入实时行情（目前用轮询）
- **多语言支持** — 扩展港股/美股数据源
- **Agent 自定义策略** — 用户自定义研究模板和分析规则
- **导出功能** — 报告导出 PDF/Excel
- **协同研究** — 本地数据库可扩展为共享数据库

---

> **文档版本：** v1.0  
> **下步行动：** 用户确认方案后，进入 Phase 1 实施。