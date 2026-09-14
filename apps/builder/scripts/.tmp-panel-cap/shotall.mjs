import { chromium } from "playwright";
import fs from "node:fs";
const c = JSON.parse(fs.readFileSync("/Users/admin/work/composition/docs/design/panel-ui/canvas.json","utf8"));
const browser = await chromium.launch({ headless: true });
for (const a of c.artboards) {
  const n = a.file.replace(".dc.html","");
  const page = await (await browser.newContext({ viewport: { width: a.w, height: 400 } })).newPage();
  await page.goto(`file:///tmp/claude-501/art-prev/${n}.html`); await page.waitForTimeout(700);
  const sh = await page.evaluate(() => document.documentElement.scrollHeight); const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  const flag = (sh + 40 > a.h) ? "  <<< SHORT" : (sw > a.w ? "  <<< WIDE" : "");
  console.log(n.padEnd(16), "frame", a.w+"×"+a.h, "content", sw+"×"+sh, flag);
  if (process.env.SHOT && process.env.SHOT.split(",").includes(n)) { await page.setViewportSize({ width: a.w, height: sh }); await page.screenshot({ path: `/tmp/claude-501/art-prev/${n}.png`, fullPage: true }); }
  await page.context().close();
}
await browser.close();
