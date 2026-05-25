from pydantic import BaseModel, Field
from typing import Optional


class RecommendRequest(BaseModel):
    limit: int = Field(default=10, ge=1, le=50, description="推荐数量")
    platform: Optional[str] = Field(default=None, description="筛选平台")
    recommend_type: str = Field(
        default="shop",
        description="推荐类型: shop / product",
    )


class ShopRecommendItem(BaseModel):
    id: int = Field(default=0)
    shop_name: str = Field(default="")
    category: str = Field(default="")
    rating: float = Field(default=0)
    image_url: str = Field(default="")
    score: float = Field(default=0)
    reason: str = Field(default="")
    is_cold_start: bool = Field(default=False)
    lowest_price: Optional[float] = Field(default=None)
    lowest_platform: Optional[str] = Field(default=None)
    savings: Optional[float] = Field(default=None)
    prices: Optional[dict] = Field(default=None)


class ProductRecommendItem(BaseModel):
    id: int = Field(default=0)
    product_name: str = Field(default="")
    category: str = Field(default="")
    image_url: str = Field(default="")
    score: float = Field(default=0)
    reason: str = Field(default="")
    is_cold_start: bool = Field(default=False)
    avg_price: Optional[float] = Field(default=None)


class RecommendResponse(BaseModel):
    user_id: int
    recommend_type: str
    items: list[dict]
    total: int
    algorithm_version: str = "v1.0"


class BehaviorLogRequest(BaseModel):
    behavior_type: str = Field(
        ...,
        description="行为类型: order / click / view / search / favorite / compare",
    )
    target_type: str = Field(..., description="目标类型: shop / product / coupon")
    target_id: int = Field(..., description="目标ID")
    target_name: str = Field(default="", description="目标名称")
    context: dict = Field(default_factory=dict, description="行为上下文")


class BehaviorLogResponse(BaseModel):
    success: bool
    message: str = ""


class BehaviorItem(BaseModel):
    id: int
    behavior_type: str
    target_type: str
    target_id: int
    target_name: str = ""
    weight: float = 0
    context: dict = Field(default_factory=dict)
    behavior_time: Optional[str] = None


class BehaviorListResponse(BaseModel):
    user_id: int
    behaviors: list[BehaviorItem]
    total: int


class RecommendHistoryItem(BaseModel):
    id: int
    recommend_type: str
    items: list[dict] = Field(default_factory=list)
    algorithm_version: str = ""
    generated_at: Optional[str] = None


class RecommendHistoryResponse(BaseModel):
    user_id: int
    history: list[RecommendHistoryItem]
    total: int