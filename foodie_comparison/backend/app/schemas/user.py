from pydantic import BaseModel, Field


class PreferenceUpdate(BaseModel):
    cuisine_weights: dict = Field(default_factory=dict)
    taste_weights: dict = Field(default_factory=dict)
    avg_order_amount: float = 0.0
    price_sensitivity: float = Field(default=0.5, ge=0.0, le=1.0)
    preferred_platforms: list[str] = Field(default_factory=list)
    preferred_delivery_time: int = 30


class PreferenceResponse(BaseModel):
    cuisine_weights: dict
    taste_weights: dict
    avg_order_amount: float
    price_sensitivity: float
    preferred_platforms: list[str]
    preferred_delivery_time: int
    updated_at: str | None = None

    model_config = {"from_attributes": True}


class OrderHistoryItem(BaseModel):
    id: int
    shop_id: int
    shop_name: str
    platform: str
    order_amount: float
    actual_amount: float
    savings: float
    order_time: str

    model_config = {"from_attributes": True}


class OrderHistoryList(BaseModel):
    items: list[OrderHistoryItem]
    total_savings: float = 0.0