from pydantic import BaseModel, Field
from typing import Optional


class CouponHomeItem(BaseModel):
    id: int
    title: str
    type: str
    value: float
    min_spend: float
    platform: str
    description: str = ""
    expire_time: Optional[str] = None
    is_claimed: bool = False
    remaining_quota: int = 0


class CouponHomeResponse(BaseModel):
    coupons: list[CouponHomeItem]
    total: int


class PlatformActivityItem(BaseModel):
    id: int
    platform: str
    title: str
    description: str = ""
    icon: str = ""
    activity_url: str = ""
    start_time: Optional[str] = None
    end_time: Optional[str] = None


class PlatformActivityResponse(BaseModel):
    activities: list[PlatformActivityItem]
    total: int


class FlashSaleItem(BaseModel):
    id: int
    title: str
    description: str = ""
    discount: float = 0
    platforms: list[str] = Field(default_factory=list)
    start_time: Optional[str] = None
    end_time: Optional[str] = None


class FlashSaleResponse(BaseModel):
    sales: list[FlashSaleItem]
    total: int


class ShopHomeItem(BaseModel):
    id: int
    shop_name: str
    category: str = ""
    rating: float = 0
    image_url: str = ""
    delivery_fee: float = 0
    min_delivery_time: int = 25
    max_delivery_time: int = 45
    prices: dict = Field(default_factory=dict)
    savings: float = 0
    reason: str = ""


class ShopHomeResponse(BaseModel):
    shops: list[ShopHomeItem]
    total: int
