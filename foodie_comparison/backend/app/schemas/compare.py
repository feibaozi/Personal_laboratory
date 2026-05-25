from pydantic import BaseModel, Field
from typing import Optional


class CompareProductRequest(BaseModel):
    product_name: str = Field(..., description="商品名称关键词")
    platforms: list[str] = Field(
        default=["meituan", "eleme", "jd_waimai", "douyin_waimai"],
        description="要比较的平台列表",
    )
    user_coupons: list[dict] = Field(
        default_factory=list,
        description="用户优惠券列表 [{platform, value, min_spend}]",
    )


class PlatformPriceDetail(BaseModel):
    platform: str
    platform_name: str
    product_name: str = ""
    shop_name: str = ""
    base_price: float = 0
    package_fee: float = 0
    delivery_fee: float = 0
    min_order_amount: float = 0
    discounts: list[dict] = Field(default_factory=list)
    original_total: float = 0
    final_price: float = 0
    savings: float = 0
    source: str = ""
    recorded_at: Optional[str] = None
    is_best_price: bool = False


class CompareProductResponse(BaseModel):
    product_name: str
    results: list[PlatformPriceDetail]
    best_platform: str = ""
    best_price: float = 0
    max_savings: float = 0


class CompareShopDetail(BaseModel):
    platform: str
    platform_name: str
    shop_name: str
    platform_shop_id: str = ""
    platform_url: str = ""
    delivery_fee: float = 0
    min_order: float = 0
    rating: float = 0


class CompareShopResponse(BaseModel):
    shop_name: str
    results: list[CompareShopDetail]


class SavingRankItem(BaseModel):
    rank: int
    product_name: str
    shop_name: str = ""
    prices: dict
    lowest_price: float
    lowest_platform: str
    lowest_platform_name: str
    highest_price: float
    savings: float


class SavingRankResponse(BaseModel):
    items: list[SavingRankItem]
    total: int