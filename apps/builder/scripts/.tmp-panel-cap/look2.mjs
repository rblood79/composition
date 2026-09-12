import { chromium } from "playwright";
const OUT = process.env.OUT; const FILE = process.env.FILE;
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 })).newPage();
page.on("pageerror", e => console.error("[pageerror]", e.message));
await page.goto("file://" + FILE);
await page.waitForTimeout(6000);
const targets = [["01", 521, 276], ["02", 695, 276], ["03", 869, 276], ["04", 578, 507], ["05", 834, 507], ["06", 621, 702], ["07", 860, 702], ["08", 1042, 702], ["00", 621, 89]];
for (const [name, x, y] of targets) {
  await page.mouse.click(x, y); await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/art-${name}.png` });
  await page.keyboard.press("Escape"); await page.waitForTimeout(600);
}
await browser.close();
