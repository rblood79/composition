// Live probe/check for the ADR-253 follow-ups on field parts: the real Builder + Preview (Compare
// Mode), headed Chrome, saved auth session. For each placed field it writes props (PROPS JSON) and
// records the parts' boxes relative to the field on the Canvas and in the Preview, so the two
// consumers can be compared part by part.
//
//   BUILDER_URL=http://localhost:5173 FIELDS="text field,color field" \
//     PROPS='{"description":"Help text","labelPosition":"side"}' \
//     node apps/builder/scripts/field-followups-live.mjs <out-dir>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const FIELDS = (process.env.FIELDS ?? "text field").split(",");
const PROPS = JSON.parse(process.env.PROPS ?? "{}");
const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
  ...(process.env.LOCALE ? { locale: process.env.LOCALE } : {}),
});
const errors = [];
const page = await context.newPage();
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
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("Field follow-ups live");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
for (const field of FIELDS) await addFromPalette(field.trim());
await page
  .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
  .first()
  .click();
await page.waitForTimeout(2000);
if (Object.keys(PROPS).length)
  await page.evaluate(
    async ([path, props]) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const { setFields } = await import(/* @vite-ignore */ path);
      const g = ws.runtime.graph;
      const placed = [...ws.root.canvasInputs.values()].filter(
        (r) =>
          r.sourceId.startsWith("project:node:") &&
          r.parentId &&
          ws.root.canvasInputs.get(r.parentId)?.sourceId ===
            "project:node:home-body",
      );
      for (const record of placed)
        for (const [key, value] of Object.entries(props))
          try {
            ws.execute(
              setFields({
                targets: [{ kind: "node", id: record.sourceId }],
                props: { [key]: { kind: "set", value } },
              }),
            );
          } catch {
            // (a field that does not take the prop)
          }
      return g.revision;
    },
    [commands, PROPS],
  );
await page.waitForTimeout(2000);
const snapshot = await page.evaluate(() => {
  const handle = window.__COMPOSITION_CATALOG__;
  const ws = handle.workspace;
  const g = ws.runtime.graph;
  const records = ws.root.canvasInputs;
  const typeOf = (r) => g.getDefinition(r.definitionId)?.name;
  const doc = document.querySelector("#previewFrame")?.contentDocument;
  const fields = [...records.values()].filter(
    (r) =>
      r.sourceId.startsWith("project:node:") &&
      records.get(r.parentId)?.sourceId === "project:node:home-body",
  );
  const round = (v) => Math.round(v * 10) / 10;
  const rel = (box, origin) =>
    box && {
      x: round(box.x - origin.x),
      y: round(box.y - origin.y),
      w: round(box.width),
      h: round(box.height),
    };
  return fields.map((field) => {
    const type = typeOf(field);
    const fieldBox = handle.canvas.boundsOf(field.id);
    const canvas = {};
    for (const id of field.children) {
      const child = records.get(id);
      if (!child || child.hidden) continue;
      canvas[`${typeOf(child)}#${child.bindingId}`] = rel(
        handle.canvas.boundsOf(id),
        fieldBox,
      );
    }
    const element = doc?.querySelector(`.react-aria-${type}`);
    const preview = {};
    if (element) {
      const origin = element.getBoundingClientRect();
      for (const child of element.children) {
        const r = child.getBoundingClientRect();
        if (!r.width && !r.height) continue;
        preview[
          `${child.tagName.toLowerCase()}.${[...child.classList].join(".")}${child.getAttribute("slot") ? `[slot=${child.getAttribute("slot")}]` : ""}`
        ] = rel({ x: r.x, y: r.y, width: r.width, height: r.height }, origin);
      }
    }
    // A Select's value paint: the Canvas record's derived color, the Preview's computed paint.
    const valueRecord = [...records.values()].find(
      (r) =>
        r.bindingId === "selectvalue" &&
        (() => {
          for (let c = r; c; c = records.get(c.parentId))
            if (c.id === field.id) return true;
          return false;
        })(),
    );
    const valueElement = element?.querySelector(".react-aria-SelectValue");
    const value = valueRecord
      ? {
          canvasColor: valueRecord.derivedProps?.color ?? valueRecord.visual.color,
          previewColor: valueElement && getComputedStyle(valueElement).color,
          previewOpacity: valueElement && getComputedStyle(valueElement).opacity,
          placeholder: valueElement?.hasAttribute("data-placeholder"),
        }
      : undefined;
    // Date segments: the Canvas's segment runs and the Preview's DateInput text, per DateInput.
    const under = (r) => {
      for (let c = r; c; c = records.get(c.parentId)) if (c.id === field.id) return true;
      return false;
    };
    const dateInputs = [...records.values()].filter(
      (r) => r.bindingId === "dateinput" && under(r),
    );
    const segments = dateInputs.length
      ? {
          canvas: dateInputs.map((r) =>
            (ws.root.dateSegmentPaint(r.id)?.runs ?? [])
              .map((run) => run.text ?? "")
              .join(""),
          ),
          preview: [...(element?.querySelectorAll(".react-aria-DateInput") ?? [])].map(
            (el) => el.textContent,
          ),
        }
      : undefined;
    return {
      type,
      ...(value ? { value } : {}),
      ...(segments ? { segments } : {}),
      props: field.props,
      canvas: { size: rel(fieldBox, fieldBox), parts: canvas },
      preview: {
        size: element
          ? rel(element.getBoundingClientRect(), element.getBoundingClientRect())
          : null,
        parts: preview,
      },
    };
  });
});
if (process.env.PROBE_LOCALE)
  process.stdout.write(
    `locale probe: ${JSON.stringify(
      await page.evaluate(() => {
        const frame = document.querySelector("#previewFrame");
        const win = frame?.contentWindow;
        const doc = frame?.contentDocument;
        return {
          builder: navigator.language,
          builderIntl: Intl.DateTimeFormat().resolvedOptions().locale,
          preview: win?.navigator.language,
          previewIntl: win && new win.Intl.DateTimeFormat().resolvedOptions().locale,
          htmlLang: doc?.documentElement.lang,
          dirLangAttrs: [...(doc?.querySelectorAll("[lang]") ?? [])]
            .slice(0, 5)
            .map((el) => `${el.tagName}:${el.getAttribute("lang")}`),
        };
      }),
    )}\n`,
  );
writeFileSync(`${OUT}/compare.png`, await page.screenshot());
writeFileSync(
  `${OUT}/snapshot.json`,
  JSON.stringify({ snapshot, errors }, null, 2),
);
process.stdout.write(`${JSON.stringify(snapshot, null, 1)}\nerrors: ${errors.length}\n${errors.join("\n")}\n`);
await browser.close();
