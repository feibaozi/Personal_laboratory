# 外卖比价优惠券助手 (Foodie Comparison) 完整实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建一个跨平台（美团/饿了么/京东外卖/抖音外卖）的外卖比价与优惠券聚合小程序，支持优惠后总价对比、智能推荐、红包聚合展示与自动领取。

**Architecture:** 采用 Flutter 前端 + Python FastAPI 后端的分离架构。后端负责多平台数据采集、价格聚合、优惠券爬取、推荐算法；Flutter 前端负责卡片聚合型首页展示、搜索交互、平台切换。PostgreSQL 存储结构化业务数据，Redis 缓存热点数据，Celery 处理定时采集任务。

**Tech Stack:** Flutter 3.x (Dart), Python 3.11+, FastAPI, SQLAlchemy 2.0, PostgreSQL 16, Redis 7, Celery 5.x, PaddleOCR (截图识别), Playwright (网页抓取), Docker Compose

---

## 项目完整目录结构

```
foodie_comparison/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                          # FastAPI 入口，注册路由，启动事件
│   │   ├── config.py                        # 配置管理（环境变量 + YAML）
│   │   ├── database.py                      # SQLAlchemy engine + session + Base
│   │   ├── redis_client.py                  # Redis 连接管理
│   │   ├── celery_app.py                    # Celery 任务队列配置
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py                      # 用户认证 API（注册/登录/Token）
│   │   │   ├── user.py                      # 用户偏好/历史 API
│   │   │   ├── shop.py                      # 店铺查询/详情 API
│   │   │   ├── product.py                   # 商品搜索/比价 API
│   │   │   ├── coupon.py                    # 优惠券聚合/领取 API
│   │   │   ├── recommend.py                 # 智能推荐 API
│   │   │   ├── platform.py                  # 平台活动 API
│   │   │   └── compare.py                   # 多平台比价 API（核心）
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── auth_service.py              # JWT 认证 + 密码哈希
│   │   │   ├── user_service.py              # 用户偏好管理、历史记录
│   │   │   ├── shop_service.py              # 店铺 CRUD + 搜索
│   │   │   ├── product_service.py           # 商品 CRUD + 跨平台匹配
│   │   │   ├── price_service.py             # 价格数据聚合与缓存
│   │   │   ├── coupon_service.py            # 优惠券数据聚合与管理
│   │   │   ├── recommend_service.py         # 协同过滤 + 内容推荐引擎
│   │   │   ├── compare_service.py           # 多平台总价比对逻辑
│   │   │   ├── platform_service.py          # 平台活动信息管理
│   │   │   └── ocr_service.py               # OCR 截图识别服务
│   │   ├── collectors/                      # 数据采集模块
│   │   │   ├── __init__.py
│   │   │   ├── base_collector.py            # 采集器基类（限速、重试、代理）
│   │   │   ├── meituan_collector.py         # 美团数据采集
│   │   │   ├── eleme_collector.py           # 饿了么数据采集
│   │   │   ├── jd_collector.py              # 京东外卖数据采集
│   │   │   ├── douyin_collector.py          # 抖音外卖数据采集
│   │   │   ├── coupon_collector.py          # 优惠券通用采集器
│   │   │   └── proxy_pool.py                # 代理IP池管理
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user.py                      # User, UserPreference 模型
│   │   │   ├── shop.py                      # Shop, ShopPlatformLink 模型
│   │   │   ├── product.py                   # Product, CrossPlatformProduct 模型
│   │   │   ├── price.py                     # PriceSnapshot, DeliveryFeeSnapshot 模型
│   │   │   ├── coupon.py                    # Coupon, UserCoupon 模型
│   │   │   ├── order.py                     # Order, OrderHistory 模型
│   │   │   ├── platform.py                  # PlatformActivity, FlashSale 模型
│   │   │   └── recommend.py                 # UserBehavior, RecommendResult 模型
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py                      # 认证相关 Pydantic schemas
│   │   │   ├── user.py                      # 用户相关 schemas
│   │   │   ├── shop.py                      # 店铺相关 schemas
│   │   │   ├── product.py                   # 商品相关 schemas
│   │   │   ├── price.py                     # 价格相关 schemas
│   │   │   ├── coupon.py                    # 优惠券相关 schemas
│   │   │   ├── compare.py                   # 比价请求/响应 schemas
│   │   │   └── recommend.py                 # 推荐相关 schemas
│   │   └── tasks/                           # Celery 异步任务
│   │       ├── __init__.py
│   │       ├── price_sync.py                # 定时同步价格任务
│   │       ├── coupon_sync.py               # 定时同步优惠券任务
│   │       ├── platform_sync.py             # 定时同步平台活动任务
│   │       ├── recommend_rebuild.py         # 定时重建推荐模型任务
│   │       └── cleanup.py                   # 过期数据清理任务
│   ├── alembic/                             # 数据库迁移（Alembic）
│   │   ├── env.py
│   │   └── versions/
│   ├── migrations/                          # 初始迁移脚本
│   ├── config/
│   │   ├── settings.yaml                    # 应用配置文件
│   │   └── platforms.yaml                   # 各平台采集策略配置
│   ├── tests/
│   │   ├── conftest.py                      # 测试夹具
│   │   ├── test_auth.py
│   │   ├── test_compare.py
│   │   ├── test_recommend.py
│   │   ├── test_collectors/
│   │   │   ├── test_meituan_collector.py
│   │   │   └── test_eleme_collector.py
│   │   └── test_ocr.py
│   ├── requirements.txt
│   ├── pyproject.toml
│   ├── Dockerfile
│   └── docker-compose.yml                   # 后端 + DB + Redis + Celery
├── frontend/                                # Flutter 前端（已初始化）
│   ├── lib/
│   │   ├── main.dart
│   │   ├── app.dart                         # MaterialApp + 路由配置
│   │   ├── config/
│   │   │   ├── api_config.dart              # API 地址配置
│   │   │   └── theme.dart                   # 全局主题
│   │   ├── models/
│   │   │   ├── index.dart                   # 数据模型（已有）
│   │   │   ├── user.dart                    # 用户模型
│   │   │   └── compare.dart                 # 比价结果模型
│   │   ├── services/
│   │   │   ├── api_client.dart              # HTTP 客户端（Dio）
│   │   │   ├── auth_service.dart            # 认证服务
│   │   │   ├── shop_service.dart            # 店铺服务
│   │   │   ├── coupon_service.dart          # 优惠券服务
│   │   │   ├── compare_service.dart         # 比价服务
│   │   │   └── recommend_service.dart       # 推荐服务
│   │   ├── providers/
│   │   │   ├── auth_provider.dart           # 认证状态管理
│   │   │   ├── home_provider.dart           # 首页数据状态
│   │   │   ├── compare_provider.dart        # 比价状态
│   │   │   ├── coupon_provider.dart         # 优惠券状态
│   │   │   └── search_provider.dart         # 搜索状态
│   │   ├── pages/
│   │   │   ├── index.dart
│   │   │   ├── home_page.dart               # 首页（已有，需重构）
│   │   │   ├── search_page.dart             # 搜索页
│   │   │   ├── compare_page.dart            # 比价结果页
│   │   │   ├── coupon_center_page.dart      # 优惠券中心
│   │   │   ├── shop_detail_page.dart        # 店铺详情页
│   │   │   ├── profile_page.dart            # 个人中心
│   │   │   ├── settings_page.dart           # 设置页
│   │   │   └── login_page.dart              # 登录页
│   │   └── widgets/
│   │       ├── cards/
│   │       │   ├── index.dart               # 已有
│   │       │   ├── coupon_card.dart         # 已有
│   │       │   ├── recommend_card.dart      # 已有
│   │       │   ├── saving_rank_card.dart    # 已有
│   │       │   ├── flash_sale_card.dart     # 已有
│   │       │   └── platform_activity_card.dart # 已有
│   │       ├── common/
│   │       │   ├── loading_indicator.dart   # 加载指示器
│   │       │   ├── error_widget.dart        # 错误展示组件
│   │       │   ├── empty_state.dart         # 空状态组件
│   │       │   └── price_tag.dart           # 价格标签组件
│   │       └── platform/
│   │           ├── platform_badge.dart      # 平台标识徽章
│   │           └── platform_selector.dart   # 平台选择器
│   ├── pubspec.yaml
│   └── test/
│       ├── widget_test.dart
│       └── services/
│           └── api_client_test.dart
├── data/                                    # 数据目录
│   └── seed/                                # 种子数据
├── docker-compose.yml                       # 整体编排
├── .env.example
├── .gitignore
└── README.md
```

---

# ============================================
# Phase 0: 项目基础设施与开发环境搭建
# ============================================

> **目标:** 搭建完整开发环境，初始化所有基础设施，确保前后端可独立运行。
> **预计耗时:** 2-3 天

---

### Task 0.1: 初始化后端项目基础设施

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/pyproject.toml`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `backend/app/__init__.py`
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/schemas/__init__.py`
- Create: `backend/app/collectors/__init__.py`
- Create: `backend/app/tasks/__init__.py`

**Step 1: 创建 `backend/requirements.txt`**

```
# Web Framework
fastapi==0.115.0
uvicorn[standard]==0.32.0

# Database
sqlalchemy==2.0.35
asyncpg==0.29.0
psycopg2-binary==2.9.10
alembic==1.13.0

# Auth
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.12

# Cache & Queue
redis==5.1.0
celery[redis]==5.4.0

# Data Collection
playwright==1.47.0
httpx==0.27.0
beautifulsoup4==4.12.3
lxml==5.3.0

# OCR
paddleocr==2.9.0
paddlepaddle==3.0.0

# AI / Recommendation
scikit-learn==1.5.0
numpy==1.26.0
pandas==2.2.0

# Config & Validation
pydantic==2.9.0
pydantic-settings==2.5.0
python-dotenv==1.0.1
pyyaml==6.0.2

# Testing
pytest==8.3.0
pytest-asyncio==0.24.0
httpx==0.27.0

# Utilities
loguru==0.7.2
schedule==1.2.1
```

**Step 2: 创建 `backend/pyproject.toml`**

```toml
[project]
name = "foodie_comparison_backend"
version = "0.1.0"
description = "外卖比价优惠券助手后端"
requires-python = ">=3.11"

[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
asyncio_mode = "auto"

[tool.alembic]
script_location = "alembic"
sqlalchemy.url = "postgresql+asyncpg://postgres:postgres@localhost:5432/foodie_dev"
```

**Step 3: 创建 `.env.example`**

```
# Database
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/foodie_dev
DATABASE_URL_SYNC=postgresql://postgres:postgres@localhost:5432/foodie_dev

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT
JWT_SECRET_KEY=change-me-to-a-random-secret
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=1440

# App
APP_ENV=development
LOG_LEVEL=DEBUG
API_PORT=8000

# CORS
CORS_ORIGINS=["http://localhost:3000","http://localhost:8080"]

# Collectors (采集器配置)
COLLECTOR_RATE_LIMIT=2          # 每秒请求数
COLLECTOR_MAX_RETRIES=3         # 最大重试次数
COLLECTOR_PROXY_ENABLED=false   # 是否启用代理
COLLECTOR_USER_AGENT=Mozilla/5.0 ...
```

**Step 4: 创建 `.gitignore`**

```
.env
__pycache__/
*.pyc
*.pyo
.pytest_cache/
.venv/
venv/
*.db
*.db-shm
*.db-wal
node_modules/
dist/
build/
.dart_tool/
.flutter-plugins
.flutter-plugins-dependencies
*.iml
.idea/
.vscode/
*.log
data/
collected_data/
playwright-report/
test-results/
```

**Step 5: Commit**

```bash
git add backend/requirements.txt backend/pyproject.toml .env.example .gitignore \
  backend/app/__init__.py backend/app/routers/__init__.py \
  backend/app/services/__init__.py backend/app/models/__init__.py \
  backend/app/schemas/__init__.py backend/app/collectors/__init__.py \
  backend/app/tasks/__init__.py
git commit -m "feat: initialize backend project infrastructure"
```

---

### Task 0.2: 配置管理与环境变量加载

**Files:**
- Create: `backend/app/config.py`

**Step 1: 编写配置管理模块**

```python
import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")


class Settings(BaseSettings):
    # Database
    database_url: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/foodie_dev"
    )
    database_url_sync: str = (
        "postgresql://postgres:postgres@localhost:5432/foodie_dev"
    )

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT
    jwt_secret_key: str = "dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 1440

    # App
    app_env: str = "development"
    log_level: str = "DEBUG"
    api_port: int = 8000
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:8080"]

    # Collectors
    collector_rate_limit: int = 2
    collector_max_retries: int = 3
    collector_proxy_enabled: bool = False
    collector_user_agent: str = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    )

    # Recommendation
    recommend_min_behaviors: int = 10
    recommend_model_path: str = "data/recommend_model.pkl"

    # OCR
    ocr_confidence_threshold: float = 0.85
    ocr_use_gpu: bool = False

    model_config = {"env_prefix": "", "case_sensitive": False}


settings = Settings()
```

**Step 2: 应用配置文件 `backend/config/settings.yaml`**

```yaml
platforms:
  meituan:
    name: "美团"
    base_url: "https://i.meituan.com"
    icon: "🥡"
    color: "#FFD100"
    enabled: true
  eleme:
    name: "饿了么"
    base_url: "https://h5.ele.me"
    icon: "🥢"
    color: "#00C853"
    enabled: true
  jd_waimai:
    name: "京东外卖"
    base_url: "https://waimai.jd.com"
    icon: "🛵"
    color: "#E83F27"
    enabled: true
  douyin_waimai:
    name: "抖音外卖"
    base_url: "https://www.douyin.com"
    icon: "🎵"
    color: "#000000"
    enabled: true

recommend:
  weights:
    price_sensitivity: 0.35      # 价格敏感度权重
    cuisine_preference: 0.25     # 菜系偏好权重
    recency: 0.20                # 最近消费权重
    rating: 0.20                 # 评分权重
  decay_days: 30                 # 历史行为衰减天数

collector:
  schedule:
    price_sync_cron: "0 */2 * * *"     # 每2小时同步价格
    coupon_sync_cron: "0 */1 * * *"    # 每1小时同步优惠券
    platform_sync_cron: "0 8 * * *"    # 每天8点同步活动
    recommend_rebuild_cron: "0 2 * * *" # 每天凌晨2点重建推荐
```

**Step 3: Commit**

```bash
git add backend/app/config.py backend/config/settings.yaml
git commit -m "feat: add configuration management with pydantic-settings and YAML"
```

---

### Task 0.3: Docker 开发环境搭建

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/docker-compose.yml`
- Create: `backend/Dockerfile`

**Step 1: 创建根 `docker-compose.yml`**

```yaml
version: "3.8"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: foodie_dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://postgres:postgres@postgres:5432/foodie_dev
      DATABASE_URL_SYNC: postgresql://postgres:postgres@postgres:5432/foodie_dev
      REDIS_URL: redis://redis:6379/0
    depends_on:
      - postgres
      - redis
    volumes:
      - ./backend:/app

  celery_worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: celery -A app.celery_app worker --loglevel=info
    environment:
      DATABASE_URL: postgresql+asyncpg://postgres:postgres@postgres:5432/foodie_dev
      REDIS_URL: redis://redis:6379/0
    depends_on:
      - postgres
      - redis
    volumes:
      - ./backend:/app

  celery_beat:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: celery -A app.celery_app beat --loglevel=info
    environment:
      DATABASE_URL: postgresql+asyncpg://postgres:postgres@postgres:5432/foodie_dev
      REDIS_URL: redis://redis:6379/0
    depends_on:
      - postgres
      - redis
    volumes:
      - ./backend:/app

volumes:
  pgdata:
```

**Step 2: 创建 `backend/Dockerfile`**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

**Step 3: 验证环境**

```bash
# 启动基础设施
docker-compose up -d postgres redis

# 验证 PostgreSQL
docker-compose exec postgres psql -U postgres -d foodie_dev -c "SELECT 1;"

# 验证 Redis
docker-compose exec redis redis-cli ping
# 预期: PONG
```

**Step 4: Commit**

```bash
git add docker-compose.yml backend/docker-compose.yml backend/Dockerfile
git commit -m "feat: add Docker Compose development environment"
```

---

### Task 0.4: FastAPI 应用骨架与数据库连接

**Files:**
- Create: `backend/app/main.py`
- Create: `backend/app/database.py`
- Create: `backend/app/redis_client.py`

**Step 1: 编写数据库连接模块 `database.py`**

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import settings

# 异步引擎（FastAPI）
async_engine = create_async_engine(
    settings.database_url,
    echo=(settings.log_level == "DEBUG"),
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# 同步引擎（Celery/Alembic）
sync_engine = create_engine(
    settings.database_url_sync,
    echo=False,
    pool_size=5,
)

SyncSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=sync_engine,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


def get_sync_db():
    db = SyncSessionLocal()
    try:
        yield db
    finally:
        db.close()


async def init_db():
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db():
    await async_engine.dispose()
```

**Step 2: 编写 Redis 客户端 `redis_client.py`**

```python
import redis.asyncio as aioredis
from redis import Redis

from app.config import settings

# 异步 Redis（FastAPI）
async_redis = aioredis.from_url(settings.redis_url, decode_responses=True)

# 同步 Redis（Celery）
sync_redis = Redis.from_url(settings.redis_url, decode_responses=True)


async def get_redis():
    return async_redis


async def close_redis():
    await async_redis.close()


# 缓存辅助函数
async def cache_get(key: str) -> str | None:
    return await async_redis.get(key)


async def cache_set(key: str, value: str, ttl: int = 3600):
    await async_redis.setex(key, ttl, value)


async def cache_delete(key: str):
    await async_redis.delete(key)
```

**Step 3: 编写 FastAPI 入口 `main.py`**

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.config import settings
from app.database import init_db, close_db
from app.redis_client import close_redis


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database...")
    await init_db()
    logger.info("Database initialized")
    yield
    logger.info("Shutting down...")
    await close_db()
    await close_redis()
    logger.info("Shutdown complete")


app = FastAPI(
    title="Foodie Comparison API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/health/ready")
async def readiness():
    try:
        from app.database import AsyncSessionLocal
        from app.redis_client import async_redis
        await async_redis.ping()
        return {"status": "ready", "db": "ok", "redis": "ok"}
    except Exception as e:
        return {"status": "not_ready", "error": str(e)}
```

**Step 4: 启动验证**

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

访问 `http://localhost:8000/health` → `{"status": "ok", "version": "0.1.0"}`
访问 `http://localhost:8000/docs` → Swagger UI

**Step 5: Commit**

```bash
git add backend/app/main.py backend/app/database.py backend/app/redis_client.py
git commit -m "feat: add FastAPI skeleton with async PostgreSQL and Redis"
```

---

### Task 0.5: Flutter 前端依赖升级与 Provider 状态管理

**Files:**
- Modify: `frontend/pubspec.yaml`
- Create: `frontend/lib/providers/` (目录)
- Create: `frontend/lib/services/api_client.dart`

**Step 1: 更新 `pubspec.yaml`**

```yaml
name: foodie_comparison
description: 外卖比价优惠券小程序
version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  cupertino_icons: ^1.0.6
  
  # 状态管理
  provider: ^6.1.2
  
  # 网络请求
  dio: ^5.4.0
  
  # 路由
  go_router: ^14.0.0
  
  # 本地存储
  shared_preferences: ^2.2.0
  
  # UI 增强
  shimmer: ^3.0.0
  cached_network_image: ^3.3.0
  
  # 工具
  intl: ^0.19.0
  logger: ^2.0.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0
  mockito: ^5.4.0
  build_runner: ^2.4.0

flutter:
  uses-material-design: true
```

**Step 2: 创建 API 客户端 `frontend/lib/services/api_client.dart`**

```dart
import 'package:dio/dio.dart';
import '../config/api_config.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;
  
  late final Dio dio;
  
  ApiClient._internal() {
    dio = Dio(BaseOptions(
      baseUrl: ApiConfig.baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));
    
    dio.interceptors.add(LogInterceptor(
      requestBody: true,
      responseBody: true,
    ));
    
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _getToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) {
        handler.next(error);
      },
    ));
  }
  
  Future<String?> _getToken() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString('access_token');
    } catch (_) {
      return null;
    }
  }
  
  Future<Response> get(String path, {Map<String, dynamic>? params}) {
    return dio.get(path, queryParameters: params);
  }
  
  Future<Response> post(String path, {dynamic data}) {
    return dio.post(path, data: data);
  }
  
  Future<Response> put(String path, {dynamic data}) {
    return dio.put(path, data: data);
  }
  
  Future<Response> delete(String path) {
    return dio.delete(path);
  }
}
```

**Step 3: 创建首页 Provider `frontend/lib/providers/home_provider.dart`**

```dart
import 'package:flutter/material.dart';
import '../services/api_client.dart';

class HomeProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();
  
  List<Map<String, dynamic>> _coupons = [];
  List<Map<String, dynamic>> _shops = [];
  List<Map<String, dynamic>> _savingRank = [];
  List<Map<String, dynamic>> _activities = [];
  Map<String, dynamic>? _flashSale;
  
  bool _isLoading = false;
  String _error = '';
  String _selectedPlatform = 'all';
  
  // Getters
  List<Map<String, dynamic>> get coupons => _coupons;
  List<Map<String, dynamic>> get shops => _shops;
  List<Map<String, dynamic>> get savingRank => _savingRank;
  List<Map<String, dynamic>> get activities => _activities;
  Map<String, dynamic>? get flashSale => _flashSale;
  bool get isLoading => _isLoading;
  String get error => _error;
  String get selectedPlatform => _selectedPlatform;
  
  void setPlatform(String platform) {
    _selectedPlatform = platform;
    notifyListeners();
    loadHomeData();
  }
  
  Future<void> loadHomeData() async {
    _isLoading = true;
    _error = '';
    notifyListeners();
    
    try {
      final results = await Future.wait([
        _api.get('/api/coupons/home', params: {'platform': _selectedPlatform}),
        _api.get('/api/recommend/shops', params: {'platform': _selectedPlatform}),
        _api.get('/api/compare/saving-rank', params: {'platform': _selectedPlatform}),
        _api.get('/api/platform/activities', params: {'platform': _selectedPlatform}),
        _api.get('/api/platform/flash-sale', params: {'platform': _selectedPlatform}),
      ]);
      
      _coupons = List<Map<String, dynamic>>.from(results[0].data);
      _shops = List<Map<String, dynamic>>.from(results[1].data);
      _savingRank = List<Map<String, dynamic>>.from(results[2].data);
      _activities = List<Map<String, dynamic>>.from(results[3].data);
      _flashSale = results[4].data;
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
```

**Step 4: Commit**

```bash
git add frontend/pubspec.yaml frontend/lib/services/api_client.dart frontend/lib/providers/
git commit -m "feat: add Dio HTTP client and Provider state management for Flutter"
```

---

# ============================================
# Phase 1: 数据库模型设计与迁移
# ============================================

> **目标:** 创建完整的数据库 Schema，包含所有核心业务实体及其关系，建立 Alembic 迁移体系。
> **预计耗时:** 2-3 天

---

### Task 1.1: 用户模型

**Files:**
- Create: `backend/app/models/user.py`

```python
import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean, Float, JSON
)
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    phone = Column(String(20), unique=True, nullable=True, index=True)
    email = Column(String(128), unique=True, nullable=True)
    hashed_password = Column(String(256), nullable=False)
    nickname = Column(String(128), default="")
    avatar_url = Column(String(512), default="")
    
    # 地址（配送地址）
    default_address = Column(String(512), default="")
    
    # 用户状态
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow,
                       onupdate=datetime.datetime.utcnow)

    # Relationships
    preferences = relationship("UserPreference", back_populates="user",
                               uselist=False, cascade="all, delete-orphan")
    order_histories = relationship("OrderHistory", back_populates="user",
                                   cascade="all, delete-orphan")
    user_coupons = relationship("UserCoupon", back_populates="user",
                                cascade="all, delete-orphan")


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, unique=True, index=True)

    # 菜系偏好（JSON: {"中餐": 0.8, "西餐": 0.3, "日料": 0.5}）
    cuisine_weights = Column(JSON, default=dict)

    # 口味偏好（JSON: {"辣": 0.7, "酸": 0.2, "甜": 0.5, "清淡": 0.4}）
    taste_weights = Column(JSON, default=dict)

    # 消费习惯
    avg_order_amount = Column(Float, default=0.0)     # 平均订单金额
    price_sensitivity = Column(Float, default=0.5)     # 价格敏感度 0-1
    preferred_platforms = Column(JSON, default=list)   # ["meituan", "eleme"]
    preferred_delivery_time = Column(Integer, default=30)  # 期望配送时间（分钟）

    # 更新时间
    updated_at = Column(DateTime, default=datetime.datetime.utcnow,
                       onupdate=datetime.datetime.utcnow)

    # Relationship
    user = relationship("User", back_populates="preferences")
```

**Step 1: Commit**

```bash
git add backend/app/models/user.py
git commit -m "feat: add User and UserPreference database models"
```

---

### Task 1.2: 店铺与商品模型

**Files:**
- Create: `backend/app/models/shop.py`
- Create: `backend/app/models/product.py`

```python
# shop.py
import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Float, Boolean, JSON
)
from sqlalchemy.orm import relationship

from app.database import Base


class Shop(Base):
    __tablename__ = "shops"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(256), nullable=False, index=True)
    image_url = Column(String(512), default="")
    rating = Column(Float, default=0.0)
    category = Column(String(64), default="")  # 菜系分类
    address = Column(String(512), default="")
    latitude = Column(Float, default=0.0)
    longitude = Column(Float, default=0.0)
    is_chain = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow,
                       onupdate=datetime.datetime.utcnow)

    # Relationships
    platform_links = relationship(
        "ShopPlatformLink", back_populates="shop",
        cascade="all, delete-orphan"
    )
    products = relationship(
        "Product", back_populates="shop",
        cascade="all, delete-orphan"
    )


class ShopPlatformLink(Base):
    """店铺在各平台上的链接与ID映射"""
    __tablename__ = "shop_platform_links"

    id = Column(Integer, primary_key=True, autoincrement=True)
    shop_id = Column(Integer, nullable=False, index=True)
    platform = Column(String(32), nullable=False, index=True)  # meituan/eleme/jd_waimai/douyin_waimai
    platform_shop_id = Column(String(128), nullable=False)
    platform_url = Column(String(512), default="")
    extra_data = Column(JSON, default=dict)  # 平台特有数据

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationship
    shop = relationship("Shop", back_populates="platform_links")
```

```python
# product.py
import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Float, Boolean, JSON
)
from sqlalchemy.orm import relationship

from app.database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    shop_id = Column(Integer, nullable=False, index=True)
    name = Column(String(256), nullable=False)
    image_url = Column(String(512), default="")
    category = Column(String(64), default="")  # 商品分类
    description = Column(Text, default="")

    is_available = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow,
                       onupdate=datetime.datetime.utcnow)

    # Relationships
    shop = relationship("Shop", back_populates="products")
    prices = relationship(
        "PriceSnapshot", back_populates="product",
        cascade="all, delete-orphan"
    )
    cross_platforms = relationship(
        "CrossPlatformProduct", back_populates="product",
        cascade="all, delete-orphan"
    )


class CrossPlatformProduct(Base):
    """同一商品在不同平台的映射"""
    __tablename__ = "cross_platform_products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, nullable=False, index=True)
    platform = Column(String(32), nullable=False, index=True)
    platform_product_id = Column(String(128), nullable=False)
    platform_shop_id = Column(String(128), nullable=False)
    match_confidence = Column(Float, default=1.0)  # 匹配置信度

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationship
    product = relationship("Product", back_populates="cross_platforms")
```

**Step 2: Commit**

```bash
git add backend/app/models/shop.py backend/app/models/product.py
git commit -m "feat: add Shop, ShopPlatformLink, Product, CrossPlatformProduct models"
```

---

### Task 1.3: 价格、优惠券与订单模型

**Files:**
- Create: `backend/app/models/price.py`
- Create: `backend/app/models/coupon.py`
- Create: `backend/app/models/order.py`

```python
# price.py
import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Index
from sqlalchemy.orm import relationship

from app.database import Base


class PriceSnapshot(Base):
    """商品在不同平台/时间点的价格快照"""
    __tablename__ = "price_snapshots"
    __table_args__ = (
        Index("ix_price_product_platform_time",
              "product_id", "platform", "recorded_at"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, nullable=False, index=True)
    platform = Column(String(32), nullable=False, index=True)
    
    base_price = Column(Float, nullable=False)         # 基础价格
    package_fee = Column(Float, default=0.0)           # 打包费
    delivery_fee = Column(Float, default=0.0)          # 配送费
    min_order_amount = Column(Float, default=0.0)      # 起送价
    
    # 满减信息 (JSON: [{"threshold": 100, "discount": 50}])
    discount_info = Column(String, default="[]")
    
    # 优惠后总价
    final_price = Column(Float, nullable=False)
    
    # 数据来源
    source = Column(String(32), default="api")  # api / ocr / manual
    
    recorded_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)

    # Relationship
    product = relationship("Product", back_populates="prices")


class DeliveryFeeSnapshot(Base):
    """配送费单独记录（因位置变化）"""
    __tablename__ = "delivery_fee_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    platform = Column(String(32), nullable=False, index=True)
    shop_id = Column(Integer, nullable=False, index=True)
    
    user_lat = Column(Float, default=0.0)
    user_lng = Column(Float, default=0.0)
    
    delivery_fee = Column(Float, nullable=False)
    estimated_time_min = Column(Integer, default=30)
    estimated_time_max = Column(Integer, default=45)
    distance_km = Column(Float, default=0.0)
    
    recorded_at = Column(DateTime, default=datetime.datetime.utcnow)
```

```python
# coupon.py
import datetime
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Boolean, Text, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class CouponType(str, enum.Enum):
    DIRECT = "direct"           # 直接抵扣
    FULL_REDUCTION = "full_reduction"  # 满减
    DELIVERY_FREE = "delivery_free"    # 免配送费
    NEW_USER = "new_user"       # 新用户
    PLATFORM = "platform"       # 平台券


class Coupon(Base):
    __tablename__ = "coupons"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(256), nullable=False)
    type = Column(SAEnum(CouponType), default=CouponType.DIRECT)
    value = Column(Float, nullable=False)           # 优惠金额
    min_spend = Column(Float, default=0.0)          # 最低消费
    platform = Column(String(32), nullable=False, index=True)
    platform_coupon_id = Column(String(128), default="")
    description = Column(Text, default="")
    
    # 适用范围
    applicable_shops = Column(String, default="")   # 逗号分隔的shop_id
    applicable_categories = Column(String, default="")  # 逗号分隔的分类
    
    # 时间
    start_time = Column(DateTime, nullable=False)
    expire_time = Column(DateTime, nullable=False, index=True)
    
    # 状态
    total_quota = Column(Integer, default=0)        # 总配额
    remaining_quota = Column(Integer, default=0)    # 剩余配额
    is_active = Column(Boolean, default=True)
    
    # 领取链接
    claim_url = Column(String(512), default="")
    claim_method = Column(String(32), default="redirect")  # redirect / auto / manual
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow,
                       onupdate=datetime.datetime.utcnow)

    # Relationships
    user_coupons = relationship("UserCoupon", back_populates="coupon")


class UserCoupon(Base):
    """用户已领取的优惠券"""
    __tablename__ = "user_coupons"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    coupon_id = Column(Integer, nullable=False, index=True)
    
    claim_status = Column(String(32), default="pending")  # pending / claimed / expired
    claim_time = Column(DateTime, nullable=True)
    used = Column(Boolean, default=False)
    use_time = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="user_coupons")
    coupon = relationship("Coupon", back_populates="user_coupons")
```

```python
# order.py
import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, JSON
from sqlalchemy.orm import relationship

from app.database import Base


class OrderHistory(Base):
    """订单历史（用于行为分析和推荐）"""
    __tablename__ = "order_histories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    
    shop_id = Column(Integer, nullable=False, default=0)
    shop_name = Column(String(256), default="")
    platform = Column(String(32), nullable=False)
    
    order_amount = Column(Float, default=0.0)        # 原价
    actual_amount = Column(Float, default=0.0)       # 实际支付
    savings = Column(Float, default=0.0)             # 节省金额
    
    items = Column(Text, default="[]")                # JSON: 商品列表
    coupons_used = Column(Text, default="[]")         # JSON: 使用的优惠券
    
    # 评分反馈
    user_rating = Column(Integer, default=0)          # 1-5
    feedback = Column(Text, default="")
    
    order_time = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationship
    user = relationship("User", back_populates="order_histories")
```

**Step 3: Commit**

```bash
git add backend/app/models/price.py backend/app/models/coupon.py backend/app/models/order.py
git commit -m "feat: add Price, Coupon, Order models with relationships"
```

---

### Task 1.4: 平台活动与推荐模型

**Files:**
- Create: `backend/app/models/platform.py`
- Create: `backend/app/models/recommend.py`

```python
# platform.py
import datetime
from sqlalchemy import (
    Column, Integer, String, DateTime, Boolean, Float, JSON
)
from app.database import Base


class PlatformActivity(Base):
    """平台常规活动"""
    __tablename__ = "platform_activities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    platform = Column(String(32), nullable=False, index=True)
    title = Column(String(256), nullable=False)
    description = Column(String(1024), default="")
    icon = Column(String(8), default="")
    activity_url = Column(String(512), default="")
    extra_data = Column(JSON, default=dict)

    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False, index=True)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class FlashSale(Base):
    """限时秒杀/特惠"""
    __tablename__ = "flash_sales"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(256), nullable=False)
    description = Column(String(1024), default="")
    discount = Column(Float, default=0.0)           # 折扣率
    
    platforms = Column(JSON, default=list)          # ["meituan", "eleme"]
    applicable_shops = Column(String, default="")   # 参与店铺
    
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False, index=True)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
```

```python
# recommend.py
import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, JSON
from app.database import Base


class UserBehavior(Base):
    """用户行为日志（用于推荐算法）"""
    __tablename__ = "user_behaviors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    
    # 行为类型: view / click / order / search / favorite
    behavior_type = Column(String(32), nullable=False, index=True)
    
    # 行为对象
    target_type = Column(String(32), default="shop")  # shop / product
    target_id = Column(Integer, nullable=False, default=0)
    target_name = Column(String(256), default="")
    
    # 上下文信息
    context = Column(JSON, default=dict)  # {platform, search_query, category}
    
    # 行为权重（根据行为类型不同）
    weight = Column(Float, default=1.0)
    
    behavior_time = Column(
        DateTime, default=datetime.datetime.utcnow, index=True
    )


class RecommendResult(Base):
    """预计算的推荐结果（供首页/推荐页直接使用）"""
    __tablename__ = "recommend_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    
    # 推荐类型: shop / product / coupon
    recommend_type = Column(String(32), nullable=False)
    
    # 推荐结果
    items = Column(JSON, default=list)  # [{id, score, reason}, ...]
    
    # 推荐元数据
    algorithm_version = Column(String(32), default="v1.0")
    
    generated_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
```

**Step 4: Commit**

```bash
git add backend/app/models/platform.py backend/app/models/recommend.py
git commit -m "feat: add PlatformActivity, FlashSale, UserBehavior, RecommendResult models"
```

---

### Task 1.5: Alembic 迁移初始化

**Files:**
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/alembic.ini`

**Step 1: 初始化 Alembic**

```bash
cd backend
alembic init alembic
```

**Step 2: 配置 `alembic/env.py`**

```python
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

from app.config import settings
from app.database import Base

# 导入所有模型确保它们被注册到 Base.metadata
from app.models import (
    user, shop, product, price, coupon, order, platform, recommend
)

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url_sync)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline():
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

**Step 3: 创建初始迁移**

```bash
cd backend
alembic revision --autogenerate -m "initial_schema_all_models"
alembic upgrade head
```

**Step 4: Commit**

```bash
git add backend/alembic/ backend/alembic.ini
git commit -m "feat: add Alembic migration setup with initial schema"
```

---

# ============================================
# Phase 2: 用户认证与偏好系统
# ============================================

> **目标:** 实现 JWT 认证、用户注册登录、偏好管理、历史记录查询。
> **预计耗时:** 2-3 天

---

### Task 2.1: JWT 认证服务

**Files:**
- Create: `backend/app/services/auth_service.py`
- Create: `backend/app/routers/auth.py`
- Create: `backend/app/schemas/auth.py`

**Step 1: `auth_service.py`**

```python
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: int, username: str,
                        expires_delta: timedelta | None = None) -> str:
    expire = datetime.utcnow() + (
        expires_delta or timedelta(
            minutes=settings.jwt_access_token_expire_minutes
        )
    )
    to_encode = {
        "sub": str(user_id),
        "username": username,
        "exp": expire,
    }
    return jwt.encode(
        to_encode, settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_access_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(
            token, settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        return payload
    except JWTError:
        return None
```

**Step 2: `routers/auth.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    RegisterRequest, LoginRequest, TokenResponse, UserInfo
)
from app.services.auth_service import (
    hash_password, verify_password, create_access_token,
    decode_access_token,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_id = int(payload.get("sub", 0))
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(
        select(User).where(User.username == req.username)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="用户名已存在")
    
    user = User(
        username=req.username,
        hashed_password=hash_password(req.password),
        phone=req.phone,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    token = create_access_token(user.id, user.username)
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == req.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    
    token = create_access_token(user.id, user.username)
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
    )


@router.get("/me", response_model=UserInfo)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserInfo(
        id=current_user.id,
        username=current_user.username,
        nickname=current_user.nickname,
        phone=current_user.phone,
        avatar_url=current_user.avatar_url,
    )
```

**Step 3: Commit**

```bash
git add backend/app/services/auth_service.py backend/app/routers/auth.py backend/app/schemas/auth.py
git commit -m "feat: add JWT authentication with register/login/me endpoints"
```

---

### Task 2.2: 用户偏好与历史 API

**Files:**
- Create: `backend/app/routers/user.py`
- Create: `backend/app/services/user_service.py`
- Create: `backend/app/schemas/user.py`

**Step 1: `user_service.py`**

```python
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User, UserPreference
from app.models.order import OrderHistory
from datetime import datetime


async def get_preference(session: AsyncSession, user_id: int) -> UserPreference | None:
    result = await session.execute(
        select(UserPreference).where(UserPreference.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def upsert_preference(
    session: AsyncSession, user_id: int, data: dict
) -> UserPreference:
    pref = await get_preference(session, user_id)
    if pref:
        for k, v in data.items():
            setattr(pref, k, v)
        pref.updated_at = datetime.utcnow()
    else:
        pref = UserPreference(user_id=user_id, **data)
        session.add(pref)
    await session.commit()
    await session.refresh(pref)
    return pref


async def get_order_history(
    session: AsyncSession, user_id: int, limit: int = 50
) -> list[OrderHistory]:
    result = await session.execute(
        select(OrderHistory)
        .where(OrderHistory.user_id == user_id)
        .order_by(OrderHistory.order_time.desc())
        .limit(limit)
    )
    return result.scalars().all()


async def add_order_history(
    session: AsyncSession, user_id: int, data: dict
) -> OrderHistory:
    order = OrderHistory(user_id=user_id, **data)
    session.add(order)
    await session.commit()
    await session.refresh(order)
    return order
```

**Step 2: Commit**

```bash
git add backend/app/routers/user.py backend/app/services/user_service.py backend/app/schemas/user.py
git commit -m "feat: add user preference and order history APIs"
```

---

# ============================================
# Phase 3: 数据采集引擎（核心难点）
# ============================================

> **目标:** 实现多平台数据采集管线，包括网页抓取、价格同步、优惠券聚合。
> **预计耗时:** 5-7 天

---

### Task 3.1: 采集器基类与代理池

**Files:**
- Create: `backend/app/collectors/base_collector.py`
- Create: `backend/app/collectors/proxy_pool.py`
- Create: `backend/config/platforms.yaml`

**Step 1: `base_collector.py`**

```python
import time
import random
import asyncio
import logging
from typing import Optional
from playwright.async_api import async_playwright, Browser, BrowserContext
from app.config import settings

logger = logging.getLogger(__name__)


class BaseCollector:
    platform: str = ""
    base_url: str = ""
    
    def __init__(self):
        self._request_count = 0
        self._window_start = time.time()
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
    
    async def _rate_limit(self):
        """限速控制"""
        now = time.time()
        elapsed = now - self._window_start
        
        if elapsed >= 1.0:
            self._request_count = 0
            self._window_start = now
            return
        
        if self._request_count >= settings.collector_rate_limit:
            delay = 1.0 - elapsed + random.uniform(0.1, 0.5)
            await asyncio.sleep(delay)
            self._request_count = 0
            self._window_start = time.time()
    
    async def _init_browser(self):
        if not self._browser:
            pw = await async_playwright().__aenter__()
            self._browser = await pw.chromium.launch(
                headless=True,
                args=["--disable-blink-features=AutomationControlled"],
            )
            self._context = await self._browser.new_context(
                user_agent=settings.collector_user_agent,
                viewport={"width": 1920, "height": 1080},
            )
            await self._context.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                });
            """)
    
    async def _request_with_retry(self, url: str, headers: dict = None) -> str:
        """带重试和代理切换的请求"""
        last_exception = None
        for attempt in range(settings.collector_max_retries):
            try:
                await self._rate_limit()
                async with httpx.AsyncClient(timeout=30) as client:
                    response = await client.get(url, headers=headers)
                    response.raise_for_status()
                    self._request_count += 1
                    return response.text
            except Exception as e:
                last_exception = e
                logger.warning(
                    "%s attempt %d failed: %s",
                    self.platform, attempt + 1, str(e)
                )
                await asyncio.sleep(2 ** attempt)
        raise last_exception
    
    async def _page_request(self, url: str) -> str:
        """使用 Playwright 渲染页面获取内容（含 JS 渲染）"""
        await self._init_browser()
        page = await self._context.new_page()
        try:
            await page.goto(url, wait_until="domcontentloaded")
            await page.wait_for_timeout(2000)
            content = await page.content()
            return content
        finally:
            await page.close()
    
    async def close(self):
        if self._browser:
            await self._browser.close()
            self._browser = None
            self._context = None
    
    async def collect_shops(self, location: dict) -> list[dict]:
        """采集店铺列表 - 子类实现"""
        raise NotImplementedError
    
    async def collect_products(self, shop_id: str) -> list[dict]:
        """采集商品列表 - 子类实现"""
        raise NotImplementedError
    
    async def collect_price(self, product_id: str) -> dict:
        """采集单个商品价格 - 子类实现"""
        raise NotImplementedError
    
    async def collect_coupons(self) -> list[dict]:
        """采集优惠券 - 子类实现"""
        raise NotImplementedError
```

**Step 2: `proxy_pool.py`**

```python
import asyncio
import random
import redis.asyncio as aioredis
from typing import Optional
from app.config import settings


class ProxyPool:
    def __init__(self):
        self._redis: Optional[aioredis.Redis] = None
    
    async def init(self):
        self._redis = await aioredis.from_url(
            settings.redis_url, decode_responses=True
        )
    
    async def get_proxy(self) -> Optional[str]:
        if not settings.collector_proxy_enabled:
            return None
        proxies = await self._redis.smembers("proxy_pool:available")
        if not proxies:
            return None
        return random.choice(list(proxies))
    
    async def mark_bad(self, proxy: str):
        if self._redis:
            await self._redis.srem("proxy_pool:available", proxy)
            await self._redis.sadd("proxy_pool:bad", proxy)
    
    async def mark_good(self, proxy: str):
        if self._redis:
            await self._redis.sadd("proxy_pool:available", proxy)
    
    async def add_proxy(self, proxy: str):
        if self._redis:
            await self._redis.sadd("proxy_pool:available", proxy)
```

**Step 3: `backend/config/platforms.yaml`**

```yaml
collectors:
  meituan:
    platform_name: "美团"
    base_url: "https://i.meituan.com"
    api_prefix: "/catering"
    headers:
      Referer: "https://i.meituan.com/"
    shop_list_endpoint: "/meishi/api/poi/search"
    menu_endpoint: "/catering/dish/detail"
  
  eleme:
    platform_name: "饿了么"
    base_url: "https://h5.ele.me"
    api_prefix: "/restapi"
    headers:
      Referer: "https://h5.ele.me/"
    shop_list_endpoint: "/shopping/v2/restaurants"
    menu_endpoint: "/shopping/v2/menu"
  
  jd_waimai:
    platform_name: "京东外卖"
    base_url: "https://waimai.jd.com"
    headers:
      Referer: "https://waimai.jd.com/"
  
  douyin_waimai:
    platform_name: "抖音外卖"
    base_url: "https://www.douyin.com"
    headers:
      Referer: "https://www.douyin.com/"
```

**Step 4: Commit**

```bash
git add backend/app/collectors/base_collector.py backend/app/collectors/proxy_pool.py backend/config/platforms.yaml
git commit -m "feat: add base collector class with rate limiting and proxy pool"
```

---

### Task 3.2: 美团数据采集器

**Files:**
- Create: `backend/app/collectors/meituan_collector.py`

```python
import json
import logging
from bs4 import BeautifulSoup
from .base_collector import BaseCollector

logger = logging.getLogger(__name__)


class MeituanCollector(BaseCollector):
    platform = "meituan"
    base_url = "https://i.meituan.com"
    
    # --- 技术说明 ---
    # 美团 API 需要设备指纹和动态 Token。
    # 当前方案的采集策略（按可行性优先级）：
    # 
    # 策略 A（推荐先用）：用户手动提交店铺链接
    #   - 用户在外卖 App 中复制店铺分享链接
    #   - 后端通过 Playwright 打开 H5 链接抓取菜单
    #   - 优点：用户体验可行，反爬较弱
    #   - 缺点：需用户手动操作
    #
    # 策略 B：定时扫描已知店铺
    #   - 维护一个已知店铺列表
    #   - 定时通过 Playwright 模拟浏览器访问
    #   - 优点：全自动
    #   - 缺点：需维护 IP 池，风控风险
    #
    # 策略 C（最理想）：逆向 App API
    #   - 抓包获取真实 API 接口
    #   - 优点：数据最全
    #   - 缺点：逆向成本高，接口变动频繁
    
    async def collect_shop_menu(self, shop_url: str) -> dict:
        """通过用户提交的店铺链接采集菜单"""
        try:
            html = await self._page_request(shop_url)
            soup = BeautifulSoup(html, "html.parser")
            
            shop_info = self._parse_shop_info(soup)
            products = self._parse_products(soup)
            delivery_info = self._parse_delivery(soup)
            
            return {
                "platform": "meituan",
                "shop": shop_info,
                "products": products,
                "delivery": delivery_info,
                "collected_at": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logger.error("Meituan collection failed: %s", e)
            return self._make_manual_entry_prompt()
    
    def _parse_shop_info(self, soup: BeautifulSoup) -> dict:
        """解析店铺基本信息"""
        info = {}
        
        name_el = soup.select_one('[data-name], .shop-name, h1')
        if name_el:
            info["name"] = name_el.text.strip()
        
        rating_el = soup.select_one('[data-rating], .rating, .star')
        if rating_el:
            try:
                info["rating"] = float(
                    rating_el.text.strip().replace("分", "")
                )
            except ValueError:
                info["rating"] = 0.0
        
        return info
    
    def _parse_products(self, soup: BeautifulSoup) -> list[dict]:
        """解析商品列表"""
        products = []
        items = soup.select('[data-item], .dish-item, .menu-item')
        
        for item in items[:50]:
            name_el = item.select_one('.dish-name, .name')
            price_el = item.select_one('.price, .dish-price')
            img_el = item.select_one('img')
            
            if name_el and price_el:
                price_text = price_el.text.strip().replace("¥", "")
                try:
                    price = float(price_text)
                except ValueError:
                    price = 0.0
                
                products.append({
                    "name": name_el.text.strip(),
                    "price": price,
                    "image_url": img_el.get("src", "") if img_el else "",
                })
        
        return products
    
    def _parse_delivery(self, soup: BeautifulSoup) -> dict:
        """解析配送信息"""
        fee_el = soup.select_one('[data-delivery], .delivery-fee')
        time_el = soup.select_one('[data-delivery-time], .delivery-time')
        min_el = soup.select_one('[data-min-order], .min-order')
        
        delivery = {"fee": 0.0, "time_min": 25, "time_max": 40, "min_order": 0.0}
        
        if fee_el:
            try:
                delivery["fee"] = float(
                    fee_el.text.strip().replace("¥", "")
                )
            except ValueError:
                pass
        
        return delivery
    
    def _make_manual_entry_prompt(self) -> dict:
        """当自动采集失败时，返回手动录入提示"""
        return {
            "platform": "meituan",
            "manual_entry_required": True,
            "message": "自动采集失败，请手动复制店铺链接或截图上传",
            "support_methods": ["link_submit", "screenshot_ocr"],
        }
```

**Step 2: 创建饿了么采集器 `backend/app/collectors/eleme_collector.py`**

```python
import logging
from .base_collector import BaseCollector

logger = logging.getLogger(__name__)


class ElemeCollector(BaseCollector):
    platform = "eleme"
    base_url = "https://h5.ele.me"
    
    async def collect_shop_menu(self, shop_url: str) -> dict:
        """通过店铺链接采集饿了么菜单
        
        技术说明：饿了么 H5 页面也要求登录态，
        与美团类似，优先使用用户手动提交链接的方案。
        """
        try:
            html = await self._page_request(shop_url)
            products = self._parse_products_from_html(html)
            return {
                "platform": "eleme",
                "products": products,
                "collected_at": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logger.error("Eleme collection failed: %s", e)
            return {
                "platform": "eleme",
                "manual_entry_required": True,
                "message": "采集失败，请手动提交或使用截图 OCR",
            }
    
    def _parse_products_from_html(self, html: str) -> list[dict]:
        soup = BeautifulSoup(html, "html.parser")
        products = []
        for item in soup.select('.menu-item, [class*="food"]'):
            name_el = item.select_one('.name')
            price_el = item.select_one('.price')
            if name_el and price_el:
                products.append({
                    "name": name_el.text.strip(),
                    "price": float(price_el.text.strip().replace("¥", "")),
                })
        return products[:50]
```

**Step 3: Commit**

```bash
git add backend/app/collectors/meituan_collector.py backend/app/collectors/eleme_collector.py
git commit -m "feat: add Meituan and Eleme data collectors with fallback OCR support"
```

---

### Task 3.3: 京东外卖与抖音外卖采集器

**Files:**
- Create: `backend/app/collectors/jd_collector.py`
- Create: `backend/app/collectors/douyin_collector.py`

**说明:** 京东外卖和抖音外卖属于新兴平台，API 变动最为频繁。当前阶段先实现基础框架，优先使用 H5 网页端抓取，预留 App API 逆向接口。

**Step 1: Commit**

```bash
git add backend/app/collectors/jd_collector.py backend/app/collectors/douyin_collector.py
git commit -m "feat: add JD and Douyin platform collector stubs"
```

---

### Task 3.4: Celery 定时任务配置

**Files:**
- Create: `backend/app/celery_app.py`
- Create: `backend/app/tasks/price_sync.py`
- Create: `backend/app/tasks/coupon_sync.py`
- Create: `backend/app/tasks/recommend_rebuild.py`

**Step 1: `celery_app.py`**

```python
from celery import Celery
from celery.schedules import crontab
from app.config import settings

celery_app = Celery(
    "foodie_comparison",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.tasks.price_sync",
        "app.tasks.coupon_sync",
        "app.tasks.platform_sync",
        "app.tasks.recommend_rebuild",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=True,
    beat_schedule={
        "sync-prices": {
            "task": "app.tasks.price_sync.sync_all_prices",
            "schedule": crontab(minute="*/120"),  # 每2小时
        },
        "sync-coupons": {
            "task": "app.tasks.coupon_sync.sync_all_coupons",
            "schedule": crontab(minute="0", hour="*/1"),  # 每1小时
        },
        "rebuild-recommend": {
            "task": "app.tasks.recommend_rebuild.rebuild_recommendations",
            "schedule": crontab(hour="2", minute="0"),  # 每天凌晨2点
        },
    },
)
```

**Step 2: `tasks/price_sync.py`**

```python
from app.celery_app import celery_app
from app.database import SyncSessionLocal
from app.collectors.meituan_collector import MeituanCollector
from app.collectors.eleme_collector import ElemeCollector
from app.models.product import Product, CrossPlatformProduct
import logging

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.price_sync.sync_all_prices")
def sync_all_prices():
    """定时同步所有已知商品在各平台的价格"""
    db = SyncSessionLocal()
    try:
        products = db.query(Product).filter(
            Product.is_available == True
        ).all()
        
        collectors = {
            "meituan": MeituanCollector(),
            "eleme": ElemeCollector(),
        }
        
        for product in products:
            cross_links = db.query(CrossPlatformProduct).filter(
                CrossPlatformProduct.product_id == product.id
            ).all()
            
            for link in cross_links:
                collector = collectors.get(link.platform)
                if not collector:
                    continue
                try:
                    price_data = collector.collect_price(
                        link.platform_product_id
                    )
                    # 存储价格快照
                    snapshot = PriceSnapshot(
                        product_id=product.id,
                        platform=link.platform,
                        base_price=price_data.get("price", 0),
                        delivery_fee=price_data.get("delivery_fee", 0),
                        final_price=price_data.get("final_price", 0),
                    )
                    db.add(snapshot)
                except Exception as e:
                    logger.error(
                        "Price sync failed for product %d on %s: %s",
                        product.id, link.platform, str(e)
                    )
        
        db.commit()
        logger.info("Price sync completed for %d products", len(products))
    finally:
        db.close()
```

**Step 3: Commit**

```bash
git add backend/app/celery_app.py backend/app/tasks/price_sync.py \
  backend/app/tasks/coupon_sync.py backend/app/tasks/recommend_rebuild.py
git commit -m "feat: add Celery app with scheduled price/coupon/recommend tasks"
```

---

# ============================================
# Phase 4: OCR 截图识别服务
# ============================================

> **目标:** 当自动采集失效时，用户可上传外卖截图，通过 OCR 提取价格信息。
> **预计耗时:** 3-4 天

---

### Task 4.1: PaddleOCR 封装服务

**Files:**
- Create: `backend/app/services/ocr_service.py`
- Create: `backend/app/routers/ocr.py`

**Step 1: `ocr_service.py`**

```python
import logging
import re
from typing import Optional
from PIL import Image

logger = logging.getLogger(__name__)

# 条件导入：OCR 是可选模块
try:
    from paddleocr import PaddleOCR
    _ocr = PaddleOCR(lang="ch", use_angle_cls=True, show_log=False)
    OCR_AVAILABLE = True
except Exception:
    _ocr = None
    OCR_AVAILABLE = False


class OCRService:
    """外卖截图 OCR 识别服务"""
    
    def __init__(self):
        self.available = OCR_AVAILABLE
    
    def extract_prices_from_image(
        self, image_path: str, platform: str = "unknown"
    ) -> dict:
        """
        从外卖截图提取价格信息
        
        Args:
            image_path: 截图文件路径
            platform: 外卖平台标识
            
        Returns:
            {
                "shop_name": str,
                "products": [{"name": str, "price": float}, ...],
                "delivery_fee": float,
                "total_amount": float,
                "coupons": [{"title": str, "value": float}, ...],
            }
        """
        if not self.available:
            return self._fallback_extract(image_path)
        
        result = _ocr.ocr(image_path, cls=True)
        
        lines = []
        for group in result:
            for line in group:
                text = line[1][0]
                confidence = line[1][1]
                if confidence >= 0.85:
                    lines.append({
                        "text": text,
                        "position": line[0],
                        "confidence": confidence,
                    })
        
        return self._parse_ocr_lines(lines, platform)
    
    def _parse_ocr_lines(self, lines: list[dict], platform: str) -> dict:
        """将 OCR 结果解析为结构化数据"""
        shop_name = ""
        products = []
        delivery_fee = 0.0
        total_amount = 0.0
        
        # 遍历 OCR 结果进行模式匹配
        for line in lines:
            text = line["text"]
            
            # 检测店铺名（第一行或包含"店"的行）
            if not shop_name and (
                "店" in text or "餐厅" in text or "小吃" in text
            ):
                shop_name = text
                continue
            
            # 检测商品 + 价格
            price_match = re.search(
                r'(.+?)\s*[\s¥￥]\s*(\d+\.?\d*)', text
            )
            if price_match:
                products.append({
                    "name": price_match.group(1).strip(),
                    "price": float(price_match.group(2)),
                })
                continue
            
            # 检测配送费
            if "配送" in text or "配送费" in text:
                fee_match = re.search(r'(\d+\.?\d*)', text)
                if fee_match:
                    delivery_fee = float(fee_match.group(1))
                continue
            
            # 检测总价
            if "合计" in text or "总计" in text or "实付" in text:
                total_match = re.search(r'(\d+\.?\d*)', text)
                if total_match:
                    total_amount = float(total_match.group(1))
                continue
        
        return {
            "shop_name": shop_name,
            "products": products[:50],
            "delivery_fee": delivery_fee,
            "total_amount": total_amount,
            "platform": platform,
        }
    
    def _fallback_extract(self, image_path: str) -> dict:
        """OCR 不可用时的降级方案：返回提示让用户手动输入"""
        return {
            "shop_name": "",
            "products": [],
            "delivery_fee": 0.0,
            "total_amount": 0.0,
            "ocr_enabled": False,
            "message": "OCR 服务未安装，请手动输入价格信息",
        }
```

**Step 2: `routers/ocr.py`**

```python
from fastapi import APIRouter, UploadFile, File, Depends
from app.services.ocr_service import OCRService
from app.routers.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/ocr", tags=["ocr"])


@router.post("/extract")
async def extract_prices(
    file: UploadFile = File(...),
    platform: str = "unknown",
    current_user: User = Depends(get_current_user),
):
    ocr_service = OCRService()
    
    import tempfile, os
    with tempfile.NamedTemporaryFile(
        delete=False, suffix=".png"
    ) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        result = ocr_service.extract_prices_from_image(tmp_path, platform)
        result["filename"] = file.filename
        return result
    finally:
        os.unlink(tmp_path)
```

**Step 3: Commit**

```bash
git add backend/app/services/ocr_service.py backend/app/routers/ocr.py
git commit -m "feat: add PaddleOCR-based screenshot price extraction service"
```

---

# ============================================
# Phase 5: 核心比价逻辑
# ============================================

> **目标:** 实现多平台优惠后总价比对算法，支持满减/红包/会员折扣的综合计算。
> **预计耗时:** 3-4 天

---

### Task 5.1: 比价服务核心算法

**Files:**
- Create: `backend/app/services/compare_service.py`
- Create: `backend/app/routers/compare.py`
- Create: `backend/app/schemas/compare.py`

**Step 1: `compare_service.py`**

```python
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.product import Product, CrossPlatformProduct
from app.models.price import PriceSnapshot
from app.models.coupon import Coupon
from app.models.shop import ShopPlatformLink
from app.redis_client import cache_get, cache_set
import json
import logging

logger = logging.getLogger(__name__)


class CompareService:
    """多平台比价核心服务"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def compare_product(
        self,
        product_name: str,
        platforms: list[str] = None,
        user_coupons: list[dict] = None,
    ) -> list[dict]:
        """
        对同一个商品在不同平台进行价格比较
        
        比较维度：
        1. 基础售价 (base_price)
        2. 打包费 (package_fee)
        3. 配送费 (delivery_fee)
        4. 平台满减 (discount_info - 自动匹配最优组合)
        5. 用户红包 (user_coupons - 手动传入)
        6. 会员折扣 (member_discount)
        
        输出：每个平台的「优惠后总价」及对比
        """
        platforms = platforms or ["meituan", "eleme", "jd_waimai", "douyin_waimai"]
        
        # 1. 查找商品在各平台的最新价格快照
        price_snapshots = await self._get_latest_prices(product_name, platforms)
        
        if not price_snapshots:
            return []
        
        # 2. 对每个平台计算优惠后总价
        results = []
        for snapshot in price_snapshots:
            final_price = self._calculate_final_price(
                snapshot,
                user_coupons,
            )
            results.append({
                "platform": snapshot["platform"],
                "platform_name": self._get_platform_name(snapshot["platform"]),
                "base_price": snapshot["base_price"],
                "package_fee": snapshot.get("package_fee", 0),
                "delivery_fee": snapshot.get("delivery_fee", 0),
                "discounts": snapshot.get("discounts", []),
                "coupon_savings": snapshot.get("coupon_savings", 0),
                "original_total": snapshot["base_price"] + snapshot.get("package_fee", 0) + snapshot.get("delivery_fee", 0),
                "final_price": final_price,
                "savings": snapshot["base_price"] + snapshot.get("package_fee", 0) + snapshot.get("delivery_fee", 0) - final_price,
                "shop_name": snapshot.get("shop_name", ""),
                "delivery_time": snapshot.get("delivery_time", {}),
            })
        
        # 3. 按最终价格排序
        results.sort(key=lambda x: x["final_price"])
        
        # 4. 标注最优惠平台
        if results:
            results[0]["is_best_price"] = True
        
        return results
    
    def _calculate_final_price(
        self, snapshot: dict, user_coupons: list[dict] = None
    ) -> float:
        """
        计算优惠后总价
        
        计算逻辑：
        1. 基础售价 + 打包费 + 配送费 = 原始总价
        2. - 平台满减（自动选择最优规则）
        3. - 用户红包（最高可抵扣金额）
        4. = 优惠后总价
        """
        base_total = (
            snapshot.get("base_price", 0)
            + snapshot.get("package_fee", 0)
            + snapshot.get("delivery_fee", 0)
        )
        
        # 平台满减
        discount = self._calculate_optimal_discount(
            base_total,
            snapshot.get("discount_info", []),
        )
        
        # 用户红包
        coupon_savings = self._calculate_coupon_savings(
            base_total,
            snapshot["platform"],
            user_coupons or [],
        )
        
        final = base_total - discount - coupon_savings
        return max(round(final, 2), 0)  # 不能小于0
    
    def _calculate_optimal_discount(
        self, total: float, discount_info: list[dict]
    ) -> float:
        """自动选择最优满减组合"""
        if not discount_info:
            return 0.0
        
        max_discount = 0.0
        for rule in discount_info:
            threshold = rule.get("threshold", float("inf"))
            discount_value = rule.get("discount", 0)
            if total >= threshold and discount_value > max_discount:
                max_discount = discount_value
        
        return max_discount
    
    def _calculate_coupon_savings(
        self, total: float, platform: str, coupons: list[dict]
    ) -> float:
        """计算用户红包可抵扣金额"""
        savings = 0.0
        for coupon in coupons:
            if coupon.get("platform") != platform:
                continue
            if coupon.get("min_spend", float("inf")) > total:
                continue
            savings += coupon.get("value", 0)
        return min(savings, total)  # 不能超过总价
    
    async def compare_shops(
        self,
        shop_name: str,
        platforms: list[str] = None,
    ) -> list[dict]:
        """比较同一店铺在不同平台的配送费和起送价"""
        platforms = platforms or ["meituan", "eleme", "jd_waimai"]
        
        # 缓存查询
        cache_key = f"compare:shop:{shop_name}"
        cached = await cache_get(cache_key)
        if cached:
            return json.loads(cached)
        
        results = []
        for platform in platforms:
            link = await self._get_shop_platform_link(shop_name, platform)
            if link:
                results.append({
                    "platform": platform,
                    "platform_name": self._get_platform_name(platform),
                    "delivery_fee": link.get("delivery_fee", 0),
                    "min_order": link.get("min_order", 0),
                    "delivery_time_min": link.get("delivery_time_min", 25),
                    "delivery_time_max": link.get("delivery_time_max", 45),
                    "rating": link.get("rating", 0),
                })
        
        results.sort(key=lambda x: x["delivery_fee"])
        
        await cache_set(cache_key, json.dumps(results), ttl=1800)  # 30分钟缓存
        return results
    
    async def get_saving_rank(
        self, platform: str = None, limit: int = 10
    ) -> list[dict]:
        """获取省钱榜单：价差最大的商品排行"""
        # 从缓存获取或计算
        cache_key = f"compare:saving-rank:{platform or 'all'}"
        cached = await cache_get(cache_key)
        if cached:
            return json.loads(cached)
        
        # 实际从数据库查询各平台价格，计算价差
        # 这里返回模拟数据结构
        results = [{
            "rank": i + 1,
            "product_name": f"商品{i+1}",
            "shop_name": f"店铺{i+1}",
            "prices": {
                "meituan": round(20 + i * 5, 2),
                "eleme": round(18 + i * 5, 2),
            },
            "lowest_price": round(18 + i * 5, 2),
            "lowest_platform": "eleme" if i % 2 == 0 else "meituan",
            "savings": round(2 + i * 2, 2),
        } for i in range(min(limit, 10))]
        
        await cache_set(cache_key, json.dumps(results), ttl=3600)
        return results
    
    async def _get_latest_prices(
        self, product_name: str, platforms: list[str],
    ) -> list[dict]:
        """获取商品在各平台的最新价格快照"""
        results = []
        for platform in platforms:
            # 实际查询数据库
            # 这里为演示用返回模拟数据
            results.append({
                "platform": platform,
                "base_price": 20 + len(results) * 2,
                "package_fee": 1.0,
                "delivery_fee": 3.0 + len(results),
                "discount_info": [
                    {"threshold": 30, "discount": 5},
                    {"threshold": 50, "discount": 10},
                ],
                "coupon_savings": 0,
            })
        return results
    
    async def _get_shop_platform_link(
        self, shop_name: str, platform: str,
    ) -> dict | None:
        # 实际查询数据库
        return {
            "delivery_fee": 3.0,
            "min_order": 20.0,
            "delivery_time_min": 25,
            "delivery_time_max": 35,
        }
    
    def _get_platform_name(self, platform: str) -> str:
        mapping = {
            "meituan": "美团",
            "eleme": "饿了么",
            "jd_waimai": "京东外卖",
            "douyin_waimai": "抖音外卖",
        }
        return mapping.get(platform, platform)
```

**Step 2: Commit**

```bash
git add backend/app/services/compare_service.py backend/app/routers/compare.py backend/app/schemas/compare.py
git commit -m "feat: add multi-platform price comparison service with auto discount calculation"
```

---

# ============================================
# Phase 6: 推荐引擎
# ============================================

> **目标:** 实现基于用户行为的智能推荐，包括协同过滤和内容推荐。
> **预计耗时:** 3-4 天

---

### Task 6.1: 推荐引擎实现

**Files:**
- Create: `backend/app/services/recommend_service.py`
- Create: `backend/app/routers/recommend.py`
- Create: `backend/app/schemas/recommend.py`

**Step 1: `recommend_service.py`**

```python
import json
import logging
import numpy as np
from datetime import datetime, timedelta
from collections import Counter
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sklearn.metrics.pairwise import cosine_similarity

from app.models.user import User, UserPreference
from app.models.order import OrderHistory
from app.models.shop import Shop
from app.models.recommend import UserBehavior, RecommendResult
from app.redis_client import cache_get, cache_set

logger = logging.getLogger(__name__)


class RecommendService:
    """
    推荐引擎
    
    算法策略：
    1. 内容推荐（Content-Based）：基于用户偏好菜系/口味推荐相似店铺
    2. 协同过滤（Collaborative）：基于相似用户行为推荐
    3. 价格感知推荐：优先推荐性价比最高的店铺
    4. 时间衰减：近期行为权重更高
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.decay_days = 30
    
    async def recommend_shops(
        self, user_id: int, limit: int = 10,
    ) -> list[dict]:
        """为用户推荐高性价比店铺"""
        
        # 1. 尝试从预计算结果获取
        cache_key = f"recommend:shops:{user_id}"
        cached = await cache_get(cache_key)
        if cached:
            return json.loads(cached)
        
        # 2. 获取用户偏好
        prefs = await self._get_user_preferences(user_id)
        if not prefs:
            return await self._cold_start_recommendations(limit)
        
        # 3. 获取用户历史行为
        behaviors = await self._get_user_behaviors(user_id)
        order_history = await self._get_order_history(user_id)
        
        if len(order_history) < 3:
            return await self._cold_start_recommendations(limit)
        
        # 4. 内容推荐
        content_shops = await self._content_based_recommend(
            prefs, order_history, limit
        )
        
        # 5. 价格优化排序
        price_optimized = await self._price_aware_ranking(content_shops)
        
        # 6. 设置过期时间
        result = price_optimized[:limit]
        await cache_set(cache_key, json.dumps(result), ttl=21600)  # 6小时
        
        return result
    
    async def _get_user_preferences(self, user_id: int) -> dict:
        """获取用户偏好向量"""
        result = await self.db.execute(
            select(UserPreference).where(
                UserPreference.user_id == user_id
            )
        )
        pref = result.scalar_one_or_none()
        if not pref:
            return {}
        
        return {
            "cuisine_weights": pref.cuisine_weights or {},
            "taste_weights": pref.taste_weights or {},
            "avg_order_amount": pref.avg_order_amount or 0,
            "price_sensitivity": pref.price_sensitivity or 0.5,
        }
    
    async def _get_order_history(
        self, user_id: int, days: int = 30,
    ) -> list[dict]:
        """获取用户近期的订单历史"""
        since = datetime.utcnow() - timedelta(days=days)
        result = await self.db.execute(
            select(OrderHistory)
            .where(OrderHistory.user_id == user_id)
            .where(OrderHistory.order_time >= since)
            .order_by(OrderHistory.order_time.desc())
            .limit(100)
        )
        orders = result.scalars().all()
        
        return [
            {
                "shop_name": o.shop_name,
                "platform": o.platform,
                "amount": o.actual_amount,
                "rating": o.user_rating,
                "order_time": o.order_time,
                "weight": self._decay_weight(o.order_time),
            }
            for o in orders
        ]
    
    def _decay_weight(self, event_time: datetime) -> float:
        """时间衰减权重：越近权重越高"""
        days_ago = (datetime.utcnow() - event_time).days
        if days_ago <= 0:
            return 1.0
        return max(0.1, 1.0 - (days_ago / self.decay_days))
    
    async def _content_based_recommend(
        self, prefs: dict, order_history: list[dict], limit: int,
    ) -> list[dict]:
        """基于内容的推荐"""
        
        # 1. 提取用户最喜欢的菜系和店铺特征
        favorite_categories = Counter()
        favorite_shops = Counter()
        
        for order in order_history:
            w = order.get("weight", 0.5)
            favorite_shops[order["shop_name"]] += w
        
        # 2. 从数据库查询相似店铺
        # 实际实现时从数据库查询与历史店铺菜系相似的新店铺
        shops = await self._query_similar_shops(
            list(favorite_shops.keys()), limit * 2
        )
        
        # 3. 根据价格敏感度排序
        price_sensitivity = prefs.get("price_sensitivity", 0.5)
        
        scored_shops = []
        for shop in shops:
            # 综合评分
            score = (
                0.35 * shop.get("relevance_score", 0.5)  # 菜系相关性
                + 0.25 * (shop.get("rating", 4.0) / 5.0)  # 评分
                + 0.20 * self._price_score(
                    shop.get("avg_price", 0),
                    prefs.get("avg_order_amount", 30),
                    price_sensitivity,
                )
                + 0.20 * shop.get("popularity_score", 0.5)  # 热度
            )
            shop["score"] = round(score, 4)
            scored_shops.append(shop)
        
        scored_shops.sort(key=lambda x: x["score"], reverse=True)
        return scored_shops[:limit]
    
    def _price_score(
        self, avg_price: float, user_avg: float, sensitivity: float,
    ) -> float:
        """价格评分：价格敏感用户偏好低价"""
        if avg_price <= 0:
            return 0.5
        ratio = user_avg / avg_price
        if ratio >= 1.0:
            return 0.8 + 0.2 * min(sensitivity, 1.0)
        else:
            return max(0.1, 1.0 - sensitivity * ratio)
    
    async def _price_aware_ranking(self, shops: list[dict]) -> list[dict]:
        """基于多平台价格信息重新排序推荐"""
        
        for shop in shops:
            # 查询各平台价格，取最低价
            prices = await self._get_shop_prices(shop.get("id", 0))
            if prices:
                shop["lowest_price"] = min(prices.values())
                shop["lowest_platform"] = [
                    p for p, v in prices.items() if v == shop["lowest_price"]
                ][0]
                shop["prices"] = prices
                
                # 给有明确价格优势的店铺加分
                price_savings = prices.get("最贵平台", 0) - shop["lowest_price"]
                if price_savings > 0:
                    shop["score"] += min(0.15, price_savings / 100)
                    shop["savings"] = round(price_savings, 2)
        
        shops.sort(key=lambda x: x.get("score", 0), reverse=True)
        return shops
    
    async def _cold_start_recommendations(
        self, limit: int = 10,
    ) -> list[dict]:
        """冷启动推荐：返回全局热门高性价比店铺"""
        cache_key = "recommend:cold-start"
        cached = await cache_get(cache_key)
        if cached:
            return json.loads(cached)
        
        # 全局热门 + 价格合理
        result = [
            {
                "shop_name": "热门店铺",
                "reason": "全局热门推荐",
                "is_cold_start": True,
                "score": 0.5,
            }
            for _ in range(min(limit, 5))
        ]
        
        await cache_set(cache_key, json.dumps(result), ttl=43200)
        return result
    
    async def _query_similar_shops(
        self, shop_names: list[str], limit: int,
    ) -> list[dict]:
        """查询与用户历史相似的新店铺"""
        # 实际从数据库查询
        result = []
        for i, name in enumerate(shop_names[:limit]):
            result.append({
                "id": 1000 + i,
                "shop_name": f"推荐店铺_{i+1}",
                "category": "热门",
                "relevance_score": 0.8 - i * 0.1,
                "rating": 4.5,
                "avg_price": 20 + i * 5,
                "popularity_score": 0.7,
                "score": 0.5,
            })
        return result
    
    async def _get_shop_prices(self, shop_id: int) -> dict:
        return {
            "meituan": 22.5,
            "eleme": 19.9,
            "jd_waimai": 21.0,
        }
    
    async def _get_user_behaviors(
        self, user_id: int,
    ) -> list[UserBehavior]:
        result = await self.db.execute(
            select(UserBehavior)
            .where(UserBehavior.user_id == user_id)
            .order_by(UserBehavior.behavior_time.desc())
            .limit(200)
        )
        return result.scalars().all()
    
    async def log_behavior(
        self, user_id: int, behavior_type: str,
        target_type: str, target_id: int,
        target_name: str = "", context: dict = None,
    ) -> bool:
        """记录用户行为"""
        if not user_id:
            return False
        
        behavior = UserBehavior(
            user_id=user_id,
            behavior_type=behavior_type,
            target_type=target_type,
            target_id=target_id,
            target_name=target_name,
            context=context or {},
            weight=self._behavior_weight(behavior_type),
        )
        self.db.add(behavior)
        await self.db.commit()
        return True
    
    def _behavior_weight(self, behavior_type: str) -> float:
        """不同行为类型的权重"""
        weights = {
            "order": 10.0,
            "click": 1.0,
            "view": 0.5,
            "search": 2.0,
            "favorite": 5.0,
            "compare": 3.0,
        }
        return weights.get(behavior_type, 1.0)
```

**Step 2: Commit**

```bash
git add backend/app/services/recommend_service.py backend/app/routers/recommend.py backend/app/schemas/recommend.py
git commit -m "feat: add hybrid recommendation engine with content-based and price-aware ranking"
```

---

# ============================================
# Phase 7: 前端完整实现
# ============================================

> **目标:** 完成 Flutter 所有页面和交互，对接后端 API。
> **预计耗时:** 5-7 天

---

### Task 7.1: 路由配置与主题

**Files:**
- Create: `frontend/lib/app.dart`
- Create: `frontend/lib/config/api_config.dart`
- Create: `frontend/lib/config/theme.dart`

**Step 1: `app.dart`**

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'providers/auth_provider.dart';
import 'providers/home_provider.dart';
import 'pages/home_page.dart';
import 'pages/login_page.dart';
import 'pages/search_page.dart';
import 'pages/compare_page.dart';
import 'pages/coupon_center_page.dart';
import 'pages/shop_detail_page.dart';
import 'pages/profile_page.dart';
import 'config/theme.dart';

final GoRouter _router = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(path: '/', builder: (_, __) => const HomePage()),
    GoRoute(path: '/login', builder: (_, __) => const LoginPage()),
    GoRoute(path: '/search', builder: (_, __) => const SearchPage()),
    GoRoute(path: '/compare', builder: (_, __) => const ComparePage()),
    GoRoute(path: '/coupons', builder: (_, __) => const CouponCenterPage()),
    GoRoute(
      path: '/shop/:id',
      builder: (_, state) => ShopDetailPage(
        shopId: int.parse(state.pathParameters['id'] ?? '0'),
      ),
    ),
    GoRoute(path: '/profile', builder: (_, __) => const ProfilePage()),
  ],
);

class FoodieApp extends StatelessWidget {
  const FoodieApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => HomeProvider()),
      ],
      child: MaterialApp.router(
        title: '外卖比价助手',
        theme: AppTheme.lightTheme,
        routerConfig: _router,
      ),
    );
  }
}
```

**Step 2: Commit**

```bash
git add frontend/lib/app.dart frontend/lib/config/
git commit -m "feat: add GoRouter routing and MaterialApp theme configuration"
```

---

### Task 7.2: 搜索与比价结果页

**Files:**
- Create: `frontend/lib/pages/search_page.dart`
- Create: `frontend/lib/pages/compare_page.dart`
- Create: `frontend/lib/providers/compare_provider.dart`

**`compare_page.dart` 核心设计:**

```
┌─────────────────────────────────────────┐
│  ← 返回    「巨无霸套餐」比价结果        │  ← AppBar
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ 🥡 美团                              ││  ← 平台比价卡片
│  │ ─────────────────────────────────── ││     每张卡片显示：
│  │ 基础售价: ¥25.80                    ││     - 平台名称 + 图标
│  │ 打包费:   ¥1.00                     ││     - 各项费用明细
│  │ 配送费:   ¥3.00                     ││     - 满减折扣（自动最优）
│  │ 满减优惠: -¥5.00 (满30减5)          ││     - 红包抵扣
│  │ 红包抵扣: -¥0.00                    ││     - 最终实付价
│  │ ─────────────────────────────────── ││
│  │ 💰 实付: ¥24.80                     ││  ← 突出显示
│  └─────────────────────────────────────┘│
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ 🥢 饿了么   💡最省 ¥2.00           ││  ← 标记最优惠
│  │ 实付: ¥22.80  ✅                    ││
│  └─────────────────────────────────────┘│
│                                         │
│          [直接前往最省平台]               │  ← CTA按钮
└─────────────────────────────────────────┘
```

**Step 2: Commit**

```bash
git add frontend/lib/pages/search_page.dart frontend/lib/pages/compare_page.dart \
  frontend/lib/providers/compare_provider.dart
git commit -m "feat: add search page and multi-platform comparison result page"
```

---

### Task 7.3: 优惠券中心页面

**Files:**
- Create: `frontend/lib/pages/coupon_center_page.dart`
- Create: `frontend/lib/providers/coupon_provider.dart`
- Create: `frontend/lib/services/coupon_service.dart`

**`coupon_center_page.dart` 设计:**

```
┌─────────────────────────────────────────┐
│   🎫 优惠券中心                          │  ← AppBar
│   [全部] [美团] [饿了么] [京东] [抖音]     │  ← TabBar
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────────┐│
│  │  🎫 满100减50        🔥热           ││  ← 优惠券卡片
│  │  美团 · 今日11:00-14:00              ││     - 金额突出
│  │  仅剩 234 张                         ││     - 平台标签
│  │                        [立即领取]    ││     - 有效期倒计时
│  └─────────────────────────────────────┘│     - 领取按钮
│                                         │
│  ┌─────────────────────────────────────┐│
│  │  🎫 新用户专享20元                   ││
│  │  京东外卖 · 剩余1天                  ││
│  │                        [立即领取]    ││
│  └─────────────────────────────────────┘│
│                                         │
│  ┌─────────────────────────────────────┐│
│  │  📊 我的领取历史                     ││
│  │  已领取 5 张 · 已使用 3 张           ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

**Step 3: Commit**

```bash
git add frontend/lib/pages/coupon_center_page.dart \
  frontend/lib/providers/coupon_provider.dart \
  frontend/lib/services/coupon_service.dart
git commit -m "feat: add coupon center page with platform tabs and claim history"
```

---

### Task 7.4: 首页对接后端 API

**Files:**
- Modify: `frontend/lib/pages/home_page.dart` (重构，对接后端数据)
- Create: `frontend/lib/widgets/common/loading_indicator.dart`
- Create: `frontend/lib/widgets/common/error_widget.dart`
- Create: `frontend/lib/widgets/common/empty_state.dart`

**Step 1: 重构首页 (`home_page.dart`)**

主要改动：
1. 使用 `Consumer<HomeProvider>` 监听数据状态
2. 添加下拉刷新 (`RefreshIndicator`)
3. 添加加载骨架屏 (`Shimmer`)
4. 添加错误重试机制
5. 平台切换联动数据刷新

```dart
// 核心数据加载模式
@override
Widget build(BuildContext context) {
  return Consumer<HomeProvider>(
    builder: (context, provider, _) {
      if (provider.isLoading && provider.shops.isEmpty) {
        return const _HomePageSkeleton();
      }
      if (provider.error.isNotEmpty && provider.shops.isEmpty) {
        return _ErrorWithRetry(
          message: provider.error,
          onRetry: () => provider.loadHomeData(),
        );
      }
      return RefreshIndicator(
        onRefresh: () => provider.loadHomeData(),
        child: ListView(/* 现有卡片布局 */),
      );
    },
  );
}
```

**Step 2: Commit**

```bash
git add frontend/lib/pages/home_page.dart frontend/lib/widgets/common/
git commit -m "feat: refactor home page with API integration, loading states, and error handling"
```

---

### Task 7.5: 登录与个人中心

**Files:**
- Modify: `frontend/lib/pages/login_page.dart`
- Modify: `frontend/lib/pages/profile_page.dart`
- Modify: `frontend/lib/pages/settings_page.dart`
- Modify: `frontend/lib/providers/auth_provider.dart`

**Step 1: 登录页核心逻辑**

```dart
class LoginPage extends StatefulWidget { /* ... */ }

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _usernameCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  
  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;
    
    final auth = context.read<AuthProvider>();
    try {
      await auth.login(_usernameCtrl.text, _passwordCtrl.text);
      if (mounted) context.go('/');
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('登录失败: $e')),
      );
    }
  }
}
```

**Step 2: 个人中心核心功能**

- 用户偏好设置（菜系、口味、预算）
- 订单历史列表
- 收藏店铺
- 数据统计（省钱总览）

**Step 3: Commit**

```bash
git add frontend/lib/pages/login_page.dart frontend/lib/pages/profile_page.dart \
  frontend/lib/pages/settings_page.dart frontend/lib/providers/auth_provider.dart
git commit -m "feat: add login page, profile center, and preference settings"
```

---

# ============================================
# Phase 8: 测试与质量保证
# ============================================

> **目标:** 全覆盖测试，确保核心逻辑正确，API 稳定性达标。
> **预计耗时:** 3-4 天

---

### Task 8.1: 后端单元测试

**Files:**
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_compare.py`
- Create: `backend/tests/test_auth.py`
- Create: `backend/tests/test_recommend.py`

**Step 1: `conftest.py` 测试夹具**

```python
import pytest
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.database import Base
from app.models.user import User, UserPreference
from app.models.shop import Shop
from app.models.product import Product
from app.services.auth_service import hash_password

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture
async def db_engine():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture
async def db_session(db_engine):
    async_session = async_sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False,
    )
    async with async_session() as session:
        yield session


@pytest.fixture
async def test_user(db_session):
    user = User(
        username="test_user",
        hashed_password=hash_password("test123"),
        phone="13800138000",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def test_shops(db_session):
    shops = []
    for i in range(5):
        shop = Shop(name=f"测试店铺{i}", category="中餐", rating=4.5)
        db_session.add(shop)
        shops.append(shop)
    await db_session.commit()
    return shops
```

**Step 2: `test_compare.py`**

```python
import pytest
from app.services.compare_service import CompareService

class TestCompareService:
    test_data = [
        {"platform": "meituan", "base_price": 25.0, "delivery_fee": 3.0},
        {"platform": "eleme", "base_price": 23.0, "delivery_fee": 2.0},
        {"platform": "jd_waimai", "base_price": 22.0, "delivery_fee": 5.0},
    ]

    def test_calculate_final_price_no_discount(self):
        """测试无优惠的最终价格计算"""
        service = CompareService(None)
        snapshot = {
            "base_price": 30.0,
            "package_fee": 2.0,
            "delivery_fee": 3.0,
            "discount_info": [],
        }
        result = service._calculate_final_price(snapshot, None)
        assert result == 35.0

    def test_calculate_with_full_reduction(self):
        """测试满减优惠"""
        service = CompareService(None)
        snapshot = {
            "base_price": 55.0,
            "package_fee": 2.0,
            "delivery_fee": 3.0,
            "discount_info": [{"threshold": 50, "discount": 15}],
        }
        result = service._calculate_final_price(snapshot, [])
        assert result == 45.0

    def test_calculate_optimal_discount_multiple_rules(self):
        """测试多条满减规则自动选择最优"""
        service = CompareService(None)
        discount_info = [
            {"threshold": 30, "discount": 5},
            {"threshold": 50, "discount": 15},
            {"threshold": 100, "discount": 40},
        ]
        result = service._calculate_optimal_discount(60, discount_info)
        assert result == 15.0  # 应该选满50减15而非满100减40

    def test_calculate_with_user_coupons(self):
        """测试用户红包叠加"""
        service = CompareService(None)
        snapshot = {
            "base_price": 35.0,
            "package_fee": 1.0,
            "delivery_fee": 4.0,
            "platform": "meituan",
            "discount_info": [{"threshold": 30, "discount": 5}],
        }
        coupons = [
            {"platform": "meituan", "value": 3, "min_spend": 30},
            {"platform": "eleme", "value": 5, "min_spend": 20},  # 不同平台，不应生效
        ]
        result = service._calculate_final_price(snapshot, coupons)
        assert result == 32.0  # 40 - 5 - 3 = 32

    def test_price_cannot_be_negative(self):
        """测试优惠后价格不能为负数"""
        service = CompareService(None)
        snapshot = {
            "base_price": 10.0,
            "package_fee": 0,
            "delivery_fee": 2.0,
            "discount_info": [{"threshold": 10, "discount": 15}],
        }
        result = service._calculate_final_price(snapshot, [])
        assert result == 0.0
```

**Step 3: 运行测试**

```bash
cd backend
pytest tests/ -v --cov=app --cov-report=term-missing
```

**Step 4: Commit**

```bash
git add backend/tests/
git commit -m "test: add unit tests for auth, compare service, and fixtures"
```

---

### Task 8.2: Flutter Widget 测试

**Files:**
- Create: `frontend/test/widget_test.dart`

**Step 1: Widget 测试**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:foodie_comparison/widgets/cards/coupon_card.dart';
import 'package:foodie_comparison/models/index.dart';

void main() {
  testWidgets('CouponCard displays coupons correctly', (tester) async {
    final coupons = [
      Coupon(
        id: '1',
        title: '5元无门槛',
        type: 'direct',
        value: 5,
        minSpend: 0,
        platform: 'meituan',
        expireTime: DateTime.now().add(const Duration(days: 1)),
        isClaimed: false,
      ),
      Coupon(
        id: '2',
        title: '满30减3',
        type: 'full_reduction',
        value: 3,
        minSpend: 30,
        platform: 'eleme',
        expireTime: DateTime.now().add(const Duration(hours: 6)),
        isClaimed: false,
      ),
    ];

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: CouponCard(
            coupons: coupons,
            onSeeMore: () {},
          ),
        ),
      ),
    );

    expect(find.text('🎁 今日红包速递'), findsOneWidget);
    expect(find.text('¥5'), findsOneWidget);
    expect(find.text('无门槛'), findsOneWidget);
    expect(find.text('¥3'), findsOneWidget);
    expect(find.text('满30可用'), findsOneWidget);
    expect(find.text('点击领取更多'), findsOneWidget);
  });
}
```

**Step 2: Commit**

```bash
git add frontend/test/
git commit -m "test: add Flutter widget tests for coupon card"
```

---

### Task 8.3: API 集成测试

**Files:**
- Create: `backend/tests/test_api.py`

**Step 1: 集成测试**

```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        yield client


class TestAuthAPI:
    @pytest.mark.asyncio
    async def test_register_user(self, async_client):
        response = await async_client.post("/api/auth/register", json={
            "username": "new_user",
            "password": "secure123",
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["username"] == "new_user"

    @pytest.mark.asyncio
    async def test_login(self, async_client):
        # 先注册
        await async_client.post("/api/auth/register", json={
            "username": "login_test",
            "password": "pass123",
        })
        # 再登录
        response = await async_client.post("/api/auth/login", json={
            "username": "login_test",
            "password": "pass123",
        })
        assert response.status_code == 200
        assert "access_token" in response.json()


class TestCompareAPI:
    @pytest.mark.asyncio
    async def test_compare_product(self, async_client):
        response = await async_client.get(
            "/api/compare/product?name=巨无霸套餐&platforms=meituan,eleme"
        )
        assert response.status_code == 200
        results = response.json()
        assert len(results) > 0
        for r in results:
            assert "platform" in r
            assert "final_price" in r
            assert "base_price" in r
```

**Step 2: Commit**

```bash
git add backend/tests/test_api.py
git commit -m "test: add API integration tests for auth and compare endpoints"
```

---

# ============================================
# Phase 9: 部署与运维
# ============================================

> **目标:** 实现生产环境部署，包括 CI/CD、监控、日志。
> **预计耗时:** 2-3 天

---

### Task 9.1: 生产环境 Docker Compose

**Files:**
- Create: `docker-compose.prod.yml`
- Create: `backend/Dockerfile.prod`
- Create: `nginx.conf`

**Step 1: 生产环境 `docker-compose.prod.yml`**

```yaml
version: "3.8"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: foodie
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: foodie_prod
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: always

  redis:
    image: redis:7-alpine
    restart: always

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    environment:
      DATABASE_URL: postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@postgres:5432/foodie_prod
      REDIS_URL: redis://redis:6379/0
      APP_ENV: production
      LOG_LEVEL: INFO
    depends_on:
      - postgres
      - redis
    restart: always

  celery_worker:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    command: celery -A app.celery_app worker --loglevel=info
    environment:
      DATABASE_URL: postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@postgres:5432/foodie_prod
      REDIS_URL: redis://redis:6379/0
    depends_on:
      - postgres
      - redis
    restart: always

  celery_beat:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    command: celery -A app.celery_app beat --loglevel=info
    environment:
      DATABASE_URL: postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@postgres:5432/foodie_prod
      REDIS_URL: redis://redis:6379/0
    depends_on:
      - postgres
      - redis
    restart: always

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - backend
    restart: always

volumes:
  pgdata:
```

**Step 2: Commit**

```bash
git add docker-compose.prod.yml backend/Dockerfile.prod nginx.conf
git commit -m "feat: add production Docker Compose and Nginx configuration"
```

---

# ============================================
# 附录 A: 关键技术决策记录 (ADR)
# ============================================

| # | 决策 | 选项 | 选择 | 原因 |
|---|------|------|------|------|
| 1 | 后端框架 | FastAPI vs Django | FastAPI | 异步原生支持、自动 API 文档、轻量 |
| 2 | 数据库 | PostgreSQL vs MySQL vs MongoDB | PostgreSQL | JSON 字段支持、性能优异、生态成熟 |
| 3 | 缓存 | Redis vs Memcached | Redis | 同时用作 Celery broker、丰富数据结构 |
| 4 | 任务队列 | Celery vs RQ vs APScheduler | Celery | 成熟的定时任务支持、Beat 调度器 |
| 5 | 数据采集 | Playwright vs Selenium vs 纯 Requests | Playwright | 现代 API、反检测能力强、JS 渲染支持 |
| 6 | OCR | PaddleOCR vs Tesseract vs EasyOCR | PaddleOCR | 中文识别最优秀（99%+）、表格识别 |
| 7 | 推荐算法 | 协同过滤 vs 内容推荐 vs 深度学习 | 混合 | 冷启动内容推荐 + 成熟期协同过滤 |
| 8 | 前端状态管理 | Provider vs Bloc vs Riverpod | Provider | Flutter 官方推荐、简单够用 |
| 9 | 路由 | go_router vs Navigator 2.0 | go_router | 声明式路由、支持深度链接 |
| 10 | 认证 | JWT vs Session | JWT | 无状态、移动端友好 |

---

# 附录 B: 多平台数据采集策略对比

```
┌──────────┬───────────────┬───────────────┬───────────────┬───────────────┐
│  方案    │   美团        │   饿了么      │   京东外卖    │   抖音外卖    │
├──────────┼───────────────┼───────────────┼───────────────┼───────────────┤
│ 方案 A   │  用户分享链接 │  用户分享链接 │  用户分享链接 │  用户分享链接 │
│ (推荐)   │  → Playwright │  → Playwright │  → Playwright │  → Playwright │
│          │  抓取 H5 页面 │  抓取 H5 页面 │  抓取 H5 页面 │  抓取 H5 页面 │
├──────────┼───────────────┼───────────────┼───────────────┼───────────────┤
│ 方案 B   │  截图 OCR     │  截图 OCR     │  截图 OCR     │  截图 OCR     │
│ (兜底)   │  PaddleOCR    │  PaddleOCR    │  PaddleOCR    │  PaddleOCR    │
├──────────┼───────────────┼───────────────┼───────────────┼───────────────┤
│ 方案 C   │  App API 逆向 │  App API 逆向 │  App API 逆向 │  App API 逆向 │
│ (远期)   │  需高频维护   │  需高频维护   │  需高频维护   │  需高频维护   │
├──────────┼───────────────┼───────────────┼───────────────┼───────────────┤
│ 方案 D   │  手动录入     │  手动录入     │  手动录入     │  手动录入     │
│ (种子)   │  运营维护     │  运营维护     │  运营维护     │  运营维护     │
└──────────┴───────────────┴───────────────┴───────────────┴───────────────┘
```

---

# 附录 C: 风险清单与应对措施

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|----------|
| 平台接口被封/限流 | 数据采集中断 | 高 | 代理IP池 + 降低频率 + OCR兜底 |
| 平台网页结构变更 | 解析失败 | 中 | 解析器自修复 + 降级手动录入 |
| OCR 识别准确率不足 | 价格数据错误 | 中 | 人工校验置信度 <0.85 的结果 |
| 用户量增长导致 LLM 成本上升 | 运营成本增加 | 低 | 推荐算法基于统计，非 LLM |
| 平台法律风险 | 合规问题 | 中 | 仅展示公开价格，不做自动下单 |
| PaddleOCR 安装复杂 | 用户部署困难 | 高 | Docker 内置 OCR 依赖，一键部署 |

---

# 附录 D: 后续迭代方向

1. **AI 智能推荐增强**：接入 LLM，根据用户对话（"今天想吃麻辣的"）推荐
2. **价格预测**：基于历史价格趋势预测明天价格
3. **拼单模式**：支持多人拼单，自动计算最优分账
4. **小程序化**：Flutter 项目编译为微信小程序
5. **语音点餐**：语音输入 → 比价 → 下单
6. **优惠券自动领取**：模拟 App 自动化领取优惠券（高难度、高风险）

---

**Plan complete.** 以上计划覆盖了从环境搭建、数据库设计、后端服务、数据采集、推荐算法、前端实现到测试部署的全部环节。每个 Phase 包含具体的 Task 步骤、代码样例和测试方法。