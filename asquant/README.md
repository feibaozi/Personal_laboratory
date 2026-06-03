# AsQuant — 量化投资研究平台

基于 Python/FastAPI + React/TypeScript 的全栈量化回测系统，支持多因子选股、组合构建、绩效分析、归因分析与报告导出。

## 功能概览

- **双引擎回测**：向量化引擎（日频多因子）+ 事件驱动引擎（分钟级日内策略）
- **150+ 内置因子**：价值、成长、动量、质量、波动率、规模、微观结构、技术指标 8 大类（含 Qlib Alpha158 技术因子体系）
- **专业绩效指标**：Sharpe / Calmar / Sortino / Treynor / Information Ratio / Alpha / Beta / VaR / CVaR
- **三种权重方式**：等权 / 风险平价 / 均值方差优化
- **真实交易约束**：涨跌停过滤、停牌处理、动态滑点、佣金+印花税建模、100股整数手
- **回测增强**：分批查询支持 3000+ 股票、因子计算缓存、并行参数优化、实时进度推送、回测取消/对比
- **归因分析**：每日 Brinson 行业归因（配置效应 + 选股效应 + 交互效应）、Barra 多因子风险归因（Size/Value/Momentum/Quality/Volatility/Liquidity）
- **报告系统**：净值曲线 (ECharts)、回撤分析、滚动 Sharpe、日收益分布、月度收益、交易明细、HTML/CSV 导出
- **因子分析**：IC 分析（Rank/Pearson）、分层回测（10分位）、因子相关性矩阵（热力图可视化）

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Python 3.10+, FastAPI, SQLAlchemy (async), Pandas, NumPy, SciPy, asyncio |
| 前端 | React 19, TypeScript, Vite, TailwindCSS, ECharts, Zustand |
| 数据 | AkShare, SQLite (可切换 PostgreSQL) |
| 报告 | HTML (ECharts) / CSV 导出 |

## 快速开始

### 前置条件

- Python 3.10+
- Node.js 18+
- （可选）Git

### 安装

```bash
# 克隆项目
cd asquant

# 安装后端依赖
cd backend
pip install -r requirements.txt

# 安装前端依赖
cd ../frontend
npm install
```

### 同步数据

```bash
cd backend
python ../scripts/sync_all.py
```

### 启动

**Windows：** 双击 `scripts/start.bat`

**Linux/macOS：** `bash scripts/dev.sh`

或分别启动：

```bash
# 后端（端口 8000）
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 前端（端口 5173）
cd frontend
npx vite --host 0.0.0.0
```

打开浏览器访问 **http://localhost:5173**

API 文档：**http://localhost:8000/docs**

## 项目结构

```
asquant/
├── backend/                  # Python FastAPI 后端
│   └── app/
│       ├── engine/           # 回测引擎（向量化 + 事件驱动）
│       │   ├── vectorized_engine.py      # 日频多因子回测
│       │   ├── event_driven_engine.py    # 分钟级日内回测
│       │   ├── factor_computer.py        # 因子计算（30+ 基础因子）
│       │   ├── technical_factor_computer.py  # Qlib Alpha158 技术因子
│       │   ├── portfolio_constructor.py  # 等权/风险平价/均值方差
│       │   ├── position_sizer.py         # 仓位管理（Kelly/波动率平价）
│       │   ├── optimizer.py              # 参数优化（Grid Search）
│       │   ├── constraints.py            # 交易约束（涨跌停/成本/滑点）
│       │   ├── risk_manager.py           # 风险控制（回撤止损/波动率目标）
│       │   ├── performance.py            # 绩效指标计算
│       │   ├── brinson.py                # Brinson 归因分析
│       │   ├── barra_attribution.py      # Barra 多因子归因
│       │   └── progress_tracker.py       # 实时进度追踪
│       ├── models/           # SQLAlchemy 数据模型
│       │   └── backtest.py               # 回测运行/日数据/摘要/交易明细
│       ├── routers/          # API 路由
│       ├── services/         # 业务服务 + 数据源
│       │   └── report_service.py         # HTML/CSV 报告生成
│       └── schemas/          # Pydantic 请求/响应模型
├── frontend/                 # React + Vite 前端
│   └── src/
│       ├── components/       # 页面组件（Dashboard/因子/回测/报告）
│       ├── api/              # API 调用层
│       ├── stores/           # Zustand 状态管理
│       └── types/            # TypeScript 类型定义
├── scripts/                  # 启动脚本 & 数据同步
├── tests/                    # 单元测试
└── data/                     # SQLite 数据库文件
```

## API 概览

| 端点 | 说明 |
|---|---|
| `GET /api/health` | 健康检查 |
| `GET /api/v1/market/stocks` | 股票列表 |
| `GET /api/v1/market/quotes` | 日线行情 |
| `GET /api/v1/factor/library` | 因子库 |
| `GET /api/v1/factor/latest-date` | 最近交易日 |
| `POST /api/v1/factor/ic-analysis` | 因子 IC 分析 |
| `POST /api/v1/factor/decile-analysis` | 因子分层回测 |
| `POST /api/v1/factor/correlation-matrix` | 因子相关性矩阵 |
| `POST /api/v1/factor/compute` | 计算因子值 |
| `POST /api/v1/factor/stats` | 因子统计信息 |
| `POST /api/v1/factor/screen` | 因子选股 |
| **回测** | |
| `POST /api/v1/backtest/run` | 运行回测 |
| `GET /api/v1/backtest/runs` | 回测历史列表 |
| `GET /api/v1/backtest/runs/{id}/detail` | 回测详情 |
| `GET /api/v1/backtest/runs/{id}/daily` | 回测日数据 |
| `GET /api/v1/backtest/runs/{id}/trades` | 交易明细 |
| `GET /api/v1/backtest/runs/{id}/positions` | 持仓历史 |
| `GET /api/v1/backtest/runs/{id}/turnover` | 换手率分析 |
| `GET /api/v1/backtest/runs/{id}/attribution` | Brinson 行业归因（每日） |
| `GET /api/v1/backtest/runs/{id}/barra` | Barra 多因子归因 |
| `GET /api/v1/backtest/runs/{id}/report?format=html` | HTML 报告导出 |
| `GET /api/v1/backtest/runs/{id}/report?format=csv` | CSV 数据导出 |
| `GET /api/v1/backtest/progress/{id}` | SSE 实时进度 |
| `POST /api/v1/backtest/runs/{id}/cancel` | 取消回测 |
| `GET /api/v1/backtest/compare?run_ids=id1,id2` | 多回测对比 |
| `POST /api/v1/backtest/optimize` | 参数优化 (Grid Search, 并行) |
| `POST /api/v1/backtest/walk-forward` | Walk Forward 验证 |
| `DELETE /api/v1/backtest/runs/{id}` | 删除回测 |
| `GET /api/v1/data/sync-status` | 数据同步状态 |

## 回测配置参数

| 参数 | 说明 | 默认值 |
|---|---|---|
| `start_date` | 回测起始日 | — |
| `end_date` | 回测结束日 | — |
| `factor_names` | 因子名称列表 | `["return_1m"]` |
| `factor_weights` | 因子权重（等权为自动均分） | 自动均分 |
| `top_n` | 持仓数量 | 50 |
| `max_stocks` | 最大股票池数量 | 3000 |
| `rebalance_freq` | 调仓频率 (`monthly` / `weekly`) | `monthly` |
| `weighting` | 权重方式 (`equal` / `risk_parity` / `mean_variance`) | `equal` |
| `position_sizing` | 仓位管理 (`equal` / `risk_parity` / `kelly` / `volatility_parity`) | 同 weighting |
| `transaction_cost` | 交易成本率 | 0.0003 |
| `slippage` | 基础滑点 | 0.001 |
| `min_daily_amount` | 最低日成交额过滤 | 5,000,000 |
| `benchmark` | 基准指数代码 | `000300` |
| `initial_capital` | 初始资金 | 1,000,000 |
| `max_drawdown_limit` | 最大回撤止损线（0=禁用） | 0 |
| `daily_loss_limit` | 日内亏损止损线（0=禁用） | 0 |
| `volatility_target` | 年化波动率目标（0=禁用） | 0 |

## 内置因子

| 类别 | 因子 | 说明 |
|---|---|---|
| 价值 | pe_ratio, pb_ratio, ps_ratio, ep_ratio, bp_ratio, dividend_yield | 估值类 |
| 成长 | revenue_growth_yoy, profit_growth_yoy, roe | 成长类 |
| 动量 | return_1m, return_3m, return_6m, return_12m_1m | 价格动量 |
| 质量 | gross_margin, net_margin, asset_turnover, debt_to_equity | 基本面质量 |
| 波动率 | volatility_1m, volatility_3m, max_drawdown_1y | 风险因子 |
| 规模 | log_market_cap | 市值规模 |
| 微观结构 | intraday_momentum, intraday_volatility, gap_return, volume_intensity, twap_deviation | 日内/交易行为 |
| 技术指标 | roc_N, ma_N, std_N, max_N, min_N, corr_N, cord_N, rsi_N, supm_N, sumn_N, sumd_N, rsv_N, cntp_N, cntd_N, vma_N, vstd_N, wvma_N, beta_N, rsqr_N, resi_N, imax_N, imin_N, imxd_N, k_mid, k_len, k_cross, k_up, k_down, d_mid, d_len, d_cross, d_up, d_down | Qlib Alpha158 技术因子（N=5,10,20,30,60） |

## 技术指标因子说明

技术因子基于 Qlib Alpha158 体系，窗口参数 N 支持 5, 10, 20, 30, 60：

| 因子前缀 | 名称 | 说明 |
|---|---|---|
| roc | Rate of Change | 价格变化率 |
| ma | Moving Average | 移动平均线 |
| std | Standard Deviation | 标准差 |
| max/min | Rolling Max/Min | 滚动最大/最小值 |
| corr/cord | Correlation | 相关性指标 |
| rsi | Relative Strength Index | 相对强弱指标 |
| supm/sumn/sumd | Summation | 求和类指标 |
| rsv/cntp/cntd | Count/Position | 计数/位置指标 |
| vma/vstd/wvma | Volume MA | 成交量相关指标 |
| beta/rsqr/resi | Regression | 线性回归指标 |
| imax/imin/imxd | Aroon | 趋势强度指标 |
| k/d | K-line Patterns | K 线形态指标 |

## 开发说明

- 数据库在首次启动时自动创建（`init_db()` 调用 `Base.metadata.create_all`）
- 因子定义在启动时自动初始化（seed），包含 30+ 基础因子 + 120+ 技术因子
- 支持 APScheduler 定时数据同步（每日盘后 15:31）
- 交易约束支持主板 ±10%、创业板/科创板 ±20%、北交所 ±30%
- `backtest_trades` 表随应用启动自动创建，无需手动迁移

## 版本更新

### v0.7.0 (2026-06) — 策略管理 & 模拟交易增强
**策略模板系统 (P11.1)**：
- 新增 `Strategy` 模型（id/name/description/config_json/category）
- CRUD 端点：`GET/POST/PUT/DELETE /api/v1/strategies`
- 4 个预设策略模板：低估值高成长、动量反转、高质量低波动、小盘成长
- 启动时自动 seed 预设策略

**前端策略管理 (P11.2)**：
- 回测页新增策略模板选择器，选择后自动填充配置
- "保存为策略"按钮，可将当前配置保存为自定义策略
- 前端 API 层 `strategy.ts` + 类型定义 `strategy.ts`

**模拟交易增强 (P11.3)**：
- 创建模拟盘弹窗：选择策略模板 + 自定义配置（资金/持仓/频率/权重）
- 持仓/信号/订单表格增加股票名称列
- 概览卡片：总模拟盘数、活跃数、最佳收益率、总持仓市值
- 不再直接复用 backtestStore，独立配置管理

**测试覆盖 (P11.5)**：
- 新增 `test_strategy.py`（11 个用例：模型/配置序列化/预设策略/seed 逻辑）

### v0.6.0 (2026-06) — 数据同步优化 & Dashboard 增强
**数据同步并行化 (P10.1)**：
- `sync_daily_quotes` 从逐只串行改为 `asyncio.Semaphore(10)` + `asyncio.gather` 并行
- `sync_stock_info` / `sync_financial_reports` 同样改为并行，移除 `limit(500)` / `limit(300)` 硬编码
- 新增 `_build_daily_row` 辅助方法提取行构建逻辑
- `SYNC_CONCURRENCY = 10` 控制并发数，`BATCH_SIZE = 500` 控制 bulk upsert 批量大小

**同步进度 SSE 推送 (P10.2)**：
- `POST /sync` 改为 `BackgroundTasks` 后台执行，立即返回 `{"job_id": "sync", "status": "started"}`
- 新增 `GET /sync/progress` SSE 端点，实时推送同步进度
- 前端 DataManagementPage 新增 SSE 进度条（百分比 + 步骤 + 蓝紫渐变进度条）

**增量同步 (P10.3)**：
- 新增 `_get_last_sync_date` 从 SyncLog 读取上次成功日期
- 默认从上次同步日期 - 3 天开始同步（3 天 overlap 确保不遗漏）
- 仅在未指定 start_date 时启用增量同步

**Dashboard 增强 (P10.4)**：
- 新增市场广度堆叠柱状图（涨停/涨/平/跌/跌停）
- 多指数对比：支持选择 2-4 个指数，归一化走势对比
- 自选股卡片显示实时价格和涨跌幅

**DataManagementPage 增强 (P10.5)**：
- SSE 同步进度条（百分比 + 步骤 + 进度条）
- 数据覆盖范围显示（新增 `GET /data/coverage` 端点，日期范围 + 数据量）
- 单股票同步入口（输入代码 + 日期范围）
- 同步类型改为 checkbox 多选组（8 种类型 + 全选/清空）

**测试覆盖 (P10.7)**：
- 新增 `test_data_service.py`（15 个用例：行构建/NaN 处理/日期解析/增量日期/安全值/常量）

### v0.5.0 (2026-06) — 模拟交易增强 & 回测结果持久化
**模拟交易成交模拟修复 (P9.1)**：
- `simulate_fill` 从硬编码 `fill_rate=0.98` 改为查询当日实际行情
- 检查涨跌停状态（涨停不可买入、跌停不可卖出）
- 成交价使用当日收盘价（模拟收盘调仓）
- 成交量上限为当日成交量的 1%，向下取整到 100 股整手
- 无行情/零成交量时拒绝成交

**signal_engine risk_parity 实现 (P9.2)**：
- `weighting == "risk_parity"` 分支从等权 fallback 改为引用 `portfolio_constructor.risk_parity_weights`
- 新增 `_load_return_df` 方法加载近 60 日收益率矩阵
- 数据不足（< 20 个交易日）时 fallback 到等权
- `_load_quotes` 改为分批 500 只查询，避免 SQLite 参数限制

**持仓市值和盈亏实时更新 (P9.3)**：
- 新增 `_update_position_values` 方法，每次调仓后查询当日收盘价更新所有持仓
- `market_value` = shares × close（实时市值）
- `unrealized_pnl` = shares × (close - avg_cost)（实时浮动盈亏）

**模拟交易净值曲线 (P9.4)**：
- 新增 `PaperDailyValue` 模型（run_id, trade_date, total_value, cash, daily_return）
- `paper_engine.run_once()` 每次调仓后自动记录当日净值
- 新增 `GET /paper/runs/{id}/equity` 端点返回净值曲线数据
- 前端 PaperTradePage 新增"净值曲线"Tab（净值/现金曲线 + 回撤曲线）

**回测结果持久化 (P9.5)**：
- 回测运行完成后将 daily/trades/summary 写入 BacktestDaily/BacktestTrade/BacktestSummary 表
- 各查询端点优先从 DB 读取，内存作为 fallback
- 进程重启后回测结果不丢失

**前端模拟交易增强 (P9.6)**：
- `paper.ts` 新增 `fetchPaperEquity`、`updatePaperRun`、`deletePaperRun` API
- PaperTradePage 新增暂停/恢复/关闭操作按钮
- PaperTradePage 新增删除模拟盘功能（hover 显示删除按钮）
- 订单历史 Tab 新增拒绝原因列
- 后端新增 `DELETE /paper/runs/{id}` 端点级联删除

**测试覆盖 (P9.7)**：
- 新增 `test_paper_engine.py`（7 个用例：正常成交/涨停拒绝/跌停拒绝/无行情/零成交量/成交量上限/枚举值）
- 新增 `test_backtest_persistence.py`（6 个用例：模型字段/日期解析/JSON 序列化）

### v0.4.0 (2026-06) — 前后端对接 & 事件驱动引擎增强
**事件驱动引擎重构 (P8.1)**：
- 预构建 `data_index` 字典索引，将 DataFrame 过滤替换为 O(1) 查找（性能提升 10x+）
- 新增交易明细记录（`all_trades` 列表，每笔买卖独立记录价格/金额/成本/滑点）
- 新增 ProgressTracker 进度推送（SSE 实时进度条）
- 新增基准对比（`_load_benchmark_series` 加载日频基准，日内沿用日频基准收益率）
- `daily_out` 格式与向量化引擎对齐（`positions_json` 为 JSON、`cash` 为当日值、`benchmark_value` 为基准累计净值）
- 移除 `limit(200000)` 硬编码
- `_generate_signals` 使用预构建索引替代 DataFrame 过滤

**前端 API 层补全 (P8.2)**：
- 新增 8 个 API 函数：`fetchBacktestTrades`、`fetchBacktestPositions`、`fetchBacktestTurnover`、`fetchBacktestBarra`、`createProgressSSE`、`cancelBacktest`、`deleteBacktest`、`compareBacktests`
- 新增 5 个类型定义：`BacktestTrade`、`BacktestPosition`、`TurnoverAnalysis`、`BarraAttribution`、`AttributionResult`（含 `daily_attribution`/`summary`）
- `BacktestConfig` 新增 `mode`（daily/intraday）及日内策略参数（strategy/freq/lookback/hold_period/stop_loss/take_profit/max_positions/position_size/force_close_eod）

**报告页增强 (P8.3)**：
- Tab 布局（概览/归因/交易/持仓/换手率），替代单页长滚动
- 归因 Tab：Brinson 行业归因 + 因子归因 + Barra 多因子归因（柱状图可视化）
- 交易 Tab：交易明细表格（日期/代码/方向/数量/价格/金额/成本/滑点）
- 持仓 Tab：每日持仓权重明细表
- 换手率 Tab：换手率时序图 + 统计摘要（平均/最大/交易次数）
- 修复导出链接路径（`/api/v1/backtest/runs/{id}/report`）
- 移除不存在的 PDF 导出，保留 HTML + CSV

**回测页增强 (P8.4)**：
- 日内回测模式（策略类型/分钟频率/回看窗口/持仓时长/止损止盈/最大持仓/收盘平仓）
- SSE 实时进度条（百分比 + 步骤 + 净值信息）
- 回测历史操作按钮（查看/取消/删除）
- 多回测对比（复选框 + 对比弹窗，显示累计收益/年化/Sharpe/回撤/Alpha/胜率）

**测试覆盖 (P8.5)**：
- 新增 `test_event_driven_engine.py`（7 个用例：索引构建/信号生成/策略/回看不足）
- 新增 `test_optimizer.py`（11 个用例：目标函数/参数稳定性/边界情况）

### v0.3.4 (2026-06) — Bug修复与性能优化
**严重 Bug 修复 (P7)**：
- 修复 `positions_json` 只记录最后一天持仓状态
- 修复 `cash` 管理逻辑（未扣除买入本金）
- 修复 `volume_intensity` 因子错误使用价格代替成交量计算
- 修复 `profit_factor`/`avg_win_loss` 返回 `inf` 导致 JSON 序列化失败
- 修复 Barra Size 因子 `or True` 逻辑错误
- 修复买入分配 `target_value` 双重计算（`portfolio_value + cash`）
- 修复无法卖出的持仓无故丢失
- 修复保留持仓权重未计入 `current_weights`

**性能优化 (P7.2)**：
- 基准数据预加载（252 次 → 1 次 DB 查询）
- 月度收益按日历月划分（替代固定 21 天分块）
- Barra 归因查询从 1500+ 次优化至 2 次 DB 查询
- `ret_matrix` 计算复用（消除同一调仓日 3 次重复计算）
- 波动率目标缩放（`vol_scale`）实际生效
- 财报取最新记录改用 `drop_duplicates(keep="first")` 替代不稳定的 `groupby.last()`

**代码质量 (P7.3)**：
- `risk_parity` 代码去重：`PositionSizer` 委托给 `portfolio_constructor`
- `_compute_am_pm_ratio` 添加 TODO 文档说明（需分钟级数据）
- `ProgressTracker` 完成 5 分钟后自动清理，防止内存泄漏
- `/compare` 端点 3 次批量查询替代 N 次逐个查询
- `/runs` 列表用 `func.count()` 替代 `len(all())`

**测试覆盖**：
- 新增 `test_brinson.py`（6 个用例）
- 新增 `test_progress.py`（7 个用例）

### v0.3.3 (2026-06) — 交互体验增强
**交互体验 (P6.4)**：
- SSE 实时进度推送（`GET /progress/{run_id}`）
- 回测取消（`POST /runs/{run_id}/cancel`）
- 多回测对比（`GET /compare?run_ids=id1,id2`）

### v0.3.2 (2026-06) — 归因分析
**归因分析 (P6.2)**：
- 每日 Brinson 归因重写：每个调仓日独立计算，行业等权基准，真实选股效应
- Barra 多因子归因：Size / Value / Momentum / Quality / Volatility / Liquidity 6 因子
- OLS 回归分解收益来源，批量查询优化（2 次 DB 查询完成所有计算）

### v0.3.1 (2026-06) — 报告导出
**报告导出 (P6.1.4)**：
- HTML 报告导出（ECharts 净值曲线、绩效卡片、风险指标、月度收益、交易明细）
- CSV 数据导出（包含回测概览、绩效指标、日数据、交易明细）
- 新增 `report_service.py` 模块
- 新增 `GET /runs/{id}/report` API 端点
- 修复 XSS 风险（`html.escape` 转义用户输入）

### v0.3.0 (2026-06) — 回测核心增强
**回测功能增强 (P6)**：
- 移除 500 只股票限制，支持分批查询（默认 3000 只）
- 因子计算缓存机制，同一因子+日期只计算一次
- 并行参数优化（`asyncio.gather` + Semaphore 控制并发度）
- 交易明细记录（`BacktestTrade` 模型），每笔买卖独立记录
- 双边换手率：`(买入+卖出)/2 / 总资产`
- 持仓追踪：`position_avg_costs` + `cumulative_pnl` 每日累计盈亏
- 新增 `max_stocks`、`min_daily_amount`、`position_sizing`、风控参数配置

### v0.2.0 (2026-06)
- 新增 Qlib Alpha158 技术因子体系（120+ 技术指标）
- 新增技术指标因子类别
- 修复因子相关性矩阵为空的问题
- 修复 IC 分析、分层回测无结果的问题
- 优化因子计算逻辑，支持每只股票最新可用数据
- 新增 `/factor/latest-date` API 端点
- 修复 JSON 序列化 NaN 值导致的 500 错误

### v0.1.0 (2026-05)
- 初始版本发布
- 双引擎回测（向量化 + 事件驱动）
- 30+ 内置因子
- 因子分析工具（IC/分层/相关性）
- 绩效分析与报告导出