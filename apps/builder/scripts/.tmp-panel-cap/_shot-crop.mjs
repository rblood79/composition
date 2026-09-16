import { chromium } from "playwright";
const [file, out, y, h] = process.argv.slice(2);
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1160, height: 1400 } })).newPage();
await p.goto("file://" + file); await p.waitForTimeout(400);
await p.screenshot({ path: out, clip: { x: 0, y: Number(y), width: 1160, height: Number(h) } }); await b.close();
