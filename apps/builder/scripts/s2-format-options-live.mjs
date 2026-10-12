// S2 · RAC formatOptions live (사용자 2026-10-12 「S2 · RAC 가 객체면 객체 값 타입을 새로 만들어」):
// real Builder (headed Chrome, Compare Mode). A Meter from the palette: the Design panel's Format
// editor writes one `numberFormat` object (Currency → USD, a currency code edit, Max Fraction
// Digits), and the Preview's RAC value text and the Canvas text read the same value. A NumberField
// (percent) and a Slider (unit) likewise; Default clears the object.
//
//   BUILDER_URL=http://localhost:5175 node apps/builder/scripts/s2-format-options-live.mjs <out>
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
  locale: "en-US",
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
const panel = () => page.locator(".panel-wrapper[data-panel='properties']");
const openDesign = async (label) => {
  for (let i = 0; i < 3; i++) {
    if (
      await panel()
        .getByText(label, { exact: true })
        .first()
        .isVisible()
        .catch(() => false)
    )
      return true;
    await page
      .getByRole("button", { name: "Design", exact: true })
      .first()
      .click();
    await page.waitForTimeout(1200);
  }
  return panel()
    .getByText(label, { exact: true })
    .first()
    .isVisible()
    .catch(() => false);
};
const formatEditor = () => panel().locator("[data-number-format]").first();
async function pickOption(groupName, optionName) {
  const group = formatEditor().getByRole("group", { name: groupName }).first();
  await group.getByRole("button").first().click();
  await page.waitForTimeout(300);
  await page.getByRole("option", { name: optionName, exact: true }).first().click();
  await page.waitForTimeout(1500);
}
async function typeInto(groupName, text) {
  const input = formatEditor()
    .getByRole("group", { name: groupName })
    .first()
    .locator("input")
    .first();
  await input.fill(text);
  await input.press("Enter");
  await page.waitForTimeout(1500);
}
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
const writeFormat = (source, value) =>
  page.evaluate(
    async ({ commands, source, value }) => {
      const c = await import(commands);
      window.__COMPOSITION_CATALOG__.workspace.execute(
        c.setFields({
          targets: [{ kind: "node", id: source }],
          props: {
            formatOptions:
              value === null ? { kind: "remove" } : { kind: "set", value },
          },
        }),
      );
      await new Promise((r) => setTimeout(r, 1500));
    },
    { commands, source, value },
  );
// The document value, the Preview's text (RAC) and the Canvas's (record + painted Skia text).
const read = (ownerId, partType, previewSelector) =>
  page.evaluate(
    ({ ownerId, partType, previewSelector }) => {
      const root = window.__COMPOSITION_CATALOG__.workspace.root;
      const owner = root.canvasInputs.get(ownerId);
      const entry = root.runtime.graph.getEntry(owner.sourceId);
      const doc = document.querySelector("#previewFrame").contentDocument;
      const host = doc.querySelector(`[data-catalog-id="${ownerId}"]`);
      const target = host?.querySelector(previewSelector);
      const preview =
        target?.tagName === "INPUT" ? target.value : target?.textContent;
      const ownerKey = ownerId.split(":").at(-1);
      const part = [...root.canvasInputs.values()].find(
        (r) => root.typeOf(r) === partType && r.id.includes(ownerKey),
      ) ?? [...root.canvasInputs.values()].filter(
        (r) => root.typeOf(r) === partType,
      ).at(-1);
      const recordText =
        part?.derivedProps?.children ??
        part?.derivedProps?.placeholder ??
        part?.props.children;
      const find = (n) => {
        if (!n) return null;
        if (n.text) return n.text;
        for (const c of n.children ?? []) {
          const f = find(c);
          if (f) return f;
        }
        return null;
      };
      const painted = find(
        window.__composition_SKIA_DEBUG__?.getSkiaNode?.(part?.id),
      );
      return {
        format: entry.props.formatOptions?.value ?? null,
        preview: preview ?? null,
        canvas: recordText ?? null,
        painted:
          typeof painted === "string"
            ? painted
            : (painted?.content ?? painted?.text ?? null),
      };
    },
    { ownerId, partType, previewSelector },
  );
const same = (r, expected) =>
  r.preview === expected &&
  r.canvas === expected &&
  (r.painted === null || r.painted === expected);

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("S2 format");
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

// ── Meter: the Design panel's Format editor ──
await addFromPalette("meter");
const meter = await select("Meter");
record("Design offers Format on a Meter", await openDesign("Format"), meter);
const m0 = await read(meter.id, "MeterValue", ".value");
record("unset: RAC's percent on both consumers", m0.format === null && same(m0, "75%"), m0);
await pickOption("Format", "Currency");
const m1 = await read(meter.id, "MeterValue", ".value");
record(
  "Format → Currency writes {style: currency, currency: USD}; both draw $75.00",
  m1.format?.style === "currency" && m1.format?.currency === "USD" && same(m1, "$75.00"),
  m1,
);
await typeInto("Currency", "eur");
const m2 = await read(meter.id, "MeterValue", ".value");
record("currency code eur → EUR; both draw €75.00", m2.format?.currency === "EUR" && same(m2, "€75.00"), m2);
await typeInto("Currency", "EURO");
const m3 = await read(meter.id, "MeterValue", ".value");
const alert = await formatEditor()
  .locator("[data-number-format-invalid]")
  .isVisible()
  .catch(() => false);
record("an invalid code is not written (alert, value kept)", alert && m3.format?.currency === "EUR", { ...m3, alert });
await typeInto("Max Fraction Digits", "0");
const m4 = await read(meter.id, "MeterValue", ".value");
await page.screenshot({ path: `${OUT}/meter-currency.png` });
record("Max Fraction Digits 0; both draw €75", m4.format?.maximumFractionDigits === 0 && same(m4, "€75"), m4);
await pickOption("Format", "Default");
const m5 = await read(meter.id, "MeterValue", ".value");
record("Default clears the object; both back to 75%", m5.format === null && same(m5, "75%"), m5);

// ── NumberField: percent ──
await addFromPalette("number field");
const nf = await select("NumberField");
await page.evaluate(
  async ({ commands, source }) => {
    const c = await import(commands);
    window.__COMPOSITION_CATALOG__.workspace.execute(
      c.setFields({
        targets: [{ kind: "node", id: source }],
        // (The origin's step 1 · max 100 would snap 0.25 to 0 — RAC's own rule; a percent field
        // takes a fraction step.)
        props: {
          value: { kind: "set", value: "0.25" },
          step: { kind: "set", value: 0.01 },
          maxValue: { kind: "set", value: 1 },
        },
      }),
    );
  },
  { commands, source: nf.source },
);
await writeFormat(nf.source, { style: "percent" });
const n1 = await read(nf.id, "Input", "input");
await page.screenshot({ path: `${OUT}/numberfield-percent.png` });
record("NumberField percent: both show 25%", n1.preview === "25%" && n1.canvas === "25%", n1);

// ── Slider: unit ──
await addFromPalette("slider");
const sl = await select("Slider");
await writeFormat(sl.source, { style: "unit", unit: "kilometer" });
const s1 = await read(sl.id, "SliderOutput", "output");
await page.screenshot({ path: `${OUT}/slider-unit.png` });
record(
  "Slider unit kilometer: both draw the same km text",
  typeof s1.preview === "string" && s1.preview.endsWith("km") && same(s1, s1.preview),
  s1,
);

// ── Reload keeps the object ──
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(2500);
const kept = await page.evaluate((source) => {
  const root = window.__COMPOSITION_CATALOG__.workspace.root;
  return root.runtime.graph.getEntry(source).props.formatOptions?.value ?? null;
}, sl.source);
record("reload keeps the Slider's object", kept?.style === "unit" && kept?.unit === "kilometer", kept);

record("no page or console errors", errors.length === 0, { errors });
process.stdout.write(
  `\nRESULT ${results.filter((r) => r.pass).length}/${results.length} PASS\n`,
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
