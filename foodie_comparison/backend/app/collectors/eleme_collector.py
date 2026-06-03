import json
import re
import logging

from bs4 import BeautifulSoup

from .base_collector import BaseCollector, CollectionResult

logger = logging.getLogger(__name__)


class ElemeCollector(BaseCollector):
    platform = "eleme"
    base_url = "https://h5.ele.me"
    strategy_order = ["cache"]
    robots_allowed = False

    def __init__(self):
        super().__init__()
        self._platform_headers = {
            "Referer": "https://h5.ele.me/",
            "Origin": "https://h5.ele.me",
        }

    async def collect_shop_menu(self, shop_url: str) -> CollectionResult:
        try:
            html = await self._page_request(shop_url, wait_ms=3000)
            soup = await self._parse_page(html)

            shop_info = self._parse_shop_info(soup)
            products = self._parse_products(soup)
            delivery_info = self._parse_delivery(soup)
            coupons = self._parse_coupons(soup)

            return CollectionResult(
                success=True,
                data={
                    "platform": "eleme",
                    "platform_name": "饿了么",
                    "shop": shop_info,
                    "products": products,
                    "delivery": delivery_info,
                    "coupons": coupons,
                    "source_url": shop_url,
                },
                source="playwright",
            )
        except Exception as e:
            logger.error("Eleme collection failed: %s", e)
            return self._make_fallback_result(str(e))

    def _parse_shop_info(self, soup: BeautifulSoup) -> dict:
        info = {}

        selectors = [
            '.restaurant-name', '.shop-name', 'h1', '.name',
            '[class*="restaurant"]', '[class*="shop-name"]',
        ]
        for sel in selectors:
            el = soup.select_one(sel)
            if el and el.text.strip():
                info["name"] = el.text.strip()
                break
        if "name" not in info:
            title_el = soup.select_one("title")
            if title_el:
                info["name"] = title_el.text.strip()

        rating_selectors = [
            '.rating', '.star', '.score', '[class*="rating"]',
        ]
        for sel in rating_selectors:
            el = soup.select_one(sel)
            if el:
                nums = re.findall(r'(\d+\.?\d*)', el.text.strip())
                if nums:
                    try:
                        info["rating"] = float(nums[0])
                        if info["rating"] > 5:
                            info["rating"] = info["rating"] / 10 if info["rating"] <= 50 else 0.0
                        break
                    except ValueError:
                        pass

        info.setdefault("name", "未知店铺")
        info.setdefault("rating", 0.0)

        category_el = soup.select_one('[class*="category"], [class*="tag"]')
        if category_el:
            info["category"] = category_el.text.strip()

        return info

    def _parse_products(self, soup: BeautifulSoup) -> list:
        products = []

        item_selectors = [
            '.menu-item', '.food-item', '.dish-item',
            '[class*="food"]', '[class*="menu-item"]',
        ]
        items = []
        for sel in item_selectors:
            items = soup.select(sel)
            if items:
                break

        if not items:
            items = soup.select('li')[:50]

        for item in items[:50]:
            name_el = (
                item.select_one('.name, .food-name, .item-name')
                or item.select_one('[class*="name"]')
            )
            price_el = (
                item.select_one('.price, .food-price, .item-price')
                or item.select_one('[class*="price"]')
            )
            img_el = item.select_one('img')

            name = name_el.text.strip() if name_el else ""
            price = 0.0
            if price_el:
                price_text = price_el.text.strip()
                price_text = re.sub(r'[¥￥\s]', '', price_text)
                try:
                    price = float(price_text)
                except ValueError:
                    price = 0.0

            if name or price > 0:
                products.append({
                    "name": name or "未知商品",
                    "price": price,
                    "image_url": img_el.get("src", "") if img_el else "",
                })

        if not products:
            products = self._extract_products_from_text(soup.get_text())

        return products

    def _extract_products_from_text(self, text: str) -> list:
        products = []
        lines = text.split("\n")
        for line in lines:
            line = line.strip()
            if not line or len(line) < 2:
                continue
            price_match = re.search(r'(?:¥|￥|元)?\s*(\d+\.?\d*)\s*(?:元)?\s*$', line)
            if price_match:
                name = line[:price_match.start()].strip()
                price = float(price_match.group(1))
                if name and price > 0:
                    products.append({
                        "name": name,
                        "price": price,
                        "image_url": "",
                    })
        return products[:50]

    def _parse_delivery(self, soup: BeautifulSoup) -> dict:
        delivery = {
            "fee": 0.0,
            "time_min": 25,
            "time_max": 40,
            "min_order": 0.0,
            "distance": "",
        }

        fee_el = soup.select_one(
            '[class*="delivery-fee"], [class*="shipping"], '
            '[class*="freight"]'
        )
        if fee_el:
            nums = re.findall(r'(\d+\.?\d*)', fee_el.text.strip())
            if nums:
                delivery["fee"] = float(nums[0])

        time_el = soup.select_one('[class*="delivery-time"], [class*="arrive"]')
        if time_el:
            nums = re.findall(r'(\d+)', time_el.text.strip())
            if len(nums) >= 2:
                delivery["time_min"] = int(nums[0])
                delivery["time_max"] = int(nums[1])
            elif len(nums) == 1:
                delivery["time_min"] = int(nums[0])
                delivery["time_max"] = int(nums[0]) + 10

        min_el = soup.select_one('[class*="min-order"], [class*="minimum"]')
        if min_el:
            nums = re.findall(r'(\d+\.?\d*)', min_el.text.strip())
            if nums:
                delivery["min_order"] = float(nums[0])

        return delivery

    def _parse_coupons(self, soup: BeautifulSoup) -> list:
        coupons = []
        coupon_els = soup.select(
            '[class*="coupon"], [class*="discount"], '
            '[class*="promotion"], [class*="activity"]'
        )
        for el in coupon_els[:10]:
            text = el.text.strip()
            nums = re.findall(r'(\d+\.?\d*)', text)
            if "满" in text and len(nums) >= 2:
                coupons.append({
                    "type": "full_reduction",
                    "threshold": float(nums[0]),
                    "discount": float(nums[1]),
                    "description": text,
                })
            elif "减" in text and nums:
                coupons.append({
                    "type": "direct",
                    "value": float(nums[0]),
                    "description": text,
                })
            elif "免" in text and "配送" in text:
                coupons.append({
                    "type": "delivery_free",
                    "value": 0,
                    "description": text,
                })
        return coupons

    def _make_fallback_result(self, error: str) -> CollectionResult:
        return CollectionResult(
            success=False,
            data={
                "platform": "eleme",
                "platform_name": "饿了么",
                "manual_entry_required": True,
                "message": "自动采集失败，请手动提交链接或使用截图OCR",
                "support_methods": ["link_submit", "screenshot_ocr"],
            },
            error=error,
        )

    async def _collect_shops_crawler(self, location: dict) -> CollectionResult:
        keyword = location.get("keyword", "")
        if not keyword:
            return CollectionResult(
                success=False,
                data={"platform": self.platform, "message": "缺少搜索关键词"},
                error="missing_keyword",
            )
        url = f"https://h5.ele.me/restapi/shopping/v2/restaurants?keyword={keyword}"
        html = await self._page_request(url, wait_ms=3000)
        try:
            data = json.loads(html)
            shops = []
            items = data if isinstance(data, list) else data.get("data", data.get("items", []))
            for item in items:
                shops.append({
                    "shop_id": str(item.get("id", item.get("restaurant_id", ""))),
                    "name": item.get("name", item.get("title", "")),
                    "rating": item.get("rating", item.get("avg_score", 0.0)),
                    "category": item.get("category", item.get("flavors", "")),
                    "address": item.get("address", item.get("short_address", "")),
                })
            if shops:
                return CollectionResult(
                    success=True,
                    data={"platform": self.platform, "shops": shops, "keyword": keyword},
                    source="crawler",
                )
        except (json.JSONDecodeError, KeyError, TypeError):
            pass
        soup = await self._parse_page(html)
        shops = []
        shop_els = soup.select('[class*="restaurant"], [class*="shop"], [class*="store"]')
        for el in shop_els[:20]:
            name_el = el.select_one('[class*="name"], [class*="title"]')
            shops.append({
                "shop_id": "",
                "name": name_el.text.strip() if name_el else "",
                "rating": 0.0,
                "category": "",
                "address": "",
            })
        if shops:
            return CollectionResult(
                success=True,
                data={"platform": self.platform, "shops": shops, "keyword": keyword},
                source="crawler",
            )
        return CollectionResult(
            success=False,
            data={"platform": self.platform, "message": "未找到店铺"},
            error="no_shops_found",
        )

    async def _collect_products_crawler(self, shop_id: str) -> CollectionResult:
        url = f"https://h5.ele.me/shopping/v2/menu?restaurantId={shop_id}"
        return await self.collect_shop_menu(url)

    async def _collect_price_crawler(self, product_id: str) -> CollectionResult:
        return CollectionResult(
            success=False,
            data={"platform": self.platform, "product_id": product_id, "message": "价格需通过店铺菜单获取"},
            error="price_requires_shop_menu",
        )

    async def _collect_coupons_crawler(self) -> CollectionResult:
        try:
            html = await self._page_request(self.base_url, wait_ms=3000)
            soup = await self._parse_page(html)
            coupons = self._parse_coupons(soup)
            if coupons:
                return CollectionResult(
                    success=True,
                    data={"platform": self.platform, "coupons": coupons},
                    source="crawler",
                )
            return CollectionResult(
                success=False,
                data={"platform": self.platform, "message": "未找到优惠券"},
                error="no_coupons_found",
            )
        except Exception as e:
            logger.error("Eleme coupons crawler failed: %s", e)
            return CollectionResult(
                success=False,
                data={"platform": self.platform, "message": f"优惠券采集失败: {e}"},
                error=str(e),
            )

    async def _collect_shops_cache(self, location: dict) -> CollectionResult:
        return CollectionResult(
            success=False,
            data={"platform": self.platform, "message": "缓存未命中"},
            error="cache_miss",
        )

    async def _collect_products_cache(self, shop_id: str) -> CollectionResult:
        return CollectionResult(
            success=False,
            data={"platform": self.platform, "message": "缓存未命中"},
            error="cache_miss",
        )

    async def _collect_price_cache(self, product_id: str) -> CollectionResult:
        return CollectionResult(
            success=False,
            data={"platform": self.platform, "message": "缓存未命中"},
            error="cache_miss",
        )

    async def _collect_coupons_cache(self) -> CollectionResult:
        return CollectionResult(
            success=False,
            data={"platform": self.platform, "message": "缓存未命中"},
            error="cache_miss",
        )

    async def collect_shops(self, location: dict) -> CollectionResult:
        return await self.collect_with_fallback("shops", location=location)

    async def collect_products(self, shop_id: str) -> CollectionResult:
        return await self.collect_with_fallback("products", shop_id=shop_id)

    async def collect_price(self, product_id: str) -> CollectionResult:
        return await self.collect_with_fallback("price", product_id=product_id)

    async def collect_coupons(self) -> CollectionResult:
        return await self.collect_with_fallback("coupons")
