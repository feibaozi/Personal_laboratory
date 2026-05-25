# Wardrobe Stylist — 智能衣橱穿搭助手

> **项目代号**: Wardrobe Stylist
> **版本**: v0.1 方案设计稿
> **日期**: 2026-05-25
> **作者**: hexi

---

## 一、项目概述

### 1.1 背景与痛点

| 痛点 | 描述 |
|------|------|
| 衣服多但不会搭 | 买了大量衣服，但每天出门还是「不知道穿什么」 |
| 重复穿搭 | 总是固定几套搭配轮换，很多衣服长期闲置 |
| 冲动消费 | 买的时候觉得好看，回家发现搭不上衣橱里的任何单品 |
| 缺乏系统管理 | 衣服散落各处，不知道自己到底有哪些单品 |
| 场景切换困难 | 上班、约会、运动、旅行……不同场景不知道怎么切换风格 |

### 1.2 产品定位

**Wardrobe Stylist** 是一款本地优先（Local-First）的智能衣橱穿搭推荐桌面应用，帮助用户：

- 📸 数字化管理自己的全部服装配饰
- 🎨 基于色彩理论和风格规则自动推荐搭配方案
- 🤖 通过 AI 视觉识别自动为服装打标签
- 📅 记录穿搭历史，避免重复，发现偏好
- 🧳 生成旅行打包方案，告别出门纠结

### 1.3 核心价值主张

> **「让每一件衣服都找到它的最佳搭档」**

---

## 二、功能架构

### 2.1 功能全景图

```
Wardrobe Stylist
├── 🏠 衣橱管理 (Wardrobe)
│   ├── 单品上传（拍照/选图/批量导入）
│   ├── 单品编辑（标签/属性/备注）
│   ├── 分类浏览（按类型/颜色/季节/风格）
│   ├── 搜索与筛选
│   ├── 单品状态管理（在穿/闲置/已淘汰）
│   └── 统计面板（数量/价值/利用率）
│
├── 🎨 搭配推荐 (Stylist)
│   ├── 智能推荐（AI + 规则引擎）
│   ├── 场景推荐（上班/约会/运动/日常/聚会）
│   ├── 天气推荐（接入天气 API）
│   ├── 「今天穿什么」随机摇一摇
│   ├── 颜色搭配规则引擎
│   └── 搭配评分系统
│
├── 📐 搭配画板 (Outfit Board)
│   ├── 拖拽式组合搭配
│   ├── 画板模板（全身/上半身/分层展示）
│   ├── 👔 虚拟试穿预览（人体模板叠加）
│   ├── 搭配保存与命名
│   ├── 搭配导出为图片
│   └── 搭配收藏夹
│
├── 📅 穿搭日历 (Calendar)
│   ├── 每日穿搭记录
│   ├── 日历视图（月/周）
│   ├── 穿搭统计（频率/偏好/花费）
│   ├── 重复穿搭提醒
│   └── 穿搭评分与回顾
│
├── 🧳 旅行打包 (Packing)
│   ├── 目的地 + 天数 → 自动打包方案
│   ├── 胶囊衣橱生成（最少单品最多搭配）
│   ├── 打包清单勾选
│   └── 方案保存与复用
│
├── 🛒 购物助手 (Shopping)
│   ├── 拍照试搭（新衣服能否和现有单品搭配）
│   ├── 衣橱缺口分析（缺什么颜色/类型）
│   ├── 购买建议（基于现有衣橱的补全建议）
│   └── 购买记录与后悔指数
│
└── ⚙️ 设置 (Settings)
    ├── 个人风格档案
    ├── 身材数据（用于虚拟试穿）
    ├── AI 配置（API Key / 模型选择）
    ├── 数据导入/导出
    └── 主题与外观
```

### 2.2 MVP 功能范围（Phase 1）

MVP 阶段聚焦核心闭环：**上传 → 标签 → 推荐 → 画板**

| 模块 | MVP 功能 | 优先级 |
|------|---------|--------|
| 衣橱管理 | 单品上传、标签编辑、分类浏览 | P0 |
| 搭配推荐 | 基础规则推荐、场景筛选 | P0 |
| 搭配画板 | 拖拽组合、虚拟试穿、保存搭配 | P0 |
| 穿搭日历 | 简单的每日记录 | P1 |

### 2.3 MVP 用户故事

| 编号 | 用户故事 | 验收标准 |
|------|---------|---------|
| US-1 | 作为用户，我能拍照/选图上传一件衣服，系统自动生成缩略图 | 上传后缩略图即时显示，原始图保存到本地 |
| US-2 | 作为用户，我能给衣服打标签（类别、颜色、季节、风格） | 标签表单完整可用，保存后即时更新卡片 |
| US-3 | 作为用户，我能按类别/颜色/季节筛选浏览衣橱 | 筛选器联动，结果即时刷新 |
| US-4 | 作为用户，我能选择场景后获得 3-5 套搭配推荐 | 推荐结果包含搭配图片+理由+评分 |
| US-5 | 作为用户，我能拖拽单品到画板自定义搭配，并保存 | 拖拽流畅，保存后出现在搭配列表 |
| US-6 | 作为用户，我能记录今天穿了什么 | 日历上显示当日穿搭缩略图 |
| US-7 | 作为用户，我能在人体模板上预览搭配的试穿效果 | 选中的单品叠加在人体模板上，按层级正确排列 |

---

## 三、数据模型设计

### 3.1 单品（Garment）

```typescript
interface Garment {
  id: string
  name: string
  imageUrl: string
  thumbnailUrl: string

  category: GarmentCategory
  subcategory: string
  colors: Color[]
  patterns: Pattern[]
  materials: Material[]
  seasons: Season[]
  occasions: Occasion[]
  style: Style

  brand: string
  purchaseDate: string | null
  price: number | null

  status: 'active' | 'idle' | 'retired'
  favorite: boolean
  notes: string

  createdAt: string
  updatedAt: string
}
```

### 3.2 枚举类型

```typescript
type GarmentCategory =
  | 'top'          // 上衣
  | 'bottom'       // 下装
  | 'outerwear'    // 外套
  | 'dress'        // 连衣裙
  | 'shoes'        // 鞋子
  | 'bag'          // 包
  | 'accessory'    // 配饰
  | 'hat'          // 帽子
  | 'scarf'        // 围巾
  | 'other'        // 其他

type Color =
  | 'white' | 'black' | 'gray' | 'navy' | 'beige'
  | 'red' | 'pink' | 'orange' | 'yellow' | 'green'
  | 'blue' | 'purple' | 'brown' | 'khaki' | 'denim'
  | 'multicolor'

type Pattern =
  | 'solid'        // 纯色
  | 'stripe'       // 条纹
  | 'plaid'        // 格子
  | 'floral'       // 碎花
  | 'polka_dot'    // 波点
  | 'camouflage'   // 迷彩
  | 'animal'       // 动物纹
  | 'abstract'     // 抽象
  | 'graphic'      // 图案/印花
  | 'other'

type Material =
  | 'cotton' | 'linen' | 'silk' | 'wool' | 'cashmere'
  | 'denim' | 'leather' | 'polyester' | 'nylon' | 'suede'
  | 'knit' | 'chiffon' | 'other'

type Season = 'spring' | 'summer' | 'autumn' | 'winter' | 'all_season'

type Occasion =
  | 'casual'       // 日常休闲
  | 'work'         // 上班通勤
  | 'date'         // 约会
  | 'party'        // 聚会
  | 'sport'        // 运动
  | 'formal'       // 正式场合
  | 'travel'       // 旅行
  | 'home'         // 居家

type Style =
  | 'minimalist'   // 极简
  | 'casual'       // 休闲
  | 'streetwear'   // 街头
  | 'business'     // 商务
  | 'sporty'       // 运动风
  | 'vintage'      // 复古
  | 'bohemian'     // 波西米亚
  | 'preppy'       // 学院风
  | 'punk'         // 朋克
  | 'elegant'      // 优雅
  | 'other'
```

### 3.3 搭配方案（Outfit）

```typescript
interface Outfit {
  id: string
  name: string
  garments: {
    garmentId: string
    layer: number       // 层级（内搭=0, 中层=1, 外套=2）
    position: Position  // 画板上的位置
  }[]
  occasion: Occasion[]
  season: Season[]
  style: Style
  rating: number        // 1-5 星
  tags: string[]
  isFavorite: boolean
  createdAt: string
  updatedAt: string
}

interface Position {
  x: number
  y: number
  width: number
  height: number
  zIndex: number
}
```

### 3.4 穿搭记录（DailyRecord）

```typescript
interface DailyRecord {
  id: string
  date: string           // YYYY-MM-DD
  outfitId: string | null
  garmentIds: string[]   // 当天实际穿的
  occasion: Occasion
  weather: WeatherInfo | null
  mood: string | null
  rating: number         // 1-5
  photoUrl: string | null  // 当天穿搭照
  notes: string
}

interface WeatherInfo {
  temperature: number
  condition: string
  humidity: number
}
```

### 3.5 打包方案（PackingList）

```typescript
interface PackingList {
  id: string
  name: string
  destination: string
  startDate: string
  endDate: string
  days: number
  outfits: {
    day: number
    outfitId: Outfit['id'] | null
    garmentIds: string[]
  }[]
  garmentIds: string[]   // 所有需要带的单品
  checkedItems: string[] // 已打包勾选
  createdAt: string
}
```

### 3.6 身材档案（BodyProfile）

用于虚拟试穿时的人体模板选择和衣物缩放参考。

```typescript
interface BodyProfile {
  id: string
  name: string               // 如 "我的日常身材"
  gender: 'male' | 'female' | 'other'

  // 基础身体数据（厘米）
  height: number             // 身高
  weight: number | null      // 体重（可选）

  // 关键尺寸
  measurements: {
    shoulder: number | null  // 肩宽
    chest: number | null     // 胸围
    waist: number | null     // 腰围
    hip: number | null       // 臀围
    inseam: number | null    // 内腿长
    arm: number | null       // 臂长
  }

  // 体型分类（自动推断或手动选择）
  bodyType: 'hourglass' | 'rectangle' | 'triangle' | 'inverted_triangle' | 'oval' | 'other'

  // 人体模板选择
  templateId: string         // 使用哪个人体模板（如 "male-slim", "female-standard"）

  createdAt: string
  updatedAt: string
}
```

### 3.7 虚拟试穿配置（TryOnConfig）

```typescript
interface TryOnConfig {
  // 每个单品在人体模板上的位置和变换
  garmentId: string
  // 在画布上的位置偏移（相对于模板锚点）
  offsetX: number
  offsetY: number
  // 缩放比例（根据身材数据自动计算或手动微调）
  scaleX: number
  scaleY: number
  // 层级（内搭=0, 中层=1, 外套=2, 配饰=3）
  zIndex: number
  // 旋转角度（如围巾斜搭）
  rotation: number
}
```

---

## 四、搭配推荐引擎设计

### 4.1 推荐引擎架构

```
输入层                    规则层                    AI 层                    输出层
┌──────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────┐
│ 用户衣橱  │─────▶│ 颜色搭配规则  │─────▶│              │─────▶│          │
│ 场景需求  │─────▶│ 层次搭配规则  │─────▶│  LLM 综合    │─────▶│ 搭配方案  │
│ 天气信息  │─────▶│ 场景匹配规则  │─────▶│  评分排序    │─────▶│ 评分排序  │
│ 历史偏好  │─────▶│ 季节适配规则  │─────▶│              │─────▶│          │
└──────────┘      └──────────────┘      └──────────────┘      └──────────┘
```

### 4.2 颜色搭配规则

#### 4.2.1 颜色量化模型

将颜色映射到 HSL 空间进行量化计算：

```typescript
interface ColorHSL {
  h: number  // 色相 0-360
  s: number  // 饱和度 0-100
  l: number  // 明度 0-100
}

// 预定义颜色 → HSL 映射表
const COLOR_MAP: Record<Color, ColorHSL> = {
  white:   { h: 0,   s: 0,   l: 100 },
  black:   { h: 0,   s: 0,   l: 0   },
  gray:    { h: 0,   s: 0,   l: 50  },
  navy:    { h: 240, s: 50,  l: 25  },
  beige:   { h: 45,  s: 40,  l: 85  },
  red:     { h: 0,   s: 80,  l: 50  },
  pink:    { h: 350, s: 60,  l: 75  },
  orange:  { h: 30,  s: 80,  l: 55  },
  yellow:  { h: 55,  s: 80,  l: 55  },
  green:   { h: 120, s: 50,  l: 40  },
  blue:    { h: 210, s: 60,  l: 50  },
  purple:  { h: 280, s: 40,  l: 40  },
  brown:   { h: 25,  s: 50,  l: 30  },
  khaki:   { h: 40,  s: 30,  l: 60  },
  denim:   { h: 210, s: 30,  l: 55  },
  multicolor: { h: 0, s: 0, l: 50 }
}
```

#### 4.2.2 颜色和谐度算法

```typescript
function colorHarmonyScore(colors: Color[]): number {
  if (colors.length <= 1) return 1.0

  const hsls = colors.map(c => COLOR_MAP[c])
  let score = 0

  for (let i = 0; i < hsls.length; i++) {
    for (let j = i + 1; j < hsls.length; j++) {
      score += pairHarmony(hsls[i], hsls[j])
    }
  }

  // 归一化到 0-1
  const pairCount = (colors.length * (colors.length - 1)) / 2
  return score / pairCount
}

function pairHarmony(a: ColorHSL, b: ColorHSL): number {
  // 中性色（黑白灰）与其他任何颜色都和谐
  if (a.s === 0 || b.s === 0) return 1.0

  const hueDiff = Math.abs(a.h - b.h)

  // 同色系：色相差 < 30°，和谐度高
  if (hueDiff <= 30) return 0.95

  // 邻近色：色相差 30°-60°，和谐
  if (hueDiff <= 60) return 0.85

  // 互补色：色相差 150°-180°，冲突风险
  if (hueDiff >= 150 && hueDiff <= 180) {
    // 饱和度都高时为冲突，一高一低为点缀
    if (a.s > 60 && b.s > 60) return 0.2
    return 0.5
  }

  // 一般情况：中等和谐
  return 0.6
}
```

#### 4.2.3 基础色搭配矩阵

```
          白  黑  灰  藏青  米色  卡其  牛仔蓝
  白      ✅  ✅  ✅  ✅   ✅   ✅   ✅
  黑      ✅  ✅  ✅  ✅   ✅   ✅   ✅
  灰      ✅  ✅  ✅  ✅   ✅   ✅   ✅
  藏青    ✅  ✅  ✅  ✅   ✅   ✅   ✅
  米色    ✅  ✅  ✅  ✅   ✅   ✅   ✅
  卡其    ✅  ✅  ✅  ✅   ✅   ✅   ✅
  牛仔蓝  ✅  ✅  ✅  ✅   ✅   ✅   ✅
```

> 基础色（中性色）之间几乎万能搭配，这是穿搭的「安全区」。

#### 4.2.4 颜色搭配策略

| 策略 | 色相差 | 描述 | 示例 |
|------|--------|------|------|
| **同色系** | 0°-30° | 同一色系不同深浅 | 浅蓝衬衫 + 深蓝牛仔裤 |
| **邻近色** | 30°-60° | 色轮上相邻的颜色 | 蓝色 + 紫色 |
| **互补色** | 150°-180° | 色轮上相对的颜色（小面积使用） | 蓝色 + 橙色点缀 |
| **中性色+亮色** | — | 大面积中性色 + 亮色点缀 | 黑白灰 + 红色配饰 |
| **三色原则** | — | 全身不超过3种主色 | 白T + 藏青裤 + 棕色鞋 |
| **60-30-10** | — | 60%主色 + 30%辅色 + 10%点缀 | 藏青西装 + 白衬衫 + 红领带 |

#### 4.2.5 颜色冲突检测

以下组合标记为「不推荐」：

- ❌ 亮红 + 亮绿：互补色且双方饱和度均 > 60%（圣诞感）
- ❌ 亮紫 + 亮黄：互补色且双方饱和度均 > 60%（过于刺眼）
- ❌ 多种亮色混搭：饱和度 > 50% 的颜色超过 2 种
- ⚠️ 全身超过 4 种颜色：视觉杂乱，和谐评分直接扣 0.3

### 4.3 层次搭配规则

```
层次结构（从内到外）:

Layer 0 (内搭):  T恤、衬衫、打底衫
Layer 1 (中层):  针织衫、马甲、卫衣
Layer 2 (外套):  夹克、西装、大衣、羽绒服

规则:
- 内搭必须比外层薄
- 内搭颜色应比外层浅或形成对比
- 每层最多1件（可叠加展示脱掉某层的效果）
- 内搭下摆可露出1-2cm（层次感）
```

### 4.4 场景匹配规则

| 场景 | 推荐搭配 | 避免单品 |
|------|---------|---------|
| 上班通勤 | 衬衫+西裤/卡其裤+皮鞋/乐福鞋 | 破洞牛仔裤、拖鞋、露脐装 |
| 日常休闲 | T恤+牛仔裤+运动鞋 | 西装、领带 |
| 约会 | 质感衬衫/针织+修身裤+干净鞋 | 运动裤、人字拖 |
| 运动 | 运动T恤+运动裤+跑鞋 | 牛仔裤、皮鞋 |
| 正式 | 西装+衬衫+领带+皮鞋 | 运动鞋、T恤 |
| 旅行 | 舒适上衣+弹性裤+步行鞋 | 高跟鞋、紧身衣物 |

### 4.5 AI 推荐流程

```
1. 用户选择场景/天气/偏好
       │
2. 从衣橱中筛选符合条件的单品
   - 季节匹配
   - 场景匹配
   - 状态为 active
       │
3. 规则引擎生成候选搭配
   - 颜色兼容性检查
   - 层次合理性检查
   - 场景适配度评分
       │
4. LLM 进行创意优化（可选）
   - 输入: 候选搭配 + 用户风格偏好 + 历史偏好
   - 输出: 优化后的搭配方案 + 搭配理由
       │
5. 排序 & 输出
   - 综合评分排序
   - 展示 Top 5 搭配
   - 每套搭配附带推荐理由
```

### 4.6 推荐评分公式

```
Score = W1 × 颜色和谐度
      + W2 × 场景适配度
      + W3 × 季节适配度
      + W4 × 层次合理性
      + W5 × 用户偏好匹配度
      + W6 × 新鲜度（多久没穿过）

默认权重: W1=0.25, W2=0.20, W3=0.15, W4=0.15, W5=0.15, W6=0.10
```

### 4.7 胶囊衣橱算法

**目标**：从用户衣橱中选出 N 件单品，使其能搭配出最多的成套方案。

```typescript
interface CapsuleWardrobeInput {
  garments: Garment[]
  targetCount: number      // 目标单品数（如 15 件）
  occasion: Occasion       // 目标场景
  season: Season           // 目标季节
}

interface CapsuleWardrobeResult {
  garments: Garment[]
  possibleOutfits: number  // 可搭配出的方案数
  coverage: number         // 搭配数 / 理论最大搭配数
  efficiency: number       // 搭配数 / 单品数
}

function generateCapsuleWardrobe(input: CapsuleWardrobeInput): CapsuleWardrobeResult {
  // 1. 预筛选：按季节和场景过滤，只保留 active 状态
  const candidates = input.garments.filter(g =>
    g.seasons.includes(input.season) &&
    g.occasions.some(o => input.occasion === o) &&
    g.status === 'active'
  )

  // 2. 按类别分组，设定每类最低配额
  const byCategory = groupBy(candidates, g => g.category)
  const quota: Record<string, number> = {
    top: 3, bottom: 3, outerwear: 2, shoes: 2, dress: 1, accessory: 2
  }

  // 3. 贪心算法：先填满每类配额，再用剩余名额补高兼容性单品
  let selected: Garment[] = []
  for (const [cat, count] of Object.entries(quota)) {
    const pool = byCategory[cat] || []
    selected.push(...pickMostCompatible(pool, count, selected))
  }
  while (selected.length < input.targetCount) {
    const remaining = candidates.filter(g => !selected.includes(g))
    if (remaining.length === 0) break
    selected.push(...pickMostCompatible(remaining, 1, selected))
  }

  // 4. 暴力/剪枝生成所有有效搭配
  const possibleOutfits = generateAllCombinations(selected, input.occasion)

  return {
    garments: selected,
    possibleOutfits: possibleOutfits.length,
    coverage: possibleOutfits.length / theoreticalMax(selected),
    efficiency: possibleOutfits.length / selected.length
  }
}
```

> 一个理想的胶囊衣橱：12-15 件单品，可搭配出 20-30 套不同穿搭，适合 7-10 天旅行。

### 4.8 搭配盲盒模式（Explorer Mode）

当用户想突破穿搭舒适区时，启用盲盒模式：

```typescript
function generateBlindBox(garments: Garment[]): Outfit {
  // 1. 过滤出从未搭配过的单品对（pairwise novelty）
  const novelPairs = findUnusedPairs(garments)

  // 2. 随机挑选一件「锚点单品」— 用户很久没穿的
  const anchor = pickWeighted(garments, g =>
    1 / (g.wearCount + 1)  // 穿得越少，被选中概率越高
  )

  // 3. 围绕锚点，从新颖对中构建搭配
  const top = anchor.category === 'top' ? anchor :
    pickFrom(garments.filter(g => g.category === 'top' &&
      novelPairs.has(pairKey(anchor.id, g.id))))

  const bottom = pickFrom(garments.filter(g =>
    g.category === 'bottom' && isValidPair(top, g)))

  const shoes = pickFrom(garments.filter(g =>
    g.category === 'shoes' && isValidPair(bottom, g)))

  // 4. 可选：30% 概率加一件外层或配饰作为「惊喜元素」
  const surprise = Math.random() < 0.3 ?
    pickRandom(garments.filter(g =>
      ['outerwear', 'accessory', 'hat'].includes(g.category))) : null

  return assembleOutfit([top, bottom, shoes, surprise].filter(Boolean))
}
```

---

## 五、UI/UX 设计

### 5.1 首页仪表盘（Dashboard）

```
┌──────────────────────────────────────────────────────────────┐
│  早上好，hexi！☀️                     22°C 晴  |  5月25日    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─ 今日推荐 ─────────────────────┐  ┌─ 衣橱概览 ──────────┐ │
│  │                                │  │                    │ │
│  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐  │  │  👕 上衣    32 件  │ │
│  │  │ 📸 │+│ 📸 │+│ 📸 │+│ 📸 │  │  │  👖 下装    18 件  │ │
│  │  │T恤 │ │牛仔│ │运动│ │板鞋│  │  │  🧥 外套    12 件  │ │
│  │  └────┘ └────┘ └────┘ └────┘  │  │  👟 鞋子    15 件  │ │
│  │                                │  │  💼 配饰    21 件  │ │
│  │  休闲风 · 适合今天天气          │  │                    │ │
│  │  [穿上这套]  [换一套]  [盲盒] 🎲│  │  总计: 128 件      │ │
│  └────────────────────────────────┘  └────────────────────┘ │
│                                                              │
│  ┌─ 快速操作 ───────────────────────────────────────────────┐ │
│  │  [📸 添加单品]   [🎨 搭配推荐]   [📐 搭配画板]   [📅 记录今天] │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─ 穿搭日历 (本周) ────────────────────┐ ┌─ 穿衣统计 ────┐ │
│  │  一  二  三  四  五  六  日          │ │ 本月穿了      │ │
│  │  👔 👗 🧥 👔 🎽  -   -             │ │ 18 天 / 25 天 │ │
│  │                                      │ │               │ │
│  │  ← 点击某天查看详情                   │ │ 最常穿:       │ │
│  │                                      │ │ 白色T恤 (12次) │ │
│  │                                      │ │               │ │
│  │                                      │ │ 闲置 >30天:   │ │
│  │                                      │ │ 8 件 ⚠️       │ │
│  └──────────────────────────────────────┘ └───────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 整体布局

```
┌──────────────────────────────────────────────────────┐
│  Wardrobe Stylist                    ─  □  ✕        │
├────────┬─────────────────────────────────────────────┤
│        │                                             │
│  🏠    │              主内容区                        │
│  衣橱   │                                             │
│        │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐          │
│  🎨    │  │     │ │     │ │     │ │     │          │
│  搭配   │  │ 单品 │ │ 单品 │ │ 单品 │ │ 单品 │          │
│        │  │     │ │     │ │     │ │     │          │
│  📐    │  └─────┘ └─────┘ └─────┘ └─────┘          │
│  画板   │                                             │
│        │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐          │
│  📅    │  │     │ │     │ │     │ │     │          │
│  日历   │  │ 单品 │ │ 单品 │ │ 单品 │ │ 单品 │          │
│        │  │     │ │     │ │     │ │     │          │
│  🧳    │  └─────┘ └─────┘ └─────┘ └─────┘          │
│  打包   │                                             │
│        │                                             │
│  🛒    │                                             │
│  购物   │                                             │
│        │                                             │
│  ⚙️    │                                             │
│  设置   │                                             │
│        │                                             │
├────────┴─────────────────────────────────────────────┤
│  状态栏: 共 128 件单品 | 今日推荐: 休闲风 | 22°C 晴    │
└──────────────────────────────────────────────────────┘
```

### 5.3 衣橱页面

```
┌─────────────────────────────────────────────────────┐
│  我的衣橱                              + 添加单品    │
├─────────────────────────────────────────────────────┤
│  筛选: [全部] [上衣] [下装] [外套] [鞋子] [配饰]     │
│  颜色: ⚪⚫🟤🔵🔴🟢🟡                              │
│  季节: [春] [夏] [秋] [冬] [四季]                    │
│  排序: [最近添加] [颜色] [穿着频率]                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │          │  │          │  │          │          │
│  │   📸     │  │   📸     │  │   📸     │          │
│  │          │  │          │  │          │          │
│  │ 白色T恤  │  │ 牛仔裤   │  │ 黑色皮鞋  │          │
│  │ 上衣·白色 │  │ 下装·蓝色 │  │ 鞋子·黑色 │          │
│  │ 穿过12次  │  │ 穿过8次   │  │ 穿过5次   │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │          │  │          │  │          │          │
│  │   📸     │  │   📸     │  │   📸     │          │
│  │          │  │          │  │          │          │
│  │ 格子衬衫 │  │ 运动裤   │  │ 棒球帽   │          │
│  │ 上衣·红黑 │  │ 下装·黑色 │  │ 配饰·白色 │          │
│  │ 穿过3次   │  │ 穿过6次   │  │ 穿过2次   │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 5.4 搭配画板页面

```
┌─────────────────────────────────────────────────────┐
│  搭配画板                    保存搭配    导出图片     │
├──────────────────────┬──────────────────────────────┤
│                      │                              │
│    画板区域           │     单品选择区                │
│                      │                              │
│  ┌──────────────┐   │  [上衣] [下装] [外套] [鞋子]  │
│  │              │   │                              │
│  │   🧥 外套    │   │  ┌────┐ ┌────┐ ┌────┐      │
│  │              │   │  │ 📸 │ │ 📸 │ │ 📸 │      │
│  │  👔 内搭     │   │  └────┘ └────┘ └────┘      │
│  │              │   │                              │
│  │  👖 下装     │   │  ┌────┐ ┌────┐ ┌────┐      │
│  │              │   │  │ 📸 │ │ 📸 │ │ 📸 │      │
│  │  👟 鞋子     │   │  └────┘ └────┘ └────┘      │
│  │              │   │                              │
│  └──────────────┘   │  拖拽单品到左侧画板           │
│                      │                              │
├──────────────────────┴──────────────────────────────┤
│  搭配信息: 场景[休闲] 季节[春秋] 评分: ⭐⭐⭐⭐       │
│  AI点评: 白T+牛仔+小白鞋是经典搭配，加件卡其色...    │
└─────────────────────────────────────────────────────┘
```

### 5.5 虚拟试穿预览（Try-On View）

搭配画板的「试穿模式」——将选中的单品按层级叠加到人体模板上，模拟真实穿着效果。

```
┌──────────────────────────────────────────────────────────────┐
│  搭配画板 — 试穿模式          [画板模式] [👔 试穿模式]  保存  │
├────────────────────────────┬─────────────────────────────────┤
│                            │                                 │
│     虚拟试穿预览区          │     单品选择区                    │
│                            │                                 │
│        🧍‍♂️                 │  当前搭配:                       │
│       /┃\                 │  ┌────┐ ┌────┐ ┌────┐         │
│     👔  ┃                 │  │白T │ │牛仔│ │板鞋│         │
│        ┃👖                │  └────┘ └────┘ └────┘         │
│       / \                 │                                 │
│      👟 👟                 │  点击单品可:                     │
│                            │  [✏️ 调整位置] [🔄 缩放]        │
│  ┌──────────────────────┐  │  [📐 旋转]    [🗑️ 移除]        │
│  │ 人体模板: 男-标准     │  │                                 │
│  │ 身高: 175cm           │  │  ── 更多单品 ──                 │
│  │ 体型: 标准/匀称       │  │  ┌────┐ ┌────┐ ┌────┐         │
│  │ [切换模板] [编辑身材]  │  │  │外套│ │帽子│ │背包│         │
│  └──────────────────────┘  │  └────┘ └────┘ └────┘         │
│                            │                                 │
│  操作提示:                   │  拖拽单品到左侧人体上             │
│  🖱️ 拖拽移动  🖱️🔄 滚轮缩放   │  即可预览试穿效果               │
│  ⌨️ ↑↓←→ 微调  ⌨️ +/- 层级   │                                 │
└────────────────────────────┴─────────────────────────────────┘
```

**交互说明**：

| 操作 | 方式 | 效果 |
|------|------|------|
| 添加单品 | 从右侧拖拽到人体上 | 单品叠加到模板对应位置 |
| 移动单品 | 拖拽/方向键 | 微调单品在身体上的位置 |
| 缩放单品 | 滚轮/双指缩放 | 调整单品大小匹配身材 |
| 调整层级 | `+` / `-` 键或右键菜单 | 控制叠加顺序（外套盖住内搭） |
| 移除单品 | 双击或拖回右侧 | 从试穿中移除 |
| 切换模板 | 左下角下拉 | 切换不同体型/性别的人体模板 |

### 5.6 推荐页面

```
┌─────────────────────────────────────────────────────┐
│  今天穿什么？                                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  场景: [通勤] [休闲] [约会] [运动] [自定义...]       │
│  天气: 🌤 22°C 晴  |  自动获取或手动选择             │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  推荐搭配 #1  ⭐ 4.8  适合通勤                       │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐                      │
│  │ 📸 │+│ 📸 │+│ 📸 │+│ 📸 │                      │
│  │衬衫 │ │西裤 │ │皮带 │ │皮鞋 │                      │
│  └────┘ └────┘ └────┘ └────┘                      │
│  💡 蓝白配色清爽干练，适合商务休闲场景                 │
│                                                     │
│  ─────────────────────────────────────              │
│                                                     │
│  推荐搭配 #2  ⭐ 4.5  适合休闲                       │
│  ┌────┐ ┌────┐ ┌────┐                              │
│  │ 📸 │+│ 📸 │+│ 📸 │                              │
│  │卫衣 │ │牛仔 │ │板鞋 │                              │
│  └────┘ └────┘ └────┘                              │
│  💡 灰色卫衣+深色牛仔，简约有层次                     │
│                                                     │
│  ─────────────────────────────────────              │
│                                                     │
│  推荐搭配 #3  ⭐ 4.2  适合约会                       │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐                      │
│  │ 📸 │+│ 📸 │+│ 📸 │+│ 📸 │                      │
│  │针织 │ │卡其 │ │手表 │ │乐福 │                      │
│  └────┘ └────┘ └────┘ └────┘                      │
│  💡 温柔质感路线，卡其色系亲和力强                    │
│                                                     │
│         [🎲 换一批]  [🤖 AI 再想想]                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 5.7 设计规范

| 项目 | 规范 |
|------|------|
| **配色** | 暖白背景 #FAFAF8 + 深灰文字 #1A1A1A + 强调色 #C8956C（暖棕） |
| **字体** | 中文: 思源黑体 / 西文: Inter |
| **圆角** | 卡片 12px, 按钮 8px, 输入框 6px |
| **阴影** | 卡片: 0 2px 8px rgba(0,0,0,0.08) |
| **动效** | 拖拽时缩放 1.05, hover 时微上移 2px |
| **图标** | Lucide Icons |
| **图片** | 单品图统一裁剪为 3:4 竖版, 缩略图 200x267 |

---

## 六、技术方案

### 6.1 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **桌面框架** | Electron 33+ | 跨平台桌面应用，访问本地文件系统 |
| **前端框架** | Next.js 15 (App Router) | `output: 'export'` 静态导出模式，纯客户端渲染 |
| **UI 库** | Tailwind CSS 4 + shadcn/ui | 快速构建高质量 UI |
| **拖拽交互** | @dnd-kit/core | 搭配画板的拖拽功能 |
| **状态管理** | Zustand | 轻量级状态管理 |
| **本地数据库** | better-sqlite3 | 嵌入式 SQLite，零配置，高性能 |
| **ORM** | Drizzle ORM | 类型安全的 SQL 查询 |
| **图片处理** | Sharp | 缩略图生成、图片压缩 |
| **图片去背景** | @imgly/background-removal 或本地 rembg | 虚拟试穿前去除单品背景 |
| **AI 视觉** | OpenAI GPT-4o Vision / 本地 Ollama (llava) | 自动识别服装属性，支持本地模型 |
| **AI 推荐** | OpenAI GPT-4o / 本地 Ollama | 搭配推荐与点评 |
| **天气 API** | OpenWeatherMap / 和风天气 | 获取天气数据 |
| **构建工具** | electron-builder | 打包分发 |
| **开发语言** | TypeScript | 全栈类型安全 |

> **架构说明**: Next.js 使用 `output: 'export'` 模式，编译为纯静态文件。Electron 主进程加载 `out/` 目录，数据库操作（better-sqlite3）和 AI 调用全部在 Electron 主进程完成，通过 IPC 与渲染进程通信。这与 calendar-widget 项目的架构完全一致，可复用其 Electron + Vite 的工程模板。

### 6.2 Electron IPC 通信设计

```
渲染进程 (Renderer)              主进程 (Main)
┌──────────────────┐            ┌─────────────────────────┐
│  React / Next.js │  ──IPC──▶  │  IPC Handlers           │
│  Zustand Store   │            │  ├── garment:*          │
│  UI Components   │  ◀─IPC──   │  ├── outfit:*           │
│                  │            │  ├── record:*           │
│  Context Bridge  │            │  ├── image:*            │
│  (preload.ts)    │            │  ├── ai:*               │
└──────────────────┘            │  ├── weather:*          │
                                │  └── export:*           │
                                │                         │
                                │  Drizzle ORM ◀──▶ SQLite│
                                │  Sharp ◀──▶ images/     │
                                │  OpenAI API / Ollama    │
                                └─────────────────────────┘
```

所有数据库操作、文件 I/O、AI API 调用均在主进程执行，前端通过 `window.electronAPI` 调用，确保安全沙箱隔离。

### 6.3 项目结构

```
wardrobe-stylist/
├── electron/
│   ├── main.ts              # Electron 主进程
│   ├── preload.ts           # 预加载脚本
│   ├── ipc-handlers.ts      # IPC 通信处理
│   ├── database/
│   │   ├── index.ts         # 数据库初始化
│   │   ├── schema.ts        # Drizzle schema
│   │   ├── migrations/      # 数据库迁移
│   │   └── repositories/    # 数据访问层
│   │       ├── garment.ts
│   │       ├── outfit.ts
│   │       ├── daily-record.ts
│   │       └── packing-list.ts
│   ├── services/
│   │   ├── image-service.ts       # 图片处理（缩略图/压缩/去背景）
│   │   ├── ai-service.ts          # AI 识别与推荐
│   │   ├── weather-service.ts     # 天气 API
│   │   ├── recommend-engine.ts    # 推荐引擎
│   │   ├── tryon-engine.ts        # 虚拟试穿渲染引擎
│   │   └── anchor-config.ts       # 人体模板锚点配置
│   └── constants.ts
│
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx            # 首页/仪表盘
│   │   ├── wardrobe/
│   │   │   └── page.tsx        # 衣橱管理
│   │   ├── stylist/
│   │   │   └── page.tsx        # 搭配推荐
│   │   ├── board/
│   │   │   └── page.tsx        # 搭配画板
│   │   ├── calendar/
│   │   │   └── page.tsx        # 穿搭日历
│   │   ├── packing/
│   │   │   └── page.tsx        # 旅行打包
│   │   ├── shopping/
│   │   │   └── page.tsx        # 购物助手
│   │   └── settings/
│   │       └── page.tsx        # 设置
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TitleBar.tsx
│   │   │   └── StatusBar.tsx
│   │   ├── wardrobe/
│   │   │   ├── GarmentCard.tsx
│   │   │   ├── GarmentGrid.tsx
│   │   │   ├── GarmentForm.tsx
│   │   │   ├── GarmentDetail.tsx
│   │   │   └── FilterBar.tsx
│   │   ├── stylist/
│   │   │   ├── OutfitCard.tsx
│   │   │   ├── RecommendationList.tsx
│   │   │   ├── SceneSelector.tsx
│   │   │   └── WeatherWidget.tsx
│   │   ├── board/
│   │   │   ├── OutfitCanvas.tsx
│   │   │   ├── GarmentPalette.tsx
│   │   │   ├── DraggableGarment.tsx
│   │   │   ├── CanvasToolbar.tsx
│   │   │   ├── TryOnView.tsx          # 虚拟试穿画布
│   │   │   ├── BodyTemplatePicker.tsx  # 人体模板选择
│   │   │   └── AnchorEditor.tsx        # 锚点位置微调
│   │   ├── calendar/
│   │   │   ├── CalendarView.tsx
│   │   │   ├── DailyRecordCard.tsx
│   │   │   └── StatsPanel.tsx
│   │   └── shared/
│   │       ├── ColorPicker.tsx
│   │       ├── TagInput.tsx
│   │       ├── ImageUploader.tsx
│   │       └── StarRating.tsx
│   │
│   ├── stores/
│   │   ├── wardrobe-store.ts
│   │   ├── outfit-store.ts
│   │   ├── ui-store.ts
│   │   └── settings-store.ts
│   │
│   ├── hooks/
│   │   ├── useGarments.ts
│   │   ├── useOutfits.ts
│   │   ├── useRecommendation.ts
│   │   └── useWeather.ts
│   │
│   ├── lib/
│   │   ├── color-theory.ts       # 颜色搭配算法
│   │   ├── recommend-rules.ts    # 推荐规则引擎
│   │   ├── ai-prompts.ts         # AI prompt 模板
│   │   └── types.ts              # 类型定义
│   │
│   └── styles/
│       └── globals.css
│
├── scripts/
│   └── dev.mjs
├── package.json
├── electron-builder.yml
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── drizzle.config.ts
```

### 6.4 数据库 Schema（Drizzle ORM）

```typescript
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

export const garments = sqliteTable('garments', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  imageUrl: text('image_url').notNull(),
  thumbnailUrl: text('thumbnail_url').notNull(),
  category: text('category', { enum: [...] }).notNull(),
  subcategory: text('subcategory'),
  colors: text('colors'),           // JSON array
  patterns: text('patterns'),       // JSON array
  materials: text('materials'),     // JSON array
  seasons: text('seasons'),         // JSON array
  occasions: text('occasions'),     // JSON array
  style: text('style'),
  brand: text('brand'),
  purchaseDate: text('purchase_date'),
  price: real('price'),
  status: text('status', { enum: ['active', 'idle', 'retired'] }).default('active'),
  favorite: integer('favorite', { mode: 'boolean' }).default(false),
  notes: text('notes'),
  wearCount: integer('wear_count').default(0),
  lastWornDate: text('last_worn_date'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const outfits = sqliteTable('outfits', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  garments: text('garments').notNull(),   // JSON array of {garmentId, layer, position}
  occasions: text('occasions'),           // JSON array
  seasons: text('seasons'),               // JSON array
  style: text('style'),
  rating: integer('rating').default(0),
  tags: text('tags'),                     // JSON array
  isFavorite: integer('is_favorite', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const dailyRecords = sqliteTable('daily_records', {
  id: text('id').primaryKey(),
  date: text('date').notNull().unique(),
  outfitId: text('outfit_id'),
  garmentIds: text('garment_ids'),        // JSON array
  occasion: text('occasion'),
  temperature: real('temperature'),
  weatherCondition: text('weather_condition'),
  mood: text('mood'),
  rating: integer('rating').default(0),
  photoUrl: text('photo_url'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
})

export const packingLists = sqliteTable('packing_lists', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  destination: text('destination'),
  startDate: text('start_date'),
  endDate: text('end_date'),
  days: integer('days'),
  outfits: text('outfits'),               // JSON array
  garmentIds: text('garment_ids'),         // JSON array
  checkedItems: text('checked_items'),     // JSON array
  createdAt: text('created_at').notNull(),
})
```

### 6.5 图片存储方案

```
用户数据目录/
├── wardrobe-stylist/
│   ├── database/
│   │   └── wardrobe.db          # SQLite 数据库
│   ├── images/
│   │   ├── original/            # 原始图片
│   │   │   └── {garment-id}.jpg
│   │   └── thumbnail/           # 缩略图 (200x267)
│   │       └── {garment-id}.webp
│   ├── outfits/                 # 搭配导出图片
│   │   └── {outfit-id}.png
│   └── daily-photos/            # 每日穿搭照
│       └── {date}.jpg
```

- 原始图片保留原图质量，用于查看和导出
- 缩略图使用 WebP 格式，大幅减少存储和内存占用
- 图片通过 Electron 的 `app.getPath('userData')` 存储在用户数据目录

### 6.6 AI 集成方案

#### 6.5.1 自动标签识别

```typescript
async function analyzeGarment(imageBase64: string): Promise<GarmentAnalysis> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: '你是一位专业的时尚分析师。请分析这件服装的属性。'
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: '请分析这件服装的类别、颜色、图案、材质、适合季节、适合场合和风格。' },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
        ]
      }
    ],
    response_format: { type: 'json_object' }
  })
  return JSON.parse(response.choices[0].message.content)
}
```

#### 6.5.2 搭配推荐 Prompt

```typescript
const RECOMMENDATION_PROMPT = `
你是一位专业的穿搭顾问。基于用户的衣橱单品，推荐搭配方案。

规则:
1. 每套搭配必须包含: 上衣 + 下装 + 鞋子，可选: 外套 + 配饰
2. 颜色搭配遵循: 三色原则、60-30-10 法则
3. 避免颜色冲突（如亮红+亮绿）
4. 考虑层次感（内搭+中层+外套）
5. 考虑场景适配度

用户场景: {occasion}
当前天气: {weather}
用户偏好风格: {style}

可选单品:
{garments_list}

请推荐 3 套搭配方案，每套包含:
- 使用的单品 ID
- 搭配理由（一句话）
- 评分（1-5）
`
```

### 6.7 离线优先与本地优先架构

本项目定位为 **Local-First**，核心原则：

```
┌──────────────────────────────────────────┐
│           Local-First 原则                │
├──────────────────────────────────────────┤
│  ✅ 所有数据存储在本地 SQLite             │
│  ✅ 图片文件存储在用户数据目录             │
│  ✅ 离线可用：核心功能不依赖网络            │
│  ✅ AI 功能支持本地 Ollama 降级            │
│  ✅ 用户可以随时 JSON 导出全部数据         │
│  ⚪ 未来可选：加密云同步备份               │
└──────────────────────────────────────────┘
```

**AI 服务降级策略**：

| 功能 | 在线 (GPT-4o) | 本地 (Ollama) | 纯离线降级 |
|------|--------------|---------------|-----------|
| 图片识别标签 | ✅ 高精度 | ⚠️ 需 llava 模型 | ❌ 手动打标签 |
| 搭配推荐 | ✅ 创意推荐 | ⚠️ 基础推荐 | ✅ 规则引擎 |
| 搭配点评 | ✅ 详细点评 | ⚠️ 简单点评 | ❌ 无点评 |
| 天气数据 | ✅ 实时天气 | ❌ 无 | ⚠️ 手动输入 |

用户可在设置中选择 AI 模式，离线时自动降级。

### 6.8 测试策略

```
测试金字塔（自上而下）:

     ┌──────┐
     │ E2E  │  Playwright: 核心用户流程
     │ 5%   │  (上传→推荐→保存搭配)
     ├──────┤
     │ 集成  │  Vitest: IPC 通信 + 数据库操作
     │ 20%  │  (CRUD 操作、图片处理、API 调用)
     ├──────┤
     │ 单元  │  Vitest: 纯函数逻辑
     │ 75%  │  (颜色算法、规则引擎、评分公式)
     └──────┘
```

| 测试层级 | 工具 | 覆盖内容 |
|---------|------|---------|
| **单元测试** | Vitest | `color-theory.ts` 颜色和谐度算法、`recommend-rules.ts` 规则匹配逻辑、评分公式计算 |
| **集成测试** | Vitest + better-sqlite3 内存模式 | 数据库 CRUD 操作、IPC handler 端到端、图片缩略图生成、AI mock 响应 |
| **E2E 测试** | Playwright + Electron | 上传单品完整流程、推荐→查看→保存搭配、日历记录流程 |

### 6.9 错误处理规范

```typescript
// 分层错误处理策略
// 1. 数据层 — 抛出具体错误
class GarmentNotFoundError extends Error {
  constructor(id: string) { super(`Garment ${id} not found`) }
}

// 2. 服务层 — 统一 Result 类型
type Result<T> = { success: true; data: T } | { success: false; error: string }

async function getRecommendations(input: RecInput): Promise<Result<Outfit[]>> {
  try {
    const outfits = await recommendEngine.generate(input)
    return { success: true, data: outfits }
  } catch (e) {
    logger.error('Recommendation failed', e)
    return { success: false, error: '推荐生成失败，请重试' }
  }
}

// 3. UI 层 — Toast 通知 + 降级展示
// - AI 调用失败 → Toast "AI 服务不可用，已切换到规则推荐"
// - 图片处理失败 → 显示占位图 + 重试按钮
// - 数据库写入失败 → Toast + 自动重试 3 次
```

### 6.10 虚拟试穿技术方案

#### 6.10.1 人体模板系统

```
人体模板资源/
├── templates/
│   ├── male-slim.png         # 男-瘦削
│   ├── male-standard.png     # 男-标准
│   ├── male-athletic.png     # 男-健壮
│   ├── female-petite.png     # 女-娇小
│   ├── female-standard.png   # 女-标准
│   └── female-curvy.png      # 女-丰满
│
└── anchor-points.json        # 每种模板的锚点坐标
```

**锚点定义** — 每张人体模板预定义关键锚点（相对于画布坐标），用于自动定位单品：

```typescript
interface AnchorPoints {
  templateId: string
  // 单品类别 → 默认放置位置
  anchors: Record<GarmentCategory, {
    x: number       // 锚点 X（占画布宽 %）
    y: number       // 锚点 Y（占画布高 %）
    defaultWidth: number   // 默认宽度（占画布宽 %）
    align: 'center' | 'top' | 'bottom'
  }>
}

// 示例: female-standard 模板的锚点
const FEMALE_STANDARD_ANCHORS: AnchorPoints = {
  templateId: 'female-standard',
  anchors: {
    top:        { x: 0.50, y: 0.28, defaultWidth: 0.42, align: 'center' },
    bottom:     { x: 0.50, y: 0.68, defaultWidth: 0.36, align: 'center' },
    outerwear:  { x: 0.50, y: 0.30, defaultWidth: 0.48, align: 'center' },
    dress:      { x: 0.50, y: 0.35, defaultWidth: 0.40, align: 'center' },
    shoes:      { x: 0.50, y: 0.92, defaultWidth: 0.16, align: 'center' },
    bag:        { x: 0.75, y: 0.55, defaultWidth: 0.12, align: 'center' },
    hat:        { x: 0.50, y: 0.08, defaultWidth: 0.22, align: 'center' },
    accessory:  { x: 0.50, y: 0.50, defaultWidth: 0.10, align: 'center' },
    scarf:      { x: 0.50, y: 0.18, defaultWidth: 0.30, align: 'center' },
  }
}
```

#### 6.10.2 画布渲染架构

使用 HTML5 Canvas 实现分层渲染：

```typescript
// 渲染层级（从底到顶）
const RENDER_ORDER = [
  'template',      // 0: 人体模板（底层）
  'bottom',        // 1: 下装（裤子/裙子）
  'top',           // 2: 上衣/内搭
  'dress',         // 3: 连衣裙（覆盖 top+bottom）
  'outerwear',     // 4: 外套（覆盖内搭）
  'scarf',         // 5: 围巾
  'shoes',         // 6: 鞋子
  'bag',           // 7: 包
  'hat',           // 8: 帽子
  'accessory',     // 9: 配饰（最顶层）
]

function renderTryOn(
  ctx: CanvasRenderingContext2D,
  template: HTMLImageElement,
  garments: { image: HTMLImageElement; config: TryOnConfig }[]
) {
  const { width, height } = ctx.canvas

  // 1. 绘制人体模板
  ctx.drawImage(template, 0, 0, width, height)

  // 2. 按 RENDER_ORDER 排序后逐层绘制单品
  const sorted = garments.sort((a, b) =>
    RENDER_ORDER.indexOf(a.config.category) - RENDER_ORDER.indexOf(b.config.category)
  )

  for (const g of sorted) {
    const { x, y, scaleX, scaleY, rotation } = g.config
    const imgW = g.image.width * scaleX
    const imgH = g.image.height * scaleY

    ctx.save()
    ctx.translate(x, y)
    if (rotation) ctx.rotate((rotation * Math.PI) / 180)
    ctx.globalAlpha = g.config.opacity ?? 1.0
    ctx.drawImage(g.image, -imgW / 2, -imgH / 2, imgW, imgH)
    ctx.restore()
  }
}
```

#### 6.10.3 智能定位算法

根据身材数据自动计算单品缩放和位置：

```typescript
function autoPosition(
  garment: Garment,
  bodyProfile: BodyProfile,
  templateAnchors: AnchorPoints
): TryOnConfig {
  const anchor = templateAnchors.anchors[garment.category]
  const canvasW = 600  // 画布宽度
  const canvasH = 900  // 画布高度

  // 基础位置 = 锚点坐标 × 画布尺寸
  let x = anchor.x * canvasW
  let y = anchor.y * canvasH

  // 根据身材微调
  const heightRatio = bodyProfile.height / 170  // 以 170cm 为基准
  const scaleX = anchor.defaultWidth * (bodyProfile.measurements.chest ?? 96) / 96
  const scaleY = scaleX * heightRatio

  return {
    garmentId: garment.id,
    offsetX: x,
    offsetY: y,
    scaleX,
    scaleY,
    zIndex: RENDER_ORDER.indexOf(garment.category),
    rotation: 0,
  }
}
```

#### 6.10.4 分阶段实现路线

```
Phase 1 (MVP): 固定锚点 + 手动微调
  ✅ 6 种人体模板可选
  ✅ 单品拖到人体上自动吸附到对应锚点
  ✅ 手动调整位置/缩放/旋转
  ✅ 层级自动排序

Phase 2 (优化): 智能适配
  ✅ 输入身高/三围 → 自动计算缩放
  ✅ 单品图片去背景（rembg）→ 叠加更自然
  ✅ 保存试穿配置（下次加载同一个搭配自动恢复位置）

Phase 3 (进阶): AI 辅助
  ✅ AI 识别单品图片的轮廓 → 更精准的缩放
  ✅ 变形适配（上衣下摆弧度匹配裤腰）
  ✅ 光影模拟（简单的明暗叠加）
```

#### 6.10.5 单品图片预处理

为了让虚拟试穿更真实，建议上传时对单品做预处理：

```typescript
async function preprocessForTryOn(imagePath: string): Promise<string> {
  // 1. 去背景（使用 @imgly/background-removal 或本地 rembg）
  const noBg = await removeBackground(imagePath)

  // 2. 裁剪到内容边界
  const cropped = await sharp(noBg).trim().toBuffer()

  // 3. 保存为带透明通道的 PNG
  const outputPath = imagePath.replace(/\.\w+$/, '_tryon.png')
  await sharp(cropped).png().toFile(outputPath)

  return outputPath
}
```

> **注意**：单品去背景需要用户配合——建议在纯色背景（如白墙/地板）前拍摄衣服，去背景效果最佳。

---

## 七、开发计划

### Phase 1: 基础框架 + 衣橱管理（2 周）

| 任务 | 说明 |
|------|------|
| 项目初始化 | Electron + Next.js + Tailwind + shadcn/ui（复用 calendar-widget 模板） |
| 数据库搭建 | SQLite + Drizzle ORM + Schema（含 BodyProfile 身材表） |
| 侧边栏导航 | 6 大模块入口 |
| 单品上传 | 图片选择 + 本地存储 + 缩略图生成 |
| 单品编辑 | 标签表单（类别/颜色/季节/风格等） |
| 衣橱浏览 | 网格视图 + 筛选 + 排序 |
| 单品详情 | 查看完整信息 + 编辑 + 删除 |

### Phase 2: 搭配推荐 + 画板 + 虚拟试穿（2.5 周）

| 任务 | 说明 |
|------|------|
| 颜色理论引擎 | 颜色兼容性计算、搭配策略 |
| 规则推荐引擎 | 基于规则生成候选搭配 |
| 推荐页面 UI | 场景选择 + 推荐列表 + 评分 |
| 搭配画板 | 拖拽式组合 + 画板模板 |
| 搭配保存 | 保存搭配方案到数据库 |
| 搭配导出 | 导出为图片 |
| 人体模板系统 | 6 种人体模板 + 锚点定义 + 模板切换 |
| 虚拟试穿画布 | Canvas 分层渲染 + 拖拽定位 + 缩放旋转 |
| 身材档案 | BodyProfile 表单 + 自动缩放计算 |
| 单品去背景 | 集成 rembg / @imgly/background-removal |

### Phase 3: AI 智能化（1.5 周）

| 任务 | 说明 |
|------|------|
| AI 图片识别 | GPT-4 Vision 自动打标签 |
| AI 搭配推荐 | LLM 创意推荐 + 点评 |
| 天气集成 | 天气 API + 基于天气推荐 |
| 「今天穿什么」 | 一键随机推荐 |
| AI 配置 | API Key 管理 + 模型选择 |

### Phase 4: 生活方式功能（1.5 周）

| 任务 | 说明 |
|------|------|
| 穿搭日历 | 日历视图 + 每日记录 |
| 穿搭统计 | 频率/偏好/利用率分析 |
| 旅行打包 | 自动打包方案 + 勾选清单 |
| 胶囊衣橱 | 最少单品最多搭配算法 |
| 购物助手 | 拍照试搭 + 缺口分析 |
| 数据导入导出 | JSON 备份/恢复 |

---

## 八、扩展 Idea 列表

### 8.1 高优先级（强烈建议实现）

| # | Idea | 描述 | 价值 |
|---|------|------|------|
| 1 | **胶囊衣橱生成器** | 自动计算 N 件单品能产生多少套搭配，找出最优组合 | 解决「衣服多但没搭配」的核心痛点 |
| 2 | **穿搭新鲜度追踪** | 追踪每套搭配的穿着间隔，优先推荐久未穿的组合 | 减少闲置，提高利用率 |
| 3 | **颜色缺口分析** | 分析衣橱颜色分布，告诉你「你的衣橱缺少一件白色上衣」 | 指导理性消费 |
| 4 | **一键 OOTD** | 每天早上推送一套搭配，支持「换一件」微调 | 解决每天纠结穿什么的痛点 |

### 8.2 中优先级（差异化功能）

| # | Idea | 描述 |
|---|------|------|
| 5 | **穿搭模板库** | 预设经典搭配模板（法式休闲、日系简约、美式街头等），一键套用到自己的单品 |
| 6 | **单品成本追踪** | 记录每件衣服的价格，计算「每次穿着成本」(价格/穿着次数) |
| 7 | **季节换装提醒** | 换季时提醒你该把哪些衣服收起来、哪些拿出来 |
| 8 | **搭配变体** | 一套基础搭配，展示「换一件上衣」的多种变体 |
| 9 | **风格进化追踪** | 追踪你的风格变化趋势，可视化你的穿搭偏好演变 |

### 8.3 低优先级（锦上添花）

| # | Idea | 描述 |
|---|------|------|
| 10 | **穿搭社交分享** | 生成精美的穿搭卡片图片，分享到社交媒体 |
| 11 | **虚拟衣橱 3D** | 3D 衣柜可视化，像逛真实衣柜一样浏览 |
| 12 | **搭配挑战** | 每周一个搭配主题挑战（如「只用3件单品搭出一套」） |
| 13 | **洗衣提醒** | 根据穿着次数提醒你该洗哪些衣服 |
| 14 | **二手转卖标记** | 标记闲置单品，生成转卖清单 |
| 15 | **多用户/家庭模式** | 家庭成员共享衣橱，情侣搭配推荐 |

### 8.4 与现有项目的联动

| 现有项目 | 联动方式 | 价值 |
|---------|---------|------|
| **calendar-widget** | CalendarWidget 桌面日历组件已实现日历视图 + 待办功能（进度 85%），可直接复用其日历 UI 组件作为穿搭日历的前端。Electron + Vite + React + Tailwind 的工程模板也可直接复用，节省 Phase 1 至少 3 天工作量 | 🔥 高 |
| **clip-magic** | 其 faster-whisper + LLM pipeline 的架构模式可参考。如果未来做「穿搭语音备忘录」功能（口述今天穿了什么 → 自动记录），可直接复用音频处理链路的代码 | 中 |
| **scripts (edit_pro.py)** | 基于 OpenCV 的人像/图片处理经验可复用到穿搭照的自动裁剪、背景移除（rembg）等场景，让单品照片更干净 | 中 |
| **mood-radio** | 心情电台与穿搭有天然关联——「今天什么心情就穿什么风格」。可将 mood-radio 的心情选择器移植到 Wardrobe Stylist 作为推荐输入维度 | 低 |

> **最直接的复用**：calendar-widget 的 Electron + React + Tailwind 架构与 Wardrobe Stylist 几乎一致，可以直接 Copy-Modify 其工程模板（main.ts, preload.ts, vite config），而不是从零搭建。

---

## 九、竞品参考

| 应用 | 平台 | 特点 | 我们的差异化 |
|------|------|------|-------------|
| **Cladwell** | iOS | 每日穿搭推荐，胶囊衣橱 | 我们是桌面端，画板交互更自由 |
| **Smart Closet** | iOS/Android | 衣橱管理 + 日历 + 天气 | 我们有 AI 识别和推荐引擎 |
| **Pureple** | iOS | 穿搭日历 + 随机推荐 | 我们有搭配画板和旅行打包 |
| **Acloset** | iOS/Android | AI 识别 + 搭配推荐 | 我们是本地优先，隐私安全 |
| **Get Wardrobe** | Web | 衣橱管理 + 统计 | 我们有更智能的推荐和画板 |

**我们的核心差异化**:
1. 🖥️ **桌面端体验** — 更大的画板空间，拖拽交互更自然
2. 🔒 **本地优先** — 衣服照片是隐私数据，不上传云端
3. 🎨 **搭配画板** — 像设计师一样自由组合
4. 🤖 **AI 深度集成** — 从识别到推荐到点评的全链路 AI
5. 🧳 **生活方式工具** — 不只是衣橱管理，更是穿搭决策助手

---

## 十、技术选型理由

### 为什么是 Electron + Next.js 而不是 Flutter/Web？

| 考量 | Electron 桌面端 | Flutter 移动端 | 纯 Web 应用 |
|------|----------------|---------------|-------------|
| 本地文件系统 | ✅ 原生支持 | ⚠️ 需插件 | ❌ 受限 |
| 本地数据库 | ✅ better-sqlite3 | ⚠️ sqflite | ❌ IndexedDB |
| 图片存储 | ✅ 直接写磁盘 | ⚠️ 沙盒化 | ❌ blob URL |
| 开发效率 | ✅ 复用 calendar-widget 模板 | ⚠️ foodie_comparison 经验有限 | ✅ 最快 |
| 拖拽体验 | ✅ 大屏幕天然优势 | ❌ 小屏拖拽体验差 | ✅ 中等 |
| AI API 安全 | ✅ 主进程调用，Key 不暴露 | ⚠️ 需后端代理 | ❌ Key 暴露 |

**结论**：Local-First + 桌面端是最佳组合。衣服照片天然是隐私数据，用户对「上传到云端」有顾虑。本地存储 + 本地 AI（Ollama）可完全离线运行，这是与竞品最大的差异化。

---

## 十一、风险与应对

| 风险 | 影响 | 等级 | 应对策略 |
|------|------|------|---------|
| AI 识别准确率不高 | 自动标签错误 | 🟡 中 | 用户确认流程：AI 建议 → 用户一键修正；积累纠错样本 |
| 推荐结果单调 | 用户觉得推荐都差不多 | 🟡 中 | 引入随机因子 + 新鲜度权重 + 搭配盲盒模式 |
| 图片存储占用大 | 磁盘空间不足 | 🟢 低 | WebP 缩略图 200px 宽仅 5-15KB，1000 件也才 50MB |
| 用户懒得录入 | 衣橱数据不完整 | 🔴 高 | 批量导入 + AI 自动识别降低录入成本；先录 20 件核心单品即可用 |
| 颜色识别偏差 | 照片光线影响判断 | 🟡 中 | 提供颜色修正工具（调色板手动选择）+ 建议自然光下拍摄 |
| Electron 内存占用 | 应用太大/慢 | 🟢 低 | Next.js 静态导出体积小，SQLite 零运行时开销，目标 < 200MB 内存 |

---

## 十二、成功指标

| 指标 | 目标 | 测量方式 |
|------|------|---------|
| 单品录入时间 | < 30 秒/件（含 AI 自动标签） | 手动计时 |
| 推荐生成时间 | < 3 秒（规则引擎）/ < 10 秒（AI 推荐） | 代码计时日志 |
| 搭配满意度 | 推荐搭配的收藏率 > 40% | 数据库统计 |
| 闲置率降低 | 使用 3 个月后闲置单品减少 30% | wearCount 统计 |
| 核心闭环可用 | 从上传到获得推荐 < 5 分钟 | 首次使用引导流程 |

---

> **下一步**: 确认方案后，从 Phase 1 开始搭建项目基础框架和衣橱管理模块。
