"""Shared helper: serve the repo root on a free local port and open index.html in headless Chromium (Playwright)."""
from __future__ import annotations

import contextlib
import functools
import http.server
import socket
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


@contextlib.contextmanager
def page():
    """Yield (playwright page, console error list) with the app loaded and window.App ready."""
    from playwright.sync_api import sync_playwright

    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(_Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
            pg = b.new_page()
            errors = []
            pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            pg.goto(f"http://127.0.0.1:{port}/index.html")
            pg.wait_for_function("window.App && App.sites && App.sites.length", timeout=90000)
            pg.evaluate("App.ready")
            yield pg, errors
            b.close()
    finally:
        srv.shutdown()
