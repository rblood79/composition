// Properties 패널 하드코딩 영어 잔존 스캔 — locale ko-KR 로 부팅, 팔레트 전수 클릭, 패널 텍스트 중 한글 없는 라틴 문자열 수집
import { chromium } from "playwright";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)"));
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1400 } });
await ctx.addInitScript(() => { try { localStorage.setItem("composition-locale", "ko-KR"); } catch {} });
const page = await ctx.newPage();
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`i18n-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1500);
console.log("html lang:", await page.evaluate(() => document.documentElement.lang), "| locale:", await page.evaluate(() => localStorage.getItem("composition-locale")));
const panel = async (name) => { const btn = page.locator(`[data-panel-id="${name}"]`); if (await btn.count()) return; const t = page.getByRole("button", { name: new RegExp(name, "i") }).first(); await t.click().catch(() => {}); await page.waitForTimeout(300); };
// 패널 토글 버튼 이름이 한국어일 수 있으니 data-panel-id 존재로 판정
const ensure = async (_id, label) => { const done = await page.evaluate((src) => { const re = new RegExp(src, "i"); const b = Array.from(document.querySelectorAll("button[aria-pressed]")).find((x) => re.test(x.getAttribute("aria-label") || x.textContent.trim())); if (!b) return "none"; if (b.getAttribute("aria-pressed") === "true") return "on"; b.click(); return "clicked"; }, label.source); if (done === "clicked") await page.waitForTimeout(500); };
await ensure("components", /^(components|컴포넌트)$/i);
const P = '[data-panel-id="properties"]';
const count = await page.locator("button.list-item").count(); console.log("palette items:", count);
const results = {};
const scrape = () => {
  const root = document.querySelector('[data-panel-id="properties"]'); if (!root) return { texts: [], missing: true };
  const out = new Set();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n; while ((n = walker.nextNode())) { const t = n.textContent.trim(); if (t) out.add("T:" + t); }
  root.querySelectorAll("[placeholder]").forEach((e) => out.add("P:" + e.getAttribute("placeholder")));
  root.querySelectorAll("[aria-label]").forEach((e) => out.add("A:" + e.getAttribute("aria-label")));
  root.querySelectorAll("[title]").forEach((e) => out.add("I:" + e.getAttribute("title")));
  root.querySelectorAll("select option").forEach((o) => out.add("O:" + o.textContent.trim()));
  return { texts: [...out] };
};
const hasHangul = (s) => /[ㄱ-힝]/.test(s);
const latin = (s) => /[A-Za-z]{2,}/.test(s);
for (let k = 0; k < count; k++) {
  await ensure("components", /^(components|컴포넌트)$/i);
  const item = page.locator("button.list-item").nth(k);
  const name = (await item.locator(".list-item-name").textContent().catch(() => "")) || `#${k}`;
  const type = await item.getAttribute("data-component-type").catch(() => null);
  if (process.env.ONLY && !new RegExp(process.env.ONLY, "i").test(name)) continue;
  await item.click().catch(() => {}); await page.waitForTimeout(500);
  await ensure("properties", /^(properties|속성)$/i);
  await page.evaluate((P) => { document.querySelectorAll(`${P} .section-caret[aria-expanded="false"]`).forEach((c) => c.click()); }, P); await page.waitForTimeout(250);
  const r = await page.evaluate(scrape);
  const bad = r.texts.filter((t) => !hasHangul(t.slice(2)) && latin(t.slice(2)));
  results[`${type ?? name}`] = { name, all: r.texts.length, bad, texts: r.texts };
  console.log(`${String(k).padStart(2)} ${type ?? name}: ${bad.length}/${r.texts.length}`);
}
writeFileSync(process.argv[2], JSON.stringify(results, null, 1));
await browser.close();
