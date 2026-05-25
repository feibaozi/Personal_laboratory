"""自动获取你的 Telegram Chat ID"""
import sys
import asyncio
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from telegram import Bot
from app.config import settings


async def main():
    bot = Bot(token=settings.telegram_bot_token)
    updates = await bot.get_updates()

    if not updates:
        print("=" * 50)
        print("❌ 没有收到任何消息！")
        print("=" * 50)
        print()
        print("请按以下步骤操作：")
        print(f"  1. 在 Telegram 搜索你的 Bot: @<你的机器人用户名>")
        print(f"  2. 给它发一条消息（比如 'hello'）")
        print(f"  3. 重新运行这个脚本")
        print()
        print("如果 Token 配置正确，Bot 的用户名会在下面显示——")
        print("如果下面显示为空，说明 .env 里的 TELEGRAM_BOT_TOKEN 填错了")
        me = await bot.get_me()
        print(f"  Bot 信息: @{me.username} (ID: {me.id})")
        return

    for update in updates:
        if update.message:
            msg = update.message
            chat = msg.chat
            print(f"✅ 找到消息！")
            print(f"  发送者: {msg.from_user.first_name} (@{msg.from_user.username})")
            print(f"  Chat ID: {chat.id}")
            print(f"  消息内容: {msg.text}")
            print()
            print(f"👉 把这个 Chat ID 填入 .env 的 TELEGRAM_CHAT_ID:")
            print(f"   TELEGRAM_CHAT_ID={chat.id}")
            return


if __name__ == "__main__":
    asyncio.run(main())
