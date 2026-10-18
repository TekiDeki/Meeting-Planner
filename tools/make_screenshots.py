#!/usr/bin/env python3
# Meeting Planner · screenshots
# SPDX-License-Identifier: Apache-2.0
"""Captures the screenshots in screenshots/ and composes the social image.

    python3 tools/make_screenshots.py

The state is pinned in the URL, so the same command always produces the same
picture instead of whatever day it happens to run.
"""
from __future__ import annotations

import base64
import threading
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "screenshots"

# Belgrade plus New York plus London can all fit inside 9 to 18, so the
# screenshots show the green state. Tokyo would demo the day marker but can
# never overlap with Belgrade, and a red banner sells nothing.
STATE = "#z=Europe%2FBelgrade~Belgrade,America%2FNew_York~New+York,Europe%2FLondon~London&d=2026-10-19&s=9&e=18"


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


@contextmanager
def server():
    handler = partial(Quiet, directory=str(ROOT))
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{httpd.server_port}"
    finally:
        httpd.shutdown()
        thread.join(timeout=3)
        httpd.server_close()


def og_html() -> str:
    """The social card is drawn by the browser too, so it uses the same type."""
    return """<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0}
    body{width:1200px;height:630px;background:#0f1518;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#e9eff2;overflow:hidden;position:relative}
    .glow{position:absolute;width:900px;height:900px;border-radius:50%;left:-260px;top:-380px;background:radial-gradient(circle,rgba(23,97,111,.55),rgba(15,21,24,0) 68%)}
    .glow2{position:absolute;width:700px;height:700px;border-radius:50%;right:-200px;bottom:-320px;background:radial-gradient(circle,rgba(86,178,186,.20),rgba(15,21,24,0) 70%)}
    .left{position:absolute;left:72px;top:132px;width:470px}
    .mark{width:56px;height:56px;color:#6cc7d4;margin-bottom:26px}
    h1{font-family:Georgia,"Palatino Linotype",serif;font-size:64px;line-height:1.03;letter-spacing:-.02em;font-weight:600}
    p{margin-top:22px;font-size:25px;line-height:1.35;color:#b3c0c7;max-width:430px}
    .url{margin-top:34px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:22px;color:#6cc7d4}
    .shot{position:absolute;right:-40px;top:74px;width:760px;border-radius:18px;overflow:hidden;border:1px solid #243138;box-shadow:0 34px 90px rgba(0,0,0,.55)}
    .shot img{display:block;width:100%}
    </style></head><body>
      <div class="glow"></div><div class="glow2"></div>
      <div class="left">
        <svg class="mark" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="25" stroke="currentColor" stroke-width="2.4"/><ellipse cx="32" cy="32" rx="11" ry="25" stroke="currentColor" stroke-width="1.8" opacity=".65"/><path d="M7 32h50" stroke="currentColor" stroke-width="1.8" opacity=".65"/><path d="M32 32V16" stroke="#e3a548" stroke-width="3.4" stroke-linecap="round"/><path d="M32 32l13 7.6" stroke="#dceef0" stroke-width="2.6" stroke-linecap="round"/></svg>
        <h1>Find the hour that works for everyone</h1>
        <p>Add the cities. See when all of them are inside working hours. Daylight saving included.</p>
        <div class="url">freehtml.dev/zones</div>
      </div>
      <div class="shot"><img src="{shot}"></div>
    </body></html>"""


def main():
    OUT.mkdir(exist_ok=True)
    with server() as base, sync_playwright() as playwright:
        browser = playwright.chromium.launch()

        desktop = browser.new_context(viewport={"width": 1280, "height": 900}, device_scale_factor=2)
        page = desktop.new_page()
        page.goto(base + "/index.html" + STATE, wait_until="load")
        page.wait_for_selector("#gridBody tr")
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(250)
        page.screenshot(path=str(OUT / "desktop.png"))
        desktop.close()

        tablet = browser.new_context(
            viewport={"width": 820, "height": 1180}, device_scale_factor=2,
            has_touch=True, is_mobile=True,
        )
        page = tablet.new_page()
        page.goto(base + "/index.html" + STATE, wait_until="load")
        page.wait_for_selector("#gridBody tr")
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(250)
        page.screenshot(path=str(OUT / "tablet.png"))
        tablet.close()

        # A clean, wider crop of the app for the social card.
        og_shot = browser.new_context(viewport={"width": 1280, "height": 820}, device_scale_factor=2)
        page = og_shot.new_page()
        page.goto(base + "/index.html" + STATE, wait_until="load")
        page.wait_for_selector("#gridBody tr")
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(250)
        page.screenshot(path=str(OUT / "app.png"))
        og_shot.close()

        # The card is built with set_content, which has no base URL, so the
        # screenshot goes in as a data URI instead of a relative path.
        shot = base64.b64encode((OUT / "app.png").read_bytes()).decode("ascii")
        card = browser.new_context(viewport={"width": 1200, "height": 630}, device_scale_factor=2)
        page = card.new_page()
        page.set_content(og_html().replace("{shot}", "data:image/png;base64," + shot), wait_until="load")
        page.wait_for_timeout(300)
        page.screenshot(path=str(OUT / "og.png"))
        card.close()

        browser.close()

    (OUT / "app.png").unlink(missing_ok=True)

    for name in ("desktop.png", "tablet.png", "og.png"):
        size = Image.open(OUT / name).size
        print(f"{name}: {size[0]} x {size[1]}")


if __name__ == "__main__":
    main()
