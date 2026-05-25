import re
import logging

logger = logging.getLogger(__name__)

SENSITIVE_KEYWORDS = [
    "微信官方", "腾讯客服", "系统检测", "封号", "违规",
    "银行卡号", "转账", "打钱", "汇款",
    "身份证号", "密码",
]

AI_DISCLAIMER_PATTERNS = [
    r"作为一个人工智能[，,].*",
    r"我是.{0,10}A[IiI].*",
    r"这是一个A[IiI]生成.*",
    r"请注意.{0,5}是.{0,10}(人工智能|AI|机器人).*",
]


class SafetyFilter:
    def contains_sensitive(self, text: str) -> bool:
        lowered = text.lower()
        for kw in SENSITIVE_KEYWORDS:
            if kw in lowered:
                logger.warning("Sensitive keyword '%s' found", kw)
                return True
        return False

    def clean_reply(self, text: str) -> str:
        for pattern in AI_DISCLAIMER_PATTERNS:
            text = re.sub(pattern, "", text)
        return text.strip()

    def is_risky_intent(self, text: str) -> bool:
        risky = ["我保证", "我承诺", "我一定", "多少钱", "你住哪", "你电话号码"]
        lowered = text.lower()
        return any(kw in lowered for kw in risky)
