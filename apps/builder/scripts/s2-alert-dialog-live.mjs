#!/usr/bin/env node
// S2 AlertDialog live (2026-11-23, S2 체크리스트 §9.3 6-4 — 사용자 결정 「노드 + 2 필드」):
//   1. Components 패널 「alert dialog」 → AlertDialog 원본 instance (DialogTrigger 루트)
//   2. Canvas 기본 (confirmation): Dialog role=alertdialog · 버튼 Cancel + Publish (accent) · glyph 없음
//   3. Design 패널: Variant · 글자 칸 · Auto focus button
//   4. error · cancel 글자 비움 · secondary 「Save draft」 · autoFocus primary → Canvas 버튼 2 (primary
//      variant) · glyph triangle-alert
//   5. Publish: alertdialog · 제목 이름 · glyph 이름 (사이트 언어 S2 dialog.alert) · focus = Publish ·
//      Save draft 누르면 닫힘
//   6. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-alert-dialog-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/s2-alert-dialog-live";
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
    const trigger = all.find((x) => r.typeOf(x) === "DialogTrigger");
    const dialog = all.find((x) => r.typeOf(x) === "Dialog");
    const group = all.find((x) => r.typeOf(x) === "ButtonGroup");
    const buttons = (group?.children ?? []).map((id) => {
      const b = r.canvasInputs.get(id);
      const text = b.children
        .map((c) => r.canvasInputs.get(c))
        .find((c) => c && r.typeOf(c) === "Text");
      return {
        label: String(text?.props.children ?? ""),
        variant: b.props.variant,
        autoFocus: b.props.autoFocus,
      };
    });
    const glyphs = all
      .filter(
        (x) =>
          r.typeOf(x) === "Icon" &&
          r.typeOf(r.canvasInputs.get(x.parentId) ?? {}) === "Heading" &&
          x.hidden !== true &&
          !String(x.props.iconName ?? "").startsWith("{"),
      )
      .map((x) => x.props.iconName);
    const title = all.find(
      (x) =>
        r.typeOf(x) === "Text" &&
        r.typeOf(r.canvasInputs.get(x.parentId) ?? {}) === "Heading",
    );
    return {
      trigger: trigger?.id,
      role: dialog?.props.role,
      titleWeight: title?.visual.fontWeight,
      buttons,
      glyphs,
    };
  });

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("alert dialog live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  // 1. Components panel.
  const components = railButton(page, "components");
  if ((await components.getAttribute("aria-pressed")) !== "true") {
    await components.click();
    await page.waitForTimeout(900);
  }
  const item = page
    .locator("button, [role='button'], [role='option'], [role='gridcell']")
    .filter({ hasText: /^alert dialog$/i })
    .first();
  await item.waitFor({ state: "visible", timeout: 15000 });
  await page.screenshot({ path: `${OUT}/builder-palette.png` });
  await item.click();
  await page.waitForTimeout(1500);
  const placed = await canvasState();
  record(
    "1 Components 「alert dialog」 → DialogTrigger 루트 instance",
    !!placed.trigger,
    placed,
  );

  // 2. Canvas default.
  record(
    "2 Canvas 기본: alertdialog · Cancel + Publish (accent) · glyph 없음 · 제목 Text 600 (Heading 의 것)",
    placed.role === "alertdialog" &&
      JSON.stringify(placed.buttons.map((b) => [b.label, b.variant])) ===
        JSON.stringify([
          ["Cancel", "secondary"],
          ["Publish", "accent"],
        ]) &&
      placed.glyphs.length === 0 &&
      placed.titleWeight === 600,
    placed,
  );

  // 3. Design panel.
  await page.evaluate((id) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    ws.selectItems([ws.itemOfRecord(id)]);
  }, placed.trigger);
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
  const panel = page.locator('.panel-wrapper[data-panel="properties"]');
  const panelText = (await panel.textContent()) ?? "";
  await page.screenshot({ path: `${OUT}/builder-design.png` });
  const wanted = [
    "Variant",
    "Title",
    "Primary action label",
    "Cancel label",
    "Auto focus button",
  ];
  record(
    "3 Design 패널: Variant · Title · 글자 칸 · Auto focus button",
    wanted.every((label) => panelText.includes(label)),
    { missing: wanted.filter((label) => !panelText.includes(label)) },
  );

  // 4. error · no cancel · a secondary · primary focus.
  await page.evaluate((id) => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const set = (value) => ({ kind: "set", value });
    ws.execute(
      h.commands.setFields({
        targets: [ws.positionOfRecord(id).target],
        props: {
          variant: set("error"),
          cancelLabel: set(""),
          secondaryActionLabel: set("Save draft"),
          autoFocusButton: set("primary"),
        },
        label: "Alert",
      }),
    );
  }, placed.trigger);
  await page.waitForTimeout(900);
  const changed = await canvasState();
  record(
    "4 Canvas: error → glyph triangle-alert · primary variant · Cancel 없음 · Save draft · autoFocus primary",
    JSON.stringify(changed.glyphs) === JSON.stringify(["triangle-alert"]) &&
      JSON.stringify(
        changed.buttons.map((b) => [b.label, b.variant, b.autoFocus]),
      ) ===
        JSON.stringify([
          ["Save draft", "secondary", false],
          ["Publish", "primary", true],
        ]),
    changed,
  );

  // 5. Publish.
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
  const trigger = pub.getByRole("button", { name: "Publish" }).first();
  await trigger.waitFor({ timeout: 60000 });
  await pub.waitForTimeout(1200);
  await trigger.click();
  await pub.waitForSelector('[role="alertdialog"]', { timeout: 10000 });
  await pub.waitForTimeout(700);
  const opened = await pub.evaluate(() => {
    const dialog = document.querySelector('[role="alertdialog"]');
    const titleId = dialog.getAttribute("aria-labelledby");
    const title = titleId ? document.getElementById(titleId) : null;
    const glyph = dialog.querySelector('[role="img"]');
    return {
      lang: document.documentElement.lang,
      title: title?.textContent?.trim(),
      glyph: glyph?.getAttribute("aria-label"),
      buttons: [...dialog.querySelectorAll("button")].map((b) =>
        b.textContent?.trim(),
      ),
      focused: document.activeElement?.textContent?.trim(),
      // (S2: the title is the Heading's type — its Text inherits it.)
      titleFont: title
        ? (() => {
            const h = getComputedStyle(title);
            const text = title.querySelector(".react-aria-Text") ?? title;
            const t = getComputedStyle(text);
            return {
              heading: [h.fontSize, h.fontWeight, h.display],
              text: [t.fontSize, t.fontWeight],
            };
          })()
        : undefined,
    };
  });
  await pub.screenshot({ path: `${OUT}/publish-open.png` });
  await pub
    .locator('[role="alertdialog"] button')
    .filter({ hasText: "Save draft" })
    .first()
    .click();
  await pub.waitForTimeout(800);
  const closed = (await pub.locator('[role="alertdialog"]').count()) === 0;
  const alertName = opened.lang?.startsWith("ko") ? "경고" : "Alert";
  record(
    "5 Publish: alertdialog · 제목 이름 · glyph 이름 · focus Publish · Save draft 로 닫힘",
    opened.title === "Publish documents" &&
      opened.glyph === alertName &&
      JSON.stringify(opened.buttons) ===
        JSON.stringify(["Save draft", "Publish"]) &&
      opened.focused === "Publish" &&
      JSON.stringify(opened.titleFont?.text) ===
        JSON.stringify(opened.titleFont?.heading.slice(0, 2)) &&
      closed,
    { ...opened, closed },
  );
  await pub.close();
  record("6 page error 0", errors.length === 0, errors);
} catch (error) {
  record("error", false, String(error?.stack ?? error));
} finally {
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
