#!/usr/bin/env node
// ADR-326 G4 live — Design 패널 Open 이 Canvas 에 columns Cascader 의 막 연 화면을 그린다 (breakdown §4.5 ·
// §5). 실제 Builder 에서 팔레트로 놓고 Chrome · WebKit 으로 판정한다. 기대값은 이 파일에 적었다.
//   1. Design 패널 「Open」 → Canvas: 열린 상자가 보임 · 여는 Button 아래 (왼쪽 끝 같음 ±1) · 폭 = Button 폭 (±1) ·
//      보이는 항목 = 첫 단계 Electronics · Clothing · Books (더 깊은 항목 0) · Books (잎) 의 chevron 없음
//   2. 선택 테두리 = 열린 상자 (Cascader 를 고른 채 — 선택 bounds = 상자 bounds ±1)
//   3. 열린 상자의 바닥 여백 클릭 → 선택 = Cascader
//   4. 「Open」 끔 → 상자 · 항목 없음 → Undo → 다시 열림
//   5. Preview 의 시작 열림 — 누르지 않아도 menu 하나 · 상자 폭 = Button 폭 (±1)
//   6. console error 0 · page error 0
//
//   BROWSER=webkit BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr326-g4-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, webkit } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr326-g4-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const HEADLESS = process.argv.includes("--headless");
const WEBKIT = process.env.BROWSER === "webkit";
const NAME = WEBKIT ? "webkit" : "chrome";
const COMMANDS = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const FIRST_LEVEL = ["Electronics", "Clothing", "Books"];

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
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" && !/favicon\.ico/.test(m.location()?.url ?? ""))
    consoleErrors.push(`builder: ${m.text().slice(0, 200)}`);
});
const settle = (p, ms = 250) => p.waitForTimeout(ms);

/** The Canvas: the open box, the Button, the drawn items (name · chevron drawn), the selection. */
const canvas = (p) =>
  p.evaluate(() => {
    const h = window.__COMPOSITION_CATALOG__;
    const root = h.workspace.root;
    const records = root.canvasInputs;
    const typeOf = (r) => root.typeOf(r);
    const drawn = (r) => {
      for (let c = r; c; c = records.get(c.parentId)) if (c.hidden) return false;
      return true;
    };
    const all = [...records.values()];
    const field = all.find((r) => typeOf(r) === "Cascader");
    const popover = all.find((r) => typeOf(r) === "Popover");
    const button = field.children
      .map((id) => records.get(id))
      .find((r) => r && typeOf(r) === "Button");
    const items = all
      .filter((r) => typeOf(r) === "CascaderItem" && drawn(r))
      .map((r) => {
        const icon = r.children
          .map((id) => records.get(id))
          // (The chevron is the descriptor Icon — the check mark is the other Icon, Phase 4 판독 1.)
          .find(
            (c) => c && typeOf(c) === "Icon" && c.props.slot === "descriptor",
          );
        return {
          name: String(r.props.label),
          chevron: !!icon && drawn(icon),
          box: h.canvas.boundsOf(r.id),
        };
      });
    const selection = h.workspace.session.getSnapshot().selection;
    return {
      fieldId: field.id,
      open: drawn(popover),
      popover: drawn(popover) ? h.canvas.boundsOf(popover.id) : null,
      button: h.canvas.boundsOf(button.id),
      items,
      selection: selection.map((s) => ({
        identity: s.identity,
        type: records.get(s.identity) ? typeOf(records.get(s.identity)) : null,
        box: h.canvas.boundsOf(s.identity),
      })),
      camera: h.canvas.camera(),
      rect: document
        .querySelector('[data-catalog-canvas="true"]')
        .getBoundingClientRect()
        .toJSON(),
    };
  });
const near = (a, b) => Math.abs(a - b) <= 1;
const sameBox = (a, b) =>
  !!a && !!b && ["x", "y", "width", "height"].every((k) => near(a[k], b[k]));
const openButton = (p) => p.getByRole("button", { name: "Open", exact: true });

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await settle(page, 300);
  await page.keyboard.type(`adr326 g4 live ${NAME}`);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.canvas,
    null,
    { timeout: 30000 },
  );
  await settle(page, 1500);
  const rail = railButton(page, "components");
  if ((await rail.getAttribute("aria-pressed")) !== "true") {
    await rail.click();
    await settle(page, 900);
  }
  await page
    .locator("button, [role='button'], [role='option'], [role='gridcell']")
    .filter({ hasText: /^cascader$/i })
    .first()
    .click();
  await settle(page, 1500);
  // (Close the Components panel — a click on the open box must land on the Canvas, not the panel.)
  if ((await rail.getAttribute("aria-pressed")) === "true") {
    await rail.click();
    await settle(page, 900);
  }
  // (A field narrower than the page — its open box takes the Button's width, not the page's.)
  await page.evaluate(async (COMMANDS) => {
    const c = await import(COMMANDS);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const field = [...ws.root.domInputs.values()].find(
      (r) => ws.root.typeOf(r) === "Cascader",
    );
    ws.execute(
      c.setFields({
        targets: [ws.itemOfRecord(field.id).target],
        visual: { width: { kind: "set", value: 260 } },
      }),
    );
  }, COMMANDS);
  await settle(page, 600);

  // 1. Design panel Open → the Canvas draws the just-opened screen.
  if (!(await openButton(page).isVisible()))
    await page.getByRole("button", { name: "Design", exact: true }).click();
  await openButton(page).click({ noWaitAfter: true });
  await settle(page, 1200);
  const one = await canvas(page);
  record(
    "1 Open → Canvas 열린 상자 · Button 아래 · 폭 = Button · 첫 단계 항목만 · 잎 chevron 없음",
    one.open &&
      !!one.popover &&
      near(one.popover.width, one.button.width) &&
      near(one.popover.x, one.button.x) &&
      one.popover.y >= one.button.y + one.button.height - 1 &&
      JSON.stringify(one.items.map((i) => i.name)) ===
        JSON.stringify(FIRST_LEVEL) &&
      one.items.every((i) => i.chevron === (i.name !== "Books")) &&
      one.items.every(
        (i) =>
          !!i.box &&
          i.box.y >= one.popover.y &&
          i.box.y + i.box.height <= one.popover.y + one.popover.height + 1,
      ),
    {
      popover: one.popover,
      button: one.button,
      items: one.items,
    },
  );
  await page.screenshot({ path: `${OUT}/${NAME}-canvas-open.png` });

  // 2. The selection border is the open box.
  const cascaderSelected = one.selection.find((s) => s.type === "Cascader");
  record(
    "2 선택 테두리 = 열린 상자",
    !!cascaderSelected && sameBox(cascaderSelected.box, one.popover),
    { selection: one.selection, popover: one.popover },
  );

  // 3. A click on the open box (its bottom inset) selects the Cascader.
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.session.clearSelection(),
  );
  const cleared = (await canvas(page)).selection.length;
  const point = {
    x: one.rect.left + one.camera.x + (one.popover.x + 20) * one.camera.zoom,
    y:
      one.rect.top +
      one.camera.y +
      (one.popover.y + one.popover.height - 3) * one.camera.zoom,
  };
  const onCanvas = await page.evaluate(
    ({ x, y }) =>
      !!document.elementFromPoint(x, y)?.closest('[data-catalog-canvas="true"]'),
    point,
  );
  if (!onCanvas) throw new Error(`3: the point is not on the Canvas ${JSON.stringify(point)}`);
  await page.mouse.click(point.x, point.y);
  await settle(page, 600);
  const three = await canvas(page);
  record(
    "3 열린 상자 클릭 → 선택 = Cascader",
    cleared === 0 &&
      three.selection.length === 1 && three.selection[0].type === "Cascader",
    { cleared, point, selection: three.selection },
  );

  // 4. Open off → closed; Undo → open again.
  await openButton(page).click({ noWaitAfter: true });
  await settle(page, 900);
  const off = await canvas(page);
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.undo());
  await settle(page, 900);
  const back = await canvas(page);
  record(
    "4 Open 끔 → 닫힘 · Undo → 다시 열림",
    !off.open &&
      off.items.length === 0 &&
      back.open &&
      JSON.stringify(back.items.map((i) => i.name)) ===
        JSON.stringify(FIRST_LEVEL) &&
      sameBox(back.popover, one.popover),
    { off: { open: off.open, items: off.items.length }, back: back.popover },
  );

  // 5. The Preview starts open.
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
  pub.on("console", (m) => {
    if (m.type() === "error" && !/favicon\.ico/.test(m.location()?.url ?? ""))
      consoleErrors.push(`publish: ${m.text().slice(0, 200)}`);
  });
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector(".react-aria-Cascader button", { timeout: 60000 });
  await settle(pub, 1200);
  const dom = await pub.evaluate(() => {
    const button = document.querySelector(".react-aria-Cascader button");
    const pop = document.querySelector('.react-aria-Popover[data-trigger="Cascader"]');
    return {
      menus: document.querySelectorAll('[role="menu"]').length,
      rows: [...document.querySelectorAll('[role="menu"] [role^="menuitem"]')].map(
        (r) => r.textContent?.trim(),
      ),
      button: button?.getBoundingClientRect().width,
      popover: pop?.getBoundingClientRect().width,
    };
  });
  record(
    "5 Preview 시작 열림 — menu 하나 · 첫 단계 행 · 폭 = Button",
    dom.menus === 1 &&
      JSON.stringify(dom.rows) === JSON.stringify(FIRST_LEVEL) &&
      near(dom.popover ?? -9, dom.button ?? 0),
    dom,
  );
  await pub.screenshot({ path: `${OUT}/${NAME}-preview-open.png` });
  await pub.close();
} catch (error) {
  record("harness", false, { error: String(error?.stack ?? error) });
} finally {
  // (Known, outside this ADR — WebKit rejects the Builder ProgressCircle's SVG `r="calc(…)"`
  //  (`components/ProgressCircle.tsx`): it shows on a new project with nothing placed.)
  const KNOWN = /Invalid value for <circle> attribute r="calc\(/;
  const known = consoleErrors.filter((e) => KNOWN.test(e));
  const other = consoleErrors.filter((e) => !KNOWN.test(e));
  record("6 console error 0 · page error 0", !errors.length && !other.length, {
    errors,
    consoleErrors: other,
    known,
  });
  writeFileSync(`${OUT}/${NAME}.json`, JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.pass).length;
  process.stdout.write(
    `\n[${NAME}] ${failed ? `FAIL ${failed}` : `ALL PASS ${results.length}`}\n`,
  );
  await browser.close();
  process.exit(failed ? 1 : 0);
}
