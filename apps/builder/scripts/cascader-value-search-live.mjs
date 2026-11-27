#!/usr/bin/env node
// Cascader 후속 live (사용자 요청 2026-11-28) — 실제 Builder 에서:
//   1. Design 패널 Value = 고를 수 있는 항목 드롭다운 (경로 이름) · 고르면 Canvas 값 글자 = 그 경로
//   2. Design 패널에 검색 스위치 (「Search items」) 없음
//   3. Preview 에서 세 방식 (columns · tree · drill) 모두 열면 검색 칸이 있다
//   4. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/cascader-value-search-live.mjs <out-dir>
import { mkdirSync, readFileSync } from "node:fs";
import { railButton } from "./railButton.mjs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/cascader-value-search-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const HEADLESS = process.argv.includes("--headless");

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 900)}\n`,
  );
};

const state = JSON.parse(
  readFileSync(
    process.env.AUTH_STATE ?? `${REPO}/apps/builder/scripts/.auth-session.json`,
    "utf8",
  ),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: HEADLESS, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));
const settle = (p, ms = 250) => p.waitForTimeout(ms);

try {
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /new project/i }).first().click();
  await settle(page, 300);
  await page.keyboard.type("cascader value search live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
    timeout: 30000,
  });
  await settle(page, 1500);

  const ids = await page.evaluate(() => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const r = ws.root;
    const c = h.commands;
    const ctx = {
      graph: ws.runtime.graph,
      records: ws.root.domInputs,
      selection: () => [],
      itemOfRecord: (i) => ws.itemOfRecord(i),
      pageContent: () => ({ kind: "node", id: "project:node:home-body" }),
      newId: ws.newId,
    };
    const add = (type) => {
      const before = new Set(r.canvasInputs.keys());
      ws.execute(h.palette.catalogPaletteInsertPlan(ctx, type).command);
      return [...r.canvasInputs.values()].find(
        (x) => r.typeOf(x) === type && !before.has(x.id),
      ).sourceId;
    };
    const set = (id, props) =>
      ws.execute(
        c.setFields({
          targets: [{ kind: "node", id }],
          props: Object.fromEntries(
            Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
          ),
        }),
      );
    const columns = add("Cascader");
    set(columns, { label: "Columns" });
    const tree = add("Cascader");
    set(tree, { label: "Tree", mode: "tree" });
    const drill = add("Cascader");
    set(drill, { label: "Drill", mode: "drill" });
    ws.selectItems([]);
    return { columns, tree, drill };
  });
  await settle(page, 1500);

  // 1 · 2. The Design panel's Value field.
  await page.evaluate((source) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const field = [...ws.root.canvasInputs.values()].find((x) => x.sourceId === source);
    ws.selectItems([ws.itemOfRecord(field.id)]);
  }, ids.columns);
  await settle(page, 600);
  const design = railButton(page, "properties");
  if ((await design.getAttribute("aria-pressed")) !== "true") {
    await design.click();
    await settle(page, 1200);
  }
  const valueField = page.locator("fieldset", {
    has: page.locator("legend", { hasText: /^(Value|값)$/ }),
  });
  await valueField.first().scrollIntoViewIfNeeded();
  const trigger = valueField.first().locator("button").first();
  await trigger.click();
  await settle(page, 500);
  const options = await page
    .locator('.react-aria-Popover [role="option"]')
    .allTextContents();
  await page.screenshot({ path: `${OUT}/panel-value-open.png` });
  await page
    .locator('.react-aria-Popover [role="option"]', { hasText: "Clothing / Men" })
    .first()
    .click();
  await settle(page, 600);
  const after = await page.evaluate((source) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const r = ws.root;
    const field = [...r.canvasInputs.values()].find((x) => x.sourceId === source);
    const value = [...r.canvasInputs.values()].find(
      (x) =>
        r.typeOf(x) === "SelectValue" &&
        x.derivedProps?._cascaderValue === true &&
        (() => {
          for (let up = r.canvasInputs.get(x.parentId); up; up = r.canvasInputs.get(up.parentId))
            if (up.id === field.id) return true;
          return false;
        })(),
    );
    return {
      defaultValue: field.props.defaultValue,
      canvasText: value?.derivedProps?.children,
    };
  }, ids.columns);
  const triggerText = await trigger.textContent();
  const panelText = await page.evaluate(() => document.body.innerText);
  record(
    "1 Value = 경로 드롭다운 · 고르면 시작 값 · Canvas 글자",
    options.length === 7 &&
      options.includes("Electronics / Computers / Laptops") &&
      options.includes("Books") &&
      after.defaultValue === "men" &&
      after.canvasText === "Clothing / Men" &&
      /Clothing \/ Men/.test(triggerText ?? ""),
    { options, after, triggerText },
  );
  record("2 검색 스위치 없음", !/Search items|항목 검색/.test(panelText), {});
  await page.screenshot({ path: `${OUT}/panel-value.png` });
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.selectItems([]));

  // 3. Preview: a search field in every mode.
  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => ["Preview", "미리보기"].includes(b.getAttribute("aria-label")))
      ?.click(),
  );
  const pub = await popup;
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector(".react-aria-Cascader button", { timeout: 60000 });
  await settle(pub, 1500);
  const found = {};
  for (const [n, name] of [
    [0, "columns"],
    [1, "tree"],
    [2, "drill"],
  ]) {
    await pub.locator(".react-aria-Cascader").nth(n).locator("button").first().click();
    await settle(pub, 700);
    found[name] = {
      search: await pub.locator('.react-aria-Popover input[type="search"]').count(),
      focused: await pub.evaluate(() => document.activeElement?.tagName),
    };
    await pub.screenshot({ path: `${OUT}/preview-${name}.png` });
    for (let i = 0; i < 4; i++) {
      if (!(await pub.locator('[role="menu"], [role="dialog"]').count())) break;
      await pub.keyboard.press("Escape");
      await settle(pub, 250);
    }
  }
  record(
    "3 Preview — 세 방식 모두 검색 칸 · 열면 검색 칸에 focus",
    Object.values(found).every((f) => f.search === 1 && f.focused === "INPUT"),
    found,
  );
} catch (error) {
  record("run", false, { error: String(error) });
} finally {
  record("4 page error 0", errors.length === 0, errors);
  await browser.close();
  const failed = results.filter((r) => !r.pass).length;
  process.stdout.write(`\n${results.length - failed} / ${results.length} PASS\n`);
  process.exit(failed ? 1 : 0);
}
