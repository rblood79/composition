// S2 Slider · TagGroup labelAlign live (2026-10-10, 조사 문서 6.1 다): real Builder (headed Chrome,
// Compare Mode). For each: Label Position Side from the Design panel → the side label is the fields'
// column (176 on both sides) and a Label Align field offers Start · End; End → the Preview owner
// carries data-label-align="end", the label text sits at the column's end (text right edge = label
// box right edge), and the Canvas label record paints text-align end; no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/slider-tag-label-align-live.mjs <out>
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
const field = (label) =>
  page
    .locator(".panel-wrapper[data-panel='properties'] fieldset", {
      has: page.locator("legend", { hasText: new RegExp(`^${label}$`) }),
    })
    .first();
const pick = async (label, option) => {
  const box = field(label);
  const radio = box.getByRole("radio", { name: option, exact: true });
  if (await radio.count()) await radio.first().click();
  else {
    await box.locator("button").first().click();
    await page.waitForTimeout(400);
    await page.getByRole("option", { name: option, exact: true }).click();
  }
  await page.waitForTimeout(1500);
};
const selectType = (type) =>
  page.evaluate((type) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const node = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === type,
    );
    ws.selectRecords([node.id]);
  }, type);
const read = (type) =>
  page.evaluate((type) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const node = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === type,
    );
    const label = node.children
      .map((id) => root.canvasInputs.get(id))
      .find((r) => root.typeOf(r) === "Label");
    const doc = document.querySelector("#previewFrame").contentDocument;
    const el = doc.querySelector(`.react-aria-${type}`);
    const labelEl = el?.querySelector(":scope > .react-aria-Label");
    let textRight = null;
    if (labelEl?.firstChild) {
      const range = doc.createRange();
      range.selectNodeContents(labelEl);
      textRight = range.getBoundingClientRect().right;
    }
    return {
      labelAlign: node.props.labelAlign ?? null,
      dataLabelAlign: el?.getAttribute("data-label-align") ?? null,
      previewTextAlign: labelEl
        ? doc.defaultView.getComputedStyle(labelEl).textAlign
        : null,
      previewLabelRight: labelEl?.getBoundingClientRect().right ?? null,
      previewTextRight: textRight,
      previewLabelWidth: labelEl?.getBoundingClientRect().width ?? null,
      canvasTextAlign: label?.visual.textAlign ?? null,
      canvasLabelWidth: label
        ? root.getGeometry([label.id]).get(label.id)?.width
        : null,
    };
  }, type);

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("Slider TagGroup label align");
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

for (const [type, paletteLabel, expected] of [
  ["Slider", "slider", ["start", "end"]],
  ["TagGroup", "tag group", ["start", "end"]],
]) {
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectRecords([]),
  );
  await addFromPalette(paletteLabel);
  await page.waitForTimeout(1500);
  await selectType(type);
  await page.waitForTimeout(1000);
  for (let i = 0; i < 3; i++) {
    if (await field("Label Position").isVisible().catch(() => false)) break;
    await page
      .getByRole("button", { name: "Design", exact: true })
      .first()
      .click();
    await page.waitForTimeout(1200);
  }
  const hiddenBefore = (await field("Label Align").count()) === 0;
  await pick("Label Position", "Side");
  const options = (
    await field("Label Align").locator("[role='radio']").allInnerTexts()
  )
    .map((t) => t.trim())
    .filter(Boolean);
  const optionNames = await field("Label Align")
    .locator("[role='radio']")
    .evaluateAll((els) =>
      els.map((e) => e.getAttribute("aria-label") || e.textContent.trim()),
    );
  record(
    `${type}: Label Align appears with a side label, offering ${expected.join(" · ")}`,
    hiddenBefore &&
      JSON.stringify(optionNames.map((n) => n.toLowerCase())) ===
        JSON.stringify(expected),
    { hiddenBefore, options, optionNames },
  );
  const start = await read(type);
  await pick("Label Align", "End");
  const end = await read(type);
  record(
    `${type}: End → Preview data-label-align end · label text at the column end · Canvas text-align end (start before) · column 176 on both`,
    Math.round(start.previewLabelWidth) === 176 &&
      Math.round(start.canvasLabelWidth) === 176 &&
      start.previewTextAlign === "start" &&
      start.canvasTextAlign === "start" &&
      end.labelAlign === "end" &&
      end.dataLabelAlign === "end" &&
      end.previewTextAlign === "end" &&
      Math.abs(end.previewTextRight - end.previewLabelRight) <= 1 &&
      end.canvasTextAlign === "end" &&
      Math.round(end.canvasLabelWidth) === Math.round(end.previewLabelWidth),
    { start, end },
  );
  await page.screenshot({ path: `${OUT}/${type}-end.png` });
}

record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
