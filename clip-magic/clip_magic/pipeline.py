from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TimeElapsedColumn
from rich.panel import Panel
from rich.table import Table

from clip_magic.config import settings
from clip_magic.stages.audio_extractor import extract_audio, has_valid_audio
from clip_magic.stages.transcriber import transcribe
from clip_magic.stages.highlight_detector import detect_highlights, HighlightClip
from clip_magic.stages.clip_engine import clip_segments, ClipResult

console = Console()


def run_pipeline(
    video_path: str,
    output_dir: str = "./output",
    highlight_count: Optional[int] = None,
    highlight_duration: Optional[int] = None,
    skip_audio_check: bool = False,
):
    if highlight_count is not None:
        settings.highlight_count = highlight_count
    if highlight_duration is not None:
        settings.highlight_duration_sec = highlight_duration

    video_path = str(Path(video_path).resolve())
    output_dir = str(Path(output_dir).resolve())

    if not Path(video_path).exists():
        console.print(f"[red]错误: 文件不存在: {video_path}[/red]")
        return

    if not skip_audio_check:
        console.print("[cyan]正在检测音频内容...[/cyan]")
        audio_ok, confidence, message = has_valid_audio(video_path)
        if not audio_ok:
            console.print(f"[red]错误: {message}[/red]")
            console.print()
            console.print("[yellow]建议:[/yellow]")
            console.print("  1. 请确保视频文件包含清晰的语音内容")
            console.print("  2. 检查视频是否有足够的音量")
            console.print("  3. 如果确定视频有音频，可使用 --skip-audio-check 参数跳过检测")
            console.print()
            console.print(f"[dim]音频置信度: {confidence:.2f}[/dim]")
            return
        console.print(f"[green]音频检测通过 (置信度: {confidence:.2f})[/green]")
        console.print()

    use_llm = settings.has_valid_llm_key()
    analysis_mode = "[bold green]LLM 语义分析[/bold green]" if use_llm else "[bold yellow]规则评分 (未配置 API Key)[/bold yellow]"

    console.print(Panel.fit(
        f"[bold cyan]Clip Magic[/bold cyan] — AI 高光切片生成器\n"
        f"输入: {Path(video_path).name}\n"
        f"目标: {settings.highlight_count} 个片段 × {settings.highlight_duration_sec}s\n"
        f"分析: {analysis_mode}",
        border_style="cyan"
    ))

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TimeElapsedColumn(),
        console=console,
    ) as progress:

        task = progress.add_task("[cyan]Stage 1/4: 分离音轨...", total=4)

        audio_info = extract_audio(video_path, output_dir)
        progress.update(task, advance=1, description="[green]Stage 1/4: 音轨分离完成")

        task2 = progress.add_task("[cyan]Stage 2/4: Whisper 语音转文字...", total=1)
        segments = transcribe(str(audio_info.path))

        if len(segments) == 0:
            console.print()
            console.print("[red]警告: Whisper 未能识别到任何语音内容[/red]")
            console.print("[yellow]可能原因:[/yellow]")
            console.print("  - 视频没有语音内容")
            console.print("  - 音频质量太差")
            console.print("  - 说话声音太小或语速过快")
            console.print()
            console.print("[yellow]将使用模拟字幕进行演示...[/yellow]")
            segments = _create_mock_segments(audio_info.duration_sec)

        progress.update(task2, advance=1, description=f"[green]Stage 2/4: 识别完成 ({len(segments)} 段)")

        task3 = progress.add_task("[cyan]Stage 3/4: 分析高光片段...", total=1)
        highlights = detect_highlights(segments)
        mode_label = "LLM" if use_llm else "规则"
        progress.update(task3, advance=1,
                        description=f"[green]Stage 3/4: 找到 {len(highlights)} 个高光片段 ({mode_label})")

        task4 = progress.add_task("[cyan]Stage 4/4: FFmpeg 裁剪中...", total=1)
        results = clip_segments(video_path, highlights, output_dir)
        progress.update(task4, advance=1, description="[green]Stage 4/4: 裁剪完成")

    console.print()
    console.print("[bold green]处理完成！[/bold green]")
    console.print()

    table = Table(title="高光片段", border_style="cyan")
    table.add_column("排名", style="cyan", justify="center")
    table.add_column("标题", style="bold")
    table.add_column("时间段", style="dim")
    table.add_column("评分", justify="center")
    table.add_column("推荐理由", style="italic")

    for r in results:
        start_str = f"{r.start_ms // 60000:02d}:{(r.start_ms // 1000) % 60:02d}"
        end_str = f"{r.end_ms // 60000:02d}:{(r.end_ms // 1000) % 60:02d}"
        hl = next((h for h in highlights if h.rank == r.rank), None)
        score = f"{hl.score:.1f}" if hl else "-"
        reason = hl.reason if hl else "-"

        table.add_row(
            f"#{r.rank}",
            r.title,
            f"{start_str} - {end_str}",
            score,
            reason,
        )

    console.print(table)
    console.print()
    console.print("[bold]输出文件:[/bold]")
    for r in results:
        console.print(f"    {r.output_path}")

    return results


def _create_mock_segments(duration_sec: float) -> list:
    from clip_magic.stages.transcriber import SubtitleSegment

    segments = []
    sentences = [
        ("大家好欢迎来到今天的节目", 0, 5),
        ("今天我们要讨论一个非常有趣的话题", 5, 10),
        ("你们绝对想不到接下来会发生什么", 10, 15),
        ("这简直太不可思议了", 15, 18),
        ("让我来给大家详细解释一下", 25, 30),
        ("首先我们来看第一个关键点", 30, 35),
        ("这个发现彻底改变了我们的认知", 35, 40),
        ("接下来是最精彩的部分", 45, 50),
        ("这一定会让你感到震惊", 50, 55),
        ("感谢大家的观看我们下次再见", 55, 60),
    ]

    for text, start_sec, end_sec in sentences:
        if end_sec <= duration_sec:
            segments.append(SubtitleSegment(
                text=text,
                start_ms=int(start_sec * 1000),
                end_ms=int(end_sec * 1000),
                confidence=0.9,
            ))

    return segments