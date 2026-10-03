// ADR-252 live: the Design panel in the real Builder (headless Chrome, a fresh profile + the saved
// auth session straight to /dashboard, a new project with one Button).
//
//   mode `before` (a build before the merge): the Properties panel alone, then the Styles panel
//       alone (each tab) — the body (`.panel-contents`) screenshots at 264 · 387 px
//   mode `after` (this build):
//     G1  each Design tab's body at 264 · 387 px = the `before` body (pixel compare in the page)
//     G2  rail: one Design button, no Styles · ⌥5 toggles · ⌥6 opens on Layout, again closes ·
//         ⌘⌥C copies props on Property and the style on a style tab · ⌥⇧S focus mode on a style
//         tab only · the palette shows Copy Styles unavailable on Property · page settings opens
//         Design on Property · reload keeps the panel
// Preview / Compare Mode are not opened.
// Usage: BUILDER_URL=<url> node scripts/adr252-live.mjs <before|after> <outDir> [beforeDir]
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const [MODE, OUT, BEFORE_DIR] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const state = JSON.parse(readFileSync("scripts/.auth-session.json", "utf8"));
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
await context.grantPermissions(["clipboard-read", "clipboard-write"], {
  origin: BASE,
});
const LOCALE = process.env.ADR252_LOCALE ?? "en-US";
await context.addInitScript((l) => localStorage.setItem("composition-locale", l), LOCALE);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
const results = [];
const record = (id, pass, detail = {}) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} ${JSON.stringify(detail).slice(0, 400)}\n`,
  );
};
const WIDTHS = [264, 387];
const isMac = process.platform === "darwin";
const mod = isMac ? "Meta" : "Control";

await page.goto(`${BASE}/dashboard`);
await page.locator("button.dashboard-create-button").first().click();
await page.waitForTimeout(300);
await page.keyboard.type(`adr252-${MODE}`);
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
  timeout: 30000,
});
await page.waitForTimeout(1500);

if (MODE === "widths") {
  // The minimum width (233) with five tabs: each tab selected, its label not cut (any locale).
  await page.keyboard.press("Alt+Digit5");
  await page.waitForTimeout(600);
  const rows = [];
  for (const width of [233, 387]) {
    await page.evaluate((w) => {
      const el = document.querySelector('.panel-wrapper[data-panel="properties"]');
      for (const k of ["width", "maxWidth", "minWidth"]) el.style[k] = `${w}px`;
    }, width);
    const tabCount = await page.locator('.panel-wrapper[data-panel="properties"] .panel-tablist .panel-tab').count();
    for (let i = 0; i < tabCount; i++) {
      await page.locator('.panel-wrapper[data-panel="properties"] .panel-tablist .panel-tab').nth(i).click();
      await page.waitForTimeout(200);
      rows.push(await page.evaluate((w) => {
        const label = document.querySelector('.panel-wrapper[data-panel="properties"] .panel-tab[data-selected] .panel-tab-label');
        return { width: w, text: label?.textContent, scroll: label?.scrollWidth, client: label?.clientWidth };
      }, width));
    }
  }
  record(`widths ${LOCALE}: five tabs, no label cut at 233 · 387`, rows.length === 10 && rows.every((r) => r.scroll <= r.client), { rows });
  writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
  await browser.close();
  process.exit(0);
}

const rail = (name) =>
  page.locator(`.panel-toggle-rail button[aria-label="${name}"]`).first();
const setRail = async (name, on) => {
  const button = rail(name);
  if (!(await button.count())) return false;
  const pressed = (await button.getAttribute("aria-pressed")) === "true";
  if (pressed !== on) {
    await button.click();
    await page.waitForTimeout(400);
  }
  return true;
};
// A Button from the palette (selected after insert).
await setRail("Components", true);
await page.getByLabel("Search components").first().fill("Button");
await page.waitForTimeout(300);
await page.locator(".list-item", { hasText: /^Button$/i }).first().click();
await page.waitForTimeout(800);
await setRail("Components", false);
await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  window.__A252__ = {
    selection: () => ws.session.getSnapshot().selection.map((s) => s.identity),
  };
});

const setWidth = (panel, width) =>
  page.evaluate(
    ([p, w]) => {
      const el = document.querySelector(`.panel-wrapper[data-panel="${p}"]`);
      if (!el) return false;
      for (const k of ["width", "maxWidth", "minWidth"]) el.style[k] = `${w}px`;
      return true;
    },
    [panel, width],
  );
const body = (panel) =>
  page.locator(`.panel-wrapper[data-panel="${panel}"] .panel-contents`).first();
const tabs = (panel) =>
  page.locator(`.panel-wrapper[data-panel="${panel}"] .panel-tablist .panel-tab`);
const STYLE_TABS = ["layout", "style", "text", "screen"];

if (MODE === "before") {
  await setRail("Styles", false);
  await setRail("Properties", true);
  for (const width of WIDTHS) {
    await setWidth("properties", width);
    await page.waitForTimeout(300);
    writeFileSync(`${OUT}/property-${width}.png`, await body("properties").screenshot());
  }
  await setRail("Properties", false);
  await setRail("Styles", true);
  for (const width of WIDTHS) {
    await setWidth("styles", width);
    for (let i = 0; i < STYLE_TABS.length; i++) {
      await tabs("styles").nth(i).click();
      await page.waitForTimeout(300);
      writeFileSync(`${OUT}/${STYLE_TABS[i]}-${width}.png`, await body("styles").screenshot());
    }
    await tabs("styles").nth(0).click();
  }
  record("before-shots", true);
} else {
  // ---- G2 rail
  const railNames = await page
    .locator(".panel-toggle-rail button[aria-label]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  record("G2 rail: Design once, no Styles · Properties", railNames.filter((n) => n === "Design").length === 1 && !railNames.includes("Styles") && !railNames.includes("Properties"), { railNames });

  await setRail("Design", true);
  const tabNames = await tabs("properties").evaluateAll((els) =>
    els.map((e) => e.getAttribute("aria-label")),
  );
  record("G1 tab row: five tabs (no Modified)", tabNames.length === 5 && !tabNames.includes("Modified"), { tabNames });

  // ---- G1 body compare
  const compare = async (name, width) => {
    const beforeB64 = readFileSync(`${BEFORE_DIR}/${name}-${width}.png`).toString("base64");
    const afterBuf = await body("properties").screenshot();
    writeFileSync(`${OUT}/${name}-${width}.png`, afterBuf);
    return page.evaluate(
      async ([a, b]) => {
        const load = (src) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.src = `data:image/png;base64,${src}`;
          });
        const [ia, ib] = await Promise.all([load(a), load(b)]);
        const w = Math.min(ia.width, ib.width);
        const h = Math.min(ia.height, ib.height);
        const px = (img) => {
          const c = document.createElement("canvas");
          c.width = w;
          c.height = h;
          const g = c.getContext("2d");
          g.drawImage(img, 0, 0);
          return g.getImageData(0, 0, w, h).data;
        };
        const da = px(ia);
        const db = px(ib);
        let diff = 0;
        let firstY = -1;
        for (let i = 0; i < da.length; i += 4) {
          const d = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
          if (d > 24) {
            diff++;
            if (firstY < 0) firstY = Math.floor(i / 4 / w);
          }
        }
        // The shorter scroller's bottom 24px is the scroll-hint fade (panel-system.css) — the
        // body heights differ when the header rows do, so that band is reported apart.
        const fadeTop = ia.height !== ib.height ? h - 24 : h;
        let diffAboveFade = 0;
        for (let i = 0; i < fadeTop * w * 4; i += 4) {
          const d = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
          if (d > 24) diffAboveFade++;
        }
        return { w, h, sizes: [ia.width, ia.height, ib.width, ib.height], diff, diffAboveFade, fadeTop, firstY };
      },
      [beforeB64, afterBuf.toString("base64")],
    );
  };
  for (const width of WIDTHS) {
    await setWidth("properties", width);
    await tabs("properties").nth(0).click();
    await page.waitForTimeout(300);
    const r = await compare("property", width);
    record(`G1 property ${width}`, r.diffAboveFade === 0, r);
    for (let i = 0; i < STYLE_TABS.length; i++) {
      await tabs("properties").nth(i + 1).click();
      await page.waitForTimeout(300);
      const s = await compare(STYLE_TABS[i], width);
      record(`G1 ${STYLE_TABS[i]} ${width}`, s.diff === 0, s);
    }
  }
  await setWidth("properties", 387);
  await tabs("properties").nth(0).click();
  await page.waitForTimeout(300);

  // The whole panel at the minimum width (for the user check, G5).
  await setWidth("properties", 264);
  for (const [i, name] of [[0, "property"], [1, "layout"]]) {
    await tabs("properties").nth(i).click();
    await page.waitForTimeout(300);
    writeFileSync(
      `${OUT}/panel-${name}-264.png`,
      await page.locator('.panel-wrapper[data-panel="properties"]').screenshot(),
    );
  }
  await setWidth("properties", 387);
  await tabs("properties").nth(0).click();

  // ---- G2 keys (focus in the panel: its header)
  // Keys outside an input (a field keeps the focus after Enter; the registry skips inputs).
  const focusPanel = async () => {
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.locator('.panel-wrapper[data-panel="properties"] .panel-title').first().click();
  };
  const visible = () =>
    page.evaluate(() => {
      const el = document.querySelector('.panel-wrapper[data-panel="properties"]');
      return !!el && el.getBoundingClientRect().width > 0 && getComputedStyle(el).visibility !== "hidden";
    });
  const designPressed = async () => (await rail("Design").getAttribute("aria-pressed")) === "true";
  const selectedTab = () =>
    page
      .locator('.panel-wrapper[data-panel="properties"] .panel-tab[data-selected]')
      .first()
      .getAttribute("aria-label");

  await page.keyboard.press("Escape");
  await page.locator("[data-testid='skia-canvas-unified']").first().hover();
  await page.keyboard.press("Alt+Digit5");
  await page.waitForTimeout(400);
  const off5 = await designPressed();
  await page.keyboard.press("Alt+Digit5");
  await page.waitForTimeout(400);
  const on5 = await designPressed();
  record("G2 ⌥5 toggles Design", off5 === false && on5 === true, { off5, on5 });

  await page.keyboard.press("Alt+Digit6");
  await page.waitForTimeout(400);
  const tab6 = await selectedTab();
  const open6 = await designPressed();
  await page.keyboard.press("Alt+Digit6");
  await page.waitForTimeout(400);
  const closed6 = await designPressed();
  await page.keyboard.press("Alt+Digit6");
  await page.waitForTimeout(400);
  const reopened6 = await designPressed();
  record("G2 ⌥6 opens on Layout, again closes", tab6 === "Layout" && open6 && !closed6 && reopened6, { tab6, open6, closed6, reopened6 });

  // Re-select the Button (Escape cleared it) — the Layers row, as a user would.
  await setRail("Navigator", true);
  for (let round = 0; round < 6; round++) {
    const row = page.locator(".elementItem").filter({ hasText: /^\s*Button\s*$/ });
    if (await row.count()) {
      await row.first().click();
      break;
    }
    const expand = page.getByRole("button", { name: /^Expand / });
    if (!(await expand.count())) break;
    await expand.first().click();
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(400);
  const now = await page.evaluate(() => window.__A252__.selection());
  record("selection restored (Layers)", now.length === 1, { now });

  const clip = () => page.evaluate(() => navigator.clipboard.readText());
  // An own prop to copy: the Button's label field (a fresh instance has no own value).
  await tabs("properties").nth(0).click();
  await page.waitForTimeout(300);
  const inputs = await page.evaluate(() =>
    [...document.querySelectorAll(".design-property-contents input, .design-property-contents textarea")].map((el, i) => [i, el.getAttribute("aria-label") ?? el.closest("fieldset")?.querySelector("legend")?.textContent ?? "", el.value]),
  );
  const labelIndex = inputs.find(([, , v]) => v === "Button")?.[0];
  if (labelIndex !== undefined) {
    const field = page.locator(".design-property-contents input, .design-property-contents textarea").nth(labelIndex);
    await field.click({ clickCount: 3 });
    await page.keyboard.type("Save");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
  }
  record("own label written", labelIndex !== undefined, { inputs: inputs.slice(0, 12) });
  // An own style to copy: Layout tab › Width.
  await tabs("properties").nth(1).click();
  await page.waitForTimeout(300);
  const widthIndex = await page.evaluate(() =>
    [...document.querySelectorAll(".styles-panel-groups input")].findIndex(
      (el) => el.closest("fieldset")?.querySelector("legend")?.textContent?.trim() === "Width",
    ),
  );
  if (widthIndex >= 0) {
    const field = page.locator(".styles-panel-groups input").nth(widthIndex);
    await field.click({ clickCount: 3 });
    await page.keyboard.type("120");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
  }
  record("own width written", widthIndex >= 0, { widthIndex });
  await tabs("properties").nth(0).click();
  await page.waitForTimeout(300);
  await focusPanel();
  await page.evaluate(() => navigator.clipboard.writeText(""));
  await page.keyboard.press(`${mod}+Alt+KeyC`);
  await page.waitForTimeout(400);
  const propClip = await clip();
  await tabs("properties").nth(1).click();
  await page.waitForTimeout(300);
  await focusPanel();
  await page.evaluate(() => navigator.clipboard.writeText(""));
  await page.keyboard.press(`${mod}+Alt+KeyC`);
  await page.waitForTimeout(400);
  const styleClip = await clip();
  let propJson = {};
  let styleJson = {};
  try { propJson = JSON.parse(propClip); } catch {}
  try { styleJson = JSON.parse(styleClip); } catch {}
  record("G2 ⌘⌥C follows the tab", "children" in propJson && !("children" in styleJson) && Object.keys(styleJson).length > 0, { propClip: propClip.slice(0, 160), styleClip: styleClip.slice(0, 160) });

  // ⌥⇧S focus mode on a style tab only.
  await tabs("properties").nth(1).click();
  await page.waitForTimeout(300);
  await focusPanel();
  await page.keyboard.press("Alt+Shift+KeyS");
  await page.waitForTimeout(300);
  const focusOn = await page.locator(".focus-mode-indicator").count();
  await page.keyboard.press("Alt+Shift+KeyS");
  await page.waitForTimeout(300);
  await tabs("properties").nth(0).click();
  await page.waitForTimeout(300);
  await focusPanel();
  await page.keyboard.press("Alt+Shift+KeyS");
  await page.waitForTimeout(300);
  await tabs("properties").nth(1).click();
  await page.waitForTimeout(300);
  const focusAfterPropertyPress = await page.locator(".focus-mode-indicator").count();
  record("G2 ⌥⇧S on a style tab only", focusOn === 1 && focusAfterPropertyPress === 0, { focusOn, focusAfterPropertyPress });

  // Palette on the Property tab: Copy Styles not executable, Copy Properties executable.
  await tabs("properties").nth(0).click();
  await page.waitForTimeout(300);
  await focusPanel();
  await page.keyboard.press(`${mod}+Slash`);
  await page.waitForTimeout(500);
  const palette = await page.evaluate(() =>
    [...document.querySelectorAll(".command-palette-item")]
      .filter((el) => /^(Copy Styles|Copy Properties)/.test(el.textContent ?? ""))
      .map((el) => [el.querySelector(".command-palette-item-label")?.textContent, el.dataset.availability]),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const pal = Object.fromEntries(palette);
  record("G2 palette: inactive tab's copy unavailable", pal["Copy Styles"] && pal["Copy Styles"] !== "executable" && pal["Copy Properties"] === "executable", { palette });

  // Page settings → Design on Property.
  await tabs("properties").nth(3).click();
  await page.waitForTimeout(300);
  await setRail("Design", false);
  await setRail("Navigator", true);
  const settings = page.locator('button[aria-label^="Settings for "]').first();
  await settings.hover().catch(() => {});
  await settings.click({ force: true });
  await page.waitForTimeout(600);
  const settingsTab = await selectedTab();
  record("G2 page settings opens Design on Property", (await designPressed()) && settingsTab === "Property", { settingsTab });

  // Reload keeps the panel (layout persisted).
  await page.waitForTimeout(800);
  await page.reload();
  await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
  await page.waitForTimeout(1500);
  const afterReload = await designPressed();
  const hydration = await page.evaluate(
    () => window.__composition_UI_STORE__?.getState?.().panelWorkspaceHydrationStatus ?? null,
  );
  record("G2 reload keeps Design open", afterReload, { hydration });
}

writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
if (errors.length) process.stdout.write(`errors: ${JSON.stringify(errors)}\n`);
await browser.close();
