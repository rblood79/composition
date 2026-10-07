// ADR-256 Phase 1 review live: (h1) a Preview Button keeps its own font size when a hover value is
// written (the RAC slot scope merges the state variables over the element's style); (h2) the Delete
// key on a detached Slider's only thumb — below its track, not right under the Slider — is refused.
// Real Builder, headed Chrome, saved auth session.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p1-review-live.mjs <out>
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
await page.getByRole("button", { name: /new project/i }).first().click();
await page.waitForTimeout(300);
await page.keyboard.type("ADR-256 P1 review");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
await addFromPalette("button");
await addFromPalette("slider");
await page.waitForTimeout(2500);

const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const actions = `/@fs${REPO}/apps/builder/src/builder/catalogRuntime/componentActions.ts`;
// h2: a detached Slider's only thumb (inside the track) is kept by the Delete key.
await page.evaluate(async (actions) => {
  const { catalogComponentCommands } = await import(actions);
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const rec = [...ws.root.canvasInputs.values()].find(
    (r) => ws.root.typeOf(r) === "Slider",
  );
  ws.execute(catalogComponentCommands.detach(rec.sourceId, ws.newId));
}, actions);
await page.waitForTimeout(1200);
const thumb = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const r = [...ws.root.canvasInputs.values()].find(
    (rec) => ws.root.typeOf(rec) === "SliderThumb" && !rec.hidden,
  );
  return r?.id ?? null;
});
await page.evaluate(
  (id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]),
  thumb,
);
await page.waitForTimeout(400);
await page.evaluate(() =>
  document.querySelector('[data-canvas-container="true"]')?.focus(),
);
await page.keyboard.press("Delete");
await page.waitForTimeout(1000);
const kept = await page.evaluate((id) => {
  const r = window.__COMPOSITION_CATALOG__.workspace.root.canvasInputs.get(id);
  return !!r && r.hidden !== true;
}, thumb);
const notice = await page
  .locator(".toast .toast-message")
  .last()
  .textContent({ timeout: 2000 })
  .catch(() => "");
record(
  "R-h2 Delete on a detached Slider's thumb (inside its track) is refused",
  !!thumb && kept && /needs this part|필요한 부품/.test(notice),
  { thumb, kept, notice: notice.slice(0, 160) },
);
await page
  .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
  .first()
  .click();
await page.waitForTimeout(2500);
// h1: a Button with its own font size, under an origin hover value — the Preview keeps both.
const written = await page.evaluate(async (commands) => {
  const { setFields, setLibraryDefault } = await import(commands);
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const rec = [...ws.root.canvasInputs.values()].find(
    (r) =>
      ws.root.typeOf(r) === "Button" &&
      ws.root.typeOf(ws.root.canvasInputs.get(r.parentId)) !== "Slider",
  );
  ws.execute(
    setLibraryDefault({
      definitionId: "lib:definition:origin-component-button",
      scope: "stateRules",
      state: "hover",
      key: "color",
      write: { kind: "set", value: "#abcdef" },
      newId: ws.newId,
    }),
  );
  ws.execute(
    setFields({
      targets: [{ kind: "node", id: rec.sourceId }],
      visual: { fontSize: { kind: "set", value: 31 } },
    }),
  );
  return rec.sourceId;
}, commands);
await page.waitForTimeout(1500);
const button = await page.evaluate((id) => {
  const doc = document.querySelector("#previewFrame")?.contentDocument;
  const el = [...(doc?.querySelectorAll("[data-catalog-id]") ?? [])].find(
    (e) => e.getAttribute("data-catalog-id").includes(id) && e.tagName === "BUTTON",
  );
  return el
    ? {
        tag: el.tagName,
        fontSize: getComputedStyle(el).fontSize,
        hoverVar: el.style.getPropertyValue("--catalog-hover-color"),
      }
    : null;
}, written);
record(
  "R-h1 the Preview Button keeps its own font size with a hover value written",
  button?.fontSize === "31px" && button?.hoverVar === "#abcdef",
  button,
);

await page.screenshot({ path: `${OUT}/review.png` });
record("R-3 no page errors", errors.length === 0, { errors });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
