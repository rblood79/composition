import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
const OUT = "/private/tmp/claude-501/-Users-admin-work-composition/f6bcc488-f176-4644-8364-3625704b801c/scratchpad/props-after"; mkdirSync(OUT, { recursive: true });
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 3000 }, deviceScaleFactor: 1 })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`im-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const panel = async (name) => { await page.getByRole("button", { name, exact: true }).first().click(); await page.waitForTimeout(400); };
const P = '[data-panel-id="properties"]';
const type = process.argv[2] ?? "Menu";
await panel("Components");
const item = page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: new RegExp(`^${type.replace(/([a-z])([A-Z])/g, "$1 ?$2")}$`, "i") }) }).first();
await item.scrollIntoViewIfNeeded(); await item.click(); await page.waitForTimeout(900);
await panel("Components").catch(() => {});
await panel("Properties"); await page.waitForTimeout(400);
const grow = async () => page.evaluate((P) => { const pc = document.querySelector(`${P} .panel-contents`); const h = pc.scrollHeight + 8; let el = pc; while (el && !el.classList.contains("panel-dock-surface")) { el.style.setProperty("height", el === pc ? h + "px" : "auto", "important"); el.style.setProperty("max-height", "none", "important"); el.style.setProperty("overflow", "visible", "important"); el = el.parentElement; } }, P);
const geom = async () => page.evaluate((P) => { const fs = document.querySelector(`${P} fieldset.items-manager`); if (!fs) return "NO items-manager"; const rows = Array.from(fs.querySelectorAll(".items-manager-row")).map((r) => { const body = r.querySelector(".list-row__body").getBoundingClientRect(); const acts = r.querySelector(".list-row__actions").getBoundingClientRect(); const btns = Array.from(r.querySelectorAll(".list-row__action")).map((x) => `${Math.round(x.getBoundingClientRect().width)}×${Math.round(x.getBoundingClientRect().height)}`); return `${r.querySelector(".list-row__label").textContent.trim()} body ${Math.round(body.width)}×${Math.round(body.height)} acts ${Math.round(acts.width)}×${Math.round(acts.height)} btn ${btns.join(",")}`; }); const lg = fs.querySelector("legend").getBoundingClientRect(); return `legend「${fs.querySelector("legend").textContent.trim()}」 h${Math.round(lg.height)} · ` + rows.join(" | "); }, P);
console.log("closed:", await geom());
// 첫 행 펼치기
const exp = page.locator(`${P} .items-manager-row__expand`).first();
if (await exp.count()) { await exp.click(); await page.waitForTimeout(300); }
console.log("open:", await page.evaluate((P) => Array.from(document.querySelectorAll(`${P} .items-manager-row-fields fieldset`)).map((f) => `${f.querySelector("legend")?.textContent.trim()} ${Math.round(f.getBoundingClientRect().width)}×${Math.round(f.getBoundingClientRect().height)}`).join(" | "), P));
await grow();
await page.locator(`${P} .panel-contents`).screenshot({ path: `${OUT}/items-${type}.png` });
// 삭제 동작
const before = await page.evaluate(() => { const st = window.__composition_STORE__.getState(); const el = st.elementsMap.get(st.selectedElementId); return (el.props.items ?? el.props.data ?? []).length; });
await page.locator(`${P} .list-row__actions .list-row__action`).first().click(); await page.waitForTimeout(400);
const after = await page.evaluate(() => { const st = window.__composition_STORE__.getState(); const el = st.elementsMap.get(st.selectedElementId); return (el.props.items ?? el.props.data ?? []).length; });
console.log("remove:", before, "→", after);
console.log("errors", errors.slice(0, 5));
await browser.close();
