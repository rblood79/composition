#!/usr/bin/env node
// S2 Tabs live (2026-11-23) — 원래 있던 테스트 실패 정리에서 나온 Tabs 동작 3:
//   1. Publish: 탭 글자 hover 색 = S2 `baseColor` 한 단 위 — 선택 안 된 탭 gray-800 (41) · 선택된 탭 gray-900 (19)
//   2. Publish: TabPanel `min-height: 0px` (S2 `tabPanel` — 생성기가 0 을 버리던 것)
//   3. Builder: Tabs 를 고르면 Layout 의 Display 토글이 `orientation` 번역이 아니다 — Grid 가 켜져 있고
//      Column 을 누르면 Tabs 의 `orientation` 은 그대로, style 의 flexDirection 이 column
//   4. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-tabs-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/s2-tabs-live";
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
  viewport: { width: 1920, height: 1000 },
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("tabs live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    {
      timeout: 30000,
    },
  );
  await page.waitForTimeout(1500);

  const tabs = await page.evaluate(() => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const r = ws.root;
    const ctx = {
      graph: ws.runtime.graph,
      records: ws.root.domInputs,
      selection: () => [],
      itemOfRecord: (i) => ws.itemOfRecord(i),
      pageContent: () => ({ kind: "node", id: "project:node:home-body" }),
      newId: ws.newId,
    };
    ws.execute(h.palette.catalogPaletteInsertPlan(ctx, "Tabs").command);
    const record = [...r.canvasInputs.values()].find(
      (x) => r.typeOf(x) === "Tabs",
    );
    return { id: record.id, source: record.sourceId };
  });
  await page.waitForTimeout(800);

  // 3. the Display toggle of a selected Tabs
  await page.evaluate(
    (id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]),
    tabs.id,
  );
  await page.waitForTimeout(800);
  // (the right panel starts closed — open Design)
  const railLabels = await page.evaluate(() =>
    [...document.querySelectorAll("button[aria-label]")].map((b) =>
      b.getAttribute("aria-label"),
    ),
  );
  const design = railLabels.find((l) =>
    /^(Design|디자인|Styles|스타일)$/i.test(l ?? ""),
  );
  if (design)
    await page.locator(`button[aria-label="${design}"]`).first().click();
  await page.waitForTimeout(1000);
  // (the Design panel's second tab = Layout)
  await page.locator("[role=tab]").nth(1).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/1-builder-tabs-selected.png` });
  const group = page
    .locator(
      ".layout-direction .flex-direction [role=radiogroup], .layout-direction .flex-direction [role=group]",
    )
    .first();
  await group.waitFor({ timeout: 15000 });
  const buttons = group.locator("button");
  const before = await page.evaluate((source) => {
    const g = window.__COMPOSITION_CATALOG__.workspace.runtime.graph;
    const e = g.getEntry(source);
    return {
      orientation: e.props?.orientation,
      flexDirection: e.layout?.flexDirection ?? e.style?.flexDirection,
    };
  }, tabs.source);
  const gridDisabled = await buttons
    .nth(0)
    .evaluate(
      (b) =>
        b.hasAttribute("disabled") ||
        b.getAttribute("data-disabled") !== null ||
        b.getAttribute("aria-disabled") === "true",
    );
  // (a Tabs is a flex column by default — Column is on; Row turns it to row)
  await buttons.nth(1).click();
  await page.waitForTimeout(600);
  const after = await page.evaluate((source) => {
    const g = window.__COMPOSITION_CATALOG__.workspace.runtime.graph;
    const e = g.getEntry(source);
    return {
      orientation: e.props?.orientation,
      entry: JSON.stringify({
        props: e.props,
        layout: e.layout,
        visual: e.visual,
        style: e.style,
      }),
    };
  }, tabs.source);
  await page.screenshot({ path: `${OUT}/2-builder-tabs-column.png` });
  record(
    "3. Tabs Display 토글 — Grid 켜짐 · Row 가 orientation 을 바꾸지 않고 flexDirection row",
    !gridDisabled &&
      after.orientation === before.orientation &&
      /"flexDirection":\{"kind":"set","value":"row"\}/.test(after.entry),
    { gridDisabled, before, after },
  );
  // (put it back — the Publish checks read the default Tabs)
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.undo());
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectRecords([]),
  );
  await page.waitForTimeout(600);

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
  await pub.bringToFront();
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector(".react-aria-Tab", { timeout: 60000 });
  await pub.waitForTimeout(1200);

  const colorOf = (i) =>
    pub.evaluate(
      (i) =>
        getComputedStyle(document.querySelectorAll(".react-aria-Tab")[i]).color,
      i,
    );
  const selectedIndex = await pub.evaluate(() =>
    [...document.querySelectorAll(".react-aria-Tab")].findIndex((t) =>
      t.hasAttribute("data-selected"),
    ),
  );
  const otherIndex = selectedIndex === 0 ? 1 : 0;
  await pub.mouse.move(900, 900);
  await pub.waitForTimeout(300);
  const rest = {
    selected: await colorOf(selectedIndex),
    other: await colorOf(otherIndex),
  };
  const hover = {};
  for (const [key, index] of [
    ["selected", selectedIndex],
    ["other", otherIndex],
  ]) {
    await pub.locator(".react-aria-Tab").nth(index).hover();
    await pub.waitForTimeout(300);
    hover[key] = await colorOf(index);
    const hovered = await pub.evaluate(
      (i) =>
        document
          .querySelectorAll(".react-aria-Tab")
          [i].hasAttribute("data-hovered"),
      index,
    );
    hover[`${key}Hovered`] = hovered;
    await pub.screenshot({ path: `${OUT}/3-publish-hover-${key}.png` });
  }
  await pub.mouse.move(900, 900);
  record(
    "1. Publish 탭 hover 색 — 선택 안 됨 rgb(41) · 선택 rgb(19) (휴지 = 80 · 41)",
    hover.otherHovered &&
      hover.selectedHovered &&
      rest.other === "rgb(80, 80, 80)" &&
      rest.selected === "rgb(41, 41, 41)" &&
      hover.other === "rgb(41, 41, 41)" &&
      hover.selected === "rgb(19, 19, 19)",
    { rest, hover },
  );
  const panel = await pub.evaluate(() =>
    [...document.querySelectorAll(".react-aria-TabPanel")].map(
      (p) => getComputedStyle(p).minHeight,
    ),
  );
  record(
    "2. Publish TabPanel min-height 0px",
    panel.length > 0 && panel.every((v) => v === "0px"),
    { panel },
  );
} catch (e) {
  record("run", false, { error: String(e?.stack ?? e) });
} finally {
  record("4. page error 0", errors.length === 0, { errors });
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
  const failed = results.filter((r) => !r.pass).length;
  process.stdout.write(`\n${results.length - failed}/${results.length} PASS\n`);
  process.exit(failed ? 1 : 0);
}
