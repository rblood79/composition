// ADR-256 Phase 6 판독 (Round 14) 수리 live — picker 노드 트리 편집 4건, 실제 Builder (headed Chrome,
// Compare Mode 로 Preview 열림): R-1 DatePicker 의 Calendar 를 frame 으로 감싸도 picker 의 개월 수 ·
// 크기 · R-2 NumberField control Group 의 role 과 `showWhen: isFocusVisible` 노드 (키보드 focus 에
// 나타남) · R-3 frame 안 Select Popover 가 Canvas 에서 닫힘 · R-4 작성한 Popover `top` 이 이김.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p6-review-live.mjs <out>
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
/** A palette component on the page, detached (its parts are the author's own nodes). */
async function placeDetached(label, type) {
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectRecords([]),
  );
  await page.waitForTimeout(300);
  await addFromPalette(label);
  const result = await run(
    (c, ws, find, type) =>
      c.detachInstances({ ids: [find(type).sourceId], newId: ws.newId }),
    type,
  );
  await page.waitForTimeout(600);
  return result;
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

await newProject("ADR-256 P6 review fixes");
await compareOn();

// R-1 (m1): a DatePicker's Calendar in a frame inside its Popover keeps the picker's context.
const r1a = await placeDetached("date picker", "DatePicker");
const r1b = await run((c, ws, find) =>
  c.groupNodes({
    ids: [find("Calendar", "DatePicker").sourceId],
    group: {
      kind: "node",
      id: ws.newId("node"),
      definitionId: "lib:definition:type-frame",
      children: [],
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
    },
    newId: ws.newId,
  }),
);
const r1c = await run((c, ws, find) =>
  c.setFields({
    targets: [ws.positionOfRecord(find("DatePicker").id).target],
    props: {
      maxVisibleMonths: { kind: "set", value: 2 },
      size: { kind: "set", value: "lg" },
    },
  }),
);
errorsAt.push(["R-1 edits", errors.length]);
await press(".react-aria-DatePicker .react-aria-Group button");
errorsAt.push(["R-1 open", errors.length]);
const r1 = await preview((doc) => {
  const calendar = doc.querySelector(
    ".react-aria-Popover .react-aria-Calendar",
  );
  return {
    inFrame: !!calendar?.parentElement?.closest(".react-aria-Popover"),
    grids: calendar?.querySelectorAll("table").length ?? 0,
    size: calendar?.getAttribute("data-size") ?? null,
  };
});
record(
  "R-1 (m1) a DatePicker's Calendar in a frame: the open calendar shows the picker's 2 months at its size",
  r1a.ok && r1b.ok && r1c.ok && r1.grids === 2 && r1.size === "lg",
  { r1a, r1b, r1c, r1 },
);
await closeOverlay();

// R-2 (m2): a NumberField's control Group passes RAC's state to a `showWhen` node inside, and its
// role.
const r2a = await placeDetached("number field", "NumberField");
const r2b = await run((c, ws, find) => {
  const group = find("Group", "NumberField").sourceId;
  const id = ws.newId("node");
  return c.insertNodes({
    parent: { kind: "node", id: group },
    entries: [
      {
        kind: "node",
        id,
        definitionId: "lib:definition:text",
        children: [],
        props: { children: { kind: "set", value: "focus ring" } },
        visual: {},
        sizing: {},
        descendantOverrides: [],
        showWhen: { all: ["isFocusVisible"] },
      },
    ],
    rootIds: [id],
    newId: ws.newId,
  });
});
const r2role = await run((c, ws, find) =>
  c.setFields({
    targets: [{ kind: "node", id: find("Group", "NumberField").sourceId }],
    props: { role: { kind: "set", value: "presentation" } },
  }),
);
errorsAt.push(["R-2 edits", errors.length]);
const r2rest = await preview((doc) => {
  const group = doc.querySelector(".react-aria-NumberField .react-aria-Group");
  return {
    role: group?.getAttribute("role"),
    shown: group?.textContent.includes("focus ring"),
  };
});
const r2focus = await preview((doc) => {
  doc.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
  );
  doc.querySelector(".react-aria-NumberField input").focus();
  return null;
});
await page.waitForTimeout(500);
errorsAt.push(["R-2 focus", errors.length]);
const r2 = await preview((doc) => {
  const group = doc.querySelector(".react-aria-NumberField .react-aria-Group");
  return {
    focusVisible: group?.hasAttribute("data-focus-visible"),
    shown: group?.textContent.includes("focus ring"),
  };
});
const r2canvas = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const mark = [...ws.root.canvasInputs.values()].find(
    (r) => r.props.children === "focus ring",
  );
  return mark?.hidden ?? null;
});
record(
  "R-2 (m2) a NumberField's Group: role presentation; its `showWhen: isFocusVisible` Text appears with RAC's keyboard focus (hidden at rest on both sides)",
  r2a.ok &&
    r2b.ok &&
    r2role.ok &&
    r2rest.role === "presentation" &&
    r2rest.shown === false &&
    r2.focusVisible === true &&
    r2.shown === true &&
    r2canvas === true,
  { r2a, r2b, r2role, r2rest, r2focus, r2, r2canvas },
);
await page.evaluate(() =>
  document
    .querySelector("#previewFrame")
    ?.contentDocument?.activeElement?.blur(),
);

// R-3 (m3): a Select's Popover in a frame stays closed on the Canvas, as in the Preview.
errorsAt.push(["R-2 blur", errors.length]);
const r3a = await placeDetached("select", "Select");
errorsAt.push(["R-3 place", errors.length]);
const r3b = await run((c, ws, find) =>
  c.groupNodes({
    ids: [find("Popover", "Select").sourceId],
    group: {
      kind: "node",
      id: ws.newId("node"),
      definitionId: "lib:definition:type-frame",
      children: [],
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
    },
    newId: ws.newId,
  }),
);
errorsAt.push(["R-3 edits", errors.length]);
const r3 = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const root = ws.root;
  const select = [...root.canvasInputs.values()].find(
    (r) => root.typeOf(r) === "Select",
  );
  const popover = [...root.canvasInputs.values()].find(
    (r) =>
      root.typeOf(r) === "Popover" &&
      root.typeOf(root.canvasInputs.get(r.parentId)) === "frame" &&
      root.canvasInputs.get(r.parentId).parentId === select.id,
  );
  const doc = document.querySelector("#previewFrame")?.contentDocument;
  return {
    parent: popover
      ? root.typeOf(root.canvasInputs.get(popover.parentId))
      : null,
    hidden: popover?.hidden ?? null,
    previewOpen: !!doc?.querySelector(
      `[data-catalog-id="${CSS.escape(popover?.id ?? "")}"]`,
    ),
  };
});
record(
  "R-3 (m3) a Select's Popover in a frame: hidden on the Canvas, not drawn in the Preview (closed)",
  r3a.ok &&
    r3b.ok &&
    r3.parent === "frame" &&
    r3.hidden === true &&
    !r3.previewOpen,
  { r3a, r3b, r3 },
);

// R-4 (m4): the author's Popover placement wins (the Select in the frame above — RAC's context
// reaches it through the frame).
const r4b = await run((c, ws) => {
  const root = ws.root;
  const select = [...root.canvasInputs.values()].find(
    (r) => root.typeOf(r) === "Select",
  );
  const popover = [...root.canvasInputs.values()].find(
    (r) =>
      root.typeOf(r) === "Popover" &&
      root.canvasInputs.get(r.parentId).parentId === select.id,
  );
  return c.setFields({
    targets: [ws.positionOfRecord(popover.id).target],
    props: {
      placement: { kind: "set", value: "top" },
      shouldFlip: { kind: "set", value: false },
    },
  });
});
errorsAt.push(["R-4 edits", errors.length]);
await press(".react-aria-Select button");
errorsAt.push(["R-4 open", errors.length]);
const r4 = await preview((doc) => {
  const popover = doc.querySelector(".react-aria-Popover");
  const trigger = doc.querySelector(".react-aria-Select button");
  const p = popover?.getBoundingClientRect();
  const t = trigger?.getBoundingClientRect();
  return {
    placement: popover?.getAttribute("data-placement") ?? null,
    above: p && t ? p.bottom <= t.top + 1 : null,
  };
});
record(
  "R-4 (m4) the Select's Popover set to `top` opens above its trigger (`data-placement=top`)",
  r4b.ok && r4.placement === "top" && r4.above === true,
  { r4b, r4 },
);
await closeOverlay();
// (A Select detached with the Preview open loops React's updates in the Preview — a defect before
// Phase 6 (the same at `eafede6dd`, 0 for a ComboBox · DatePicker · ListBox), recorded out of scope.
// R-1 · R-2 run before it.)
const beforeSelect = errorsAt.find(([at]) => at === "R-2 blur")?.[1];
record(
  "R-5 no page errors through R-1 · R-2 (R-3 · R-4: only the known Select-detach update loop)",
  beforeSelect === 0 &&
    errors.every((error) => error.includes("Maximum update depth exceeded")),
  { errorsAt, errors: errors.slice(0, 2) },
);
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
