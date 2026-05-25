import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.services.llm_engine import LLMEngine


def main():
    print("=" * 50)
    print("LLM Engine Test")
    print("=" * 50)

    engine = LLMEngine()
    print(f"Model: {engine.model}")
    print(f"Base URL: {engine.client.base_url}\n")

    system_prompt = "你是一个说话简短的程序员，喜欢用波浪号~"
    user_message = "周末有空吗"

    print(f"System: {system_prompt}")
    print(f"User:   {user_message}")
    print("-" * 50)

    response = engine.chat_with_persona(
        system_prompt=system_prompt,
        user_message=user_message,
        temperature=0.8,
    )

    print(f"LLM:    {response}")
    print("-" * 50)

    assert response, "Response should not be empty"
    assert len(response.strip()) > 0, "Response should contain text"

    print("\n[SUCCESS] All assertions passed!")
    print("=" * 50)


if __name__ == "__main__":
    main()