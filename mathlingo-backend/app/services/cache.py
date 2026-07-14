# app/services/cache.py
"""
Тонкая обёртка над Redis (R4) — единственное место в проекте, которое
знает про redis-py. Роуты и CSRF-мидлварь (main.py) работают через эти
функции, а не создают клиент сами.

get_client() лениво создаёт клиент и кэширует его на уровне модуля;
tests/conftest.py подменяет _client на fakeredis перед каждым тестом
(параллельно тому, как get_db подменяется на тестовую SQLite-сессию) —
это позволяет тестам не зависеть от реального Redis.
"""
import json
import os
from typing import Any, Optional

import redis

_client: Optional[redis.Redis] = None


def get_client() -> redis.Redis:
    global _client
    if _client is None:
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        _client = redis.from_url(redis_url, decode_responses=True)
    return _client


def get_json(key: str) -> Optional[Any]:
    raw = get_client().get(key)
    if raw is None:
        return None
    return json.loads(raw)


def set_json(key: str, value: Any, ttl: Optional[int] = None) -> None:
    get_client().set(key, json.dumps(value), ex=ttl)


def delete(key: str) -> None:
    get_client().delete(key)


def delete_prefix(prefix: str) -> None:
    client = get_client()
    keys = list(client.scan_iter(f"{prefix}*"))
    if keys:
        client.delete(*keys)
