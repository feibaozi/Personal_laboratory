from pydantic_settings import BaseSettings
from typing import Optional


LLM_PROVIDER_PRESETS = {
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "models": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
        "description": "OpenAI",
    },
    "deepseek": {
        "base_url": "https://api.deepseek.com/v1",
        "models": ["deepseek-chat", "deepseek-reasoner"],
        "description": "DeepSeek",
    },
    "qwen": {
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "models": ["qwen-plus", "qwen-max", "qwen-turbo"],
        "description": "阿里通义千问",
    },
    "zhipu": {
        "base_url": "https://open.bigmodel.cn/api/paas/v4",
        "models": ["glm-4-plus", "glm-4-flash"],
        "description": "智谱 GLM",
    },
    "moonshot": {
        "base_url": "https://api.moonshot.cn/v1",
        "models": ["moonshot-v1-8k", "moonshot-v1-32k"],
        "description": "月之暗面 Kimi",
    },
    "siliconflow": {
        "base_url": "https://api.siliconflow.cn/v1",
        "models": ["deepseek-ai/DeepSeek-V3", "Qwen/Qwen2.5-72B-Instruct"],
        "description": "硅基流动",
    },
    "local": {
        "base_url": "http://localhost:11434/v1",
        "models": ["llama3", "qwen2.5", "deepseek-r1"],
        "description": "本地 Ollama",
    },
}


def _detect_ffmpeg() -> str:
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return "ffmpeg"


class Settings(BaseSettings):
    whisper_model_size: str = "medium"
    whisper_device: str = "cuda"
    whisper_compute_type: str = "float16"

    llm_api_key: str = ""
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o"
    llm_provider: Optional[str] = None

    highlight_count: int = 3
    highlight_duration_sec: int = 45
    highlight_candidate_count: int = 15

    output_dir: str = "./output"
    upload_dir: str = "./data/uploads"
    data_dir: str = "./data"
    ffmpeg_path: str = _detect_ffmpeg()
    log_file: str = ""  # 日志文件路径，为空则仅控制台输出

    clip_model_name: str = "OFA-Sys/chinese-clip-vit-base-patch16"
    chroma_persist_dir: str = "./data/chroma"

    subtitle_font: str = "Microsoft YaHei"
    subtitle_fontsize: int = 24
    subtitle_primary_colour: str = "&H00FFFFFF"
    subtitle_outline_colour: str = "&H00000000"
    subtitle_outline_width: int = 2

    tts_model_dir: str = "./models/cosyvoice"
    tts_enabled: bool = False

    # 安全相关配置
    api_key: str = ""  # API Key 认证，为空则不启用
    cors_origins: str = "http://localhost:5173,http://localhost:8788"  # 逗号分隔的允许源
    debug: bool = False  # 控制是否启用 reload

    model_config = {
        "env_prefix": "AI_DIRECTOR_",
        "env_file": ".env",
        "extra": "ignore",
    }

    def has_valid_llm_key(self) -> bool:
        return bool(self.llm_api_key) and len(self.llm_api_key) > 20 and "your-api-key" not in self.llm_api_key.lower()

    def apply_provider_preset(self, provider: str):
        if provider in LLM_PROVIDER_PRESETS:
            preset = LLM_PROVIDER_PRESETS[provider]
            self.llm_base_url = preset["base_url"]
            if preset["models"]:
                self.llm_model = preset["models"][0]
            self.llm_provider = provider


settings = Settings()

if settings.llm_provider:
    settings.apply_provider_preset(settings.llm_provider)