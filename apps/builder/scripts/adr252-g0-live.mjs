// ADR-252 G0: before the merge — the Styles tab row with six tabs at 233 · 387 px (ko · en), and
// the per-tab screenshots of both panels (Properties body + Styles 5 tabs) at both widths.
//
//   T1  six tabs: one unselected tab cloned into the Styles TabList (icon only, the width an extra
//       tab takes), then each candidate label (Property · Layout · Style · Text · Screen · Modified
//       and the ko labels) set on the selected tab — truncated when scrollWidth > clientWidth
//   S1  screenshots: a Button selected, Properties panel and each Styles tab, panel width 233 · 387
//
// The panel width is set on the wrapper's inline style (the panel body lays out from its wrapper).
// Preview / Compare Mode are not opened.
// Usage: BUILDER_URL=http://localhost:5173 node scripts/adr252-g0-live.mjs <outDir> [authSession]
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const state = JSON.parse(
  readFileSync(process.argv[3] ?? "scripts/.auth-session.json", "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const WIDTHS = (process.env.ADR252_WIDTHS ?? "233,387").split(",").map(Number);
const SHOTS = process.env.ADR252_NO_SHOTS !== "1";
const LABELS = {
  "en-US": ["Property", "Layout", "Style", "Text", "Screen", "Modified"],
  "ko-KR": ["속성", "레이아웃", "스타일", "텍스트", "화면", "수정됨"],
};
const result = { base: BASE, tabs: {}, errors: [] };

for (const locale of Object.keys(LABELS)) {
  const context = await browser.newContext({
    storageState: state,
    viewport: { width: 1600, height: 1000 },
  });
  await context.addInitScript((l) => {
    localStorage.setItem("composition-locale", l);
  }, locale);
  const page = await context.newPage();
  page.on("pageerror", (e) => result.errors.push(`${locale} pageerror: ${e.message.slice(0, 200)}`));

  await page.goto(`${BASE}/dashboard`);
  await page.locator("button.dashboard-create-button").first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type(`adr252-g0-${locale}`);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
  await page.waitForTimeout(1500);

  // A Button from the palette (selected after insert).
  const rail = (id) => page.locator(`.panel-toggle-rail button[data-panel-id="${id}"], .panel-toggle-rail button[aria-controls*="${id}"]`);
  const openRail = async (id, name) => {
    const byId = rail(id);
    const button = (await byId.count()) ? byId.first() : page.locator(`.panel-toggle-rail button[aria-label="${name}"]`).first();
    if ((await button.getAttribute("aria-pressed")) !== "true") await button.click();
    await page.waitForTimeout(500);
  };
  const names = locale === "ko-KR"
    ? { components: "컴포넌트", properties: "속성", styles: "스타일" }
    : { components: "Components", properties: "Properties", styles: "Styles" };
  await openRail("components", names.components);
  const search = page.getByLabel(locale === "ko-KR" ? /컴포넌트 검색|Search components/ : "Search components").first();
  try {
    await search.fill("Button", { timeout: 5000 });
    await page.waitForTimeout(300);
    await page.locator(".list-item", { hasText: /^Button$/i }).first().click({ timeout: 5000 });
  } catch (error) {
    writeFileSync(`${OUT}/palette-${locale}-error.png`, await page.screenshot());
    throw error;
  }
  await page.waitForTimeout(800);
  await openRail("properties", names.properties);
  await openRail("styles", names.styles);

  const setWidth = (panel, width) =>
    page.evaluate(
      ([p, w]) => {
        const el = document.querySelector(`.panel-wrapper[data-panel="${p}"]`);
        if (!el) return false;
        el.style.width = `${w}px`;
        el.style.maxWidth = `${w}px`;
        el.style.minWidth = `${w}px`;
        return true;
      },
      [panel, width],
    );

  result.tabs[locale] = {};
  for (const width of WIDTHS) {
    await setWidth("styles", width);
    await setWidth("properties", width);
    await page.waitForTimeout(300);
    // T1 — six tabs.
    const measure = await page.evaluate((labels) => {
      const wrapper = document.querySelector('.panel-wrapper[data-panel="styles"]');
      const list = wrapper.querySelector(".panel-tablist");
      const tabs = [...list.querySelectorAll(".panel-tab")];
      const unselected = tabs.find((t) => !t.hasAttribute("data-selected"));
      const clone = unselected.cloneNode(true);
      clone.setAttribute("data-adr252-clone", "");
      list.prepend(clone);
      const selected = list.querySelector(".panel-tab[data-selected]");
      const label = selected.querySelector(".panel-tab-label");
      const original = label.textContent;
      const rows = labels.map((text) => {
        label.textContent = text;
        return {
          text,
          labelClient: label.clientWidth,
          labelScroll: label.scrollWidth,
          truncated: label.scrollWidth > label.clientWidth,
        };
      });
      label.textContent = original;
      const tabWidths = [...list.querySelectorAll(".panel-tab")].map((t) => Math.round(t.getBoundingClientRect().width * 10) / 10);
      clone.remove();
      return {
        wrapperWidth: wrapper.getBoundingClientRect().width,
        listWidth: list.getBoundingClientRect().width,
        tabWidths,
        rows,
      };
    }, LABELS[locale]);
    result.tabs[locale][width] = measure;

    // S1 — screenshots (en only: the G1 compare uses one locale).
    if (SHOTS && locale === "en-US") {
      const props = page.locator('.panel-wrapper[data-panel="properties"]');
      writeFileSync(`${OUT}/properties-${width}.png`, await props.screenshot());
      const styles = page.locator('.panel-wrapper[data-panel="styles"]');
      const tabList = styles.locator(".panel-tablist .panel-tab");
      const count = await tabList.count();
      for (let i = 0; i < count; i++) {
        await tabList.nth(i).click();
        await page.waitForTimeout(300);
        const id = await tabList.nth(i).getAttribute("data-key");
        writeFileSync(`${OUT}/styles-${i}${id ? `-${id}` : ""}-${width}.png`, await styles.screenshot());
      }
      await tabList.nth(0).click();
    }
  }
  await context.close();
}
await browser.close();
writeFileSync(`${OUT}/g0.json`, JSON.stringify(result, null, 2));
for (const [locale, byWidth] of Object.entries(result.tabs))
  for (const [width, m] of Object.entries(byWidth))
    process.stdout.write(
      `${locale} ${width}px list=${m.listWidth} tabs=${JSON.stringify(m.tabWidths)} ` +
        m.rows.map((r) => `${r.text}:${r.labelScroll}/${r.labelClient}${r.truncated ? "✗" : "✓"}`).join(" ") +
        "\n",
    );
if (result.errors.length) process.stdout.write(`errors: ${JSON.stringify(result.errors)}\n`);
