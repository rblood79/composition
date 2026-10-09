// S2 Checkbox · Switch isEmphasized live (사용자 2026-10-10 「toggle 강조 축 전환 — 로드 시 1회
// 전환」): real Builder (headed Chrome, Compare Mode). A selected Checkbox from the palette:
// Emphasized turns the indicator accent in the Preview (`--selected-color`) and on the Canvas
// (the rule's emphasized variant — the derived internal `variant`). A Switch likewise
// (`--switch-color`). An old document whose node still authors `variant: "emphasized"` converts
// once on reload (`isEmphasized: true`, the variant write gone).
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-emphasis-toggle-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
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
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1200)}\n`,
  );
};
page.on("pageerror", (e) =>
  errors.push(`pageerror: ${e.message.slice(0, 300)}`),
);
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
async function addFromPalette(label) {
  await page.evaluate(() => {
    window.__COMPOSITION_CATALOG__.workspace.selectRecords([]);
  });
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
const panelText = (label) =>
  page
    .locator(".panel-wrapper[data-panel='properties']")
    .getByText(label, { exact: true })
    .first();
const toggleBool = async (label) => {
  await panelText(label).click();
  await page.waitForTimeout(1500);
};
const openDesign = async (label) => {
  for (let i = 0; i < 3; i++) {
    if (await panelText(label).isVisible().catch(() => false)) return true;
    await page
      .getByRole("button", { name: "Design", exact: true })
      .first()
      .click();
    await page.waitForTimeout(1200);
  }
  return panelText(label).isVisible().catch(() => false);
};
const setSelected = (source) =>
  page.evaluate(
    async ({ commands, source }) => {
      const c = await import(commands);
      window.__COMPOSITION_CATALOG__.workspace.execute(
        c.setFields({
          targets: [{ kind: "node", id: source }],
          props: { isSelected: { kind: "set", value: true } },
        }),
      );
      await new Promise((r) => setTimeout(r, 1000));
    },
    { commands, source },
  );
const select = (kind) =>
  page.evaluate((kind) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const node = [...root.canvasInputs.values()]
      .filter((r) => root.typeOf(r) === kind)
      .at(-1);
    ws.selectRecords([node.id]);
    return { id: node.id, source: node.sourceId };
  }, kind);
// Preview indicator color + the Canvas-side derived variant and the indicator's painted fill.
const toggleState = (id, indicatorSelector, indicatorType) =>
  page.evaluate(
    ({ id, indicatorSelector, indicatorType }) => {
      const doc = document.querySelector("#previewFrame").contentDocument;
      const owner = doc.querySelector(`[data-catalog-id="${id}"]`);
      const box = owner?.querySelector(indicatorSelector);
      const dom = box
        ? {
            emphasized: owner.hasAttribute("data-emphasized"),
            color:
              indicatorType === "SwitchIndicator"
                ? getComputedStyle(box).borderColor
                : getComputedStyle(box).backgroundColor,
          }
        : null;
      const root = window.__COMPOSITION_CATALOG__.workspace.root;
      const node = root.canvasInputs.get(id);
      const indicator = [...root.canvasInputs.values()].find(
        (r) =>
          root.typeOf(r) === indicatorType &&
          JSON.stringify(node.children).includes(r.id.split(":").at(-1)),
      ) ?? [...root.canvasInputs.values()].find(
        (r) => root.typeOf(r) === indicatorType,
      );
      const painted = window.__composition_SKIA_DEBUG__?.getSkiaNode?.(
        indicator?.id,
      );
      return {
        dom,
        variant: node.props.variant,
        isEmphasized: node.props.isEmphasized,
        fill: painted?.box?.fillColor ? [...painted.box.fillColor] : null,
      };
    },
    { id, indicatorSelector, indicatorType },
  );

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("S2 emphasis");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
const compare = page
  .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
  .first();
if (await compare.isVisible().catch(() => false)) await compare.click();
await page.waitForTimeout(1500);

// ── Checkbox ──
await addFromPalette("checkbox");
const cb = await select("Checkbox");
const hasEmphasized = await openDesign("Emphasized");
record("Design offers Emphasized on a Checkbox", hasEmphasized, { cb });
await setSelected(cb.source);
const cbBefore = await toggleState(cb.id, ".checkbox", "CheckboxIndicator");
record(
  "selected default Checkbox: neutral indicator, variant default",
  cbBefore.dom &&
    !cbBefore.dom.emphasized &&
    cbBefore.variant === "default" &&
    cbBefore.isEmphasized !== true,
  cbBefore,
);
await toggleBool("Emphasized");
const cbAfter = await toggleState(cb.id, ".checkbox", "CheckboxIndicator");
await page.screenshot({ path: `${OUT}/checkbox-emphasized.png` });
record(
  "Emphasized Checkbox: data-emphasized + a different indicator color + the derived emphasized variant in both consumers",
  cbAfter.dom &&
    cbAfter.dom.emphasized &&
    cbAfter.dom.color !== cbBefore.dom.color &&
    cbAfter.variant === "emphasized" &&
    JSON.stringify(cbAfter.fill) !== JSON.stringify(cbBefore.fill),
  { before: cbBefore, after: cbAfter },
);

// ── Switch ──
await addFromPalette("switch");
const sw = await select("Switch");
await openDesign("Emphasized");
await setSelected(sw.source);
const swBefore = await toggleState(sw.id, ".indicator", "SwitchIndicator");
await toggleBool("Emphasized");
const swAfter = await toggleState(sw.id, ".indicator", "SwitchIndicator");
await page.screenshot({ path: `${OUT}/switch-emphasized.png` });
record(
  "Emphasized Switch: data-emphasized + a different track color + the derived emphasized variant",
  swAfter.dom &&
    swAfter.dom.emphasized &&
    !swBefore.dom.emphasized &&
    swAfter.dom.color !== swBefore.dom.color &&
    swAfter.variant === "emphasized",
  { before: swBefore, after: swAfter },
);

// ── 로드 시 1회 전환: 옛 문서의 variant 가 reload 에서 isEmphasized 로 ──
const legacy = await page.evaluate(
  async ({ commands }) => {
    const c = await import(commands);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const node = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "Checkbox",
    );
    ws.execute(
      c.setFields({
        targets: [{ kind: "node", id: node.sourceId }],
        props: {
          variant: { kind: "set", value: "emphasized" },
          isEmphasized: { kind: "remove" },
        },
      }),
    );
    await new Promise((r) => setTimeout(r, 1200));
    const entry = root.runtime.graph.getEntry(node.sourceId);
    return { source: node.sourceId, props: entry.props };
  },
  { commands },
);
record(
  "an old-form document authored (variant: emphasized, no isEmphasized)",
  legacy.props.variant?.value === "emphasized" && !legacy.props.isEmphasized,
  legacy,
);
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(2000);
const migrated = await page.evaluate((source) => {
  const root = window.__COMPOSITION_CATALOG__.workspace.root;
  const entry = root.runtime.graph.getEntry(source);
  const node = [...root.canvasInputs.values()].find(
    (r) => r.sourceId === source,
  );
  return { props: entry.props, variant: node?.props.variant };
}, legacy.source);
record(
  "reload converts it once: isEmphasized true, the variant write gone, the derived variant emphasized",
  migrated.props.isEmphasized?.value === true &&
    migrated.props.variant === undefined &&
    migrated.variant === "emphasized",
  migrated,
);

record("no page or console errors", errors.length === 0, { errors });
process.stdout.write(
  `\nRESULT ${results.filter((r) => r.pass).length}/${results.length} PASS\n`,
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
