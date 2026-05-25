"""MVP: 截图+OCR 微信消息 → LLM 生成回复 → Telegram 审核 → 微信回复"""
import logging
import sys
import signal
import threading
from pathlib import Path

# Force DEBUG logging + flush so we see everything in real time
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stderr,
)

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal, init_db

# Override print to use stderr (unbuffered on Windows)
_print = print
def print(*args, **kwargs):
    kwargs.setdefault('file', sys.stderr)
    kwargs.setdefault('flush', True)
    _print(*args, **kwargs)

from app.services.wechat_client import WeChatClient
from app.services.llm_engine import LLMEngine
from app.services.persona_manager import PersonaManager
from app.services.context_memory import ContextMemory
from app.services.safety_filter import SafetyFilter
from app.services.draft_service import DraftService
from app.services.message_router import MessageRouter
from app.services.telegram_bot import TelegramBot


async def main():
    print("=== 微信数字分身 MVP 启动 (OCR+键盘模式) ===")
    init_db()
    print("[OK] 数据库初始化完成")

    wechat = WeChatClient()
    if not wechat.start():
        print("[FATAL] 未找到微信窗口，请先打开微信并登录")
        return
    print("[OK] 微信已连接")

    contacts = wechat.get_contacts()
    print(f"[INFO] 白名单联系人: {contacts}")

    llm = LLMEngine()
    print(f"[OK] LLM 引擎就绪 (模型: {llm.model})")

    persona = PersonaManager()
    print(f"[OK] 人设加载完成 ({len(persona.profiles)} 个)")

    context = ContextMemory(llm, SessionLocal)
    safety = SafetyFilter()
    telegram = TelegramBot()
    draft = DraftService(SessionLocal, telegram, wechat)

    telegram.set_draft_service(draft)

    router = MessageRouter(wechat, llm, persona, context, safety)
    router.set_draft_service(draft)

    await telegram.start()
    print("[OK] Telegram Bot 已上线")

    router.start()
    print("[OK] 消息路由已启动")
    print()
    print("分身已就绪，等待消息...")
    print("按 Ctrl+C 停止")

    stop_event = threading.Event()

    def shutdown(sig, frame):
        print("\n[INFO] 正在关闭...")
        router.stop()
        wechat.stop()
        stop_event.set()

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Wait for shutdown
    while not stop_event.is_set():
        stop_event.wait(1)

    await telegram.stop()
    print("[OK] 分身已下线")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
