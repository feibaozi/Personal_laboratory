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

### 4. 📰 daily-cross-inspire — 每日跨界灵感早报

**功能预期**  
每日自动从 15 个不同学科领域的 RSS 源采集内容，经 AI 摘要翻译后，通过飞书/钉钉/邮件推送。核心目标是打破信息茧房，让用户每天接触完全陌生的领域。支持偏好自适应、茧房检测、情绪追踪、知识星系图可视化、AI 对话管家等智能功能。

**实现方案**  
- **技术栈**: Python + feedparser(RSS) + DeepSeek(AI) + FastAPI(对话API) + D3.js(星系图) + SQLite
- **管线**: RSSCollector → DomainSelector(偏好加权) → AISummarizer → Composer → Pusher(飞书/钉钉/邮件)
- **v3.0 新功能**: AI 对话管家(上下文记忆)、D3.js 知识星系图、茧房检测+情绪追踪
- **部署**: GitHub Actions 每日定时 + Docker 容器化

**开发进度** █████████░ 95%  
完整链路已实现并稳定运行。v1.0 基础推送 → v2.0 偏好引擎+深潜+标签+主题月 → v3.0 对话管家+星系图+茧房检测。待完善：AI 辩论赛、自愈式 RSS 网络。

---

### 5. 🍔 foodie_comparison — 外卖比价优惠券助手

**功能预期**  
跨平台(美团/饿了么/京东外卖/抖音外卖)外卖比价与优惠券聚合应用。支持同商品多平台价格对比、优惠后总价计算、智能推荐、红包聚合展示、外卖截图OCR识别。

**实现方案**  
- **前端**: Flutter 3.x + Provider(状态管理) + Dio(网络) — 5 页面 / 6 卡片组件 / 4 Provider
- **后端**: Python FastAPI + SQLAlchemy 2.0 + PostgreSQL + Redis + Celery — 7 路由 / 5 服务 / 14 数据表
- **数据采集**: Playwright(4平台爬虫) + PaddleOCR(截图识别) + 代理池 + 多级降级策略
- **API Client**: MeituanAPIClient / ElemeAPIClient 封装（签名算法 + 业务方法）
- **推荐引擎**: 内容推荐 + 价格感知排序 + 冷启动兜底
- **测试**: 116 个后端测试用例 + Flutter 单元/Widget 测试

**版本迭代**  
- v0.4.0 (2026-05-27) — 数据链路打通：采集器混合调度、首页API上线、Flutter API对接、数据监控面板
- v0.3.0 (2026-05-26) — OCR服务、比价引擎、推荐引擎、Celery定时任务
- v0.2.0 (2026-05-25) — JWT认证、4平台采集器、代理池、Playwright反爬
- v0.1.0 (2026-05-22) — 项目初始化、FastAPI/Flutter骨架、Docker环境

**开发进度** ███████░░░ 70%  
核心闭环已完成：认证 → 数据采集 → 比价/推荐引擎 → API → Flutter展示。种子数据已扩展至30店铺/113商品。待完成：真实平台API接入、爬虫链路联调、生产部署。

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

### 9. 🎤 my-interview-coach — 个人求职智能助手

**功能预期**
基于 AI 的个人求职面试练习系统。上传简历自动构建数字分身，模拟真实面试对话。支持面试官/本人双模式自由切换，中途纠正 AI 回答，一键保存为面试卡片。三层知识架构：文档 RAG → 结构化档案 → 话题卡片。

**实现方案**
- **技术栈**: Next.js 16 + TypeScript + Tailwind CSS + DeepSeek API + SQLite(better-sqlite3) + Zustand
- **AI**: DeepSeek-V4-Pro (对话生成) + Xenova/all-MiniLM-L6-v2 (本地嵌入, 384维)
- **文档解析**: pdf-parse + mammoth (PDF/Word/MD/TXT)
- **核心模块**: Agentic 档案引擎 (深度解析+合并+纠正) + 统一对话端点 (双模式切换) + RAG 混合检索 (语义+关键词fallback)
- **API**: 22 条路由 (知识库/卡片/对话/设置)

**开发进度** █████████░ 90%
核心闭环已完成：文档上传 → 档案解析 → 数字分身对话 → 双模式切换 → 纠正 → 保存卡片。待完善：流式对话输出、自我进化（纠正反哺档案）。

---

### 10. 👔 wardrobe-stylist — 智能衣橱穿搭助手

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

### 11. 🌱 thinkgarden — AI 知识框架引擎

**功能预期**
一款 AI 驱动的知识框架桌面应用。以水平树形思维导图为核心，AI 自动分析、归位、发散个人实践经验。支持 AI 对话式建框架，随手记录经验 AI 自动归位，对话记录中提取知识节点，AI 巡检框架健康度，实践前针对性提醒。

**实现方案**
- **技术栈**: Electron 35 + Next.js 15 (SSG) + React 18 + TypeScript + Tailwind CSS + sql.js
- **思维导图**: @xyflow/react v12 (ReactFlow)，递归水平树布局算法，6 种节点类型
- **AI**: OpenAI 兼容协议，支持 7 家厂商（DeepSeek/OpenAI/智谱/Moonshot/通义千问/豆包/Ollama）
- **数据库**: sql.js（纯 JS SQLite），7 张表，全量 JSON 导入导出
- **导出**: Markdown / Mermaid 流程图 / JSON 全量备份
- **桌面集成**: 无边框窗口、自定义标题栏、app:// 自定义协议、剪贴板智能监听

**开发进度** █████████░ 90%  
核心闭环已完成：AI 建框架 → 经验归位 → 对话摘要 → 巡检 → 实践提醒 → 快照/导出。支持 7 家 AI 厂商，桌面快捷方式可用。待完善：节点拖拽排序、主题系统、云端同步。

---

## 📊 总览

| 项目 | 类型 | 技术栈 | 进度 |
|------|------|--------|------|
| asquant | 量化交易 | Python/FastAPI + React | ████████░░ 80% |
| calendar-widget | 桌面工具 | Electron + React | ████████░░ 85% |
| clip-magic | AI 视频处理 | Python + Whisper + LLM | ████████░░ 80% |
| daily-cross-inspire | 信息推送 | Python + RSS + AI + D3.js | █████████░ 95% |
| foodie_comparison | 移动应用 | Flutter + FastAPI | ███████░░░ 70% |
| mood-radio | 桌面/Web 应用 | Next.js + Electron | ████░░░░░░ 40% |
| scripts | 工具箱 | Python/OpenCV/PIL | ██████████ 95% |
| wechat-doppelganger | 自动化助手 | Python + OCR + UIA | ███░░░░░░░ 25% |
| my-interview-coach | Web 应用 | Next.js + DeepSeek + SQLite | █████████░ 90% |
| wardrobe-stylist | 桌面应用 | Electron + React + AI | ████████░░ 80% |
| thinkgarden | 桌面应用 | Electron + Next.js + sql.js + AI | █████████░ 90% |

---

*最后更新: 2026-05-28*
