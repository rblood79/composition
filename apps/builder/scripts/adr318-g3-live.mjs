#!/usr/bin/env node
// ADR-318 G3 live — Resizable 분할창의 접기 · 펼치기 (Phase 3): 왼쪽 Panel collapsible · 접힌 크기 48px ·
// 최소 200px 에서 Publish 로
//   1. Enter → 왼쪽 48 px · data-collapsed · aria-valuenow = 48 의 % · Enter → 다시 반
//   2. 더블클릭 → 접힘 · 더블클릭 → 펼침
//   3. 끌기: 가운데 임계 (min 200 과 48 의 가운데 124 px) 를 넘어 왼쪽으로 → 48 에 접힘 · 다시 오른쪽으로 넘기면 200 에 펼침
//   4. Canvas 의 시작 접힘 (isCollapsed) = Publish 첫 화면 (왼쪽 48 px, ±1)
//   5. 접을 수 없는 Panel 의 Enter 는 아무것도 바꾸지 않음 (값 그대로) · page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr318-g3-live.mjs <out-dir>
//   BROWSER=webkit 이면 Playwright WebKit 으로
import { mkdirSync, readFileSync } from "node:fs";
import { chromium, webkit } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr318-g3-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const MOD = process.platform === "darwin" ? "Meta" : "Control";

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 900)}\n`,
  );
};

const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser =
  process.env.BROWSER === "webkit"
    ? await webkit.launch({ headless: false })
    : await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

const openRail = async (id) => {
  const button = railButton(page, id);
  if ((await button.getAttribute("aria-pressed")) !== "true") {
    await button.click();
    await page.waitForTimeout(900);
  }
};
const placeGroup = async (keepSelection) => {
  await openRail("components");
  if (!keepSelection)
    await page.evaluate(() =>
      window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
    );
  const item = page
    .locator("button, [role='button'], [role='option'], [role='gridcell']")
    .filter({ hasText: /^resizable panels$/i })
    .first();
  await item.waitFor({ state: "visible", timeout: 15000 });
  await item.click();
  await page.waitForTimeout(1500);
};
/** The Groups' records in document order: id · node · children (record ids + types). */
const groups = () =>
  page.evaluate(() => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    return [...r.canvasInputs.values()]
      .filter((x) => r.typeOf(x) === "ResizablePanelGroup")
      .map((g) => ({
        id: g.id,
        node: g.sourceId,
        parent: g.parentId,
        kids: g.children.map((id) => ({
          id,
          node: r.canvasInputs.get(id)?.sourceId,
          type: r.typeOf(r.canvasInputs.get(id)),
        })),
      }));
  });
const write = (recordId, props) =>
  page.evaluate(
    ({ recordId, props }) => {
      const { workspace: ws, commands: c } = window.__COMPOSITION_CATALOG__;
      ws.execute(
        c.setFields({
          targets: [ws.itemOfRecord(recordId).target],
          props: Object.fromEntries(
            Object.entries(props).map(([k, v]) => [
              k,
              v === null ? { kind: "remove" } : { kind: "set", value: v },
            ]),
          ),
        }),
      );
    },
    { recordId, props },
  );
const openPublish = async (ids) => {
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
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForFunction(
    (ids) =>
      ids.every((id) =>
        document.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`),
      ),
    ids,
    { timeout: 60000 },
  );
  // (the interaction chunk — the separator role appears when it has loaded)
  await pub.waitForSelector('[role="separator"]', { timeout: 30000 });
  await pub.waitForTimeout(500);
  return pub;
};
const sep = (pub, id) => pub.locator(`[data-catalog-id="${id}"]`);
const attrs = (pub, id) =>
  sep(pub, id).evaluate((el) =>
    Object.fromEntries(
      [
        "role",
        "aria-orientation",
        "aria-valuenow",
        "aria-valuemin",
        "aria-valuemax",
        "aria-controls",
        "aria-label",
        "aria-disabled",
        "tabindex",
        "data-resizing",
      ].map((n) => [n, el.getAttribute(n)]),
    ),
  );
const width = (pub, id, axis = "w") =>
  pub
    .locator(`[data-catalog-id="${id}"]`)
    .evaluate(
      (el, axis) =>
        el.getBoundingClientRect()[axis === "w" ? "width" : "height"],
      axis,
    );
const center = async (pub, id) => {
  const b = await pub.locator(`[data-catalog-id="${id}"]`).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("adr318 g3 live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);
  await placeGroup(false);
  const [g] = await groups();
  const [p1, h, p2] = g.kids.map((k) => k.id);
  const ids = [g.id, p1, h, p2];

  // 5a. Not collapsible yet: Enter leaves the value.
  let pub = await openPublish(ids);
  await sep(pub, h).focus();
  await pub.keyboard.press("Enter");
  await pub.waitForTimeout(200);
  const notCollapsible = (await attrs(pub, h))["aria-valuenow"];
  await pub.close();

  await write(p1, {
    collapsible: true,
    collapsedSize: "48px",
    minSize: "200px",
  });
  await page.waitForTimeout(600);
  pub = await openPublish(ids);
  const space = (await width(pub, g.id)) - 1;
  const pct = (px) => String(Math.round((px / space) * 100));
  // 1. Enter.
  await sep(pub, h).focus();
  await pub.keyboard.press("Enter");
  await pub.waitForTimeout(300);
  const e1 = {
    w: await width(pub, p1),
    now: (await attrs(pub, h))["aria-valuenow"],
    min: (await attrs(pub, h))["aria-valuemin"],
    collapsed: await pub
      .locator(`[data-catalog-id="${p1}"]`)
      .evaluate((el) => el.hasAttribute("data-collapsed")),
  };
  await pub.keyboard.press("Enter");
  await pub.waitForTimeout(300);
  const e2 = {
    w: await width(pub, p1),
    now: (await attrs(pub, h))["aria-valuenow"],
  };
  record(
    "1 Enter → 48 px · data-collapsed · valuenow = 48 의 % · valuemin = 48 의 % · Enter → 반으로",
    Math.abs(e1.w - 48) <= 1 &&
      e1.collapsed &&
      e1.now === pct(48) &&
      e1.min === pct(48) &&
      Math.abs(e2.w - space / 2) <= 1 &&
      e2.now === "50",
    { e1, e2, space },
  );
  // 2. Double click.
  const c = await center(pub, h);
  await pub.mouse.dblclick(c.x, c.y);
  await pub.waitForTimeout(300);
  const d1 = await width(pub, p1);
  // (the Handle moved with the collapse)
  const c2 = await center(pub, h);
  await pub.mouse.dblclick(c2.x, c2.y);
  await pub.waitForTimeout(300);
  const d2 = await width(pub, p1);
  record(
    "2 더블클릭 → 48 px · 더블클릭 → 반으로",
    Math.abs(d1 - 48) <= 1 && Math.abs(d2 - space / 2) <= 1,
    { d1, d2 },
  );
  await pub.close();
  // 3. Drag past the middle (124 px) and back.
  pub = await openPublish(ids);
  {
    const at = await center(pub, h);
    await pub.mouse.move(at.x, at.y);
    await pub.mouse.down();
    // from 799.5 to 100 (< 124): collapses
    const target = at.x - (space / 2 - 100);
    for (let s = 1; s <= 10; s++)
      await pub.mouse.move(at.x + ((target - at.x) * s) / 10, at.y);
    await pub.waitForTimeout(150);
    const mid = await width(pub, p1);
    // back to 150 (> 124): expands to its min 200
    for (let s = 1; s <= 5; s++)
      await pub.mouse.move(target + (50 * s) / 5, at.y);
    await pub.waitForTimeout(150);
    const back = await width(pub, p1);
    await pub.mouse.up();
    await pub.waitForTimeout(300);
    const end = await width(pub, p1);
    record(
      "3 끌기 — 임계 (124 px) 를 넘어 왼쪽: 48 px 에 접힘 · 다시 넘어 오른쪽: 최소 200 에 펼침 · 놓은 뒤 그대로",
      Math.abs(mid - 48) <= 1 &&
        Math.abs(back - 200) <= 1 &&
        Math.abs(end - 200) <= 1,
      { mid, back, end },
    );
  }
  await pub.close();
  // 4. Start collapsed: Canvas = Publish.
  await write(p1, { isCollapsed: true });
  await page.waitForTimeout(800);
  const canvas = await page.evaluate((id) => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    return r.getGeometry([id]).get(id)?.width;
  }, p1);
  pub = await openPublish(ids);
  const first = await width(pub, p1);
  record(
    "4 시작 접힘 — Canvas 왼쪽 48 px = Publish 첫 화면 48 px",
    Math.abs(canvas - 48) <= 1 && Math.abs(first - 48) <= 1,
    { canvas, publish: first },
  );
  await pub.screenshot({ path: `${OUT}/4-start-collapsed.png` });
  await pub.close();
  record(
    "5 접을 수 없는 Panel 의 Enter 는 값 그대로 · page error 0",
    notCollapsible === "50" && errors.length === 0,
    { notCollapsible, errors: errors.slice(0, 5) },
  );
} catch (error) {
  record("실행 오류", false, String(error).split("\n").slice(0, 3));
} finally {
  await browser.close();
  const failed = results.filter((r) => !r.pass);
  process.stdout.write(
    `\n${failed.length ? `FAIL ${failed.length}` : "ALL PASS"} (${results.length})\n`,
  );
}
