# 🧪 个人项目开发实验区

> 这里是我的个人代码实验室，汇集了多个独立项目的开发工作。每个项目处于不同的开发阶段，涵盖量化交易、桌面工具、AI 应用、移动端开发等领域。

---

## 📂 项目一览

### 1. 🦊 asquant — 好奇量化

**功能预期**  
一个"有温度的量化实验室"，提供 A 股量化数据采集、多因子回测、策略研究、可视化看板等功能。面向个人量化研究者，降低量化入门门槛。

**实现方案**  
- **后端**: Python FastAPI + SQLAlchemy(aiosqlite) + akshare(行情数据) + pandas/numpy/scipy(计算) + APScheduler(定时任务) + WeasyPrint(报告生成)
- **前端**: React 19 + TypeScript + Vite + Tailwind CSS + ECharts(图表) + Zustand(状态管理) + React Router
- **数据同步**: `sync_all.py` / `sync_quotes.py` 负责行情数据拉取

**开发进度** ████████░░ 80%  
后端 API 框架与数据层已搭建，前端看板页面可用，数据同步脚本就绪。待完善：策略引擎、回测报告、更多因子。

---

### 2. 📅 calendar-widget — 桌面日历组件

**功能预期**  
一款跨平台（Windows/macOS/Linux）桌面日历 + 待办 + 备忘录小组件，支持拖拽排序、国际化、本地 SQLite 存储，常驻桌面辅助日常规划。

**实现方案**  
- **技术栈**: Electron + React 19 + TypeScript + Tailwind CSS 4 + Zustand + SQL.js(浏览器端 SQLite) + react-i18next(国际化)
- **构建**: Vite(renderer) + tsc(main/preload) + electron-builder(打包)
- **拖拽**: @dnd-kit

**开发进度** ████████░░ 85%  
核心日历/待办/备忘录功能已实现，i18n 支持中英文，`dist/` 已有打包产物。待完善：更多主题、云同步。

---

### 3. ✂️ clip-magic — AI 影视高光切片生成器

**功能预期**  
输入长视频(影视/播客/录播)，自动识别精彩片段并裁剪为短视频。利用 ASR 语音识别 + LLM 语义分析定位高光时刻，支持字幕烧录与封面生成。

**实现方案**  
- **管线**: 音频提取 → faster-whisper 语音转文字 → LLM 语义分析/规则评分 → ffmpeg 精准裁剪
- **技术栈**: Python + faster-whisper + OpenAI API + ffmpeg-python + yt-dlp(视频下载) + Rich(CLI美化)
- **双模式**: CLI 命令行 + HTTP 服务器(FastAPI)

**开发进度** ████████░░ 80%  
完整管线可运行，CLI 和 Server 模式均可使用，有大量测试脚本和示例输出。待完善：批量处理、更多 LLM 后端支持、前端 UI 优化。

---

### 4. 📰 daily-cross-inspire — 每日跨领域灵感推送

**功能预期**  
每日自动从多个 RSS 源采集内容，经 AI 摘要与筛选后，通过飞书/钉钉/邮件推送给用户，实现跨领域信息摄入与灵感激发。支持周报汇总和"历史上的今天"功能。

**实现方案**  
- **技术栈**: Python + feedparser(RSS) + BeautifulSoup(网页解析) + AI 摘要 + YAML 配置
- **管线**: RSSCollector → DomainSelector → AISummarizer → Composer → Pusher(飞书/钉钉/邮件)
- **部署**: Docker 容器化，适合 cron 定时运行

**开发进度** ████████░░ 80%  
采集→筛选→摘要→推送完整链路已实现，Dockerfile 就绪，支持多推送渠道。待完善：更多信源模板、Web 管理界面。

---

### 5. 🍔 foodie_comparison — 外卖比价优惠券助手

**功能预期**  
跨平台(美团/饿了么/京东外卖/抖音外卖)外卖比价与优惠券聚合小程序。支持同商品多平台价格对比、优惠后总价计算、智能推荐、红包聚合展示与自动领取。

**实现方案**  
- **前端**: Flutter 3.x + Provider(状态管理) + Dio(网络) + GoRouter(路由)
- **后端**: Python FastAPI + SQLAlchemy 2.0 + PostgreSQL + Redis + Celery
- **数据采集**: Playwright(网页抓取) + PaddleOCR(截图识别)
- **部署**: Docker Compose

**开发进度** ███░░░░░░░ 30%  
完整实现计划文档已编写，Flutter 与后端项目骨架已初始化。待实现：核心比价逻辑、各平台数据采集、前端 UI。

---

### 6. 🎵 mood-radio — 心情电台

**功能预期**  
基于心情/场景的电台/音乐播放器，支持 Web 与桌面端(Electron)。根据用户当前心情或选择场景推荐音乐/音频流。

**实现方案**  
- **技术栈**: Next.js 15 + React 18 + TypeScript + Tailwind CSS + Electron + electron-store
- **架构**: Next.js 作为渲染层，Electron 包装为桌面应用，支持本地存储偏好

**开发进度** ████░░░░░░ 40%  
项目框架搭建完毕，Electron 集成可用，`dist-electron/` 有构建产物。待完善：音频播放核心功能、心情推荐算法、UI 完善。

---

### 7. 🛠️ scripts — 图片处理工具箱

**功能预期**  
一组独立的图片处理脚本，覆盖人像精修、色调美化、高级编辑等场景。

**实现方案**  
- `edit_pro.py`: 基于 OpenCV 的专业人像精修 — 人脸检测、皮肤磨皮、祛斑祛痘、大眼亮眼、脸部轮廓微调
- `edit_preview.py`: 基于 PIL 的轻量调色 — 自动对比度、暖色调、降噪锐化
- `edit_advanced.py`: 高级编辑功能

**开发进度** ██████████ 95%  
各脚本功能完整可独立运行，属于工具型代码，按需维护与扩展。

---

### 8. 🤖 wechat-doppelganger — 微信私人数字分身

**功能预期**  
一个能自动操作微信桌面客户端的"数字分身"，实现消息自动回复、群聊监控、截图识别、智能对话等功能，充当个人微信助理。

**实现方案**  
- **技术栈**: Python FastAPI + RapidOCR(屏幕文字识别) + MSS(屏幕截图) + UIAutomation(窗口自动化) + OpenAI(智能对话) + Telegram Bot(远程控制)
- **架构**: 后端服务控制 Windows 微信客户端，通过 OCR + UI 自动化实现消息收发

**开发进度** ███░░░░░░░ 25%  
项目骨架与依赖配置完成，有 AutomationLog 记录。待实现：核心消息拦截/回复逻辑、OCR 集成、对话引擎。

---

### 9. 👔 wardrobe-stylist — 智能衣橱穿搭助手

**功能预期**  
本地优先的个人衣橱管理与 AI 穿搭推荐桌面应用。支持拍照上传服装、AI 自动打标签识别属性、基于颜色理论与大模型的搭配推荐、虚拟试穿预览、穿搭日历记录、旅行打包方案生成。

**实现方案**  
- **技术栈**: Electron 35 + React 19 + TypeScript + Tailwind CSS 4 + Zustand + sql.js(SQLite)
- **AI**: 千问 VL-Plus（图片识别打标签）+ DeepSeek-V3（搭配推荐与点评）
- **图片处理**: OpenCV grabCut（去背景抠图 + 透视变形）+ Python 脚本
- **拖拽**: @dnd-kit
- **测试**: Vitest (19 tests)

**开发进度** ████████░░ 80%  
核心闭环已完成：上传 → AI 打标签 → 规则/AI 推荐 → 画板拖拽搭配 → 虚拟试穿。AI 配置页面可用，千问+DeepSeek 已接入。待完善：风格档案、人体模板资源、天气 API、胶囊衣橱、搭配盲盒。

---

## 📊 总览

| 项目 | 类型 | 技术栈 | 进度 |
|------|------|--------|------|
| asquant | 量化交易 | Python/FastAPI + React | ████████░░ 80% |
| calendar-widget | 桌面工具 | Electron + React | ████████░░ 85% |
| clip-magic | AI 视频处理 | Python + Whisper + LLM | ████████░░ 80% |
| daily-cross-inspire | 信息推送 | Python + RSS + AI | ████████░░ 80% |
| foodie_comparison | 移动应用 | Flutter + FastAPI | ███░░░░░░░ 30% |
| mood-radio | 桌面/Web 应用 | Next.js + Electron | ████░░░░░░ 40% |
| scripts | 工具箱 | Python/OpenCV/PIL | ██████████ 95% |
| wechat-doppelganger | 自动化助手 | Python + OCR + UIA | ███░░░░░░░ 25% |
| wardrobe-stylist | 桌面应用 | Electron + React + AI | ████████░░ 80% |

---

*最后更新: 2026-05-26*
