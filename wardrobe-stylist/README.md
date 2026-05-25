# 👔 Wardrobe Stylist — 智能衣橱穿搭助手

> 本地优先的个人衣橱管理 + AI 穿搭推荐桌面应用

---

## 功能预期

### 衣橱管理
- 📸 拍照/选图上传服装配饰
- 🏷️ AI 自动识别（千问 VL）：类别、颜色、图案、风格、季节、场景
- ✂️ 自动去背景抠图（OpenCV grabCut）→ 透明 PNG 贴图
- 🔍 按类别/颜色/季节筛选 + 搜索
- 📊 穿着频率统计

### 搭配推荐
- 🎨 颜色和谐度算法（HSL 色相环 + 六维评分）
- 🤖 AI 创意推荐（DeepSeek-V3）：给出搭配 + 理由
- 🎲 换一批随机扰动

### 搭配画板 & 虚拟试穿
- 🖱️ 拖拽组合搭配，自由缩放和层级调整
- 👔 人体模板试穿：衣服按类别自动定位
- 📐 衣型自适应：oversized 自动放大、短款自动上移
- 🤖 AI 微调：截图发给千问分析，给出位置调整建议
- 🔄 OpenCV 透视变形模拟立体感

### 穿搭日历
- 📅 月视图日历，点击日期记录穿搭
- 💾 数据持久化到本地 SQLite，刷新不丢失

### 旅行打包
- 🧳 输入目的地 + 天数 + 季节 → 自动生成打包清单
- ✅ 勾选已打包，支持手动增减

### 购物助手
- 📊 衣橱缺口分析（类别不足、颜色缺失、闲置提醒）
- 💰 衣橱总价值统计

### 风格档案
- ✍️ 自定义风格描述 → 自动注入 AI Prompt
- 🎯 模板库：日系简约、韩系街头、商务精英等

---

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面框架 | Electron 35 |
| 前端 | React 19 + TypeScript + Tailwind CSS 4 + Zustand |
| UI 组件 | Lucide Icons |
| 拖拽 | @dnd-kit |
| 本地数据库 | sql.js (SQLite) |
| 图片处理 | OpenCV + grabCut（Python 脚本） |
| AI 视觉 | 千问 VL-Plus（阿里云百炼） |
| AI 文本 | DeepSeek-V3 |
| 导出 | html2canvas |
| 测试 | Vitest (19 tests) |

---

## 项目结构

```
wardrobe-stylist/
├── electron/                    # Electron 主进程
│   ├── main.ts                 # 入口
│   ├── preload.ts              # Context Bridge
│   ├── ipc-handlers.ts         # IPC 路由
│   ├── database/               # sql.js 数据库层
│   │   ├── index.ts            # 初始化 + 建表
│   │   └── repositories/       # CRUD
│   └── services/               # 服务层
│       ├── image-service.ts    # 图片导入/去背景
│       ├── ai-service.ts       # 千问 + DeepSeek API
│       └── weather-service.ts  # 天气（待接入）
│
├── src/renderer/               # React 前端
│   ├── app/                    # 页面
│   │   ├── page.tsx            # 仪表盘
│   │   ├── wardrobe/           # 衣橱管理
│   │   ├── stylist/            # 搭配推荐
│   │   ├── board/              # 画板 + 试穿
│   │   ├── calendar/           # 穿搭日历
│   │   ├── packing/            # 旅行打包
│   │   ├── shopping/           # 购物助手
│   │   └── settings/           # 设置（AI 配置 + 数据管理）
│   ├── components/             # 组件
│   ├── stores/                 # Zustand 状态
│   ├── lib/                    # 算法 + 类型
│   │   ├── color-theory.ts     # 颜色和谐度
│   │   ├── recommend-rules.ts  # 推荐规则引擎
│   │   └── types.ts            # 类型定义
│   └── styles/globals.css      # 全局样式
│
├── scripts/
│   ├── dev.mjs                 # Vite + Electron 开发模式
│   ├── dev-static.cjs          # 静态文件模式
│   └── process_image.py        # OpenCV 图片处理（去背景+透视变形）
│
└── resources/templates/        # 人体模板 PNG（待添加）
```

---

## 快速开始

```bash
# 安装依赖
npm install
pip install opencv-python numpy

# 开发模式（推荐）
npm run dev:static

# 或 Vite HMR 模式
npm run dev

# 运行测试
npm test
```

### AI 功能配置

1. 打开应用 → 设置 → AI 配置
2. 填入 [千问 API Key](https://dashscope.aliyun.com)（百炼平台）
3. 填入 [DeepSeek API Key](https://platform.deepseek.com)
4. 打开"启用 AI 功能"开关 → 保存

---

## 开发进度

```
████████████████████████░░░░  80%
```

| 模块 | 状态 | 说明 |
|------|------|------|
| 项目骨架 | ✅ | Electron + React + sql.js 双模式启动 |
| 衣橱管理 | ✅ | 上传/标签/筛选/详情/删除，AI 自动打标签 |
| 搭配推荐 | ✅ | 规则引擎 + AI 推荐，六维评分 |
| 搭配画板 | ✅ | 拖拽组合 + 保存 + 导出 |
| 虚拟试穿 | ✅ | 人体模板 + 锚点定位 + 衣型自适应 + AI 微调 |
| 图片处理 | ✅ | grabCut 去背景 + 透视变形 + 颜色提取 |
| 穿搭日历 | ✅ | 月视图 + 数据库持久化 |
| 旅行打包 | ✅ | 目的地+天数 → 自动生成清单 |
| 购物助手 | ✅ | 衣橱缺口分析 + 统计 |
| 设置页面 | ✅ | AI 配置 + 数据导入导出 |
| 风格档案 | ⬜ | 待实现 |
| 单元测试 | ✅ | 19 tests, color-theory + recommend-rules |
| 人体模板 | ⬜ | resources/templates/ 待添加 PNG |
| AI 视觉 | ✅ | 千问 VL-Plus 图片打标签 |
| AI 文本 | ✅ | DeepSeek-V3 搭配推荐 |
| 天气 API | ⬜ | 待接入 |
| 胶囊衣橱 | ⬜ | 算法已设计，待实现 |
| 搭配盲盒 | ⬜ | 算法已设计，待实现 |
