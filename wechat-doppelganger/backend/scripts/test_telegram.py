import sys
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

import asyncio

from app.services.telegram_bot import TelegramBot


async def main():
    bot = TelegramBot()
    await bot.start()

    message_id = await bot.send_text("[测试] 摸鱼二号机连通性验证通过 ✅")
    print(f"message_id: {message_id}")

    await bot.stop()


if __name__ == "__main__":
    asyncio.run(main())