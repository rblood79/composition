#!/usr/bin/env node
// Table pinned edge live (2026-11-25): a pinned column's edge line (the Column · Cell rule's derived
// `pinned-edge` 1px) is in the box the Canvas engine lays the header's content in, as the DOM's border.
//   1. Components 패널 「table」 → 마지막 data Column 에 MenuItem 넣기 (메뉴 열 — 머리글 내용 = 메뉴
//      Button, 엔진이 놓는 자식) · `defaultPinned: end`, 첫 data Column 은 `defaultPinned: start`
//   2. Canvas: 각 고정 열의 머리글 자식 x (부모 기준 rect) / Publish: 같은 열 `th` 안 메뉴 버튼 (또는 첫 자식) x − th x
//      → 두 값이 0.5px 안 (end 쪽 열은 DOM border-left 1px 만큼 들어간다)
//   3. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/table-pinned-edge-live.mjs <out-dir>
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/table-pinned-edge-live";
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

const place = async (label) => {
  const components = railButton(page, "components");
  if ((await components.getAttribute("aria-pressed")) !== "true") {
    await components.click();
    await page.waitForTimeout(900);
  }
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
  );
  const item = page
    .locator("button, [role='button'], [role='option'], [role='gridcell']")
    .filter({ hasText: label })
    .first();
  await item.waitFor({ state: "visible", timeout: 15000 });
  await item.click();
  await page.waitForTimeout(1500);
};

const openDesign = async () => {
  const components = railButton(page, "components");
  if ((await components.getAttribute("aria-pressed")) === "true") {
    await components.click();
    await page.waitForTimeout(600);
  }
  const design = railButton(page, "properties");
  if ((await design.getAttribute("aria-pressed")) !== "true") {
    await design.click();
    await page.waitForTimeout(900);
  }
  await page.waitForTimeout(800);
};

const field = (label) =>
  page
    .locator(".panel-wrapper[data-panel='properties'] fieldset", {
      has: page.locator("legend", { hasText: label }),
    })
    .first();

/** The first record of `type` (its edit target) — and a write of `props` to it, one command. */
const write = (type, props) =>
  page.evaluate(
    ({ type, props }) => {
      const { workspace: ws, commands: c } = window.__COMPOSITION_CATALOG__;
      const r = ws.root;
      const record = [...r.canvasInputs.values()]
        .filter((x) => r.typeOf(x) === type)
        .at(-1);
      if (Object.keys(props).length)
        ws.execute(
          c.setFields({
            targets: [ws.itemOfRecord(record.id).target],
            props: Object.fromEntries(
              Object.entries(props).map(([k, v]) => [
                k,
                { kind: "set", value: v },
              ]),
            ),
          }),
        );
      return record.id;
    },
    { type, props },
  );

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("table pinned edge live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);
  await place(/^table$/i);
  const setup = await page.evaluate(() => {
    const { workspace: ws, commands: c } = window.__COMPOSITION_CATALOG__;
    const r = ws.root;
    const columns = [...r.canvasInputs.values()].filter(
      (x) =>
        r.typeOf(x) === "Column" &&
        typeof x.props.children === "string" &&
        x.props.children !== "",
    );
    const first = ws.itemOfRecord(columns[0].id).target;
    const last = ws.itemOfRecord(columns.at(-1).id).target;
    if (first.kind !== "node" || last.kind !== "node")
      return { error: "column not owned" };
    const blank = { visual: {}, sizing: {}, descendantOverrides: [] };
    for (const [target, n] of [
      [first, 1],
      [last, 2],
    ])
      ws.execute(
        c.insertNodes({
          parent: { kind: "node", id: target.id },
          entries: [
            {
              kind: "node",
              id: `project:node:live-pin-item-${n}`,
              definitionId: "lib:definition:type-MenuItem",
              children: [`project:node:live-pin-text-${n}`],
              props: { id: { kind: "set", value: `export-${n}` } },
              ...blank,
            },
            {
              kind: "node",
              id: `project:node:live-pin-text-${n}`,
              definitionId: "lib:definition:text",
              children: [],
              props: { children: { kind: "set", value: "Export" } },
              ...blank,
            },
          ],
          rootIds: [`project:node:live-pin-item-${n}`],
          newId: ws.newId,
        }),
      );
    for (const [target, side] of [
      [first, "start"],
      [last, "end"],
    ])
      ws.execute(
        c.setFields({
          targets: [target],
          props: { defaultPinned: { kind: "set", value: side } },
        }),
      );
    return { first: first.id, last: last.id };
  });
  await page.waitForTimeout(1200);
  const canvas = await page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const r = ws.root;
    const out = {};
    for (const column of r.canvasInputs.values()) {
      if (r.typeOf(column) !== "Column") continue;
      const side = column.derivedProps?.pinnedEdge;
      if (side !== "start" && side !== "end") continue;
      const drawn = column.children
        .map((id) => r.canvasInputs.get(id))
        .filter((x) => x && r.typeOf(x) !== "MenuItem");
      const ids = [column.id, ...drawn.map((x) => x.id)];
      const geo = r.getGeometry(ids);
      const child = drawn
        .map((x) => geo.get(x.id))
        .find((g) => g && g.width > 0);
      out[side] = {
        name: column.props.children,
        input:
          JSON.parse(r.getAppliedLayoutInput(column.id) ?? "{}").borderLeft +
          " / " +
          JSON.parse(r.getAppliedLayoutInput(column.id) ?? "{}").borderRight,
        // (`getGeometry` rects are relative to the parent record — the child's x is its offset in the Column.)
        offset: child ? +child.x.toFixed(2) : null,
        childWidth: child ? +child.width.toFixed(2) : null,
      };
    }
    return out;
  });
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
  );
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/builder.png` });

  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) =>
        ["Preview", "미리보기"].includes(b.getAttribute("aria-label")),
      )
      ?.click(),
  );
  const pub = await popup;
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector('[role="columnheader"][data-pinned]', {
    timeout: 60000,
  });
  await pub.waitForTimeout(1000);
  const dom = await pub.evaluate(() => {
    const out = {};
    for (const th of document.querySelectorAll(
      '[role="columnheader"][data-pinned]',
    )) {
      const side = th.getAttribute("data-pinned");
      const child =
        th.querySelector(".catalog-column-menu-button") ?? th.firstElementChild;
      const a = th.getBoundingClientRect();
      const b = child?.getBoundingClientRect();
      const cs = getComputedStyle(th);
      out[side] = {
        name: th.textContent.trim(),
        border: `${cs.borderLeftWidth} / ${cs.borderRightWidth}`,
        offset: b ? +(b.left - a.left).toFixed(2) : null,
        childWidth: b ? +b.width.toFixed(2) : null,
      };
    }
    return out;
  });
  await pub.screenshot({ path: `${OUT}/publish.png` });
  for (const side of ["start", "end"]) {
    const a = canvas[side];
    const b = dom[side];
    record(
      `2 ${side} 고정 열: 머리글 내용 x (열 기준) Canvas = DOM (0.5px 안)`,
      !!a &&
        !!b &&
        a.offset !== null &&
        b.offset !== null &&
        Math.abs(a.offset - b.offset) <= 0.5 &&
        Math.abs(a.childWidth - b.childWidth) <= 0.5,
      { canvas: a, dom: b, setup },
    );
  }
} catch (error) {
  record("run", false, String(error?.stack ?? error));
  await page.screenshot({ path: `${OUT}/error.png` }).catch(() => {});
}

record("3 page error 0", errors.length === 0, errors);
await browser.close();
const failed = results.filter((r) => !r.pass);
process.stdout.write(
  `\n${results.length - failed.length}/${results.length} PASS\n`,
);
process.exit(failed.length ? 1 : 0);
