import hashlib
import time
import logging
import httpx

logger = logging.getLogger(__name__)


class MeituanAPIClient:
    def __init__(self, app_key: str = None, app_secret: str = None, token: str = None):
        self.app_key = app_key
        self.app_secret = app_secret
        self.token = token
        self.base_url = "https://waimaiopen.meituan.com"
        self.cater_base_url = "https://api-open-cater.meituan.com"
        self._use_token_auth = bool(token)

    def _sign(self, params: dict) -> str:
        sorted_params = sorted(params.items())
        raw = "&".join(f"{k}={v}" for k, v in sorted_params if v is not None)
        raw += f"&app_secret={self.app_secret}"
        return hashlib.md5(raw.encode()).hexdigest()

    async def _request(self, path: str, params: dict, method: str = "GET", base_url: str = None) -> dict:
        url = f"{base_url or self.base_url}{path}"
        
        headers = {}
        
        if self._use_token_auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
            headers["Content-Type"] = "application/json"
        else:
            params["app_id"] = self.app_key
            params["timestamp"] = int(time.time())
            params["sig"] = self._sign(params)
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                if method == "POST":
                    if self._use_token_auth:
                        response = await client.post(url, json=params, headers=headers)
                    else:
                        response = await client.post(url, data=params)
                else:
                    response = await client.get(url, params=params, headers=headers)
                
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                logger.error(f"HTTP error {e.response.status_code}: {e.response.text}")
                return {"code": "HTTP_ERROR", "data": [], "msg": str(e), "status_code": e.response.status_code}
            except Exception as e:
                logger.error(f"Request failed: {e}")
                return {"code": "FAIL", "data": [], "msg": str(e)}

    async def search_shops(self, keyword: str, city: str = "北京", 
                            latitude: float = None, longitude: float = None,
                            page: int = 1, page_size: int = 20) -> dict:
        """搜索商家列表"""
        params = {
            "keyword": keyword,
            "city": city,
            "page": page,
            "page_size": page_size,
        }
        if latitude:
            params["latitude"] = latitude
        if longitude:
            params["longitude"] = longitude
        
        return await self._request("/api/v1/poi/search", params)

    async def get_shop_detail(self, poi_id: str) -> dict:
        """获取商家详情"""
        return await self._request("/api/v1/poi/detail", {"poi_id": poi_id})

    async def get_food_list(self, app_poi_code: str, offset: int = 0, limit: int = 50) -> dict:
        """获取菜品列表（新版，包含套餐）"""
        params = {
            "app_poi_code": app_poi_code,
            "offset": offset,
            "limit": min(limit, 200),
        }
        return await self._request("/gw/api/v1/food/listAll", params, method="POST")

    async def get_coupons(self, poi_id: str = None) -> dict:
        """获取优惠券列表"""
        params = {}
        if poi_id:
            params["poi_id"] = poi_id
        
        return await self._request("/api/v1/coupon/list", params)

    async def get_delivery_info(self, poi_id: str, user_lat: float, user_lng: float) -> dict:
        """获取配送信息（配送费、预计时间）"""
        return await self._request(
            "/api/v1/delivery/info",
            {"poi_id": poi_id, "latitude": user_lat, "longitude": user_lng}
        )
    
    async def test_connection(self) -> dict:
        """测试API连接状态"""
        try:
            if self._use_token_auth:
                response = await self._request("/api/v1/poi/search", {"keyword": "test", "city": "北京", "page_size": 1})
            else:
                response = await self._request("/api/v1/poi/search", {"keyword": "test", "city": "北京", "page_size": 1})
            return {
                "success": response.get("code") == "OP_SUCCESS",
                "message": response.get("msg", "Unknown"),
                "data": response.get("data", {}),
            }
        except Exception as e:
            return {"success": False, "message": str(e)}