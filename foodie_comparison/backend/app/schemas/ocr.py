from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ProductItem(BaseModel):
    name: str = Field(default="", description="商品名称")
    price: float = Field(default=0.0, description="商品价格")


class DiscountItem(BaseModel):
    type: str = Field(default="", description="优惠类型: full_reduction / direct")
    threshold: Optional[float] = Field(default=None, description="满减门槛金额")
    discount: Optional[float] = Field(default=None, description="满减优惠金额")
    value: Optional[float] = Field(default=None, description="直接抵扣金额")
    description: str = Field(default="", description="优惠描述原文")


class OCRExtractResponse(BaseModel):
    success: bool = Field(description="是否成功提取")
    platform: str = Field(default="unknown", description="平台标识")
    shop_name: str = Field(default="", description="店铺名称")
    products: list[ProductItem] = Field(default_factory=list, description="商品列表")
    delivery_fee: float = Field(default=0.0, description="配送费")
    min_order: float = Field(default=0.0, description="起送价")
    total_amount: float = Field(default=0.0, description="订单总金额")
    discounts: list[DiscountItem] = Field(default_factory=list, description="优惠信息")
    coupons: list[dict] = Field(default_factory=list, description="优惠券信息")
    ocr_lines_count: int = Field(default=0, description="OCR识别行数")
    ocr_enabled: bool = Field(default=False, description="OCR引擎是否可用")
    message: Optional[str] = Field(default=None, description="提示信息")
    filename: Optional[str] = Field(default=None, description="上传文件名")
    extracted_at: str = Field(default="", description="提取时间")


class OCRHealthResponse(BaseModel):
    ocr_available: bool
    confidence_threshold: float
    supported_platforms: list[str]
    engine: str