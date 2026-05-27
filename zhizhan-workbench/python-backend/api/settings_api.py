from fastapi import APIRouter
from pydantic import BaseModel
from config import settings

router = APIRouter(prefix="/api/settings", tags=["settings"])


class LLMSettingsUpdate(BaseModel):
    llm_provider: str | None = None
    llm_api_key: str | None = None
    llm_model: str | None = None
    llm_base_url: str | None = None
    data_refresh_interval: int | None = None


@router.get("/")
async def get_settings():
    return {
        "llm_provider": settings.llm_provider,
        "llm_model": settings.llm_model,
        "llm_base_url": settings.llm_base_url,
        "data_refresh_interval": settings.data_refresh_interval,
        "has_api_key": bool(settings.llm_api_key),
    }


@router.put("/")
async def update_settings(data: LLMSettingsUpdate):
    if data.llm_provider is not None:
        settings.llm_provider = data.llm_provider
    if data.llm_api_key is not None:
        settings.llm_api_key = data.llm_api_key
    if data.llm_model is not None:
        settings.llm_model = data.llm_model
    if data.llm_base_url is not None:
        settings.llm_base_url = data.llm_base_url
    if data.data_refresh_interval is not None:
        settings.data_refresh_interval = data.data_refresh_interval

    return {"ok": True}


@router.post("/test-llm")
async def test_llm_connection():
    if not settings.llm_api_key:
        return {"ok": False, "error": "API Key 未配置"}

    try:
        from langchain_openai import ChatOpenAI

        llm = ChatOpenAI(
            model=settings.llm_model,
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
            max_tokens=10,
        )
        response = llm.invoke("Hi")
        return {"ok": True, "response": response.content[:50]}
    except Exception as e:
        return {"ok": False, "error": str(e)[:200]}
