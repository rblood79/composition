// Checkbox · Switch emphasized live (사용자 2026-10-09 「Checkbox · Switch variant ↔ isEmphasized
// 진행해」) — real Builder (headed Chrome, Compare Mode): a selected Checkbox · Switch with variant
// emphasized paints its indicator accent on the Canvas and in the Preview (the DOM read an unaccepted
// `isEmphasized`, so the Preview stayed neutral); variant default is neutral on both; no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/toggle-emphasized-live.mjs <out>
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
  await search.fill(label);
  await page.waitForTimeout(300);
  await page
    .locator(".list-item", { hasText: new RegExp(`^${label}$`, "i") })
    .first()
    .click();
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Components", exact: true })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(300);
}
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const setProps = (type, props) =>
  page.evaluate(
    async ({ commands, type, props }) => {
      const c = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const root = ws.root;
      const node = [...root.canvasInputs.values()].find(
        (r) => root.typeOf(r) === type,
      );
      ws.execute(
        c.setFields({
          targets: [ws.positionOfRecord(node.id).target],
          props: Object.fromEntries(
            Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
          ),
        }),
      );
      await new Promise((r) => setTimeout(r, 900));
    },
    { commands, type, props },
  );
const read = (type) =>
  page.evaluate((type) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const getSkiaNode = (id) =>
      window.__composition_SKIA_DEBUG__?.getSkiaNode?.(id);
    const rgb = (c) =>
      c ? Array.from(Object.values(c)).slice(0, 3).map((v) => Math.round(v * 255)) : null;
    const records = [...root.canvasInputs.values()];
    const indicator = records.find((r) => root.typeOf(r) === `${type}Indicator`);
    const data = indicator ? getSkiaNode(indicator.id) : undefined;
    const fills = [data?.box?.fillColor, ...(data?.children ?? []).map((c) => c.box?.fillColor)]
      .filter(Boolean)
      .map(rgb);
    const owner = records.find((r) => root.typeOf(r) === type);
    const doc = document.querySelector("#previewFrame").contentDocument;
    const el = doc.querySelector(`[data-catalog-id="${owner.id}"]`);
    const ind = el.querySelector(type === "Checkbox" ? ".checkbox" : ".indicator");
    const toRgb = (color) => {
      const ctx = new OffscreenCanvas(1, 1).getContext("2d");
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3);
    };
    const accent = toRgb(doc.defaultView.getComputedStyle(doc.documentElement).getPropertyValue("--accent").trim());
    return {
      canvasFills: fills,
      preview: ind ? toRgb(doc.defaultView.getComputedStyle(ind).backgroundColor) : null,
      emphasized: el.hasAttribute("data-emphasized"),
      accent,
    };
  }, type);
const near = (a, b) => !!a && !!b && a.every((v, i) => Math.abs(v - b[i]) <= 2);

await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await page.waitForTimeout(300);
await page.keyboard.type("Toggle emphasized");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await page.waitForTimeout(1500);
await addFromPalette("checkbox");
await addFromPalette("switch");
const compare = page.getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true }).first();
if (await compare.isVisible().catch(() => false)) await compare.click();
await page.waitForTimeout(3000);

for (const type of ["Checkbox", "Switch"]) {
  await setProps(type, { isSelected: true, variant: "emphasized" });
  const on = await read(type);
  record(
    `${type} selected + emphasized: Canvas indicator accent = Preview indicator accent`,
    on.emphasized && near(on.preview, on.accent) && on.canvasFills.some((f) => near(f, on.accent)),
    on,
  );
  await page.screenshot({ path: `${OUT}/${type}-emphasized.png` });
  await setProps(type, { variant: "default" });
  const off = await read(type);
  record(
    `${type} selected + default: neither side accent`,
    !off.emphasized && !near(off.preview, off.accent) && !off.canvasFills.some((f) => near(f, off.accent)),
    off,
  );
}
record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
