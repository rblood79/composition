import { chromium } from "playwright";
const sizes = { Current:[1160,400], Main:[700,400], StyleTab:[700,400], TextTab:[700,400], ScreenTab:[960,400], Popovers:[1080,400], Patterns:[1160,400], Properties:[1000,400], AltSingleScroll:[700,400], ChromeCurrent:[1300,400], ChromeBars:[1160,400], ChromeMenus:[1160,400], CommandPalette:[1200,400], ChromeFeedback:[1160,400], OtherPanels:[1160,400], ChromeRules:[1160,400], HeaderIsland:[1440,400] };
const browser = await chromium.launch({ headless: true });
for (const [n,[w,h]] of Object.entries(sizes)) {
  const page = await (await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })).newPage();
  await page.goto(`file:///tmp/claude-501/art-prev/${n}.html`); await page.waitForTimeout(800);
  const sh = await page.evaluate(() => document.documentElement.scrollHeight);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  console.log(n, w, sh, sw);
}
await browser.close();
