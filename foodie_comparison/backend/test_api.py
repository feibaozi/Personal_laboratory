import json, urllib.request, urllib.error

BASE = "http://127.0.0.1:8003"


def req(method, path, data=None, headers=None):
    hdrs = {"Content-Type": "application/json"}
    if headers:
        hdrs.update(headers)
    body = json.dumps(data).encode() if data else None
    request = urllib.request.Request(
        f"{BASE}{path}", data=body, headers=hdrs, method=method
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


print("=== Phase 2 API Testing ===")

# 1. Health
s, d = req("GET", "/health")
print(f"1. Health: {d}")

# 2. Register
s, d = req("POST", "/api/auth/register", {"username": "testuser", "password": "test123456"})
assert s == 200, f"Register failed: {d}"
token = d["access_token"]
print(f"2. Register: OK user_id={d['user_id']}")

hdrs = {"Authorization": f"Bearer {token}"}

# 3. Login
s, d = req("POST", "/api/auth/login", {"username": "testuser", "password": "test123456"})
assert s == 200
token2 = d["access_token"]
hdrs2 = {"Authorization": f"Bearer {token2}"}
print(f"3. Login: OK user={d['username']}")

# 4. Me
s, d = req("GET", "/api/auth/me", headers=hdrs)
assert s == 200
print(f"4. Me: id={d['id']}, username={d['username']}")

# 5. Get preference (empty)
s, d = req("GET", "/api/user/preference", headers=hdrs)
assert s == 200
print(f"5. Get Pref (empty): ps={d.get('price_sensitivity')}")

# 6. Update preference
s, d = req("PUT", "/api/user/preference", data={
    "cuisine_weights": {"中餐": 0.8, "西餐": 0.3},
    "taste_weights": {"辣": 0.7, "甜": 0.5},
    "avg_order_amount": 35.5,
    "price_sensitivity": 0.6,
    "preferred_platforms": ["meituan", "eleme"],
    "preferred_delivery_time": 25,
}, headers=hdrs)
assert s == 200, f"Update pref failed: {d}"
print(f"6. Update Pref: cuisine={d['cuisine_weights']}")

# 7. Read preference back
s, d = req("GET", "/api/user/preference", headers=hdrs)
assert s == 200
assert d["cuisine_weights"]["中餐"] == 0.8
assert d["price_sensitivity"] == 0.6
print(f"7. Read Pref: verified cuis=0.8 ps=0.6")

# 8. Get orders (empty)
s, d = req("GET", "/api/user/orders", headers=hdrs)
assert s == 200
print(f"8. Orders: count={len(d['items'])} total_savings={d['total_savings']}")

# 9. Add order
s, d = req("POST", "/api/user/orders", data={
    "shop_id": 1, "shop_name": "麦当劳", "platform": "meituan",
    "order_amount": 30.0, "actual_amount": 25.0, "savings": 5.0,
}, headers=hdrs)
assert s == 200, f"Add order failed: {d}"
print(f"9. Add Order: {d['shop_name']} saved={d['savings']}")

# 10. Get orders (with data)
s, d = req("GET", "/api/user/orders", headers=hdrs)
assert s == 200
assert len(d['items']) == 1
assert d['total_savings'] == 5.0
print(f"10. Orders after add: count={len(d['items'])} savings={d['total_savings']}")

# 11. Login with existing user (using hdrs2)
s, d = req("GET", "/api/auth/me", headers=hdrs2)
assert s == 200
assert d['username'] == 'testuser'
print(f"11. Second login me: OK")

# 12. Auth failure test
s, d = req("GET", "/api/auth/me", headers={"Authorization": "Bearer badtoken"})
assert s == 401
print(f"12. Auth fail: 401 as expected")

print("\n=== ALL 12 TESTS PASSED ===")