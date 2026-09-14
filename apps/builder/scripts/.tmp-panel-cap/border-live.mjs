// ADR-219 P4 live 하니스 — Border 절 변 세그먼트 · 코너 2×2 · store 저장 형태 · Modified · 캔버스
// 실행: node apps/builder/scripts/.tmp-panel-cap/border-live.mjs
import { chromium } from "playwright";
import { resolve } from "node:path";
const OUT = process.env.OUT ?? "/private/tmp/claude-501/-Users-admin-work-composition/f6bcc488-f176-4644-8364-3625704b801c/scratchpad/cap";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`border-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);

// 팔레트로 frame 추가 (store addElement 는 canonical 에 안 실려 Skia 가 안 그린다 —
//   메모리 reference-live-layout-rect-and-palette-add-path). 그 뒤 패널 경로로 파랑 배경 + 테두리 4 navy.
await page.getByRole("button", { name: "Components", exact: true }).first().click(); await page.waitForTimeout(600);
await page.locator('[data-component-type="frame"], [data-component-type="Frame"], button:has-text("frame")').first().click(); await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Components", exact: true }).first().click().catch(() => {}); await page.waitForTimeout(300);
const elId = await page.evaluate(async () => {
  const st = window.__composition_STORE__.getState();
  const frames = st.elements.filter((e) => e.page_id === st.currentPageId && e.type === "frame");
  const el = frames[frames.length - 1];
  st.setSelectedElement(el.id, el.props);
  await new Promise((r) => setTimeout(r, 300));
  window.__composition_STORE__.getState().updateSelectedStyles({ width: "200px", height: "120px", backgroundColor: "#2F6FED", borderWidth: "4px", borderStyle: "solid", borderColor: "#102A5C", borderRadius: "16px" });
  return el.id;
});
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Styles", exact: true }).first().click(); await page.waitForTimeout(500);
await page.locator(".styles-panel-tab").nth(1).click(); await page.waitForTimeout(400);
const P = '[data-panel-id="styles"]';
const B = `${P} .section[data-section-id="border"]`;
const M = (sel) => page.evaluate((sel) => Array.from(document.querySelectorAll(sel)).filter((el) => el.getBoundingClientRect().width > 0).slice(0, 14).map((el) => { const r = el.getBoundingClientRect(); return `${(el.getAttribute("aria-label") || el.className.toString()).slice(0, 40)} | ${Math.round(r.width)}×${Math.round(r.height)}`; }), sel);
const style = () => page.evaluate((id) => { const el = window.__composition_STORE__.getState().elements.find((e) => e.id === id); const s = el?.props?.style ?? {}; return Object.fromEntries(Object.entries(s).filter(([k]) => /^border/.test(k))); }, elId);
const log = (k, v) => console.log(k, JSON.stringify(v));
const canvasShot = (name) => page.locator('[data-testid="skia-canvas-unified"]').screenshot({ path: `${OUT}/border-${name}.png`, clip: undefined }).catch(() => {});

// Skia 노드 데이터 (store → bridge) 판독 + 요소를 화면 안으로
const skia = () => page.evaluate((id) => { const n = window.__composition_SKIA_DEBUG__?.getSkiaNode(id); const b = n?.box; return b ? { borderRadius: b.borderRadius, strokeWidth: b.strokeWidth, strokeWidths: b.strokeWidths, strokeStyle: b.strokeStyle, strokeColor: b.strokeColor ? Array.from(b.strokeColor).map((v) => Math.round(v * 100) / 100) : null, type: n.type } : { type: n?.type ?? null }; }, elId);
const bringIntoView = async () => {
  const r = await page.evaluate((id) => { const st = window.__composition_STORE__.getState(); const lm = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.(); const b = lm?.get(id); const pp = st.pagePositions?.[st.currentPageId]; return { b: b ? { x: b.x, y: b.y, w: b.width, h: b.height } : null, pp, vp: window.__composition_VIEWPORT__?.() }; }, elId);
  log("layout rect / page pos / viewport", r);
  if (r.b) { const px = (r.pp?.x ?? 0) + r.b.x; const py = (r.pp?.y ?? 0) + r.b.y; await page.evaluate(({ px, py }) => window.__composition_APPLY_VIEWPORT__?.({ scale: 1, x: -px + 600, y: -py + 400 }), { px, py }); await page.waitForTimeout(600); log("viewport after", await page.evaluate(() => window.__composition_VIEWPORT__?.())); }
};
await bringIntoView();
log("skia initial", await skia());
log("controls", await M(`${B} .border-sides .react-aria-ToggleButton, ${B} .border-corner, ${B} .border-corner input, ${B} .border-style .react-aria-ToggleButton`));
log("initial", await style());
await page.locator(`${B}`).screenshot({ path: `${OUT}/border-section-0.png` });

// ① 「좌」 해제 → 변 마스크 [4,4,4,0] longhand, shorthand 없음
await page.locator(`${B} .border-sides .react-aria-ToggleButton[aria-label="Left"]`).click(); await page.waitForTimeout(700);
log("after left off", await style()); log("skia after left off", await skia());
log("sides selected", await page.evaluate((B) => Array.from(document.querySelectorAll(`${B} .border-sides .react-aria-ToggleButton`)).map((el) => `${el.getAttribute("aria-label")}:${el.getAttribute("aria-pressed") ?? el.getAttribute("data-selected")}`), B));
await page.locator(`${B}`).screenshot({ path: `${OUT}/border-section-1-mask.png` });
await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/border-full-1-mask.png` });

// ② 색 편집 (companion 이 borderWidth 를 다시 넣지 않아야 — round 2 h6)
await page.evaluate(() => window.__composition_STORE__.getState().updateSelectedStyle("borderColor", "#e8443f")); await page.waitForTimeout(500);
log("after color edit", await style());

// ③ TL 코너 12 → 코너 longhand [12,16,16,16], borderRadius 없음
const tl = page.locator(`${B} .border-corner-tl input`).first();
await tl.click(); await tl.fill("40"); await tl.press("Enter"); await page.waitForTimeout(700);
log("after TL 40", await style()); log("skia after TL 40", await skia());
await page.locator(`${B}`).screenshot({ path: `${OUT}/border-section-2-corner.png` });
await page.screenshot({ path: `${OUT}/border-full-2-corner.png` });

// ④ Modified 탭 (5번째) — longhand 행 8 이 보이는가 (라벨 i18n)
await page.locator(".styles-panel-tab").nth(4).click(); await page.waitForTimeout(500);
const modRows = await page.evaluate((P) => Array.from(document.querySelectorAll(`${P} .modified-row__key`)).map((el) => el.textContent), P);
log("modified rows", modRows);
await page.locator(`${P} .panel-contents`).screenshot({ path: `${OUT}/border-modified.png` });
await page.locator(".styles-panel-tab").nth(1).click(); await page.waitForTimeout(400);

// ⑤ 「전체」 → shorthand 복귀 (변) · Radius 슬라이더 프리셋 → shorthand 복귀 (코너)
await page.locator(`${B} .border-sides .react-aria-ToggleButton[aria-label="All"]`).click(); await page.waitForTimeout(700);
log("after all", await style());
await page.evaluate(() => window.__composition_STORE__.getState().updateSelectedStyle("borderRadius", "8px")); await page.waitForTimeout(500);
log("after radius shorthand 8", await style());

// ⑥ 미지원 style (double) 에서 세그먼트 비활성 + 비균일이면 배지
await page.evaluate(() => window.__composition_STORE__.getState().updateSelectedStyles({ borderStyle: "double", borderTopWidth: "4px", borderRightWidth: "4px", borderBottomWidth: "0px", borderLeftWidth: "4px" })); await page.waitForTimeout(700);
log("double + mask", await style());
log("seg disabled / badge", await page.evaluate((B) => ({ disabled: Array.from(document.querySelectorAll(`${B} .border-sides .react-aria-ToggleButton`)).map((el) => el.getAttribute("aria-disabled") ?? el.hasAttribute("disabled")), badge: document.querySelector(`${B} .border-sides-badge`)?.textContent ?? null }), B));
await page.locator(`${B}`).screenshot({ path: `${OUT}/border-section-3-double.png` });

// ⑦ 절 reset → border 키 정리 (base 재저장 없이)
await page.locator(`${B} .section-header button[aria-label*="eset"]`).first().click().catch(() => {}); await page.waitForTimeout(700);
log("after section reset", await style());

console.log("errors", errors.slice(0, 3));
await browser.close();
