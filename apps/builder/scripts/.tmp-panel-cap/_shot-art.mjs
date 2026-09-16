import { chromium } from "playwright";
const [file, out] = process.argv.slice(2);
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1160, height: 1600 }, deviceScaleFactor: 1 })).newPage();
await p.goto("file://" + file); await p.waitForTimeout(500);
const h = await p.evaluate(() => document.documentElement.scrollHeight); console.log("height", h);
await p.screenshot({ path: out, fullPage: true }); await b.close();
