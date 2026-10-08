// ADR-256 Phase 8d live — a DisclosureGroup takes free content and draws RAC's DisclosureGroup, in the
// real Builder (headed Chrome, Compare Mode opens the Preview): L-1 a Text in the group stands on both
// consumers · L-2 single expansion is RAC's · L-3 reopened · L-4 no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p8d-live.mjs <out>
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
  await page
    .locator(".list-item", { hasText: match })
    .first()
    .click();
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



const groupProbe = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const group = [...root.canvasInputs.values()].find((r) => root.typeOf(r) === "DisclosureGroup");
    const kids = group.children.map((id) => root.canvasInputs.get(id));
    const g = root.getGeometry(kids.map((k) => k.id));
    return {
      id: group.id,
      kids: kids.map((k) => [root.typeOf(k), k.props.children ?? k.props.title ?? null, Math.round(g.get(k.id).height)]),
    };
  });
const domGroup = () =>
  preview((doc) => {
    const group = doc.querySelector(".react-aria-DisclosureGroup");
    return group
      ? [...group.children].map((c) => [c.className, c.hasAttribute("data-expanded"), c.textContent.slice(0, 20)])
      : null;
  });
const exec = (build, arg) =>
  page.evaluate(async ({ commands, build, arg }) => {
    const c = await import(commands);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    try {
      ws.execute(new Function("c", "ws", "arg", `return (${build})(c, ws, arg);`)(c, ws, arg));
      await new Promise((r) => setTimeout(r, 800));
      return { ok: true };
    } catch (error) {
      return { ok: false, code: error?.code ?? String(error) };
    }
  }, { commands, build: build.toString(), arg });

await newProject(`adr256-p8d-${Date.now()}`);
await compareOn();
await addFromPalette("Disclosure", /^Disclosure ?Group$/i);
await page.waitForTimeout(1500);

// L-1: a free child (a Text) goes into the group (the nesting check allows it — G0 ②) and stands on both.
const g1 = await groupProbe();
const r1 = await exec(
  (c, ws, id) => {
    const note = ws.newId("node");
    return c.insertNodes({
      parent: ws.positionOfRecord(id).target,
      entries: [{ kind: "node", id: note, definitionId: "lib:definition:text", children: [], props: { children: { kind: "set", value: "Note" } }, visual: {}, sizing: {}, descendantOverrides: [] }],
      rootIds: [note],
      newId: ws.newId,
    });
  },
  g1.id,
);
const g1b = await groupProbe();
const d1 = await domGroup();
record(
  "L-1 a Text in the DisclosureGroup: accepted · Canvas box · Preview child",
  r1.ok && g1b.kids.some((k) => k[0] === "Text" && k[1] === "Note" && k[2] > 0) && d1?.some((c) => c[2] === "Note"),
  { r1, canvas: g1b.kids, dom: d1 },
);
errorsAt.push(["L-1", errors.length]);

// L-2: allowsMultipleExpanded false — RAC keeps one section open; pressing the second closes the first.
const r2 = await exec(
  (c, ws, id) =>
    c.setFields({ targets: [ws.positionOfRecord(id).target], props: { allowsMultipleExpanded: { kind: "set", value: false } } }),
  g1.id,
);
await page.waitForTimeout(800);
const d2a = await domGroup();
await press(".react-aria-DisclosureGroup > .react-aria-Disclosure:nth-of-type(2) button[slot='trigger']");
const d2b = await domGroup();
const open = (d) => (d ?? []).filter((c) => /Disclosure/.test(c[0])).map((c) => c[1]);
record(
  "L-2 single expansion: [open, closed] → press the second → [closed, open]",
  r2.ok && JSON.stringify(open(d2a)) === "[true,false]" && JSON.stringify(open(d2b)) === "[false,true]",
  { r2, before: open(d2a), after: open(d2b) },
);
errorsAt.push(["L-2", errors.length]);

// L-3: saved and reopened the same (the free Text in the group).
await page.waitForTimeout(1500);
const projectUrl = page.url();
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await page.waitForTimeout(2500);
const g3 = await groupProbe();
record("L-3 saved and reopened: the group's Text stays", page.url() === projectUrl && g3.kids.some((k) => k[1] === "Note"), g3.kids);
record("L-4 no page errors", errors.length === 0, { errorsAt, errors: errors.slice(0, 3) });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
