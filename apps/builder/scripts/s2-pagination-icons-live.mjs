#!/usr/bin/env node
// Pagination 「Icons only」 버튼 이름 live (2026-11-23, S2 체크리스트 §4.1 Pagination 남은 항목):
//   Controls = Icons only 일 때 Previous · Next 는 화살표만 그리고 글자는 버튼 이름 (`aria-label`) 이다.
//   원본 안 버튼은 metadata 편집 대상이 아니므로 이름은 그 버튼의 Label 칸이 정본 — 글자를 바꾸면 이름이 따라간다.
//   1. Canvas: Icons only 의 Previous · Next 안 글자 Text 가 그려지지 않는다
//   2. Publish: 두 버튼에 보이는 글자가 없고 이름이 「이전」 (Label 칸에서 고친 값) · 「Next」
//   3. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-pagination-icons-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/s2-pagination-icons-live";
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
  viewport: { width: 1600, height: 900 },
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

try {
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /new project/i }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type("pagination icons live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
    timeout: 30000,
  });
  await page.waitForTimeout(1500);

  const placed = await page.evaluate(() => {
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
    ws.execute(h.palette.catalogPaletteInsertPlan(ctx, "Pagination").command);
    const pagination = [...r.canvasInputs.values()].find((x) => r.typeOf(x) === "Pagination");
    ws.execute(
      h.commands.setFields({
        targets: [{ kind: "node", id: pagination.sourceId }],
        props: { controls: { kind: "set", value: "iconsOnly" } },
      }),
    );
    // Previous = the first ActionButton under the nav frame (its Label field is the name)
    const buttons = () =>
      [...r.canvasInputs.values()].filter((x) => {
        if (r.typeOf(x) !== "ActionButton") return false;
        const parent = r.canvasInputs.get(x.parentId);
        return parent && r.typeOf(parent) === "frame";
      });
    const previous = buttons()[0];
    ws.execute(
      h.commands.setFields({
        targets: [ws.itemOfRecord(previous.id).target],
        props: { label: { kind: "set", value: "이전" } },
      }),
    );
    ws.selectRecords([]);
    return { pagination: pagination.id };
  });
  await page.waitForTimeout(800);

  const canvas = await page.evaluate(() => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    const steps = [...r.canvasInputs.values()].filter((x) => {
      if (r.typeOf(x) !== "ActionButton") return false;
      const parent = r.canvasInputs.get(x.parentId);
      return parent && r.typeOf(parent) === "frame";
    });
    return steps.map((b) => ({
      ariaLabel: b.props["aria-label"],
      shownTexts: b.children
        .map((id) => r.canvasInputs.get(id))
        .filter((c) => c && r.typeOf(c) === "Text" && c.hidden !== true)
        .map((c) => c.props.children),
      icons: b.children
        .map((id) => r.canvasInputs.get(id))
        .filter((c) => c && r.typeOf(c) === "Icon" && c.hidden !== true).length,
    }));
  });
  await page.evaluate((id) => {
    const h = window.__COMPOSITION_CATALOG__;
    const b = h.canvas.boundsOf(id);
    h.canvas.setCamera({ scale: 1, x: 80 - b.x, y: 200 - b.y });
  }, placed.pagination);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/1-canvas.png` });
  record(
    "1. Canvas — Icons only 의 Previous · Next 는 아이콘만 (보이는 Text 0)",
    canvas.length === 2 && canvas.every((b) => b.shownTexts.length === 0 && b.icons === 1),
    { canvas },
  );

  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => ["Preview", "미리보기"].includes(b.getAttribute("aria-label")))
      ?.click(),
  );
  const pub = await popup;
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector("nav[aria-label] button", { timeout: 60000 });
  await pub.waitForTimeout(1200);
  await pub.screenshot({ path: `${OUT}/2-publish.png` });
  const steps = await pub.evaluate(() => {
    const nav = document.querySelector("nav[aria-label]");
    const all = [...nav.querySelectorAll("button")];
    return [all[0], all[all.length - 1]].map((b) => ({
      ariaLabel: b.getAttribute("aria-label"),
      text: b.innerText.trim(),
      svg: b.querySelectorAll("svg").length,
    }));
  });
  const named = await pub.evaluate(async () => {
    const nav = document.querySelector("nav[aria-label]");
    const all = [...nav.querySelectorAll("button")];
    return [all[0], all[all.length - 1]].map((b) => b.getAttribute("aria-label"));
  });
  record(
    "2. Publish — 보이는 글자 없음 · 이름 「이전」 · 「Next」",
    steps.every((s) => s.text === "" && s.svg >= 1) && named[0] === "이전" && named[1] === "Next",
    { steps },
  );
  // the accessibility tree's name (what a screen reader reads)
  const tree = await pub.accessibility?.snapshot?.().catch(() => undefined);
  if (tree) writeFileSync(`${OUT}/a11y.json`, JSON.stringify(tree, null, 2));
} catch (e) {
  record("run", false, { error: String(e?.stack ?? e) });
} finally {
  record("3. page error 0", errors.length === 0, { errors });
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
  const failed = results.filter((r) => !r.pass).length;
  process.stdout.write(`\n${results.length - failed}/${results.length} PASS\n`);
  process.exit(failed ? 1 : 0);
}
