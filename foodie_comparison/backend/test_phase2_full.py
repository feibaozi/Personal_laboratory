"""Phase 2: 内嵌服务器 + 完整 API 测试"""
import sys, os
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_phase2.db"
os.environ["DATABASE_URL_SYNC"] = "sqlite:///./test_phase2.db"

sys.path.insert(0, ".")

import json, threading, time
import urllib.request, urllib.error
import uvicorn
from app.main import app

PORT = 8765
BASE = f"http://127.0.0.1:{PORT}"


def req(method, path, data=None, headers=None):
    hdrs = {"Content-Type": "application/json"}
    if headers:
        hdrs.update(headers)
    body = json.dumps(data).encode() if data else None
    request = urllib.request.Request(
        f"{BASE}{path}", data=body, headers=hdrs, method=method,
    )
    try:
        with urllib.request.urlopen(request) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read()
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"detail": body.decode()}


def run():
    server = uvicorn.Server(
        uvicorn.Config(app, host="127.0.0.1", port=PORT, log_level="error")
    )
    server.run()


t = threading.Thread(target=run, daemon=True)
t.start()
time.sleep(3)

print("=== Phase 2 API Testing ===\n")

# 1. Health
s, d = req("GET", "/health")
assert s == 200
print(f"[PASS] 1. Health: version={d['version']}")

# 2. Register
s, d = req("POST", "/api/auth/register",
           {"username": "testuser", "password": "test123456"})
assert s == 200, f"FAIL: {d}"
token = d["access_token"]
print(f"[PASS] 2. Register: user_id={d['user_id']}")
hdrs = {"Authorization": f"Bearer {token}"}

# 3. Login
s, d = req("POST", "/api/auth/login",
           {"username": "testuser", "password": "test123456"})
assert s == 200
assert "access_token" in d
print(f"[PASS] 3. Login: OK")

# 4. Bad login
s, d = req("POST", "/api/auth/login",
           {"username": "testuser", "password": "wrong"})
assert s == 401
print(f"[PASS] 4. Bad login: 401 as expected")

# 5. Me
s, d = req("GET", "/api/auth/me", headers=hdrs)
assert s == 200
assert d["username"] == "testuser"
print(f"[PASS] 5. GET /me: username={d['username']}")

# 6. Bad token
s, d = req("GET", "/api/auth/me",
           headers={"Authorization": "Bearer badtoken"})
assert s == 401
print(f"[PASS] 6. Bad token: 401")

# 7. No token
s, d = req("GET", "/api/auth/me")
assert s == 403
print(f"[PASS] 7. No token: 403")

# 8. Get empty preference
s, d = req("GET", "/api/user/preference", headers=hdrs)
assert s == 200
assert d["price_sensitivity"] == 0.5
assert d["cuisine_weights"] == {}
print(f"[PASS] 8. Empty preference: OK")

# 9. Update preference
s, d = req("PUT", "/api/user/preference", data={
    "cuisine_weights": {"中餐": 0.8, "西餐": 0.3},
    "taste_weights": {"辣": 0.7, "甜": 0.5},
    "avg_order_amount": 35.5,
    "price_sensitivity": 0.6,
    "preferred_platforms": ["meituan", "eleme"],
    "preferred_delivery_time": 25,
}, headers=hdrs)
assert s == 200
assert d["cuisine_weights"]["中餐"] == 0.8
assert d["price_sensitivity"] == 0.6
print(f"[PASS] 9. Update preference: OK")

# 10. Read preference back
s, d = req("GET", "/api/user/preference", headers=hdrs)
assert s == 200
assert d["cuisine_weights"]["中餐"] == 0.8
assert d["price_sensitivity"] == 0.6
print(f"[PASS] 10. Read preference: verified")

# 11. Get empty orders
s, d = req("GET", "/api/user/orders", headers=hdrs)
assert s == 200
assert d["total_savings"] == 0.0
print(f"[PASS] 11. Empty orders: OK")

# 12. Add order 1
s, d = req("POST", "/api/user/orders", data={
    "shop_id": 1, "shop_name": "麦当劳", "platform": "meituan",
    "order_amount": 30.0, "actual_amount": 25.0, "savings": 5.0,
}, headers=hdrs)
assert s == 200
assert d["savings"] == 5.0
print(f"[PASS] 12. Add order 1: savings={d['savings']}")

# 13. Add order 2
s, d = req("POST", "/api/user/orders", data={
    "shop_id": 2, "shop_name": "肯德基", "platform": "eleme",
    "order_amount": 68.0, "actual_amount": 62.0, "savings": 6.0,
}, headers=hdrs)
assert s == 200
print(f"[PASS] 13. Add order 2: savings={d['savings']}")

# 14. Get orders with data
s, d = req("GET", "/api/user/orders", headers=hdrs)
assert s == 200
assert len(d["items"]) == 2
assert d["total_savings"] == 11.0
print(f"[PASS] 14. Orders: count={len(d['items'])} total_savings={d['total_savings']}")

# 15. Unauthorized preference access (no auth)
s, d = req("GET", "/api/user/preference")
assert s == 403
print(f"[PASS] 15. No auth on pref: 403")

# 16. Second user register
s2, d2 = req("POST", "/api/auth/register",
             {"username": "user2", "password": "second456"})
assert s2 == 200
token2 = d2["access_token"]
hdrs2 = {"Authorization": f"Bearer {token2}"}
print(f"[PASS] 16. Second user: user_id={d2['user_id']}")

# 17. Second user preference (independent)
s, d = req("GET", "/api/user/preference", headers=hdrs2)
assert s == 200
assert d["price_sensitivity"] == 0.5
print(f"[PASS] 17. User2 empty pref: OK (isolated)")

# 18. First user still has preference
s, d = req("GET", "/api/user/preference", headers=hdrs)
assert s == 200
assert d["cuisine_weights"]["中餐"] == 0.8
print(f"[PASS] 18. User1 pref intact: OK (data isolation)")

print(f"\n=== ALL 18 TESTS PASSED ===")
os._exit(0)