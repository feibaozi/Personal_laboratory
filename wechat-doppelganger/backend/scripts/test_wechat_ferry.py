"""测试截图+OCR 微信连通性。
前提：微信已运行、已登录、窗口可见（不要最小化）。"""
import sys
import time
from pathlib import Path

_project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_project_root))

from app.services.wechat_client import WeChatClient


def main():
    print("=== 微信连通性测试 (OCR+键盘模式) ===")
    print("确保微信已运行、已登录、窗口可见\n")

    client = WeChatClient()

    print("[1] 查找微信窗口...")
    if not client.start():
        print("[FAIL] 未找到微信窗口，请确保微信已运行并登录")
        return
    print("[OK] 已找到微信窗口")

    print("[2] 读取白名单联系人...")
    contacts = client.get_contacts()
    print(f"[OK] 白名单共 {len(contacts)} 个: {contacts}")

    print("[3] 启动后台 OCR 消息监听...")
    client.enable_msg_receiving()

    print("[4] 轮询消息 (每3秒 OCR 一次，Ctrl+C 停止)...")
    print("    请在微信里给白名单中的联系人发消息~")
    print()

    try:
        while True:
            msg = client.get_msg()
            if msg:
                content = msg.get("content", "")
                sender = msg.get("sender", "unknown")
                print(f"\n[MSG] {sender}: {content}")

                reply = f"[自动回复] 收到: {content[:15]}..."
                client.send_text(reply, sender)
                print(f"[REPLY] 已回复")

            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[INFO] 停止监听")

    client.stop()
    print("[OK] 测试结束")


if __name__ == "__main__":
    main()
