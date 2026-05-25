import os
import sys
import shutil
import hashlib
import subprocess
from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.progress import Progress, BarColumn, TextColumn, TimeElapsedColumn
from rich.panel import Panel
from rich.table import Table

console = Console()

HF_MIRROR = "https://hf-mirror.com"
MODELSCOPE_BASE = "https://modelscope.cn/models"
MODEL_CACHE_DIR = Path.home() / ".cache" / "clip-magic-models"

AVAILABLE_MODELS = {
    "tiny": {"name": "tiny", "size_mb": 150, "vram": "~1 GB"},
    "base": {"name": "base", "size_mb": 290, "vram": "~1 GB"},
    "small": {"name": "small", "size_mb": 950, "vram": "~2 GB"},
    "medium": {"name": "medium", "size_mb": 3100, "vram": "~5 GB"},
    "large-v2": {"name": "large-v2", "size_mb": 6200, "vram": "~10 GB"},
    "large-v3": {"name": "large-v3", "size_mb": 6200, "vram": "~10 GB"},
}

WHISPER_REPO = "Systran/faster-whisper-{}"
MODELSCOPE_REPO = "keepitsimple/faster-whisper-{}"


def get_model_dir(model_size: str = "medium") -> Path:
    return MODEL_CACHE_DIR / model_size


def is_model_cached(model_size: str = "medium") -> bool:
    model_dir = get_model_dir(model_size)
    if not model_dir.exists():
        return False
    model_bin = model_dir / "model.bin"
    return model_bin.exists() and model_bin.stat().st_size > 100 * 1024 * 1024


def _parse_size(size_str: str) -> int:
    try:
        return int(size_str)
    except ValueError:
        return 0


def download_from_hf_mirror(model_size: str = "medium") -> bool:
    model_dir = get_model_dir(model_size)
    model_dir.mkdir(parents=True, exist_ok=True)

    os.environ.setdefault("HF_ENDPOINT", HF_MIRROR)

    try:
        from huggingface_hub import snapshot_download, hf_hub_download
    except ImportError:
        console.print("[yellow]huggingface_hub not installed, trying pip install...[/yellow]")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "huggingface-hub"])
        from huggingface_hub import snapshot_download, hf_hub_download

    repo_id = WHISPER_REPO.format(model_size)

    console.print(f"[cyan]Downloading {model_size} from HF Mirror...[/cyan]")
    console.print(f"  Repo: {repo_id}")
    console.print(f"  Cache: {model_dir}")

    try:
        snapshot_download(
            repo_id=repo_id,
            local_dir=str(model_dir),
            local_dir_use_symlinks=False,
            resume_download=True,
            max_workers=4,
        )
        if is_model_cached(model_size):
            console.print(f"[green]Download complete: {model_dir}[/green]")
            return True
        else:
            console.print("[red]Download completed but model.bin not found or too small[/red]")
            return False
    except Exception as e:
        console.print(f"[red]HF Mirror download failed: {e}[/red]")
        return False


def download_from_modelscope(model_size: str = "medium") -> bool:
    model_dir = get_model_dir(model_size)
    model_dir.mkdir(parents=True, exist_ok=True)

    try:
        from modelscope.hub.snapshot_download import snapshot_download
    except ImportError:
        console.print("[yellow]modelscope not installed, trying pip install...[/yellow]")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "modelscope"])
        from modelscope.hub.snapshot_download import snapshot_download

    repo_id = MODELSCOPE_REPO.format(model_size)

    console.print(f"[cyan]Downloading {model_size} from ModelScope...[/cyan]")
    console.print(f"  Repo: {repo_id}")
    console.print(f"  Cache: {model_dir}")

    try:
        downloaded = snapshot_download(
            repo_id,
            cache_dir=str(MODEL_CACHE_DIR.parent),
        )

        if downloaded != str(model_dir):
            if Path(downloaded).exists():
                for item in Path(downloaded).iterdir():
                    dest = model_dir / item.name
                    if not dest.exists():
                        if item.is_dir():
                            shutil.copytree(str(item), str(dest))
                        else:
                            shutil.copy2(str(item), str(dest))

        if is_model_cached(model_size):
            console.print(f"[green]Download complete: {model_dir}[/green]")
            return True
        else:
            console.print("[red]Download completed but model.bin not found[/red]")
            return False
    except Exception as e:
        console.print(f"[red]ModelScope download failed: {e}[/red]")
        return False


def download_from_faster_whisper(model_size: str = "medium") -> bool:
    model_dir = get_model_dir(model_size)
    model_dir.mkdir(parents=True, exist_ok=True)

    os.environ.setdefault("HF_ENDPOINT", HF_MIRROR)

    console.print(f"[cyan]Downloading {model_size} via faster-whisper built-in downloader...[/cyan]")

    try:
        from faster_whisper import WhisperModel
        model = WhisperModel(
            model_size,
            device="cpu",
            compute_type="int8",
            download_root=str(model_dir.parent),
        )
        if is_model_cached(model_size):
            console.print(f"[green]Download complete: {model_dir}[/green]")
            return True
        return False
    except Exception as e:
        console.print(f"[red]faster-whisper download failed: {e}[/red]")
        return False


def download_model(
    model_size: str = "medium",
    source: Optional[str] = None,
) -> bool:
    if model_size not in AVAILABLE_MODELS:
        console.print(f"[red]Unknown model size: {model_size}[/red]")
        console.print(f"Available: {', '.join(AVAILABLE_MODELS.keys())}")
        return False

    if is_model_cached(model_size):
        console.print(f"[green]Model '{model_size}' already cached at {get_model_dir(model_size)}[/green]")
        return True

    info = AVAILABLE_MODELS[model_size]
    console.print(Panel.fit(
        f"[bold cyan]Model Download: {model_size}[/bold cyan]\n"
        f"Size: ~{info['size_mb']} MB\n"
        f"VRAM: {info['vram']}\n"
        f"Cache Dir: {MODEL_CACHE_DIR}",
        border_style="cyan"
    ))

    sources = [source] if source else ["hf_mirror", "modelscope", "faster_whisper"]

    for src in sources:
        if src == "hf_mirror":
            if download_from_hf_mirror(model_size):
                return True
        elif src == "modelscope":
            if download_from_modelscope(model_size):
                return True
        elif src == "faster_whisper":
            if download_from_faster_whisper(model_size):
                return True

    console.print(f"\n[red]All download sources failed for '{model_size}'[/red]")
    console.print("\n[yellow]Manual download instructions:[/yellow]")
    console.print(f"  1. Visit: {HF_MIRROR}/{WHISPER_REPO.format(model_size)}")
    console.print(f"  2. Download all files to: {get_model_dir(model_size)}")
    console.print(f"  3. Ensure model.bin exists and is > 100 MB")
    return False


def list_cached_models() -> list[str]:
    if not MODEL_CACHE_DIR.exists():
        return []
    cached = []
    for d in sorted(MODEL_CACHE_DIR.iterdir()):
        if d.is_dir() and (d / "model.bin").exists():
            size_mb = (d / "model.bin").stat().st_size / (1024 * 1024)
            cached.append((d.name, size_mb))
    return cached


def show_status():
    console.print(Panel.fit("[bold cyan]Clip Magic — Model Status[/bold cyan]", border_style="cyan"))

    cached = list_cached_models()
    if cached:
        table = Table(title="Cached Models", border_style="green")
        table.add_column("Model", style="cyan")
        table.add_column("Size", justify="right")
        table.add_column("Path", style="dim")
        for name, size_mb in cached:
            table.add_row(name, f"{size_mb:.0f} MB", str(get_model_dir(name)))
        console.print(table)
    else:
        console.print("[yellow]No models cached. Run 'download' to get started.[/yellow]")

    console.print()
    table = Table(title="Available Models", border_style="cyan")
    table.add_column("Model", style="bold")
    table.add_column("Size", justify="right")
    table.add_column("VRAM", justify="right")
    table.add_column("Cached", justify="center")
    for name, info in AVAILABLE_MODELS.items():
        cached_mark = "[green][OK][/green]" if is_model_cached(name) else "[dim][XX][/dim]"
        table.add_row(name, f"~{info['size_mb']} MB", info['vram'], cached_mark)
    console.print(table)


def run_download_cli():
    import argparse
    parser = argparse.ArgumentParser(description="Clip Magic Model Downloader")
    parser.add_argument("command", nargs="?", default="status",
                        choices=["status", "download"],
                        help="Command: status (show cache) or download (get model)")
    parser.add_argument("--model", "-m", default="medium",
                        choices=list(AVAILABLE_MODELS.keys()),
                        help="Model size to download (default: medium)")
    parser.add_argument("--source", "-s", choices=["hf_mirror", "modelscope", "faster_whisper"],
                        help="Specific download source")
    args = parser.parse_args()

    if args.command == "status":
        show_status()
    elif args.command == "download":
        success = download_model(args.model, args.source)
        if success:
            console.print(f"\n[bold green]Model '{args.model}' is ready to use![/bold green]")
            console.print("[dim]Set CLIP_MAGIC_WHISPER_MODEL_SIZE={} in .env to use this model[/dim]".format(args.model))
        else:
            sys.exit(1)


if __name__ == "__main__":
    run_download_cli()