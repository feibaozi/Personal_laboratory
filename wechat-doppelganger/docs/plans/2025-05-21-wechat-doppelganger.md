# 微信私人数字分身 (WeChat Digital Doppelganger) 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建一个基于 WeChatFerry + LLM 的微信个人数字分身，能够模仿用户语气自动回复消息，支持草稿审核模式防翻车，并生成"摸鱼战报"统计社交精力节省情况。

**Architecture:** 采用 Python 后端（FastAPI）+ React 前端的单体架构。WeChatFerry SDK 负责微信消息的收发 Hook，后端核心服务编排消息路由、LLM 调用、上下文记忆、草稿审核与统计。Telegram Bot 作为独立的控制通道推送草稿供审核。SQLite 存储全部数据。

**Tech Stack:** Python 3.10+, FastAPI, SQLAlchemy, SQLite, WeChatFerry (wcferry), OpenAI/DeepSeek API, Telegram Bot API (python-telegram-bot), React 18, TypeScript, Vite, TailwindCSS

---

## 项目目录结构

```
wechat-doppelganger/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                    # FastAPI 入口，注册路由，启动时初始化各服务
│   │   ├── config.py                  # 配置管理（环境变量 + YAML）
│   │   ├── database.py                # SQLAlchemy engine + session + Base
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── dashboard.py           # 控制面板 API（状态、开关、实时日志）
│   │   │   ├── persona.py             # 人设 CRUD API
│   │   │   ├── conversation.py        # 对话记录查询 API
│   │   │   ├── draft.py               # 草稿审核 API（获取队列、确认/拒绝/修改）
│   │   │   └── stats.py               # 统计数据 API（日报、周报、总统计）
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── wechat_client.py       # WeChatFerry 封装：初始化、收发消息、登录状态
│   │   │   ├── message_router.py      # 消息路由：白名单、关键词、频率控制、分发
│   │   │   ├── llm_engine.py          # LLM 调用封装：支持多 provider，统一接口
│   │   │   ├── persona_manager.py     # 人设管理：加载、切换、按对象匹配
│   │   │   ├── context_memory.py      # 上下文记忆：短期轮次 + 长期摘要 + 关键信息提取
│   │   │   ├── draft_service.py       # 草稿服务：草稿生成、推送 Telegram、审核回调
│   │   │   ├── stats_service.py       # 统计服务：实时采集 + 定时聚合 + 战报生成
│   │   │   ├── safety_filter.py       # 安全过滤：敏感词、风险意图、免责声明去除
│   │   │   └── telegram_bot.py        # Telegram Bot：接收审核指令、推送草稿、发战报
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── conversation.py        # Conversation, Message 模型
│   │   │   ├── persona.py             # PersonaProfile 模型
│   │   │   ├── draft.py               # DraftMessage 模型
│   │   │   └── stats.py               # DailyStats, WeeklyStats 模型
│   │   └── schemas/
│   │       ├── __init__.py
│   │       ├── dashboard.py           # Pydantic schemas for dashboard API
│   │       ├── persona.py             # Pydantic schemas for persona API
│   │       ├── draft.py               # Pydantic schemas for draft API
│   │       └── stats.py               # Pydantic schemas for stats API
│   ├── config/
│   │   ├── personas.yaml              # 人设配置文件
│   │   └── settings.yaml              # 应用配置文件
│   ├── data/
│   │   └── doppelganger.db            # SQLite 数据库（运行时自动创建）
│   ├── requirements.txt
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── main.tsx                   # React 入口
│   │   ├── App.tsx                    # 路由 + 布局
│   │   ├── index.css                  # Tailwind + 全局样式
│   │   ├── api/
│   │   │   ├── client.ts             # Axios 实例 + 拦截器
│   │   │   ├── dashboard.ts          # Dashboard API 封装
│   │   │   ├── persona.ts            # Persona API 封装
│   │   │   ├── draft.ts              # Draft API 封装
│   │   │   └── stats.ts              # Stats API 封装
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AppLayout.tsx      # 整体布局（侧边栏 + 主内容区）
│   │   │   │   └── Sidebar.tsx        # 侧边栏导航
│   │   │   ├── dashboard/
│   │   │   │   ├── StatusCard.tsx     # 分身运行状态卡片
│   │   │   │   ├── QuickToggle.tsx    # 快速开关控制
│   │   │   │   └── LiveFeed.tsx       # 实时消息流
│   │   │   ├── persona/
│   │   │   │   ├── PersonaEditor.tsx  # 人设编辑器（YAML 渲染 + 编辑）
│   │   │   │   ├── PersonaList.tsx    # 人设列表
│   │   │   │   └── PersonaBinding.tsx # 人设绑定（谁用哪个人设）
│   │   │   ├── draft/
│   │   │   │   ├── DraftQueue.tsx     # 草稿审核队列
│   │   │   │   └── DraftCard.tsx      # 单条草稿卡片（预览 + 操作按钮）
│   │   │   ├── stats/
│   │   │   │   ├── DailyReport.tsx    # 每日战报
│   │   │   │   ├── WeeklyReport.tsx   # 每周战报
│   │   │   │   └── StatsCharts.tsx    # 统计图表
│   │   │   └── common/
│   │   │       ├── LoadingSpinner.tsx
│   │   │       └── ErrorBoundary.tsx
│   │   ├── stores/
│   │   │   ├── dashboardStore.ts      # 运行状态 store
│   │   │   ├── personaStore.ts        # 人设 store
│   │   │   ├── draftStore.ts          # 草稿 store
│   │   │   └── statsStore.ts          # 统计 store
│   │   └── types/
│   │       ├── dashboard.ts
│   │       ├── persona.ts
│   │       ├── draft.ts
│   │       └── stats.ts
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── tailwind.config.js
├── .env                                # 环境变量（API keys, tokens）
├── .env.example                        # 环境变量模板
└── .gitignore
```

---

# Phase 0: 环境准备与技术验证

> **目标:** 搭好开发环境，验证 WeChatFerry 能正常收发消息，LLM API 能通，Telegram Bot 能通。
> **预计耗时:** 1-2 天

---

### Task 0.1: 初始化项目基础设施

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

**Step 1: 创建 `backend/requirements.txt`**

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
sqlalchemy==2.0.35
pydantic==2.9.0
pydantic-settings==2.5.0
python-dotenv==1.0.1
wcferry==39.2.0
openai==1.51.0
python-telegram-bot==21.6
httpx==0.27.0
pyyaml==6.0.2
```

**Step 2: 创建 `backend/pyproject.toml`**

```toml
[project]
name = "wechat-doppelganger"
version = "0.1.0"
description = "微信私人数字分身"
requires-python = ">=3.10"
dependencies = []

[tool.setuptools]
packages = ["app"]
```

**Step 3: 创建 `.env.example`**

```
# LLM API
LLM_PROVIDER=deepseek
LLM_API_KEY=sk-your-key-here
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat

# Telegram Bot
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-personal-chat-id

# WeChatFerry
WCF_PORT=10086
WCF_DEBUG=false

# App
DATABASE_URL=sqlite:///data/doppelganger.db
DRAFT_MODE=true
LOG_LEVEL=INFO
```

**Step 4: 创建 `.gitignore`**

```
.env
data/doppelganger.db
__pycache__/
*.pyc
node_modules/
dist/
.vite/
```

**Step 5: Commit**

```bash
git add backend/requirements.txt backend/pyproject.toml .env.example .gitignore
git commit -m "feat: initialize project infrastructure"
```

---

### Task 0.2: 配置管理与环境变量加载

**Files:**
- Create: `backend/app/config.py`

**Step 1: 编写配置管理模块**

```python
import os
from pathlib import Path
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")


class Settings(BaseSettings):
    # LLM
    llm_provider: str = "deepseek"
    llm_api_key: str = ""
    llm_base_url: str = "https://api.deepseek.com"
    llm_model: str = "deepseek-chat"

    # Telegram
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""

    # WeChatFerry
    wcf_port: int = 10086
    wcf_debug: bool = False

    # App
    database_url: str = "sqlite:///data/doppelganger.db"
    draft_mode: bool = True
    log_level: str = "INFO"

    # 频率控制
    min_reply_delay_seconds: float = 2.0
    max_reply_delay_seconds: float = 15.0
    max_replies_per_minute: int = 5

    # 记忆
    short_term_memory_rounds: int = 20
    long_term_summary_threshold: int = 50

    model_config = {"env_prefix": "", "case_sensitive": False}


settings = Settings()
```

**Step 2: Commit**

```bash
git add backend/app/config.py
git commit -m "feat: add configuration management with pydantic-settings"
```

---

### Task 0.3: WeChatFerry 连通性验证

**Files:**
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/wechat_client.py`
- Create: `backend/scripts/test_wechat_ferry.py`

**Step 1: 封装 WeChatFerry 客户端**

```python
import logging
from typing import Optional, Callable
from wcferry import Wcf

from app.config import settings

logger = logging.getLogger(__name__)


class WeChatClient:
    def __init__(self):
        self.wcf: Optional[Wcf] = None
        self._message_callbacks: list[Callable] = []
        self._is_running = False

    def start(self) -> bool:
        try:
            self.wcf = Wcf(port=settings.wcf_port,
                           debug=settings.wcf_debug)
            logger.info("WeChatFerry client initialized on port %d",
                        settings.wcf_port)
            self._is_running = True
            return True
        except Exception as e:
            logger.error("Failed to initialize WeChatFerry: %s", e)
            return False

    def is_logged_in(self) -> bool:
        if not self.wcf:
            return False
        return self.wcf.is_login()

    def get_self_info(self) -> dict:
        if not self.wcf:
            return {}
        user_info = self.wcf.get_user_info()
        return {"wxid": user_info.get("wxid", ""),
                "nickname": user_info.get("name", "")}

    def send_text(self, msg: str, receiver: str, aters: str = "") -> int:
        if not self.wcf:
            return -1
        return self.wcf.send_text(msg, receiver, aters)

    def get_contacts(self) -> list:
        if not self.wcf:
            return []
        return self.wcf.get_contacts()

    def enable_msg_receiving(self):
        if self.wcf:
            self.wcf.enable_receiving_msgs()

    def get_msg(self) -> Optional[dict]:
        if not self.wcf:
            return None
        msg = self.wcf.get_msg()
        if msg and msg.type != 0:
            return {
                "id": msg.id,
                "type": msg.type,
                "sender": msg.sender,
                "roomid": msg.roomid,
                "content": msg.content,
                "is_group": bool(msg.roomid),
                "timestamp": msg.ts,
            }
        return None

    def stop(self):
        if self.wcf:
            self.wcf.disable_receiving_msgs()
        self._is_running = False
        logger.info("WeChatFerry client stopped")
```

**Step 2: 创建连通性测试脚本**

```python
"""测试 WeChatFerry 连接与基础功能。运行前确保微信 3.9.11.25 已登录。"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.wechat_client import WeChatClient


def test_connectivity():
    client = WeChatClient()
    assert client.start(), "无法初始化 WeChatFerry"
    print("[OK] WeChatFerry 初始化成功")

    time.sleep(2)

    if client.is_logged_in():
        info = client.get_self_info()
        print(f"[OK] 微信已登录: {info}")
    else:
        print("[WARN] 微信未登录，请先启动微信 3.9.11.25 并扫码登录")
        return

    contacts = client.get_contacts()
    print(f"[OK] 获取到 {len(contacts)} 个联系人")

    client.enable_msg_receiving()
    print("[INFO] 开始监听消息，请用另一台设备发送测试消息...")
    print("[INFO] 按 Ctrl+C 停止")

    try:
        while True:
            msg = client.get_msg()
            if msg:
                print(f"[MSG] 收到消息: {msg}")
                client.send_text(f"[自动回复] Hello World!", msg["sender"])
                print(f"[REPLY] 已回复")
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\n[INFO] 停止监听")

    client.stop()
    print("[OK] 测试结束")


if __name__ == "__main__":
    test_connectivity()
```

**Step 3: 运行测试**

```bash
cd backend
python scripts/test_wechat_ferry.py
```

预期输出：初始化成功 → 微信已登录 → 获取联系人 → 收到消息 → 自动回复 Hello World

**Step 4: Commit**

```bash
git add backend/app/services/__init__.py backend/app/services/wechat_client.py backend/scripts/test_wechat_ferry.py
git commit -m "feat: add WeChatFerry client wrapper with connectivity test"
```

---

### Task 0.4: LLM API 连通性验证

**Files:**
- Create: `backend/app/services/llm_engine.py`
- Create: `backend/scripts/test_llm.py`

**Step 1: 封装 LLM 调用**

```python
import logging
from openai import OpenAI

from app.config import settings

logger = logging.getLogger(__name__)


class LLMEngine:
    def __init__(self):
        self.client = OpenAI(
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
        )
        self.model = settings.llm_model

    def chat(self, messages: list[dict],
             temperature: float = 0.8,
             max_tokens: int = 500) -> str:
        """发送消息给 LLM 并返回回复文本"""
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            content = response.choices[0].message.content
            logger.debug("LLM response: %s...", content[:100])
            return content
        except Exception as e:
            logger.error("LLM call failed: %s", e)
            raise

    def chat_with_persona(self, system_prompt: str,
                          user_message: str,
                          history: list[dict] = None,
                          temperature: float = 0.8) -> str:
        """带人设的对话"""
        messages = [{"role": "system", "content": system_prompt}]
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": user_message})
        return self.chat(messages, temperature=temperature)
```

**Step 2: 创建 LLM 测试脚本**

```python
"""测试 LLM API 连通性"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.llm_engine import LLMEngine


def test_llm():
    engine = LLMEngine()
    system_prompt = "你是一个说话简短的程序员，喜欢用波浪号~"
    response = engine.chat_with_persona(
        system_prompt=system_prompt,
        user_message="周末有空吗",
    )
    print(f"[LLM] {response}")
    assert len(response) > 0, "LLM 回复为空"
    print("[OK] LLM 测试通过")


if __name__ == "__main__":
    test_llm()
```

**Step 3: 运行测试**

```bash
cd backend
python scripts/test_llm.py
```

预期输出：收到 LLM 回复文字，带有波浪号和程序员语气

**Step 4: Commit**

```bash
git add backend/app/services/llm_engine.py backend/scripts/test_llm.py
git commit -m "feat: add LLM engine with OpenAI-compatible API support"
```

---

### Task 0.5: Telegram Bot 连通性验证

**Files:**
- Create: `backend/app/services/telegram_bot.py`
- Create: `backend/scripts/test_telegram.py`

**Step 1: 封装 Telegram Bot**

```python
import logging
import asyncio
from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler

from app.config import settings

logger = logging.getLogger(__name__)


class TelegramBot:
    def __init__(self):
        self.bot: Bot = None
        self.app: Application = None
        self._callbacks: dict = {}

    async def start(self):
        self.app = Application.builder() \
            .token(settings.telegram_bot_token) \
            .build()
        self.bot = self.app.bot
        await self.app.initialize()
        await self.app.start()
        logger.info("Telegram bot started")
        await self.send_text("🤖 摸鱼分身已上线")

    async def stop(self):
        if self.app:
            await self.app.stop()
        logger.info("Telegram bot stopped")

    async def send_text(self, text: str) -> int:
        if not self.bot:
            return -1
        msg = await self.bot.send_message(
            chat_id=settings.telegram_chat_id,
            text=text,
        )
        return msg.message_id

    async def send_draft(self, sender_name: str, incoming_msg: str,
                         draft_reply: str) -> int:
        """推送草稿审核消息，带确认/拒绝按钮"""
        keyboard = InlineKeyboardMarkup([
            [
                InlineKeyboardButton("✅ 发送",
                                     callback_data=f"draft_approve|{sender_name}"),
                InlineKeyboardButton("❌ 拒绝",
                                     callback_data=f"draft_reject|{sender_name}"),
            ],
        ])
        text = (
            f"📩 **{sender_name}** 发来消息：\n"
            f"```\n{incoming_msg}\n```\n\n"
            f"🤖 **AI 草稿：**\n"
            f"```\n{draft_reply}\n```\n\n"
            f"请选择操作："
        )
        msg = await self.bot.send_message(
            chat_id=settings.telegram_chat_id,
            text=text,
            reply_markup=keyboard,
            parse_mode="Markdown",
        )
        return msg.message_id
```

**Step 2: 创建 Telegram 测试脚本**

```python
"""测试 Telegram Bot 连通性"""
import sys
import asyncio
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.telegram_bot import TelegramBot


async def test_telegram():
    bot = TelegramBot()
    await bot.start()
    msg_id = await bot.send_text("[测试] 摸鱼二号机连通性验证通过 ✅")
    print(f"[OK] Telegram 消息已发送，message_id={msg_id}")
    await bot.stop()


if __name__ == "__main__":
    asyncio.run(test_telegram())
```

**Step 3: 运行测试**

```bash
cd backend
python scripts/test_telegram.py
```

预期：你的 Telegram 收到一条 "摸鱼二号机连通性验证通过" 的消息

**Step 4: Commit**

```bash
git add backend/app/services/telegram_bot.py backend/scripts/test_telegram.py
git commit -m "feat: add Telegram bot for control channel"
```

---

# Phase 1: 最小可用原型 (MVP)

> **目标:** 跑通完整链路：微信收到消息 → LLM 生成回复 → 微信发送回复。仅对自己测试号使用，不接真人。
> **预计耗时:** 2-3 天

---

### Task 1.1: 数据库模型（SQLite + SQLAlchemy）

**Files:**
- Create: `backend/app/database.py`
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/conversation.py`

**Step 1: 创建数据库引擎和会话**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
```

**Step 2: 创建 Conversation 和 Message 模型**

```python
import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    wxid = Column(String(128), unique=True, nullable=False, index=True)
    name = Column(String(256), default="")
    is_group = Column(Boolean, default=False)
    summary = Column(Text, default="")
    persona_override = Column(String(64), nullable=True)
    safety_level = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow,
                       onupdate=datetime.datetime.utcnow)

    messages = relationship("Message", back_populates="conversation",
                            order_by="Message.created_at")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"),
                            nullable=False, index=True)
    role = Column(String(16), nullable=False)
    content = Column(Text, nullable=False)
    is_auto_reply = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")
```

**Step 3: Commit**

```bash
git add backend/app/database.py backend/app/models/__init__.py backend/app/models/conversation.py
git commit -m "feat: add database models for conversations and messages"
```

---

### Task 1.2: FastAPI 应用骨架

**Files:**
- Create: `backend/app/main.py`

**Step 1: 编写 FastAPI 入口**

```python
import logging
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db

logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

app = FastAPI(
    title="WeChat Digital Doppelganger",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    init_db()
    logging.getLogger(__name__).info("Database initialized")


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
```

**Step 2: 启动验证**

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

打开 `http://localhost:8000/health`，应返回 `{"status": "ok"}`

**Step 3: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: add FastAPI application skeleton"
```

---

### Task 1.3: 消息路由器 + 人设管理器（初版）

**Files:**
- Create: `backend/app/services/message_router.py`
- Create: `backend/app/services/persona_manager.py`
- Create: `backend/config/personas.yaml`

**Step 1: 创建默认人设配置**

```yaml
default_profile: programmer

profiles:
  programmer:
    name: "摸鱼分身·码农版"
    display_name: "默认程序员"
    system_prompt: |
      你正在扮演一个后端程序员的数字分身。

      【核心人设】
      - 话不多，但说到技术就兴奋
      - 说话简短，喜欢用波浪号~，偶尔自嘲
      - 常用口头禅："笑死"、"确实"、"绷不住了"
      - 绝对不要说"作为一个人工智能"、"我是一个AI"之类的话
      - 你就是用户本人，不要暴露自己是AI

      【社交策略】
      - 闲聊回复不超过3句话
      - 有人约饭/约玩，先表示感兴趣但不说死
      - 不想回答的问题用"啊这"、"emmm"搪塞

      【当前对话摘要】
      {conversation_summary}

      【最近聊天记录】
      {recent_messages}
    temperature: 0.8
    max_tokens: 300
```

**Step 2: 编写人设管理器**

```python
import yaml
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

PERSONAS_PATH = Path(__file__).resolve().parent.parent.parent / "config" / "personas.yaml"


class PersonaManager:
    def __init__(self):
        self.profiles: dict = {}
        self.default_profile: str = "programmer"
        self._overrides: dict = {}
        self._load()

    def _load(self):
        with open(PERSONAS_PATH, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        self.profiles = data.get("profiles", {})
        self.default_profile = data.get("default_profile", "programmer")
        logger.info("Loaded %d persona profiles", len(self.profiles))

    def get_prompt(self, profile_name: str = None,
                   summary: str = "", history_text: str = "") -> str:
        name = profile_name or self.default_profile
        profile = self.profiles.get(name, self.profiles.get(self.default_profile, {}))
        prompt = profile.get("system_prompt", "")
        return prompt.format(
            conversation_summary=summary or "无",
            recent_messages=history_text or "无",
        )

    def get_temperature(self, profile_name: str = None) -> float:
        name = profile_name or self.default_profile
        return self.profiles.get(name, {}).get("temperature", 0.8)
```

**Step 3: 编写消息路由器**

```python
import random
import time
import logging
import threading
from typing import Optional

from app.services.wechat_client import WeChatClient
from app.services.llm_engine import LLMEngine
from app.services.persona_manager import PersonaManager
from app.config import settings

logger = logging.getLogger(__name__)


class MessageRouter:
    def __init__(self, wechat: WeChatClient, llm: LLMEngine,
                 persona: PersonaManager):
        self.wechat = wechat
        self.llm = llm
        self.persona = persona
        self._whitelist: set[str] = set()
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._reply_count_minute = 0
        self._reply_count_reset_time = time.time()

    def set_whitelist(self, wxids: list[str]):
        self._whitelist = set(wxids)
        logger.info("Whitelist updated: %d entries", len(self._whitelist))

    def start(self):
        self._running = True
        self.wechat.enable_msg_receiving()
        self._thread = threading.Thread(target=self._listen_loop, daemon=True)
        self._thread.start()
        logger.info("Message router started")

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
        logger.info("Message router stopped")

    def _listen_loop(self):
        while self._running:
            msg = self.wechat.get_msg()
            if msg:
                self._handle_message(msg)
            time.sleep(0.5)

    def _handle_message(self, msg: dict):
        sender = msg.get("sender", "")
        if self._whitelist and sender not in self._whitelist:
            return

        content = msg.get("content", "").strip()
        if not content:
            return

        if content.startswith("/off"):
            self._send(msg, "[分身已关闭] 主人回来了~")
            self.stop()
            return

        if content.startswith("/on"):
            self._send(msg, "[分身已上线] 又可以帮你摸鱼了~")
            return

        self._auto_reply(msg, content)

    def _auto_reply(self, msg: dict, content: str):
        if not self._check_rate_limit():
            logger.warning("Rate limit reached, skipping reply")
            return

        prompt = self.persona.get_prompt()
        temperature = self.persona.get_temperature()

        try:
            reply = self.llm.chat_with_persona(
                system_prompt=prompt,
                user_message=content,
                temperature=temperature,
            )
            reply = reply.strip()
            if reply:
                self._send(msg, reply)
        except Exception as e:
            logger.error("LLM reply failed: %s", e)

    def _send(self, msg: dict, text: str):
        delay = random.uniform(
            settings.min_reply_delay_seconds,
            settings.max_reply_delay_seconds,
        )
        time.sleep(delay)
        self.wechat.send_text(text, msg["sender"])
        logger.info("Replied to %s: %s...", msg["sender"], text[:50])

    def _check_rate_limit(self) -> bool:
        now = time.time()
        if now - self._reply_count_reset_time > 60:
            self._reply_count_minute = 0
            self._reply_count_reset_time = now
        if self._reply_count_minute >= settings.max_replies_per_minute:
            return False
        self._reply_count_minute += 1
        return True
```

**Step 4: Commit**

```bash
git add backend/app/services/message_router.py backend/app/services/persona_manager.py backend/config/personas.yaml
git commit -m "feat: add message router, persona manager, and default persona config"
```

---

### Task 1.4: 整合 MVP —— 端到端跑通

**Files:**
- Create: `backend/scripts/run_mvp.py`

**Step 1: 创建 MVP 启动脚本**

```python
"""MVP: 微信消息 → LLM → 微信回复。仅用于测试号！"""
import sys
import time
import signal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.wechat_client import WeChatClient
from app.services.llm_engine import LLMEngine
from app.services.persona_manager import PersonaManager
from app.services.message_router import MessageRouter


def main():
    print("=== 微信数字分身 MVP 启动 ===")

    wechat = WeChatClient()
    if not wechat.start():
        print("[FATAL] WeChatFerry 初始化失败")
        return

    if not wechat.is_logged_in():
        print("[FATAL] 微信未登录，请先登录微信 3.9.11.25")
        return

    info = wechat.get_self_info()
    print(f"[INFO] 已登录: {info}")

    contacts = wechat.get_contacts()
    print(f"[INFO] 联系人数量: {len(contacts)}")

    target = input("请输入要监听的 wxid (回车则监听所有人): ").strip()
    whitelist = [target] if target else []

    llm = LLMEngine()
    persona = PersonaManager()
    router = MessageRouter(wechat, llm, persona)

    if whitelist:
        router.set_whitelist(whitelist)
        print(f"[INFO] 白名单模式，仅监听: {whitelist}")

    router.start()
    print("[INFO] 消息路由已启动，等待消息...")
    print("[INFO] 按 Ctrl+C 停止")

    def shutdown(sig, frame):
        print("\n[INFO] 正在关闭...")
        router.stop()
        wechat.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.pause()


if __name__ == "__main__":
    main()
```

**Step 2: 端到端测试流程**

1. 启动微信 `3.9.11.25` 并登录测试号
2. 运行 `python backend/scripts/run_mvp.py`
3. 输入目标 wxid（或回车监听所有人）
4. 用另一个微信发送 "在干嘛呢~"
5. 观察控制台日志和测试号的自动回复

**Step 3: Commit**

```bash
git add backend/scripts/run_mvp.py
git commit -m "feat: add MVP end-to-end runner script"
```

---

# Phase 2: 人设系统 + 上下文记忆

> **目标:** 实现完整的上下文记忆（短期轮次 + 长期摘要），支持多个人设切换和自动匹配，按对话对象不同使用不同人设。
> **预计耗时:** 3-4 天

---

### Task 2.1: 上下文记忆服务

**Files:**
- Create: `backend/app/services/context_memory.py`

**Step 1: 实现上下文记忆服务**

```python
import logging
from typing import Optional
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.conversation import Conversation, Message
from app.services.llm_engine import LLMEngine
from app.config import settings

logger = logging.getLogger(__name__)


class ContextMemory:
    def __init__(self, llm: LLMEngine, db_session_factory):
        self.llm = llm
        self.db_session_factory = db_session_factory

    def get_or_create_conversation(self, wxid: str, name: str = "",
                                   is_group: bool = False) -> Conversation:
        db: Session = self.db_session_factory()
        try:
            conv = db.query(Conversation).filter_by(wxid=wxid).first()
            if not conv:
                conv = Conversation(wxid=wxid, name=name, is_group=is_group)
                db.add(conv)
                db.commit()
                db.refresh(conv)
            return conv
        finally:
            db.close()

    def add_message(self, wxid: str, role: str, content: str,
                    is_auto_reply: bool = False):
        db: Session = self.db_session_factory()
        try:
            conv = db.query(Conversation).filter_by(wxid=wxid).first()
            if not conv:
                conv = Conversation(wxid=wxid)
                db.add(conv)
                db.commit()
                db.refresh(conv)

            msg = Message(
                conversation_id=conv.id,
                role=role,
                content=content,
                is_auto_reply=is_auto_reply,
            )
            db.add(msg)

            conv.updated_at = datetime.utcnow()
            db.commit()

            self._maybe_generate_summary(db, conv)
        finally:
            db.close()

    def get_recent_messages(self, wxid: str,
                            limit: int = None) -> list[dict]:
        limit = limit or settings.short_term_memory_rounds
        db: Session = self.db_session_factory()
        try:
            conv = db.query(Conversation).filter_by(wxid=wxid).first()
            if not conv:
                return []
            msgs = (db.query(Message)
                    .filter_by(conversation_id=conv.id)
                    .order_by(Message.created_at.desc())
                    .limit(limit * 2)
                    .all())
            msgs.reverse()
            return [
                {"role": m.role, "content": m.content}
                for m in msgs
            ]
        finally:
            db.close()

    def get_summary(self, wxid: str) -> str:
        db: Session = self.db_session_factory()
        try:
            conv = db.query(Conversation).filter_by(wxid=wxid).first()
            return conv.summary if conv else ""
        finally:
            db.close()

    def format_history_text(self, messages: list[dict]) -> str:
        lines = []
        for m in messages:
            role_label = "对方" if m["role"] == "user" else "我"
            lines.append(f"{role_label}: {m['content']}")
        return "\n".join(lines)

    def _maybe_generate_summary(self, db: Session, conv: Conversation):
        msg_count = db.query(Message).filter_by(
            conversation_id=conv.id).count()
        if msg_count % settings.long_term_summary_threshold != 0:
            return

        logger.info("Generating summary for %s (msg count: %d)",
                    conv.wxid, msg_count)
        recent = self.get_recent_messages(conv.wxid,
                                         limit=settings.long_term_summary_threshold)
        history_text = self.format_history_text(recent)

        prompt = (
            f"下面是一段聊天记录。请用一句话概括这段对话的核心内容：\n\n"
            f"{history_text}\n\n"
            f"概括（一句话，不超过30字）："
        )
        try:
            summary = self.llm.chat_with_persona(
                system_prompt="你是一个对话摘要助手，用一句话概括对话。",
                user_message=prompt,
                temperature=0.3,
            )
            conv.summary = summary.strip()
            db.commit()
            logger.info("Summary for %s: %s", conv.wxid, conv.summary)
        except Exception as e:
            logger.error("Summary generation failed: %s", e)
```

**Step 2: Commit**

```bash
git add backend/app/services/context_memory.py
git commit -m "feat: add context memory with short-term history and long-term summary"
```

---

### Task 2.2: 增强人设管理器（多 profile + 绑定）

**Files:**
- Modify: `backend/app/services/persona_manager.py`
- Create: `backend/app/models/persona.py`

**Step 1: 新增 Persona 绑定模型**

```python
import datetime
from sqlalchemy import Column, Integer, String, DateTime

from app.database import Base


class PersonaBinding(Base):
    __tablename__ = "persona_bindings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    wxid = Column(String(128), unique=True, nullable=False, index=True)
    profile_name = Column(String(64), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
```

**Step 2: 增强 PersonaManager**

在现有 `PersonaManager` 基础上新增方法：

```python
def get_profile_for_wxid(self, wxid: str,
                         db_session_factory) -> Optional[str]:
    """根据 wxid 查找绑定的 profile"""
    from app.models.persona import PersonaBinding
    db = db_session_factory()
    try:
        binding = db.query(PersonaBinding).filter_by(wxid=wxid).first()
        return binding.profile_name if binding else None
    finally:
        db.close()

def bind_profile(self, wxid: str, profile_name: str,
                db_session_factory):
    from app.models.persona import PersonaBinding
    db = db_session_factory()
    try:
        binding = db.query(PersonaBinding).filter_by(wxid=wxid).first()
        if binding:
            binding.profile_name = profile_name
        else:
            binding = PersonaBinding(wxid=wxid, profile_name=profile_name)
            db.add(binding)
        db.commit()
    finally:
        db.close()

def unbind_profile(self, wxid: str, db_session_factory):
    from app.models.persona import PersonaBinding
    db = db_session_factory()
    try:
        db.query(PersonaBinding).filter_by(wxid=wxid).delete()
        db.commit()
    finally:
        db.close()

def list_profiles(self) -> list[dict]:
    return [
        {"name": k, "display_name": v.get("display_name", k)}
        for k, v in self.profiles.items()
    ]
```

**Step 3: Commit**

```bash
git add backend/app/models/persona.py backend/app/services/persona_manager.py
git commit -m "feat: add persona binding model and enhanced persona manager"
```

---

### Task 2.3: 重写 MessageRouter，接入记忆系统

**Files:**
- Modify: `backend/app/services/message_router.py`

**Step 1: 改造 `_auto_reply` 方法，接入上下文记忆**

在 `MessageRouter.__init__` 中新增 `context_memory` 参数：

```python
def __init__(self, wechat, llm, persona, context_memory):
    self.wechat = wechat
    self.llm = llm
    self.persona = persona
    self.context = context_memory
    # ... 其他不变
```

改造 `_auto_reply`：

```python
def _auto_reply(self, msg: dict, content: str):
    if not self._check_rate_limit():
        return

    wxid = msg["sender"]
    profile_name = self.persona.get_profile_for_wxid(
        wxid, self.context.db_session_factory)

    history = self.context.get_recent_messages(wxid)
    history_text = self.context.format_history_text(history)
    summary = self.context.get_summary(wxid)

    system_prompt = self.persona.get_prompt(
        profile_name=profile_name,
        summary=summary,
        history_text=history_text,
    )
    temperature = self.persona.get_temperature(profile_name)

    try:
        reply = self.llm.chat_with_persona(
            system_prompt=system_prompt,
            user_message=content,
            history=history,
            temperature=temperature,
        )
        reply = reply.strip()
        if reply:
            self.context.add_message(wxid, "user", content)
            self.context.add_message(wxid, "assistant", reply, is_auto_reply=True)
            self._send(msg, reply)
    except Exception as e:
        logger.error("Auto reply failed for %s: %s", wxid, e)
```

**Step 2: Commit**

```bash
git add backend/app/services/message_router.py
git commit -m "feat: integrate context memory into message router"
```

---

# Phase 3: 草稿审核系统

> **目标:** AI 生成回复后不直接发送，推送到 Telegram 让你审核确认后再发送。支持确认/拒绝/修改三种操作。支持按安全等级自动决定是否需要审核。
> **预计耗时:** 3-4 天

---

### Task 3.1: 草稿数据模型

**Files:**
- Create: `backend/app/models/draft.py`

**Step 1: 创建 DraftMessage 模型**

```python
import datetime
import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, Enum as SAEnum

from app.database import Base


class DraftStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    MODIFIED = "modified"
    EXPIRED = "expired"


class DraftMessage(Base):
    __tablename__ = "draft_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sender_wxid = Column(String(128), nullable=False, index=True)
    sender_name = Column(String(256), default="")
    incoming_message = Column(Text, nullable=False)
    ai_draft = Column(Text, nullable=False)
    final_reply = Column(Text, nullable=True)
    status = Column(SAEnum(DraftStatus), default=DraftStatus.PENDING,
                   nullable=False)
    telegram_message_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
```

**Step 2: Commit**

```bash
git add backend/app/models/draft.py
git commit -m "feat: add DraftMessage model for draft review system"
```

---

### Task 3.2: 草稿服务

**Files:**
- Create: `backend/app/services/draft_service.py`

**Step 1: 实现草稿服务**

```python
import asyncio
import logging
import threading
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.draft import DraftMessage, DraftStatus
from app.services.telegram_bot import TelegramBot
from app.services.wechat_client import WeChatClient

logger = logging.getLogger(__name__)


class DraftService:
    def __init__(self, db_session_factory, telegram: TelegramBot,
                 wechat: WeChatClient):
        self.db_session_factory = db_session_factory
        self.telegram = telegram
        self.wechat = wechat

    def create_draft(self, sender_wxid: str, sender_name: str,
                     incoming_msg: str, ai_draft: str) -> int:
        """创建草稿并推送到 Telegram"""
        db: Session = self.db_session_factory()
        try:
            draft = DraftMessage(
                sender_wxid=sender_wxid,
                sender_name=sender_name,
                incoming_message=incoming_msg,
                ai_draft=ai_draft,
            )
            db.add(draft)
            db.commit()
            db.refresh(draft)

            # 异步推送 Telegram 消息
            threading.Thread(
                target=self._push_to_telegram,
                args=(draft.id, sender_name, incoming_msg, ai_draft),
                daemon=True,
            ).start()

            return draft.id
        finally:
            db.close()

    def _push_to_telegram(self, draft_id: int, sender_name: str,
                          incoming_msg: str, ai_draft: str):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            tg_msg_id = loop.run_until_complete(
                self.telegram.send_draft(
                    sender_name, incoming_msg, ai_draft,
                    draft_id=draft_id,
                )
            )
            self._update_telegram_id(draft_id, tg_msg_id)
        except Exception as e:
            logger.error("Failed to push draft to Telegram: %s", e)
        finally:
            loop.close()

    def _update_telegram_id(self, draft_id: int, tg_msg_id: int):
        db: Session = self.db_session_factory()
        try:
            draft = db.query(DraftMessage).filter_by(id=draft_id).first()
            if draft:
                draft.telegram_message_id = tg_msg_id
                db.commit()
        finally:
            db.close()

    def approve(self, draft_id: int):
        """审核通过，发送消息"""
        db: Session = self.db_session_factory()
        try:
            draft = db.query(DraftMessage).filter_by(id=draft_id).first()
            if not draft or draft.status != DraftStatus.PENDING:
                return False
            draft.status = DraftStatus.APPROVED
            draft.resolved_at = datetime.utcnow()
            db.commit()
            self.wechat.send_text(draft.ai_draft, draft.sender_wxid)
            logger.info("Draft %d approved and sent", draft_id)
            return True
        finally:
            db.close()

    def reject(self, draft_id: int):
        """拒绝草稿"""
        db: Session = self.db_session_factory()
        try:
            draft = db.query(DraftMessage).filter_by(id=draft_id).first()
            if not draft or draft.status != DraftStatus.PENDING:
                return False
            draft.status = DraftStatus.REJECTED
            draft.resolved_at = datetime.utcnow()
            db.commit()
            logger.info("Draft %d rejected", draft_id)
            return True
        finally:
            db.close()

    def modify_and_send(self, draft_id: int, modified_text: str):
        """修改后发送"""
        db: Session = self.db_session_factory()
        try:
            draft = db.query(DraftMessage).filter_by(id=draft_id).first()
            if not draft or draft.status != DraftStatus.PENDING:
                return False
            draft.status = DraftStatus.MODIFIED
            draft.final_reply = modified_text
            draft.resolved_at = datetime.utcnow()
            db.commit()
            self.wechat.send_text(modified_text, draft.sender_wxid)
            logger.info("Draft %d modified and sent", draft_id)
            return True
        finally:
            db.close()

    def get_pending_drafts(self) -> list:
        db: Session = self.db_session_factory()
        try:
            return (db.query(DraftMessage)
                    .filter_by(status=DraftStatus.PENDING)
                    .order_by(DraftMessage.created_at.desc())
                    .all())
        finally:
            db.close()
```

同时需要修改 `TelegramBot.send_draft` 方法，在 callback_data 中携带 draft_id：

```python
async def send_draft(self, sender_name: str, incoming_msg: str,
                     draft_reply: str, draft_id: int) -> int:
    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton(
                "✅ 发送", callback_data=f"draft:approve:{draft_id}"),
            InlineKeyboardButton(
                "❌ 拒绝", callback_data=f"draft:reject:{draft_id}"),
        ],
    ])
    # ... 其余不变
```

**Step 2: Commit**

```bash
git add backend/app/services/draft_service.py backend/app/services/telegram_bot.py
git commit -m "feat: add draft service with Telegram approval workflow"
```

---

### Task 3.3: Telegram 回调处理器

**Files:**
- Modify: `backend/app/services/telegram_bot.py`

**Step 1: 注册 callback query handler**

```python
from telegram.ext import CallbackQueryHandler

async def _handle_callback(self, update, context):
    query = update.callback_query
    await query.answer()
    data = query.data

    if data.startswith("draft:approve:"):
        draft_id = int(data.split(":")[2])
        self._draft_service.approve(draft_id)
        await query.edit_message_text(
            text=query.message.text + "\n\n✅ **已发送**",
            parse_mode="Markdown",
        )
    elif data.startswith("draft:reject:"):
        draft_id = int(data.split(":")[2])
        self._draft_service.reject(draft_id)
        await query.edit_message_text(
            text=query.message.text + "\n\n❌ **已拒绝**",
            parse_mode="Markdown",
        )
```

在 `start()` 方法中注册：

```python
self.app.add_handler(
    CallbackQueryHandler(self._handle_callback))
```

**Step 2: Commit**

```bash
git add backend/app/services/telegram_bot.py
git commit -m "feat: add Telegram callback handlers for draft approval"
```

---

### Task 3.4: 改造 MessageRouter 支持草稿模式

**Files:**
- Modify: `backend/app/services/message_router.py`

**Step 1: 新增 safety_level 判断逻辑**

在 `MessageRouter` 中新增 `draft_service` 和 `safety_filter` 依赖，修改 `_auto_reply`：

```python
def _auto_reply(self, msg: dict, content: str):
    if not self._check_rate_limit():
        return

    wxid = msg["sender"]
    safety_level = self._get_safety_level(wxid)

    # 安全过滤：敏感词/风险意图
    if self.safety_filter.contains_sensitive(content):
        logger.warning("Sensitive content detected from %s, skipping", wxid)
        return

    profile_name = self.persona.get_profile_for_wxid(
        wxid, self.context.db_session_factory)
    history = self.context.get_recent_messages(wxid)
    history_text = self.context.format_history_text(history)
    summary = self.context.get_summary(wxid)

    system_prompt = self.persona.get_prompt(
        profile_name=profile_name,
        summary=summary,
        history_text=history_text,
    )
    temperature = self.persona.get_temperature(profile_name)

    try:
        reply = self.llm.chat_with_persona(
            system_prompt=system_prompt,
            user_message=content,
            history=history,
            temperature=temperature,
        )
        reply = reply.strip()
        if not reply:
            return

        # 安全过滤：去除 AI 自带的免责声明
        reply = self.safety_filter.clean_reply(reply)

        if safety_level <= 1 or self.config.draft_mode_global:
            # 草稿模式：推送到 Telegram 等审核
            self.context.add_message(wxid, "user", content)
            self.draft_service.create_draft(
                sender_wxid=wxid,
                sender_name=self._get_sender_name(wxid),
                incoming_msg=content,
                ai_draft=reply,
            )
        else:
            # 自动模式：直接发送
            self.context.add_message(wxid, "user", content)
            self.context.add_message(wxid, "assistant", reply,
                                    is_auto_reply=True)
            self._send(msg, reply)
    except Exception as e:
        logger.error("Auto reply failed for %s: %s", wxid, e)
```

**Step 2: Commit**

```bash
git add backend/app/services/message_router.py
git commit -m "feat: integrate draft mode into message router"
```

---

# Phase 4: 摸鱼战报

> **目标:** 实时统计数据，每日/每周生成战报推送。在 Web Dashboard 上可视化展示。
> **预计耗时:** 1-2 天

---

### Task 4.1: 统计数据模型与采集服务

**Files:**
- Create: `backend/app/models/stats.py`
- Create: `backend/app/services/stats_service.py`

**Step 1: 创建统计模型**

```python
import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Date, Text

from app.database import Base


class DailyStats(Base):
    __tablename__ = "daily_stats"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, unique=True, nullable=False, index=True)
    messages_received = Column(Integer, default=0)
    messages_auto_replied = Column(Integer, default=0)
    messages_draft_approved = Column(Integer, default=0)
    messages_draft_rejected = Column(Integer, default=0)
    messages_manual = Column(Integer, default=0)
    conversations_touched = Column(Integer, default=0)
    total_chars_generated = Column(Integer, default=0)
    estimated_time_saved_minutes = Column(Float, default=0.0)
    top_contact = Column(String(256), default="")
    top_contact_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class ReplyLog(Base):
    __tablename__ = "reply_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    wxid = Column(String(128), nullable=False, index=True)
    name = Column(String(256), default="")
    char_count = Column(Integer, default=0)
    mode = Column(String(16), default="auto")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
```

**Step 2: 实现统计服务**

```python
import logging
from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session

from app.models.stats import DailyStats, ReplyLog

logger = logging.getLogger(__name__)


class StatsService:
    def __init__(self, db_session_factory):
        self.db_session_factory = db_session_factory

    def log_reply(self, wxid: str, name: str, char_count: int,
                  mode: str = "auto"):
        db: Session = self.db_session_factory()
        try:
            log = ReplyLog(
                wxid=wxid, name=name,
                char_count=char_count, mode=mode,
            )
            db.add(log)
            db.commit()
        finally:
            db.close()

    def generate_daily_report(self,
                              report_date: date = None) -> dict:
        report_date = report_date or date.today()
        db: Session = self.db_session_factory()
        try:
            logs = (db.query(ReplyLog)
                    .filter(ReplyLog.created_at >= report_date)
                    .filter(ReplyLog.created_at < report_date + timedelta(days=1))
                    .all())

            auto_count = sum(1 for l in logs if l.mode == "auto")
            draft_approved = sum(1 for l in logs if l.mode == "approved")
            draft_rejected = sum(1 for l in logs if l.mode == "rejected")
            total_chars = sum(l.char_count for l in logs)

            wxids = set(l.wxid for l in logs)
            contact_counts = {}
            for l in logs:
                contact_counts[l.name or l.wxid] = contact_counts.get(
                    l.name or l.wxid, 0) + 1
            top_contact = max(contact_counts, key=contact_counts.get,
                            default="")
            top_count = contact_counts.get(top_contact, 0)

            # 估算节省时间: 假设打字速度 60字/分钟
            time_saved = total_chars / 60.0

            stats = {
                "date": report_date.isoformat(),
                "messages_auto_replied": auto_count,
                "messages_draft_approved": draft_approved,
                "messages_draft_rejected": draft_rejected,
                "total_replies": len(logs),
                "conversations_touched": len(wxids),
                "total_chars_generated": total_chars,
                "estimated_time_saved_minutes": round(time_saved, 1),
                "top_contact": top_contact,
                "top_contact_count": top_count,
            }

            self._save_daily_stats(db, report_date, stats)
            return stats
        finally:
            db.close()

    def _save_daily_stats(self, db: Session, report_date: date,
                         stats: dict):
        existing = db.query(DailyStats).filter_by(date=report_date).first()
        if existing:
            for k, v in stats.items():
                if hasattr(existing, k):
                    setattr(existing, k, v)
        else:
            db.add(DailyStats(date=report_date, **stats))
        db.commit()

    def get_weekly_stats(self) -> dict:
        today = date.today()
        week_start = today - timedelta(days=today.weekday())
        db: Session = self.db_session_factory()
        try:
            records = (db.query(DailyStats)
                       .filter(DailyStats.date >= week_start)
                       .all())
            total_replies = sum(r.messages_auto_replied +
                               r.messages_draft_approved for r in records)
            total_time = sum(r.estimated_time_saved_minutes for r in records)
            return {
                "week_start": week_start.isoformat(),
                "week_end": today.isoformat(),
                "total_replies": total_replies,
                "total_time_saved_hours": round(total_time / 60, 1),
                "daily": [
                    {"date": r.date.isoformat(),
                     "replies": r.messages_auto_replied + r.messages_draft_approved,
                     "time_saved": r.estimated_time_saved_minutes}
                    for r in records
                ],
            }
        finally:
            db.close()

    def format_report_message(self, stats: dict, persona_name: str) -> str:
        """格式化为战报推送消息（Telegram/Markdown）"""
        emojis = ["🥇", "🥈", "🥉"]
        lines = [
            f"*📊 摸鱼战报 · {stats['date']}*",
            f"━━━━━━━━━━━━━━━━━━━━",
            f"分身名称：{persona_name}",
            f"今日状态：🟢 正常运行",
            f"",
            f"*💬 消息统计*",
            f"  自动回复 {stats['messages_auto_replied']} 条",
            f"  草稿审核通过 {stats['messages_draft_approved']} 条",
            f"  草稿拒绝 {stats['messages_draft_rejected']} 条",
            f"  触及 {stats['conversations_touched']} 个对话",
            f"",
            f"*⏱️ 省时估算*",
            f"  帮你打了 {stats['total_chars_generated']} 个字",
            f"  大约省了 {stats['estimated_time_saved_minutes']} 分钟 🤯",
            f"",
            f"*👤 最活跃联系人*",
            f"  {stats['top_contact']} - {stats['top_contact_count']}条",
        ]
        return "\n".join(lines)
```

**Step 3: Commit**

```bash
git add backend/app/models/stats.py backend/app/services/stats_service.py
git commit -m "feat: add stats models and service for slacking reports"
```

---

### Task 4.2: 战报推送集成

**Files:**
- Create: `backend/scripts/send_daily_report.py`

**Step 1: 创建每日战报推送脚本**

```python
"""每日战报推送（可通过 cron / Windows Task Scheduler 定时触发）"""
import sys
import asyncio
from pathlib import Path
from datetime import date

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings
from app.database import SessionLocal
from app.services.stats_service import StatsService
from app.services.telegram_bot import TelegramBot


async def main():
    stats_service = StatsService(SessionLocal)
    report = stats_service.generate_daily_report(date.today())
    message = stats_service.format_report_message(report,
                                                  "摸鱼二号机")

    bot = TelegramBot()
    await bot.start()
    await bot.send_text(message)
    await bot.stop()
    print(f"[OK] Daily report sent: {report}")


if __name__ == "__main__":
    asyncio.run(main())
```

**Step 2: Commit**

```bash
git add backend/scripts/send_daily_report.py
git commit -m "feat: add daily report sender script"
```

---

# Phase 5: 安全加固与打磨

> **目标:** 降低封号风险，提升回复质量，完善异常处理，增加 Web Dashboard 前端。
> **预计耗时:** 3-5 天

---

### Task 5.1: 安全过滤器

**Files:**
- Create: `backend/app/services/safety_filter.py`

```python
import re
import logging

logger = logging.getLogger(__name__)

SENSITIVE_KEYWORDS = [
    "微信官方", "腾讯客服", "系统检测", "封号", "违规",
    "银行卡号", "转账", "打钱", "汇款",
    "身份证号", "密码",
]

AI_DISCLAIMER_PATTERNS = [
    r"作为一个人工智能[，,].*",
    r"我是.{0,10}A[IiI].*",
    r"这是一个A[IiI]生成.*",
    r"请注意.{0,5}是.{0,10}(人工智能|AI|机器人).*",
]


class SafetyFilter:
    def contains_sensitive(self, text: str) -> bool:
        lowered = text.lower()
        for kw in SENSITIVE_KEYWORDS:
            if kw in lowered:
                logger.warning("Sensitive keyword '%s' found", kw)
                return True
        return False

    def clean_reply(self, text: str) -> str:
        """去除 AI 可能带上的免责声明"""
        for pattern in AI_DISCLAIMER_PATTERNS:
            text = re.sub(pattern, "", text)
        return text.strip()

    def is_risky_intent(self, text: str) -> bool:
        """检测高风险意图：涉及承诺、金钱、隐私等"""
        risky = ["我保证", "我承诺", "我一定", "多少钱",
                 "你住哪", "你电话号码"]
        lowered = text.lower()
        return any(kw in lowered for kw in risky)
```

**Step 1: Commit**

```bash
git add backend/app/services/safety_filter.py
git commit -m "feat: add safety filter for sensitive content and AI disclaimers"
```

---

### Task 5.2: 启动器脚本与环境变量

**Files:**
- Create: `.env` (从 `.env.example` 复制并填入真实值)
- Create: `backend/scripts/start_all.py`

**Step 1: 创建一体化启动脚本**

```python
"""启动所有服务：WeChatFerry + FastAPI + Telegram Bot + Message Router"""
import sys
import asyncio
import threading
import signal
import uvicorn
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal, init_db
from app.services.wechat_client import WeChatClient
from app.services.llm_engine import LLMEngine
from app.services.persona_manager import PersonaManager
from app.services.context_memory import ContextMemory
from app.services.draft_service import DraftService
from app.services.stats_service import StatsService
from app.services.safety_filter import SafetyFilter
from app.services.message_router import MessageRouter
from app.services.telegram_bot import TelegramBot


class App:
    def __init__(self):
        init_db()
        self.wechat = WeChatClient()
        self.llm = LLMEngine()
        self.persona = PersonaManager()
        self.telegram = TelegramBot()
        self.context = ContextMemory(self.llm, SessionLocal)
        self.stats = StatsService(SessionLocal)
        self.safety = SafetyFilter()
        self.draft = DraftService(SessionLocal, self.telegram, self.wechat)
        self.router = MessageRouter(
            self.wechat, self.llm, self.persona,
            self.context, self.draft, self.safety, self.stats,
        )

    def start(self):
        if not self.wechat.start():
            raise RuntimeError("WeChatFerry 初始化失败")
        if not self.wechat.is_logged_in():
            raise RuntimeError("微信未登录")

        asyncio.get_event_loop().run_until_complete(self.telegram.start())
        self.router.start()

        uvicorn.run("app.main:app", host="0.0.0.0", port=8000)


if __name__ == "__main__":
    app = App()
    app.start()
```

**Step 2: Commit**

```bash
git add backend/scripts/start_all.py
git commit -m "feat: add unified startup script"
```

---

### Task 5.3: FastAPI 路由层（Dashboard API）

**Files:**
- Create: `backend/app/routers/dashboard.py`
- Create: `backend/app/routers/persona.py`
- Create: `backend/app/routers/draft.py`
- Create: `backend/app/routers/stats.py`
- Modify: `backend/app/main.py`

**Step 1: Dashboard Router**

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/status")
async def get_status():
    return {
        "wechat_logged_in": True,
        "router_running": True,
        "draft_mode": True,
        "uptime_seconds": 3600,
    }


@router.post("/toggle-draft")
async def toggle_draft(mode: bool):
    return {"draft_mode": mode}


@router.post("/toggle-router")
async def toggle_router(active: bool):
    return {"router_active": active}
```

**Step 2: Persona Router**

```python
from fastapi import APIRouter

router = APIRouter(prefix="/api/persona", tags=["persona"])


@router.get("/profiles")
async def list_profiles():
    return {"profiles": []}


@router.get("/bindings")
async def list_bindings():
    return {"bindings": []}


@router.post("/bind")
async def bind_persona(wxid: str, profile_name: str):
    return {"wxid": wxid, "profile_name": profile_name}
```

**Step 3: Draft Router**

```python
from fastapi import APIRouter

router = APIRouter(prefix="/api/draft", tags=["draft"])


@router.get("/queue")
async def get_draft_queue():
    return {"drafts": []}


@router.post("/{draft_id}/approve")
async def approve_draft(draft_id: int):
    return {"status": "approved"}


@router.post("/{draft_id}/reject")
async def reject_draft(draft_id: int):
    return {"status": "rejected"}


@router.post("/{draft_id}/modify")
async def modify_draft(draft_id: int, modified_text: str):
    return {"status": "modified"}
```

**Step 4: Stats Router**

```python
from fastapi import APIRouter

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/daily")
async def get_daily_stats():
    return {"stats": {}}


@router.get("/weekly")
async def get_weekly_stats():
    return {"stats": {}}
```

**Step 5: 注册路由到 main.py**

```python
from app.routers import dashboard, persona, draft, stats

app.include_router(dashboard.router)
app.include_router(persona.router)
app.include_router(draft.router)
app.include_router(stats.router)
```

**Step 6: Commit**

```bash
git add backend/app/routers/ backend/app/main.py
git commit -m "feat: add FastAPI routers for dashboard, persona, draft, stats"
```

---

### Task 5.4: React 前端 Dashboard 骨架

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/index.html`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/index.css`

**Step 1: 初始化前端项目**

```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install
npm install -D tailwindcss @tailwindcss/vite
npm install axios zustand react-router-dom
```

**Step 2: 编写基础布局**

`frontend/src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { StatusCard } from "./components/dashboard/StatusCard";
import { PersonaEditor } from "./components/persona/PersonaEditor";
import { DraftQueue } from "./components/draft/DraftQueue";
import { DailyReport } from "./components/stats/DailyReport";

function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<StatusCard />} />
          <Route path="/persona" element={<PersonaEditor />} />
          <Route path="/drafts" element={<DraftQueue />} />
          <Route path="/stats" element={<DailyReport />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

export default App;
```

**Step 3: Commit**

```bash
git add frontend/
git commit -m "feat: add React frontend skeleton with TailwindCSS"
```

---

# 附录：各 Phase 文件依赖关系

```
Phase 0: config.py → database.py → wechat_client.py → llm_engine.py → telegram_bot.py
          ↓                    ↓                    ↓
Phase 1: models/       →  main.py  →  message_router.py + persona_manager.py
          ↓
Phase 2: context_memory.py → 增强 message_router.py
          ↓
Phase 3: draft.py (model) → draft_service.py → 增强 telegram_bot.py → 增强 message_router.py
          ↓
Phase 4: stats.py (model) → stats_service.py → send_daily_report.py
          ↓
Phase 5: safety_filter.py → routers/* → 前端 Skeleton → start_all.py
```

# 附录：关键技术决策记录

| 决策 | 选择 | 原因 |
|------|------|------|
| 微信接入 | WeChatFerry | 开源、活跃、本地运行、多语言支持 |
| LLM Provider | DeepSeek | 性价比最高，中文效果好 |
| 数据库 | SQLite | 单机部署，零配置，够用 |
| 控制通道 | Telegram Bot | 独立通道，不依赖微信，防翻车 |
| 后端框架 | FastAPI + asyncio | 异步友好，自动文档，生态强 |
| 前端框架 | React + Vite + Tailwind | 快速开发，与现有 asquant 项目技术栈一致 |
| 部署方式 | Windows 本机常驻 | WeChatFerry 依赖本地微信进程 |