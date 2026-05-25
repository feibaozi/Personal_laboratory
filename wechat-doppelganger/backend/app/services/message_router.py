import logging
import random
import threading
import time

from app.config import settings
from app.services.wechat_client import WeChatClient
from app.services.llm_engine import LLMEngine
from app.services.persona_manager import PersonaManager
from app.services.context_memory import ContextMemory
from app.services.safety_filter import SafetyFilter

logger = logging.getLogger(__name__)


class MessageRouter:
    def __init__(self, wechat: WeChatClient, llm: LLMEngine,
                 persona: PersonaManager, context: ContextMemory,
                 safety: SafetyFilter):
        self.wechat = wechat
        self.llm = llm
        self.persona = persona
        self.context = context
        self.safety = safety
        self._draft_service = None  # set later to avoid circular import

        self._running = False
        self._thread: threading.Thread | None = None
        self._reply_count_minute = 0
        self._reply_count_reset_time = time.time()
        self._processed_msg_ids: set[int] = set()

    def set_draft_service(self, draft_service):
        self._draft_service = draft_service

    def start(self):
        self._running = True
        self.wechat.enable_msg_receiving()
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        logger.info("MessageRouter started")

    def stop(self):
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5)
        logger.info("MessageRouter stopped")

    def _run_loop(self):
        while self._running:
            msg = self.wechat.get_msg()
            if msg:
                self._handle_message(msg)
            time.sleep(0.5)

    def _handle_message(self, msg: dict):
        msg_id = msg.get("id", 0)
        if msg_id in self._processed_msg_ids:
            return
        self._processed_msg_ids.add(msg_id)

        if len(self._processed_msg_ids) > 10000:
            self._processed_msg_ids.clear()

        sender = msg.get("sender", "")
        contacts = self.wechat.get_contacts()
        if contacts and sender not in contacts:
            logger.debug("Sender %s not in whitelist, skipping", sender)
            return

        content = msg.get("content", "").strip()
        if not content:
            return

        if content.startswith("/off"):
            self._send_reply(msg, "[分身已关闭] 主人回来了~")
            self.stop()
            return

        if content.startswith("/on"):
            self._send_reply(msg, "[分身已上线] 又可以帮你摸鱼了~")
            return

        self._auto_reply(msg, content)

    def _auto_reply(self, msg: dict, content: str):
        if not self._check_rate_limit():
            return

        sender = msg["sender"]

        if self.safety.contains_sensitive(content):
            logger.warning("Sensitive content from %s, skipping", sender)
            return

        if self.safety.is_risky_intent(content):
            logger.info("Risky intent from %s, forcing draft mode", sender)

        db = self.context.db_session_factory()
        profile_name = self.persona.get_profile_for_contact(sender, db)
        db.close()

        history = self.context.get_recent_messages(sender)
        history_text = self.context.format_history_text(history)
        summary = self.context.get_summary(sender)

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

            reply = self.safety.clean_reply(reply)
            self.context.add_message(sender, "user", content)

            if settings.draft_mode and self._draft_service is not None:
                self._draft_service.create_draft(
                    contact_name=sender,
                    incoming_msg=content,
                    ai_draft=reply,
                )
                logger.info("Draft created for %s", sender)
            else:
                self.context.add_message(sender, "assistant", reply,
                                         is_auto_reply=True)
                self._send_reply(msg, reply)

        except Exception:
            logger.exception("Auto reply failed for %s", sender)

    def _send_reply(self, msg: dict, text: str):
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
