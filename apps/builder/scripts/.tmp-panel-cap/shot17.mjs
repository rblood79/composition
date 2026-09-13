import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1620, height: 400 }, deviceScaleFactor: 1 })).newPage();
await page.goto(`file:///tmp/claude-501/art-prev/ColorPopovers.html`); await page.waitForTimeout(1200);
console.log("h", await page.evaluate(() => document.documentElement.scrollHeight), "w", await page.evaluate(() => document.documentElement.scrollWidth));
console.log(await page.evaluate(() => Array.from(document.querySelectorAll(".pop")).map(p => p.getBoundingClientRect().width + "x" + Math.round(p.getBoundingClientRect().height))));
await page.setViewportSize({ width: 1620, height: await page.evaluate(() => document.documentElement.scrollHeight) });
await page.screenshot({ path: "/tmp/claude-501/art-prev/ColorPopovers.png", fullPage: true });
await browser.close();
