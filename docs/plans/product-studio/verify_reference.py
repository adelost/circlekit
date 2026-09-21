"""Check the scripted HTML reference, not the ProductSpec implementation.

Requires an existing Python Playwright installation and Chromium.
Usage: python verify_reference.py --output /tmp/product-studio-reference
Optional: STUDIO_BROWSER_EXECUTABLE=/path/to/chromium
Does not install dependencies, run product builds or contact external services.
"""
import argparse
import asyncio
import json
import os
from pathlib import Path
import shutil

from playwright.async_api import async_playwright


async def verify(output: Path) -> None:
    source = Path(__file__).with_name("concept.html")
    output.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as playwright:
        executable = os.environ.get("STUDIO_BROWSER_EXECUTABLE") or shutil.which("chromium")
        options = {"headless": True}
        if executable:
            options["executable_path"] = executable
        browser = await playwright.chromium.launch(**options)
        try:
            page = await browser.new_page(viewport={"width": 1600, "height": 1100})
            errors, requests = [], []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("request", lambda request: requests.append(request.url)
                    if request.url.startswith(("http:", "https:")) else None)
            # In-memory rendering avoids file-navigation restrictions in managed browsers.
            await page.set_content(source.read_text(encoding="utf-8"), wait_until="load")
            assert await page.get_attribute("html", "lang") == "en"
            assert "ARMED → BUFFERING" in await page.locator("#result").inner_text()
            assert await page.locator(".notice").first.is_visible()
            await page.locator("#reset").click()
            assert await page.locator("#back").is_disabled()
            expected = [
                "STOPPED → ARMED · start-armed",
                "ARMED → BUFFERING · gps-height",
                "BUFFERING → RECORDING · exit-promotes-buffering",
            ]
            for frame in expected:
                await page.locator("#step").click()
                assert await page.locator("#result").inner_text() == frame
            assert await page.locator("#step").is_disabled()
            for view in ["system", "scenarios", "interface", "changes", "logic"]:
                await page.locator(f'nav [data-view="{view}"]').click()
                assert await page.locator(f"#view-{view}").is_visible()
            await page.locator('[data-step="2"]').click()
            await page.locator("#search").fill("recording")
            assert await page.locator(".tree button:visible").count() == 2
            await page.locator("#search").fill("")
            assert await page.locator(".tree button:visible").count() == 8
            await page.locator("#search").blur()
            await page.screenshot(path=str(output / "product-studio-english.png"), full_page=True)
            widths = {}
            for width in [1600, 1024, 720, 390]:
                await page.set_viewport_size({"width": width, "height": 1000})
                sizes = await page.evaluate("({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth})")
                widths[width] = sizes
                assert sizes["scroll"] <= sizes["width"], (width, sizes)
            assert not errors, errors
            assert not requests, requests
            result = {
                "scope": "Scripted English reference only; no ProductSpec or repository suite executed",
                "frames": expected,
                "views_checked": 5,
                "viewport_checks": widths,
                "script_errors": errors,
                "http_requests": requests,
                "status": "passed",
            }
            (output / "reference-checks.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
            print(json.dumps(result, indent=2))
        finally:
            await browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    asyncio.run(verify(parser.parse_args().output))
