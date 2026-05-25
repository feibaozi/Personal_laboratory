import sys
import os
import time
import threading

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
import httpx


# ============================================================
# Phase 6: Recommend Service Unit Tests
# ============================================================

class TestRecommendServiceUnit:
    def test_decay_weight_recent(self):
        from app.services.recommend_service import RecommendService
        from datetime import datetime, timezone

        svc = RecommendService(None)
        now = datetime.now(timezone.utc)
        assert svc._decay_weight(now) == 1.0

    def test_decay_weight_old(self):
        from app.services.recommend_service import RecommendService
        from datetime import datetime, timezone, timedelta

        svc = RecommendService(None)
        old = datetime.now(timezone.utc) - timedelta(days=15)
        weight = svc._decay_weight(old)
        assert 0.1 <= weight <= 1.0
        assert weight < 1.0

    def test_decay_weight_very_old(self):
        from app.services.recommend_service import RecommendService
        from datetime import datetime, timezone, timedelta

        svc = RecommendService(None)
        very_old = datetime.now(timezone.utc) - timedelta(days=60)
        weight = svc._decay_weight(very_old)
        assert weight == 0.1

    def test_price_score_affordable(self):
        from app.services.recommend_service import RecommendService

        svc = RecommendService(None)
        score = svc._price_score(25.0, 30.0, 0.5)
        assert 0.5 <= score <= 1.0

    def test_price_score_expensive(self):
        from app.services.recommend_service import RecommendService

        svc = RecommendService(None)
        score = svc._price_score(80.0, 30.0, 0.8)
        assert score <= 0.5

    def test_price_score_zero_price(self):
        from app.services.recommend_service import RecommendService

        svc = RecommendService(None)
        score = svc._price_score(0, 30.0, 0.5)
        assert score == 0.5

    def test_price_score_high_sensitivity(self):
        from app.services.recommend_service import RecommendService

        svc = RecommendService(None)
        score_cheap = svc._price_score(25.0, 30.0, 0.9)
        score_expensive = svc._price_score(80.0, 30.0, 0.9)
        assert score_cheap > score_expensive

    def test_generate_reason_with_category(self):
        from app.services.recommend_service import RecommendService

        svc = RecommendService(None)
        shop = {"category": "川菜", "savings": 5.0, "rating": 4.8}
        prefs = {"cuisine_weights": {"川菜": 0.8}}
        reason = svc._generate_reason(shop, prefs)
        assert "川菜" in reason
        assert "省" in reason
        assert "高分" in reason

    def test_generate_reason_no_match(self):
        from app.services.recommend_service import RecommendService

        svc = RecommendService(None)
        shop = {"category": "西餐", "rating": 4.0}
        prefs = {"cuisine_weights": {"川菜": 0.8}}
        reason = svc._generate_reason(shop, prefs)
        assert "历史偏好" in reason

    def test_extract_recent_shops(self):
        from app.services.recommend_service import RecommendService

        svc = RecommendService(None)
        orders = [
            {"shop_id": 1, "shop_name": "A"},
            {"shop_id": 2, "shop_name": "B"},
            {"shop_id": 1, "shop_name": "A"},
            {"shop_id": 3, "shop_name": "C"},
        ]
        shops = svc._extract_recent_shops(orders)
        assert shops == [1, 2, 3]

    def test_extract_recent_shops_empty(self):
        from app.services.recommend_service import RecommendService

        svc = RecommendService(None)
        shops = svc._extract_recent_shops([])
        assert shops == []

    def test_recommend_weights_sum(self):
        from app.services.recommend_service import RECOMMEND_WEIGHTS

        total = sum(RECOMMEND_WEIGHTS.values())
        assert abs(total - 1.0) < 0.01

    def test_behavior_weights(self):
        from app.services.recommend_service import BEHAVIOR_WEIGHTS

        assert BEHAVIOR_WEIGHTS["order"] == 10.0
        assert BEHAVIOR_WEIGHTS["favorite"] == 5.0
        assert BEHAVIOR_WEIGHTS["compare"] == 3.0
        assert BEHAVIOR_WEIGHTS["search"] == 2.0
        assert BEHAVIOR_WEIGHTS["click"] == 1.0
        assert BEHAVIOR_WEIGHTS["view"] == 0.5

    def test_platform_names(self):
        from app.services.recommend_service import PLATFORM_NAMES

        assert PLATFORM_NAMES["meituan"] == "美团"
        assert PLATFORM_NAMES["eleme"] == "饿了么"
        assert PLATFORM_NAMES["jd_waimai"] == "京东外卖"
        assert PLATFORM_NAMES["douyin_waimai"] == "抖音外卖"

    def test_score_products(self):
        from app.services.recommend_service import RecommendService

        svc = RecommendService(None)
        products = [
            {"id": 1, "product_name": "汉堡", "avg_price": 25},
            {"id": 2, "product_name": "披萨", "avg_price": 50},
        ]
        prefs = {"price_sensitivity": 0.7, "avg_order_amount": 30}
        scored = svc._score_products(products, prefs, [])
        assert len(scored) == 2
        assert all("score" in p for p in scored)
        assert scored[0]["score"] >= scored[1]["score"]


# ============================================================
# Phase 6: Integration Tests
# ============================================================

class TestPhase6Integration:
    @pytest.fixture(scope="class", autouse=True)
    def server_url(self):
        import uvicorn
        from app.main import app

        port = 8012
        url = f"http://127.0.0.1:{port}"

        config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="error")
        server = uvicorn.Server(config)

        thread = threading.Thread(target=server.run, daemon=True)
        thread.start()
        time.sleep(3)

        yield url

    def _client(self, server_url):
        return httpx.Client(base_url=server_url, timeout=10)

    def _register_and_login(self, client, suffix=""):
        username = f"rec_test_{int(time.time())}_{suffix}"
        resp = client.post("/api/auth/register", json={
            "username": username,
            "password": "test123",
        })
        assert resp.status_code == 200
        token = resp.json()["access_token"]
        return token, username

    def test_recommend_shops_requires_auth(self, server_url):
        with self._client(server_url) as c:
            resp = c.post("/api/recommend/shops", json={"limit": 5})
            assert resp.status_code == 403

    def test_recommend_products_requires_auth(self, server_url):
        with self._client(server_url) as c:
            resp = c.post("/api/recommend/products", json={"limit": 5})
            assert resp.status_code == 403

    def test_recommend_shops_cold_start(self, server_url):
        with self._client(server_url) as c:
            token, _ = self._register_and_login(c, "shop")
            headers = {"Authorization": f"Bearer {token}"}

            resp = c.post(
                "/api/recommend/shops",
                json={"limit": 5},
                headers=headers,
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["recommend_type"] == "shop"
            assert data["user_id"] > 0
            assert isinstance(data["items"], list)

    def test_recommend_products_cold_start(self, server_url):
        with self._client(server_url) as c:
            token, _ = self._register_and_login(c, "prod")
            headers = {"Authorization": f"Bearer {token}"}

            resp = c.post(
                "/api/recommend/products",
                json={"limit": 5},
                headers=headers,
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["recommend_type"] == "product"
            assert isinstance(data["items"], list)

    def test_log_behavior(self, server_url):
        with self._client(server_url) as c:
            token, _ = self._register_and_login(c, "beh")
            headers = {"Authorization": f"Bearer {token}"}

            resp = c.post(
                "/api/recommend/behavior",
                json={
                    "behavior_type": "click",
                    "target_type": "shop",
                    "target_id": 1,
                    "target_name": "测试店铺",
                },
                headers=headers,
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["success"] is True

    def test_log_behavior_invalid_type(self, server_url):
        with self._client(server_url) as c:
            token, _ = self._register_and_login(c, "inv")
            headers = {"Authorization": f"Bearer {token}"}

            resp = c.post(
                "/api/recommend/behavior",
                json={
                    "behavior_type": "invalid_type",
                    "target_type": "shop",
                    "target_id": 1,
                },
                headers=headers,
            )
            assert resp.status_code == 400

    def test_log_behavior_invalid_target(self, server_url):
        with self._client(server_url) as c:
            token, _ = self._register_and_login(c, "inv2")
            headers = {"Authorization": f"Bearer {token}"}

            resp = c.post(
                "/api/recommend/behavior",
                json={
                    "behavior_type": "click",
                    "target_type": "invalid",
                    "target_id": 1,
                },
                headers=headers,
            )
            assert resp.status_code == 400

    def test_get_behaviors(self, server_url):
        with self._client(server_url) as c:
            token, _ = self._register_and_login(c, "getb")
            headers = {"Authorization": f"Bearer {token}"}

            c.post(
                "/api/recommend/behavior",
                json={
                    "behavior_type": "view",
                    "target_type": "product",
                    "target_id": 1,
                    "target_name": "测试商品",
                },
                headers=headers,
            )

            resp = c.get("/api/recommend/behaviors", headers=headers)
            assert resp.status_code == 200
            data = resp.json()
            assert data["user_id"] > 0
            assert isinstance(data["behaviors"], list)
            assert len(data["behaviors"]) >= 1

    def test_get_recommend_history(self, server_url):
        with self._client(server_url) as c:
            token, _ = self._register_and_login(c, "hist")
            headers = {"Authorization": f"Bearer {token}"}

            c.post(
                "/api/recommend/shops",
                json={"limit": 3},
                headers=headers,
            )

            resp = c.get(
                "/api/recommend/history?recommend_type=shop",
                headers=headers,
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["user_id"] > 0
            assert isinstance(data["history"], list)

    def test_behavior_types_all_valid(self, server_url):
        with self._client(server_url) as c:
            token, _ = self._register_and_login(c, "allb")
            headers = {"Authorization": f"Bearer {token}"}

            for btype in ["order", "click", "view", "search", "favorite", "compare"]:
                resp = c.post(
                    "/api/recommend/behavior",
                    json={
                        "behavior_type": btype,
                        "target_type": "shop",
                        "target_id": 1,
                    },
                    headers=headers,
                )
                assert resp.status_code == 200, f"Failed for behavior_type={btype}"

    def test_recommend_with_platform_filter(self, server_url):
        with self._client(server_url) as c:
            token, _ = self._register_and_login(c, "plat")
            headers = {"Authorization": f"Bearer {token}"}

            resp = c.post(
                "/api/recommend/shops",
                json={"limit": 5, "platform": "meituan"},
                headers=headers,
            )
            assert resp.status_code == 200

    def test_recommend_limit_validation(self, server_url):
        with self._client(server_url) as c:
            token, _ = self._register_and_login(c, "lim")
            headers = {"Authorization": f"Bearer {token}"}

            resp = c.post(
                "/api/recommend/shops",
                json={"limit": 1},
                headers=headers,
            )
            assert resp.status_code == 200
            data = resp.json()
            assert len(data["items"]) <= 1

    def test_full_recommend_flow(self, server_url):
        with self._client(server_url) as c:
            token, _ = self._register_and_login(c, "flow")
            headers = {"Authorization": f"Bearer {token}"}

            c.post(
                "/api/recommend/behavior",
                json={
                    "behavior_type": "order",
                    "target_type": "shop",
                    "target_id": 1,
                    "target_name": "川味小馆",
                    "context": {"amount": 35.0},
                },
                headers=headers,
            )
            c.post(
                "/api/recommend/behavior",
                json={
                    "behavior_type": "favorite",
                    "target_type": "shop",
                    "target_id": 2,
                    "target_name": "粤式茶餐厅",
                },
                headers=headers,
            )

            resp = c.post(
                "/api/recommend/shops",
                json={"limit": 5},
                headers=headers,
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["recommend_type"] == "shop"
            assert data["total"] >= 0

            resp = c.get("/api/recommend/behaviors", headers=headers)
            assert resp.status_code == 200
            behaviors = resp.json()["behaviors"]
            assert len(behaviors) >= 2

            resp = c.get(
                "/api/recommend/history?recommend_type=shop",
                headers=headers,
            )
            assert resp.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])