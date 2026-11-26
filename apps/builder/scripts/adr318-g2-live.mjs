#!/usr/bin/env node
// ADR-318 G2 live — Resizable 분할창의 Preview runtime (Phase 2): Publish 에서
//   1. separator 속성 (D1 목록 — role · orientation · valuenow · valuemin · valuemax · controls → Panel id ·
//      label · tabindex)
//   2. 키: Tab 으로 손잡이 → ArrowRight +5 · ArrowLeft −5 · Home = 최소 · End = 최대, Panel 폭이 그 % ·
//      ArrowDown (축 밖) 은 값 그대로 · document 까지 가고 막지 않음
//   3. 끌기 +120px → 앞 Panel 이 120 px 커짐 (±1) · data-resizing 은 끌기 중에만
//   4. 최소 200px: 왼쪽으로 멀리 끌어도 200 에서 멈춤 · aria-valuemin = 200 의 %
//   5. 중첩: 뒤 Panel 안 세로 Group — 안쪽 손잡이의 키 · 끌기가 바깥 값을 바꾸지 않음
//   6. 비활성 (Group isDisabled): aria-disabled · tabindex −1 · 끌어도 그대로
//   7. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr318-g2-live.mjs <out-dir>
//   BROWSER=webkit 이면 Playwright WebKit 으로
import { mkdirSync, readFileSync } from "node:fs";
import { chromium, webkit } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr318-g2-live";
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
  await page.keyboard.type("adr318 g2 live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  // The outer Group, then a Group inside its second Panel (selected → the palette puts it inside).
  await placeGroup(false);
  const [outer0] = await groups();
  const outerPanel2 = outer0.kids[2];
  await page.evaluate((id) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    ws.selectItems([ws.itemOfRecord(id)]);
  }, outerPanel2.id);
  if (!process.env.SKIP_NESTED) await placeGroup(true);
  const all = await groups();
  const outer = all.find((g) => g.node === outer0.node);
  const inner = process.env.SKIP_NESTED
    ? outer
    : all.find((g) => g.node !== outer0.node);
  record("준비 — 바깥 Group 의 뒤 Panel 안에 안쪽 Group", !!inner, {
    outer: outer?.kids.map((k) => k.type),
    innerParent: inner?.parent === outer?.kids[2]?.id,
  });
  if (!inner) throw new Error("no inner group");
  if (!process.env.SKIP_NESTED)
    await write(inner.id, { orientation: "vertical" });
  await page.waitForTimeout(500);
  const [oP1, oH, oP2] = outer.kids.map((k) => k.id);
  const [, iH] = inner.kids.map((k) => k.id);
  const ids = [outer.id, oP1, oH, oP2, inner.id, iH];

  let pub = await openPublish(ids);
  // 1. attributes.
  const a = await attrs(pub, oH);
  const controlled = await pub.evaluate(
    (id) => document.getElementById(id)?.getAttribute("data-catalog-id"),
    a["aria-controls"],
  );
  record(
    "1 separator 속성 = D1 목록 (role · 방향 · 값 50 · 0 ~ 100 · controls = 앞 Panel · 이름 · tabindex 0)",
    a.role === "separator" &&
      a["aria-orientation"] === "vertical" &&
      a["aria-valuenow"] === "50" &&
      a["aria-valuemin"] === "0" &&
      a["aria-valuemax"] === "100" &&
      controlled === oP1 &&
      [
        "Resize panels",
        "패널 크기 조절",
        "パネルのサイズを変更",
        "调整面板大小",
      ].includes(a["aria-label"]) &&
      a.tabindex === "0" &&
      a["aria-disabled"] === null,
    { ...a, controlled },
  );
  const groupW = await width(pub, outer.id);
  const space = groupW - 1;

  // 2. keys.
  await sep(pub, oH).focus();
  await pub.keyboard.press("ArrowRight");
  await pub.waitForTimeout(200);
  const k1 = {
    now: (await attrs(pub, oH))["aria-valuenow"],
    w: await width(pub, oP1),
  };
  await pub.keyboard.press("ArrowLeft");
  await pub.keyboard.press("ArrowLeft");
  await pub.waitForTimeout(200);
  const k2 = {
    now: (await attrs(pub, oH))["aria-valuenow"],
    w: await width(pub, oP1),
  };
  await pub.keyboard.press("End");
  await pub.waitForTimeout(200);
  const k3 = (await attrs(pub, oH))["aria-valuenow"];
  await pub.keyboard.press("Home");
  await pub.waitForTimeout(200);
  const k4 = (await attrs(pub, oH))["aria-valuenow"];
  await pub.evaluate(() => {
    window.__lastKey = null;
    document.addEventListener("keydown", (e) => {
      window.__lastKey = { key: e.key, prevented: e.defaultPrevented };
    });
  });
  await pub.keyboard.press("ArrowDown");
  await pub.waitForTimeout(200);
  const off = {
    now: (await attrs(pub, oH))["aria-valuenow"],
    last: await pub.evaluate(() => window.__lastKey),
  };
  record(
    "2 키 — ArrowRight 55 · ArrowLeft ×2 45 · End 100 · Home 0 · Panel 폭 = 그 % · 축 밖 ArrowDown 은 값 그대로 · 막지 않음",
    k1.now === "55" &&
      Math.abs(k1.w - space * 0.55) <= 1 &&
      k2.now === "45" &&
      Math.abs(k2.w - space * 0.45) <= 1 &&
      k3 === "100" &&
      k4 === "0" &&
      off.now === "0" &&
      off.last?.key === "ArrowDown" &&
      off.last.prevented === false,
    { k1, k2, k3, k4, off, space },
  );
  await pub.close();

  // 3. drag (fresh Publish — sizes back to 50 / 50).
  pub = await openPublish(ids);
  {
    const w0 = await width(pub, oP1);
    const c = await center(pub, oH);
    // (The outer line's centre is the T where the inner Group's Handle meets it — the outer wins.)
    const hit = await pub.evaluate(
      ({ x, y }) =>
        document.elementFromPoint(x, y)?.getAttribute("data-catalog-id"),
      c,
    );
    await pub.mouse.move(c.x, c.y);
    await pub.mouse.down();
    let during = null;
    for (let s = 1; s <= 12; s++) {
      await pub.mouse.move(c.x + s * 10, c.y);
      if (s === 6) during = (await attrs(pub, oH))["data-resizing"];
    }
    await pub.mouse.up();
    await pub.waitForTimeout(300);
    const w1 = await width(pub, oP1);
    const after = await attrs(pub, oH);
    record(
      "3 끌기 (바깥 선 가운데 = 안쪽 손잡이와 만나는 T) +120px → 바깥 선이 잡힘 · 앞 Panel +120 (±1) · data-resizing 은 끌기 중에만 · valuenow 갱신",
      hit === oH &&
        Math.abs(w1 - w0 - 120) <= 1 &&
        during === "true" &&
        after["data-resizing"] === null &&
        Math.abs(
          Number(after["aria-valuenow"]) - Math.round((w1 / space) * 100),
        ) <= 1,
      {
        w0,
        w1,
        during,
        after: after["aria-valuenow"],
        hitOuter: hit === oH,
      },
    );
  }
  await pub.close();

  // 5. nested — the inner Handle's keys and drag leave the outer value.
  pub = await openPublish(ids);
  {
    const before = (await attrs(pub, oH))["aria-valuenow"];
    const innerBefore = (await attrs(pub, iH))["aria-valuenow"];
    await sep(pub, iH).focus();
    await pub.keyboard.press("ArrowDown");
    await pub.keyboard.press("ArrowRight"); // off its axis
    const c = await center(pub, iH);
    await pub.mouse.move(c.x, c.y);
    await pub.mouse.down();
    for (let s = 1; s <= 6; s++) await pub.mouse.move(c.x, c.y + s * 5);
    await pub.mouse.up();
    await pub.waitForTimeout(300);
    const outerAfter = (await attrs(pub, oH))["aria-valuenow"];
    const innerAfter = (await attrs(pub, iH))["aria-valuenow"];
    const ia = await attrs(pub, iH);
    record(
      "5 중첩 — 안쪽 손잡이 (세로) 키 · 끌기가 바깥 값을 바꾸지 않음 · 안쪽은 바뀜",
      outerAfter === before &&
        innerAfter !== innerBefore &&
        ia["aria-orientation"] === "horizontal",
      {
        before,
        outerAfter,
        innerBefore,
        innerAfter,
        innerOrientation: ia["aria-orientation"],
      },
    );
  }
  await pub.close();

  // 4. min 200px.
  await write(oP1, { minSize: "200px" });
  await page.waitForTimeout(600);
  pub = await openPublish(ids);
  {
    const c = await center(pub, oH);
    await pub.mouse.move(c.x, c.y);
    await pub.mouse.down();
    for (let s = 1; s <= 12; s++) await pub.mouse.move(c.x - s * 60, c.y);
    await pub.mouse.up();
    await pub.waitForTimeout(300);
    const w = await width(pub, oP1);
    const at = await attrs(pub, oH);
    record(
      "4 최소 200px — 멀리 끌어도 200 에서 멈춤 · valuemin = 200 의 %",
      Math.abs(w - 200) <= 1 &&
        at["aria-valuemin"] === String(Math.round((200 / space) * 100)),
      { w, min: at["aria-valuemin"], now: at["aria-valuenow"] },
    );
  }
  await pub.close();

  // 6. disabled Group.
  await write(outer.id, { isDisabled: true });
  await page.waitForTimeout(600);
  pub = await openPublish(ids);
  {
    const at = await attrs(pub, oH);
    const w0 = await width(pub, oP1);
    const c = await center(pub, oH);
    await pub.mouse.move(c.x, c.y);
    await pub.mouse.down();
    for (let s = 1; s <= 6; s++) await pub.mouse.move(c.x + s * 20, c.y);
    await pub.mouse.up();
    await pub.waitForTimeout(300);
    const w1 = await width(pub, oP1);
    record(
      "6 비활성 Group — aria-disabled · tabindex −1 · 끌어도 그대로",
      at["aria-disabled"] === "true" &&
        at.tabindex === "-1" &&
        Math.abs(w1 - w0) < 0.5,
      { at, w0, w1 },
    );
    await pub.screenshot({ path: `${OUT}/6-disabled.png` });
  }
  await pub.close();
  // 8. The cursor while a drag holds the pointer: the grab area's axis cursor stays — on the Handle
  //    (the pointer capture's target) and under a pointer that left the grab area (2026-11-26 사용자
  //    보고 「드래그 시작시 resizable 커서가 유지되지 않는다」).
  {
    // (item 6 left the outer Group disabled)
    await write(outer.id, { isDisabled: null });
    await page.waitForTimeout(500);
    pub = await openPublish(ids);
    const at = await center(pub, oH);
    const cursorAt = (x, y) =>
      pub.evaluate(
        ({ x, y }) => getComputedStyle(document.elementFromPoint(x, y)).cursor,
        { x, y },
      );
    const hover = await sep(pub, oH).evaluate(
      (el) => getComputedStyle(el, "::after").cursor,
    );
    await pub.mouse.move(at.x, at.y);
    await pub.mouse.down();
    await pub.mouse.move(at.x + 10, at.y);
    await pub.waitForTimeout(100);
    const onHandle = await sep(pub, oH).evaluate(
      (el) => getComputedStyle(el).cursor,
    );
    // (far off the grab area — over the Panels' content)
    await pub.mouse.move(at.x + 10, at.y + 60);
    await pub.waitForTimeout(100);
    const away = await cursorAt(at.x + 10, at.y + 60);
    await pub.mouse.up();
    await pub.waitForTimeout(200);
    const after = await cursorAt(at.x + 10, at.y + 60);
    record(
      "8 끄는 동안 커서 = 잡는 영역의 축 커서 (손잡이 · 영역 밖 포인터 아래) · 놓으면 원래대로",
      hover === "col-resize" &&
        onHandle === hover &&
        away === hover &&
        after !== hover,
      { hover, onHandle, away, after },
    );
    await pub.close();
  }
  record("7 page error 0", errors.length === 0, errors.slice(0, 5));
} catch (error) {
  record("실행 오류", false, String(error).split("\n").slice(0, 3));
} finally {
  await browser.close();
  const failed = results.filter((r) => !r.pass);
  process.stdout.write(
    `\n${failed.length ? `FAIL ${failed.length}` : "ALL PASS"} (${results.length})\n`,
  );
}
