import re
from collections import Counter


class TextPreprocessor:
    def __init__(self):
        self._stopwords = self._load_stopwords()

    def _load_stopwords(self) -> set:
        base = {
            "的", "了", "在", "是", "我", "有", "和", "就", "不", "人",
            "都", "一", "一个", "上", "也", "很", "到", "说", "要", "去",
            "你", "会", "着", "没有", "看", "好", "自己", "这", "他", "她",
            "它", "们", "那", "些", "什么", "怎么", "如何", "可以", "因为",
            "所以", "但是", "而且", "或者", "如果", "虽然", "已经", "还是",
            "又", "把", "被", "让", "给", "从", "向", "对", "与", "及",
            "等", "之", "其", "此", "该", "每", "各", "中", "里", "外",
            "前", "后", "左", "右", "上", "下", "多", "少", "大", "小",
        }
        return base

    def clean_text(self, text: str) -> str:
        if not text:
            return ""

        text = re.sub(r"<[^>]+>", "", text)
        text = re.sub(r"https?://\S+", "", text)
        text = re.sub(r"[\r\n\t]+", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        text = re.sub(r"[^\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\w\s.,!?;:，。！？；：、（）()%\-+]", "", text)

        return text

    def extract_keywords(self, text: str, top_k: int = 10) -> list[str]:
        cleaned = self.clean_text(text)
        if not cleaned:
            return []

        words = self._simple_tokenize(cleaned)
        filtered = [w for w in words if w not in self._stopwords and len(w) >= 2]

        counter = Counter(filtered)
        return [word for word, _ in counter.most_common(top_k)]

    def _simple_tokenize(self, text: str) -> list[str]:
        segments = re.findall(r"[\u4e00-\u9fff]{2,}|[a-zA-Z]{2,}|\d+(?:\.\d+)?", text)
        bigrams = []
        for seg in segments:
            if re.match(r"[\u4e00-\u9fff]+", seg):
                for i in range(len(seg) - 1):
                    bigrams.append(seg[i : i + 2])
                if len(seg) >= 3:
                    for i in range(len(seg) - 2):
                        bigrams.append(seg[i : i + 3])
            else:
                bigrams.append(seg)
        return bigrams

    def detect_financial_entities(self, text: str) -> dict:
        entities = {
            "companies": [],
            "amounts": [],
            "percentages": [],
            "keywords": [],
        }

        amount_patterns = [
            r"(\d+(?:\.\d+)?)\s*(?:亿|万|千万|百万|千亿)",
            r"(?:约|超|近|达|超)\s*(\d+(?:\.\d+)?)\s*(?:亿|万)",
        ]
        for pattern in amount_patterns:
            matches = re.findall(pattern, text)
            entities["amounts"].extend(matches)

        pct_patterns = [
            r"(\d+(?:\.\d+)?)\s*%",
            r"(?:增长|下降|上升|下跌|涨幅|跌幅)\s*(\d+(?:\.\d+)?)\s*(?:个百分点|%)",
        ]
        for pattern in pct_patterns:
            matches = re.findall(pattern, text)
            entities["percentages"].extend(matches)

        financial_keywords = [
            "营收", "净利润", "毛利率", "ROE", "ROA", "资产负债率",
            "现金流", "分红", "派息", "回购", "增持", "减持", "质押",
            "解禁", "定增", "配股", "可转债", "并购", "重组",
            "立案", "处罚", "警示", "问询函", "关注函",
            "涨停", "跌停", "停牌", "复牌", "退市",
            "业绩预告", "业绩快报", "年报", "季报", "半年报",
        ]
        for kw in financial_keywords:
            if kw in text:
                entities["keywords"].append(kw)

        return entities


preprocessor = TextPreprocessor()
