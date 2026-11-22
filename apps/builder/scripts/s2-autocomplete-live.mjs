#!/usr/bin/env node
// S2 체크리스트 §4.1 Autocomplete live (2026-11-22) — S2 Autocomplete 예제 (`SearchField aria-label` +
// 목록 `marginTop: 8`) 대로: 검색에 보이는 라벨이 없고 (이름은 aria-label), 목록이 검색 아래 8 — Canvas 와
// Publish 가 같은가 (headed Chrome, 실제 Builder + Publish).
//   ① Canvas — 검색의 라벨 행 숨김 · 검색 높이 32 · 목록 = 검색 아래 8
//   ② Publish DOM — label 요소 없음 · input aria-label · 목록 = 검색 아래 8 · 검색 높이 같음
//   ③ Publish — 입력이 목록을 거른다 (Autocomplete 동작 그대로)
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-autocomplete-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/s2-autocomplete-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1200)}\n`,
  );
};

const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1400, height: 800 },
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
  await page.keyboard.type("S2 autocomplete live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  const canvas = await page.evaluate(() => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const ctx = () => ({
      graph: ws.runtime.graph,
      records: ws.root.domInputs,
      selection: () => ws.session.getSnapshot().selection,
      itemOfRecord: (i) => ws.itemOfRecord(i),
      pageContent: () => ({ kind: "node", id: "project:node:home-body" }),
      newId: ws.newId,
    });
    ws.selectRecords([]);
    ws.execute(
      h.palette.catalogPaletteInsertPlan(ctx(), "Autocomplete").command,
    );
    const root = ws.root;
    const of = (type) =>
      [...root.canvasInputs.values()].find((r) => root.typeOf(r) === type);
    const geo = (id) => root.getGeometry([id]).get(id);
    const search = of("SearchField");
    const labelRow = search.children
      .map((c) => root.canvasInputs.get(c))
      .find((r) => root.typeOf(r) === "FieldLabel");
    const sg = geo(search.id);
    const lg = geo(of("ListBox").id);
    return {
      labelRowHidden: labelRow?.hidden === true,
      searchHeight: sg.height,
      gap: lg.y - (sg.y + sg.height),
    };
  });
  record(
    "① Canvas — no label row · search 32 · list 8 below",
    canvas.labelRowHidden && canvas.searchHeight === 32 && canvas.gap === 8,
    canvas,
  );
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/1-canvas.png` });

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
  await pub.waitForURL((url) => String(url) !== "about:blank", {
    timeout: 30000,
  });
  await pub.waitForSelector(".react-aria-SearchField input", {
    timeout: 60000,
  });
  await pub.waitForTimeout(800);
  const dom = await pub.evaluate(() => {
    const field = document.querySelector(".react-aria-SearchField");
    const input = field.querySelector("input");
    const fr = field.getBoundingClientRect();
    const lr = document
      .querySelector(".react-aria-ListBox")
      .getBoundingClientRect();
    return {
      label: !!field.querySelector(".react-aria-Label"),
      ariaLabel: input.getAttribute("aria-label"),
      labelledby: input.getAttribute("aria-labelledby"),
      searchHeight: fr.height,
      gap: Math.round((lr.top - fr.bottom) * 100) / 100,
    };
  });
  record(
    "② Publish DOM — no label element · aria-label · same search height · list 8 below",
    !dom.label &&
      dom.ariaLabel === "Search items" &&
      !dom.labelledby &&
      Math.abs(dom.searchHeight - canvas.searchHeight) < 0.5 &&
      Math.abs(dom.gap - canvas.gap) < 0.5,
    { dom, canvas },
  );
  await pub.screenshot({ path: `${OUT}/2-publish.png` });
  await pub.locator(".react-aria-SearchField input").fill("ar");
  await pub.waitForTimeout(400);
  const filtered = await pub.evaluate(() =>
    [...document.querySelectorAll(".react-aria-ListBoxItem")].map((item) =>
      item.querySelector('[slot="label"]')?.textContent?.trim(),
    ),
  );
  record(
    "③ Publish — typing filters the list",
    filtered.length > 0 && filtered.every((t) => /ar/i.test(t)),
    filtered,
  );
  await pub.screenshot({ path: `${OUT}/3-filtered.png` });
  record("no page errors", errors.length === 0, errors);
} finally {
  writeFileSync(
    `${OUT}/result.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
  process.stdout.write(
    `errors ${errors.length}: ${errors.slice(0, 5).join(" | ")}\n`,
  );
  await browser.close();
}
