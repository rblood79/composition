// Live: a node made and removed between two Preview flushes (redo + undo in one frame) reaches the
// Preview as one delta naming an id it never held. The Preview applies it — no refused delta, no
// snapshot round trip, no console error — and still matches the editor. The real Builder (Compare
// Mode), headed Chrome, saved auth session.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/preview-delta-made-removed-live.mjs <out-dir>
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
const errors = [];
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1500)}\n`,
  );
};
const page = await context.newPage();
page.on("pageerror", (e) =>
  errors.push(`pageerror: ${e.message.slice(0, 300)}`),
);
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning")
    errors.push(`console.${m.type()}: ${m.text().slice(0, 300)}`);
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
/** The editor's and the Preview's texts on the page (Preview: the iframe document). */
const texts = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const g = ws.runtime.graph;
    const editor = [...ws.root.canvasInputs.values()]
      .filter(
        (r) =>
          r.sourceId.startsWith("project:node:") &&
          g.getDefinition(r.definitionId)?.name === "Text",
      )
      .map((r) => r.props.children);
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const preview = [...(doc?.querySelectorAll(".react-aria-Text") ?? [])].map(
      (el) => el.textContent,
    );
    return { editor, preview, revision: g.revision };
  });

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("Preview delta live");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
await page
  .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
  .first()
  .click();
await page.waitForTimeout(2500);

try {
  await addFromPalette("text");
  await page.waitForTimeout(800);
  const placed = await texts();
  // Undo the insert (flushed: the Preview drops the Text), then make and remove it again in one
  // frame — the Preview never holds that id.
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.undo());
  await page.waitForTimeout(800);
  const undone = await texts();
  errors.length = 0;
  await page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    ws.redo();
    ws.undo();
  });
  await page.waitForTimeout(1500);
  const after = await texts();
  writeFileSync(`${OUT}/after.png`, await page.screenshot());
  record(
    "made-and-removed",
    placed.preview.length === 1 &&
      undone.preview.length === 0 &&
      after.editor.length === 0 &&
      after.preview.length === 0 &&
      errors.length === 0,
    { placed, undone, after, errors },
  );
  // The Preview still follows edits after it.
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.redo());
  await page.waitForTimeout(1200);
  const redone = await texts();
  record(
    "follows-after",
    redone.editor.length === 1 &&
      JSON.stringify(redone.preview) === JSON.stringify(redone.editor),
    redone,
  );
} catch (error) {
  record("run", false, { threw: String(error?.message ?? error).slice(0, 800) });
  writeFileSync(`${OUT}/error.png`, await page.screenshot());
}

writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
process.stdout.write(`errors: ${errors.length}\n${errors.join("\n")}\n`);
await browser.close();
