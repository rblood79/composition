import { chromium } from "playwright";
const sizes = { FramePreset: 1700, DataCreator: 1700, MiscPanels: 1700, Inventory: 1300 };
const browser = await chromium.launch({ headless: true });
for (const [n, w] of Object.entries(sizes)) {
  const page = await (await browser.newContext({ viewport: { width: w, height: 400 }, deviceScaleFactor: 1 })).newPage();
  await page.goto(`file:///tmp/claude-501/art-prev/${n}.html`); await page.waitForTimeout(1000);
  const sh = await page.evaluate(() => document.documentElement.scrollHeight); const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  console.log(n, w, "h", sh, "w", sw);
  await page.setViewportSize({ width: w, height: sh }); await page.screenshot({ path: `/tmp/claude-501/art-prev/${n}.png`, fullPage: true });
}
await browser.close();
