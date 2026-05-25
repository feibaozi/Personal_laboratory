import json
import re
import logging
from datetime import datetime
from typing import Optional

from bs4 import BeautifulSoup

from .base_collector import BaseCollector, CollectionResult

logger = logging.getLogger(__name__)


class MeituanCollector(BaseCollector):
    platform = "meituan"
    base_url = "https://i.meituan.com"

    def __init__(self):
        super().__init__()
        self._platform_headers = {
            "Referer": "https://i.meituan.com/",
            "Origin": "https://i.meituan.com",
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
                    "platform": "meituan",
                    "platform_name": "美团",
                    "shop": shop_info,
                    "products": products,
                    "delivery": delivery_info,
                    "coupons": coupons,
                    "source_url": shop_url,
                },
                source="playwright",
            )
        except Exception as e:
            logger.error("Meituan collection failed: %s", e)
            return self._make_fallback_result(str(e))

    def _parse_shop_info(self, soup: BeautifulSoup) -> dict:
        info = {}

        selectors = [
            '[data-name]', '.shop-name', '.poi-name', 'h1',
            '[class*="shop-name"]', '[class*="restaurant-name"]',
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
            '[data-rating]', '.rating', '.star', '.score',
            '[class*="rating"]', '[class*="star"]',
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

        category_el = soup.select_one('[class*="category"], [class*="tag"], .category')
        if category_el:
            info["category"] = category_el.text.strip()

        return info

    def _parse_products(self, soup: BeautifulSoup) -> list:
        products = []

        item_selectors = [
            '[data-item]', '.dish-item', '.menu-item', '.food-item',
            '[class*="food-item"]', '[class*="dish"]', '.product-item',
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
                item.select_one('.dish-name, .name, .food-name')
                or item.select_one('[class*="name"]')
            )
            price_el = (
                item.select_one('.price, .dish-price, .food-price')
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
            '[data-delivery], .delivery-fee, [class*="delivery-fee"], '
            '[class*="shipping-fee"]'
        )
        if fee_el:
            nums = re.findall(r'(\d+\.?\d*)', fee_el.text.strip())
            if nums:
                delivery["fee"] = float(nums[0])

        time_el = soup.select_one(
            '[data-delivery-time], .delivery-time, [class*="delivery-time"]'
        )
        if time_el:
            nums = re.findall(r'(\d+)', time_el.text.strip())
            if len(nums) >= 2:
                delivery["time_min"] = int(nums[0])
                delivery["time_max"] = int(nums[1])
            elif len(nums) == 1:
                delivery["time_min"] = int(nums[0])
                delivery["time_max"] = int(nums[0]) + 10

        min_el = soup.select_one(
            '[data-min-order], .min-order, [class*="min-order"], '
            '[class*="minimum"]'
        )
        if min_el:
            nums = re.findall(r'(\d+\.?\d*)', min_el.text.strip())
            if nums:
                delivery["min_order"] = float(nums[0])

        return delivery

    def _parse_coupons(self, soup: BeautifulSoup) -> list:
        coupons = []
        coupon_els = soup.select(
            '.coupon, [class*="coupon"], [class*="discount"], '
            '[class*="promotion"]'
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
            elif nums:
                coupons.append({
                    "type": "direct",
                    "value": float(nums[0]),
                    "description": text,
                })
        return coupons

    def _make_fallback_result(self, error: str) -> CollectionResult:
        return CollectionResult(
            success=False,
            data={
                "platform": "meituan",
                "platform_name": "美团",
                "manual_entry_required": True,
                "message": "自动采集失败，请手动复制店铺链接或使用截图OCR",
                "support_methods": ["link_submit", "screenshot_ocr"],
            },
            error=error,
        )

    async def collect_shops(self, location: dict) -> CollectionResult:
        return CollectionResult(
            success=False,
            data={
                "platform": "meituan",
                "message": "店铺搜索需通过用户提交链接或已知店铺列表",
            },
        )

    async def collect_products(self, shop_id: str) -> CollectionResult:
        url = f"{self.base_url}/catering/dish/detail?shopId={shop_id}"
        return await self.collect_shop_menu(url)

    async def collect_price(self, product_id: str) -> CollectionResult:
        return CollectionResult(
            success=False,
            data={
                "platform": "meituan",
                "message": "价格信息需通过采集店铺菜单获取",
            },
        )

    async def collect_coupons(self) -> CollectionResult:
        return CollectionResult(
            success=False,
            data={
                "platform": "meituan",
                "message": "优惠券信息需通过用户登录态采集",
            },
        )