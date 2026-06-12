#!/usr/bin/env python3
"""SLS Log Inspector 一键启动脚本。

直接运行即可：
    python start.py

会自动完成：
1. 若缺少 config.json，则从 config.example.json 复制一份。
2. 读取 config.json 里的监听地址与端口。
3. 启动后在浏览器中自动打开页面。
4. Ctrl+C 优雅退出。
"""

from __future__ import annotations

import json
import shutil
import sys
import threading
import webbrowser
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "config.json"
EXAMPLE_CONFIG_PATH = BASE_DIR / "config.example.json"


def ensure_config_file() -> None:
    """首次运行时从示例配置生成 config.json。"""
    if CONFIG_PATH.exists():
        return
    if EXAMPLE_CONFIG_PATH.exists():
        shutil.copyfile(EXAMPLE_CONFIG_PATH, CONFIG_PATH)
        print(f"[start] 已根据示例生成 config.json：{CONFIG_PATH}")
        print("[start] 如需在线查询，请补全 OpenObserve 连接配置与账号 / Cookie。")
    else:
        print("[start] 未找到 config.json 与 config.example.json，将使用内置默认值。")


def read_listen() -> tuple[str, int]:
    """读取监听 host / port，读取失败时回退默认值。"""
    host, port = "127.0.0.1", 8012
    target = CONFIG_PATH if CONFIG_PATH.exists() else EXAMPLE_CONFIG_PATH
    try:
        with target.open("r", encoding="utf-8") as file:
            listen = (json.load(file) or {}).get("listen", {})
        host = listen.get("host", host) or host
        port = int(listen.get("port", port) or port)
    except (OSError, ValueError, json.JSONDecodeError):
        pass
    return host, port


def open_browser_later(url: str, delay: float = 1.0) -> None:
    """延迟在浏览器中打开页面，避免抢在服务监听之前。"""
    threading.Timer(delay, lambda: webbrowser.open(url)).start()


def main() -> None:
    # 确保可以 import 同目录下的 server 模块
    sys.path.insert(0, str(BASE_DIR))
    ensure_config_file()

    try:
        from http.server import ThreadingHTTPServer
        import server as app_server
    except ImportError as exc:  # pragma: no cover
        print(f"[start] 无法加载 server.py：{exc}")
        sys.exit(1)

    host, port = read_listen()
    url = f"http://{host}:{port}"
    # 0.0.0.0 表示监听所有网卡，浏览器需用具体地址访问。
    browse_url = f"http://127.0.0.1:{port}" if host in ("0.0.0.0", "::", "") else url

    try:
        httpd = ThreadingHTTPServer((host, port), app_server.AppHandler)
    except OSError as exc:
        print(f"[start] 启动失败，端口 {port} 可能已被占用：{exc}")
        print(f"[start] 如果服务已在运行，直接打开 {browse_url} 即可。")
        sys.exit(1)

    print(f"[start] SLS Log Inspector 已启动：{url}")
    if host in ("0.0.0.0", "::", ""):
        print(f"[start] 本机访问：{browse_url}  |  局域网访问：http://<本机IP>:{port}")
    print("[start] 按 Ctrl+C 停止服务。")
    open_browser_later(browse_url)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[start] 正在停止服务...")
    finally:
        httpd.shutdown()
        httpd.server_close()
        print("[start] 服务已停止。")


if __name__ == "__main__":
    main()
