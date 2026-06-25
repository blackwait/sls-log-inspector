from __future__ import annotations

import base64
import copy
import json
import mimetypes
import os
import secrets
import ssl
import sys
import threading
import time
from dataclasses import dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib import error, parse, request
import gzip


BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "config.json"
EXAMPLE_CONFIG_PATH = BASE_DIR / "config.example.json"
QUERY_RANKING_PATH = BASE_DIR / "query-ranking.json"
PRESENCE_STALE_SECONDS = 90


class PresenceTracker:
    def __init__(self, stale_seconds: int = PRESENCE_STALE_SECONDS) -> None:
        self.stale_seconds = stale_seconds
        self._lock = threading.Lock()
        self._sessions: dict[str, dict[str, Any]] = {}

    def _purge_stale(self, now: float | None = None) -> None:
        now = now or time.time()
        stale_before = now - self.stale_seconds
        expired = [sid for sid, item in self._sessions.items() if float(item.get("last_seen") or 0) < stale_before]
        for sid in expired:
            self._sessions.pop(sid, None)

    def touch(
        self,
        session_id: str | None,
        *,
        client_ip: str,
        user_agent: str,
        page: str,
        label: str,
    ) -> dict[str, Any]:
        now = time.time()
        with self._lock:
            self._purge_stale(now)
            sid = normalize_value(session_id) or secrets.token_urlsafe(12)
            existing = self._sessions.get(sid, {})
            entry = {
                "id": sid,
                "label": normalize_value(label) or existing.get("label") or f"访客-{sid[:6]}",
                "ip": client_ip or existing.get("ip") or "-",
                "user_agent": user_agent or existing.get("user_agent") or "-",
                "page": normalize_value(page) or existing.get("page") or "/",
                "first_seen": existing.get("first_seen") or now,
                "last_seen": now,
            }
            self._sessions[sid] = entry
            return dict(entry)

    def snapshot(self) -> dict[str, Any]:
        now = time.time()
        with self._lock:
            self._purge_stale(now)
            users = sorted(self._sessions.values(), key=lambda item: float(item.get("last_seen") or 0), reverse=True)
            return {
                "count": len(users),
                "stale_seconds": self.stale_seconds,
                "users": [dict(item) for item in users],
            }


PRESENCE = PresenceTracker()


class DailyQueryRanking:
    def __init__(self, path: Path) -> None:
        self.path = path
        self._lock = threading.Lock()

    def record_query(
        self,
        day: str,
        session_id: str | None,
        label: str | None,
        *,
        now: float | None = None,
    ) -> dict[str, Any]:
        now = now or time.time()
        user_id = normalize_value(session_id) or "anonymous"
        user_label = normalize_value(label) or f"访客-{user_id[:6]}"
        with self._lock:
            data = self._load()
            days = data.setdefault("days", {})
            day_bucket = days.setdefault(day, {})
            users = day_bucket.setdefault("users", {})
            entry = users.setdefault(
                user_id,
                {
                    "id": user_id,
                    "label": user_label,
                    "count": 0,
                    "first_query_at": int(now),
                    "last_query_at": int(now),
                },
            )
            entry["label"] = user_label
            entry["count"] = int(entry.get("count") or 0) + 1
            entry["last_query_at"] = int(now)

            leaders = sorted(
                (dict(item) for item in users.values()),
                key=lambda item: (-int(item.get("count") or 0), str(item.get("label") or "")),
            )
            current = dict(entry)
            ahead_count = sum(1 for item in leaders if int(item.get("count") or 0) > int(current.get("count") or 0))
            result = {
                "day": day,
                "current": current,
                "ahead_count": ahead_count,
                "message": "您今日的查询次数已经遥遥领先"
                if ahead_count == 0
                else f"您前面有{ahead_count}人，请多多使用",
                "leaders": leaders[:10],
            }
            self._save(data)
            return result

    def _load(self) -> dict[str, Any]:
        if not self.path.exists():
            return {"days": {}}
        try:
            with self.path.open("r", encoding="utf-8") as file:
                data = json.load(file)
            return data if isinstance(data, dict) else {"days": {}}
        except (OSError, json.JSONDecodeError):
            return {"days": {}}

    def _save(self, data: dict[str, Any]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = self.path.with_suffix(".tmp")
        with temp_path.open("w", encoding="utf-8") as file:
            json.dump(data, file, ensure_ascii=False, indent=2)
            file.write("\n")
        temp_path.replace(self.path)


QUERY_RANKING = DailyQueryRanking(QUERY_RANKING_PATH)


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def save_json(path: Path, data: dict[str, Any]) -> None:
    with path.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
        file.write("\n")


def ensure_config() -> dict[str, Any]:
    if CONFIG_PATH.exists():
        return load_json(CONFIG_PATH)
    return load_json(EXAMPLE_CONFIG_PATH)


def json_response(handler: BaseHTTPRequestHandler, payload: dict[str, Any], status: int = 200) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def file_response(handler: BaseHTTPRequestHandler, path: Path) -> None:
    if not path.exists() or not path.is_file():
        json_response(handler, {"ok": False, "message": "Not found"}, HTTPStatus.NOT_FOUND)
        return
    body = path.read_bytes()
    content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    if path.suffix in {".html", ".css", ".js"}:
        content_type += "; charset=utf-8"

    # Gzip compression for text-based content
    accept_encoding = handler.headers.get("Accept-Encoding", "")
    is_text = content_type.startswith("text/") or content_type.startswith("application/json") or content_type.startswith("application/javascript")

    if is_text and "gzip" in accept_encoding and len(body) > 256:
        compressed = gzip.compress(body, compresslevel=6)
        if len(compressed) < len(body):
            handler.send_response(HTTPStatus.OK)
            handler.send_header("Content-Type", content_type)
            handler.send_header("Content-Encoding", "gzip")
            handler.send_header("Content-Length", str(len(compressed)))
            # Cache-Control for static assets
            cacheable = path.suffix in {".js", ".css", ".ttf", ".woff", ".woff2", ".png", ".jpg", ".svg", ".ico"}
            if cacheable:
                handler.send_header("Cache-Control", "public, max-age=3600")
            else:
                handler.send_header("Cache-Control", "no-cache")
            handler.end_headers()
            handler.wfile.write(compressed)
            return

    handler.send_response(HTTPStatus.OK)
    handler.send_header("Content-Type", content_type)
    handler.send_header("Content-Length", str(len(body)))
    # Cache-Control for static assets
    cacheable = path.suffix in {".js", ".css", ".ttf", ".woff", ".woff2", ".png", ".jpg", ".svg", ".ico"}
    if cacheable:
        handler.send_header("Cache-Control", "public, max-age=3600")
    else:
        handler.send_header("Cache-Control", "no-cache")
    handler.end_headers()
    handler.wfile.write(body)


def normalize_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value)


def cookie_pairs(cookie: str) -> dict[str, str]:
    pairs: dict[str, str] = {}
    for part in cookie.split(";"):
        if "=" not in part:
            continue
        key, value = part.split("=", 1)
        key = key.strip()
        if key:
            pairs[key] = value.strip()
    return pairs


def serialize_cookie(pairs: dict[str, str]) -> str:
    return "; ".join(f"{key}={value}" for key, value in pairs.items() if key)


def parse_set_cookie(headers: Any) -> dict[str, str]:
    values: list[str] = []
    if hasattr(headers, "get_all"):
        values = list(headers.get_all("Set-Cookie") or [])
    else:
        raw = headers.get("Set-Cookie") if hasattr(headers, "get") else None
        if raw:
            values = [raw]

    result: dict[str, str] = {}
    for value in values:
        first_part = value.split(";", 1)[0]
        if "=" not in first_part:
            continue
        key, item_value = first_part.split("=", 1)
        key = key.strip()
        if key:
            result[key] = item_value.strip()
    return result


def merged_cookie(existing_cookie: str, new_cookie_values: dict[str, str]) -> str:
    pairs = cookie_pairs(existing_cookie)
    pairs.update(new_cookie_values)
    return serialize_cookie(pairs)


def masked_auto_login(openobserve: dict[str, Any]) -> dict[str, Any]:
    auto_login = openobserve.get("auto_login", {}) or {}
    return {
        "enabled": bool(auto_login.get("enabled", False)),
        "login_path": normalize_value(auto_login.get("login_path") or "/auth/login"),
        "refresh_interval_hours": int(auto_login.get("refresh_interval_hours") or 24),
        "last_login_at": int(auto_login.get("last_login_at") or 0),
    }


def login_due(auto_login: dict[str, Any]) -> bool:
    if not auto_login.get("enabled", False):
        return False
    last_login_at = int(auto_login.get("last_login_at") or 0)
    interval_hours = max(1, int(auto_login.get("refresh_interval_hours") or 24))
    return last_login_at <= 0 or time.time() - last_login_at >= interval_hours * 3600


def ensure_openobserve_login(config: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any] | None]:
    openobserve = config.get("openobserve", {})
    auto_login = openobserve.get("auto_login", {}) or {}
    if not login_due(auto_login):
        return config, None

    username = credential_value(auto_login, "username", "username_env") or credential_value(auto_login, "name", "username_env")
    password = credential_value(auto_login, "password", "password_env")
    if not username or not password:
        return config, {
            "refreshed": False,
            "skipped": True,
            "reason": "auto_login credentials are not configured",
        }

    auth_info = login_openobserve(config, username, password)
    updated_config = copy.deepcopy(config)
    updated_openobserve = updated_config.setdefault("openobserve", {})
    updated_auto_login = updated_openobserve.setdefault("auto_login", {})
    updated_auto_login["last_login_at"] = int(time.time())

    auth = updated_openobserve.setdefault("auth", {})
    auth["mode"] = "cookie"
    existing_cookie = normalize_value(auth.get("cookie"))
    auth["cookie"] = merged_cookie(existing_cookie, auth_info["cookies"])

    if CONFIG_PATH.exists():
        save_json(CONFIG_PATH, updated_config)

    return updated_config, {
        "refreshed": True,
        "last_login_at": updated_auto_login["last_login_at"],
        "cookie_names": sorted(auth_info["cookies"].keys()),
    }


def login_openobserve(config: dict[str, Any], username: str, password: str) -> dict[str, Any]:
    openobserve = config["openobserve"]
    auto_login = openobserve.get("auto_login", {}) or {}
    base_url = openobserve["base_url"].rstrip("/")
    login_path = normalize_value(auto_login.get("login_path") or "/auth/login")
    if not login_path.startswith("/"):
        login_path = "/" + login_path
    endpoint = f"{base_url}{login_path}"

    body = json.dumps({"name": username, "password": password}, ensure_ascii=False).encode("utf-8")
    req = request.Request(endpoint, data=body, method="POST")
    req.add_header("Content-Type", "application/json")

    headers = {
        str(key): str(value)
        for key, value in (openobserve.get("headers", {}) or {}).items()
        if normalize_value(value)
    }
    headers["Accept"] = "application/json, text/plain, */*"
    headers["Referer"] = f"{base_url}/web/login"
    existing_cookie = normalize_value(openobserve.get("auth", {}).get("cookie"))
    if existing_cookie:
        headers["Cookie"] = existing_cookie
    for key, value in headers.items():
        req.add_header(key, value)

    timeout = int(openobserve.get("timeout_seconds", 20))
    context = None
    if not openobserve.get("verify_ssl", True):
        context = ssl._create_unverified_context()

    try:
        with request.urlopen(req, timeout=timeout, context=context) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            cookies = parse_set_cookie(resp.headers)
            body_cookies = cookies_from_login_body(raw)
            cookies.update(body_cookies)
            if not cookies:
                raise ValueError("OpenObserve login succeeded but did not return cookies")
            return {"status": resp.status, "cookies": cookies}
    except error.HTTPError as exc:
        detail_raw = exc.read().decode("utf-8", errors="replace")
        raise ValueError(f"OpenObserve login failed with HTTP {exc.code}: {safe_error_detail(detail_raw)}") from exc


def credential_value(source: dict[str, Any], value_key: str, env_key: str) -> str:
    env_name = normalize_value(source.get(env_key))
    if env_name:
        env_value = normalize_value(os.environ.get(env_name))
        if env_value:
            return env_value
    return normalize_value(source.get(value_key))


def cookies_from_login_body(raw: str) -> dict[str, str]:
    if not raw.strip():
        return {}
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return {}

    candidates: list[Any] = [payload]
    if isinstance(payload, dict):
        candidates.extend(value for value in payload.values() if isinstance(value, dict))

    cookies: dict[str, str] = {}
    for item in candidates:
        if not isinstance(item, dict):
            continue
        for key in ("auth_tokens", "auth_ext", "jwtToken"):
            value = item.get(key)
            if isinstance(value, str) and value:
                cookies[key] = value
        access_token = item.get("access_token")
        refresh_token = item.get("refresh_token")
        if isinstance(access_token, str) and access_token and "auth_tokens" not in cookies:
            token_payload = {
                "access_token": access_token,
                "refresh_token": refresh_token if isinstance(refresh_token, str) else "",
            }
            token_json = json.dumps(token_payload, ensure_ascii=False, separators=(",", ":"))
            cookies["auth_tokens"] = base64.b64encode(token_json.encode("utf-8")).decode("ascii")
    return cookies


def safe_error_detail(raw: str) -> str:
    if not raw:
        return ""
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return raw[:300]
    for key in ("password", "cookie", "auth_tokens", "jwtToken", "access_token", "refresh_token"):
        if key in payload:
            payload[key] = "***masked***"
    return json.dumps(payload, ensure_ascii=False)[:500]


def normalize_openobserve_config(payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        payload = {}

    def string_list(key: str) -> list[str]:
        value = payload.get(key)
        if not isinstance(value, list):
            return []
        return [normalize_value(item) for item in value if normalize_value(item)]

    functions: list[dict[str, str]] = []
    for item in payload.get("default_functions", []) if isinstance(payload.get("default_functions"), list) else []:
        if not isinstance(item, dict):
            continue
        name = normalize_value(item.get("name"))
        text = normalize_value(item.get("text"))
        if name and text:
            functions.append({"name": name, "text": text})

    return {
        "version": normalize_value(payload.get("version")),
        "default_functions": functions,
        "default_fts_keys": string_list("default_fts_keys"),
        "default_secondary_index_fields": string_list("default_secondary_index_fields"),
        "sql_reserved_keywords": string_list("sql_reserved_keywords"),
        "timestamp_column": normalize_value(payload.get("timestamp_column") or "_timestamp"),
        "query_default_limit": int(payload.get("query_default_limit") or 1000),
        "quick_mode_enabled": bool(payload.get("quick_mode_enabled", False)),
        "streaming_enabled": bool(payload.get("streaming_enabled", True)),
        "histogram_enabled": bool(payload.get("histogram_enabled", False)),
        "max_query_range": int(payload.get("max_query_range") or 0),
        "data_retention_days": int(payload.get("data_retention_days") or 0),
    }


@dataclass
class OpenObserveClient:
    config: dict[str, Any]

    def get_public_config(self) -> dict[str, Any]:
        openobserve = self.config["openobserve"]
        base_url = openobserve["base_url"].rstrip("/")
        config_path = normalize_value(openobserve.get("config_path") or "/config")
        if not config_path.startswith("/"):
            config_path = "/" + config_path
        endpoint = f"{base_url}{config_path}"

        headers = self._build_headers()
        headers["Accept"] = "application/json, text/plain, */*"
        req = request.Request(endpoint, method="GET")
        for key, value in headers.items():
            req.add_header(key, value)

        timeout = int(openobserve.get("timeout_seconds", 20))
        context = None
        if not openobserve.get("verify_ssl", True):
            context = ssl._create_unverified_context()

        try:
            with request.urlopen(req, timeout=timeout, context=context) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
                payload = json.loads(raw)
                return {
                    "ok": True,
                    "status": resp.status,
                    "data": normalize_openobserve_config(payload),
                }
        except Exception as exc:
            fallback = normalize_openobserve_config(openobserve.get("config_fallback", {}))
            return {
                "ok": False,
                "status": 500,
                "message": safe_error_detail(str(exc)),
                "data": fallback,
            }

    def query(self, sql: str, stream: str, start_time_ms: int, end_time_ms: int, size: int) -> dict[str, Any]:
        endpoint = self._build_endpoint()
        headers = self._build_headers()
        payload = self._build_payload(sql, stream, start_time_ms, end_time_ms, size)
        req = request.Request(endpoint, data=json.dumps(payload, ensure_ascii=False).encode("utf-8"), method="POST")
        req.add_header("Content-Type", "application/json")
        for key, value in headers.items():
            req.add_header(key, value)

        openobserve = self.config["openobserve"]
        timeout = int(openobserve.get("timeout_seconds", 20))
        context = None
        if not openobserve.get("verify_ssl", True):
            context = ssl._create_unverified_context()

        try:
            with request.urlopen(req, timeout=timeout, context=context) as resp:
                raw = resp.read().decode("utf-8")
                parsed = self._parse_response(raw, resp.headers.get("Content-Type", ""))
                return {
                    "ok": True,
                    "status": resp.status,
                    "data": parsed,
                    "request_preview": {
                        "url": endpoint,
                        "headers": self._mask_headers(headers),
                        "body": payload,
                    },
                }
        except error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            try:
                detail = json.loads(raw)
            except json.JSONDecodeError:
                detail = {"raw": raw}
            return {
                "ok": False,
                "status": exc.code,
                "message": "OpenObserve request failed",
                "detail": detail,
                "request_preview": {
                    "url": endpoint,
                    "headers": self._mask_headers(headers),
                    "body": payload,
                },
            }
        except Exception as exc:
            return {
                "ok": False,
                "status": 500,
                "message": str(exc),
                "request_preview": {
                    "url": endpoint,
                    "headers": self._mask_headers(headers),
                    "body": payload,
                },
            }

    def _build_endpoint(self) -> str:
        openobserve = self.config["openobserve"]
        base_url = openobserve["base_url"].rstrip("/")
        organization = normalize_value(openobserve.get("organization"))
        endpoint_path = normalize_value(openobserve.get("endpoint_path") or "/api/{organization}/_search_stream")
        endpoint_path = endpoint_path.replace("{organization}", organization)
        query_string = parse.urlencode(openobserve.get("query_string", {}))
        return f"{base_url}{endpoint_path}?{query_string}" if query_string else f"{base_url}{endpoint_path}"

    def _build_headers(self) -> dict[str, str]:
        openobserve = self.config["openobserve"]
        headers = {
            str(key): str(value)
            for key, value in (openobserve.get("headers", {}) or {}).items()
            if normalize_value(value)
        }
        auth = openobserve.get("auth", {})
        mode = normalize_value(auth.get("mode")).lower()
        if mode == "basic":
            token = f'{auth.get("username", "")}:{auth.get("password", "")}'.encode("utf-8")
            headers["Authorization"] = "Basic " + base64.b64encode(token).decode("ascii")
        elif mode == "cookie":
            cookie = normalize_value(auth.get("cookie"))
            if cookie:
                headers["Cookie"] = cookie
        return headers

    def _build_payload(self, sql: str, stream: str, start_time_ms: int, end_time_ms: int, size: int) -> dict[str, Any]:
        defaults = self.config["openobserve"].get("request_defaults", {})
        query_payload = {
            "sql": sql,
            "start_time": start_time_ms * 1000,
            "end_time": end_time_ms * 1000,
            "from": 0,
            "size": size,
            "quick_mode": defaults.get("quick_mode", False),
            "sql_mode": defaults.get("sql_mode", "full"),
        }
        if stream:
            query_payload["stream_name"] = stream
        return {"query": query_payload}

    def _mask_headers(self, headers: dict[str, str]) -> dict[str, str]:
        masked = dict(headers)
        for key in list(masked.keys()):
            if key.lower() in {"authorization", "cookie"}:
                masked[key] = "***masked***"
        return masked

    def _parse_response(self, raw: str, content_type: str) -> dict[str, Any]:
        if not raw.strip():
            return {}
        if "text/event-stream" in content_type.lower():
            return self._parse_event_stream(raw)
        return json.loads(raw)

    def _parse_event_stream(self, raw: str) -> dict[str, Any]:
        events: list[dict[str, Any]] = []
        current_event = ""
        current_data: list[str] = []

        def flush_event() -> None:
            nonlocal current_event, current_data
            if not current_event and not current_data:
                return
            data_text = "\n".join(current_data).strip()
            parsed_data: Any = data_text
            if data_text and data_text != "[[DONE]]":
                try:
                    parsed_data = json.loads(data_text)
                except json.JSONDecodeError:
                    parsed_data = data_text
            events.append({"event": current_event or "message", "data": parsed_data})
            current_event = ""
            current_data = []

        for line in raw.splitlines():
            if not line.strip():
                flush_event()
                continue
            if line.startswith("event:"):
                current_event = line.split(":", 1)[1].strip()
                continue
            if line.startswith("data:"):
                current_data.append(line.split(":", 1)[1].strip())
                continue
        flush_event()

        hits: list[dict[str, Any]] = []
        metadata: dict[str, Any] | None = None
        progress: list[Any] = []
        for item in events:
            event_name = item["event"]
            event_data = item["data"]
            if event_name == "search_response_hits" and isinstance(event_data, dict):
                event_hits = event_data.get("hits")
                if isinstance(event_hits, list):
                    hits.extend(event_hits)
            elif event_name == "search_response_metadata" and isinstance(event_data, dict):
                metadata = event_data
            elif event_name == "progress":
                progress.append(event_data)

        return {
            "events": events,
            "hits": hits,
            "results": metadata.get("results", {}) if isinstance(metadata, dict) else {},
            "metadata": metadata or {},
            "progress": progress,
        }


class AppHandler(BaseHTTPRequestHandler):
    server_version = "SlsLogInspector/0.3"

    def do_GET(self) -> None:
        parsed = parse.urlparse(self.path)
        path = parsed.path
        if path == "/favicon.ico":
            self.send_response(HTTPStatus.NO_CONTENT)
            self.end_headers()
            return
        if path in {"/", "/index.html"}:
            file_response(self, BASE_DIR / "index.html")
            return
        if path == "/api/meta":
            self.handle_meta()
            return
        if path == "/api/presence":
            self.handle_presence_get()
            return
        static_path = (BASE_DIR / path.lstrip("/")).resolve()
        if BASE_DIR in static_path.parents or static_path == BASE_DIR:
            file_response(self, static_path)
            return
        json_response(self, {"ok": False, "message": "Not found"}, HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:
        path = parse.urlparse(self.path).path
        if path == "/api/query":
            self.handle_query()
            return
        if path == "/api/presence":
            self.handle_presence_post()
            return
        json_response(self, {"ok": False, "message": "Not found"}, HTTPStatus.NOT_FOUND)

    def client_ip(self) -> str:
        forwarded = normalize_value(self.headers.get("X-Forwarded-For"))
        if forwarded:
            return forwarded.split(",", 1)[0].strip()
        return self.address_string()

    def handle_presence_get(self) -> None:
        snapshot = PRESENCE.snapshot()
        json_response(
            self,
            {
                "ok": True,
                "count": snapshot["count"],
                "stale_seconds": snapshot["stale_seconds"],
                "users": snapshot["users"],
            },
        )

    def handle_presence_post(self) -> None:
        try:
            payload = self._read_json()
        except json.JSONDecodeError:
            json_response(self, {"ok": False, "message": "invalid json"}, HTTPStatus.BAD_REQUEST)
            return
        session_id = normalize_value(payload.get("session_id"))
        page = normalize_value(payload.get("page")) or "/"
        label = normalize_value(payload.get("label"))
        user_agent = normalize_value(self.headers.get("User-Agent"))
        entry = PRESENCE.touch(
            session_id,
            client_ip=self.client_ip(),
            user_agent=user_agent,
            page=page,
            label=label,
        )
        snapshot = PRESENCE.snapshot()
        json_response(
            self,
            {
                "ok": True,
                "session_id": entry["id"],
                "count": snapshot["count"],
            },
        )

    def handle_meta(self) -> None:
        config = ensure_config()
        config, auth_refresh = ensure_openobserve_login(config)
        openobserve = config.get("openobserve", {})
        presets = config.get("presets", [])
        streams = config.get("streams", [])
        if not isinstance(streams, list) or not streams:
            streams = [
                {"value": "java_master_console", "label": "java_master_console"},
                {"value": "java_prod_console", "label": "java_prod_console"},
                {"value": "java_prod_error", "label": "java_prod_error"},
                {"value": "java_test_console", "label": "java_test_console", "default": True},
            ]
        openobserve_config = OpenObserveClient(config).get_public_config()
        json_response(
            self,
            {
                "ok": True,
                "title": config.get("ui", {}).get("title", "SLS Log Inspector"),
                "config_ready": CONFIG_PATH.exists(),
                "connection": {
                    "base_url": openobserve.get("base_url", ""),
                    "organization": openobserve.get("organization", ""),
                    "endpoint_path": openobserve.get("endpoint_path", ""),
                    "auth_mode": openobserve.get("auth", {}).get("mode", ""),
                    "auto_login": masked_auto_login(openobserve),
                    "auth_refresh": auth_refresh or {"refreshed": False},
                },
                "defaults": {
                    "limit": 100,
                    "minutes": 15,
                },
                "streams": streams,
                "presets": presets if isinstance(presets, list) else [],
                "openobserve_config": openobserve_config,
            },
        )

    def handle_query(self) -> None:
        try:
            payload = self._read_json()
            config = ensure_config()
            config, auth_refresh = ensure_openobserve_login(config)

            sql = normalize_value(payload.get("advanced_sql"))
            stream = normalize_value(payload.get("stream"))
            if not sql:
                raise ValueError("advanced_sql is required")
            if not stream:
                raise ValueError("stream is required")

            limit = max(1, min(int(payload.get("limit") or 100), 5000))
            end_time_ms = int(payload.get("end_time_ms") or 0)
            start_time_ms = int(payload.get("start_time_ms") or 0)
            query_user = payload.get("query_user") if isinstance(payload.get("query_user"), dict) else {}
            query_session_id = normalize_value(query_user.get("session_id"))
            query_label = normalize_value(query_user.get("label"))
            if end_time_ms <= 0:
                end_time_ms = int(time.time() * 1000)
            if start_time_ms <= 0:
                start_time_ms = end_time_ms - 15 * 60 * 1000
            if start_time_ms >= end_time_ms:
                raise ValueError("start_time_ms must be less than end_time_ms")

            client = OpenObserveClient(config)
            response = client.query(sql, stream, start_time_ms, end_time_ms, limit)
            if not response["ok"]:
                json_response(
                    self,
                    {
                        "ok": False,
                        "message": response.get("message", "query failed"),
                        "status": response.get("status", 500),
                        "detail": response.get("detail"),
                        "request_preview": response.get("request_preview"),
                        "sql": sql,
                    },
                    response.get("status", 500),
                )
                return

            data = response["data"]
            rows = self._extract_rows(data)
            ranking = QUERY_RANKING.record_query(
                time.strftime("%Y-%m-%d", time.localtime()),
                query_session_id,
                query_label,
            )
            json_response(
                self,
                {
                    "ok": True,
                    "meta": {
                        "stream": stream,
                        "limit": limit,
                        "start_time_ms": start_time_ms,
                        "end_time_ms": end_time_ms,
                        "auth_refresh": auth_refresh or {"refreshed": False},
                    },
                    "sql": sql,
                    "request_preview": response.get("request_preview"),
                    "raw": data,
                    "rows": rows,
                    "row_count": len(rows),
                    "ranking": ranking,
                },
            )
        except ValueError as exc:
            json_response(self, {"ok": False, "message": str(exc)}, HTTPStatus.BAD_REQUEST)
        except Exception as exc:
            json_response(self, {"ok": False, "message": str(exc)}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def _extract_rows(self, data: dict[str, Any]) -> list[dict[str, Any]]:
        for key in ("hits", "list", "rows", "data", "result"):
            if isinstance(data.get(key), list):
                return data[key]
        nested_data = data.get("data")
        if isinstance(nested_data, dict):
            for key in ("hits", "list", "rows", "result"):
                if isinstance(nested_data.get(key), list):
                    return nested_data[key]
        return []

    def _read_json(self) -> dict[str, Any]:
        content_length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
        return json.loads(raw or "{}")

    def log_message(self, fmt: str, *args: Any) -> None:
        sys.stdout.write("%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), fmt % args))


def main() -> None:
    config = ensure_config()
    listen = config.get("listen", {})
    host = listen.get("host", "127.0.0.1")
    port = int(listen.get("port", 8012))

    class HighBacklogHTTPServer(ThreadingHTTPServer):
        request_queue_size = 128

    server = HighBacklogHTTPServer((host, port), AppHandler)
    print(f"SLS Log Inspector running at http://{host}:{port}")
    if not CONFIG_PATH.exists():
        print(f"config.json not found, using example config: {EXAMPLE_CONFIG_PATH}")
    server.serve_forever()


if __name__ == "__main__":
    main()
