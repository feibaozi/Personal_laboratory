# Foodie Comparison - 真实数据接入方案与效果预期

## 一、项目现状分析

### 1.1 现有架构

```
┌──────────────────────────────────────────────────────────────────┐
│                        Flutter App (前端)                         │
│  lib/pages/    lib/providers/    lib/services/    lib/widgets/   │
└──────────────────────────┬───────────────────────────────────────┘
                           │ REST API
┌──────────────────────────▼───────────────────────────────────────┐
│                     FastAPI Backend                               │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │   Routers   │  │   Services   │  │      Collectors        │  │
│  │  auth.py    │  │  auth.py     │  │  base_collector.py     │  │
│  │  user.py    │  │  compare.py  │  │  meituan_collector.py  │  │
│  │  ocr.py     │  │  ocr.py      │  │  eleme_collector.py    │  │
│  │  compare.py │  │  recommend.py│  │  jd_collector.py       │  │
│  │  recommend.py│  │  user.py    │  │  douyin_collector.py   │  │
│  └─────────────┘  └──────────────┘  │  coupon_collector.py   │  │
│                                      │  proxy_pool.py         │  │
│  ┌──────────────────────────────┐   └────────────────────────┘  │
│  │        Celery Tasks          │                                │
│  │  price_sync.py               │                                │
│  │  coupon_sync.py              │                                │
│  │  platform_sync.py            │                                │
│  │  recommend_rebuild.py        │                                │
│  └──────────────────────────────┘                                │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 当前数据来源

| 模块 | 当前状态 | 数据来源 |
|------|---------|---------|
| 首页推荐 | Mock 数据 | `mockRecommendedShops`、`mockCoupons` 等 |
| 比价结果 | Mock 数据 | `mockSavingRank` |
| 优惠券 | Mock 数据 | `mockCoupons` |
| 平台活动 | Mock 数据 | `mockPlatformActivities` |
| 限时特惠 | Mock 数据 | `mockFlashSales` |
| 推荐引擎 | 冷启动兜底 | 仅基于评分排序，无真实行为数据 |

### 1.3 采集器已具备的基础能力

所有采集器已实现**爬虫模式**的以下能力：
- ✅ Playwright 无头浏览器 + 反检测脚本
- ✅ 请求频率限制 + 指数退避重试
- ✅ Proxy 代理池管理 (Redis 存储)
- ✅ 多层 CSS Selector 容错解析
- ✅ 从纯文本正则提取商品/价格兜底
- ✅ fallback 降级机制（采集失败→提示用户手动提交/OCR）

---

## 二、分阶段接入方案

### 阶段一：基础数据注入（第1-2周）

**目标**：用真实静态数据替换全部 Mock 数据，让 App 展示真实内容。

#### 2.1.1 准备种子数据

```sql
-- 在 seed_data.py 中扩展真实店铺和商品数据
-- 示例：北京朝阳区知名外卖店铺
INSERT INTO shops (name, category, rating, image_url) VALUES
  ('麦当劳(朝阳大悦城店)', '快餐', 4.6, '...'),
  ('吉野家(双井店)', '日式', 4.4, '...'),
  ('西贝莜面村(三里屯店)', '西北菜', 4.7, '...');
```

**数据来源**：
- 美团/饿了么公开发布的店铺信息
- 平台公开 API 可获取的基础数据
- 团队成员手动录入的热门商圈店铺

#### 2.1.2 价格快照初始化

```python
# seed_data.py - 为每个跨平台商品生成初始价格快照
for product in products:
    for platform in ["meituan", "eleme"]:
        db.add(PriceSnapshot(
            product_id=product.id,
            platform=platform,
            base_price=random_price(base=product.base_price, variation=0.15),
            delivery_fee=random.randint(0, 5),
            package_fee=random.randint(1, 3),
            discount_info=json.dumps(random_discounts()),
            source="seed_data",
        ))
```

#### 2.1.3 优惠券种子数据

```python
# 真实平台常见优惠券类型
coupons = [
    {"platform": "meituan", "type": "full_reduction", "threshold": 30, "value": 5},
    {"platform": "eleme", "type": "full_reduction", "threshold": 25, "value": 4},
    {"platform": "meituan", "type": "delivery_free", "value": 0},
    {"platform": "eleme", "type": "direct", "value": 8},
]
```

### 阶段二：爬虫采集打通（第3-4周）

**目标**：通过自动化采集获取真实价格，配合 OCR 和用户提交链接。

#### 2.2.1 采集调度优化

**当前问题**：采集器 `collect_shops()`、`collect_price()`、`collect_coupons()` 均返回空结果或 fallback，未真正调用平台页面。

**改造方案**：在 `BaseCollector` 中增加调度策略：

```python
# base_collector.py - 新增混合调度
class CollectionStrategy:
    API = "api"           # 官方 API
    CRAWLER = "crawler"   # 爬虫采集
    OCR = "ocr"           # 截图 OCR
    MANUAL = "manual"     # 用户手动提交
    CACHE = "cache"       # 缓存数据

class BaseCollector:
    # 新增：采集策略优先级
    strategy_order: list[str] = ["api", "crawler", "cache", "manual"]

    async def collect_with_fallback(self, method: str, **kwargs) -> CollectionResult:
        """按优先级尝试多种采集方式"""
        for strategy in self.strategy_order:
            result = await self._try_collect(strategy, method, **kwargs)
            if result.success:
                return result
        return self._make_fallback_result("所有采集方式均失败")
```

#### 2.2.2 店铺 URL 采集链路

```
用户输入店铺名称
    │
    ▼
┌─────────────────────────────┐
│ 1. 搜索 API (如果有)         │  ← 美团开放平台 / 饿了么开放平台
│    搜索店铺 → 获取 shop_id   │
└──────────┬──────────────────┘
           │ 失败时降级
           ▼
┌─────────────────────────────┐
│ 2. Playwright 爬虫          │
│    a. 打开搜索页             │
│    b. 输入店铺名 + 点击搜索   │
│    c. 提取店铺列表           │
│    d. 提取商品+价格          │
└──────────┬──────────────────┘
           │ 失败时降级
           ▼
┌─────────────────────────────┐
│ 3. 用户辅助                 │
│    a. 提示用户提交店铺链接    │
│    b. 使用截图 OCR 提取数据  │
│    c. 创建人工录入任务       │
└─────────────────────────────┘
```

#### 2.2.3 定时采集任务实现

```python
# tasks/price_sync.py - 改造为真实采集
@celery_app.task(bind=True, max_retries=2)
def sync_prices_via_crawler(self, platform: str):
    """每日定时爬取指定平台的价格"""
    db = next(get_sync_db())
    try:
        collector = CouponCollector()
        # 获取需要更新的商品列表
        products = db.query(Product).filter(
            Product.last_sync_at < datetime.utcnow() - timedelta(hours=6)
        ).limit(50).all()

        for product in products:
            result = await collector.collect_price(
                platform, product.external_id
            )
            if result.success:
                # 存入 PriceSnapshot
                snapshot = PriceSnapshot(
                    product_id=product.id,
                    platform=platform,
                    base_price=result.data["price"],
                    source="crawler_sync",
                )
                db.add(snapshot)

        db.commit()
    finally:
        db.close()
```

### 阶段三：官方 API 接入（第5-7周）

**目标**：申请并接入美团/饿了么开放平台，获取稳定可靠的数据。

#### 2.3.1 需要申请的 API

| 平台 | API 名称 | 用途 | 申请地址 |
|------|---------|------|---------|
| 美团 | 外卖店铺搜索 | 搜索店铺列表 | open.meituan.com |
| 美团 | 商品详情查询 | 获取菜单价格 | open.meituan.com |
| 饿了么 | 店铺查询 | 搜索店铺 | open.shop.ele.me |
| 饿了么 | 商品查询 | 获取菜单价格 | open.shop.ele.me |
| 京东 | 外卖店铺API | 店铺信息 | open.jd.com |
| 抖音 | 生活服务API | 外卖信息 | open.douyin.com |

#### 2.3.2 API 接入层实现

```python
# app/collectors/api/meituan_api.py
class MeituanAPIClient:
    def __init__(self, app_key: str, app_secret: str):
        self.app_key = app_key
        self.app_secret = app_secret
        self.base_url = "https://openapi.meituan.com"

    def _sign(self, params: dict) -> str:
        """美团 API 签名算法"""
        sorted_params = sorted(params.items())
        raw = "&".join(f"{k}={v}" for k, v in sorted_params)
        raw += f"&app_secret={self.app_secret}"
        return hashlib.md5(raw.encode()).hexdigest()

    async def search_shops(self, keyword: str, city: str, page: int = 1):
        params = {
            "app_key": self.app_key,
            "timestamp": int(time.time()),
            "keyword": keyword,
            "city": city,
            "page": page,
            "page_size": 20,
        }
        params["sign"] = self._sign(params)
        return await self._request("/api/poi/search", params)

    async def get_menu(self, shop_id: str):
        return await self._request("/api/poi/menu", {
            "app_key": self.app_key,
            "shop_id": shop_id,
            "timestamp": int(time.time()),
        })
```

#### 2.3.3 混合采集策略

```python
# meituan_collector.py - 改造后
class MeituanCollector(BaseCollector):
    def __init__(self):
        super().__init__()
        self._api_client = None
        self.strategy_order = ["api", "crawler", "cache"]

    async def _get_api_client(self):
        if self._api_client is None and settings.meituan_api_key:
            self._api_client = MeituanAPIClient(
                settings.meituan_api_key,
                settings.meituan_api_secret,
            )
        return self._api_client

    async def collect_shops(self, location: dict) -> CollectionResult:
        # 策略1: API
        client = await self._get_api_client()
        if client:
            try:
                data = await client.search_shops(
                    keyword=location.get("keyword", ""),
                    city=location.get("city", "北京"),
                )
                return CollectionResult(
                    success=True,
                    data={"shops": data["poi_list"], "platform": "meituan"},
                    source="api",
                )
            except Exception as e:
                logger.warning("Meituan API failed: %s, fallback to crawler", e)

        # 策略2: 爬虫
        return await self._crawler_search_shops(location)

    async def _crawler_search_shops(self, location: dict) -> CollectionResult:
        """Playwright 搜索采集 (已有框架)"""
        url = f"{self.base_url}/meishi/api/poi/search?keyword={location.get('keyword')}"
        try:
            html = await self._page_request(url, wait_ms=3000)
            # ... 解析逻辑 ...
        except Exception as e:
            return self._make_fallback_result(str(e))
```

### 阶段四：实时数据流打通（第8-10周）

**目标**：建立完整的数据采集→存储→展示链路。

#### 2.4.1 数据流向图

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│  美团API  │   │ 饿了么API │   │ 京东API  │   │ 抖音API  │
└────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘
     │               │              │              │
     └───────────────┴──────────────┴──────────────┘
                     │
              ┌──────▼──────┐
              │  Collector  │  ← 混合策略 (API → 爬虫 → 缓存)
              │   Scheduler │
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │  PostgreSQL │  ← Product / PriceSnapshot / Coupon / ...
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │   Services  │  ← CompareService / RecommendService
              │   + Redis   │  ← 热门数据缓存
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │  Flutter App │  ← 真实数据展示
              └─────────────┘
```

#### 2.4.2 Celery 定时任务调度

| 任务 | 频率 | 说明 |
|------|------|------|
| `sync_shop_list` | 每天 1 次 | 同步各平台店铺列表 |
| `sync_hot_products_price` | 每 2 小时 | 热门商品价格更新 |
| `sync_coupons` | 每 6 小时 | 优惠券采集与失效处理 |
| `sync_platform_activities` | 每 12 小时 | 平台活动更新 |
| `rebuild_recommendations` | 每天凌晨 | 推荐结果重建 |
| `clean_stale_data` | 每天 1 次 | 清理过期数据 |

---

## 三、效果预期

### 3.1 功能效果对比

| 功能 | 当前 (Mock) | 接入后 |
|------|------------|--------|
| 首页店铺推荐 | 4个固定 Mock 店铺 | **根据用户偏好实时推荐 10+ 真实店铺** |
| 比价搜索 | Mock 搜索结果 | **跨美团/饿了么/京东 3+ 平台实时比价** |
| 省钱榜单 | 3个固定 Mock 商品 | **Top 10 真实差价榜单，每天更新** |
| 优惠券 | 4张 Mock 优惠券 | **100+ 实时更新的平台优惠券** |
| 平台活动 | 4个 Mock 活动 | **真实的限时特惠、品牌日活动** |
| 推荐理由 | 固定文案 | **AI 生成个性化推荐理由** |
| OCR 识别 | 已实现框架 | **接入真实外卖订单截图识别** |

### 3.2 量化指标预期

```
┌─────────────────────────────────────────────────────────────┐
│                    接入前后数据量对比                          │
├──────────────┬───────────────┬───────────────┬──────────────┤
│    指标      │    当前(Mock)  │   接入后       │   提升       │
├──────────────┼───────────────┼───────────────┼──────────────┤
│ 店铺数量      │      4        │   500+         │  125x       │
│ 商品数量      │     12        │  5000+         │  416x       │
│ 价格快照/天   │      0        │   2000+        │    ∞        │
│ 优惠券数      │      4        │   200+         │   50x       │
│ 平台活动      │      4        │    30+         │   7.5x      │
│ 支持平台      │      3(Mock)  │  4(真实数据)    │  真实化     │
│ 推荐准确率    │  不适用       │  预计 60-75%    │    -        │
│ 比价覆盖率    │     0%       │  预计 30-50%    │    -        │
└──────────────┴───────────────┴───────────────┴──────────────┘
```

### 3.3 用户体验提升

#### 比价页面效果

```
┌─────────────────────────────────────────────┐
│  搜索: 水煮鱼                              │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐    │
│  │ 🥇 美团 - 川味居           ¥32.80  │    │
│  │    配送费 ¥3  |  预计 30min        │    │
│  │    🏷️ 满30减5                       │    │
│  ├─────────────────────────────────────┤    │
│  │ 🥈 饿了么 - 川味居         ¥35.50  │    │
│  │    配送费 ¥4  |  预计 25min        │    │
│  │    🏷️ 满35减3                       │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  💰 比价结果：美团更便宜，省 ¥2.70          │
│  📊 历史价格：过去7天最低 ¥30.00            │
└─────────────────────────────────────────────┘
```

**相比 Mock 数据的区别**：
- Mock：固定显示 3 个商品，价格不变
- 真实：根据用户实际搜索展示当前真实价格，包含配送费、优惠券叠加计算

#### 省钱榜单效果

```
┌─────────────────────────────────────────────┐
│  💰 今日省钱排行榜                         │
├─────────────────────────────────────────────┤
│  🥇 麻辣香锅         美团 ¥45 | 饿了么 ¥68  │
│     省 ¥23 (33.8%)                         │
│  🥈 酸菜鱼           美团 ¥38 | 京东 ¥55   │
│     省 ¥17 (30.9%)                         │
│  🥉 黄焖鸡米饭        饿了么 ¥22 | 美团 ¥32 │
│     省 ¥10 (31.3%)                         │
└─────────────────────────────────────────────┘
```

**相比 Mock 数据的区别**：
- Mock：3 个固定商品，价格不变，没有实际参考价值
- 真实：基于当天实时价格计算，每天更新，用户可实际用于省钱决策

### 3.4 推荐系统效果预期

```
冷启动阶段 (第1周)         学习阶段 (第2-4周)        精准推荐 (第5周+)
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ 热门高分推荐     │   │ 根据您的偏好推荐  │   │ 您喜欢的川菜     │
│ (评分排序)       │   │ (菜品品类匹配)    │   │ 今日最低价¥32   │
│                 │   │                  │   │                 │
│ 准确率: ~30%    │ → │ 准确率: ~50%     │ → │ 准确率: ~70%    │
│ 用户行为: 0     │   │ 用户行为: 50+    │   │ 用户行为: 200+  │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

---

## 四、风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| 平台反爬升级 | 爬虫采集失败 | 多级降级（API→爬虫→缓存→手动）；提高代理池质量 |
| API 调用限额 | 数据更新不及时 | 智能缓存 + 差异化更新频率（热门商品高频，冷门低频）|
| API 接口变更 | 数据错乱 | 接口版本管理 + Schema 校验 + 异常监控告警 |
| 数据一致性 | 多平台价格不同步 | 价格快照 + 采集时间戳 + 数据源标识 |
| 法律合规风险 | 违规使用数据 | 仅使用公开数据/授权API；不缓存用户个人信息 |
| 请求被限流/封IP | 服务不可用 | Proxy 池 + User-Agent 轮换 + 请求间隔控制 |

---

## 五、实施时间线

```
Week 1-2  │ 阶段一: 种子数据注入
          │ ├─ 扩展 seed_data.py，录入 100+ 真实店铺
          │ ├─ 生成合理变动的价格快照
          │ ├─ 录入真实优惠券类型数据
          │ └─ 替换 Flutter Mock 数据→API 数据
          │
Week 3-4  │ 阶段二: 爬虫采集打通
          │ ├─ 实现调度策略（API→爬虫→缓存→手动）
          │ ├─ Playwright 采集链路联调
          │ ├─ celery 定时任务正式运行
          │ └─ 数据质量监控面板
          │
Week 5-7  │ 阶段三: 官方 API 接入
          │ ├─ 申请美团/饿了么开放平台权限
          │ ├─ 实现 API Client 封装
          │ ├─ 混合采集策略上线
          │ └─ 端到端链路测试
          │
Week 8-10 │ 阶段四: 生产化
          │ ├─ 推荐引擎接入真实行为数据
          │ ├─ 价格预测 & 省钱建议
          │ ├─ 监控告警体系
          │ └─ 灰度发布 & 全量上线
```

---

## 六、总结

当前项目架构已经为真实数据接入做好了充分准备：

- **采集层**：4 个平台采集器 + Proxy 池 + 反爬机制均已完成
- **服务层**：比价引擎、推荐引擎、OCR 服务逻辑完备
- **任务层**：Celery 定时任务框架就绪，只需接入真实数据源
- **前端**：Provider 状态管理 + 数据模型定义完整

**核心工作**是按上述四个阶段逐步将 Mock 数据替换为真实数据，从静态种子数据开始，到爬虫自动化，再到官方 API 稳定接入，最终实现完整的生产级数据链路。