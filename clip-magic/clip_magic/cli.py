import click

from clip_magic.pipeline import run_pipeline
from clip_magic.model_downloader import download_model, show_status, AVAILABLE_MODELS
from clip_magic.config import settings, LLM_PROVIDER_PRESETS
from clip_magic.stages.highlight_detector import test_llm_connection
from clip_magic.model_downloader import is_model_cached, get_model_dir

from rich.console import Console
from rich.table import Table
from rich.panel import Panel

console = Console()


@click.group()
def cli():
    """Clip Magic — AI 自动影视/播客高光切片生成器"""
    pass


@cli.command()
@click.argument("video_path", type=click.Path(exists=True))
@click.option("--output-dir", "-o", default="./output", help="输出目录")
@click.option("--count", "-n", default=3, help="高光片段数量")
@click.option("--duration", "-d", default=45, help="每个片段的时长（秒）")
@click.option("--skip-audio-check", is_flag=True, default=False, help="跳过音频检测")
def run(video_path: str, output_dir: str, count: int, duration: int, skip_audio_check: bool):
    """处理视频，生成 AI 高光片段

    VIDEO_PATH: 输入视频文件路径（支持 mp4/mov/mkv 等格式）
    """
    run_pipeline(
        video_path=video_path,
        output_dir=output_dir,
        highlight_count=count,
        highlight_duration=duration,
        skip_audio_check=skip_audio_check,
    )


@cli.group()
def model():
    """Whisper 模型管理：查看状态、下载模型"""
    pass


@model.command("status")
def model_status():
    """查看已缓存的 Whisper 模型和可用模型列表"""
    show_status()


@model.command("download")
@click.option("--size", "-s", default="medium",
              type=click.Choice(list(AVAILABLE_MODELS.keys())),
              help="模型大小 (默认: medium)")
@click.option("--source", type=click.Choice(["hf_mirror", "modelscope", "faster_whisper"]),
              help="指定下载源")
def model_download(size: str, source: str):
    """下载 Whisper 模型到本地缓存

    支持从以下来源下载：
    \b
    - hf_mirror: HuggingFace 国内镜像 (hf-mirror.com)
    - modelscope: ModelScope 魔搭社区
    - faster_whisper: faster-whisper 内置下载器

    \b
    示例：
      clip-magic model download                    # 下载 medium 模型（自动选择源）
      clip-magic model download -s small           # 下载 small 模型
      clip-magic model download -s base --source modelscope  # 从 ModelScope 下载 base
    """
    success = download_model(size, source)
    if not success:
        raise click.Abort()


@cli.command()
def config():
    """显示当前配置和连接状态"""
    console.print(Panel.fit("[bold cyan]Clip Magic — 配置状态[/bold cyan]", border_style="cyan"))

    whisper_table = Table(title="Whisper 语音识别", border_style="cyan")
    whisper_table.add_column("配置项", style="bold")
    whisper_table.add_column("当前值", style="cyan")
    whisper_table.add_column("状态")

    model_size = settings.whisper_model_size
    cached = is_model_cached(model_size)
    model_status_text = "[green]已缓存[/green]" if cached else "[red]未下载[/red] 运行 `clip-magic model download`"
    whisper_table.add_row("模型大小", model_size, model_status_text)
    whisper_table.add_row("设备", settings.whisper_device, "")
    whisper_table.add_row("计算精度", settings.whisper_compute_type, "")
    if cached:
        whisper_table.add_row("缓存路径", str(get_model_dir(model_size)), "")
    console.print(whisper_table)

    console.print()

    llm_table = Table(title="LLM 高光分析", border_style="cyan")
    llm_table.add_column("配置项", style="bold")
    llm_table.add_column("当前值", style="cyan")
    llm_table.add_column("状态")

    llm_table.add_row("Provider", str(settings.llm_provider or "手动配置"), "")
    llm_table.add_row("API Base", settings.llm_base_url, "")
    llm_table.add_row("Model", settings.llm_model, "")
    key_masked = settings.llm_api_key[:8] + "..." + settings.llm_api_key[-4:] if len(settings.llm_api_key) > 12 else "***"
    key_valid = "[green]有效[/green]" if settings.has_valid_llm_key() else "[red]未配置/占位符[/red]"
    llm_table.add_row("API Key", key_masked, key_valid)
    console.print(llm_table)

    console.print()

    if settings.has_valid_llm_key():
        console.print("[cyan]正在测试 LLM 连接...[/cyan]")
        ok, msg = test_llm_connection()
        if ok:
            console.print(f"[green]  [OK] {msg}[/green]")
        else:
            console.print(f"[red]  [XX] {msg}[/red]")
    else:
        console.print("[yellow]提示: 配置有效的 LLM API Key 后可启用 AI 高光分析[/yellow]")
        console.print("[dim]支持: OpenAI / DeepSeek / 通义千问 / 智谱 / Kimi / 硅基流动 / Ollama[/dim]")
        console.print("[dim]配置方式: 编辑 .env 文件，设置 CLIP_MAGIC_LLM_API_KEY 和 CLIP_MAGIC_LLM_PROVIDER[/dim]")

    console.print()

    output_table = Table(title="输出配置", border_style="cyan")
    output_table.add_column("配置项", style="bold")
    output_table.add_column("当前值", style="cyan")
    output_table.add_row("高光数量", str(settings.highlight_count))
    output_table.add_row("每段时长", f"{settings.highlight_duration_sec}s")
    output_table.add_row("输出目录", settings.output_dir)
    console.print(output_table)


@cli.command()
@click.option("--provider", "-p", type=click.Choice(list(LLM_PROVIDER_PRESETS.keys())),
              help="使用 LLM Provider 预设")
def test_llm(provider: str):
    """测试 LLM 连接是否正常"""
    if provider:
        settings.apply_provider_preset(provider)
        console.print(f"[cyan]使用 Provider: {provider}[/cyan]")
        console.print(f"  Base URL: {settings.llm_base_url}")
        console.print(f"  Model: {settings.llm_model}")

    console.print("[cyan]正在测试 LLM 连接...[/cyan]")
    ok, msg = test_llm_connection()
    if ok:
        console.print(f"[green][OK] {msg}[/green]")
    else:
        console.print(f"[red][XX] {msg}[/red]")
        console.print("\n[yellow]故障排查:[/yellow]")
        console.print("  1. 检查 .env 中 CLIP_MAGIC_LLM_API_KEY 是否正确")
        console.print("  2. 检查 CLIP_MAGIC_LLM_BASE_URL 是否可访问")
        console.print("  3. 尝试使用其他 Provider 预设: --provider deepseek")


@cli.command()
def check():
    """一键诊断环境是否就绪"""
    import subprocess as sp

    console.print(Panel.fit("[bold cyan]Clip Magic — 环境诊断[/bold cyan]", border_style="cyan"))

    checks = []

    ffmpeg_path = settings.ffmpeg_path
    try:
        sp.run([ffmpeg_path, "-version"], capture_output=True, check=True)
        checks.append(("FFmpeg", "[OK] 可用", "green", ffmpeg_path))
    except Exception:
        checks.append(("FFmpeg", "[XX] 未找到", "red", "请安装 FFmpeg"))

    if is_model_cached(settings.whisper_model_size):
        checks.append(("Whisper 模型", "[OK] 已缓存", "green", settings.whisper_model_size))
    else:
        checks.append(("Whisper 模型", "[XX] 未下载", "red",
                        f"运行: clip-magic model download -s {settings.whisper_model_size}"))

    if settings.has_valid_llm_key():
        ok, msg = test_llm_connection()
        if ok:
            checks.append(("LLM API", "[OK] 连接成功", "green",
                           f"{settings.llm_provider or 'custom'}/{settings.llm_model}"))
        else:
            checks.append(("LLM API", "[XX] 连接失败", "red", msg[:50]))
    else:
        checks.append(("LLM API", "[!!] 未配置 Key", "yellow", "编辑 .env 配置 API Key"))

    try:
        import torch
        if torch.cuda.is_available():
            checks.append(("CUDA", "[OK] 可用", "green", f"GPU: {torch.cuda.get_device_name(0)}"))
        else:
            checks.append(("CUDA", "[!!] 不可用 (将使用CPU)", "yellow", ""))
    except Exception:
        checks.append(("CUDA", "[!!] PyTorch 未安装", "yellow", "仅支持 CPU"))

    try:
        import cv2
        checks.append(("OpenCV", "[OK] 可用", "green", ""))
    except Exception:
        checks.append(("OpenCV", "[XX] 缺失", "red", "字幕烧录需要"))

    table = Table(title="诊断结果", border_style="cyan")
    table.add_column("项目", style="bold")
    table.add_column("状态")
    table.add_column("详情", style="dim", max_width=60)
    for name, status, color, detail in checks:
        table.add_row(name, f"[{color}]{status}[/{color}]", detail)
    console.print(table)

    all_ok = all(c[2] == "green" for c in checks)
    console.print()
    if all_ok:
        console.print("[bold green][OK] 环境全部就绪，可以开始使用！[/bold green]")
    else:
        console.print("[yellow]部分检查未通过，请根据提示进行配置[/yellow]")


def main():
    cli()


if __name__ == "__main__":
    main()