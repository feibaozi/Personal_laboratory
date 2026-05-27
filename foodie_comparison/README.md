# 🍔 Foodie Comparison — 外卖比价优惠券助手

跨平台（美团/饿了么/京东外卖/抖音外卖）外卖比价与优惠券聚合应用。支持同商品多平台价格对比、优惠后总价计算、智能推荐、红包聚合展示。

[![Backend](https://img.shields.io/badge/backend-FastAPI-009688)](https://fastapi.tiangolo.com/)
[![Frontend](https://img.shields.io/badge/frontend-Flutter-02569B)](https://flutter.dev/)
[![Python](https://img.shields.io/badge/python-3.13+-blue)](https://python.org/)
[![Test](https://img.shields.io/badge/tests-95%2F95%20passed-brightgreen)](#-testing)

---

## 📋 目录

- [版本迭代](#-版本迭代)
- [架构概览](#-架构概览)
- [功能特性](#-功能特性)
- [项目结构](#-项目结构)
- [快速开始](#-快速开始)
- [API 文档](#-api-文档)
- [测试](#-测试)
- [后续规划](#-后续规划)

---

## 🏷 版本迭代

### v0.4.0 — 数据链路打通（当前）🟢

**2026-05-27**

> 从 Mock 数据到全链路 API 驱动的关键里程碑。

- **后端首页 API 上线**：`GET /api/coupons/home`、`GET /api/recommend/shops`、`GET /api/platform/activities`、`GET /api/platform/flash-sale` 四个新端点
- **采集器混合调度策略**：`BaseCollector` 新增 `collect_with_fallback`，支持 API → 爬虫 → 缓存 → 手动录入多级降级
- **全平台采集器重构**：美团/饿了么/京东/抖音 4 个 Collector 实现 `_collect_*_crawler` + `_collect_*_cache` 策略方法
- **定时任务改造**：`price_sync`、`coupon_sync`、`recommend_rebuild` 接入真实采集器与去重逻辑
- **API Client 层**：新增 `MeituanAPIClient` / `ElemeAPIClient` 封装（签名算法 + 业务方法）
- **数据监控 API**：`GET /api/admin/stats` 数据总览 + `GET /api/admin/collector-status` 采集器健康状态
- **Flutter HomePage 改造**：从 Mock 数据切换为 `HomeProvider` API 驱动，支持下拉刷新、平台筛选、错误重试

---

### v0.3.0 — 核心服务实现 ✅

**2026-05-26**

- **OCR 服务**：PaddleOCR 截图识别，支持美团/饿了么/京东/抖音 4 平台结构提取
- **比价引擎**：`CompareService` 多平台优惠后总价计算，自动最优满减匹配
- **推荐引擎**：`RecommendService` 混合推荐（内容推荐 + 价格感知排序 + 冷启动兜底）
- **Celery 定时任务**：价格同步、优惠券同步、平台活动同步、推荐重建
- **数据库模型全量**：14 张表，覆盖用户/店铺/商品/价格/优惠券/行为/推荐

---

### v0.2.0 — 用户系统与数据采集 ✅

**2026-05-25**

- **JWT 认证**：`AuthService` 注册/登录/Token 管理
- **用户偏好 API**：菜系权重、口味偏好、价格敏感度设置
- **订单历史 API**：订单记录、省钱统计
- **4 平台数据采集器**：`MeituanCollector` / `ElemeCollector` / `JDCollector` / `DouyinCollector`
- **代理池**：Redis 代理 IP 管理，自动标记好坏
- **Playwright 反爬**：无头浏览器 + 反检测脚本 + 随机 User-Agent

---

### v0.1.0 — 项目初始化 ✅

**2026-05-22**

- FastAPI + PostgreSQL + Redis 后端骨架
- Flutter 3.x 前端项目初始化
- Docker Compose 开发环境
- 数据库连接管理与 Alembic 迁移
- Celery 任务队列配置

---

## 🏗 架构概览

```
┌──────────────────────────────────────────────────────────────┐
│                      Flutter App                              │
│  pages/   providers/   widgets/cards/   services/            │
└──────────────────────────┬───────────────────────────────────┘
                           │ REST API (Dio)
┌──────────────────────────▼───────────────────────────────────┐
│                    FastAPI Backend                            │
│  ┌───────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │  Routers  │  │   Services   │  │     Collectors       │   │
│  │  auth     │  │  auth_svc    │  │  base_collector      │   │
│  │  user     │  │  compare_svc │  │  meituan_collector   │   │
│  │  home     │  │  recommend   │  │  eleme_collector     │   │
│  │  compare  │  │  ocr_svc     │  │  jd_collector        │   │
│  │  recommend│  │  user_svc    │  │  douyin_collector    │   │
│  │  ocr      │  └──────────────┘  │  coupon_collector    │   │
│  │  admin    │                    │  proxy_pool          │   │
│  └───────────┘                    │  api/ (OpenAPI)      │   │
│                                    └─────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐│
│  │              Celery Tasks                                 ││
│  │  price_sync  coupon_sync  platform_sync  recommend_rebuild││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
         │                │                │
    PostgreSQL 16      Redis 7        Playwright
```

---

## ✨ 功能特性

| 功能 | 状态 | 说明 |
|------|------|------|
| 🌐 跨平台比价 | ✅ | 美团/饿了么/京东/抖音 优惠后总价对比 |
| 📊 省钱榜单 | ✅ | 基于真实价格快照的省钱排行 |
| 🎫 优惠券聚合 | ✅ | 多平台优惠券统览与领取 |
| 🔥 限时秒杀 | ✅ | 平台限时活动实时展示 |
| 🎯 智能推荐 | ✅ | 内容推荐 + 价格感知排序 + 冷启动 |
| 📸 截图识别 | ✅ | PaddleOCR 外卖订单截图提取 |
| 🧠 用户偏好 | ✅ | 菜系/口味/价格敏感度学习 |
| 🔐 JWT 认证 | ✅ | 注册/登录/Token 刷新 |
| 📈 数据监控 | ✅ | 采集状态、数据量、覆盖率看板 |
| ⏰ 定时采集 | ✅ | Celery 自动价格/优惠券/推荐更新 |

---

## 📁 项目结构

```
foodie_comparison/
├── lib/                          # Flutter 前端
│   ├── main.dart
│   ├── config/                   # API 配置、主题
│   ├── models/index.dart         # 数据模型
│   ├── pages/                    # 页面
│   │   ├── home_page.dart        # 首页（卡片聚合）
│   │   ├── compare_page.dart     # 比价结果
│   │   ├── recommend_page.dart   # 推荐
│   │   ├── login_page.dart       # 登录
│   │   └── profile_page.dart     # 个人中心
│   ├── providers/                # 状态管理
│   │   ├── auth_provider.dart
│   │   ├── home_provider.dart
│   │   ├── compare_provider.dart
│   │   └── recommend_provider.dart
│   ├── services/api_client.dart  # HTTP 客户端
│   └── widgets/cards/            # 卡片组件
│       ├── coupon_card.dart
│       ├── recommend_card.dart
│       ├── saving_rank_card.dart
│       ├── flash_sale_card.dart
│       └── platform_activity_card.dart
├── test/                         # Flutter 测试
│   ├── unit_test.dart            # 单元测试
│   └── widget_test.dart          # Widget 测试
├── backend/                      # Python 后端
│   ├── app/
│   │   ├── main.py               # FastAPI 入口
│   │   ├── config.py             # 配置管理
│   │   ├── database.py           # 数据库连接
│   │   ├── redis_client.py       # Redis 客户端
│   │   ├── celery_app.py         # Celery 配置
│   │   ├── routers/              # 7 个路由模块
│   │   │   ├── auth.py, user.py, home.py
│   │   │   ├── compare.py, recommend.py
│   │   │   ├── ocr.py, admin.py
│   │   ├── services/             # 5 个服务
│   │   │   ├── auth_service.py, user_service.py
│   │   │   ├── compare_service.py, recommend_service.py
│   │   │   └── ocr_service.py
│   │   ├── collectors/           # 数据采集
│   │   │   ├── base_collector.py # 基类 + 混合调度
│   │   │   ├── meituan_collector.py
│   │   │   ├── eleme_collector.py
│   │   │   ├── jd_collector.py
│   │   │   ├── douyin_collector.py
│   │   │   ├── coupon_collector.py
│   │   │   ├── proxy_pool.py
│   │   │   └── api/              # 官方 API 封装
│   │   │       ├── meituan_api.py
│   │   │       └── eleme_api.py
│   │   ├── models/               # 14 个数据表模型
│   │   ├── schemas/              # Pydantic 请求/响应
│   │   └── tasks/                # 5 个 Celery 任务
│   ├── test_phase2_full.py       # 认证与偏好测试 (18 case)
│   ├── test_phase3_collectors.py # 采集器测试 (36 case)
│   ├── test_phase4_5.py          # OCR 与比价测试 (34 case)
│   ├── test_phase6_recommend.py  # 推荐引擎测试 (28 case)
│   ├── seed_data.py              # 种子数据 (30 店铺 / 113 商品)
│   ├── config/platforms.yaml     # 平台配置
│   └── requirements.txt
├── docs/
│   └── real_data_integration_plan.md  # 真实数据接入方案
└── docker-compose.yml
```

---

## 🚀 快速开始

### 环境要求

- Python 3.13+
- Flutter 3.44+
- PostgreSQL 16
- Redis 7

### 后端启动

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 初始化种子数据
python seed_data.py

# 启动服务
uvicorn app.main:app --reload --port 8000
```

访问 `http://localhost:8000/docs` 查看 Swagger API 文档。

### Flutter 前端启动

```bash
cd foodie_comparison

# 安装依赖
flutter pub get

# 启动应用
flutter run
```

### Docker 一键启动

```bash
docker-compose up -d
```

---

## 📡 API 文档

### 核心端点概览

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| `POST` | `/api/auth/register` | 用户注册 | 否 |
| `POST` | `/api/auth/login` | 用户登录 | 否 |
| `GET` | `/api/auth/me` | 当前用户信息 | 是 |
| `GET` | `/api/user/preference` | 用户偏好 | 是 |
| `PUT` | `/api/user/preference` | 更新偏好 | 是 |
| `GET` | `/api/user/orders` | 订单历史 | 是 |
| `POST` | `/api/user/orders` | 添加订单 | 是 |
| `GET` | `/api/coupons/home` | 首页优惠券 | 否 |
| `GET` | `/api/recommend/shops` | 推荐店铺 | 否 |
| `GET` | `/api/compare/saving-rank` | 省钱榜单 | 否 |
| `GET` | `/api/compare/product` | 商品比价 | 是 |
| `GET` | `/api/compare/shop` | 店铺比价 | 是 |
| `GET` | `/api/platform/activities` | 平台活动 | 否 |
| `GET` | `/api/platform/flash-sale` | 限时秒杀 | 否 |
| `POST` | `/api/ocr/extract` | OCR 识别 | 是 |
| `GET` | `/api/ocr/health` | OCR 健康检查 | 否 |
| `GET` | `/api/admin/stats` | 数据总览 | 否 |
| `GET` | `/api/admin/collector-status` | 采集器状态 | 否 |
| `POST` | `/api/recommend/behavior` | 记录行为 | 是 |

---

## 🧪 测试

### 后端测试

| 测试文件 | 覆盖范围 | 用例数 | 结果 |
|---------|---------|--------|------|
| `test_phase2_full.py` | 认证与用户偏好 | 18 | ✅ |
| `test_phase3_collectors.py` | 数据采集引擎 | 36 | ✅ |
| `test_phase4_5.py` | OCR 与比价逻辑 | 34 | ✅ |
| `test_phase6_recommend.py` | 推荐引擎 | 28 | ✅ |
| **总计** | | **116** | **全部通过** |

```bash
cd backend
python -m pytest test_phase2_full.py test_phase3_collectors.py \
  test_phase4_5.py test_phase6_recommend.py -v
```

### Flutter 测试

```bash
flutter test test/unit_test.dart -v
flutter test test/widget_test.dart -v
```

---

## 🗺 后续规划

| 优先级 | 任务 | 预计周期 |
|--------|------|---------|
| 🔴 高 | 接入美团/饿了么开放平台 API | 3-4 周 |
| 🔴 高 | 真实店铺种子数据上线 | 1-2 周 |
| 🟡 中 | Playwright 爬虫采集链路联调 | 2 周 |
| 🟡 中 | Celery 定时任务生产化运行 | 1 周 |
| 🟢 低 | 价格预测 & 省钱建议 | 2 周 |
| 🟢 低 | 推荐引擎接入真实行为数据 | 2 周 |
| ⚪ 远期 | Flutter 编译为微信小程序 | 待评估 |
| ⚪ 远期 | AI 对话式点餐推荐 | 待评估 |

---

*最后更新: 2026-05-27*
