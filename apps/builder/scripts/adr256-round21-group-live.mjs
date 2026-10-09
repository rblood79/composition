// Codex Round 21 live (사용자 2026-10-09 「범위 밖으로 둔 것 체크하고 오류라면 수정 시작해」) — real
// Builder (headed Chrome, Compare Mode): a CheckboxGroup's size reaches an item the author wraps in a
// RAC Group (Canvas record · box = Preview `data-size` · box, and a later size change) · a
// palette add with an item selected puts no item inside another of its type (Checkbox · Button) and
// with a group selected puts it in the group (CheckboxGroup · ButtonGroup) · after a reload the same ·
// no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-round21-group-live.mjs <out>
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

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("Round 21 group followups");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
await addFromPalette("checkbox group");
await compareOn();
const group = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  return [...ws.root.canvasInputs.values()].find(
    (r) => ws.root.typeOf(r) === "CheckboxGroup",
  ).sourceId;
});
await exec(
  (c, ws, arg) => c.detachInstances({ ids: [arg], newId: ws.newId }),
  group,
);
const setGroup = (props) =>
  exec(
    (c, ws, arg) => {
      const r = [...ws.root.canvasInputs.values()].find(
        (x) => x.sourceId === arg.group,
      );
      return c.setFields({
        targets: [ws.positionOfRecord(r.id).target],
        props: Object.fromEntries(
          Object.entries(arg.props).map(([k, v]) => [
            k,
            { kind: "set", value: v },
          ]),
        ),
      });
    },
    { group, props },
  );
await setGroup({ size: "lg" });
const checkboxes = () =>
  page.evaluate(() => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    return [...root.canvasInputs.values()]
      .filter((r) => root.typeOf(r) === "Checkbox")
      .map((r) => r.sourceId);
  });
const [wrapped, sibling] = await checkboxes();
await exec(
  (c, ws, arg) =>
    c.groupNodes({
      ids: [arg],
      group: {
        kind: "node",
        id: ws.newId("node"),
        definitionId: "lib:definition:type-Group",
        children: [],
        props: {},
        visual: {},
        sizing: {},
        descendantOverrides: [],
      },
      newId: ws.newId,
    }),
  wrapped,
);
const view = (source) =>
  page.evaluate((source) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const r = [...root.canvasInputs.values()].find(
      (x) => x.sourceId === source,
    );
    const doc = document.querySelector("#previewFrame").contentDocument;
    const el = doc.querySelector(`[data-catalog-id="${r.id}"]`);
    const sized = el?.matches("[data-size]")
      ? el
      : el?.querySelector("[data-size]");
    const input = el?.querySelector("input");
    const g = root.getGeometry([r.id]).get(r.id);
    const rect = el?.getBoundingClientRect();
    return {
      parent: root.typeOf(root.canvasInputs.get(r.parentId)),
      canvasSize: r.props.size,
      previewSize: sized?.getAttribute("data-size") ?? null,
      canvasBox: g && { w: Math.round(g.width), h: Math.round(g.height) },
      previewBox: rect && {
        w: Math.round(rect.width),
        h: Math.round(rect.height),
      },
      previewChecked: input?.checked ?? null,
      canvasSelected: r.props.isSelected === true,
    };
  }, source);
const sameBox = (v) =>
  !!v.canvasBox &&
  !!v.previewBox &&
  Math.abs(v.canvasBox.w - v.previewBox.w) <= 1 &&
  Math.abs(v.canvasBox.h - v.previewBox.h) <= 1;

const lg = await view(wrapped);
const lgSibling = await view(sibling);
record(
  "the item wrapped in a Group takes the group's size lg (Canvas = Preview, = its unwrapped sibling)",
  lg.parent === "Group" &&
    lg.canvasSize === "lg" &&
    lg.previewSize === "lg" &&
    sameBox(lg) &&
    lg.canvasBox.h === lgSibling.canvasBox.h,
  { wrapped: lg, sibling: lgSibling },
);
await setGroup({ size: "sm" });
const sm = await view(wrapped);
record(
  "a later group size sm reaches the wrapped item (Canvas = Preview)",
  sm.canvasSize === "sm" && sm.previewSize === "sm" && sameBox(sm),
  sm,
);
await page.screenshot({ path: `${OUT}/group-size.png` });

// palette: a selected item takes no item of its own type (it goes to the nearest ancestor that takes
// it — 사용자 「checkbox, radio 안에도 동일한 checkbox, radio 를 넣으면 안되는게 맞다」), a selected
// group takes its items (「buttongroup 안에 button 은 넣을 수 있지」)
const select = (type, n = 0) =>
  page.evaluate(
    ({ type, n }) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const r = [...ws.root.canvasInputs.values()].filter(
        (x) => ws.root.typeOf(x) === type,
      )[n];
      ws.session.select([
        { identity: r.id, target: ws.positionOfRecord(r.id).target },
      ]);
    },
    { type, n },
  );
const placed = (type) =>
  page.evaluate((type) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const all = [...root.canvasInputs.values()].filter(
      (x) => root.typeOf(x) === type,
    );
    const ancestors = (r) => {
      const out = [];
      for (
        let c = root.canvasInputs.get(r.parentId);
        c;
        c = root.canvasInputs.get(c.parentId)
      )
        out.push(root.typeOf(c));
      return out;
    };
    const doc = document.querySelector("#previewFrame").contentDocument;
    return all.map((r) => ({
      sourceId: r.sourceId,
      parent: root.typeOf(root.canvasInputs.get(r.parentId)),
      ancestors: ancestors(r),
      inPreview: !!doc.querySelector(`[data-catalog-id="${r.id}"]`),
    }));
  }, type);
const added = (before, after) =>
  after.filter((r) => !before.some((b) => b.sourceId === r.sourceId));

let before = await placed("Checkbox");
await select("Checkbox", 1);
await addFromPalette("checkbox");
let fresh = added(before, await placed("Checkbox"));
record(
  "palette with a Checkbox selected: the new Checkbox is not inside it — it joins the group (Preview too)",
  fresh.length === 1 &&
    !fresh[0].ancestors.includes("Checkbox") &&
    fresh[0].ancestors.includes("CheckboxGroup") &&
    fresh[0].inPreview,
  fresh,
);
before = await placed("Checkbox");
await select("CheckboxGroup");
await addFromPalette("checkbox");
fresh = added(before, await placed("Checkbox"));
record(
  "palette with the CheckboxGroup selected: the new Checkbox is in the group (Preview too)",
  fresh.length === 1 &&
    fresh[0].ancestors.includes("CheckboxGroup") &&
    fresh[0].inPreview,
  fresh,
);
const straight = await view(fresh[0].sourceId);
record(
  "the Checkbox put straight in the group takes the group's size sm (Canvas = Preview)",
  straight.canvasSize === "sm" &&
    straight.previewSize === "sm" &&
    sameBox(straight),
  straight,
);
await page.evaluate(() =>
  window.__COMPOSITION_CATALOG__.workspace.session.clearSelection(),
);
await addFromPalette("button group");
before = await placed("Button");
await select("ButtonGroup");
await addFromPalette("button");
fresh = added(before, await placed("Button"));
record(
  "palette with a ButtonGroup selected: the new Button is in the group (Preview too)",
  fresh.length === 1 && fresh[0].parent === "ButtonGroup" && fresh[0].inPreview,
  fresh,
);
before = await placed("Button");
const groupButton = (await placed("Button")).findIndex(
  (r) => r.parent === "ButtonGroup",
);
await select("Button", groupButton);
await addFromPalette("button");
fresh = added(before, await placed("Button"));
record(
  "palette with a Button in the group selected: the new Button is not inside it",
  fresh.length === 1 &&
    !fresh[0].ancestors.includes("Button") &&
    fresh[0].inPreview,
  fresh,
);
const checkboxCount = (await placed("Checkbox")).length;
await page.screenshot({ path: `${OUT}/palette-items.png` });

await page.waitForTimeout(1500);
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(2500);
await compareOn();
const after = {
  wrapped: await view(wrapped),
  checkboxes: (await placed("Checkbox")).length,
};
record(
  "reload: the wrapped item keeps the group's sm, the added Checkboxes stay",
  after.wrapped.canvasSize === "sm" &&
    after.wrapped.previewSize === "sm" &&
    sameBox(after.wrapped) &&
    after.checkboxes === checkboxCount,
  after,
);
record("no errors", errors.length === 0, { errors: errors.slice(0, 6) });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors, url: page.url() }, null, 2),
);
await browser.close();
