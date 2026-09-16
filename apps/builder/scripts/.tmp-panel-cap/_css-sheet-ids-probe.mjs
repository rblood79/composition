// 문서별 <style data-vite-dev-id> 순서·크기 (builder / preview.html) — 어떤 파일이 어느 채널로 몇 번 실리는지
import { chromium } from "playwright";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json") });
const out = {};
const probe = async (url, label, waitSel) => {
  const page = await ctx.newPage(); await page.goto(url, { waitUntil: "networkidle" }); if (waitSel) await page.waitForSelector(waitSel, { timeout: 60000 }).catch(() => {}); await page.waitForTimeout(1500);
  out[label] = await page.evaluate(() => [...document.querySelectorAll("style")].map((s, i) => ({ i, id: (s.getAttribute("data-vite-dev-id") || s.id || s.getAttribute("data-adr154-responsive") && "adr154" || "(inline)").replace(/^.*\/composition\//, ""), kb: +(s.textContent.length / 1024).toFixed(1) })));
  await page.close();
};
await probe("http://localhost:5173/builder/b7051fa1-ee16-4a61-a3a9-e3c2d43047f0", "builder", ".app");
await probe("http://localhost:5173/preview.html", "preview", null);
await browser.close();
writeFileSync(process.argv[2] || "/tmp/sheet-ids.json", JSON.stringify(out, null, 1));
for (const [k, v] of Object.entries(out)) { console.log(`=== ${k} (${v.length} sheets, ${v.reduce((a, s) => a + s.kb, 0).toFixed(0)} KB)`); for (const s of v) console.log(`${String(s.i).padStart(3)} ${String(s.kb).padStart(6)}  ${s.id}`); }
