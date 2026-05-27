import hashlib
import time
import logging
import httpx

logger = logging.getLogger(__name__)


class ElemeAPIClient:
    def __init__(self, app_key: str, app_secret: str):
        self.app_key = app_key
        self.app_secret = app_secret
        self.base_url = "https://open.shop.ele.me/api"

    def _sign(self, params: dict) -> str:
        sorted_params = sorted(params.items())
        raw = "&".join(f"{k}={v}" for k, v in sorted_params)
        raw += f"&secret={self.app_secret}"
        return hashlib.sha256(raw.encode()).hexdigest()

    async def _request(self, path: str, params: dict) -> dict:
        params["appKey"] = self.app_key
        params["timestamp"] = int(time.time())
        params["sign"] = self._sign(params)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{self.base_url}{path}", params=params)
            response.raise_for_status()
            return response.json()

    async def search_shops(self, keyword: str, latitude: float = 39.98, longitude: float = 116.45, limit: int = 20) -> dict:
        return await self._request("/shopping/v2/restaurants", {
            "keyword": keyword, "latitude": latitude, "longitude": longitude, "limit": limit,
        })

    async def get_menu(self, restaurant_id: str) -> dict:
        return await self._request("/shopping/v2/menu", {"restaurantId": restaurant_id})

    async def get_coupons(self, restaurant_id: str = None) -> dict:
        params = {}
        if restaurant_id:
            params["restaurantId"] = restaurant_id
        return await self._request("/coupon/list", params)
