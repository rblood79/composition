// ADR-256 Phase 1d live: a part RAC needs cannot be deleted from its owner. A Slider and a Tabs are
// placed and detached (their parts become nodes the user owns); the Delete key on the Slider's
// SliderTrack and the Tabs' TabList is refused with the required-part notice, while a placed
// TextField goes with the same key (the control arm). With the rule off (`requiredPartOwner` → none)
// both parts are deleted — the rule is the refusal. Real Builder, headed Chrome, saved auth session.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p1-required-live.mjs <out>
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
await page.keyboard.type("ADR-256 P1 required parts");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
await addFromPalette("slider");
await addFromPalette("tabs");
await addFromPalette("text field");
// (No Compare Mode: the Delete shortcut runs on the Canvas.)
await page.waitForTimeout(2500);

const recordOf = (type, parentType) =>
  page.evaluate(
    ({ type, parentType }) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const r = [...ws.root.canvasInputs.values()].find(
        (rec) =>
          ws.root.typeOf(rec) === type &&
          !rec.hidden &&
          ws.root.typeOf(ws.root.canvasInputs.get(rec.parentId)) === parentType,
      );
      return r ? r.id : null;
    },
    { type, parentType },
  );
const deleteRecord = async (id) => {
  await page.evaluate(
    (id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]),
    id,
  );
  await page.waitForTimeout(400);
  // The canvas-focused scope (the Delete shortcut's), the selection kept.
  const focus = await page.evaluate(() => {
    const el = document.querySelector('[data-canvas-container="true"]');
    el?.focus();
    const a = document.activeElement;
    return {
      found: !!el,
      tabIndex: el?.tabIndex,
      active: a?.tagName + "." + (a?.className ?? ""),
    };
  });
  process.stdout.write(`focus ${JSON.stringify(focus)}\n`);
  await page.keyboard.press("Delete");
  await page.waitForTimeout(1000);
};
const toastText = () =>
  page.evaluate(() =>
    [...document.querySelectorAll(".toast .toast-message")]
      .map((el) => el.textContent ?? "")
      .join(" | "),
  );
// Detach the Slider and the Tabs: their parts become nodes the user owns (the Delete key reaches them).
const actions = `/@fs${REPO}/apps/builder/src/builder/catalogRuntime/componentActions.ts`;
await page.evaluate(async (actions) => {
  const { catalogComponentCommands } = await import(actions);
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  for (const type of ["Slider", "Tabs"]) {
    const rec = [...ws.root.canvasInputs.values()].find(
      (r) => ws.root.typeOf(r) === type,
    );
    ws.execute(catalogComponentCommands.detach(rec.sourceId, ws.newId));
  }
}, actions);
await page.waitForTimeout(1200);
const cases = [
  ["SliderTrack", "Slider"],
  ["TabList", "Tabs"],
];
for (const [type, owner] of cases) {
  const id = await recordOf(type, owner);
  await deleteRecord(id);
  const kept = await page.evaluate((id) => {
    const r =
      window.__COMPOSITION_CATALOG__.workspace.root.canvasInputs.get(id);
    return !!r && r.hidden !== true;
  }, id);
  const notice = await page
    .locator(".toast .toast-message")
    .last()
    .textContent({ timeout: 2000 })
    .catch(() => "");
  record(
    `P1d-1 Delete on a ${owner}'s ${type} is refused with the required-part notice`,
    !!id && kept && /needs this part|필요한 부품/.test(notice),
    { kept, notice: notice.slice(0, 160) },
  );
}
const field = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const r = [...ws.root.canvasInputs.values()].find(
    (rec) => ws.root.typeOf(rec) === "TextField",
  );
  return r.id;
});
await deleteRecord(field);
const fieldGone = await page.evaluate(
  (id) => !window.__COMPOSITION_CATALOG__.workspace.root.canvasInputs.has(id),
  field,
);
record(
  "P1d-2 control: the same Delete key removes a placed TextField",
  fieldGone,
  { field },
);
await page.screenshot({ path: `${OUT}/required.png` });
record("P1d-3 no page errors", errors.length === 0, { errors });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
