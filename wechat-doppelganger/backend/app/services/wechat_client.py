import logging
import threading
import time
from collections import deque
from pathlib import Path

import numpy as np
import mss
import uiautomation as auto
import win32con
import win32gui
from rapidocr import RapidOCR

from app.config import settings

logger = logging.getLogger(__name__)

WHITELIST_PATH = Path(__file__).resolve().parent.parent.parent / "config" / "whitelist.txt"

# Crop ratios for the chat message area within the WeChat window
LEFT_PANEL_RATIO = 0.28   # left contact/session list
HEADER_RATIO = 0.10        # top title bar
INPUT_RATIO = 0.16          # bottom input box area


class WeChatClient:
    def __init__(self):
        self._hwnd: int | None = None
        self._ocr: RapidOCR | None = None
        self._sct: mss.MSS | None = None
        self._is_running = False
        self._friends_cache: list[str] = []
        self._seen_messages: set[str] = set()
        self._msg_deque: deque = deque()
        self._last_ocr_text: dict[str, set[str]] = {}  # contact -> set of known text lines
        self._listener_thread: threading.Thread | None = None
        self._stop_event = threading.Event()
        self._current_chat: str = ""

    # ── public API ─────────────────────────────────────────────────

    def start(self) -> bool:
        try:
            self._hwnd = self._find_wechat_hwnd()
            if self._hwnd is None:
                logger.error("Cannot find WeChat window")
                return False
            self._ocr = RapidOCR()
            self._sct = mss.MSS()
            self._refresh_friends()
            self._is_running = True
            logger.info("WeChat client started (OCR+keyboard mode), hwnd=%d, %d contacts",
                        self._hwnd, len(self._friends_cache))
            return True
        except Exception:
            logger.exception("Failed to start WeChat client")
            return False

    def is_logged_in(self) -> bool:
        return self._find_wechat_hwnd() is not None

    def get_self_info(self) -> dict:
        return {"wxid": "self", "nickname": ""}

    def get_contacts(self) -> list[str]:
        try:
            self._refresh_friends()
        except Exception:
            logger.exception("Failed to refresh contacts")
        return self._friends_cache

    def send_text(self, msg: str, receiver: str, aters: str = "") -> int:
        print(f"[SEND] -> {receiver}: {msg[:40]}...", flush=True)
        try:
            self._ensure_window_active()
            self._open_chat_via_search(receiver, force=True)
            self._type_and_send(msg)
            print(f"[SEND] OK", flush=True)
            logger.info("Sent to %s: %s...", receiver, msg[:50])
            return 0
        except Exception:
            print(f"[SEND] FAILED", flush=True)
            logger.exception("Failed to send message to %s", receiver)
            return -1

    # ── message receiving ──────────────────────────────────────────

    def enable_msg_receiving(self):
        self._seen_messages.clear()
        self._msg_deque.clear()
        self._last_ocr_text.clear()
        self._stop_event.clear()
        self._listener_thread = threading.Thread(
            target=self._poll_loop, daemon=True)
        self._listener_thread.start()
        logger.info("Message receiving enabled (OCR polling mode)")

    def get_msg(self) -> dict | None:
        if not self._msg_deque:
            return None
        return self._msg_deque.popleft()

    def poll_new_messages(self, friend: str | None = None,
                          count: int = 5) -> list[dict]:
        if not self._friends_cache:
            self._refresh_friends()
        targets = [friend] if friend else self._friends_cache[:5]
        new_msgs = []

        for target in targets:
            try:
                texts = self._read_chat_ocr(target)
                prev = self._last_ocr_text.get(target, set())
                new_lines = texts - prev
                self._last_ocr_text[target] = texts

                for line in new_lines:
                    line = line.strip()
                    if len(line) < 1 or len(line) > 500:
                        continue
                    msg_id = f"{target}|{line[:30]}"
                    if msg_id in self._seen_messages:
                        continue
                    self._seen_messages.add(msg_id)

                    msg_dict = {
                        "id": hash(msg_id) % 10000000,
                        "type": 1,
                        "sender": target,
                        "roomid": "",
                        "content": line,
                        "is_group": False,
                        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                    }
                    self._msg_deque.append(msg_dict)
                    new_msgs.append(msg_dict)

            except Exception:
                logger.debug("OCR poll failed for %s", target)

        if len(self._seen_messages) > 2000:
            old = sorted(self._seen_messages)[:800]
            self._seen_messages.difference_update(old)

        return new_msgs

    def stop(self):
        self._is_running = False
        self._stop_event.set()
        if self._listener_thread and self._listener_thread.is_alive():
            self._listener_thread.join(timeout=5)
        if self._sct is not None:
            self._sct.close()
            self._sct = None
        self._ocr = None
        self._hwnd = None
        logger.info("WeChat client stopped")

    # ═══════════════════════════════════════════════════════════════
    #  window helpers
    # ═══════════════════════════════════════════════════════════════

    @staticmethod
    def _find_wechat_hwnd() -> int | None:
        """Find a visible, non-iconic Qt WeChat window of reasonable size."""
        results = []

        def enum_handler(hwnd, _results):
            cls = win32gui.GetClassName(hwnd)
            if cls != 'Qt51514QWindowIcon':
                return
            if not win32gui.IsWindowVisible(hwnd):
                return
            rect = win32gui.GetWindowRect(hwnd)
            w = rect[2] - rect[0]
            h = rect[3] - rect[1]
            if w > 200 and h > 200 and not win32gui.IsIconic(hwnd):
                _results.append((hwnd, rect))

        win32gui.EnumWindows(enum_handler, results)
        if results:
            results.sort(key=lambda r: r[1][2] * r[1][3], reverse=True)
            return results[0][0]
        return None

    def _ensure_window_active(self):
        if self._hwnd is None:
            self._hwnd = self._find_wechat_hwnd()
        if self._hwnd is None:
            return
        if win32gui.IsIconic(self._hwnd):
            win32gui.ShowWindow(self._hwnd, win32con.SW_RESTORE)
        # Alt key trick: generate input to get foreground permission
        import ctypes
        ctypes.windll.user32.keybd_event(0x12, 0, 0, 0)  # Alt down
        ctypes.windll.user32.keybd_event(0x12, 0, 2, 0)  # Alt up
        win32gui.SetForegroundWindow(self._hwnd)
        time.sleep(0.3)

    def _get_window_rect(self) -> tuple | None:
        hwnd = self._find_wechat_hwnd()
        if hwnd is None:
            return None
        self._hwnd = hwnd
        return win32gui.GetWindowRect(hwnd)

    # ═══════════════════════════════════════════════════════════════
    #  keyboard-based sending
    # ═══════════════════════════════════════════════════════════════

    def _open_chat_via_search(self, name: str, force: bool = False):
        if self._current_chat == name and not force:
            return
        auto.SendKeys('{Ctrl}f')
        time.sleep(0.3)
        auto.SendKeys('{Ctrl}a')
        auto.SendKeys('{Delete}')
        time.sleep(0.1)
        auto.SetClipboardText(name)
        auto.SendKeys('{Ctrl}v')
        time.sleep(0.5)
        auto.SendKeys('{Enter}')
        time.sleep(0.4)
        self._current_chat = name

    def _type_and_send(self, text: str):
        auto.SetClipboardText(text)
        auto.SendKeys('{Ctrl}v')
        time.sleep(0.15)
        auto.SendKeys('{Enter}')

    # ═══════════════════════════════════════════════════════════════
    #  OCR-based reading
    # ═══════════════════════════════════════════════════════════════

    def _read_chat_ocr(self, name: str) -> set[str]:
        """Open a chat and OCR the message area.  Returns set of text lines."""
        self._ensure_window_active()
        self._open_chat_via_search(name)

        rect = win32gui.GetWindowRect(self._hwnd)
        win_w = rect[2] - rect[0]
        win_h = rect[3] - rect[1]

        # Crop to the chat message area (right panel, middle section)
        crop_left = rect[0] + int(win_w * LEFT_PANEL_RATIO)
        crop_top = rect[1] + int(win_h * HEADER_RATIO)
        crop_right = rect[2]
        crop_bottom = rect[3] - int(win_h * INPUT_RATIO)
        crop_w = crop_right - crop_left
        crop_h = crop_bottom - crop_top

        if crop_w < 50 or crop_h < 50:
            return set()

        monitor = {
            'left': crop_left, 'top': crop_top,
            'width': crop_w, 'height': crop_h,
        }
        arr = np.array(self._sct.grab(monitor))
        arr_rgb = arr[:, :, :3][:, :, ::-1]  # BGRA → RGB

        result = self._ocr(arr_rgb)
        return set(result.txts)

    # ═══════════════════════════════════════════════════════════════
    #  contacts
    # ═══════════════════════════════════════════════════════════════

    def _refresh_friends(self):
        path = Path(settings.whitelist_path)
        if not path.is_absolute():
            path = Path(__file__).resolve().parent.parent.parent / path
        names: list[str] = []
        if path.exists():
            for line in path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#"):
                    names.append(line)
        self._friends_cache = names

    def _poll_loop(self):
        interval = settings.polling_interval_seconds
        while not self._stop_event.is_set():
            try:
                self.poll_new_messages()
            except Exception:
                logger.debug("Background poll error", exc_info=True)
            self._stop_event.wait(interval)
