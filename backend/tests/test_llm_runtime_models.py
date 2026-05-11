from __future__ import annotations

import importlib


def test_model_catalog_includes_mimo_when_configured_but_not_default(monkeypatch) -> None:
    monkeypatch.setenv("LLM_BASE_URL", "https://api.deepseek.com/chat/completions")
    monkeypatch.setenv("LLM_API_KEY", "deepseek-key")
    monkeypatch.setenv("LLM_MODEL_FAST", "deepseek-chat")
    monkeypatch.setenv("LLM_MODEL_SMART", "deepseek-chat")
    monkeypatch.setenv("MIMO_API_KEY", "mimo-key")
    monkeypatch.setenv("MIMO_CHAT_MODEL", "mimo-v2.5-pro")

    from app.services import llm_runtime

    llm_runtime = importlib.reload(llm_runtime)

    models = llm_runtime.list_available_models()
    mimo_model = next((item for item in models if item.key == "mimo-chat"), None)

    assert mimo_model is not None
    assert mimo_model.provider == "mimo"
    assert mimo_model.model_name == "mimo-v2.5-pro"
    assert mimo_model.is_default is False
