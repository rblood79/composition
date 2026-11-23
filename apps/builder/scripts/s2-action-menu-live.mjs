#!/usr/bin/env node
// S2 ActionMenu live (2026-11-23, S2 체크리스트 §9.3 6-3):
//   1. Components 패널의 「Action menu」 를 누르면 ActionMenu 원본 instance (MenuTrigger 루트) 가 놓인다
//   2. Canvas: trigger = icon-only ActionButton (ellipsis 글리프) · 메뉴는 닫힘
//   3. Design 패널: Size · Quiet · Menu size 칸
//   4. Publish: 버튼 이름 「More actions」 · 누르면 Copy · Cut · Paste (설명 · 단축키) · Menu size L
//   5. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-action-menu-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/s2-action-menu-live";
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
    const all = [...r.canvasInputs.values()];
    const trigger = all.find((x) => r.typeOf(x) === "MenuTrigger");
    const button = all.find(
      (x) => r.typeOf(x) === "ActionButton" && x.parentId === trigger?.id,
    );
    const glyph = all.find(
      (x) => r.typeOf(x) === "Icon" && x.parentId === button?.id,
    );
    const menu = all.find((x) => r.typeOf(x) === "Menu");
    return {
      trigger: trigger?.id,
      iconOnly: button?.derivedProps?._actionIconOnly === true,
      glyph: glyph?.props.iconName,
      glyphHidden: glyph?.hidden === true,
      size: button?.props.size,
      quiet: button?.props.isQuiet,
      menuSize: menu?.props.size,
      menuHidden: menu ? menu.hidden === true || undefined : "absent",
    };
  });

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("action menu live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  // 1. Components panel 「Action menu」.
  const components = railButton(page, "components");
  if ((await components.getAttribute("aria-pressed")) !== "true") {
    await components.click();
    await page.waitForTimeout(900);
  }
  await page.screenshot({ path: `${OUT}/builder-components.png` });
  const labels = await page
    .locator("button, [role='button'], [role='option'], [role='gridcell']")
    .evaluateAll((els) =>
      els
        .map((el) => (el.getAttribute("aria-label") ?? el.textContent ?? "").trim())
        .filter((t) => /action/i.test(t)),
    );
  process.stdout.write(`LABELS ${JSON.stringify(labels)}\n`);
  const item = page
    .locator("button, [role='button'], [role='option'], [role='gridcell']")
    .filter({ hasText: /^action menu$/i })
    .or(page.locator('[aria-label="action menu"]'))
    .first();
  await item.waitFor({ state: "visible", timeout: 15000 });
  await page.screenshot({ path: `${OUT}/builder-palette.png` });
  await item.click();
  await page.waitForTimeout(1500);
  const placed = await canvasState();
  record(
    "1 Components 「Action menu」 → MenuTrigger 루트 instance",
    !!placed.trigger,
    placed,
  );

  // 2. Canvas.
  if ((await components.getAttribute("aria-pressed")) === "true") {
    await components.click();
    await page.waitForTimeout(800);
  }
  await page.screenshot({
    path: `${OUT}/builder-canvas.png`,
    clip: { x: 100, y: 80, width: 600, height: 160 },
  });
  record(
    "2 Canvas: icon-only ActionButton · ellipsis 글리프 · 메뉴 닫힘",
    placed.iconOnly && placed.glyph === "ellipsis" && !placed.glyphHidden,
    placed,
  );

  // 3. Design panel fields.
  await page.evaluate((id) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    ws.selectItems([ws.itemOfRecord(id)]);
  }, placed.trigger);
  const design = railButton(page, "properties");
  if ((await design.getAttribute("aria-pressed")) !== "true") {
    await design.click();
    await page.waitForTimeout(900);
  }
  await page.waitForTimeout(800);
  const panel = page.locator('.panel-wrapper[data-panel="properties"]');
  const panelText = (await panel.textContent()) ?? "";
  await page.screenshot({ path: `${OUT}/builder-design.png` });
  record(
    "3 Design 패널: Size · Quiet · Menu size",
    /Menu size/.test(panelText) &&
      /Quiet/.test(panelText) &&
      /Size/.test(panelText),
    { hasMenuSize: /Menu size/.test(panelText) },
  );

  // Menu size L (the instance's prop — the panel's write).
  await page.evaluate((id) => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    ws.execute(
      h.commands.setFields({
        targets: [ws.positionOfRecord(id).target],
        props: { menuSize: { kind: "set", value: "L" } },
        label: "Menu size",
      }),
    );
  }, placed.trigger);
  await page.waitForTimeout(600);
  const sized = await canvasState();

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
  const trigger = pub.locator('button[aria-haspopup="true"]').first();
  await trigger.waitFor({ timeout: 60000 });
  await pub.waitForTimeout(1200);
  const name = await trigger.getAttribute("aria-label");
  // (S2 `menu.moreActions` in the site's language — a new project's site language.)
  const siteLang = await pub.evaluate(() => document.documentElement.lang);
  await trigger.click();
  await pub.waitForSelector('[role="menu"]', { timeout: 10000 });
  await pub.waitForTimeout(500);
  const items = await pub
    .locator('[role="menuitem"]')
    .evaluateAll((els) => els.map((el) => el.textContent?.trim()));
  const menuSize = await pub
    .locator('[role="menu"]')
    .first()
    .getAttribute("data-size");
  await pub.screenshot({ path: `${OUT}/publish-open.png` });
  record(
    "4 Publish: 이름 = 사이트 언어의 S2 menu.moreActions · Copy · Cut · Paste (설명 · 단축키) · Menu size L",
    name === (siteLang?.startsWith("ko") ? "기타 액션" : "More actions") &&
      items.length === 3 &&
      /Copy/.test(items[0] ?? "") &&
      /Copy the selected text/.test(items[0] ?? "") &&
      /⌘C/.test(items[0] ?? "") &&
      sized.menuSize === "L",
    { siteLang, name, items, menuSize, sized },
  );
  await pub.close();
  record("5 page error 0", errors.length === 0, errors);
} catch (error) {
  record("error", false, String(error?.stack ?? error));
} finally {
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
