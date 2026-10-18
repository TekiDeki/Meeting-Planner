#!/usr/bin/env python3
# Meeting Planner · end to end tests
# SPDX-License-Identifier: Apache-2.0
"""Drives index.html in Chromium on a desktop and on a touch tablet.

    python3 tests/ui_test.py

Starts its own static server on a free port, so no other process is needed.
"""
from __future__ import annotations

import functools
import re
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
checks = 0


def check(condition, message):
    global checks
    checks += 1
    if not condition:
        raise AssertionError(message)


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class Server:
    def __init__(self, directory: Path):
        handler = functools.partial(QuietHandler, directory=str(directory))
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self.port = self.httpd.server_address[1]
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *exc):
        self.httpd.shutdown()
        self.httpd.server_close()

    @property
    def url(self):
        return f"http://127.0.0.1:{self.port}/index.html"


class Watcher:
    """Collects console and page errors for one page."""

    def __init__(self, page):
        self.problems = []
        page.on("console", self._console)
        page.on("pageerror", lambda error: self.problems.append("pageerror: " + str(error)))

    def _console(self, message):
        if message.type in ("error", "warning"):
            self.problems.append("console " + message.type + ": " + message.text)

    def quiet(self, label):
        check(not self.problems, label + " raised " + repr(self.problems))


def text_of(page, selector):
    return page.locator(selector).inner_text().strip()


def open_page(context, url):
    page = context.new_page()
    watcher = Watcher(page)
    page.goto(url, wait_until="load")
    page.wait_for_selector("#gridBody tr")
    return page, watcher


def chips(page):
    return page.locator(".chip").count()


def rows(page):
    return page.locator("#gridBody tr").count()


def header_cells(page):
    return page.locator("#gridHead th").count()


def cells_in_first_row(page):
    return page.locator("#gridBody tr").first.locator("td").count()


def work_cells(page):
    return page.locator("#gridBody .cell.work").count()


def desktop_suite(browser, url):
    context = browser.new_context(viewport={"width": 1280, "height": 900})
    page, watcher = open_page(context, url)

    check("Meeting Planner" in page.title(), "the title names the app")
    check(len(text_of(page, "h1")) > 10, "there is a headline")
    check(page.evaluate("document.documentElement.lang") == "en", "the page ships in English")

    check(chips(page) == 3, "three cities are loaded by default")
    check(rows(page) == 24, "the grid has 24 rows")
    check(header_cells(page) == 4, "the grid has a corner plus three cities")
    check(cells_in_first_row(page) == 3, "each row has one cell per city")
    check(len(text_of(page, "#resultTitle")) > 3, "the suggestion has a title")

    # The first city sets the clock, and the corner column must say so.
    check(text_of(page, "#gridHead th:first-child") == "Your time", "the first column is labelled")

    # ---------------------------------------------------------- adding cities
    page.fill("#cityInput", "Tokyo")
    page.click("#cityForm button[type=submit]")
    page.wait_for_timeout(120)
    check(chips(page) == 4, "adding a city adds a chip")
    check(cells_in_first_row(page) == 4, "adding a city adds a column")
    check(page.input_value("#cityInput") == "", "the input clears after adding")

    page.fill("#cityInput", "Tokyo")
    page.click("#cityForm button[type=submit]")
    page.wait_for_timeout(80)
    check(chips(page) == 4, "a duplicate is refused")
    check("Tokyo" in text_of(page, "#cityMsg"), "the duplicate message names the city")

    page.fill("#cityInput", "Atlantis")
    page.click("#cityForm button[type=submit]")
    page.wait_for_timeout(80)
    check(chips(page) == 4, "an unknown city is refused")
    check("Atlantis" in text_of(page, "#cityMsg"), "the error names what was typed")

    # A raw IANA zone is accepted, which is the escape hatch for any city.
    page.fill("#cityInput", "Pacific/Auckland")
    page.click("#cityForm button[type=submit]")
    page.wait_for_timeout(120)
    check(chips(page) == 5, "a raw time zone is accepted")

    # ------------------------------------------------------------- removing
    page.locator(".chip-x").nth(1).click()
    page.wait_for_timeout(120)
    check(chips(page) == 4, "the remove button drops a city")

    check(page.locator("#undoBtn").is_enabled(), "undo becomes available")
    page.click("#undoBtn")
    page.wait_for_timeout(120)
    check(chips(page) == 5, "undo brings the city back")

    # --------------------------------------------------------------- picking
    page.locator("#gridBody .hourbtn").nth(15).click()
    page.wait_for_timeout(120)
    check(page.locator("#picked").is_visible(), "picking an hour opens the summary")
    check(page.locator("#pickedList li").count() == 5, "the summary lists every city")
    check(page.locator("#gridBody tr.is-picked").count() == 1, "the picked row is marked")

    shared = page.evaluate("window.TD_APP.copyText()")
    check(shared.count("\n") == 5, "the copied text has a header and one line per city")
    check(": " in shared, "the copied text pairs cities with times")
    check(re.search(r"\b\d\d:\d\d\b", shared) is not None, "the copied text carries a clock time")

    page.locator("#gridBody .hourbtn").nth(15).click()
    page.wait_for_timeout(120)
    check(page.locator("#picked").is_visible() is False, "picking the same hour again closes it")

    # ------------------------------------------------------------ persistence
    before = text_of(page, "#dateLabel")
    page.reload(wait_until="load")
    page.wait_for_selector("#gridBody tr")
    check(chips(page) == 5, "the city list survives a reload")
    check(text_of(page, "#dateLabel") == before, "the chosen day survives a reload")
    check("z=" in page.url, "the state is written into the address bar")
    watcher.quiet("desktop session")

    # ------------------------------------------------------------------- days
    page.click("#prevDayBtn")
    page.wait_for_timeout(120)
    check(text_of(page, "#dateLabel") != before, "the previous day button moves the date")
    check(page.locator("#todayBadge").is_visible() is False, "the today badge hides on another day")
    page.click("#todayBtn")
    page.wait_for_timeout(120)
    check(text_of(page, "#dateLabel") == before, "the today button comes back")
    check(page.locator("#todayBadge").is_visible(), "the today badge returns")

    # ---------------------------------------------------------- working hours
    page.select_option("#workFrom", "0")
    page.wait_for_timeout(150)
    wide = work_cells(page)
    page.select_option("#workFrom", "9")
    page.wait_for_timeout(150)
    narrow = work_cells(page)
    check(wide > narrow, "a wider working day paints more green cells")

    # The end can never equal the start, or nothing would ever be working.
    page.select_option("#workFrom", "9")
    page.select_option("#workTo", "9")
    page.wait_for_timeout(150)
    values = (page.input_value("#workFrom"), page.input_value("#workTo"))
    check(values[0] != values[1], "start and end can never be the same hour")

    # -------------------------------------------------------------- language
    page.select_option("#langSelect", "ro")
    page.wait_for_timeout(150)
    check(page.evaluate("document.documentElement.lang") == "ro", "Romanian sets the lang attribute")
    check("Găsește" in text_of(page, "h1"), "Romanian translates the headline")
    check(text_of(page, "#gridHead th:first-child") == "Ora ta", "Romanian translates the table corner")

    page.select_option("#langSelect", "sr-cyrl")
    page.wait_for_timeout(150)
    check(page.evaluate("document.documentElement.lang") == "sr-cyrl", "Cyrillic sets the lang attribute")
    cyrillic = re.search(r"[\u0400-\u04FF]", text_of(page, "h1"))
    check(cyrillic is not None, "the Cyrillic locale really renders Cyrillic")
    latin_in_headline = re.search(r"[A-Za-z]", text_of(page, "h1"))
    check(latin_in_headline is None, "no Latin letters are left in the Cyrillic headline")

    page.select_option("#langSelect", "en")
    page.wait_for_timeout(150)
    check(text_of(page, "#gridHead th:first-child") == "Your time", "switching back restores English")

    # ----------------------------------------------------------------- theme
    check(page.evaluate("document.documentElement.classList.contains('theme-dark')") is False,
          "the page starts light")
    page.click("#themeBtn")
    page.wait_for_timeout(120)
    check(page.evaluate("document.documentElement.classList.contains('theme-dark')"),
          "the theme button switches to dark")
    page.reload(wait_until="load")
    page.wait_for_selector("#gridBody tr")
    check(page.evaluate("document.documentElement.classList.contains('theme-dark')"),
          "the theme survives a reload")

    watcher.quiet("desktop suite")
    context.close()


def tablet_suite(browser, url):
    context = browser.new_context(
        viewport={"width": 820, "height": 1180}, has_touch=True, is_mobile=True,
        device_scale_factor=2,
    )
    page, watcher = open_page(context, url)

    check(chips(page) == 3, "the tablet starts with three cities")
    check(rows(page) == 24, "the tablet grid has 24 rows")

    # Touching a table row has to work, because there is no hover on a tablet.
    page.locator("#gridBody tr").nth(10).tap()
    page.wait_for_timeout(150)
    check(page.locator("#picked").is_visible(), "tapping a row opens the summary")

    page.tap("#clearBtn")
    page.wait_for_timeout(120)
    check(page.locator("#picked").is_visible() is False, "clearing closes the summary")

    for city in ("Tokyo", "Sydney", "Lisbon", "Dubai"):
        page.fill("#cityInput", city)
        page.tap("#cityForm button[type=submit]")
        page.wait_for_timeout(100)
    check(chips(page) == 7, "seven cities can be added by touch")

    narrowest = page.evaluate(
        "() => { const cells = [...document.querySelectorAll('#gridBody tr:first-child td')];"
        " return Math.min(...cells.map((cell) => cell.getBoundingClientRect().width)); }"
    )
    check(narrowest >= 88, "columns never squeeze below a readable width")

    # On a phone width the same table has to scroll rather than crush.
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(150)
    scrollable = page.evaluate(
        "() => { const box = document.querySelector('.grid-scroll');"
        " return box.scrollWidth > box.clientWidth; }"
    )
    check(scrollable, "a narrow screen scrolls the table sideways")
    page.set_viewport_size({"width": 820, "height": 1180})

    page.select_option("#langSelect", "sr-latn")
    page.wait_for_timeout(150)
    check(page.evaluate("document.documentElement.lang") == "sr-latn", "Serbian Latin sets lang")
    check("Nađi" in text_of(page, "h1"), "Serbian Latin translates the headline")

    watcher.quiet("tablet suite")
    context.close()


def main():
    if not (ROOT / "index.html").exists():
        print("index.html is missing, run build.py first")
        return 1

    with Server(ROOT) as server, sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        try:
            desktop_suite(browser, server.url)
            tablet_suite(browser, server.url)
        finally:
            browser.close()

    print(f"ui: {checks} checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
