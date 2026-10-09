// S2 Skeleton isLoading · DropZone isFilled/replaceMessage live (사용자 2026-10-10 「개별 10건
// 착수」): real Builder (headed Chrome, Compare Mode). A Skeleton from the palette shows its
// placeholder; Loading off removes it from the Preview and the Canvas. A DropZone with Filled +
// a Replace Message keeps a hidden banner that shows while a drag is over the zone; no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-skeleton-dropzone-live.mjs <out>
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
const field = (label) =>
  page
    .locator(".panel-wrapper[data-panel='properties'] fieldset", {
      has: page.locator("legend", { hasText: new RegExp(`^${label}$`) }),
    })
    .first();
const panelText = (label) =>
  page
    .locator(".panel-wrapper[data-panel='properties']")
    .getByText(label, { exact: true })
    .first();
const toggleBool = async (label) => {
  await panelText(label).click();
  await page.waitForTimeout(1500);
};
const type = async (label, text) => {
  const box = field(label).locator("input").first();
  await box.fill(text);
  await box.press("Enter");
  await page.waitForTimeout(1500);
};
const openDesign = async (label) => {
  for (let i = 0; i < 3; i++) {
    if (await field(label).isVisible().catch(() => false)) return true;
    if (await panelText(label).isVisible().catch(() => false)) return true;
    await page
      .getByRole("button", { name: "Design", exact: true })
      .first()
      .click();
    await page.waitForTimeout(1200);
  }
  return (
    (await field(label).isVisible().catch(() => false)) ||
    (await panelText(label).isVisible().catch(() => false))
  );
};
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

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("Skeleton DropZone");
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

// ── Skeleton isLoading ──
await addFromPalette("skeleton");
const skeleton = await select("Skeleton");
const hasLoading = await openDesign("Loading");
record("Design offers Loading on a Skeleton", hasLoading, { skeleton });
const skeletonState = (id) =>
  page.evaluate((id) => {
    const doc = document.querySelector("#previewFrame").contentDocument;
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    return {
      dom: !!doc.querySelector(`[data-catalog-id="${id}"]`),
      hidden: root.canvasInputs.get(id)?.hidden === true,
    };
  }, id);
const loading = await skeletonState(skeleton.id);
record(
  "default: the placeholder is there in both consumers",
  loading.dom === true && loading.hidden === false,
  loading,
);
await toggleBool("Loading");
const idle = await skeletonState(skeleton.id);
await page.screenshot({ path: `${OUT}/skeleton-idle.png` });
record(
  "Loading off: the placeholder is gone in both consumers",
  idle.dom === false && idle.hidden === true,
  idle,
);

// ── DropZone isFilled · replaceMessage ──
await addFromPalette("drop zone");
const zone = await select("DropZone");
const hasFilled = await openDesign("Filled");
record("Design offers Filled on a DropZone", hasFilled, { zone });
await toggleBool("Filled");
await type("Replace Message", "Drop to swap");
const banner = (id) =>
  page.evaluate((id) => {
    const doc = document.querySelector("#previewFrame").contentDocument;
    const zone = doc.querySelector(`[data-catalog-id="${id}"]`);
    const replace = zone?.querySelector(".dropzone-replace");
    return {
      text: replace?.textContent ?? null,
      display: replace
        ? doc.defaultView.getComputedStyle(replace).display
        : null,
      dropTarget: zone?.hasAttribute("data-drop-target") ?? null,
    };
  }, id);
const rest = await banner(zone.id);
record(
  "Filled + message: the banner is in the DOM, hidden at rest",
  rest.text === "Drop to swap" && rest.display === "none",
  rest,
);
await page.evaluate((id) => {
  const doc = document.querySelector("#previewFrame").contentDocument;
  const zone = doc.querySelector(`[data-catalog-id="${id}"]`);
  const data = new doc.defaultView.DataTransfer();
  data.items.add(new doc.defaultView.File(["x"], "x.txt"));
  for (const kind of ["dragenter", "dragover"])
    zone.dispatchEvent(
      new doc.defaultView.DragEvent(kind, {
        bubbles: true,
        cancelable: true,
        dataTransfer: data,
      }),
    );
}, zone.id);
await page.waitForTimeout(600);
const over = await banner(zone.id);
await page.screenshot({ path: `${OUT}/dropzone-replace.png` });
record(
  "drag over the filled zone: the replace banner shows",
  over.dropTarget === true && over.display === "flex" && over.text === "Drop to swap",
  over,
);

record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
