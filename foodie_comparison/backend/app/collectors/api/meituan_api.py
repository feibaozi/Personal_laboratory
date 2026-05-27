import hashlib
import time
import logging
import httpx

logger = logging.getLogger(__name__)


class MeituanAPIClient:
    def __init__(self, app_key: str, app_secret: str):
        self.app_key = app_key
        self.app_secret = app_secret
        self.base_url = "https://openapi.meituan.com"

    def _sign(self, params: dict) -> str:
        sorted_params = sorted(params.items())
        raw = "&".join(f"{k}={v}" for k, v in sorted_params)
        raw += f"&app_secret={self.app_secret}"
        return hashlib.md5(raw.encode()).hexdigest()

    async def _request(self, path: str, params: dict) -> dict:
        params["app_key"] = self.app_key
        params["timestamp"] = int(time.time())
        params["sign"] = self._sign(params)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{self.base_url}{path}", params=params)
            response.raise_for_status()
            return response.json()

    async def search_shops(self, keyword: str, city: str = "北京", page: int = 1, page_size: int = 20) -> dict:
        return await self._request("/api/poi/search", {
            "keyword": keyword, "city": city, "page": page, "page_size": page_size,
        })

    async def get_menu(self, shop_id: str) -> dict:
        return await self._request("/api/poi/menu", {"shop_id": shop_id})

    async def get_coupons(self, shop_id: str = None) -> dict:
        params = {}
        if shop_id:
            params["shop_id"] = shop_id
        return await self._request("/api/coupon/list", params)
