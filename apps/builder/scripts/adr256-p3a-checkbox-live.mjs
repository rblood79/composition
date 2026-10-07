// ADR-256 Phase 3a live: a Checkbox is RAC `CheckboxField > CheckboxButton (indicator + text) +
// Description + FieldError`. A Checkbox and a CheckboxGroup are placed: the Preview draws the
// reference structure (div field · label button · indicator · text), clicking the Preview Checkbox
// toggles it (RAC state), a description and an error show on both sides, the Layers tree shows the
// CheckboxButton, and the Canvas row matches the Preview row. Real Builder, headed Chrome.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p3a-checkbox-live.mjs <out>
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
}
const frameDoc = () => page.frameLocator("#previewFrame");

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("ADR-256 P3a checkbox");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
await addFromPalette("checkbox");
await addFromPalette("checkbox group");
await page.waitForTimeout(800);
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const ids = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const of = (type) =>
    [...ws.root.canvasInputs.values()].find((r) => ws.root.typeOf(r) === type)
      .sourceId;
  return { checkbox: of("Checkbox"), group: of("CheckboxGroup") };
});
await page
  .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
  .first()
  .click();
await page.waitForTimeout(3000);
const preview = (id) =>
  page.evaluate((id) => {
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const root = [...(doc?.querySelectorAll("[data-catalog-id]") ?? [])].find(
      (e) =>
        e.getAttribute("data-catalog-id").endsWith(`::${id}`) &&
        e.classList.contains("react-aria-Checkbox"),
    );
    if (!root) return null;
    const button = root.querySelector(
      ":scope > label.react-aria-CheckboxButton",
    );
    const rect = (e) => {
      const r = e?.getBoundingClientRect();
      return r
        ? [
            Math.round(r.x),
            Math.round(r.y),
            Math.round(r.width),
            Math.round(r.height),
          ]
        : null;
    };
    return {
      tag: root.tagName.toLowerCase(),
      button: !!button,
      indicator: !!button?.querySelector(":scope > div.checkbox > svg"),
      text:
        button?.querySelector(":scope > span.react-aria-Label")?.textContent ??
        null,
      checked: button?.querySelector("input")?.checked ?? null,
      selected: root.getAttribute("data-selected"),
      hint: root.querySelector('[slot="description"]')?.textContent ?? null,
      error: root.querySelector(".react-aria-FieldError")?.textContent ?? null,
      rects: {
        root: rect(root),
        indicator: rect(button?.querySelector("div.checkbox")),
        text: rect(button?.querySelector("span.react-aria-Label")),
      },
    };
  }, id);
const p1 = await preview(ids.checkbox);
record(
  "P3a-1 Preview: div field > label button > (indicator svg, text)",
  !!p1 &&
    p1.tag === "div" &&
    p1.button &&
    p1.indicator &&
    p1.text === "Checkbox",
  p1,
);
// The Canvas row: indicator · text positions relative to the Checkbox, as the Preview's.
const canvas = (id) =>
  page.evaluate((id) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const top = [...root.canvasInputs.values()].find((r) => r.sourceId === id);
    const all = [];
    const visit = (r, d) => {
      for (const c of r.children) {
        const child = root.canvasInputs.get(c);
        if (!child) continue;
        all.push({
          id: child.id,
          type: root.typeOf(child),
          depth: d,
          hidden: !!child.hidden,
        });
        visit(child, d + 1);
      }
    };
    visit(top, 1);
    const geo = root.getGeometry([top.id, ...all.map((n) => n.id)]);
    const abs = (rid) => {
      let x = 0,
        y = 0,
        cur = root.canvasInputs.get(rid);
      while (cur && cur.id !== top.id) {
        const g = geo.get(cur.id) ?? root.getGeometry([cur.id]).get(cur.id);
        x += g.x;
        y += g.y;
        cur = root.canvasInputs.get(cur.parentId);
      }
      return [Math.round(x), Math.round(y)];
    };
    return {
      tree: all.map(
        (n) => `${"  ".repeat(n.depth)}${n.type}${n.hidden ? " (hidden)" : ""}`,
      ),
      indicator: abs(all.find((n) => n.type === "CheckboxIndicator").id),
      text: abs(all.find((n) => n.type === "Label").id),
    };
  }, id);
const c1 = await canvas(ids.checkbox);
const rel = (p, k) => [
  p.rects[k][0] - p.rects.root[0],
  p.rects[k][1] - p.rects.root[1],
];
record(
  "P3a-2 Canvas: Checkbox > CheckboxButton > [indicator, Label]; row positions = Preview (±1px)",
  c1.tree
    .join("|")
    .includes("  CheckboxButton|    CheckboxIndicator|    Label") &&
    ["indicator", "text"].every((k) =>
      c1[k].every((v, i) => Math.abs(v - rel(p1, k)[i]) <= 1),
    ),
  {
    canvas: c1,
    preview: { indicator: rel(p1, "indicator"), text: rel(p1, "text") },
  },
);
// Click the Preview Checkbox: RAC toggles it.
// (Keyboard: focus the checkbox and press Space — the app header covers the Preview's top-left
// corner, so a pointer click there lands on the header.)
await frameDoc()
  .locator(
    `div.react-aria-Checkbox[data-catalog-id$="::${ids.checkbox}"] input`,
  )
  .press("Space");
await page.waitForTimeout(500);
const p2 = await preview(ids.checkbox);
record(
  "P3a-3 Preview: Space on the focused checkbox toggles it (RAC state)",
  p1.checked === true && p2?.checked === false && p2.selected === null,
  { before: p1.checked, after: p2?.checked, selected: p2?.selected },
);
// Description and an error on both sides.
await page.evaluate(
  async ({ commands, id }) => {
    const { setFields } = await import(commands);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    ws.execute(
      setFields({
        targets: [{ kind: "node", id }],
        props: {
          description: { kind: "set", value: "Get the newsletter" },
          isInvalid: { kind: "set", value: true },
          errorMessage: { kind: "set", value: "Required" },
        },
      }),
    );
  },
  { commands, id: ids.checkbox },
);
await page.waitForTimeout(1500);
const p3 = await preview(ids.checkbox);
const c3 = await canvas(ids.checkbox);
record(
  "P3a-4 description · error show in the Preview and on the Canvas",
  p3?.hint === "Get the newsletter" &&
    p3?.error === "Required" &&
    c3.tree.some((t) => t.trim() === "Description") &&
    c3.tree.some((t) => t.trim() === "FieldError"),
  { preview: { hint: p3?.hint, error: p3?.error }, canvas: c3.tree },
);
const group = await page.evaluate((id) => {
  const doc = document.querySelector("#previewFrame").contentDocument;
  const root = [...doc.querySelectorAll("[data-catalog-id]")].find(
    (e) =>
      e.getAttribute("data-catalog-id").endsWith(`::${id}`) &&
      e.classList.contains("react-aria-CheckboxGroup"),
  );
  const labelId = root.getAttribute("aria-labelledby");
  return {
    items: root.querySelectorAll(
      "div.react-aria-Checkbox > label.react-aria-CheckboxButton",
    ).length,
    labelText: doc.getElementById(labelId)?.textContent,
    sameId: doc.querySelectorAll(`[id="${labelId}"]`).length,
  };
}, ids.group);
record(
  "P3a-5 CheckboxGroup: items are CheckboxField > CheckboxButton; the group label is the only one with its id",
  group.items === 2 &&
    group.sameId === 1 &&
    /Checkbox Group/.test(group.labelText ?? ""),
  group,
);
// Layers tree shows the button row.
await page
  .getByRole("button", { name: "Layers", exact: true })
  .first()
  .click()
  .catch(() => {});
await page.waitForTimeout(500);
await page.mouse.click(265, 77);
await page.waitForTimeout(300);
await page.keyboard.down("Control");
for (let i = 0; i < 10; i += 1) {
  await page.mouse.move(846, 312);
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(80);
}
await page.keyboard.up("Control");
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/checkbox-compare.png` });
record("P3a-6 no page errors", errors.length === 0, { errors });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
