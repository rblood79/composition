// Codex Round 21 live (사용자 2026-10-09 「범위 밖으로 둔 것 체크하고 오류라면 수정 시작해」) — real
// Builder (headed Chrome, Compare Mode): a CheckboxGroup's size reaches an item the author wraps in a
// RAC Group (Canvas record · box = Preview `data-size` · box, and a later size change) · a selected
// Checkbox placed inside another Checkbox is one of the group's values (Canvas · Preview) and takes
// the group's size (사용자 「사용자에게 일관된 경험」) · after a reload the same · no errors.
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

// a selected Checkbox inside the sibling Checkbox (RAC's group context reaches it)
const nested = await page.evaluate(() =>
  window.__COMPOSITION_CATALOG__.workspace.newId("node"),
);
const inserted = await exec(
  (c, ws, arg) => {
    const outer = [...ws.root.canvasInputs.values()].find(
      (x) => x.sourceId === arg.sibling,
    );
    return c.insertNodes({
      parent: ws.positionOfRecord(outer.id).target,
      entries: [
        {
          kind: "node",
          id: arg.nested,
          definitionId: "lib:definition:origin-component-checkbox",
          children: [],
          props: {
            isSelected: { kind: "set", value: true },
            value: { kind: "set", value: "nested" },
          },
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [arg.nested],
      newId: ws.newId,
    });
  },
  { sibling, nested },
);
const inner = await view(nested);
record(
  "a selected Checkbox inside another Checkbox is selected (Canvas · Preview)",
  inserted.ok && inner.previewChecked === true && inner.canvasSelected,
  { inserted, inner },
);
record(
  "the nested Checkbox takes the group's size sm, not its own md (Canvas = Preview)",
  inner.canvasSize === "sm" && inner.previewSize === "sm",
  inner,
);
await setGroup({ size: "lg" });
const innerLg = await view(nested);
record(
  "a later group size lg reaches the nested Checkbox (Canvas = Preview)",
  innerLg.canvasSize === "lg" && innerLg.previewSize === "lg",
  innerLg,
);
await page.screenshot({ path: `${OUT}/nested-item.png` });

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
const after = { wrapped: await view(wrapped), nested: await view(nested) };
record(
  "reload: the wrapped item and the nested Checkbox keep the group's lg, the nested one stays selected",
  after.wrapped.canvasSize === "lg" &&
    after.wrapped.previewSize === "lg" &&
    sameBox(after.wrapped) &&
    after.nested.canvasSize === "lg" &&
    after.nested.previewSize === "lg" &&
    after.nested.previewChecked === true,
  after,
);
record("no errors", errors.length === 0, { errors: errors.slice(0, 6) });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors, url: page.url() }, null, 2),
);
await browser.close();
