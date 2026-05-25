import asyncio
import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class TestCollectionResult:
    def test_success_result(self):
        from app.collectors.base_collector import CollectionResult

        result = CollectionResult(
            success=True,
            data={"shop": {"name": "测试店铺"}, "products": []},
            source="playwright",
        )
        d = result.to_dict()

        assert d["success"] is True
        assert d["data"]["shop"]["name"] == "测试店铺"
        assert d["source"] == "playwright"
        assert "collected_at" in d
        assert d["error"] is None

    def test_failure_result(self):
        from app.collectors.base_collector import CollectionResult

        result = CollectionResult(
            success=False,
            error="连接超时",
            source="api",
        )
        d = result.to_dict()

        assert d["success"] is False
        assert d["error"] == "连接超时"
        assert d["data"] == {}

    def test_empty_data_defaults(self):
        from app.collectors.base_collector import CollectionResult

        result = CollectionResult(success=True)
        d = result.to_dict()

        assert d["success"] is True
        assert d["data"] == {}
        assert d["error"] is None


class TestBaseCollector:
    def test_init(self):
        from app.collectors.base_collector import BaseCollector

        collector = BaseCollector()
        assert collector.platform == ""
        assert collector.base_url == ""
        assert collector._request_count == 0
        assert collector._browser is None

    def test_not_implemented_methods(self):
        from app.collectors.base_collector import BaseCollector

        collector = BaseCollector()

        with pytest.raises(NotImplementedError):
            asyncio.run(collector.collect_shops({}))

        with pytest.raises(NotImplementedError):
            asyncio.run(collector.collect_products("123"))

        with pytest.raises(NotImplementedError):
            asyncio.run(collector.collect_price("123"))

        with pytest.raises(NotImplementedError):
            asyncio.run(collector.collect_coupons())


SHOP_HTML = """
<html>
<head><title>巨无霸汉堡专卖店</title></head>
<body>
<div class="shop-info">
    <h1 class="shop-name">巨无霸汉堡专卖店</h1>
    <span class="rating">4.5分</span>
    <span class="category">西式快餐</span>
</div>
<div class="menu-list">
    <div class="dish-item">
        <span class="dish-name">巨无霸汉堡</span>
        <span class="price">¥25.80</span>
        <img src="/img/burger.jpg"/>
    </div>
    <div class="dish-item">
        <span class="dish-name">双层芝士堡</span>
        <span class="price">¥32.00</span>
        <img src="/img/cheese.jpg"/>
    </div>
    <div class="dish-item">
        <span class="dish-name">可乐（大）</span>
        <span class="price">¥8.50</span>
    </div>
    <div class="dish-item">
        <span class="dish-name">薯条（中）</span>
        <span class="price">¥12.00</span>
    </div>
</div>
<div class="delivery-info">
    <span class="delivery-fee">配送费 ¥3.00</span>
    <span class="delivery-time">约30-40分钟</span>
    <span class="min-order">最低消费 ¥20.00</span>
</div>
<div class="coupon-area">
    <div class="coupon">满50减15</div>
    <div class="coupon">满100减35</div>
    <div class="coupon">新用户减10元</div>
</div>
</body>
</html>
"""


class TestMeituanCollector:
    def test_parse_shop_info(self):
        from app.collectors.meituan_collector import MeituanCollector
        from bs4 import BeautifulSoup

        collector = MeituanCollector()
        soup = BeautifulSoup(SHOP_HTML, "lxml")
        info = collector._parse_shop_info(soup)

        assert info["name"] == "巨无霸汉堡专卖店"
        assert info["rating"] == 4.5
        assert info.get("category") == "西式快餐"

    def test_parse_products(self):
        from app.collectors.meituan_collector import MeituanCollector
        from bs4 import BeautifulSoup

        collector = MeituanCollector()
        soup = BeautifulSoup(SHOP_HTML, "lxml")
        products = collector._parse_products(soup)

        assert len(products) == 4
        assert products[0]["name"] == "巨无霸汉堡"
        assert products[0]["price"] == 25.80
        assert "burger.jpg" in products[0]["image_url"]
        assert products[1]["name"] == "双层芝士堡"
        assert products[1]["price"] == 32.00
        assert products[2]["price"] == 8.50
        assert products[3]["price"] == 12.00

    def test_parse_delivery(self):
        from app.collectors.meituan_collector import MeituanCollector
        from bs4 import BeautifulSoup

        collector = MeituanCollector()
        soup = BeautifulSoup(SHOP_HTML, "lxml")
        delivery = collector._parse_delivery(soup)

        assert delivery["fee"] == 3.00
        assert delivery["time_min"] == 30
        assert delivery["time_max"] == 40
        assert delivery["min_order"] == 20.00

    def test_parse_coupons(self):
        from app.collectors.meituan_collector import MeituanCollector
        from bs4 import BeautifulSoup

        collector = MeituanCollector()
        soup = BeautifulSoup(SHOP_HTML, "lxml")
        coupons = collector._parse_coupons(soup)

        assert len(coupons) >= 2
        full_reductions = [c for c in coupons if c["type"] == "full_reduction"]
        assert len(full_reductions) >= 2

    def test_fallback_result(self):
        from app.collectors.meituan_collector import MeituanCollector

        collector = MeituanCollector()
        result = collector._make_fallback_result("测试错误")

        assert result.success is False
        assert result.data["manual_entry_required"] is True
        assert "截图OCR" in result.data["message"]

    def test_extract_products_from_text(self):
        from app.collectors.meituan_collector import MeituanCollector

        collector = MeituanCollector()
        text = "招牌牛肉面 35.00元\n麻辣香锅  28.50元\n冰可乐 5元"
        products = collector._extract_products_from_text(text)

        assert len(products) == 3
        assert products[0]["name"] == "招牌牛肉面"
        assert products[0]["price"] == 35.00
        assert products[1]["name"] == "麻辣香锅"
        assert products[1]["price"] == 28.50
        assert products[2]["name"] == "冰可乐"
        assert products[2]["price"] == 5.00


ELEME_HTML = """
<html>
<head><title>川味小馆</title></head>
<body>
<div class="restaurant-header">
    <h1 class="restaurant-name">川味小馆</h1>
    <span class="star">4.8</span>
    <span class="category">川菜</span>
</div>
<ul class="menu">
    <li class="food-item">
        <span class="food-name">水煮鱼</span>
        <span class="food-price">¥58.00</span>
    </li>
    <li class="food-item">
        <span class="food-name">麻婆豆腐</span>
        <span class="food-price">¥22.00</span>
    </li>
    <li class="food-item">
        <span class="food-name">回锅肉</span>
        <span class="food-price">¥38.00</span>
    </li>
</ul>
<div class="info">
    <span class="delivery-fee">配送费 ¥5.00</span>
    <span class="delivery-time">预计25-35分钟</span>
    <span class="min-order">¥15起送</span>
</div>
</body>
</html>
"""


class TestElemeCollector:
    def test_parse_shop_info(self):
        from app.collectors.eleme_collector import ElemeCollector
        from bs4 import BeautifulSoup

        collector = ElemeCollector()
        soup = BeautifulSoup(ELEME_HTML, "lxml")
        info = collector._parse_shop_info(soup)

        assert info["name"] == "川味小馆"
        assert info["rating"] == 4.8
        assert info.get("category") == "川菜"

    def test_parse_products(self):
        from app.collectors.eleme_collector import ElemeCollector
        from bs4 import BeautifulSoup

        collector = ElemeCollector()
        soup = BeautifulSoup(ELEME_HTML, "lxml")
        products = collector._parse_products(soup)

        assert len(products) == 3
        assert products[0]["name"] == "水煮鱼"
        assert products[0]["price"] == 58.00
        assert products[1]["name"] == "麻婆豆腐"
        assert products[1]["price"] == 22.00

    def test_parse_delivery(self):
        from app.collectors.eleme_collector import ElemeCollector
        from bs4 import BeautifulSoup

        collector = ElemeCollector()
        soup = BeautifulSoup(ELEME_HTML, "lxml")
        delivery = collector._parse_delivery(soup)

        assert delivery["fee"] == 5.00
        assert delivery["time_min"] == 25
        assert delivery["time_max"] == 35
        assert delivery["min_order"] == 15.00


JD_HTML = """
<html>
<body>
<div class="shop-info">
    <h1 class="shop-name">京东披萨屋</h1>
    <span class="grade">4.2</span>
</div>
<ul class="goods-list">
    <li class="goods-item">
        <span class="goods-name">意式披萨</span>
        <span class="goods-price">¥49.90</span>
    </li>
    <li class="goods-item">
        <span class="goods-name">炸鸡翅</span>
        <span class="goods-price">¥18.90</span>
    </li>
</ul>
<div>
    <span class="delivery">配送 ¥4.00</span>
    <span class="time">约30-45分钟</span>
</div>
<div class="coupon">满60减20</div>
<div class="coupon">满100减40</div>
</body>
</html>
"""


class TestJDCollector:
    def test_parse_shop_info(self):
        from app.collectors.jd_collector import JDCollector
        from bs4 import BeautifulSoup

        collector = JDCollector()
        soup = BeautifulSoup(JD_HTML, "lxml")
        info = collector._parse_shop_info(soup)

        assert info["name"] == "京东披萨屋"
        assert info["rating"] == 4.2

    def test_parse_products(self):
        from app.collectors.jd_collector import JDCollector
        from bs4 import BeautifulSoup

        collector = JDCollector()
        soup = BeautifulSoup(JD_HTML, "lxml")
        products = collector._parse_products(soup)

        assert len(products) == 2
        assert products[0]["name"] == "意式披萨"
        assert products[0]["price"] == 49.90
        assert products[1]["name"] == "炸鸡翅"
        assert products[1]["price"] == 18.90

    def test_parse_delivery(self):
        from app.collectors.jd_collector import JDCollector
        from bs4 import BeautifulSoup

        collector = JDCollector()
        soup = BeautifulSoup(JD_HTML, "lxml")
        delivery = collector._parse_delivery(soup)

        assert delivery["fee"] == 4.00
        assert delivery["time_min"] == 30
        assert delivery["time_max"] == 45

    def test_parse_coupons(self):
        from app.collectors.jd_collector import JDCollector
        from bs4 import BeautifulSoup

        collector = JDCollector()
        soup = BeautifulSoup(JD_HTML, "lxml")
        coupons = collector._parse_coupons(soup)

        full_reductions = [c for c in coupons if c["type"] == "full_reduction"]
        assert len(full_reductions) == 2
        assert full_reductions[0]["threshold"] == 60
        assert full_reductions[0]["discount"] == 20
        assert full_reductions[1]["threshold"] == 100
        assert full_reductions[1]["discount"] == 40


DOUYIN_HTML = """
<html>
<body>
<div class="shop-header">
    <h1 class="poi-name">抖音火锅店</h1>
    <span class="score">4.6</span>
</div>
<ul>
    <li class="dish-item">
        <span class="product-name">毛肚</span>
        <span class="product-price">¥48.00</span>
    </li>
    <li class="dish-item">
        <span class="product-name">虾滑</span>
        <span class="product-price">¥38.00</span>
    </li>
</ul>
<div>
    <span class="delivery">配送费 ¥8.00</span>
    <span class="time">30-50分钟</span>
</div>
<div class="coupon">新客优惠10元</div>
<div class="coupon">满100减30</div>
</body>
</html>
"""


class TestDouyinCollector:
    def test_parse_shop_info(self):
        from app.collectors.douyin_collector import DouyinCollector
        from bs4 import BeautifulSoup

        collector = DouyinCollector()
        soup = BeautifulSoup(DOUYIN_HTML, "lxml")
        info = collector._parse_shop_info(soup)

        assert info["name"] == "抖音火锅店"
        assert info["rating"] == 4.6

    def test_parse_products(self):
        from app.collectors.douyin_collector import DouyinCollector
        from bs4 import BeautifulSoup

        collector = DouyinCollector()
        soup = BeautifulSoup(DOUYIN_HTML, "lxml")
        products = collector._parse_products(soup)

        assert len(products) == 2
        assert products[0]["name"] == "毛肚"
        assert products[0]["price"] == 48.00
        assert products[1]["name"] == "虾滑"
        assert products[1]["price"] == 38.00

    def test_parse_delivery(self):
        from app.collectors.douyin_collector import DouyinCollector
        from bs4 import BeautifulSoup

        collector = DouyinCollector()
        soup = BeautifulSoup(DOUYIN_HTML, "lxml")
        delivery = collector._parse_delivery(soup)

        assert delivery["fee"] == 8.00
        assert delivery["time_min"] == 30
        assert delivery["time_max"] == 50

    def test_parse_coupons(self):
        from app.collectors.douyin_collector import DouyinCollector
        from bs4 import BeautifulSoup

        collector = DouyinCollector()
        soup = BeautifulSoup(DOUYIN_HTML, "lxml")
        coupons = collector._parse_coupons(soup)

        assert len(coupons) >= 1


class TestCouponCollector:
    def test_init(self):
        from app.collectors.coupon_collector import CouponCollector

        collector = CouponCollector()
        assert collector._collectors == {}

    def test_get_collector_meituan(self):
        from app.collectors.coupon_collector import CouponCollector
        from app.collectors.meituan_collector import MeituanCollector

        cc = CouponCollector()
        c = cc._get_collector("meituan")

        assert isinstance(c, MeituanCollector)
        assert "meituan" in cc._collectors

    def test_get_collector_eleme(self):
        from app.collectors.coupon_collector import CouponCollector
        from app.collectors.eleme_collector import ElemeCollector

        cc = CouponCollector()
        c = cc._get_collector("eleme")

        assert isinstance(c, ElemeCollector)

    def test_get_collector_unknown(self):
        from app.collectors.coupon_collector import CouponCollector

        cc = CouponCollector()
        c = cc._get_collector("unknown_platform")

        assert c is None

    def test_get_collector_cache(self):
        from app.collectors.coupon_collector import CouponCollector

        cc = CouponCollector()
        c1 = cc._get_collector("meituan")
        c2 = cc._get_collector("meituan")

        assert c1 is c2


class TestCrossPlatformParsing:
    def test_all_collectors_parse_shop_info(self):
        from app.collectors.meituan_collector import MeituanCollector
        from app.collectors.eleme_collector import ElemeCollector
        from app.collectors.jd_collector import JDCollector
        from app.collectors.douyin_collector import DouyinCollector
        from bs4 import BeautifulSoup

        collectors = [
            (MeituanCollector(), SHOP_HTML, "巨无霸汉堡专卖店"),
            (ElemeCollector(), ELEME_HTML, "川味小馆"),
            (JDCollector(), JD_HTML, "京东披萨屋"),
            (DouyinCollector(), DOUYIN_HTML, "抖音火锅店"),
        ]

        for collector, html, expected_name in collectors:
            soup = BeautifulSoup(html, "lxml")
            info = collector._parse_shop_info(soup)
            assert info["name"] == expected_name

    def test_all_collectors_have_platform_name(self):
        from app.collectors.meituan_collector import MeituanCollector
        from app.collectors.eleme_collector import ElemeCollector
        from app.collectors.jd_collector import JDCollector
        from app.collectors.douyin_collector import DouyinCollector

        collectors = [
            (MeituanCollector(), "美团"),
            (ElemeCollector(), "饿了么"),
            (JDCollector(), "京东外卖"),
            (DouyinCollector(), "抖音外卖"),
        ]

        for collector, expected_name in collectors:
            result = collector._make_fallback_result("test")
            assert result.data["platform_name"] == expected_name


class TestProxyPool:
    def test_init(self):
        from app.collectors.proxy_pool import ProxyPool

        pool = ProxyPool()
        assert pool._redis is None
        assert pool._initialized is False

    def test_is_enabled_when_disabled(self):
        from app.collectors.proxy_pool import ProxyPool
        from app.config import settings

        original = settings.collector_proxy_enabled
        settings.collector_proxy_enabled = False
        try:
            pool = ProxyPool()
            result = asyncio.run(pool.is_enabled())
            assert result is False
        finally:
            settings.collector_proxy_enabled = original

    def test_get_proxy_when_disabled(self):
        from app.collectors.proxy_pool import ProxyPool
        from app.config import settings

        original = settings.collector_proxy_enabled
        settings.collector_proxy_enabled = False
        try:
            pool = ProxyPool()
            result = asyncio.run(pool.get_proxy())
            assert result is None
        finally:
            settings.collector_proxy_enabled = original


class TestCollectorPlatform:
    def test_meituan_platform_name(self):
        from app.collectors.meituan_collector import MeituanCollector

        c = MeituanCollector()
        assert c.platform == "meituan"
        assert c.base_url == "https://i.meituan.com"

    def test_eleme_platform_name(self):
        from app.collectors.eleme_collector import ElemeCollector

        c = ElemeCollector()
        assert c.platform == "eleme"
        assert c.base_url == "https://h5.ele.me"

    def test_jd_platform_name(self):
        from app.collectors.jd_collector import JDCollector

        c = JDCollector()
        assert c.platform == "jd_waimai"
        assert c.base_url == "https://waimai.jd.com"

    def test_douyin_platform_name(self):
        from app.collectors.douyin_collector import DouyinCollector

        c = DouyinCollector()
        assert c.platform == "douyin_waimai"
        assert c.base_url == "https://www.douyin.com"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])