// S2 정렬 F live (사용자 2026-10-12 「S2 · RAC · v3 어디에도 없으면 지워」): real Builder (headed
// Chrome, Compare Mode). A Separator · Section · Toolbar · ProgressBar from the palette: the Design
// panel offers no Variant (a Button still does), the Preview and the Canvas paint the default each
// had. An old document whose stored entries still carry a variant on them (written straight into
// IndexedDB — the editor refuses one now) opens on reload with the variant dropped once, and the
// Preview paints the same default.
//
//   BUILDER_URL=http://localhost:5175 node apps/builder/scripts/s2-variant-removal-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

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
const panel = () => page.locator(".panel-wrapper[data-panel='properties']");
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
const designShows = async (label) => {
  for (let i = 0; i < 3; i++) {
    if (
      await panel()
        .getByText("Size", { exact: true })
        .first()
        .isVisible()
        .catch(() => false)
    )
      break;
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
// Preview computed paint + the Canvas paint of the same node.
const paint = (id, selector) =>
  page.evaluate(
    ({ id, selector }) => {
      const doc = document.querySelector("#previewFrame").contentDocument;
      const host = doc.querySelector(`[data-catalog-id="${id}"]`);
      const el = selector ? host?.querySelector(selector) : host;
      const cs = el ? getComputedStyle(el) : null;
      const node = window.__composition_SKIA_DEBUG__?.getSkiaNode?.(id);
      const fill = node?.box?.fillColor ? [...node.box.fillColor] : null;
      return {
        attr: el?.getAttribute("data-variant") ?? null,
        bg: cs?.backgroundColor ?? null,
        fill: fill?.map((v) => Math.round(v * 255)),
      };
    },
    { id, selector },
  );

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("S2 variant removal");
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

const nodes = {};
for (const [label, type] of [
  ["separator", "Separator"],
  ["section", "Section"],
  ["toolbar", "Toolbar"],
  ["progress bar", "ProgressBar"],
  ["button", "Button"],
]) {
  await addFromPalette(label);
  nodes[type] = await select(type);
  const shows = await designShows("Variant");
  record(
    type === "Button"
      ? "Button still offers Variant (S2 has it)"
      : `${type}: Design offers no Variant`,
    type === "Button" ? shows : !shows,
    { type, shows },
  );
}
await page.screenshot({ path: `${OUT}/palette-defaults.png` });

const section = await paint(nodes.Section.id);
record(
  "Section paints transparent on both (Preview bg · Canvas fill alpha 0 or none)",
  section.bg === "rgba(0, 0, 0, 0)" && (!section.fill || section.fill[3] === 0),
  section,
);
const fillId = await page.evaluate((owner) => {
  const root = window.__COMPOSITION_CATALOG__.workspace.root;
  return [...root.canvasInputs.values()].find(
    (r) => root.typeOf(r) === "ProgressBarFill" && r.id.includes(owner.split(":").at(-1)),
  )?.id;
}, nodes.ProgressBar.id);
const barBefore = await paint(nodes.ProgressBar.id, ".fill");
const fillBefore = await paint(fillId);
record(
  "ProgressBar fill: the accent (Preview) and a painted Canvas fill",
  barBefore.bg !== "rgba(0, 0, 0, 0)" && !!fillBefore.fill,
  { barBefore, fillBefore },
);

// ── An old document: write variants straight into the stored entries, then reload ──
const projectId = await page.evaluate(
  () => window.__COMPOSITION_CATALOG__.workspace.runtime.graph.projectId,
);
await page.waitForTimeout(2500); // autosave
const written = await page.evaluate(
  async ({ projectId, targets }) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("composition-catalog-projects-v1", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction(["entries"], "readwrite");
    const store = tx.objectStore("entries");
    const done = [];
    for (const [id, value] of targets) {
      const row = await new Promise((resolve) => {
        const request = store.get([projectId, id]);
        request.onsuccess = () => resolve(request.result);
      });
      if (!row) continue;
      const entry = JSON.parse(row.json);
      entry.props.variant = { kind: "set", value };
      row.json = JSON.stringify(entry);
      store.put(row);
      done.push([id, value]);
    }
    await new Promise((resolve) => (tx.oncomplete = resolve));
    db.close();
    return done;
  },
  {
    projectId,
    targets: [
      [nodes.Separator.source, "dashed"],
      [nodes.Section.source, "purple"],
      [nodes.Toolbar.source, "accent"],
      [nodes.ProgressBar.source, "neutral"],
    ],
  },
);
record("old variants written into the stored entries", written.length === 4, written);
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(2500);
const loaded = await page.evaluate((sources) => {
  const graph = window.__COMPOSITION_CATALOG__.workspace.runtime.graph;
  return sources.map((source) => ({
    source,
    variant: graph.getEntry(source)?.props.variant ?? null,
    present: !!graph.getEntry(source),
  }));
}, Object.values(nodes).map((node) => node.source));
record(
  "reload opens the document; every variant dropped once",
  loaded.every((row) => row.present && row.variant === null),
  loaded,
);
if (await compare.isVisible().catch(() => false)) await compare.click();
await page.waitForSelector("#previewFrame", { timeout: 30000 });
await page.waitForTimeout(2500);
const sectionAfter = await paint(nodes.Section.id);
const barAfter = await paint(nodes.ProgressBar.id, ".fill");
await page.screenshot({ path: `${OUT}/after-reload.png` });
record(
  "after reload the defaults paint as before (Section transparent, ProgressBar accent fill)",
  sectionAfter.bg === section.bg && barAfter.bg === barBefore.bg,
  { sectionAfter, barAfter },
);

record("no page or console errors", errors.length === 0, { errors });
process.stdout.write(
  `\nRESULT ${results.filter((r) => r.pass).length}/${results.length} PASS\n`,
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
