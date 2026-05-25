"""端到端管线测试 —— 逐步执行每个环节，清晰报告成功/失败"""
import sys
import time
import asyncio
import threading
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

def step(n: int, desc: str):
    print(f"\n{'='*60}")
    print(f"  Step {n}: {desc}")
    print(f"{'='*60}")

def ok(msg: str = ""):
    print(f"  ✅ PASS {msg}")

def fail(msg: str = ""):
    print(f"  ❌ FAIL {msg}")

def info(msg: str):
    print(f"  ℹ️  {msg}")

# ═══════════════════════════════════════════════════════════════════
step(1, "配置检查")
# ═══════════════════════════════════════════════════════════════════
from app.config import settings
info(f"LLM model: {settings.llm_model}")
info(f"LLM base_url: {settings.llm_base_url}")
info(f"LLM API key: {'***' + settings.llm_api_key[-4:] if settings.llm_api_key else 'NOT SET'}")
info(f"Telegram token: {'***' + settings.telegram_bot_token[-4:] if settings.telegram_bot_token else 'NOT SET'}")
info(f"Telegram chat_id: {settings.telegram_chat_id}")
info(f"Telegram proxy: {settings.telegram_proxy or 'NOT SET'}")
info(f"Whitelist: {settings.whitelist_path}")
info(f"Polling interval: {settings.polling_interval_seconds}s")
info(f"Draft mode: {settings.draft_mode}")
ok("配置加载完成")

# ═══════════════════════════════════════════════════════════════════
step(2, "数据库初始化")
# ═══════════════════════════════════════════════════════════════════
from app.database import init_db, engine, SessionLocal
from sqlalchemy import inspect
init_db()
tables = inspect(engine).get_table_names()
info(f"数据库表 ({len(tables)}): {tables}")
ok("数据库就绪")

# ═══════════════════════════════════════════════════════════════════
step(3, "查找微信窗口")
# ═══════════════════════════════════════════════════════════════════
from app.services.wechat_client import WeChatClient
wechat = WeChatClient()
if not wechat.start():
    fail("未找到微信窗口")
    info("请确保：微信已打开、已登录、窗口可见(不要最小化)")
    sys.exit(1)
ok(f"微信已连接，白名单联系人: {wechat.get_contacts()}")

# ═══════════════════════════════════════════════════════════════════
step(4, "LLM 引擎连通性")
# ═══════════════════════════════════════════════════════════════════
from app.services.llm_engine import LLMEngine
llm = LLMEngine()
try:
    reply = llm.chat_with_persona(
        system_prompt="你是一个测试助手，只回答 OK",
        user_message="测试",
        temperature=0.3,
    )
    info(f"LLM 回复: {reply[:80]}")
    ok("LLM 引擎正常")
except Exception as e:
    fail(f"LLM 调用失败: {e}")
    sys.exit(1)

# ═══════════════════════════════════════════════════════════════════
step(5, "Telegram Bot 连通性")
# ═══════════════════════════════════════════════════════════════════
from app.services.telegram_bot import TelegramBot
telegram = TelegramBot()

async def test_telegram():
    await telegram.start()
    try:
        mid = await telegram.send_text("🧪 摸鱼分身管线测试")
        info(f"Telegram 消息已发送, message_id={mid}")
        return True
    except Exception as e:
        info(f"Telegram 发送失败: {e}")
        return False
    finally:
        await telegram.stop()

result = asyncio.run(test_telegram())
if result:
    ok("Telegram Bot 正常")
else:
    fail("Telegram Bot 连接失败")
    info("检查代理是否正常: curl -x http://127.0.0.1:7897 https://api.telegram.org")

# ═══════════════════════════════════════════════════════════════════
step(6, "OCR 读取测试（单次）")
# ═══════════════════════════════════════════════════════════════════
contacts = wechat.get_contacts()
if not contacts:
    fail("白名单为空，请在 config/whitelist.txt 中添加联系人")
    sys.exit(1)

target = contacts[0]
info(f"目标联系人: {target}")
info("将打开聊天窗口并 OCR 截图...")

t0 = time.time()
try:
    texts = wechat._read_chat_ocr(target)
    elapsed = time.time() - t0
    info(f"OCR 耗时: {elapsed:.1f}s")
    info(f"识别到 {len(texts)} 段文字:")
    for t in sorted(texts):
        print(f"    - {t}")
    ok("OCR 读取成功")
except Exception as e:
    elapsed = time.time() - t0
    fail(f"OCR 失败 ({elapsed:.1f}s): {e}")

# ═══════════════════════════════════════════════════════════════════
step(7, "消息发送测试")
# ═══════════════════════════════════════════════════════════════════
test_msg = f"[管线测试] {time.strftime('%H:%M:%S')}"
info(f"发送测试消息: {test_msg}")
try:
    result = wechat.send_text(test_msg, target)
    if result == 0:
        ok("消息发送成功 - 请检查微信确认")
    else:
        fail(f"消息发送失败, return code={result}")
except Exception as e:
    fail(f"消息发送异常: {e}")

# ═══════════════════════════════════════════════════════════════════
step(8, "消息轮询+去重测试")
# ═══════════════════════════════════════════════════════════════════
info("第1次轮询 (种子缓存)...")
msgs1 = wechat.poll_new_messages(friend=target)
info(f"检测到 {len(msgs1)} 条新消息")
for m in msgs1:
    print(f"    [{m['sender']}] {m['content'][:60]}")

time.sleep(2)

info("第2次轮询 (应当为0，已在缓存中)...")
msgs2 = wechat.poll_new_messages(friend=target)
info(f"检测到 {len(msgs2)} 条新消息")
if len(msgs2) == 0:
    ok("去重正常 - 第二次轮询无重复消息")
else:
    info(f"检测到 {len(msgs2)} 条消息 (可能是新消息)")

# ═══════════════════════════════════════════════════════════════════
step(9, "完整链路模拟 (收到消息 → LLM → 推送草稿)")
# ═══════════════════════════════════════════════════════════════════
from app.services.persona_manager import PersonaManager
from app.services.context_memory import ContextMemory
from app.services.safety_filter import SafetyFilter
from app.services.draft_service import DraftService

persona = PersonaManager()
context = ContextMemory(llm, SessionLocal)
safety = SafetyFilter()

info("模拟一条来自文件传输助手的消息...")

test_content = "在干嘛呢~"
info(f"模拟消息内容: {test_content}")

# 安全过滤
if safety.contains_sensitive(test_content):
    info("消息包含敏感词，跳过")
else:
    # 获取上下文
    history = context.get_recent_messages(target)
    history_text = context.format_history_text(history)
    summary = context.get_summary(target)
    system_prompt = persona.get_prompt(summary=summary, history_text=history_text)
    temperature = persona.get_temperature()

    info(f"人设温度: {temperature}")
    info(f"最近消息数: {len(history)}")

    # LLM 生成回复
    t0 = time.time()
    try:
        reply = llm.chat_with_persona(
            system_prompt=system_prompt,
            user_message=test_content,
            history=history,
            temperature=temperature,
        )
        reply = reply.strip()
        elapsed = time.time() - t0
        info(f"LLM 生成耗时: {elapsed:.1f}s")
        info(f"AI 草稿: {reply}")

        reply = safety.clean_reply(reply)
        info(f"清洗后: {reply}")

        context.add_message(target, "user", test_content)
        ok("LLM 回复生成成功")

        # 推送到 Telegram
        info("推送草稿到 Telegram...")
        # 先启动 telegram
        async def push_draft():
            await telegram.start()
            draft_service = DraftService(SessionLocal, telegram, wechat)
            telegram.set_draft_service(draft_service)
            draft_id = draft_service.create_draft(
                contact_name=target,
                incoming_msg=test_content,
                ai_draft=reply,
            )
            info(f"草稿已创建, draft_id={draft_id}")
            info("请在 Telegram 中审核这条草稿 (点'发送'或'拒绝')")
            return telegram

        telegram2 = asyncio.run(push_draft())
        ok("草稿已推送到 Telegram - 请检查你的 Telegram")

        # 等待 15 秒让用户审核
        info("等待 15 秒供审核...")
        time.sleep(15)
        ok("完整链路测试通过 — 草稿已推送到 Telegram，请在 Telegram 中审核")
    except Exception as e:
        fail(f"LLM 或推送失败: {e}")
        import traceback
        traceback.print_exc()

# ═══════════════════════════════════════════════════════════════════
step(10, "清理")
# ═══════════════════════════════════════════════════════════════════
wechat.stop()
info("微信客户端已断开")
ok("测试完成")
print(f"\n{'='*60}")
print("  管线测试全部结束")
print(f"{'='*60}")
