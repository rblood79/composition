// ADR-256 Phase 2 live: a field draws its node tree. A TextField is placed and detached, a search
// Icon is put between its Label and Input (a free child), and its description emptied: the Preview
// draws Label · Icon · Input in order, the Canvas shows the Icon and hides the empty Description
// (presentWhen), Compare Mode screenshot for the two side by side. Real Builder, headed Chrome.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p2-field-live.mjs <out>
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
await page.keyboard.type("ADR-256 P2 field");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
await addFromPalette("text field");
await page.waitForTimeout(800);

const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const actions = `/@fs${REPO}/apps/builder/src/builder/catalogRuntime/componentActions.ts`;
// Detach the TextField (its parts become the user's nodes) and put a search Icon between the
// Label and the Input — a free child (reference: an icon in a field).
const fieldId = await page.evaluate(
  async ({ commands, actions }) => {
    const { insertNodes, setFields } = await import(commands);
    const { catalogComponentCommands } = await import(actions);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const rec = [...ws.root.canvasInputs.values()].find(
      (r) => ws.root.typeOf(r) === "TextField",
    );
    const id = rec.sourceId;
    ws.execute(catalogComponentCommands.detach(id, ws.newId));
    const icon = ws.newId("node");
    ws.execute(
      insertNodes({
        parent: { kind: "node", id },
        index: 1,
        entries: [
          {
            kind: "node",
            id: icon,
            definitionId: "lib:definition:type-Icon",
            children: [],
            props: { iconName: { kind: "set", value: "search" } },
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
        ],
        rootIds: [icon],
        newId: ws.newId,
      }),
    );
    ws.execute(
      setFields({
        targets: [{ kind: "node", id }],
        props: { description: { kind: "set", value: "" } },
      }),
    );
    return id;
  },
  { commands, actions },
);
await page
  .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
  .first()
  .click();
await page.waitForTimeout(3000);
const dom = await page.evaluate((id) => {
  const doc = document.querySelector("#previewFrame")?.contentDocument;
  const root = [...(doc?.querySelectorAll("[data-catalog-id]") ?? [])].find(
    (e) =>
      e.getAttribute("data-catalog-id").endsWith(`::${id}`) &&
      e.classList.contains("react-aria-TextField"),
  );
  if (!root) return null;
  return {
    children: [...root.children].map(
      (child) => child.tagName.toLowerCase() + (child.className?.baseVal ?? child.className ? "." + String(child.className?.baseVal ?? child.className).split(" ")[0] : ""),
    ),
    box: (() => {
      const r = root.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    })(),
  };
}, fieldId);
record(
  "P2-1 Preview: the TextField draws Label · Icon · Input in order (free child in place)",
  !!dom &&
    dom.children[0]?.startsWith("label") &&
    /react-aria-Icon|^svg/.test(dom.children[1] ?? "") &&
    dom.children[2]?.startsWith("input"),
  dom,
);
const canvas = await page.evaluate((id) => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const field = [...ws.root.canvasInputs.values()].find(
    (r) => r.sourceId === id,
  );
  return field.children
    .map((childId) => ws.root.canvasInputs.get(childId))
    .map((r) => ({ type: ws.root.typeOf(r), hidden: !!r.hidden }));
}, fieldId);
record(
  "P2-2 Canvas: the Icon is the shown second child; the empty Description is not (presentWhen)",
  canvas[1]?.type === "Icon" &&
    !canvas[1]?.hidden &&
    canvas.some((k) => k.type === "Description" && k.hidden),
  canvas,
);
// Close the palette, zoom the Canvas in around the field and shoot both sides.
await page.mouse.click(265, 77);
await page.waitForTimeout(300);
await page.keyboard.down("Control");
for (let i = 0; i < 12; i += 1) {
  await page.mouse.move(846, 312);
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(80);
}
await page.keyboard.up("Control");
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/field-compare.png` });
record("P2-3 no page errors", errors.length === 0, { errors });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
