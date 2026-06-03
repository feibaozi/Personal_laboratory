<p align="center">
  <img src="https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=A%20minimalist%20cinematic%20logo%20concept%3A%20a%20stylized%20director's%20clapperboard%20merged%20with%20a%20neural%20network%20circuit%20pattern%2C%20dark%20background%2C%20neon%20blue%20and%20purple%20accents%2C%20clean%20vector%20style%2C%20no%20text&image_size=square_hd" width="120" alt="AI Director Logo" />
</p>

<h1 align="center">AI Director</h1>
<p align="center">
  <strong>视频叙事自动化流水线</strong><br>
  输入素材 + 主题 → AI 自动编排成有节奏、有叙事弧线的完整短片
</p>

<p align="center">
  <a href="https://github.com/your-username/ai-director"><img src="https://img.shields.io/badge/version-0.3.0-blue" alt="Version" /></a>
  <a href="https://python.org"><img src="https://img.shields.io/badge/python-3.11+-green" alt="Python" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-18+-green" alt="Node" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-yellow" alt="License" /></a>
  <img src="https://img.shields.io/badge/status-active-brightgreen" alt="Status" />
</p>

---

## 目录

- [快速开始](#快速开始)
- [核心功能](#核心功能)
- [使用指南](#使用指南)
- [技术架构](#技术架构)
- [API 参考](#api-参考)
- [项目结构](#项目结构)
- [配置参考](#配置参考)
- [版本迭代](#版本迭代)
- [路线图](#路线图)
- [贡献指南](#贡献指南)
- [许可证](#许可证)

---

## 快速开始

### 环境要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Python | 3.11+ | 后端运行环境 |
| Node.js | 18+ | 前端构建工具链 |
| FFmpeg | 自动 | 无需手动安装，通过 `imageio-ffmpeg` 自动获取 |
| CUDA | 可选 | 用于 Whisper / CLIP / TTS 加速 |

### 安装

```bash
# 1. 克隆项目
git clone https://github.com/your-username/ai-director.git
cd ai-director

# 2. 安装 Python 后端依赖
cd backend
pip install -r requirements.txt

# 3. 安装前端依赖
cd ../frontend
npm install
cd ..
```

### 配置 LLM API Key

在 `backend/` 目录下复制 `.env.example` 为 `.env`，填入 API Key：

```env
# DeepSeek（推荐，便宜又好用）
AI_DIRECTOR_LLM_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
AI_DIRECTOR_LLM_BASE_URL=https://api.deepseek.com/v1
AI_DIRECTOR_LLM_MODEL=deepseek-chat
AI_DIRECTOR_LLM_PROVIDER=deepseek
```

> 支持 7 种 LLM 提供商：OpenAI / DeepSeek / 通义千问 / 智谱 GLM / Kimi / 硅基流动 / Ollama 本地。不配置也可使用，系统会使用内置 mock 模板生成示例分镜。

### 启动

**方式一：一键启动（推荐）**

```bash
# Windows
.\start-dev.bat

# 或 PowerShell
.\start-dev.ps1
```

**方式二：分别启动**

```bash
# 终端 1 — 后端
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8788

# 终端 2 — 前端开发服务器
cd frontend
npm run dev -- --host
```

启动后访问：

| 地址 | 说明 |
|------|------|
| `http://localhost:5173` | 前端开发页面（热更新） |
| `http://localhost:8788` | 后端 API + 生产前端 |
| `http://localhost:8788/docs` | Swagger API 文档 |

### Docker 部署

```bash
# 1. 创建 .env 文件（参考上方 LLM 配置）
cp backend/.env.example .env

# 2. 构建并启动
docker compose up -d

# 3. 查看日志
docker compose logs -f

# 4. 停止
docker compose down
```

启动后访问 `http://localhost:8788`，健康检查端点 `http://localhost:8788/api/health`。

> Docker 部署默认不包含 CUDA 支持，Whisper / CLIP 将使用 CPU 推理。如需 GPU 加速，需使用 NVIDIA Container Toolkit 并修改 Dockerfile 基础镜像。

---

## 核心功能

### 三种使用模式

| 模式 | 入口 | 说明 |
|------|------|------|
| **一键快剪** | 主页 → "一键快剪" | 输入主题 + 上传素材 → AI 自动生成分镜脚本 + 匹配素材 → 展示结果 |
| **分镜精控** | 主页 → "分镜精控" | 进入故事板编辑器，拖拽排序、编辑描述、手动换素材、选择转场 |
| **导出视频** | 任意模式 → "导出视频" | 分镜 + 素材拼接为 MP4，支持字幕、旁白、背景音乐 |

### 四大叙事模板

| 模板 | 默认分镜 | 默认时长 | 适用场景 |
|------|---------|---------|---------|
| **三幕式** `three_act` | 6 | 120s | 铺陈 → 冲突/高潮 → 收束（Vlog / 故事） |
| **五段式** `five_stage` | 5 | 180s | 引入 → 背景 → 核心 → 案例 → 总结（知识 / 教程） |
| **蒙太奇** `montage` | 10 | 60s | 快节奏卡点混剪（纪念 / 混剪） |
| **精华集锦** `highlight_reel` | 3 | 135s | 长视频自动提取高光时刻 |

---

## 使用指南

### 1. 上传素材

- 拖拽文件到素材区，或点击选择文件
- 支持格式：
  - **视频**：mp4 / mov / mkv / avi / webm
  - **图片**：jpg / png / gif / webp
  - **音频**：mp3 / wav / aac / flac
- 素材会自动显示在左侧素材篮中，支持批量上传

### 2. 一键快剪

1. 输入主题（如 "我的2024年度回顾"）
2. 选择叙事模板和目标时长
3. 上传素材
4. 点击 **"生成分镜脚本"**

AI 会：
- 调用 LLM 生成分镜脚本（场景描述、时长、情绪基调、转场建议）
- 自动匹配素材到每个分镜
- 展示分镜卡片结果

### 3. 分镜精控

在分镜卡片展示后，点击顶部 **"分镜精控"** 进入编辑器：

| 操作 | 方式 |
|------|------|
| **拖拽排序** | 拖动分镜卡片左侧六点图标 |
| **编辑分镜** | 点击卡片，在弹窗中编辑描述和时长 |
| **切换情绪** | 点击情绪标签循环切换（平静 / 激昂 / 紧张 / 温暖 / 反思 / 中性） |
| **选择转场** | 选中分镜后，从下拉框选择 15 种转场效果 |
| **匹配素材** | 点击 "选素材" 按钮，弹出素材选择器 |
| **添加/删除分镜** | 点击 "+ 添加分镜" 或卡片右侧删除图标 |
| **时间线预览** | 底部 Canvas 时间线，显示分镜时长比例 |
| **详情面板** | 右侧显示选中分镜的完整信息 |

### 4. 导出视频

点击 **"导出视频"**：

1. 系统自动创建项目并保存当前分镜 + 素材匹配数据
2. 按分镜顺序拼接素材
3. 应用分镜之间选择的转场效果（38 种可选）
4. 可选：生成 ASS 字幕并烧录
5. 可选：CosyVoice 2 TTS 合成旁白
6. 可选：混入背景音乐
7. 导出完成后提供下载链接，实时进度条

---

## 技术架构

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React 18)               │
│  Vite + Tailwind + Zustand + @dnd-kit               │
│  故事板拖拽  ·  Canvas 时间线  ·  素材选择器         │
└──────────────────────┬──────────────────────────────┘
                       │ REST + WebSocket
┌──────────────────────┴──────────────────────────────┐
│                   Backend (FastAPI)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ 叙事引擎  │ │ 素材匹配  │ │ 剪辑引擎  │            │
│  │ LLM+Jinja│ │ CLIP+Chr│ │ FFmpeg  │            │
│  └──────────┘ └──────────┘ └──────────┘            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ 字幕引擎  │ │ TTS引擎  │ │ 节奏分析  │            │
│  │ ASS+FFmpeg│ │CosyVoice2│ │ madmom   │            │
│  └──────────┘ └──────────┘ └──────────┘            │
└─────────────────────────────────────────────────────┘
```

### 模块详解

| 模块 | 核心技术 | 说明 |
|------|---------|------|
| **叙事引擎** | OpenAI SDK + Jinja2 | LLM 生成分镜脚本（Structured Output），4 套叙事模板 |
| **素材匹配** | Chinese-CLIP + ChromaDB | 多模态语义匹配 + 余弦相似度排序 + LLM 精选 |
| **剪辑引擎** | FFmpeg `xfade` + `concat` | 链式拼接，38 种转场，一次编码，无损画质 |
| **字幕引擎** | ASS 字幕 + FFmpeg `subtitles` | 比 OpenCV 逐帧渲染快 10-50 倍，LLM 润色 |
| **节奏分析** | madmom + emotion2vec | 节拍检测 + 情感曲线 + 转场对齐 downbeat |
| **旁白合成** | CosyVoice 2 | 零样本语音克隆 + 情感控制 |
| **Web 编辑器** | React 18 + Zustand + @dnd-kit | 故事板拖拽排序 + Canvas 时间线 + 三栏布局 |

---

## API 参考

### 叙事

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/narrative/generate` | 生成分镜脚本 |
| POST | `/api/narrative/pipeline` | 运行完整流水线（分镜 + 匹配） |
| GET | `/api/narrative/pipeline/{job_id}/status` | 查询流水线进度 |
| POST | `/api/narrative/shot-match` | 单个分镜匹配素材 |

<details>
<summary>POST /api/narrative/generate 示例</summary>

```json
{
  "theme": "城市生活的一天",
  "narrative_type": "three_act",
  "target_duration_sec": 120
}
```

响应：

```json
{
  "theme": "城市生活的一天",
  "narrative_type": "three_act",
  "target_duration_sec": 120,
  "shots": [
    {
      "index": 1,
      "description": "清晨城市苏醒，街道逐渐热闹",
      "duration_sec": 20,
      "tone": "calm",
      "transition_in": "cut",
      "transition_out": "dissolve"
    }
  ]
}
```

</details>

### 素材

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/materials/upload` | 上传素材（multipart/form-data） |
| POST | `/api/materials/index` | 索引单个素材到 ChromaDB |
| POST | `/api/materials/index-all` | 批量索引所有素材 |
| GET | `/api/materials` | 获取素材列表 |
| DELETE | `/api/materials/{material_id}` | 删除素材 |
| POST | `/api/materials/match` | 根据描述文本匹配素材 |

### 导出

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/compose/export` | 导出视频（异步任务） |
| GET | `/api/compose/export/{job_id}/status` | 查询导出进度 |
| GET | `/api/compose/transitions` | 获取 39 种转场列表 |
| POST | `/api/compose/recommend-transition` | LLM 根据情绪推荐转场 |

<details>
<summary>POST /api/compose/export 参数</summary>

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `project_id` | string | 必填 | 项目 ID |
| `include_subtitles` | bool | false | 是否添加字幕 |
| `include_narration` | bool | false | 是否添加旁白 |
| `bgm_path` | string | - | 背景音乐路径 |
| `apply_rhythm` | bool | false | 是否应用节奏分析调整切点 |

</details>

### 项目管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/projects` | 创建项目 |
| GET | `/api/projects` | 获取项目列表 |
| GET | `/api/projects/{project_id}` | 获取项目详情 |
| PATCH | `/api/projects/{project_id}` | 更新项目（脚本、匹配结果等） |
| DELETE | `/api/projects/{project_id}` | 删除项目 |

### 实时推送

| 方法 | 路径 | 说明 |
|------|------|------|
| WS | `/ws/{job_id}` | WebSocket 流水线进度推送 |

---

## 项目结构

```
ai-director/
├── backend/
│   ├── app/
│   │   ├── engine/                         # 核心引擎
│   │   │   ├── narrative_engine.py         # 叙事结构引擎（LLM + Jinja2）
│   │   │   ├── multimodal_embedder.py      # Chinese-CLIP 多模态编码
│   │   │   ├── material_matcher.py         # 素材语义匹配 + LLM 精选
│   │   │   ├── composer.py                 # FFmpeg 剪辑拼接（xfade 链）
│   │   │   ├── subtitle_engine.py          # ASS 字幕生成 + 烧录
│   │   │   ├── tts_engine.py               # CosyVoice 2 TTS 旁白
│   │   │   ├── rhythm_analyzer.py          # madmom 节拍检测 + 情感曲线
│   │   │   └── templates/                  # Jinja2 叙事模板
│   │   │       ├── three_act.j2
│   │   │       ├── five_stage.j2
│   │   │       ├── montage.j2
│   │   │       └── highlight_reel.j2
│   │   ├── models/                         # Pydantic 数据模型
│   │   │   ├── script.py                   # Script / ShotSpec
│   │   │   ├── material.py                 # Material / MatchResult
│   │   │   └── project.py                  # Project
│   │   ├── routers/                        # FastAPI 路由
│   │   │   ├── narrative.py
│   │   │   ├── material.py
│   │   │   ├── compose.py
│   │   │   └── project.py
│   │   ├── services/                       # 基础设施
│   │   │   ├── chroma_service.py           # ChromaDB 向量数据库
│   │   │   └── pipeline_service.py         # 异步流水线 + WebSocket
│   │   ├── config.py                       # 全局配置
│   │   └── main.py                         # FastAPI 入口
│   ├── test_materials/                     # 测试素材（8 视频 + 3 图片 + 6 音频 + 1 BGM）
│   ├── test_data/                          # 测试数据
│   ├── test_outputs/                       # FFmpeg 输出产物
│   ├── pyproject.toml
│   ├── requirements.txt
│   ├── .env.example
│   └── verify_env.py                       # 配置验证脚本
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── storyboard/
│   │   │   │   ├── StoryboardPage.tsx       # 分镜精控主页（三栏布局）
│   │   │   │   ├── StoryboardPanel.tsx      # 故事板列表（@dnd-kit 拖拽）
│   │   │   │   ├── ShotCard.tsx             # 单张分镜卡片
│   │   │   │   └── MaterialPicker.tsx       # 素材选择弹窗
│   │   │   ├── timeline/
│   │   │   │   ├── Timeline.tsx             # Canvas 时间线
│   │   │   │   └── VideoPreview.tsx         # 视频预览组件
│   │   │   └── pipeline/
│   │   │       └── PipelineProgress.tsx     # 流水线进度条
│   │   ├── stores/
│   │   │   └── projectStore.ts              # Zustand 全局状态（项目/脚本/匹配/导出）
│   │   ├── api/
│   │   │   └── client.ts                    # REST + Upload 客户端
│   │   ├── types/
│   │   │   ├── index.ts
│   │   │   └── script.ts                    # TypeScript 类型定义
│   │   ├── App.tsx                          # 主应用（一键快剪 + 分镜精控 + 导出）
│   │   ├── main.tsx
│   │   └── index.css                        # Tailwind + 自定义样式
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── tsconfig.json
├── start-dev.bat                             # 一键启动（Windows）
├── start-dev.ps1                             # 一键启动（PowerShell）
├── start.bat                                 # 生产模式启动
├── start-backend.bat                         # 仅启动后端
├── start-frontend.bat                        # 仅启动前端
├── test-api.bat                              # 测试 API 脚本
└── .gitignore
```

---

## 配置参考

所有配置项通过 `backend/.env` 文件设置，环境变量前缀为 `AI_DIRECTOR_`。

### LLM 配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `AI_DIRECTOR_LLM_API_KEY` | — | **必填**，LLM API Key |
| `AI_DIRECTOR_LLM_BASE_URL` | `https://api.openai.com/v1` | API 端点 |
| `AI_DIRECTOR_LLM_MODEL` | `gpt-4o` | 模型名称 |
| `AI_DIRECTOR_LLM_PROVIDER` | `openai` | 提供商预设（应用对应的 base_url 和 model） |

### 提供商预设

| Provider | Base URL | 推荐模型 |
|----------|----------|---------|
| `deepseek` | `https://api.deepseek.com/v1` | `deepseek-chat` |
| `siliconflow` | `https://api.siliconflow.cn/v1` | `deepseek-ai/DeepSeek-V3` |
| `qwen` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| `zhipu` | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-flash` |
| `openai` | `https://api.openai.com/v1` | `gpt-4o-mini` |
| `moonshot` | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| `local` | `http://localhost:11434/v1` | Ollama 本地模型 |

### 其他配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `AI_DIRECTOR_WHISPER_MODEL_SIZE` | `medium` | Whisper 模型大小 |
| `AI_DIRECTOR_WHISPER_DEVICE` | `cuda` | 推理设备 |
| `AI_DIRECTOR_OUTPUT_DIR` | `./output` | 输出目录 |
| `AI_DIRECTOR_SUBTITLE_FONT` | `Microsoft YaHei` | 字幕字体 |
| `AI_DIRECTOR_SUBTITLE_FONTSIZE` | `24` | 字幕字号 |
| `AI_DIRECTOR_CLIP_MODEL_NAME` | `OFA-Sys/chinese-clip-vit-base-patch16` | CLIP 模型 |
| `AI_DIRECTOR_CHROMA_PERSIST_DIR` | `./data/chroma` | ChromaDB 持久化目录 |

---

## 版本迭代

### 版本概览

| 版本 | 发布日期 | 代码名 | 状态 |
|------|---------|--------|------|
| v0.3.0 | 2026-05-31 | 全功能版本 | ✅ 稳定 |
| v0.2.0 | 2026-05 | 编辑器版本 | ✅ 稳定 |
| v0.1.0 | 2026-05 | 核心版本 | ✅ 稳定 |

### v0.3.0 (当前) — 全功能版本

> 2026-05-31

**新增功能**

- ✅ **Phase 3 — 剪辑拼接引擎**：FFmpeg xfade 链式拼接，支持视频/图片/音频三种素材类型，38 种转场效果
- ✅ **Phase 4 — 节奏分析**：madmom 节拍检测 + emotion2vec 情感曲线 + 转场自动对齐 downbeat
- ✅ **Phase 5 — 转场生成**：前端 15 种转场可选 + LLM 根据情绪推荐转场 + 后端完整转场映射表
- ✅ **Phase 6 — 字幕与旁白**：ASS 字幕生成 + FFmpeg subtitles 滤镜烧录 + LLM 字幕润色 + CosyVoice 2 TTS + 三层混音（旁白/原声/BGM）
- ✅ 前端导出按钮接入完整 API 流程，实时进度条 + 下载链接
- ✅ 分镜卡片转场选择器
- ✅ WebSocket 实时管线进度推送

**修复与优化**

- 🔧 修复 CLIP 模型导入挂起问题，添加懒加载 + 文本 fallback 嵌入
- 🔧 修复 FFmpeg xfade 转场拼接失败，简化滤镜链
- 🔧 修复流水线状态 0% 卡住，添加线程安全的任务状态存储
- 🔧 修复叙事生成端点 404，支持 JSON body + query param 双模式
- 🔧 修复 project_id 硬编码问题，实现自动创建项目 + 数据同步
- 🔧 补充 `imageio-ffmpeg` / `soundfile` / `torchaudio` 到依赖清单
- 🔧 修复 Project 模型 shot_matches 字段 JSON 反序列化类型兼容
- 🔧 更新前端 package.json 版本号到 0.3.0

### v0.2.0 — 编辑器版本

> 2026-05

- ✅ **Phase 2 — Web 编辑器**：@dnd-kit 分镜拖拽排序 + Canvas 时间线 + 素材选择弹窗
- ✅ 分镜精控模式：三栏布局（素材篮 · 故事板 · 详情面板）
- ✅ Streamlined App 组件：一键快剪 + 分镜精控模式切换
- ✅ ShotCard 编辑器：描述、时长、情绪、转场可编辑
- ✅ WebSocket 进度实时推送
- ✅ 后端 `POST /shot-match` 单分镜匹配 API

### v0.1.0 — 核心版本

> 2026-05

- ✅ **Phase 1 — 叙事引擎 + 素材匹配**：LLM 分镜生成 + Chinese-CLIP + ChromaDB
- ✅ 数据模型：`Script` / `ShotSpec` / `Material` / `Project`
- ✅ 4 套 Jinja2 叙事模板：三幕式 / 五段式 / 蒙太奇 / 精华集锦
- ✅ LLM 多提供商支持：OpenAI / DeepSeek / 通义千问 / 智谱 / Kimi / 硅基流动 / Ollama
- ✅ 素材上传 + 多模态索引 + 语义匹配 + LLM 精选
- ✅ FastAPI 骨架 + React 18 前端 + Tailwind 深色主题
- ✅ 一键启动脚本

---

## 路线图

### v0.4.0（规划中）

- [ ] 多轨道时间线编辑器（视频轨 + 音频轨 + 字幕轨）
- [ ] 关键帧动画（缩放、平移、旋转）
- [ ] 视频预览播放器（WebCodecs / HLS）
- [ ] 色彩分级（LUT 滤镜）
- [ ] 项目模板市场

### v0.5.0（规划中）

- [ ] 多人协作编辑
- [ ] 云端渲染队列
- [ ] 移动端适配
- [ ] 插件系统

---

## 贡献指南

欢迎贡献代码！请遵循以下流程：

1. **Fork 项目**
   ```bash
   git fork https://github.com/your-username/ai-director.git
   ```

2. **创建功能分支**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **提交代码**
   ```bash
   git commit -m "feat: 添加新功能描述"
   ```

4. **推送分支**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **创建 Pull Request**

### 代码规范

- Python：遵循 PEP 8 规范
- TypeScript：使用 ESLint 检查
- 提交信息使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式

### 开发环境

```bash
# 安装开发依赖
cd backend
pip install -r requirements.txt

cd ../frontend
npm install
```

> **注意**：项目暂无自动化测试套件，后续计划补充。以下命令预留供未来使用：

```bash
# 运行测试（待实现）
cd backend
python -m pytest

# 前端类型检查
cd frontend
npx tsc --noEmit
```

---

## 许可证

MIT License

---

**AI Director** — 让视频创作更简单 🎬