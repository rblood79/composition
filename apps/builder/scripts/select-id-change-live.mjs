// Select id 변경 live (사용자 2026-10-09 「Select id 변경 부분 수정해」) — in the real Builder
// (headed Chrome, Compare Mode opens the Preview): the Select's ID typed in the Design panel reaches
// the Preview trigger at once — S-1 first id · S-2 a second id · S-3 after detach, a new id ·
// S-4 cleared: the trigger takes the Button's own id · S-5 no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/select-id-change-live.mjs <out>
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
const errorsAt = [];
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
async function addFromPalette(label, match = new RegExp(`^${label}$`, "i")) {
  const search = page.getByLabel("Search components");
  if (!(await search.isVisible().catch(() => false)))
    await page
      .getByRole("button", { name: "Components", exact: true })
      .first()
      .click();
  await search.fill(label);
  await page.waitForTimeout(300);
  await page.locator(".list-item", { hasText: match }).first().click();
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
  // (Close the Components panel: it covers the Preview half in Compare Mode.)
  await page
    .getByRole("button", { name: "Components", exact: true })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(300);
}
async function compareOn() {
  const button = page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .first();
  if (await button.isVisible().catch(() => false)) await button.click();
  await page.waitForTimeout(3000);
}

const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
async function newProject(name) {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type(name);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
}
/** Run a catalog command in the page: `build(c, ws, find, arg)` returns the command. */
async function run(build, arg) {
  return page.evaluate(
    async ({ commands, build, arg }) => {
      const c = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      // `find(type, within)` — the first record of `type` (inside the first `within` record).
      const find = (type, within) => {
        const all = [...ws.root.canvasInputs.values()];
        const scope = within
          ? all.find((r) => ws.root.typeOf(r) === within)
          : undefined;
        const inScope = (r) => {
          if (!scope) return true;
          for (let c = r; c; c = ws.root.canvasInputs.get(c.parentId))
            if (c.id === scope.id) return true;
          return false;
        };
        return all.find((r) => ws.root.typeOf(r) === type && inScope(r));
      };
      try {
        ws.execute(
          new Function(
            "c",
            "ws",
            "find",
            "arg",
            `return (${build})(c, ws, find, arg);`,
          )(c, ws, find, arg),
        );
        await new Promise((r) => setTimeout(r, 500));
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error?.code ?? String(error) };
      }
    },
    { commands, build: build.toString(), arg },
  );
}
const preview = (fn, arg) =>
  page.evaluate(
    ({ fn, arg }) => {
      const doc = document.querySelector("#previewFrame")?.contentDocument;
      return new Function("doc", "arg", `return (${fn})(doc, arg);`)(doc, arg);
    },
    { fn: fn.toString(), arg },
  );
const press = async (selector) => {
  await page
    .frameLocator("#previewFrame")
    .locator(selector)
    .first()
    // (Compare Mode shrinks the Preview under the Builder header — RAC's virtual press.)
    .dispatchEvent("click");
  await page.waitForTimeout(800);
};
const closeOverlay = async () => {
  await page.frameLocator("#previewFrame").locator("body").press("Escape");
  await page.waitForTimeout(500);
};

const exec = (build, arg) =>
  page.evaluate(
    async ({ commands, build, arg }) => {
      const c = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      try {
        ws.execute(
          new Function("c", "ws", "arg", `return (${build})(c, ws, arg);`)(
            c,
            ws,
            arg,
          ),
        );
        await new Promise((r) => setTimeout(r, 800));
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error?.code ?? String(error) };
      }
    },
    { commands, build: build.toString(), arg },
  );
/** The first record of `type` (its source id, record id, props, visual, derived props, hidden). */
const canvas = (type, title) =>
  page.evaluate(
    ({ type, title }) => {
      const root = window.__COMPOSITION_CATALOG__.workspace.root;
      const r = [...root.canvasInputs.values()].find(
        (x) =>
          root.typeOf(x) === type &&
          (title === undefined || x.props.title === title),
      );
      return (
        r && {
          id: r.id,
          sourceId: r.sourceId,
          props: r.props,
          visual: r.visual,
          derived: r.derivedProps ?? null,
          hidden: !!r.hidden,
        }
      );
    },
    { type, title },
  );
/** Each section's Canvas panel shown, by its Disclosure's title. */
const canvasPanels = () =>
  page.evaluate(() => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    return Object.fromEntries(
      [...root.canvasInputs.values()]
        .filter((r) => root.typeOf(r) === "DisclosurePanel")
        .map((p) => [
          String(root.canvasInputs.get(p.parentId).props.title),
          !p.hidden,
        ]),
    );
  });
const domExpanded = () =>
  preview((doc) =>
    [...doc.querySelectorAll(".react-aria-Disclosure")].map((d) =>
      d.hasAttribute("data-expanded"),
    ),
  );
const frameEntry = (ws) => ({
  kind: "node",
  id: ws.newId("node"),
  definitionId: "lib:definition:type-frame",
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
});

const recordOf = (type, n = 0) =>
  page.evaluate(
    ({ type, n }) => {
      const root = window.__COMPOSITION_CATALOG__.workspace.root;
      const r = [...root.canvasInputs.values()].filter(
        (x) => root.typeOf(x) === type,
      )[n];
      return (
        r && {
          id: r.id,
          sourceId: r.sourceId,
          props: r.props,
          displayState: r.displayState ?? null,
        }
      );
    },
    { type, n },
  );
const recordsOf = (type) =>
  page.evaluate((type) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    return [...root.canvasInputs.values()]
      .filter((x) => root.typeOf(x) === type)
      .map((r) => ({
        selected: r.props.isSelected === true,
        displayState: r.displayState ?? null,
      }));
  }, type);
const setOn = (id, props) =>
  exec(
    (c, ws, arg) =>
      c.setFields({
        targets: [ws.positionOfRecord(arg.id).target],
        props: Object.fromEntries(
          Object.entries(arg.props).map(([k, v]) => [
            k,
            { kind: "set", value: v },
          ]),
        ),
      }),
    { id, props },
  );

const triggerId = () =>
  preview((doc) => doc.querySelector(".react-aria-Select button")?.id ?? null);
async function selectTheSelect() {
  await page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const r = [...ws.root.canvasInputs.values()].find(
      (x) => ws.root.typeOf(x) === "Select",
    );
    ws.session.select([
      { identity: r.id, target: ws.positionOfRecord(r.id).target },
    ]);
  });
  await page.waitForTimeout(500);
  const id = page.locator('fieldset:has(> legend:text-is("ID")) input').first();
  if (!(await id.isVisible().catch(() => false))) {
    await page
      .getByRole("button", { name: /^Design/ })
      .first()
      .click();
    await page.waitForTimeout(800);
  }
}
async function typeId(value) {
  const tab = page.getByRole("tab", { name: "Property", exact: true }).first();
  if (await tab.isVisible().catch(() => false)) await tab.click();
  const input = page
    .locator('fieldset:has(> legend:text-is("ID")) input')
    .first();
  await input.click();
  await input.fill(value);
  await input.press("Enter");
  await page.waitForTimeout(1200);
}

await newProject(`select-id-change-${Date.now()}`);
await compareOn();
await addFromPalette("select");
await page.waitForTimeout(1500);
await selectTheSelect();
const select = await recordOf("Select");

await typeId("animal");
const s1 = await triggerId();
record("S-1 the Select's ID reaches the Preview trigger", s1 === "animal", {
  s1,
});

await typeId("pet");
const s2 = await triggerId();
record("S-2 a second ID replaces the first", s2 === "pet", { s2 });

const detached = await exec(
  (c, ws, id) => c.detachInstances({ ids: [id], newId: ws.newId }),
  select.sourceId,
);
await page.waitForTimeout(800);
await selectTheSelect();
await typeId("species");
const s3 = await triggerId();
record(
  "S-3 after detach, a new ID reaches the trigger",
  detached.ok && s3 === "species",
  { detached, s3 },
);

await typeId("");
const own = await page.evaluate(() => {
  const root = window.__COMPOSITION_CATALOG__.workspace.root;
  const b = [...root.domInputs.values()].find(
    (r) =>
      root.typeOf(r) === "Button" &&
      root.typeOf(root.domInputs.get(r.parentId)) === "Select",
  );
  return b?.htmlId ?? null;
});
const s4 = await triggerId();
record(
  "S-4 cleared: the trigger takes the Button's own id",
  Boolean(own) && s4 === own,
  { own, s4 },
);

await page.screenshot({ path: `${OUT}/select-id.png` });
record("S-5 no errors", errors.length === 0, { errors: errors.slice(0, 5) });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
