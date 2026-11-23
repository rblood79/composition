#!/usr/bin/env node
// S2 renderActionBar live (2026-11-23, S2 체크리스트 부록 D.3 2단계 — CardView · Table · Tree):
//   1. 세 목록의 넣기 목록 (Layers 「+」 · slot) 에 ActionBar 가 있고, 넣으면 목록의 직계 자식이 된다
//   2. Canvas: 선택이 없으면 막대가 보이지 않는다 (상자 없음)
//   3. Canvas: 선택 (모두) 을 주면 막대가 목록 아래쪽 8 안에 뜨고 개수 글자가 「All selected」 (한국어 「모두 선택됨」),
//      목록 아래 여백 = 막대 자리
//   4. Publish: 선택이 없으면 막대 없음 · S2 감싸개 (`.react-aria-ActionBarContainer`) 안에 목록과 막대
//   5. Publish: 항목을 눌러 고르면 막대가 나타나고 「1 selected」, 목록 아래 8 · 좌우 8 (Canvas 와 같은 자리 규칙)
//   6. Publish: 지우기 버튼 → 선택 0 · 막대 사라짐 / 다시 고른 뒤 Escape → 같다 (S2 키)
//   7. Undo: Builder 에서 넣기를 되돌리면 막대 노드가 없다
//   8. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-action-bar-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/s2-action-bar-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1500)}\n`,
  );
};

const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1920, height: 1100 },
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

const TYPES = ["CardView", "Table", "Tree"];
const close = (a, b, tolerance = 0.75) => Math.abs(a - b) <= tolerance;
// (The clear button's S2 name in the project's language.)
const CLEAR = ':is([aria-label="Clear selection"], [aria-label="선택 항목 지우기"])';

try {
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /new project/i }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type("action bar live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
    timeout: 30000,
  });
  await page.waitForTimeout(1500);

  // 1. Place the three collections, each with an ActionBar from its insert options.
  const placed = await page.evaluate(async (types) => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const r = ws.root;
    const slots = await import("/src/builder/catalogRuntime/slots.ts");
    const ctx = {
      graph: ws.runtime.graph,
      records: ws.root.domInputs,
      selection: () => [],
      itemOfRecord: (i) => ws.itemOfRecord(i),
      pageContent: () => ({ kind: "node", id: "project:node:home-body" }),
      newId: ws.newId,
    };
    const out = {};
    for (const type of types) {
      const before = new Set(r.canvasInputs.keys());
      ws.execute(h.palette.catalogPaletteInsertPlan(ctx, type).command);
      const record = [...r.canvasInputs.values()].find(
        (x) => r.typeOf(x) === type && !before.has(x.id),
      );
      const id = record.sourceId;
      const graph = ws.runtime.graph;
      const slot = slots.catalogSlotTarget(graph, { kind: "node", id });
      const target = slot ?? { kind: "node", id };
      const options = slots.catalogSlotInsertOptions(graph, target);
      const option = options.find((o) => o.label === "ActionBar");
      if (option)
        ws.execute(
          slot
            ? slots.catalogSlotCommands.fill(slot, option.definitionId, ws.newId)
            : slots.catalogSlotCommands.insert(target, option.definitionId, ws.newId),
        );
      const now = [...r.canvasInputs.values()].find((x) => x.sourceId === id);
      const bar = now.children
        .map((k) => r.canvasInputs.get(k))
        .find((x) => x && r.typeOf(x) === "ActionBar");
      out[type] = {
        id,
        record: now.id,
        offered: !!option,
        bar: bar?.id,
        hidden: bar?.hidden === true,
      };
    }
    return out;
  }, TYPES);
  record(
    "1 넣기 목록에 ActionBar · 목록의 직계 자식",
    TYPES.every((t) => placed[t].offered && placed[t].bar),
    placed,
  );
  record(
    "2 Canvas: 선택 없음 → 막대 숨김",
    TYPES.every((t) => placed[t].hidden),
    Object.fromEntries(TYPES.map((t) => [t, placed[t].hidden])),
  );

  // 3. Select all on each (multiple) — the Design panel's write, as a command.
  await page.evaluate(
    async ({ types, placed, repo }) => {
      const h = window.__COMPOSITION_CATALOG__;
      const ws = h.workspace;
      const { setFields } = await import(
        `/@fs${repo}/packages/shared/src/catalog/commands/index.ts`
      );
      ws.execute(
        setFields({
          targets: types.map((t) => ({ kind: "node", id: placed[t].id })),
          props: {
            selectionMode: { kind: "set", value: "multiple" },
            defaultSelectedKeys: { kind: "set", value: "all" },
          },
          label: "Edit properties",
        }),
      );
    },
    { types: TYPES, placed, repo: REPO },
  );
  await page.waitForTimeout(800);
  const shown = await page.evaluate(
    ({ types, placed }) => {
      const h = window.__COMPOSITION_CATALOG__;
      const r = h.workspace.root;
      const out = {};
      for (const t of types) {
        const box = h.canvas.boundsOf(placed[t].record);
        const bar = h.canvas.boundsOf(placed[t].bar);
        const barRecord = r.canvasInputs.get(placed[t].bar);
        const texts = [];
        const visit = (id) => {
          const x = r.canvasInputs.get(id);
          if (!x) return;
          if (r.typeOf(x) === "Text") texts.push(String(x.props.children ?? ""));
          x.children.forEach(visit);
        };
        visit(placed[t].bar);
        const style = r.getDrawnLayoutStyle(placed[t].record);
        out[t] = {
          hidden: barRecord.hidden === true,
          left: bar.x - box.x,
          right: box.x + box.width - (bar.x + bar.width),
          bottom: box.y + box.height - (bar.y + bar.height),
          width: bar.width,
          boxWidth: box.width,
          count: texts.find((s) => / selected$|선택됨$/.test(s)),
          paddingBottom: style?.paddingBottom,
        };
      }
      return out;
    },
    { types: TYPES, placed },
  );
  record(
    "3 Canvas: 선택 → 아래 8 · 좌우 8 (최대 960 가운데) · 「All selected」 · 아래 여백",
    TYPES.every((t) => {
      const s = shown[t];
      const room = s.boxWidth - 16;
      return (
        !s.hidden &&
        close(s.bottom, 8) &&
        close(s.width, Math.min(960, room)) &&
        close(s.left, 8 + (room - s.width) / 2) &&
        /^(All selected|모두 선택됨)$/.test(String(s.count)) &&
        /^\d+px$/.test(String(s.paddingBottom))
      );
    }),
    shown,
  );
  // (Back to nothing selected — the Publish starts there.)
  await page.evaluate(
    async ({ types, placed, repo }) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const { setFields } = await import(
        `/@fs${repo}/packages/shared/src/catalog/commands/index.ts`
      );
      ws.execute(
        setFields({
          targets: types.map((t) => ({ kind: "node", id: placed[t].id })),
          props: { defaultSelectedKeys: { kind: "set", value: [] } },
          label: "Edit properties",
        }),
      );
    },
    { types: TYPES, placed, repo: REPO },
  );
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/builder.png` });

  // 4 – 6. Publish.
  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => ["Preview", "미리보기"].includes(b.getAttribute("aria-label")))
      ?.click(),
  );
  const pub = await popup;
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  await pub.setViewportSize({ width: 1920, height: 1100 });
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector(".react-aria-ActionBarContainer", { timeout: 60000 });
  await pub.waitForTimeout(1500);
  const sel = (t) => `[data-catalog-id$="${placed[t].id}"]`;
  const initial = await pub.evaluate(
    ({ types, sels }) =>
      Object.fromEntries(
        types.map((t, i) => {
          const el = document.querySelector(sels[i]);
          const wrapper = el?.parentElement;
          return [
            t,
            {
              wrapped: !!wrapper?.classList.contains("react-aria-ActionBarContainer"),
              bar: !!wrapper?.querySelector(":scope > .react-aria-ActionBar"),
            },
          ];
        }),
      ),
    { types: TYPES, sels: TYPES.map(sel) },
  );
  record(
    "4 Publish: S2 감싸개 · 선택 없음 → 막대 없음",
    TYPES.every((t) => initial[t].wrapped && !initial[t].bar),
    initial,
  );

  const geometry = async (t) =>
    pub.evaluate((s) => {
      const el = document.querySelector(s);
      const wrapper = el.parentElement;
      const bar = wrapper.querySelector(":scope > .react-aria-ActionBar");
      const w = wrapper.getBoundingClientRect();
      const b = bar?.getBoundingClientRect();
      return b
        ? {
            left: b.left - w.left,
            right: w.right - b.right,
            bottom: w.bottom - b.bottom,
            width: b.width,
            boxWidth: w.width,
            text: bar.textContent,
            paddingBottom: getComputedStyle(el).paddingBottom,
          }
        : null;
    }, sel(t));
  const rowOf = {
    CardView: '[role="row"]',
    Table: '[role="row"]:not(:has([role="columnheader"]))',
    Tree: '[role="row"]',
  };
  const pressed = {};
  for (const t of TYPES) {
    await pub.locator(`${sel(t)} ${rowOf[t]}`).first().click();
    await pub.waitForTimeout(600);
    pressed[t] = await geometry(t);
  }
  await pub.screenshot({ path: `${OUT}/publish-selected.png` });
  record(
    "5 Publish: 누르면 막대 · 「1 selected」 · 아래 8 · 좌우 8 · 아래 여백",
    TYPES.every((t) => {
      const g = pressed[t];
      if (!g) return false;
      const room = g.boxWidth - 16;
      return (
        /1 selected|1개 선택됨/.test(g.text) &&
        close(g.bottom, 8) &&
        close(g.width, Math.min(960, room)) &&
        close(g.left, 8 + (room - g.width) / 2) &&
        g.paddingBottom !== "0px"
      );
    }),
    pressed,
  );

  const cleared = {};
  for (const t of TYPES) {
    await pub
      .locator(`${sel(t)} ~ .react-aria-ActionBar ${CLEAR}`)
      .click();
    await pub.waitForTimeout(600);
    const afterClear = await pub.evaluate(
      (s) => ({
        bar: !!document
          .querySelector(s)
          .parentElement.querySelector(":scope > .react-aria-ActionBar"),
        selected: document.querySelectorAll(`${s} [aria-selected="true"]`).length,
      }),
      sel(t),
    );
    // (Again, then Escape on the bar — S2's key.)
    await pub.locator(`${sel(t)} ${rowOf[t]}`).first().click();
    await pub.waitForTimeout(500);
    await pub
      .locator(`${sel(t)} ~ .react-aria-ActionBar ${CLEAR}`)
      .focus();
    await pub.keyboard.press("Escape");
    await pub.waitForTimeout(600);
    const afterEscape = await pub.evaluate(
      (s) => ({
        bar: !!document
          .querySelector(s)
          .parentElement.querySelector(":scope > .react-aria-ActionBar"),
        selected: document.querySelectorAll(`${s} [aria-selected="true"]`).length,
      }),
      sel(t),
    );
    cleared[t] = { afterClear, afterEscape };
  }
  record(
    "6 Publish: 지우기 · Escape → 선택 0 · 막대 사라짐",
    TYPES.every(
      (t) =>
        !cleared[t].afterClear.bar &&
        cleared[t].afterClear.selected === 0 &&
        !cleared[t].afterEscape.bar &&
        cleared[t].afterEscape.selected === 0,
    ),
    cleared,
  );
  await pub.close();

  // 7. Undo back past the selection edits and the last ActionBar insert (Tree's).
  await page.bringToFront();
  const undone = await page.evaluate(async (placed) => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    // (two selection edits, then the Tree's ActionBar)
    for (let i = 0; i < 3; i += 1) ws.undo();
    await new Promise((r) => setTimeout(r, 300));
    const r = ws.root;
    const tree = [...r.canvasInputs.values()].find((x) => x.sourceId === placed.Tree.id);
    return tree.children
      .map((k) => r.canvasInputs.get(k))
      .filter((x) => x && r.typeOf(x) === "ActionBar").length;
  }, placed);
  record("7 Undo: Tree 의 ActionBar 넣기를 되돌리면 없음", undone === 0, { undone });

  record("8 page error 0", errors.length === 0, errors);
} catch (error) {
  record("script", false, String(error?.stack ?? error));
} finally {
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
  const failed = results.filter((r) => !r.pass).length;
  process.stdout.write(`\n${results.length - failed}/${results.length} PASS\n`);
  process.exit(failed ? 1 : 0);
}
