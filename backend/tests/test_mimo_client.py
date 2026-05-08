from __future__ import annotations

import asyncio

import httpx

from app.services.mimo_client import MiMoClient, MiMoClientError


class _AsyncClientStub:
    def __init__(self, response: httpx.Response | None = None, error: Exception | None = None, **_: object) -> None:
        self._response = response
        self._error = error

    async def __aenter__(self) -> "_AsyncClientStub":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None

    async def post(self, url: str, headers: dict[str, str], json: dict[str, object]) -> httpx.Response:
        if self._error:
            raise self._error
        assert headers["api-key"] == "test-key"
        assert url.endswith("/chat/completions")
        return self._response  # type: ignore[return-value]


def test_mimo_client_requires_key(monkeypatch) -> None:
    monkeypatch.delenv("MIMO_API_KEY", raising=False)
    client = MiMoClient()
    try:
        asyncio.run(client.chat(messages=[{"role": "user", "content": "hi"}]))
    except MiMoClientError as exc:
        assert "not configured" in str(exc)
    else:
        raise AssertionError("expected MiMoClientError")


def test_mimo_client_success(monkeypatch) -> None:
    monkeypatch.setenv("MIMO_API_KEY", "test-key")
    monkeypatch.setattr(
        "app.services.mimo_client.httpx.AsyncClient",
        lambda **kwargs: _AsyncClientStub(
            response=httpx.Response(
                200,
                json={"choices": [{"message": {"content": "hello from mimo"}}]},
                request=httpx.Request("POST", "https://api.xiaomimimo.com/v1/chat/completions"),
            ),
            **kwargs,
        ),
    )
    client = MiMoClient()
    result = asyncio.run(client.chat(messages=[{"role": "user", "content": "hi"}]))
    assert result["provider"] == "xiaomi_mimo"
    assert result["content"] == "hello from mimo"


def test_mimo_client_auth_error(monkeypatch) -> None:
    monkeypatch.setenv("MIMO_API_KEY", "test-key")
    response = httpx.Response(401, request=httpx.Request("POST", "https://api.xiaomimimo.com/v1/chat/completions"))
    monkeypatch.setattr(
        "app.services.mimo_client.httpx.AsyncClient",
        lambda **kwargs: _AsyncClientStub(
            error=httpx.HTTPStatusError("bad auth", request=response.request, response=response),
            **kwargs,
        ),
    )
    client = MiMoClient()
    try:
        asyncio.run(client.chat(messages=[{"role": "user", "content": "hi"}]))
    except MiMoClientError as exc:
        assert "authentication failed" in str(exc)
    else:
        raise AssertionError("expected MiMoClientError")
