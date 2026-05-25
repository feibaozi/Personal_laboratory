from pydantic_settings import BaseSettings
from typing import Optional


def _detect_ffmpeg() -> str:
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return "ffmpeg"


LLM_PROVIDER_PRESETS = {
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "models": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
        "description": "OpenAI 官方 API",
    },
    "deepseek": {
        "base_url": "https://api.deepseek.com/v1",
        "models": ["deepseek-chat", "deepseek-reasoner"],
        "description": "DeepSeek (国内可用，性价比高)",
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
        "description": "硅基流动 (免费用额度)",
    },
    "local": {
        "base_url": "http://localhost:11434/v1",
        "models": ["llama3", "qwen2.5", "deepseek-r1"],
        "description": "本地 Ollama",
    },
}


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
    ffmpeg_path: str = _detect_ffmpeg()

    model_config = {
        "env_prefix": "CLIP_MAGIC_",
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