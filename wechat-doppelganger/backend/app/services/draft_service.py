import json
import logging
import threading
from datetime import datetime

import requests
from sqlalchemy.orm import Session

from app.config import settings
from app.models.draft import DraftMessage, DraftStatus
from app.services.wechat_client import WeChatClient

logger = logging.getLogger(__name__)


class DraftService:
    def __init__(self, db_session_factory, telegram, wechat: WeChatClient):
        self.db_session_factory = db_session_factory
        self.telegram = telegram
        self.wechat = wechat

    def create_draft(self, contact_name: str, incoming_msg: str,
                     ai_draft: str) -> int:
        db: Session = self.db_session_factory()
        try:
            draft = DraftMessage(
                contact_name=contact_name,
                incoming_message=incoming_msg,
                ai_draft=ai_draft,
            )
            db.add(draft)
            db.commit()
            db.refresh(draft)

            threading.Thread(
                target=self._push_to_telegram,
                args=(draft.id, contact_name, incoming_msg, ai_draft),
                daemon=True,
            ).start()

            return draft.id
        finally:
            db.close()

    def _push_to_telegram(self, draft_id: int, contact_name: str,
                          incoming_msg: str, ai_draft: str):
        """Push draft via synchronous Telegram HTTP API (no async)."""
        try:
            url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
            text = (
                f"📩 *{self._escape(incoming_msg)}*\n\n"
                f"💬 草稿回复:\n"
                f"> {self._escape(ai_draft)}\n\n"
                f"📌 来自: {self._escape(contact_name)}"
            )
            payload = {
                "chat_id": settings.telegram_chat_id,
                "text": text,
                "parse_mode": "Markdown",
                "reply_markup": json.dumps({
                    "inline_keyboard": [[
                        {"text": "✅ 发送", "callback_data": f"draft:approve:{draft_id}"},
                        {"text": "❌ 拒绝", "callback_data": f"draft:reject:{draft_id}"},
                    ]]
                }),
            }
            proxies = None
            if settings.telegram_proxy:
                proxies = {"https": settings.telegram_proxy}
            resp = requests.post(url, data=payload, proxies=proxies, timeout=15)
            if resp.status_code == 200:
                result = resp.json()
                tg_msg_id = result["result"]["message_id"]
                self._update_telegram_id(draft_id, tg_msg_id)
                logger.info("Draft pushed to Telegram, tg_msg_id=%d", tg_msg_id)
            else:
                logger.error("Telegram API error: %s", resp.text)
        except Exception as e:
            logger.error("Failed to push draft to Telegram: %s", e)

    @staticmethod
    def _escape(text: str) -> str:
        for ch in ['_', '[', ']', '`']:
            text = text.replace(ch, '\\' + ch)
        return text

    def _update_telegram_id(self, draft_id: int, tg_msg_id: int):
        db: Session = self.db_session_factory()
        try:
            draft = db.query(DraftMessage).filter_by(id=draft_id).first()
            if draft:
                draft.telegram_message_id = tg_msg_id
                db.commit()
        finally:
            db.close()

    def approve(self, draft_id: int) -> bool:
        print(f"[DRAFT] approve called, draft_id={draft_id}", flush=True)
        db: Session = self.db_session_factory()
        try:
            draft = db.query(DraftMessage).filter_by(id=draft_id).first()
            if not draft:
                print(f"[DRAFT] draft not found", flush=True)
                return False
            if draft.status != DraftStatus.PENDING:
                print(f"[DRAFT] draft status is {draft.status}, not PENDING", flush=True)
                return False
            print(f"[DRAFT] approving: {draft.contact_name} <- {draft.ai_draft[:40]}", flush=True)
            draft.status = DraftStatus.APPROVED
            draft.resolved_at = datetime.utcnow()
            db.commit()
            self.wechat.send_text(draft.ai_draft, draft.contact_name)
            print(f"[DRAFT] send_text completed", flush=True)
            logger.info("Draft %d approved and sent to %s",
                        draft_id, draft.contact_name)
            return True
        finally:
            db.close()

    def reject(self, draft_id: int) -> bool:
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

    def modify_and_send(self, draft_id: int, modified_text: str) -> bool:
        db: Session = self.db_session_factory()
        try:
            draft = db.query(DraftMessage).filter_by(id=draft_id).first()
            if not draft or draft.status != DraftStatus.PENDING:
                return False
            draft.status = DraftStatus.MODIFIED
            draft.final_reply = modified_text
            draft.resolved_at = datetime.utcnow()
            db.commit()
            self.wechat.send_text(modified_text, draft.contact_name)
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
