from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

import httpx


class MiMoClientError(Exception):
    pass


class MiMoClient:
    def __init__(self) -> None:
        self.api_key = os.getenv("MIMO_API_KEY", "").strip()
        self.base_url = os.getenv("MIMO_BASE_URL", "https://api.xiaomimimo.com/v1").rstrip("/")
        self.model = os.getenv("MIMO_CHAT_MODEL", "mimo-v2.5-pro").strip() or "mimo-v2.5-pro"
        self.timeout = float(os.getenv("MIMO_TIMEOUT_SECONDS", "60") or "60")

    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        stream: bool = False,
    ) -> Dict[str, Any]:
        if not self.api_key:
            raise MiMoClientError("MIMO_API_KEY is not configured.")

        payload = {
            "model": model or self.model,
            "messages": messages,
            "temperature": temperature,
            "max_completion_tokens": max_tokens,
            "stream": stream,
        }
        headers = {
            "api-key": self.api_key,
            "Content-Type": "application/json",
        }
        url = f"{self.base_url}/chat/completions"

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            if status_code in (401, 403):
                raise MiMoClientError("Xiaomi MiMo API authentication failed. Please check MIMO_API_KEY.") from None
            if status_code == 402:
                raise MiMoClientError("Xiaomi MiMo API balance is insufficient. Please recharge the Xiaomi MiMo account or enable an active Token Plan.") from None
            if status_code == 429:
                raise MiMoClientError("Xiaomi MiMo API rate limit or quota exceeded.") from None
            raise MiMoClientError(f"Xiaomi MiMo API request failed with status {status_code}.") from None
        except httpx.TimeoutException as exc:
            raise MiMoClientError("Xiaomi MiMo API request timed out.") from exc
        except httpx.HTTPError as exc:
            raise MiMoClientError(f"Xiaomi MiMo API request failed: {type(exc).__name__}") from exc
        except Exception as exc:
            raise MiMoClientError(f"Xiaomi MiMo API request failed: {type(exc).__name__}") from exc

        try:
            content = data["choices"][0]["message"]["content"]
        except Exception as exc:
            raise MiMoClientError("Xiaomi MiMo API response format is invalid.") from exc

        return {
            "provider": "xiaomi_mimo",
            "model": payload["model"],
            "content": content,
            "raw": data,
        }
