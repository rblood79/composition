#!/usr/bin/env node
// ADR-326 후속 live — 원본 (reui Cascader) 정렬 「가벼운 쪽」 (사용자 결정 2026-11-29). 실제 Builder 에서
// Cascader 를 놓고 (방식을 쓰지 않는다) Preview 에서 눌러 연다. 기대값은 이 파일에 적은 값이다.
//   1 기본 방식 = drill — 놓은 Cascader 의 mode · Preview 의 목록 = GridList (한 단계)
//   2 맨 위 단계 — 경로 줄 없음 · 「뒤로」 안 보임 · 검색 칸이 머리줄 폭 · 가지 행에 자식 수 (2 · 2 · 없음)
//   3 검색 = 현재 단계 — 「cl」 → Clothing 만 (깊은 항목 없음), 들어가면 검색어 비움
//   4 단계 안 — 「뒤로」 가 검색 칸과 한 줄 (왼쪽) · 경로 줄 = 단계 이름 · 「뒤로」 → 맨 위
//   4b 키보드 — 검색 칸에서 Tab 이 그 단계 목록으로 · Enter 가 고른다
//   5 searchScope global — 「lap」 → 경로와 함께 한 목록 (전 단계)
//   6 Canvas = Preview — Open 을 켠 Canvas 의 머리줄 · 자식 수 자리 (G5 하니스가 방식 × 크기 전체를 잰다)
//   console error 0 · page error 0
//
//   BROWSER=webkit BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr326-reference-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, webkit } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr326-reference-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const HEADLESS = process.argv.includes("--headless");
const WEBKIT = process.env.BROWSER === "webkit";
const NAME = WEBKIT ? "webkit" : "chrome";
const COMMANDS = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} [${NAME}] ${id} — ${JSON.stringify(detail).slice(0, 900)}\n`,
  );
};
const state = JSON.parse(
  readFileSync(
    process.env.AUTH_STATE ?? `${REPO}/apps/builder/scripts/.auth-session.json`,
    "utf8",
  ),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = WEBKIT
  ? await webkit.launch({ headless: HEADLESS })
  : await chromium.launch({ headless: HEADLESS, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
const errors = [];
const consoleErrors = [];
const watch = (p, who) => {
  p.on("pageerror", (e) => errors.push(`${who}: ${e.message}`));
  p.on("console", (m) => {
    if (m.type() === "error" && !/favicon\.ico/.test(m.location()?.url ?? ""))
      consoleErrors.push(`${who}: ${m.text().slice(0, 200)}`);
  });
};
const page = await context.newPage();
watch(page, "builder");
const settle = (p, ms = 300) => p.waitForTimeout(ms);
const near = (a, b) => Math.abs(a - b) <= 1;

/** The open box in the Preview: rows (name · count), the head row, the trail. */
const domView = (p) =>
  p.evaluate(() => {
    const pop = document.querySelector('.react-aria-Popover[data-trigger="Cascader"]');
    if (!pop) return { open: false };
    const r = (el) => {
      const b = el.getBoundingClientRect();
      return [b.x, b.y, b.width, b.height].map((v) => Math.round(v * 10) / 10);
    };
    const list = pop.querySelector(".react-aria-CascaderList");
    const back = pop.querySelector('[slot="back"]');
    const search = pop.querySelector(".react-aria-SearchField");
    const trail = pop.querySelector(".react-aria-Breadcrumbs");
    return {
      open: true,
      role: list?.getAttribute("role"),
      results: !!pop.querySelector("[data-cascader-results]"),
      box: r(pop),
      rows: [...(list?.querySelectorAll(".react-aria-CascaderItem") ?? [])].map((row) => ({
        name: row.querySelector('[slot="label"]')?.textContent ?? row.textContent,
        count: row.querySelector('[slot="count"]')?.textContent ?? null,
        path: row.querySelector('[slot="description"]')?.textContent ?? null,
      })),
      back: back && getComputedStyle(back).display !== "none" ? r(back) : null,
      search: search ? r(search) : null,
      query: search?.querySelector("input")?.value,
      trail: trail && getComputedStyle(trail).display !== "none" ? trail.textContent : null,
      list: list ? r(list) : null,
    };
  });

try {
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /new project/i }).first().click();
  await settle(page);
  await page.keyboard.type(`adr326 reference live ${NAME}`);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.canvas, null, {
    timeout: 30000,
  });
  await settle(page, 1500);
  const rail = railButton(page, "components");
  if ((await rail.getAttribute("aria-pressed")) === "true") {
    await rail.click();
    await settle(page, 600);
  }
  // (A Cascader as the palette places it — no mode written.)
  const placed = await page.evaluate(
    async ({ COMMANDS }) => {
      const c = await import(COMMANDS);
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
      ws.execute(h.palette.catalogPaletteInsertPlan(ctx, "Cascader").command);
      const field = [...r.canvasInputs.values()].find((x) => r.typeOf(x) === "Cascader");
      ws.execute(
        c.setFields({
          targets: [ws.itemOfRecord(field.id).target],
          visual: { width: { kind: "set", value: 320 } },
        }),
      );
      return { mode: field.props.mode };
    },
    { COMMANDS },
  );
  await settle(page, 800);
  record("1 놓은 Cascader 의 방식 = drill (쓰지 않은 기본)", placed.mode === "drill", placed);

  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => ["Preview", "미리보기"].includes(b.getAttribute("aria-label")))
      ?.click(),
  );
  const pub = await popup;
  watch(pub, "publish");
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector(".react-aria-Cascader button", { timeout: 60000 });
  await settle(pub, 800);
  await pub.locator(".react-aria-Cascader button").first().click();
  await pub.waitForSelector('.react-aria-Popover[data-trigger="Cascader"]', { timeout: 30000 });
  await settle(pub, 700);
  const top = await domView(pub);
  await pub.screenshot({ path: `${OUT}/${NAME}-1-top.png` });
  record(
    "2 맨 위 단계 — 한 단계 목록 (grid) · 경로 줄 · 「뒤로」 없음 · 검색 칸 = 머리줄 폭 · 자식 수",
    top.role === "grid" &&
      JSON.stringify(top.rows.map((r) => [r.name, r.count])) ===
        '[["Electronics","2"],["Clothing","2"],["Books",null]]' &&
      top.trail === null &&
      top.back === null &&
      near(top.search[0], top.list[0]) &&
      near(top.search[2], top.list[2]),
    top,
  );

  await pub.keyboard.type("cl");
  await settle(pub, 500);
  const narrowed = await domView(pub);
  await pub.screenshot({ path: `${OUT}/${NAME}-2-level-search.png` });
  record(
    "3 검색 = 현재 단계 — 「cl」 → Clothing 만 · 한 목록 결과가 아니다",
    JSON.stringify(narrowed.rows.map((r) => r.name)) === '["Clothing"]' &&
      !narrowed.results &&
      narrowed.role === "grid",
    narrowed,
  );
  await pub.locator('.react-aria-CascaderList .react-aria-CascaderItem').first().click();
  await settle(pub, 600);
  const inside = await domView(pub);
  await pub.screenshot({ path: `${OUT}/${NAME}-3-level.png` });
  record(
    "4 단계 안 — 검색어 비움 · 「뒤로」 가 검색 칸 왼쪽 한 줄 · 경로 줄 = Clothing · 행 = Men · Women",
    inside.query === "" &&
      JSON.stringify(inside.rows.map((r) => r.name)) === '["Men","Women"]' &&
      inside.trail === "Clothing" &&
      !!inside.back &&
      // (One row: the two boxes' centres on one line, 「Back」 before the search box.)
      near(inside.back[1] + inside.back[3] / 2, inside.search[1] + inside.search[3] / 2) &&
      inside.back[0] + inside.back[2] <= inside.search[0] &&
      near(inside.search[0] + inside.search[2], inside.list[0] + inside.list[2]),
    inside,
  );
  await pub.locator('.react-aria-Popover[data-trigger="Cascader"] [slot="back"]').click();
  await settle(pub, 600);
  const up = await domView(pub);
  record(
    "4 「뒤로」 → 맨 위 단계 (경로 줄 · 「뒤로」 다시 없음)",
    JSON.stringify(up.rows.map((r) => r.name)) === '["Electronics","Clothing","Books"]' &&
      up.trail === null &&
      up.back === null,
    up,
  );
  // 4b — the keyboard: Tab goes from the search box to the level's list, Enter picks its row (↓ in
  //  the search box is not RAC GridList's — 판독 1 #4).
  await pub.locator('.react-aria-Popover[data-trigger="Cascader"] .react-aria-SearchField input').click();
  await pub.keyboard.type("book");
  await settle(pub, 400);
  await pub.keyboard.press("Tab");
  await settle(pub, 200);
  const focused = await pub.evaluate(
    () => document.activeElement?.querySelector('[slot="label"]')?.textContent ?? null,
  );
  await pub.keyboard.press("Enter");
  await settle(pub, 500);
  const after = await pub.evaluate(() => ({
    open: !!document.querySelector('.react-aria-Popover[data-trigger="Cascader"]'),
    value: document.querySelector(".react-aria-Cascader .react-aria-SelectValue")?.textContent ?? null,
  }));
  record(
    "4b 키보드 — 「book」 Tab 이 Books 행으로 · Enter 가 고르고 닫는다",
    focused === "Books" && !after.open && after.value === "Books",
    { focused, after },
  );
  await pub.close();

  // 5 — searchScope global: the flat results with their paths.
  await page.evaluate(
    async ({ COMMANDS }) => {
      const c = await import(COMMANDS);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const field = [...ws.root.domInputs.values()].find((r) => ws.root.typeOf(r) === "Cascader");
      ws.execute(
        c.setFields({
          targets: [ws.itemOfRecord(field.id).target],
          props: { searchScope: { kind: "set", value: "global" } },
        }),
      );
    },
    { COMMANDS },
  );
  await settle(page, 600);
  const popup2 = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => ["Preview", "미리보기"].includes(b.getAttribute("aria-label")))
      ?.click(),
  );
  const pub2 = await popup2;
  watch(pub2, "publish");
  await pub2.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub2.waitForSelector(".react-aria-Cascader button", { timeout: 60000 });
  await settle(pub2, 800);
  await pub2.locator(".react-aria-Cascader button").first().click();
  await pub2.waitForSelector('.react-aria-Popover[data-trigger="Cascader"]', { timeout: 30000 });
  await settle(pub2, 700);
  await pub2.keyboard.type("lap");
  await settle(pub2, 500);
  const global = await domView(pub2);
  await pub2.screenshot({ path: `${OUT}/${NAME}-4-global.png` });
  record(
    "5 searchScope global — 「lap」 → Laptops + 경로 (전 단계의 한 목록)",
    global.results &&
      JSON.stringify(global.rows.map((r) => [r.name, r.path])) ===
        '[["Laptops","Electronics / Computers / Laptops"]]',
    global,
  );
  await pub2.close();
} catch (error) {
  record("harness", false, { error: String(error?.stack ?? error) });
} finally {
  const KNOWN = /Invalid value for <circle> attribute r="calc\(/;
  const other = consoleErrors.filter((e) => !KNOWN.test(e));
  record("console error 0 · page error 0", !errors.length && !other.length, {
    errors,
    consoleErrors: other,
    known: consoleErrors.length - other.length,
  });
  writeFileSync(`${OUT}/${NAME}.json`, JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.pass).length;
  process.stdout.write(`\n[${NAME}] ${failed ? `FAIL ${failed}` : `ALL PASS ${results.length}`}\n`);
  await browser.close();
  process.exit(failed ? 1 : 0);
}
