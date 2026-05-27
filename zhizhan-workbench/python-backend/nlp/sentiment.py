import re
from nlp.preprocessor import preprocessor


class SentimentClassifier:
    def __init__(self):
        self._positive_words = {
            "增长", "上涨", "利好", "突破", "新高", "超预期", "强劲",
            "盈利", "盈利增长", "大幅增长", "翻倍", "暴涨", "大涨",
            "反弹", "回升", "回暖", "改善", "优化", "提升", "加速",
            "领先", "优势", "创新", "机遇", "看好", "推荐", "买入",
            "增持", "分红", "回购", "高增长", "稳健", "扩张",
            "超预期", "超市场预期", "业绩亮眼", "景气", "繁荣",
        }

        self._negative_words = {
            "下跌", "下滑", "利空", "亏损", "暴跌", "大跌", "跳水",
            "衰退", "萎缩", "恶化", "下降", "减少", "下滑", "低迷",
            "风险", "危机", "违约", "退市", "停牌", "处罚", "立案",
            "调查", "减持", "质押", "爆仓", "清仓", "割肉",
            "暴雷", "暴雷风险", "债务危机", "资金链断裂",
            "问询函", "关注函", "警示", "违规", "造假",
            "低于预期", "不及预期", "业绩下滑", "亏损扩大",
        }

        self._intensifiers = {
            "大幅": 1.5, "急剧": 1.8, "显著": 1.4, "明显": 1.3,
            "严重": 1.6, "持续": 1.3, "大幅": 1.5, "暴": 1.8,
            "狂": 1.8, "猛": 1.7, "超": 1.4, "远超": 1.6,
        }

        self._negation_words = {"不", "未", "非", "无", "没", "难以", "未能"}

        self._alert_keywords = {
            "立案调查", "行政处罚", "退市风险", "财务造假",
            "资金链断裂", "债务违约", "大股东减持", "强制平仓",
            "被ST", "被*ST", "停牌核查", "监管处罚",
        }

    def classify(self, text: str) -> dict:
        cleaned = preprocessor.clean_text(text)
        if not cleaned:
            return {
                "sentiment": "neutral",
                "score": 0.5,
                "confidence": 0.0,
                "positive_count": 0,
                "negative_count": 0,
                "is_alert": False,
                "alert_type": None,
            }

        positive_hits = self._count_sentiment_words(cleaned, self._positive_words)
        negative_hits = self._count_sentiment_words(cleaned, self._negative_words)

        positive_score = self._calculate_score(cleaned, positive_hits)
        negative_score = self._calculate_score(cleaned, negative_hits)

        total = positive_score + negative_score
        if total == 0:
            sentiment = "neutral"
            score = 0.5
            confidence = 0.0
        elif positive_score > negative_score:
            sentiment = "positive"
            score = 0.5 + (positive_score - negative_score) / (2 * total)
            confidence = min(positive_score / max(total, 1), 1.0)
        else:
            sentiment = "negative"
            score = 0.5 - (negative_score - positive_score) / (2 * total)
            confidence = min(negative_score / max(total, 1), 1.0)

        score = max(0.0, min(1.0, score))

        is_alert, alert_type = self._check_alert(cleaned)

        return {
            "sentiment": sentiment,
            "score": round(score, 3),
            "confidence": round(confidence, 3),
            "positive_count": len(positive_hits),
            "negative_count": len(negative_hits),
            "is_alert": is_alert,
            "alert_type": alert_type,
        }

    def _count_sentiment_words(self, text: str, word_set: set) -> list:
        hits = []
        for word in word_set:
            if word in text:
                hits.append(word)
        return hits

    def _calculate_score(self, text: str, hits: list) -> float:
        score = 0.0
        for word in hits:
            word_score = 1.0
            for intensifier, multiplier in self._intensifiers.items():
                pattern = intensifier + word
                if pattern in text:
                    word_score *= multiplier
                    break

            window = 4
            idx = text.find(word)
            if idx > 0:
                prefix = text[max(0, idx - window) : idx]
                for neg in self._negation_words:
                    if neg in prefix:
                        word_score *= -0.5
                        break

            score += word_score

        return abs(score)

    def _check_alert(self, text: str) -> tuple[bool, str | None]:
        for keyword in self._alert_keywords:
            if keyword in text:
                return True, keyword
        return False, None


sentiment_classifier = SentimentClassifier()
