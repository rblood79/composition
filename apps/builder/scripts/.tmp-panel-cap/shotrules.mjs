import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1160, height: 400 } })).newPage();
await page.goto(`file:///tmp/claude-501/art-prev/ChromeRules.html`); await page.waitForTimeout(800);
console.log("h", await page.evaluate(() => document.documentElement.scrollHeight), "w", await page.evaluate(() => document.documentElement.scrollWidth));
await browser.close();
