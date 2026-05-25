from app.models.user import User, UserPreference
from app.models.shop import Shop, ShopPlatformLink
from app.models.product import Product, CrossPlatformProduct
from app.models.price import PriceSnapshot, DeliveryFeeSnapshot
from app.models.coupon import Coupon, CouponType, UserCoupon
from app.models.order import OrderHistory
from app.models.platform import PlatformActivity, FlashSale
from app.models.recommend import UserBehavior, RecommendResult

__all__ = [
    "User", "UserPreference",
    "Shop", "ShopPlatformLink",
    "Product", "CrossPlatformProduct",
    "PriceSnapshot", "DeliveryFeeSnapshot",
    "Coupon", "CouponType", "UserCoupon",
    "OrderHistory",
    "PlatformActivity", "FlashSale",
    "UserBehavior", "RecommendResult",
]