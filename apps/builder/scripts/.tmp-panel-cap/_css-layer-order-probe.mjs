// 문서별 @layer 첫 등장 순서 · theme 토큰 중복 · 동일 내용 <style> 중복을 잰다 (builder / preview.html)
import { chromium } from "playwright";
import { resolve } from "node:path";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json") });
const probe = async (url, label, waitSel) => {
  const page = await ctx.newPage(); await page.goto(url, { waitUntil: "networkidle" }); if (waitSel) await page.waitForSelector(waitSel, { timeout: 60000 }).catch(() => {}); await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const order = []; const seen = new Set();
    const walk = (rules) => { for (const r of rules) { if (r instanceof CSSLayerStatementRule) for (const n of r.nameList) { if (!seen.has(n)) { seen.add(n); order.push(n); } } else if (r instanceof CSSLayerBlockRule) { if (r.name && !seen.has(r.name)) { seen.add(r.name); order.push(r.name); } walk(r.cssRules); } else if (r.cssRules && !(r instanceof CSSStyleRule)) walk(r.cssRules); } };
    for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch {} }
    const styles = [...document.querySelectorAll("style")]; const texts = styles.map((s) => s.textContent);
    const tokenSheets = texts.map((t, i) => /--sizes-inspectorWidth\s*:/.test(t) ? i : -1).filter((i) => i >= 0);
    const bySig = new Map(); let dupSheets = 0, dupBytes = 0; for (const t of texts) { const sig = t.length + ":" + t.slice(0, 200); if (bySig.has(sig)) { dupSheets++; dupBytes += t.length; } else bySig.set(sig, 1); }
    const cs = getComputedStyle(document.documentElement);
    return { layerOrder: order, styles: styles.length, totalKB: Math.round(texts.reduce((a, t) => a + t.length, 0) / 1024), themeTokenSheets: tokenSheets, dupSheets, dupKB: Math.round(dupBytes / 1024), tokens: ["--bg", "--sizes-inspectorWidth", "--control-size", "--text-2xl", "--spacing"].map((k) => k + "=" + cs.getPropertyValue(k).trim()) };
  });
  console.log(`\n=== ${label}`); console.log(JSON.stringify(r, null, 1)); await page.close();
};
await probe("http://localhost:5173/builder/b7051fa1-ee16-4a61-a3a9-e3c2d43047f0", "builder", ".app");
await probe("http://localhost:5173/preview.html", "preview.html", null);
await browser.close();
