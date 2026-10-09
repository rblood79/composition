// Canvas box = Preview box live (사용자 2026-10-09 「의심된 Preview class · data-size 누락 먼저
// 확인하고 수정」) — real Builder (headed Chrome, Compare Mode): for the types whose Preview root
// carries no `react-aria-<Type>` class, the Canvas rect and the Preview rect match (±1px); the probe
// also adds the class · data-size · data-variant to the Preview root and records what changed
// (`withClass` — empty: those generated sheets are not in the Preview, the renderers inline their
// box). Found 2026-10-09: StatusLight width (Canvas 75 / Preview 1920) and IllustratedMessage
// height (48 / 240) — fixed.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/preview-canvas-box-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
const page = await context.newPage();
const errors = [];
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1500)}\n`,
  );
};
page.on("pageerror", (e) =>
  errors.push(`pageerror: ${e.message.slice(0, 300)}`),
);
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
async function addFromPalette(label) {
  const search = page.getByLabel("Search components");
  if (!(await search.isVisible().catch(() => false)))
    await page
      .getByRole("button", { name: "Components", exact: true })
      .first()
      .click();
  await search.fill(label instanceof RegExp ? "chart" : label);
  await page.waitForTimeout(300);
  await page
    .locator(".list-item", {
      hasText: label instanceof RegExp ? label : new RegExp(`^${label}$`, "i"),
    })
    .first()
    .click();
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
  // (Close the Components panel: it covers the Preview half in Compare Mode.)
  await page
    .getByRole("button", { name: "Components", exact: true })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(300);
}
async function compareOn() {
  const button = page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .first();
  if (await button.isVisible().catch(() => false)) await button.click();
  await page.waitForTimeout(3000);
}
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const exec = (build, arg) =>
  page.evaluate(
    async ({ commands, build, arg }) => {
      const c = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      try {
        ws.execute(
          new Function("c", "ws", "arg", `return (${build})(c, ws, arg);`)(
            c,
            ws,
            arg,
          ),
        );
        await new Promise((r) => setTimeout(r, 800));
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error?.code ?? String(error) };
      }
    },
    { commands, build: build.toString(), arg },
  );

await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i });

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("Canvas preview box");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
const TYPES = [
  ["button group", "ButtonGroup"],
  ["avatar group", "AvatarGroup"],
  ["card view", "CardView"],
  ["avatar", "Avatar"],
  ["status light", "StatusLight"],
  ["progress circle", "ProgressCircle"],
  ["illustrated message", "IllustratedMessage"],
];
let compare = false;
for (const [palette, type] of TYPES) {
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.session.clearSelection(),
  );
  const added = await addFromPalette(palette).then(() => true).catch(() => false);
  if (!compare) {
    await compareOn();
    compare = true;
  }
  await page.waitForTimeout(800);
  const result = await page.evaluate((type) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const record = [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type).at(-1);
    if (!record) return { missing: true };
    const geo = root.getGeometry([record.id]).get(record.id);
    const doc = document.querySelector("#previewFrame").contentDocument;
    const el = doc.querySelector(`[data-catalog-id="${record.id}"]`);
    if (!el) return { noDom: true, canvas: geo };
    const view = doc.defaultView;
    const snap = () => {
      const cs = view.getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        w: Math.round(r.width * 10) / 10,
        h: Math.round(r.height * 10) / 10,
        border: cs.borderTopWidth + " " + cs.borderTopStyle + " " + cs.borderTopColor,
        padding: cs.padding,
        font: cs.fontSize,
        color: cs.color,
        bg: cs.backgroundColor,
        radius: cs.borderRadius,
        gap: cs.gap,
        display: cs.display,
      };
    };
    const rules = [];
    for (const sheet of doc.styleSheets) {
      let list;
      try { list = sheet.cssRules; } catch { continue; }
      const walk = (rs) => {
        for (const r of rs) {
          if (r.selectorText?.includes(`react-aria-${type}`)) rules.push(r.selectorText.slice(0, 60));
          if (r.cssRules) walk(r.cssRules);
        }
      };
      walk(list);
    }
    const before = snap();
    const cls = el.className;
    const props = record.props;
    el.classList.add(`react-aria-${type}`);
    if (props.size) el.setAttribute("data-size", String(props.size));
    if (props.variant) el.setAttribute("data-variant", String(props.variant));
    const after = snap();
    el.className = cls;
    const diff = Object.fromEntries(
      Object.keys(before).filter((k) => before[k] !== after[k]).map((k) => [k, [before[k], after[k]]]),
    );
    return {
      class: cls,
      size: props.size,
      variant: props.variant,
      canvas: geo && { w: Math.round(geo.width * 10) / 10, h: Math.round(geo.height * 10) / 10 },
      dom: { w: before.w, h: before.h },
      withClass: diff,
      sheetRules: rules.length,
      sample: rules.slice(0, 3),
      inline: el.getAttribute("style")?.slice(0, 160),
    };
  }, type);
  const same =
    !!result.canvas &&
    Math.abs(result.canvas.w - result.dom.w) <= 1 &&
    Math.abs(result.canvas.h - result.dom.h) <= 1;
  record(`${type}: Canvas box = Preview box`, same, { added, ...result });
  await page.screenshot({ path: `${OUT}/${type}.png` });
}
record("no errors", errors.length === 0, { errors: errors.slice(0, 6) });
await browser.close();
