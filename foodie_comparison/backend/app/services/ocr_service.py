import logging
import re
from datetime import datetime, timezone
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)

_ocr_engine = None
OCR_AVAILABLE = False

try:
    from paddleocr import PaddleOCR
    _ocr_engine = PaddleOCR(
        lang="ch",
        use_angle_cls=True,
        show_log=False,
        use_gpu=settings.ocr_use_gpu,
    )
    OCR_AVAILABLE = True
    logger.info("PaddleOCR initialized successfully")
except ImportError:
    logger.warning("PaddleOCR not installed, OCR features will be disabled")
except Exception as e:
    logger.warning("PaddleOCR initialization failed: %s, OCR features disabled", e)


PLATFORM_PATTERNS = {
    "meituan": {
        "shop_indicators": ["店", "餐厅", "小吃", "面馆", "火锅", "烧烤"],
        "price_prefix": ["¥", "￥", "元"],
        "total_keywords": ["合计", "总计", "实付", "订单总价", "应付"],
        "delivery_keywords": ["配送费", "配送", "运费", "外送费"],
        "discount_keywords": ["满减", "优惠", "折扣", "减免", "红包", "满", "减"],
        "min_order_keywords": ["起送", "最低消费"],
    },
    "eleme": {
        "shop_indicators": ["店", "餐厅", "小吃", "面馆", "火锅", "烧烤"],
        "price_prefix": ["¥", "￥", "元"],
        "total_keywords": ["合计", "总计", "实付", "订单总价", "应付"],
        "delivery_keywords": ["配送费", "配送", "运费"],
        "discount_keywords": ["满减", "优惠", "折扣", "减免", "红包", "津贴", "满", "减"],
        "min_order_keywords": ["起送", "最低消费"],
    },
    "jd_waimai": {
        "shop_indicators": ["店", "餐厅", "小吃", "面馆", "火锅", "烧烤"],
        "price_prefix": ["¥", "￥", "元"],
        "total_keywords": ["合计", "总计", "实付", "订单总价", "应付", "实付金额"],
        "delivery_keywords": ["配送费", "配送", "运费", "快递费"],
        "discount_keywords": ["满减", "优惠", "折扣", "减免", "优惠券", "满", "减"],
        "min_order_keywords": ["起送", "最低消费"],
    },
    "douyin_waimai": {
        "shop_indicators": ["店", "餐厅", "小吃", "面馆", "火锅", "烧烤"],
        "price_prefix": ["¥", "￥", "元"],
        "total_keywords": ["合计", "总计", "实付", "订单总价", "应付"],
        "delivery_keywords": ["配送费", "配送", "运费"],
        "discount_keywords": ["满减", "优惠", "折扣", "减免", "团购优惠", "满", "减"],
        "min_order_keywords": ["起送", "最低消费"],
    },
}


class OCRService:
    def __init__(self):
        self.available = OCR_AVAILABLE
        self.confidence_threshold = settings.ocr_confidence_threshold

    def extract_from_image(
        self, image_path: str, platform: str = "unknown"
    ) -> dict:
        if not self.available:
            return self._fallback_result(image_path, platform)

        try:
            raw_result = _ocr_engine.ocr(image_path, cls=True)
            lines = self._parse_ocr_output(raw_result)
            return self._structure_lines(lines, platform)
        except Exception as e:
            logger.error("OCR extraction failed: %s", e)
            return self._fallback_result(image_path, platform)

    def extract_from_bytes(
        self, image_bytes: bytes, platform: str = "unknown"
    ) -> dict:
        import tempfile
        import os

        with tempfile.NamedTemporaryFile(
            delete=False, suffix=".png",
        ) as tmp:
            tmp.write(image_bytes)
            tmp_path = tmp.name

        try:
            return self.extract_from_image(tmp_path, platform)
        finally:
            os.unlink(tmp_path)

    def _parse_ocr_output(self, raw_result: list) -> list:
        lines = []
        if not raw_result:
            return lines

        for group in raw_result:
            if not group:
                continue
            for line in group:
                if len(line) < 2:
                    continue
                text = str(line[1][0]).strip()
                confidence = float(line[1][1])
                position = line[0] if len(line) > 0 else []

                if confidence >= self.confidence_threshold and text:
                    lines.append({
                        "text": text,
                        "confidence": round(confidence, 4),
                        "position": position,
                        "y_center": (
                            (position[0][1] + position[2][1]) / 2
                            if len(position) >= 4 else 0
                        ),
                    })

        lines.sort(key=lambda x: x["y_center"])
        return lines

    def _structure_lines(self, lines: list, platform: str) -> dict:
        patterns = PLATFORM_PATTERNS.get(platform, PLATFORM_PATTERNS["meituan"])

        shop_name = ""
        products = []
        delivery_fee = 0.0
        min_order = 0.0
        total_amount = 0.0
        discounts = []
        coupons = []

        used_indices = set()

        for i, line in enumerate(lines):
            if i in used_indices:
                continue
            text = line["text"]

            if not shop_name:
                shop_name = self._try_extract_shop_name(text, patterns)
                if shop_name:
                    used_indices.add(i)
                    continue

            if self._matches_keywords(text, patterns["total_keywords"]):
                amount = self._extract_price(text)
                if amount > 0:
                    total_amount = amount
                    used_indices.add(i)
                    continue

            if self._matches_keywords(text, patterns["delivery_keywords"]):
                fee = self._extract_price(text)
                if fee >= 0:
                    delivery_fee = fee
                    used_indices.add(i)
                    continue

            if self._matches_keywords(text, patterns["min_order_keywords"]):
                amount = self._extract_price(text)
                if amount > 0:
                    min_order = amount
                    used_indices.add(i)
                    continue

            if self._matches_keywords(text, patterns["discount_keywords"]):
                discount = self._try_extract_discount(text)
                if discount:
                    discounts.append(discount)
                    used_indices.add(i)
                    continue

        for i, line in enumerate(lines):
            if i in used_indices:
                continue
            text = line["text"]
            product = self._try_extract_product(text)
            if product:
                products.append(product)

        return {
            "success": True,
            "platform": platform,
            "shop_name": shop_name,
            "products": products[:50],
            "delivery_fee": delivery_fee,
            "min_order": min_order,
            "total_amount": total_amount,
            "discounts": discounts,
            "coupons": coupons,
            "ocr_lines_count": len(lines),
            "ocr_enabled": True,
            "extracted_at": datetime.now(timezone.utc).isoformat(),
        }

    def _try_extract_shop_name(self, text: str, patterns: dict) -> str:
        for indicator in patterns["shop_indicators"]:
            if indicator in text:
                cleaned = re.sub(r'[【】\[\]()（）]', '', text).strip()
                if 2 <= len(cleaned) <= 50:
                    return cleaned
        return ""

    def _matches_keywords(self, text: str, keywords: list) -> bool:
        return any(kw in text for kw in keywords)

    def _extract_price(self, text: str) -> float:
        text = text.replace("免费", "0").replace("免", "0")
        nums = re.findall(r'(\d+\.?\d*)', text)
        if nums:
            try:
                return float(nums[-1])
            except ValueError:
                return 0.0
        return 0.0

    def _try_extract_product(self, text: str) -> Optional[dict]:
        price_match = re.search(
            r'(.+?)\s*[¥￥]\s*(\d+\.?\d*)', text
        )
        if price_match:
            name = price_match.group(1).strip()
            price = float(price_match.group(2))
            if name and price > 0 and len(name) <= 50:
                return {"name": name, "price": price}

        parts = re.split(r'\s{2,}|\t', text)
        if len(parts) >= 2:
            name = parts[0].strip()
            price_match = re.search(r'(\d+\.?\d*)', parts[-1])
            if price_match and name and len(name) <= 50:
                price = float(price_match.group(1))
                if price > 0:
                    return {"name": name, "price": price}

        return None

    def _try_extract_discount(self, text: str) -> Optional[dict]:
        full_reduction = re.search(
            r'满(\d+\.?\d*)\s*[减让优惠\-—]\s*(\d+\.?\d*)', text
        )
        if full_reduction:
            return {
                "type": "full_reduction",
                "threshold": float(full_reduction.group(1)),
                "discount": float(full_reduction.group(2)),
                "description": text,
            }

        direct = re.search(
            r'(?:减|优惠|折扣|立减)\s*(\d+\.?\d*)', text
        )
        if direct:
            return {
                "type": "direct",
                "value": float(direct.group(1)),
                "description": text,
            }

        nums = re.findall(r'(\d+\.?\d*)', text)
        if len(nums) >= 2:
            return {
                "type": "full_reduction",
                "threshold": float(nums[0]),
                "discount": float(nums[1]),
                "description": text,
            }

        return None

    def _fallback_result(self, image_path: str, platform: str) -> dict:
        return {
            "success": False,
            "platform": platform,
            "shop_name": "",
            "products": [],
            "delivery_fee": 0.0,
            "min_order": 0.0,
            "total_amount": 0.0,
            "discounts": [],
            "coupons": [],
            "ocr_lines_count": 0,
            "ocr_enabled": False,
            "message": "OCR 服务未安装，请手动输入价格信息",
            "support_methods": ["manual_input", "link_submit"],
            "extracted_at": datetime.now(timezone.utc).isoformat(),
        }

    def check_health(self) -> dict:
        return {
            "ocr_available": self.available,
            "confidence_threshold": self.confidence_threshold,
            "supported_platforms": list(PLATFORM_PATTERNS.keys()),
            "engine": "PaddleOCR" if self.available else "none",
        }


ocr_service = OCRService()