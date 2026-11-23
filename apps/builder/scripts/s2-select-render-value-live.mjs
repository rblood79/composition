#!/usr/bin/env node
// S2 Picker renderValue live (2026-11-23, S2 체크리스트 §9.3 — 사용자 결정 「값 칸 template 노드」):
//   1. Design 패널: Select 의 「Fill slot」 (value) 로 Text 를 넣으면 SelectValue 의 자식 (fillSlot)
//   2. Layers 우클릭 「행 템플릿으로 사용」 → 그 Text 에 repeat
//   3. Canvas: 고른 것 없음 → 값 모양 숨김 · placeholder / 고르면 (cat) 그 항목의 사본만 보임
//   4. Canvas = Publish: trigger 글자 「[Cat]」 · Publish 에서 Dog 를 고르면 「[Dog]」
//   5. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-select-render-value-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/s2-select-render-value-live";
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

/** The value shape's records on the Canvas: each copy's text · hidden, and the SelectValue's. */
const canvasValue = () =>
  page.evaluate(() => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    const all = [...r.canvasInputs.values()];
    const value = all.find((x) => r.typeOf(x) === "SelectValue");
    const copies = all
      .filter(
        (x) =>
          r.typeOf(x) === "Text" &&
          x.parentId === value?.id,
      )
      .map((x) => ({
        id: x.id,
        text: String(x.props.children),
        hidden: x.hidden === true,
      }));
    return {
      valueId: value?.id,
      shown: value?.derivedProps?._valueTemplate === true,
      copies,
    };
  });

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("select render value live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  const selectRecord = await page.evaluate(() => {
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
    ws.execute(h.palette.catalogPaletteInsertPlan(ctx, "Select").command);
    const select = [...r.canvasInputs.values()].find(
      (x) => r.typeOf(x) === "Select",
    );
    // (The value slot's host — its SelectValue, as a Menu's items slot is the Menu's.)
    const value = [...r.canvasInputs.values()].find(
      (x) => r.typeOf(x) === "SelectValue",
    );
    ws.selectItems([ws.itemOfRecord(value.id)]);
    return select.id;
  });
  await page.waitForTimeout(1000);

  // 1. The Design panel's 「Fill slot」 of the value slot.
  const panel = page.locator('.panel-wrapper[data-panel="properties"]');
  if (!(await panel.isVisible())) {
    await page.mouse.click(1895, 572);
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: `${OUT}/builder-panel-value.png` });
  const sections = await panel
    .locator("[data-section-id]")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-section-id")));
  process.stdout.write(`SECTIONS ${JSON.stringify(sections)}\n`);
  const fills = panel.locator('button[aria-label="Fill slot"]');
  const fillCount = await fills.count();
  // (The slot rows in order — find the one whose row names 「value」.)
  let fillButton = null;
  for (let i = 0; i < fillCount; i += 1) {
    const row = await fills
      .nth(i)
      .evaluate((b) => b.closest("[data-slot-name], li, div")?.textContent ?? "");
    if (/value/i.test(row)) {
      fillButton = fills.nth(i);
      break;
    }
  }
  fillButton ??= fills.first();
  if (!fillCount) throw new Error(`no Fill slot — sections ${JSON.stringify(sections)}`);
  await fillButton.scrollIntoViewIfNeeded();
  await fillButton.click();
  await page.waitForTimeout(500);
  const options = (await page.getByRole("option").allTextContents()).map((t) =>
    t.trim(),
  );
  await page.getByRole("option", { name: /^Text$/ }).first().click();
  await page.waitForTimeout(900);
  const filled = await canvasValue();
  await page.screenshot({ path: `${OUT}/builder-after-fill.png` });
  record(
    "1 패널: Select 「Fill slot」 (value) → Text 가 SelectValue 의 자식",
    filled.copies.length === 1,
    { fillCount, options: options.slice(0, 8), filled },
  );

  // (Its text — the Properties text field's write — reads the item's label.)
  await page.evaluate((id) => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    ws.execute(
      h.commands.setFields({
        targets: [ws.positionOfRecord(id).target],
        props: { children: { kind: "set", value: "[{label}]" } },
        label: "Text",
      }),
    );
  }, filled.copies[0].id);
  await page.waitForTimeout(500);

  // 2. Layers right click 「Use as row template」.
  const layers = railButton(page, "navigator");
  if ((await layers.getAttribute("aria-pressed")) !== "true") {
    await layers.click();
    await page.waitForTimeout(900);
  }
  await page.evaluate((id) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    ws.selectItems([ws.itemOfRecord(id)]);
  }, filled.copies[0].id);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/builder-layers.png` });
  const row = page.locator(`[role="row"][data-key="${filled.copies[0].id}"]`).first();
  await row.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await row.click({ button: "right" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/builder-layers-menu.png` });
  const menuItems = await page
    .locator(".context-menu-item")
    .evaluateAll((items) => items.map((item) => item.textContent?.trim()));
  process.stdout.write(`MENU ${JSON.stringify(menuItems)}\n`);
  await page
    .locator(".context-menu-item")
    .filter({ hasText: /Use as row template|행 템플릿으로 사용/ })
    .first()
    .click({ timeout: 5000 });
  await page.waitForTimeout(900);
  const repeated = await page.evaluate(() => {
    const g = window.__COMPOSITION_CATALOG__.workspace.runtime.graph;
    return [...g.entries()]
      .filter(([, e]) => e.kind === "node" && e.repeat === true)
      .map(([id]) => id);
  }).catch(async () =>
    page.evaluate(() => {
      const r = window.__COMPOSITION_CATALOG__.workspace.root;
      return [...r.canvasInputs.values()].filter((x) => x.id.includes("#row:")).length;
    }),
  );
  const afterRepeat = await canvasValue();
  record(
    "2 Layers 우클릭 「행 템플릿으로 사용」 → 항목마다 사본 4 (모두 숨김 — 고른 것 없음)",
    afterRepeat.copies.length === 4 &&
      afterRepeat.copies.every((c) => c.hidden) &&
      !afterRepeat.shown,
    { menuItems, repeated, afterRepeat },
  );

  // 3. Select Cat (the Design panel's value — the stored selection).
  await page.evaluate((id) => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    ws.execute(
      h.commands.setFields({
        targets: [ws.positionOfRecord(id).target],
        props: { value: { kind: "set", value: "cat" } },
        label: "Value",
      }),
    );
    ws.selectItems([]);
  }, selectRecord);
  await page.waitForTimeout(900);
  const picked = await canvasValue();
  if ((await layers.getAttribute("aria-pressed")) === "true") {
    await layers.click();
    await page.waitForTimeout(800);
  }
  await page.screenshot({
    path: `${OUT}/builder-canvas.png`,
    clip: { x: 100, y: 80, width: 700, height: 120 },
  });
  record(
    "3 Canvas: cat 을 고르면 그 사본만 보임 · SelectValue 는 값 모양",
    picked.shown &&
      JSON.stringify(picked.copies.filter((c) => !c.hidden).map((c) => c.text)) ===
        JSON.stringify(["[Cat]"]),
    picked,
  );

  // 4. Publish.
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
  await pub.setViewportSize({ width: 1920, height: 1100 });
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector(".react-aria-SelectValue", { timeout: 60000 });
  await pub.waitForTimeout(1500);
  const first = (await pub.locator(".react-aria-SelectValue").first().textContent())?.trim();
  await pub.locator(".react-aria-Select button").first().click();
  await pub.waitForSelector('[role="option"]', { timeout: 10000 });
  await pub.locator('[role="option"]').filter({ hasText: "Dog" }).first().click();
  await pub.waitForTimeout(600);
  const second = (await pub.locator(".react-aria-SelectValue").first().textContent())?.trim();
  await pub.screenshot({ path: `${OUT}/publish-dog.png` });
  record(
    "4 Publish: 처음 「[Cat]」 (Canvas 와 같음) · Dog 를 고르면 「[Dog]」",
    first === "[Cat]" && second === "[Dog]",
    { first, second },
  );
  await pub.close();
  record("5 page error 0", errors.length === 0, errors);
} catch (error) {
  record("error", false, String(error?.stack ?? error));
} finally {
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
