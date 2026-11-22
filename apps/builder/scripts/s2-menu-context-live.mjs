#!/usr/bin/env node
// S2 체크리스트 부록 C.1 live (2026-11-22) — MenuTrigger `trigger: contextMenu` (headed Chrome).
//   ① Builder — Menu 를 놓고 Trigger 를 Context menu 로 (명령 · page error 0)
//   ② Publish — 왼쪽 클릭으로는 열리지 않는다
//   ③ Publish — 우클릭하면 메뉴가 열리고 그 위 끝이 누른 자리 (offset 0 — S2 · RAC)
//   ④ Publish — 대조: press 메뉴는 버튼 아래 8 에 선다 (기본 offset 그대로)
//   ⑤ 열어 둔 (isOpen) context 메뉴 — Canvas 와 Publish 모두 버튼 바로 아래 (offset 0)
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-menu-context-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/s2-menu-context-live";
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
  await page.keyboard.type("S2 menu context live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  const built = await page.evaluate(() => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const set = (value) => ({ kind: "set", value });
    const ctx = () => ({
      graph: ws.runtime.graph,
      records: ws.root.domInputs,
      selection: () => ws.session.getSnapshot().selection,
      itemOfRecord: (i) => ws.itemOfRecord(i),
      pageContent: () => ({ kind: "node", id: "project:node:home-body" }),
      newId: ws.newId,
    });
    const triggers = () =>
      [...ws.root.domInputs.values()].filter(
        (r) => ws.root.typeOf(r) === "MenuTrigger",
      );
    ws.selectRecords([]);
    ws.execute(h.palette.catalogPaletteInsertPlan(ctx(), "Menu").command);
    ws.selectRecords([]);
    ws.execute(h.palette.catalogPaletteInsertPlan(ctx(), "Menu").command);
    const [first] = triggers();
    ws.execute(
      h.commands.setFields({
        targets: [{ kind: "node", id: first.sourceId }],
        props: { trigger: set("contextMenu") },
      }),
    );
    ws.selectRecords([]);
    return triggers().map((t) => ws.root.domInputs.get(t.id).props.trigger);
  });
  record(
    "① Builder — two Menus, the first's Trigger set to Context menu",
    built.length === 2 && built[0] === "contextMenu" && errors.length === 0,
    built,
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
  await pub.waitForSelector("button", { timeout: 60000 });
  await pub.waitForTimeout(1200);
  const buttons = await pub.evaluate(() =>
    [...document.querySelectorAll("button")]
      .map((b) => {
        const r = b.getBoundingClientRect();
        return {
          x: r.x,
          y: r.y,
          w: r.width,
          h: r.height,
          haspopup: b.getAttribute("aria-haspopup"),
        };
      })
      .filter((b) => b.w > 0),
  );
  const [ctxButton, pressButton] = buttons;
  const menuBox = () =>
    pub.evaluate(() => {
      const m = document.querySelector('[role="menu"]');
      if (!m) return null;
      const pop = m.closest(".react-aria-Popover") ?? m;
      const r = pop.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });

  await pub.mouse.click(
    ctxButton.x + ctxButton.w / 2,
    ctxButton.y + ctxButton.h / 2,
  );
  await pub.waitForTimeout(500);
  const afterLeft = await menuBox();
  record(
    "② Publish — a left click does not open the context menu (no aria-haspopup)",
    afterLeft === null && ctxButton.haspopup === null,
    { afterLeft, haspopup: ctxButton.haspopup },
  );
  await pub.keyboard.press("Escape");

  // (Away from the viewport edge — RAC keeps a 12 px container padding there.)
  const at = {
    x: ctxButton.x + ctxButton.w * 0.75,
    y: ctxButton.y + ctxButton.h / 2,
  };
  await pub.mouse.click(at.x, at.y, { button: "right" });
  await pub.waitForTimeout(600);
  const ctxMenu = await menuBox();
  await pub.screenshot({ path: `${OUT}/2-context.png` });
  record(
    "③ Publish — a right click opens the menu at the pointer (offset 0)",
    ctxMenu !== null &&
      Math.abs(ctxMenu.y - at.y) <= 1 &&
      Math.abs(ctxMenu.x - at.x) <= 1,
    { pointer: at, menu: ctxMenu },
  );
  await pub.keyboard.press("Escape");
  await pub.waitForTimeout(400);

  await pub.mouse.click(
    pressButton.x + pressButton.w / 2,
    pressButton.y + pressButton.h / 2,
  );
  await pub.waitForTimeout(600);
  const pressMenu = await menuBox();
  await pub.screenshot({ path: `${OUT}/3-press.png` });
  record(
    "④ Publish — a press menu still sits 8 below its button",
    pressMenu !== null &&
      Math.abs(pressMenu.y - (pressButton.y + pressButton.h) - 8) <= 1,
    { button: pressButton, menu: pressMenu },
  );

  await page.bringToFront();
  const canvasOpen = await page.evaluate(() => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const r = ws.root;
    const [first] = [...r.domInputs.values()].filter(
      (x) => r.typeOf(x) === "MenuTrigger",
    );
    ws.execute(
      h.commands.setFields({
        targets: [{ kind: "node", id: first.sourceId }],
        props: { isOpen: { kind: "set", value: true } },
      }),
    );
    ws.selectRecords([]);
    const all = [...r.canvasInputs.values()];
    const pop = all.find((x) => r.typeOf(x) === "Popover" && !x.hidden);
    const btn = all.find(
      (x) => ["ActionButton", "Button"].includes(r.typeOf(x)) && !x.hidden,
    );
    const g = (id) => r.getGeometry([id]).get(id);
    return { pop: g(pop.id), button: g(btn.id) };
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/4-canvas-open.png` });
  const popup2 = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) =>
        ["Preview", "미리보기"].includes(b.getAttribute("aria-label")),
      )
      ?.click(),
  );
  const pub2 = await popup2;
  pub2.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  await pub2.waitForSelector('[role="menu"]', { timeout: 60000 });
  await pub2.waitForTimeout(800);
  const domOpen = await pub2.evaluate(() => {
    const pop = document
      .querySelector('[role="menu"]')
      .closest(".react-aria-Popover");
    const r = pop.getBoundingClientRect();
    return { x: r.x, y: r.y };
  });
  await pub2.screenshot({ path: `${OUT}/5-publish-open.png` });
  record(
    "⑤ open context menu — Canvas and Publish both right under the button (offset 0)",
    Math.abs(
      canvasOpen.pop.y - (canvasOpen.button.y + canvasOpen.button.height),
    ) < 0.5 &&
      Math.abs(domOpen.y - canvasOpen.pop.y) < 0.5 &&
      Math.abs(domOpen.x - canvasOpen.pop.x) < 0.5,
    { canvas: canvasOpen, dom: domOpen },
  );
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
