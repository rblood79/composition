// Codex Round 20 live (사용자 2026-10-09 「codex 리뷰다」) — real Builder (headed Chrome, Compare Mode):
// H2 a CheckboxGroup's · RadioGroup's · ToggleButtonGroup's selected item wrapped in a RAC Group stays
// selected on the Canvas and in the Preview (and after a reload) · H1 a TagGroup's deleted Label
// stays deleted, a moved Label moves, a free Text renders (Preview), and the TagGroup · TagList boxes
// are the Canvas's · M1 a Single TagGroup's Tag selects on a Preview press · no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-round20-live.mjs <out>
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

const repo = REPO;
/** Canvas (resting state) and Preview selection of the item `source` in its group. */
const toggleState = (source) =>
  page.evaluate(
    async ({ source, repo }) => {
      const root = window.__COMPOSITION_CATALOG__.workspace.root;
      const record = [...root.canvasInputs.values()].find(
        (r) => r.sourceId === source,
      );
      const doc = document.querySelector("#previewFrame").contentDocument;
      const el = doc.querySelector(`[data-catalog-id="${record.id}"]`);
      const { catalogStateValue } = await import(
        `/@fs${repo}/packages/shared/src/catalog/runtime/presence.ts`
      );
      const control = el?.querySelector("input") ?? el;
      return {
        parent: root.typeOf(root.canvasInputs.get(record.parentId)),
        canvas: catalogStateValue(
          record,
          "isSelected",
          (id) => root.canvasInputs.get(id),
          (r) => root.typeOf(r),
        ),
        preview:
          control?.tagName === "INPUT"
            ? control.checked
            : (control?.getAttribute("aria-pressed") ??
                control?.getAttribute("aria-checked")) === "true",
      };
    },
    { source, repo },
  );

// ── H2: RAC Group around a group's selected item
await newProject(`adr256-round20-${Date.now()}`);
await compareOn();
const groups = [
  ["checkbox group", "CheckboxGroup", "Checkbox"],
  ["radio group", "RadioGroup", "Radio"],
  ["toggle button group", "ToggleButtonGroup", "ToggleButton"],
];
const wrapped = {};
// (The palette adds into the selection — the Group just made would take the next component.)
const clearSelection = () =>
  page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.session.clearSelection(),
  );
for (const [palette, groupType, part] of groups) {
  await clearSelection();
  await addFromPalette(palette);
  await page.waitForTimeout(800);
  wrapped[groupType] = await page.evaluate(
    async ({ commands, groupType, part }) => {
      const c = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const group = [...ws.root.canvasInputs.values()].find(
        (r) => ws.root.typeOf(r) === groupType,
      );
      ws.execute(c.detachInstances({ ids: [group.sourceId], newId: ws.newId }));
      const item = [...ws.root.canvasInputs.values()].find(
        (r) => ws.root.typeOf(r) === part,
      );
      ws.execute(
        c.setFields({
          targets: [ws.positionOfRecord(item.id).target],
          props: { isSelected: { kind: "set", value: true } },
        }),
      );
      ws.execute(
        c.groupNodes({
          ids: [item.sourceId],
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
      );
      return item.sourceId;
    },
    { commands, groupType, part },
  );
  await page.waitForTimeout(1200);
  const state = await toggleState(wrapped[groupType]);
  state.groupParent = await page.evaluate((groupType) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const g = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === groupType,
    );
    return root.typeOf(root.canvasInputs.get(g.parentId)) || "body";
  }, groupType);
  record(
    `H2 ${groupType}: the item in a Group stays selected (Canvas · Preview)`,
    state.parent === "Group" && state.canvas && state.preview,
    state,
  );
}
await page.screenshot({ path: `${OUT}/group-wrapped.png` });

// ── H1 · M1: TagGroup
await clearSelection();
await addFromPalette("tag group");
await page.waitForTimeout(1000);
const tagGroup = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  return [...ws.root.canvasInputs.values()].find(
    (r) => ws.root.typeOf(r) === "TagGroup",
  ).sourceId;
});
const tagsView = () =>
  page.evaluate((source) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const group = [...root.canvasInputs.values()].find(
      (r) => r.sourceId === source,
    );
    const doc = document.querySelector("#previewFrame").contentDocument;
    const owner = doc.querySelector(`[data-catalog-id="${group.id}"]`);
    const list = group.children
      .map((id) => root.canvasInputs.get(id))
      .find((r) => root.typeOf(r) === "TagList");
    const listEl = list && doc.querySelector(`[data-catalog-id="${list.id}"]`);
    const geometry = root.getGeometry([group.id, ...(list ? [list.id] : [])]);
    const box = (el) =>
      el && {
        w: Math.round(el.getBoundingClientRect().width),
        h: Math.round(el.getBoundingClientRect().height),
      };
    const g = geometry.get(group.id);
    const l = list && geometry.get(list.id);
    return {
      parent: root.typeOf(root.canvasInputs.get(group.parentId)) || "body",
      canvasChildren: group.children
        .map((id) => root.typeOf(root.canvasInputs.get(id)))
        .filter((t) => t),
      previewChildren: owner
        ? [...owner.children].map((e) => e.className || e.tagName)
        : null,
      labels: owner
        ? [...owner.querySelectorAll(".react-aria-Label")].map(
            (e) => e.textContent,
          )
        : null,
      tags: owner
        ? [...owner.querySelectorAll('[role="row"]')].map((e) =>
            e.getAttribute("aria-selected"),
          )
        : null,
      texts: owner
        ? [...owner.children]
            .filter((e) => e.classList.contains("react-aria-Text"))
            .map((e) => e.textContent)
        : null,
      boxes: {
        canvasGroup: g && { w: Math.round(g.width), h: Math.round(g.height) },
        previewGroup: box(owner),
        canvasList: l && { w: Math.round(l.width), h: Math.round(l.height) },
        previewList: box(listEl),
      },
    };
  }, tagGroup);
await exec((c, ws, arg) => {
  const r = [...ws.root.canvasInputs.values()].find((x) => x.sourceId === arg);
  return c.setFields({
    targets: [ws.positionOfRecord(r.id).target],
    props: {
      label: { kind: "set", value: "Flavors" },
      selectionMode: { kind: "set", value: "single" },
    },
  });
}, tagGroup);
const initial = await tagsView();
const sameBox = (a, b) =>
  a && b && Math.abs(a.w - b.w) <= 1 && Math.abs(a.h - b.h) <= 1;
record(
  "H1 TagGroup · TagList boxes: Canvas = Preview",
  sameBox(initial.boxes.canvasGroup, initial.boxes.previewGroup) &&
    sameBox(initial.boxes.canvasList, initial.boxes.previewList),
  initial.boxes,
);
await page.evaluate(() => {
  const doc = document.querySelector("#previewFrame").contentDocument;
  doc
    .querySelector('.react-aria-TagGroup [role="row"]')
    .dispatchEvent(new MouseEvent("click", { bubbles: true }));
});
await page.waitForTimeout(600);
const selected = await tagsView();
record(
  "M1 Single: a Preview press selects the Tag",
  selected.tags?.[0] === "true",
  { tags: selected.tags },
);
await closeOverlay();

// detach, then the Label after the TagList and a free Text at the end
const moved = await exec((c, ws, arg) => {
  const r = [...ws.root.canvasInputs.values()].find((x) => x.sourceId === arg);
  return c.detachInstances({ ids: [r.sourceId], newId: ws.newId });
}, tagGroup);
await exec((c, ws, arg) => {
  const group = [...ws.root.canvasInputs.values()].find(
    (x) => x.sourceId === arg,
  );
  const label = group.children
    .map((id) => ws.root.canvasInputs.get(id))
    .find((x) => ws.root.typeOf(x) === "Label");
  return c.moveNodes({
    ids: [label.sourceId],
    parent: { kind: "node", id: arg },
    newId: ws.newId,
  });
}, tagGroup);
const afterMove = await tagsView();
const listAt = afterMove.previewChildren?.indexOf("tag-list-wrapper") ?? -1;
const labelAt =
  afterMove.previewChildren?.findIndex((name) =>
    String(name).includes("react-aria-Label"),
  ) ?? -1;
record(
  "H1 a Label moved after the TagList is drawn after it",
  moved.ok &&
    afterMove.canvasChildren.at(-1) === "Label" &&
    labelAt > listAt &&
    listAt >= 0,
  afterMove,
);
const inserted = await exec((c, ws, arg) => {
  const node = {
    kind: "node",
    id: ws.newId("node"),
    definitionId: "lib:definition:text",
    children: [],
    props: { children: { kind: "set", value: "Pick any" } },
    visual: {},
    sizing: {},
    descendantOverrides: [],
  };
  return c.insertNodes({
    parent: { kind: "node", id: arg },
    entries: [node],
    rootIds: [node.id],
    newId: ws.newId,
  });
}, tagGroup);
const afterText = await tagsView();
record(
  "H1 a free Text in the TagGroup renders (Preview)",
  inserted.ok && afterText.texts.includes("Pick any"),
  {
    inserted,
    texts: afterText.texts,
    canvasChildren: afterText.canvasChildren,
  },
);
await exec((c, ws, arg) => {
  const group = [...ws.root.canvasInputs.values()].find(
    (x) => x.sourceId === arg,
  );
  const label = group.children
    .map((id) => ws.root.canvasInputs.get(id))
    .find((x) => ws.root.typeOf(x) === "Label");
  return c.removeTargets({ targets: [ws.positionOfRecord(label.id).target] });
}, tagGroup);
const afterDelete = await tagsView();
record(
  "H1 a deleted Label stays deleted (Canvas · Preview)",
  !afterDelete.canvasChildren.includes("Label") &&
    afterDelete.labels.length === 0,
  { labels: afterDelete.labels, canvasChildren: afterDelete.canvasChildren },
);
await page.screenshot({ path: `${OUT}/taggroup.png` });

// maxRows 2 (the origin's) in a narrow TagGroup: the mirror counts rows, Show all expands
await exec((c, ws, arg) => {
  const r = [...ws.root.canvasInputs.values()].find((x) => x.sourceId === arg);
  return c.setFields({
    targets: [ws.positionOfRecord(r.id).target],
    sizing: { width: { kind: "set", value: 140 } },
    visual: { width: { kind: "remove" } },
  });
}, tagGroup);
await page.waitForTimeout(1200);
const rows = () =>
  preview((doc) => {
    const list = doc.querySelector(".react-aria-TagGroup .tag-list-wrapper");
    const chips = [...list.querySelectorAll('[role="row"]')];
    return {
      width: Math.round(list.getBoundingClientRect().width),
      chips: chips.length,
      rows: new Set(
        chips.map((chip) => Math.round(chip.getBoundingClientRect().top)),
      ).size,
      button: list.querySelector(".tag-show-all-btn")?.textContent ?? null,
    };
  });
const collapsed = await rows();
await press(".react-aria-TagGroup .tag-show-all-btn");
const expanded = await rows();
record(
  "H1 maxRows 2: the narrow list shows two rows and Show all, which shows every Tag",
  collapsed.rows <= 2 &&
    collapsed.chips < 4 &&
    collapsed.button === "Show all (4)" &&
    expanded.chips === 4 &&
    expanded.button === "Show less",
  { collapsed, expanded },
);

// ── reload: the same
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
const reloaded = {};
for (const [, groupType] of groups)
  reloaded[groupType] = await toggleState(wrapped[groupType]);
const tagsReloaded = await tagsView();
record(
  "reload: the wrapped items stay selected · the TagGroup keeps its order, Text and no Label",
  Object.values(reloaded).every((s) => s.canvas && s.preview) &&
    tagsReloaded.labels.length === 0 &&
    tagsReloaded.texts.includes("Pick any"),
  {
    reloaded,
    tags: {
      labels: tagsReloaded.labels,
      texts: tagsReloaded.texts,
      previewChildren: tagsReloaded.previewChildren,
    },
  },
);
record("no errors", errors.length === 0, { errors: errors.slice(0, 6) });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
