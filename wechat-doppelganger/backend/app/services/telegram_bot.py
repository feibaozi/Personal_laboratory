import asyncio
import logging

from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CallbackQueryHandler
from telegram.request import HTTPXRequest

from app.config import settings

logger = logging.getLogger(__name__)


def _build_request() -> HTTPXRequest | None:
    if settings.telegram_proxy:
        return HTTPXRequest(proxy=settings.telegram_proxy)
    return None


class TelegramBot:
    def __init__(self):
        self.bot: Bot | None = None
        self.app: Application | None = None
        self._draft_service = None
        self._loop = None

    def set_draft_service(self, draft_service):
        self._draft_service = draft_service

    async def start(self):
        self._loop = asyncio.get_running_loop()
        request = _build_request()
        self.app = (Application.builder()
                    .token(settings.telegram_bot_token)
                    .request(request)
                    .build() if request else
                    Application.builder()
                    .token(settings.telegram_bot_token)
                    .build())
        self.app.add_handler(CallbackQueryHandler(self._handle_callback))
        await self.app.initialize()
        await self.app.start()
        await self.app.updater.start_polling()
        self.bot = self.app.bot
        await self.bot.send_message(
            chat_id=settings.telegram_chat_id,
            text="🤖 摸鱼分身已上线",
        )
        logger.info("TelegramBot started")

    async def stop(self):
        if self.app:
            if self.app.updater:
                await self.app.updater.stop()
            await self.app.stop()
            await self.app.shutdown()
        logger.info("TelegramBot stopped")

    async def send_text(self, text: str) -> int:
        msg = await self.bot.send_message(
            chat_id=settings.telegram_chat_id,
            text=text,
        )
        return msg.message_id

    async def send_draft(self, contact_name: str, incoming_msg: str,
                         draft_reply: str, draft_id: int) -> int:
        text = (
            f"📩 *{self._escape(contact_name)}* 发来消息:\n"
            f"> {self._escape(incoming_msg)}\n\n"
            f"💬 草稿回复:\n"
            f"> {self._escape(draft_reply)}"
        )
        keyboard = InlineKeyboardMarkup([
            [
                InlineKeyboardButton("✅ 发送", callback_data=f"draft:approve:{draft_id}"),
                InlineKeyboardButton("❌ 拒绝", callback_data=f"draft:reject:{draft_id}"),
            ]
        ])
        msg = await self.bot.send_message(
            chat_id=settings.telegram_chat_id,
            text=text,
            parse_mode="Markdown",
            reply_markup=keyboard,
        )
        return msg.message_id

    @staticmethod
    def _escape(text: str) -> str:
        for ch in ['_', '[', ']', '`']:
            text = text.replace(ch, '\\' + ch)
        return text

    async def _handle_callback(self, update, context):
        query = update.callback_query
        await query.answer()
        data = query.data
        logger.info("[CALLBACK] received: %s", data)

        if not self._draft_service:
            logger.error("[CALLBACK] draft_service is None!")
            await query.edit_message_text(
                text=query.message.text + "\n\n⚠️ 草稿服务未连接",
                parse_mode="Markdown",
            )
            return

        if data.startswith("draft:approve:"):
            draft_id = int(data.split(":")[2])
            logger.info("[CALLBACK] approving draft %d", draft_id)
            self._draft_service.approve(draft_id)
            logger.info("[CALLBACK] approve returned")
            await query.edit_message_text(
                text=query.message.text + "\n\n✅ *已发送*",
                parse_mode="Markdown",
            )
        elif data.startswith("draft:reject:"):
            draft_id = int(data.split(":")[2])
            logger.info("[CALLBACK] rejecting draft %d", draft_id)
            self._draft_service.reject(draft_id)
            await query.edit_message_text(
                text=query.message.text + "\n\n❌ *已拒绝*",
                parse_mode="Markdown",
            )
