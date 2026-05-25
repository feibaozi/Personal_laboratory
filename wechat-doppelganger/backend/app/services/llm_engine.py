import logging
from openai import OpenAI
from app.config import settings

logger = logging.getLogger(__name__)


class LLMEngine:
    def __init__(self):
        self.client = OpenAI(
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
        )
        self.model = settings.llm_model
        logger.info("LLMEngine initialized with model=%s base_url=%s", self.model, settings.llm_base_url)

    def chat(self, messages: list[dict], temperature: float = 0.8, max_tokens: int = 500) -> str:
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            content = response.choices[0].message.content
            if content is None:
                logger.warning("LLM returned empty content")
                return ""
            return content
        except Exception as e:
            logger.error("LLM chat call failed: %s", e)
            raise

    def chat_with_persona(
        self,
        system_prompt: str,
        user_message: str,
        history: list[dict] | None = None,
        temperature: float = 0.8,
    ) -> str:
        messages = [{"role": "system", "content": system_prompt}]
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": user_message})
        logger.debug("chat_with_persona: %d messages", len(messages))
        return self.chat(messages, temperature=temperature)