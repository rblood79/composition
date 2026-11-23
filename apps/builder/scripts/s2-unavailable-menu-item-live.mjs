#!/usr/bin/env node
// S2 UnavailableMenuItemTrigger live (2026-11-23, S2 체크리스트 §9.3):
//   1. Design 패널: Menu 의 「Fill slot」 목록에 UnavailableMenuItemTrigger → 고르면 문서에 trigger
//      (isUnavailable true) > MenuItem + Popover (도움말)
//   2. Canvas: 그 항목의 정보 아이콘이 보이고 꺾쇠 · 도움말 Popover 는 숨김
//   3. Design 패널: trigger 를 고르면 「사용할 수 없음」 칸 → 끄면 정보 아이콘이 사라지고, 다시 켠다
//   4. Publish: 메뉴를 열면 그 항목은 aria-haspopup · aria-describedby → 정보 아이콘 이름, 누르면 도움말
//      Popover (제목 「Permission required」 이 이름)
//   5. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-unavailable-menu-item-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/s2-unavailable-menu-item-live";
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

const canvasState = () =>
  page.evaluate(() => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    const trigger = [...r.canvasInputs.values()].find(
      (x) => r.typeOf(x) === "UnavailableMenuItemTrigger",
    );
    if (!trigger) return null;
    const kids = trigger.children.map((id) => r.canvasInputs.get(id));
    const item = kids.find((x) => x && r.typeOf(x) === "MenuItem");
    const popover = kids.find((x) => x && r.typeOf(x) === "Popover");
    const glyph = (name) =>
      item?.children
        .map((id) => r.canvasInputs.get(id))
        .find((x) => x?.props.iconName === name);
    return {
      triggerRecord: trigger.id,
      isUnavailable: trigger.props.isUnavailable,
      // (null = not found; a shown record has no `hidden`.)
      infoHidden: glyph("info") ? glyph("info").hidden === true : null,
      chevronHidden: glyph("chevron-right")
        ? glyph("chevron-right").hidden === true
        : null,
      popoverHidden: popover ? popover.hidden === true : null,
    };
  });

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("unavailable menu item live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  const menuRecord = await page.evaluate(() => {
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
    ws.execute(h.palette.catalogPaletteInsertPlan(ctx, "Menu").command);
    const menu = [...r.canvasInputs.values()].find(
      (x) => r.typeOf(x) === "Menu",
    );
    ws.selectItems([ws.itemOfRecord(menu.id)]);
    return menu.id;
  });
  await page.waitForTimeout(1000);

  // 1. The Design panel's 「Fill slot」 list on the Menu.
  const panel = page.locator('.panel-wrapper[data-panel="properties"]');
  if (!(await panel.isVisible())) {
    await page.mouse.click(1895, 572);
    await page.waitForTimeout(1000);
  }
  const fill = panel.locator('button[aria-label="Fill slot"]').first();
  await fill.scrollIntoViewIfNeeded();
  await fill.click();
  await page.waitForTimeout(500);
  const options = (await page.getByRole("option").allTextContents()).map((t) =>
    t.trim(),
  );
  await page
    .getByRole("option", { name: /UnavailableMenuItemTrigger/ })
    .first()
    .click();
  await page.waitForTimeout(800);
  const placed = await canvasState();
  record(
    "1 패널: Menu 「Fill slot」 → UnavailableMenuItemTrigger (isUnavailable true)",
    options.some((t) => t.includes("UnavailableMenuItemTrigger")) &&
      placed?.isUnavailable === true,
    { options: options.slice(-6), placed },
  );

  // 2. Canvas.
  await page.screenshot({ path: `${OUT}/builder-canvas.png` });
  record(
    "2 Canvas: 정보 아이콘 보임 · 꺾쇠 · 도움말 Popover 숨김",
    placed?.infoHidden === false &&
      placed?.chevronHidden === true &&
      placed?.popoverHidden === true,
    placed,
  );

  // 3. The trigger's 「Unavailable」 field.
  await page.evaluate((id) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    ws.selectItems([ws.itemOfRecord(id)]);
  }, placed.triggerRecord);
  await page.waitForTimeout(800);
  const field = panel.getByText(/^(Unavailable|사용할 수 없음)$/).first();
  await field.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/builder-panel.png` });
  await field.click();
  await page.waitForTimeout(600);
  const off = await canvasState();
  await field.click();
  await page.waitForTimeout(600);
  const on = await canvasState();
  record(
    "3 패널: 「사용할 수 없음」 끄기 → 정보 아이콘 숨김 · 다시 켜기 → 보임",
    off?.isUnavailable !== true &&
      off?.infoHidden === true &&
      on?.isUnavailable === true &&
      on?.infoHidden === false,
    { off, on },
  );
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
  );
  await page.waitForTimeout(400);

  // 3b. Canvas with the menu open (the MenuTrigger's `isOpen`): the glyph's place in its item —
  //     compared with Publish below. Undone afterwards.
  const canvasGlyph = await page.evaluate((menuId) => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const r = ws.root;
    let at = r.canvasInputs.get(menuId);
    while (at && r.typeOf(at) !== "MenuTrigger")
      at = r.canvasInputs.get(at.parentId);
    ws.execute(
      h.commands.setFields({
        targets: [ws.positionOfRecord(at.id).target],
        props: { isOpen: { kind: "set", value: true } },
        label: "Open",
      }),
    );
    return null;
  }, menuRecord);
  await page.waitForTimeout(1200);
  const canvasRects = await page.evaluate(() => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    const trigger = [...r.canvasInputs.values()].find(
      (x) => r.typeOf(x) === "UnavailableMenuItemTrigger",
    );
    const item = trigger.children
      .map((id) => r.canvasInputs.get(id))
      .find((x) => r.typeOf(x) === "MenuItem");
    const glyph = item.children
      .map((id) => r.canvasInputs.get(id))
      .find((x) => x.props.iconName === "info");
    // (A child's geometry is in its parent's box — the glyph's in its item's.)
    const g = r.getGeometry([item.id, glyph.id]);
    const it = g.get(item.id);
    const gl = g.get(glyph.id);
    return {
      itemWidth: it?.width,
      itemHeight: it?.height,
      glyphWidth: gl?.width,
      right: it && gl ? it.width - (gl.x + gl.width) : null,
      centerY: it && gl ? gl.y + gl.height / 2 - it.height / 2 : null,
    };
  });
  await page.screenshot({ path: `${OUT}/builder-canvas-open.png` });
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.undo());
  await page.waitForTimeout(800);
  void canvasGlyph;

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
  await pub.waitForSelector("button", { timeout: 60000 });
  await pub.waitForTimeout(1500);
  await pub
    .locator("button")
    .filter({ hasText: /^Menu$/ })
    .first()
    .click();
  await pub.waitForSelector("[role=menu]", { timeout: 10000 });
  await pub.waitForTimeout(400);
  const item = pub
    .locator("[role=menuitem]")
    .filter({ hasText: "Unavailable" })
    .first();
  const described = await item.evaluate((el) => {
    const ids = (el.getAttribute("aria-describedby") ?? "").split(" ");
    return {
      haspopup: el.getAttribute("aria-haspopup"),
      description: ids
        .map((id) => document.getElementById(id)?.getAttribute("aria-label"))
        .filter(Boolean),
      chevron: !!el.querySelector('[data-icon="chevron-right"]'),
    };
  });
  const domRects = await item.evaluate((el) => {
    const id = (el.getAttribute("aria-describedby") ?? "").split(" ")[0];
    const glyph = document.getElementById(id);
    const it = el.getBoundingClientRect();
    const gl = glyph?.getBoundingClientRect();
    return {
      itemWidth: it.width,
      itemHeight: it.height,
      glyphWidth: gl?.width,
      right: gl ? it.right - gl.right : null,
      centerY: gl ? gl.top + gl.height / 2 - (it.top + it.height / 2) : null,
    };
  });
  const near = (a, b) =>
    typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= 1;
  record(
    "3b Canvas = Publish: 열린 메뉴의 정보 아이콘 자리 (항목 폭 · 높이 · 아이콘 폭 · 오른쪽 여백 · 세로 중심)",
    ["itemHeight", "glyphWidth", "right", "centerY"].every((key) =>
      near(canvasRects[key], domRects[key]),
    ),
    { canvas: canvasRects, publish: domRects },
  );
  await item.click();
  await pub.waitForTimeout(600);
  await pub.screenshot({ path: `${OUT}/publish-help.png` });
  const help = await pub.evaluate(() => {
    const popover = [...document.querySelectorAll(".react-aria-Popover")].find(
      (el) => el.textContent?.includes("Permission required"),
    );
    if (!popover) return null;
    const title = document.getElementById(
      popover.getAttribute("aria-labelledby") ?? "",
    );
    return {
      name: title?.textContent,
      placement: popover.getAttribute("data-placement"),
    };
  });
  record(
    "4 Publish: 항목 aria-haspopup · 설명 = 정보 아이콘 이름 · 누르면 도움말 (제목이 이름)",
    !!described.haspopup &&
      described.description.length === 1 &&
      !described.chevron &&
      help?.name === "Permission required",
    { described, help },
  );
  await pub.close();
  record("5 page error 0", errors.length === 0, errors);
} catch (error) {
  record("error", false, String(error?.stack ?? error));
} finally {
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
