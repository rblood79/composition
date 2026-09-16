// builder 크롬 (Skia 캔버스 제외) 전 요소 computed style digest + generated CSS 의 주 class 매칭 수
import { chromium } from "playwright";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();
await page.goto("http://localhost:5173/builder/b7051fa1-ee16-4a61-a3a9-e3c2d43047f0", { waitUntil: "networkidle" });
await page.waitForSelector(".app", { timeout: 60000 }); await page.waitForTimeout(3000);
const r = await page.evaluate(() => {
  const rows = [];
  const all = Array.from(document.querySelectorAll("body *")).filter((el) => !el.closest("canvas") && el.tagName !== "STYLE" && el.tagName !== "SCRIPT");
  const idx = new Map();
  for (const el of all) {
    const cs = getComputedStyle(el); const parts = [];
    for (let k = 0; k < cs.length; k++) { const p = cs[k]; parts.push(p + ":" + cs.getPropertyValue(p)); }
    const tag = el.tagName.toLowerCase(); const cls = typeof el.className === "string" ? el.className.split(/\s+/).filter(Boolean).join(".") : "";
    const base = tag + (cls ? "." + cls : ""); const n = (idx.get(base) || 0) + 1; idx.set(base, n);
    rows.push({ key: base + "#" + n, css: parts.join(";") });
  }
  const classes = ["react-aria-Button", "react-aria-Popover", "react-aria-Switch", "react-aria-ListBox", "react-aria-ListBoxItem", "react-aria-Header", "react-aria-GridList", "react-aria-GridListItem", "react-aria-Checkbox", "react-aria-Radio", "react-aria-Link", "react-aria-Separator", "react-aria-Tooltip", "react-aria-Tab", "react-aria-Slider", "react-aria-Menu", "react-aria-MenuItem", "react-aria-Badge", "react-aria-Breadcrumbs", "react-aria-Calendar", "react-aria-ColorSwatch", "react-aria-Label", "react-aria-Text"];
  const counts = Object.fromEntries(classes.map((c) => [c, document.getElementsByClassName(c).length]));
  return { rows, counts, total: rows.length };
});
writeFileSync(process.argv[2], JSON.stringify(r));
console.log("elements:", r.total, "\nclass counts:", JSON.stringify(r.counts));
await browser.close();
