import sys
import os
import json
import asyncio
import threading
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from httpx import AsyncClient


# ============================================================
# Phase 4: OCR Service Unit Tests
# ============================================================

class TestOCRServiceUnit:
    def test_ocr_service_init(self):
        from app.services.ocr_service import OCRService, OCR_AVAILABLE

        svc = OCRService()
        assert svc.available == OCR_AVAILABLE
        assert svc.confidence_threshold == 0.85

    def test_fallback_result_structure(self):
        from app.services.ocr_service import OCRService

        svc = OCRService()
        result = svc._fallback_result("/fake/path.png", "meituan")

        assert result["success"] is False
        assert result["platform"] == "meituan"
        assert result["ocr_enabled"] is False
        assert result["products"] == []
        assert "手动输入" in result["message"]
        assert "extracted_at" in result

    def test_extract_price_basic(self):
        from app.services.ocr_service import OCRService

        svc = OCRService()

        assert svc._extract_price("¥25.80") == 25.80
        assert svc._extract_price("￥32.00") == 32.00
        assert svc._extract_price("配送费 ¥5.00") == 5.00
        assert svc._extract_price("合计 88.50元") == 88.50
        assert svc._extract_price("免费配送") == 0.0
        assert svc._extract_price("免配送费") == 0.0

    def test_extract_price_no_number(self):
        from app.services.ocr_service import OCRService

        svc = OCRService()
        assert svc._extract_price("无价格信息") == 0.0

    def test_try_extract_product(self):
        from app.services.ocr_service import OCRService

        svc = OCRService()

        p1 = svc._try_extract_product("巨无霸汉堡 ¥25.80")
        assert p1 is not None
        assert p1["name"] == "巨无霸汉堡"
        assert p1["price"] == 25.80

        p2 = svc._try_extract_product("麻婆豆腐  ￥22.00")
        assert p2 is not None
        assert p2["name"] == "麻婆豆腐"
        assert p2["price"] == 22.00

        p3 = svc._try_extract_product("可乐  8.50")
        assert p3 is not None
        assert p3["name"] == "可乐"
        assert p3["price"] == 8.50

        p4 = svc._try_extract_product("这行没有价格")
        assert p4 is None

    def test_try_extract_discount(self):
        from app.services.ocr_service import OCRService

        svc = OCRService()

        d1 = svc._try_extract_discount("满50减15")
        assert d1 is not None
        assert d1["type"] == "full_reduction"
        assert d1["threshold"] == 50.0
        assert d1["discount"] == 15.0

        d2 = svc._try_extract_discount("满100减35")
        assert d2 is not None
        assert d2["threshold"] == 100.0
        assert d2["discount"] == 35.0

        d3 = svc._try_extract_discount("立减10元")
        assert d3 is not None
        assert d3["type"] == "direct"
        assert d3["value"] == 10.0

        d4 = svc._try_extract_discount("新用户优惠20")
        assert d4 is not None
        assert d4["type"] == "direct"
        assert d4["value"] == 20.0

    def test_try_extract_shop_name(self):
        from app.services.ocr_service import OCRService, PLATFORM_PATTERNS

        svc = OCRService()
        patterns = PLATFORM_PATTERNS["meituan"]

        assert svc._try_extract_shop_name("巨无霸汉堡店", patterns) == "巨无霸汉堡店"
        assert svc._try_extract_shop_name("川味小馆餐厅", patterns) == "川味小馆餐厅"
        assert svc._try_extract_shop_name("张三面馆", patterns) == "张三面馆"
        assert svc._try_extract_shop_name("普通文字没有关键词", patterns) == ""

    def test_matches_keywords(self):
        from app.services.ocr_service import OCRService

        svc = OCRService()

        assert svc._matches_keywords("配送费 ¥5.00", ["配送费", "配送", "运费"])
        assert svc._matches_keywords("合计 88.50", ["合计", "总计", "实付"])
        assert not svc._matches_keywords("普通文字", ["合计", "总计"])

    def test_structure_lines(self):
        from app.services.ocr_service import OCRService

        svc = OCRService()
        lines = [
            {"text": "巨无霸汉堡店", "confidence": 0.95, "position": [[0,0],[100,0],[100,30],[0,30]], "y_center": 15},
            {"text": "巨无霸汉堡 ¥25.80", "confidence": 0.92, "position": [[0,40],[100,40],[100,70],[0,70]], "y_center": 55},
            {"text": "可乐 ¥8.50", "confidence": 0.90, "position": [[0,80],[100,80],[100,110],[0,110]], "y_center": 95},
            {"text": "配送费 ¥3.00", "confidence": 0.88, "position": [[0,120],[100,120],[100,150],[0,150]], "y_center": 135},
            {"text": "满50减15", "confidence": 0.91, "position": [[0,160],[100,160],[100,190],[0,190]], "y_center": 175},
            {"text": "合计 ¥37.30", "confidence": 0.93, "position": [[0,200],[100,200],[100,230],[0,230]], "y_center": 215},
        ]

        result = svc._structure_lines(lines, "meituan")

        assert result["success"] is True
        assert result["shop_name"] == "巨无霸汉堡店"
        assert result["delivery_fee"] == 3.00
        assert result["total_amount"] == 37.30
        assert len(result["discounts"]) >= 1
        assert result["ocr_lines_count"] == 6

    def test_check_health(self):
        from app.services.ocr_service import OCRService

        svc = OCRService()
        health = svc.check_health()

        assert "ocr_available" in health
        assert "confidence_threshold" in health
        assert "supported_platforms" in health
        assert len(health["supported_platforms"]) == 4
        assert "meituan" in health["supported_platforms"]

    def test_parse_ocr_output_empty(self):
        from app.services.ocr_service import OCRService

        svc = OCRService()
        assert svc._parse_ocr_output(None) == []
        assert svc._parse_ocr_output([]) == []

    def test_parse_ocr_output_with_data(self):
        from app.services.ocr_service import OCRService

        svc = OCRService()
        raw = [
            [
                [
                    [[10, 20], [200, 20], [200, 50], [10, 50]],
                    ["巨无霸汉堡 ¥25.80", 0.95],
                ],
                [
                    [[10, 60], [150, 60], [150, 90], [10, 90]],
                    ["可乐 ¥8.50", 0.88],
                ],
            ]
        ]

        lines = svc._parse_ocr_output(raw)
        assert len(lines) == 2
        assert lines[0]["text"] == "巨无霸汉堡 ¥25.80"
        assert lines[0]["confidence"] == 0.95
        assert lines[1]["text"] == "可乐 ¥8.50"

    def test_parse_ocr_output_filters_low_confidence(self):
        from app.services.ocr_service import OCRService

        svc = OCRService()
        raw = [
            [
                [
                    [[10, 20], [200, 20], [200, 50], [10, 50]],
                    ["高置信度文本", 0.95],
                ],
                [
                    [[10, 60], [150, 60], [150, 90], [10, 90]],
                    ["低置信度文本", 0.50],
                ],
            ]
        ]

        lines = svc._parse_ocr_output(raw)
        assert len(lines) == 1
        assert lines[0]["text"] == "高置信度文本"


# ============================================================
# Phase 5: Compare Service Unit Tests
# ============================================================

class TestCompareServiceUnit:
    def test_calculate_optimal_discount_no_rules(self):
        from app.services.compare_service import CompareService

        svc = CompareService(None)
        assert svc._calculate_optimal_discount(100.0, []) == 0.0

    def test_calculate_optimal_discount_single_rule(self):
        from app.services.compare_service import CompareService

        svc = CompareService(None)
        rules = [{"threshold": 50, "discount": 10}]
        assert svc._calculate_optimal_discount(60.0, rules) == 10.0
        assert svc._calculate_optimal_discount(40.0, rules) == 0.0

    def test_calculate_optimal_discount_multiple_rules(self):
        from app.services.compare_service import CompareService

        svc = CompareService(None)
        rules = [
            {"threshold": 30, "discount": 5},
            {"threshold": 50, "discount": 15},
            {"threshold": 100, "discount": 40},
        ]
        assert svc._calculate_optimal_discount(60.0, rules) == 15.0
        assert svc._calculate_optimal_discount(120.0, rules) == 40.0
        assert svc._calculate_optimal_discount(25.0, rules) == 0.0

    def test_calculate_coupon_savings(self):
        from app.services.compare_service import CompareService

        svc = CompareService(None)
        coupons = [
            {"platform": "meituan", "value": 5, "min_spend": 30},
            {"platform": "eleme", "value": 8, "min_spend": 20},
            {"platform": "meituan", "value": 3, "min_spend": 10},
        ]

        savings = svc._calculate_coupon_savings(50.0, "meituan", coupons)
        assert savings == 8.0

        savings = svc._calculate_coupon_savings(50.0, "eleme", coupons)
        assert savings == 8.0

        savings = svc._calculate_coupon_spons(5.0, "meituan", coupons) if hasattr(svc, '_calculate_coupon_spons') else 0

    def test_calculate_coupon_savings_min_spend_not_met(self):
        from app.services.compare_service import CompareService

        svc = CompareService(None)
        coupons = [
            {"platform": "meituan", "value": 5, "min_spend": 50},
        ]
        savings = svc._calculate_coupon_savings(30.0, "meituan", coupons)
        assert savings == 0.0

    def test_calculate_coupon_savings_cannot_exceed_total(self):
        from app.services.compare_service import CompareService

        svc = CompareService(None)
        coupons = [
            {"platform": "meituan", "value": 100, "min_spend": 0},
        ]
        savings = svc._calculate_coupon_savings(30.0, "meituan", coupons)
        assert savings == 30.0

    def test_calculate_final_price_no_discount(self):
        from app.services.compare_service import CompareService

        svc = CompareService(None)
        final = svc._calculate_final_price(
            original_total=35.0,
            discount_info=[],
            platform="meituan",
            user_coupons=[],
        )
        assert final == 35.0

    def test_calculate_final_price_with_discount(self):
        from app.services.compare_service import CompareService

        svc = CompareService(None)
        final = svc._calculate_final_price(
            original_total=60.0,
            discount_info=[{"threshold": 50, "discount": 15}],
            platform="meituan",
            user_coupons=[],
        )
        assert final == 45.0

    def test_calculate_final_price_with_discount_and_coupon(self):
        from app.services.compare_service import CompareService

        svc = CompareService(None)
        final = svc._calculate_final_price(
            original_total=60.0,
            discount_info=[{"threshold": 50, "discount": 15}],
            platform="meituan",
            user_coupons=[{"platform": "meituan", "value": 5, "min_spend": 30}],
        )
        assert final == 40.0

    def test_calculate_final_price_cannot_be_negative(self):
        from app.services.compare_service import CompareService

        svc = CompareService(None)
        final = svc._calculate_final_price(
            original_total=10.0,
            discount_info=[{"threshold": 10, "discount": 15}],
            platform="meituan",
            user_coupons=[{"platform": "meituan", "value": 20, "min_spend": 0}],
        )
        assert final == 0.0

    def test_parse_discount_info_valid(self):
        from app.services.compare_service import CompareService

        svc = CompareService(None)
        result = svc._parse_discount_info('[{"threshold": 50, "discount": 10}]')
        assert len(result) == 1
        assert result[0]["threshold"] == 50

    def test_parse_discount_info_empty(self):
        from app.services.compare_service import CompareService

        svc = CompareService(None)
        assert svc._parse_discount_info("") == []
        assert svc._parse_discount_info(None) == []
        assert svc._parse_discount_info("invalid") == []

    def test_get_platform_name(self):
        from app.services.compare_service import CompareService

        assert CompareService.get_platform_name("meituan") == "美团"
        assert CompareService.get_platform_name("eleme") == "饿了么"
        assert CompareService.get_platform_name("jd_waimai") == "京东外卖"
        assert CompareService.get_platform_name("douyin_waimai") == "抖音外卖"
        assert CompareService.get_platform_name("unknown") == "unknown"


# ============================================================
# Phase 4+5: Integration Tests (with embedded uvicorn, sync)
# ============================================================

class TestPhase4And5Integration:
    @pytest.fixture(scope="class", autouse=True)
    def server_url(self):
        import uvicorn
        from app.main import app

        port = 8011
        url = f"http://127.0.0.1:{port}"

        config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="error")
        server = uvicorn.Server(config)

        thread = threading.Thread(target=server.run, daemon=True)
        thread.start()
        time.sleep(3)

        yield url

    def _client(self, server_url):
        import httpx
        return httpx.Client(base_url=server_url, timeout=10)

    def test_health_check(self, server_url):
        with self._client(server_url) as c:
            resp = c.get("/health")
            assert resp.status_code == 200
            assert resp.json()["status"] == "ok"

    def test_ocr_health_endpoint(self, server_url):
        with self._client(server_url) as c:
            resp = c.get("/api/ocr/health")
            assert resp.status_code == 200
            data = resp.json()
            assert "ocr_available" in data
            assert "supported_platforms" in data
            assert len(data["supported_platforms"]) == 4

    def test_ocr_extract_requires_auth(self, server_url):
        with self._client(server_url) as c:
            resp = c.post("/api/ocr/extract?platform=meituan")
            assert resp.status_code == 403

    def test_ocr_extract_with_auth_invalid_file(self, server_url):
        with self._client(server_url) as c:
            reg = c.post("/api/auth/register", json={
                "username": f"ocr_test_{int(time.time())}",
                "password": "test123",
            })
            token = reg.json()["access_token"]

            resp = c.post(
                "/api/ocr/extract?platform=meituan",
                headers={"Authorization": f"Bearer {token}"},
                files={"file": ("test.txt", b"not an image", "text/plain")},
            )
            assert resp.status_code == 400

    def test_compare_product_requires_auth(self, server_url):
        with self._client(server_url) as c:
            resp = c.post("/api/compare/product", json={
                "product_name": "巨无霸",
            })
            assert resp.status_code == 403

    def test_compare_product_with_auth_empty_db(self, server_url):
        with self._client(server_url) as c:
            reg = c.post("/api/auth/register", json={
                "username": f"compare_test_{int(time.time())}",
                "password": "test123",
            })
            token = reg.json()["access_token"]

            resp = c.post(
                "/api/compare/product",
                json={"product_name": "不存在的商品"},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["product_name"] == "不存在的商品"
            assert data["results"] == []

    def test_saving_rank_no_auth_required(self, server_url):
        with self._client(server_url) as c:
            resp = c.get("/api/compare/saving-rank")
            assert resp.status_code == 200
            data = resp.json()
            assert "items" in data
            assert "total" in data

    def test_compare_shop_requires_auth(self, server_url):
        with self._client(server_url) as c:
            resp = c.get("/api/compare/shop?shop_name=测试")
            assert resp.status_code == 403


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])