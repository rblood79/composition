import { chromium } from "playwright";
const OUT = process.env.OUT; const FILE = process.env.FILE;
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1 })).newPage();
page.on("pageerror", e => console.error("[pageerror]", e.message));
await page.goto("file://" + FILE);
await page.waitForTimeout(6000);
await page.screenshot({ path: `${OUT}/canvas-0.png` });
// try zoom out via keyboard shortcuts? just capture a couple of scroll positions
await page.mouse.move(700, 500);
await page.mouse.wheel(0, 900); await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/canvas-1.png` });
await page.mouse.wheel(0, 1000); await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/canvas-2.png` });
await browser.close();
