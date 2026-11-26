#!/usr/bin/env node
// ADR-318 G4 live — Resizable 손잡이의 pill · grip (Phase 4): Publish 의 상태별 모양이 Canvas 도형과 같은 표
//   1. pill 휴지 4 × 24 · hover 4 × 40 · 끌기 중 6 × 48 (::before 의 크기 × transform) · 색 = 상태 토큰
//   2. 비활성 손잡이는 hover 에도 휴지 모양
//   3. keyboard focus → focus ring (outline)
//   4. withHandle: 12 × 16 grip 상자가 선 가운데 · glyph svg
//   5. Canvas 스크린샷 (pill · grip) 과 Publish 스크린샷 — 눈 대조용 · page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr318-g4-live.mjs <out-dir>
//   BROWSER=webkit 이면 Playwright WebKit 으로
import { mkdirSync, readFileSync } from "node:fs";
import { chromium, webkit } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr318-g4-live";
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

const pseudo = (pub, id) =>
  pub.locator(`[data-catalog-id="${id}"]`).evaluate((el) => {
    const cs = getComputedStyle(el, "::before");
    const m = new DOMMatrixReadOnly(
      cs.transform === "none" ? undefined : cs.transform,
    );
    return {
      w: Math.round(parseFloat(cs.width) * m.a * 100) / 100,
      h: Math.round(parseFloat(cs.height) * m.d * 100) / 100,
      bg: cs.backgroundColor,
    };
  });
const tokenColor = (pub, v) =>
  pub.evaluate((v) => {
    const probe = document.createElement("div");
    probe.style.background = v;
    document.body.append(probe);
    const c = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return c;
  }, v);

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("adr318 g4 live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);
  await placeGroup(false);
  await placeGroup(false);
  const [a, b] = await groups();
  const hA = a.kids[1].id;
  const hB = b.kids[1].id;
  await write(hA, { variant: "pill" });
  await write(hB, { withHandle: true });
  await page.waitForTimeout(800);
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
  );
  await page.waitForTimeout(400);
  const handleBox = await page.evaluate((id) => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    return r.getGeometry([id]).get(id);
  }, hB);
  await page.screenshot({ path: `${OUT}/canvas.png` });
  const ids = [a.id, hA, b.id, hB];
  let pub = await openPublish(ids);
  await pub.mouse.move(5, 900);
  await pub.waitForTimeout(500);
  const rest = await pseudo(pub, hA);
  const c = await center(pub, hA);
  await pub.mouse.move(c.x, c.y);
  await pub.waitForTimeout(500);
  const hover = await pseudo(pub, hA);
  await pub.mouse.down();
  await pub.mouse.move(c.x + 5, c.y);
  await pub.mouse.move(c.x + 10, c.y);
  await pub.waitForTimeout(500);
  const pressed = await pseudo(pub, hA);
  await pub.mouse.up();
  await pub.waitForTimeout(500);
  const released = {
    resizing: await pub
      .locator(`[data-catalog-id="${hA}"]`)
      .getAttribute("data-resizing"),
    pill: await pseudo(pub, hA),
  };
  const colors = {
    rest: await tokenColor(pub, "var(--border)"),
    hover: await tokenColor(pub, "var(--border-hover)"),
    pressed: await tokenColor(pub, "var(--accent)"),
  };
  record(
    "1 pill — 휴지 4 × 24 · hover 4 × 40 · 끌기 중 6 × 48 · 놓으면 hover 로 · 색 = 상태 토큰",
    rest.w === 4 &&
      rest.h === 24 &&
      hover.w === 4 &&
      hover.h === 40 &&
      pressed.w === 6 &&
      pressed.h === 48 &&
      rest.bg === colors.rest &&
      hover.bg === colors.hover &&
      pressed.bg === colors.pressed &&
      released.resizing === null &&
      released.pill.h === 40,
    { rest, hover, pressed, released, colors },
  );
  // 4. grip.
  const grip = await pub.locator(`[data-catalog-id="${hB}"]`).evaluate((el) => {
    const g = el.querySelector(".resizable-grip");
    const r = g?.getBoundingClientRect();
    const hr = el.getBoundingClientRect();
    return (
      r && {
        w: r.width,
        h: r.height,
        dx: Math.round((r.x + r.width / 2 - (hr.x + hr.width / 2)) * 10) / 10,
        dy: Math.round((r.y + r.height / 2 - (hr.y + hr.height / 2)) * 10) / 10,
        svg: !!g.querySelector("svg"),
        bg: getComputedStyle(g).backgroundColor,
      }
    );
  });
  record(
    "4 withHandle — 12 × 16 grip 이 선 가운데 · glyph svg · 색 = --border",
    !!grip &&
      grip.w === 12 &&
      grip.h === 16 &&
      grip.dx === 0 &&
      grip.dy === 0 &&
      grip.svg &&
      grip.bg === colors.rest,
    grip,
  );
  // 3. focus ring.
  await pub.keyboard.press("Tab");
  let focused = null;
  for (let i = 0; i < 8; i++) {
    focused = await pub.evaluate(() =>
      document.activeElement?.getAttribute("role"),
    );
    if (focused === "separator") break;
    await pub.keyboard.press("Tab");
  }
  const ring = await pub.evaluate(() => {
    const el = document.activeElement;
    const cs = getComputedStyle(el);
    return {
      visible: el.hasAttribute("data-focus-visible"),
      outline: cs.outlineStyle,
      width: cs.outlineWidth,
    };
  });
  record(
    "3 keyboard focus → data-focus-visible · outline",
    focused === "separator" && ring.visible && ring.outline !== "none",
    { focused, ring },
  );
  await pub.screenshot({ path: `${OUT}/publish.png` });
  await pub.close();
  // 2. disabled: hover keeps the rest shape.
  await write(a.id, { isDisabled: true });
  await page.waitForTimeout(600);
  pub = await openPublish(ids);
  const c2 = await center(pub, hA);
  await pub.mouse.move(c2.x, c2.y);
  await pub.waitForTimeout(500);
  const disabledHover = await pseudo(pub, hA);
  record(
    "2 비활성 손잡이 — hover 에도 휴지 4 × 24",
    disabledHover.w === 4 && disabledHover.h === 24,
    disabledHover,
  );
  await pub.close();
  record("5 page error 0", errors.length === 0, errors.slice(0, 5));
} catch (error) {
  record("실행 오류", false, String(error).split("\n").slice(0, 3));
} finally {
  await browser.close();
  const failed = results.filter((r) => !r.pass);
  process.stdout.write(
    `\n${failed.length ? `FAIL ${failed.length}` : "ALL PASS"} (${results.length})\n`,
  );
}
