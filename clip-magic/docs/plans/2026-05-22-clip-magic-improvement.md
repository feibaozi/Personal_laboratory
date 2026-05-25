# Clip Magic 完整实现与完善计划

> **For Claude:** 按任务逐步实现。每个 Task 可独立执行。

**Goal:** 将 Clip Magic 从原型打磨为生产可用的 AI 影视剪辑工具，修复所有已知缺陷，补全关键功能，提升代码健壮性。

**Architecture:** 4 个 Phase 递进：P0 紧急修复 → P1 核心完善 → P2 增强服务 → P3 体验优化。每个 Task 包含具体的文件路径、代码变更和测试方法。

**Tech Stack:** Python 3.13, FastAPI, faster-whisper, OpenAI SDK (DeepSeek), FFmpeg, React + TypeScript, Tailwind CSS

---

## 🚨 Phase 0: 紧急修复 (当前必做)

### Task P0-1: 修复 cover_generator 时间戳越界崩溃

**问题:** 当 LLM 生成的时间戳超出视频实际时长时，`_extract_frame` 调用 FFmpeg seek 失败（返回码 4294967274），导致整个流程崩溃。

**Files:**
- Modify: `clip_magic/stages/cover_generator.py:29-40`

**实现:**

```python
# cover_generator.py 中的 generate_cover 函数，修改帧提取逻辑
def generate_cover(video_path, title, rank, timestamp_ms, output_path):
    import subprocess
    from pathlib import Path

    thumb_path = Path(output_path).with_suffix(".thumb.jpg")

    result = subprocess.run(
        [settings.ffmpeg_path, "-y", "-i", video_path],
        capture_output=True, encoding='utf-8', errors='ignore'
    )

    video_duration_sec = 0
    import re
    for line in (result.stderr + result.stdout).split('\n'):
        m = re.search(r'Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})', line)
        if m:
            h, mn, s, cs = int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4))
            video_duration_sec = h * 3600 + mn * 60 + s + cs / 100
            break

    # 关键修复: 确保时间戳不超出视频边界
    safe_ts = min(timestamp_ms / 1000, max(0, video_duration_sec - 1))
    try:
        _extract_frame(video_path, int(safe_ts * 1000), str(thumb_path))
    except Exception:
        thumb_path = None  # 提取失败则跳过，使用纯色背景

    if thumb_path and thumb_path.exists():
        try:
            cover = _create_cover_image(str(thumb_path), title, rank)
        except Exception:
            cover = _create_cover_image(None, title, rank)  # 降级到纯色背景
    else:
        cover = _create_cover_image(None, title, rank)

    cover.save(output_path, quality=95)
    if thumb_path:
        thumb_path.unlink(missing_ok=True)
    return output_path
```

**测试:**
```bash
cd c:\Users\hexi\Desktop\VScode\clip-magic
$env:CLIP_MAGIC_WHISPER_DEVICE="cpu"
$env:CLIP_MAGIC_WHISPER_COMPUTE_TYPE="int8"
python e2e_test.py --real
# 预期: 封面生成阶段不再 crash，降级到纯色背景
```

---

### Task P0-2: 修复 clip_engine 空片段裁剪边界

**问题:** 当视频只有 60 秒但 LLM 返回 120s-165s 的片段时，FFmpeg 裁剪会尝试超出视频边界的 seek。

**Files:**
- Modify: `clip_magic/stages/clip_engine.py:19-55`

**实现:**

```python
# 在 clip_segments 函数中，裁剪前添加边界检查
def clip_segments(video_path, highlights, output_dir="./output"):
    from clip_magic.stages.audio_extractor import get_video_duration

    video_duration_ms = int(get_video_duration(video_path) * 1000)

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    video_stem = Path(video_path).stem
    results = []

    for hl in highlights:
        # 关键修复: 确保时间戳不超出视频边界
        safe_start = max(0, hl.start_ms)
        safe_end = min(video_duration_ms, hl.end_ms)
        if safe_end - safe_start < 1000:  # 最少 1 秒
            safe_end = min(video_duration_ms, safe_start + 1000)

        start_sec = safe_start / 1000
        end_sec = safe_end / 1000
        duration = end_sec - start_sec

        safe_title = "".join(c for c in hl.title if c.isalnum() or c in " _-")[:20]
        output_name = f"{video_stem}_clip{hl.rank:02d}_{safe_title}.mp4"
        output_path = str(output_dir / output_name)

        cmd = [
            settings.ffmpeg_path, "-y",
            "-ss", str(start_sec),
            "-i", video_path,
            "-t", str(duration),
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "23",
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",
            output_path,
        ]

        try:
            subprocess.run(cmd, check=True, capture_output=True, encoding='utf-8', errors='ignore')
        except subprocess.CalledProcessError:
            continue  # 单个片段失败不影响其他

        results.append(ClipResult(
            rank=hl.rank,
            output_path=output_path,
            start_ms=safe_start,
            end_ms=safe_end,
            title=hl.title,
        ))

    return results
```

**测试:** 同上 P0-1 的 e2e 测试。

---

### Task P0-3: 修复 subtitle_burner 空列表崩溃

**问题:** `burn_subtitles_to_clip` 在 segments 为空列表时，`segments[0]` 会崩溃。

**Files:**
- Modify: `clip_magic/stages/subtitle_burner.py:28-29`

**实现:**

```python
# 在 burn_subtitles_to_clip 函数开头添加保护
def burn_subtitles_to_clip(video_path, segments, output_path):
    if not segments:
        # 无字幕时直接复制原始文件作为字幕版
        import shutil
        shutil.copy2(video_path, output_path)
        return output_path

    video_duration = _get_video_duration(video_path)
    clip_start_ms = segments[0].start_ms
    # ... 后续代码不变
```

**测试:**
```bash
python -c "from clip_magic.stages.subtitle_burner import burn_subtitles_to_clip; burn_subtitles_to_clip('test_video.mp4', [], 'test_output.mp4'); print('OK: empty segments handled')"
```

---

## 🏗️ Phase 1: 核心功能完善

### Task P1-1: 为 highlight_detector 添加字幕有效性校验

**问题:** 当 Whisper 返回 0 个片段时，LLM 仍然收到空上下文并生成随机时间戳。

**Files:**
- Modify: `clip_magic/stages/highlight_detector.py:231-234`

**实现:**

```python
def detect_highlights(segments):
    if not segments or len(segments) == 0:
        return []

    duration_ms = settings.highlight_duration_sec * 1000
    candidates = _rough_filter(segments, duration_ms)
    return _llm_select(candidates, duration_ms)
```

同时修改 `pipeline.py` 中调用 `detect_highlights` 后的处理逻辑，当返回空列表时给出更明确的提示：

```python
# pipeline.py 中的处理
highlights = detect_highlights(segments)
if len(highlights) == 0:
    console.print("[red]未能检测到有效高光片段，建议使用包含清晰语音的视频[/red]")
    return
```

**测试:**
```bash
cd c:\Users\hexi\Desktop\VScode\clip-magic
python -m pytest tests/test_highlight_detector.py -v
```

---

### Task P1-2: 统一 video_duration 获取函数，消除重复代码

**问题:** `audio_extractor.py`、`cover_generator.py`、`subtitle_burner.py`、`clip_engine.py` 各自实现了重复的视频时长解析逻辑。

**Files:**
- Modify: `clip_magic/stages/audio_extractor.py` (已是单一来源)
- Modify: `clip_magic/stages/cover_generator.py:24-39` (改用 audio_extractor 的函数)
- Modify: `clip_magic/stages/subtitle_burner.py:12-20` (改用 audio_extractor 的函数)
- Modify: `clip_magic/stages/clip_engine.py` (改用 audio_extractor 的函数)

**实现:**

所有文件统一使用 `from clip_magic.stages.audio_extractor import get_video_duration`，删除各自的重复实现。

---

### Task P1-3: 完善 e2e_test.py 边界参数处理

**问题:** e2e_test.py 在 Whisper 返回 0 片段时仍跑后续阶段，应提前退出或降级。

**Files:**
- Modify: `e2e_test.py:102-125`

**实现:**

```python
# Stage 2 之后添加检查
segments = transcribe(str(audio_info.path))
if len(segments) == 0:
    print("  WARNING: No speech detected. Using mock segments for demo purposes.")
    segments = build_mock_segments(audio_duration_ms)

# Stage 3 之后添加检查  
highlights = detect_highlights(segments)
if len(highlights) == 0:
    print("  ERROR: No highlights could be identified.")
    return
```

---

### Task P1-4: 添加 pip install -e . 的支持文档

**问题:** 测试流程需要 `pip install -e .` 安装项目才能在任何目录使用命令。

**Files:**
- Create: `clip-magic/install.bat`

**内容:**

```batch
@echo off
cd /d "%~dp0"
echo Installing Clip Magic...
pip install -e .
echo.
echo Done! You can now use 'clip-magic' from any directory.
echo Try: clip-magic --help
pause
```

---

## 🌐 Phase 2: Web 服务增强

### Task P2-1: server.py 集成音频检测和智能降级

**问题:** `server.py` 中的 `_process_job` 函数仍使用旧的 4 阶段流程（无音频检测、无封面/字幕），且未集成新的音频检测和 Whisper 降级逻辑。

**Files:**
- Modify: `clip_magic/server.py:67-123`

**实现:**

```python
# _process_job 函数更新为：
def _process_job(job_id: str, video_path: str):
    try:
        job_dir = OUTPUT_BASE / job_id
        job_dir.mkdir(parents=True, exist_ok=True)

        _report_progress(job_id, "extracting", 0.05, "正在检测音频...")
        from clip_magic.stages.audio_extractor import has_valid_audio
        audio_ok, confidence, msg = has_valid_audio(video_path)
        
        _report_progress(job_id, "extracting", 0.10, f"音频检测: {'通过' if audio_ok else '警告'}")
        audio_info = extract_audio(video_path, str(job_dir))
        
        _report_progress(job_id, "transcribing", 0.20, "Whisper 语音转文字中...")
        segments = transcribe(str(audio_info.path))
        
        use_mock = len(segments) == 0
        if use_mock:
            from clip_magic.pipeline import _create_mock_segments
            segments = _create_mock_segments(audio_info.duration_sec)
        
        _report_progress(job_id, "transcribing", 0.50, 
                         f"识别完成 ({len(segments)} 段, {'模拟' if use_mock else '真实'})")
        
        _report_progress(job_id, "analyzing", 0.55, "LLM 分析高光片段...")
        highlights = detect_highlights(segments)
        
        if len(highlights) == 0:
            raise RuntimeError("未检测到有效高光片段，请使用包含清晰语音的视频")
        
        _report_progress(job_id, "analyzing", 0.70, f"找到 {len(highlights)} 个高光片段")
        
        # ... 后续裁剪、封面、字幕逻辑保持不变
```

---

### Task P2-2: Frontend 添加音频状态和模式提示

**问题:** 前端 `ProgressPage.tsx` 没有显示当前是真实转录还是模拟模式。

**Files:**
- Modify: `frontend/src/components/ProgressPage.tsx`

**实现:**

在前端进度显示中增加：
- 音频置信度百分比指示器
- 转录模式标记（真实/模拟）
- LLM 分析模式标记

```tsx
// ProgressPage.tsx 中添加
interface ProgressData {
  stage: string;
  progress: number;
  message: string;
  transcription_mode?: string;  // 'real' | 'mock'
  analysis_mode?: string;       // 'llm' | 'fallback'
}

// 在 UI 中渲染
{data.transcription_mode === 'mock' && (
  <div className="text-yellow-500 text-sm">
    ⚠️ 使用模拟字幕（未检测到语音）
  </div>
)}
```

---

## 🔧 Phase 3: 代码健壮性与体验优化

### Task P3-1: 添加 CLI `check` 命令 — 一键环境诊断

**问题:** 用户需要分别运行 `config`、`model status`、`test-llm` 三个命令才能了解环境状态。

**Files:**
- Modify: `clip_magic/cli.py`

**实现:**

```python
@cli.command()
def check():
    """一键诊断环境是否就绪"""
    console.print(Panel.fit("[bold cyan]Clip Magic — 环境诊断[/bold cyan]"))

    checks = []

    # 1. FFmpeg
    ffmpeg_path = settings.ffmpeg_path
    try:
        subprocess.run([ffmpeg_path, "-version"], capture_output=True, check=True)
        checks.append(("FFmpeg", "✓", "green", ffmpeg_path))
    except:
        checks.append(("FFmpeg", "✗ 未找到", "red", ""))

    # 2. Whisper 模型
    if is_model_cached(settings.whisper_model_size):
        checks.append(("Whisper 模型", "✓ 已缓存", "green", settings.whisper_model_size))
    else:
        checks.append(("Whisper 模型", "✗ 未下载", "red", "运行: clip-magic model download"))

    # 3. LLM API
    if settings.has_valid_llm_key():
        ok, msg = test_llm_connection()
        if ok:
            checks.append(("LLM API", "✓ 连接成功", "green", f"{settings.llm_model}"))
        else:
            checks.append(("LLM API", "✗ 连接失败", "red", msg[:40]))
    else:
        checks.append(("LLM API", "⚠ 未配置", "yellow", "编辑 .env 配置 API Key"))

    # 4. CUDA
    try:
        import torch
        cuda_ok = torch.cuda.is_available()
        checks.append(("CUDA", "✓ 可用" if cuda_ok else "⚠ 不可用 (将使用CPU)", 
                       "green" if cuda_ok else "yellow", ""))
    except:
        checks.append(("CUDA", "⚠ PyTorch 未安装 (将使用CPU)", "yellow", ""))

    table = Table(title="诊断结果", border_style="cyan")
    table.add_column("项目", style="bold")
    table.add_column("状态")
    table.add_column("详情", style="dim")
    for name, status, color, detail in checks:
        table.add_row(name, f"[{color}]{status}[/{color}]", detail)
    console.print(table)

    all_ok = all(c[2] == "green" for c in checks if c[2] not in ("yellow",))
    if not all_ok:
        console.print("\n[yellow]部分检查未通过，请根据提示进行配置[/yellow]")
    else:
        console.print("\n[green]环境就绪，可以开始使用！[/green]")
```

**测试:**
```bash
python -m clip_magic.cli check
```

---

### Task P3-2: 添加统一的日志系统

**问题:** 当前各模块使用 `print` 输出，没有统一的日志记录，不利于调试和生产环境排查。

**Files:**
- Create: `clip_magic/logger.py`
- Modify: 所有 `clip_magic/stages/*.py`、`clip_magic/pipeline.py`、`clip_magic/server.py`

**实现:**

```python
# clip_magic/logger.py
import logging
import sys
from pathlib import Path

def setup_logger(name: str = "clip-magic", level: int = logging.INFO) -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    logger.setLevel(level)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_fmt = logging.Formatter("[%(levelname)s] %(name)s: %(message)s")
    console_handler.setFormatter(console_fmt)
    logger.addHandler(console_handler)

    log_dir = Path.home() / ".cache" / "clip-magic-logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    file_handler = logging.FileHandler(log_dir / "app.log", encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s:%(lineno)d: %(message)s")
    file_handler.setFormatter(file_fmt)
    logger.addHandler(file_handler)

    return logger

logger = setup_logger()
```

**要点更新（逐个文件）:**
- `clip_engine.py` 中 `subprocess.run` 失败时记录 `logger.error`
- `transcriber.py` 中模型加载失败时记录详细错误
- `cover_generator.py` 中帧提取失败时记录 `logger.warning`
- `highlight_detector.py` 中 LLM 调用失败时记录 `logger.warning`

---

### Task P3-3: 增加更多单元测试

**当前覆盖率:** 仅 `highlight_detector.py` 有 3 个测试。

**Files:**
- Create: `tests/test_audio_extractor.py`
- Create: `tests/test_clip_engine.py`
- Create: `tests/test_cover_generator.py`

**实现:**

```python
# tests/test_audio_extractor.py
def test_detect_audio_silent():
    """生成静音 WAV，验证 detect 返回 False"""
    pass

def test_detect_audio_normal():
    """使用 test_video.mp4，验证 detect 返回 True"""
    pass

# tests/test_clip_engine.py  
def test_clip_empty_highlights():
    """空 highlights 列表不崩溃"""
    pass

def test_clip_boundary_start():
    """时间戳越界时自动修正"""
    pass

# tests/test_cover_generator.py
def test_cover_with_invalid_timestamp():
    """时间戳超出视频时长时降级到纯色背景"""
    pass
```

---

### Task P3-4: 添加 .gitignore 清理

**问题:**
- `output_e2e/`、`temp_e2e/` 目录中的测试输出不应提交
- `__pycache__/` 目录较多
- 测试用的大文件在根目录（如 `0.0.6`、`10.0.0` 等二进制文件）

**Files:**
- Modify: `.gitignore`

**追加内容:**
```
output_e2e/
temp_e2e/
output_test/
*.pyc
__pycache__/
*.thumb.jpg
*.ass
dist/
.pytest_cache/
```

---

## 📋 执行顺序建议

```
Phase 0 (先做):
  P0-1 → P0-2 → P0-3  (修复核心崩溃，可并行)

Phase 1 (再做):
  P1-1 → P1-2 → P1-3 → P1-4

Phase 2 (后端准备好后):
  P2-1 → P2-2

Phase 3 (优化加固):
  P3-1 → P3-2 → P3-3 → P3-4
```

---

## 🔍 验证清单

完成所有 Phase 后，执行以下验证：

```bash
# 1. 单元测试全部通过
cd c:\Users\hexi\Desktop\VScode\clip-magic
python -m pytest tests/ -v

# 2. E2E 测试 Mock 模式
$env:CLIP_MAGIC_WHISPER_DEVICE="cpu"
$env:CLIP_MAGIC_WHISPER_COMPUTE_TYPE="int8"
python e2e_test.py --mock

# 3. CLI 诊断命令
python -m clip_magic.cli check

# 4. Server 启动测试
python -m clip_magic.server
# 浏览器访问 http://localhost:8787
```