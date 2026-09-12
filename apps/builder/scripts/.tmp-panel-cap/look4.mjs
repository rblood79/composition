import { chromium } from "playwright";
const OUT = process.env.OUT; const FILE = process.env.FILE;
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 })).newPage();
await page.goto("file://" + FILE); await page.waitForTimeout(6000);
for (const [n,x,y,clip] of [["01",521,276,{x:350,y:120,width:400,height:880}],["02",695,276,{x:350,y:120,width:400,height:880}],["05",834,507,{x:180,y:120,width:1000,height:700}]]) {
  await page.mouse.click(x, y); await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/art-${n}c.png`, clip });
  await page.keyboard.press("Escape"); await page.waitForTimeout(600);
}
await browser.close();
