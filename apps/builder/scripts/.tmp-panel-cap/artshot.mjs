import { chromium } from "playwright";
const sizes = { Properties:[1000,600] };
const browser = await chromium.launch({ headless: true });
for (const [n,[w,h]] of Object.entries(sizes)) {
  const page = await (await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })).newPage();
  await page.goto(`file:///tmp/claude-501/art-prev/${n}.html`); await page.waitForTimeout(800);
  const sh = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.screenshot({ path: `/tmp/claude-501/art-prev/${n}.png`, fullPage: true });
  console.log(n, w, sh);
}
await browser.close();
