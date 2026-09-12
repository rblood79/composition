import { chromium } from "playwright";
const OUT = process.env.OUT; const FILE = process.env.FILE;
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 })).newPage();
await page.goto("file://" + FILE); await page.waitForTimeout(6000);
await page.mouse.click(521, 276); await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/art-01b.png`, clip: { x: 350, y: 120, width: 700, height: 560 } });
await browser.close();
