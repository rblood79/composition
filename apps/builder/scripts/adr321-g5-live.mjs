#!/usr/bin/env node
// ADR-321 G5 live — Rating 의 동작 (Phase 5 — 사용자 결정 5 「label · name」 · 7 「RAC Meter」): 실제 Builder 에서
// 팔레트로 Rating 을 놓고 Publish 에서
//   1. 입력 = RAC Slider (group · range input · name = 폼 값의 이름) · 상자 106 × 32
//   2. 별은 Canvas 와 같은 자리 (값 3)
//   3. 별 다섯의 왼쪽 · 가운데 · 오른쪽 누르기 15 점 = 그 별의 값 (track 배치 — Phase 0 P2)
//   4. 별 줄 왼쪽 밖 누르기는 지우지 않는다
//   5. 화살표 한 칸 · 0 까지 줄이면 지워짐 · 6. focus ring
//   7. hover 미리보기 (값은 그대로)
//   8. 표시 전용 2.5 = RAC Meter — 접근성 트리의 값 글자에 2.5 (백분율 아님) · 반쪽 별 · 누르기 없음
//   9. 비활성 — 누르기 없음 · 10. page error 0
//
//   BUILDER_URL=http://localhost:5173 AUTH_STATE=<.auth-session.json> node apps/builder/scripts/adr321-g5-live.mjs <out-dir> [--headless]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr321-g5-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const HEADLESS = process.argv.includes("--headless");

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1200)}\n`,
  );
};

const state = JSON.parse(
  readFileSync(
    process.env.AUTH_STATE ?? `${REPO}/apps/builder/scripts/.auth-session.json`,
    "utf8",
  ),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({
  headless: HEADLESS,
  channel: "chrome",
});
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 1,
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

const rating = () =>
  page.evaluate(() => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    const x = [...r.canvasInputs.values()].find(
      (x) => r.typeOf(x) === "Rating",
    );
    return x && { id: x.id, node: x.sourceId };
  });
const canvasBox = (recordId) =>
  page.evaluate((id) => {
    const b = window.__COMPOSITION_CATALOG__.canvas.boundsOf(id);
    return b && { x: b.x, y: b.y, w: b.width, h: b.height };
  }, recordId);
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

/** A Canvas screen pixel (what Skia drew) at a point of a record's box, in scene px from its corner. */
const canvasPixel = async (recordId, dx, dy) => {
  const point = await page.evaluate(
    ({ recordId, dx, dy }) => {
      const { canvas } = window.__COMPOSITION_CATALOG__;
      const box = canvas.boundsOf(recordId);
      const camera = canvas.camera();
      const rect = document
        .querySelector('[data-catalog-canvas="true"]')
        .getBoundingClientRect();
      return {
        x: rect.left + camera.x + (box.x + dx) * camera.zoom,
        y: rect.top + camera.y + (box.y + dy) * camera.zoom,
      };
    },
    { recordId, dx, dy },
  );
  const shot = await page.screenshot({
    clip: {
      x: Math.floor(point.x),
      y: Math.floor(point.y),
      width: 1,
      height: 1,
    },
  });
  const png = PNG.sync.read(shot);
  return [png.data[0], png.data[1], png.data[2]];
};
const publishPixel = async (pub, recordId, dx, dy) => {
  const b = await pub.evaluate(
    (id) =>
      document
        .querySelector(`[data-catalog-id="${CSS.escape(id)}"]`)
        .getBoundingClientRect()
        .toJSON(),
    recordId,
  );
  const shot = await pub.screenshot({
    clip: {
      x: Math.floor(b.x + dx),
      y: Math.floor(b.y + dy),
      width: 1,
      height: 1,
    },
  });
  const png = PNG.sync.read(shot);
  return [png.data[0], png.data[1], png.data[2]];
};
const near = (a, b, tolerance = 24) =>
  a.every((v, i) => Math.abs(v - b[i]) <= tolerance);
const dark = (c) => c.every((v) => v < 120);
const light = (c) => c.every((v) => v > 215);

/** Star i's centre · left · right edge points (Publish px from the Rating's corner, M: 18 px stars 22 apart, top 7). */
const STAR = 18;
const TOP = 7;
const points = (index) => {
  const x = index * (STAR + 4);
  return [
    ["left", x + 1, TOP + STAR / 2],
    ["centre", x + STAR / 2, TOP + STAR / 2],
    ["right", x + STAR - 1, TOP + STAR / 2],
  ];
};

const openPublish = async () => {
  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) =>
        ["Preview", "미리보기"].includes(b.getAttribute("aria-label")),
      )
      ?.click(),
  );
  const pub = await popup;
  await pub.setViewportSize({ width: 1200, height: 800 });
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector(".react-aria-Rating .rating-star", {
    timeout: 60000,
  });
  // (The RAC Slider · Meter is a lazy chunk — wait for it.)
  await pub.waitForSelector(
    '.react-aria-Rating[role="group"], .react-aria-Rating[role="meter"]',
    { timeout: 30000 },
  );
  await pub.waitForTimeout(400);
  return pub;
};
const read = (pub, recordId) =>
  pub.evaluate((id) => {
    const el = document.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
    const input = el.querySelector("input");
    const b = el.getBoundingClientRect();
    return {
      role: el.getAttribute("role"),
      x: b.x,
      y: b.y,
      w: b.width,
      h: b.height,
      value: input?.value,
      name: input?.name,
      type: input?.type,
      fills: [...el.querySelectorAll(".rating-star")].map(
        (s) => s.dataset.fill,
      ),
      outline: getComputedStyle(el).outlineStyle,
      valuetext: el.getAttribute("aria-valuetext"),
    };
  }, recordId);
const pubPixel = async (pub, box, dx, dy) => {
  const shot = await pub.screenshot({
    clip: {
      x: Math.floor(box.x + dx),
      y: Math.floor(box.y + dy),
      width: 1,
      height: 1,
    },
  });
  const png = PNG.sync.read(shot);
  return [png.data[0], png.data[1], png.data[2]];
};
const centres = async (pub, box) => {
  const out = [];
  for (let i = 0; i < 5; i++)
    out.push(await pubPixel(pub, box, i * 22 + 9, TOP + 9));
  return out;
};

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("adr321 g5 live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);
  await openRail("components");
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
  );
  const item = page
    .locator("button, [role='button'], [role='option'], [role='gridcell']")
    .filter({ hasText: /^rating$/i })
    .first();
  await item.waitFor({ state: "visible", timeout: 15000 });
  await item.click();
  await page.waitForTimeout(1500);
  await railButton(page, "components").click();
  await page.waitForTimeout(700);
  const placed = await rating();
  await write(placed.id, { defaultValue: 3, name: "score" });
  await page.waitForTimeout(500);

  let pub = await openPublish();
  // 1. the input is RAC's Slider: a group with a range input named for the form, value 3.
  let r = await read(pub, placed.id);
  record(
    "1-slider-dom",
    r.role === "group" &&
      r.type === "range" &&
      r.name === "score" &&
      r.value === "3" &&
      Math.abs(r.w - 106) <= 1 &&
      Math.abs(r.h - 32) <= 1,
    r,
  );
  // 2. the stars still draw where the Canvas draws them (value 3).
  const c3 = await centres(pub, r);
  record(
    "2-stars-value-3",
    c3.slice(0, 3).every(dark) && c3.slice(3).every(light),
    { c3 },
  );

  // 3. a press on each star's left · centre · right is that star's value (15 points).
  const presses = [];
  for (let i = 0; i < 5; i++)
    for (const [where, dx, dy] of points(i)) {
      await pub.mouse.click(r.x + dx, r.y + dy);
      await pub.waitForTimeout(80);
      const now = await read(pub, placed.id);
      presses.push({
        star: i + 1,
        where,
        value: now.value,
        filled: now.fills.filter((f) => f === "full").length,
      });
    }
  record(
    "3-press-15",
    presses.every((p) => p.value === String(p.star) && p.filled === p.star),
    presses.filter((p) => p.value !== String(p.star) || p.filled !== p.star),
  );

  // 4. left of the first star (the track's half slot) does not clear (design-data has no such clear).
  await pub.mouse.click(r.x + 3, r.y + 3);
  await pub.mouse.click(r.x - 6, r.y + TOP + 9);
  await pub.waitForTimeout(100);
  r = await read(pub, placed.id);
  record("4-left-of-row-no-clear", r.value === "5", { value: r.value });

  // 5. keyboard: Tab to the thumb's range input (a keyboard focus — the ring shows on the Rating box);
  //    arrows move a star, down to 0 clears.
  await pub.mouse.click(r.x + 600, r.y + 400);
  for (let i = 0; i < 10; i++) {
    await pub.keyboard.press("Tab");
    if (await pub.evaluate(() => document.activeElement?.type === "range"))
      break;
  }
  await pub.keyboard.press("ArrowLeft");
  await pub.waitForTimeout(80);
  const four = await read(pub, placed.id);
  for (let i = 0; i < 6; i++) await pub.keyboard.press("ArrowLeft");
  await pub.waitForTimeout(100);
  const zero = await read(pub, placed.id);
  const zc = await centres(pub, zero);
  await pub.keyboard.press("ArrowRight");
  await pub.waitForTimeout(80);
  const one = await read(pub, placed.id);
  record(
    "5-keys",
    four.value === "4" &&
      zero.value === "0" &&
      zero.fills.every((f) => f === "empty") &&
      zc.every(light) &&
      one.value === "1",
    { four: four.value, zero: zero.value, zeroCentres: zc, one: one.value },
  );
  record("6-focus-ring", one.outline !== "none", { outline: one.outline });

  // 7. hover preview: hovering star 4 at value 1 fills 1 ~ 4; the value stays; moving away restores.
  await pub.mouse.move(r.x + 3 * 22 + 9, r.y + TOP + 9);
  await pub.waitForTimeout(150);
  const hover = await centres(pub, r);
  const hovered = await read(pub, placed.id);
  await pub.mouse.move(r.x + 300, r.y + 200);
  await pub.waitForTimeout(150);
  const after = await centres(pub, r);
  record(
    "7-hover-preview",
    hover.slice(0, 4).every(dark) &&
      light(hover[4]) &&
      hovered.value === "1" &&
      dark(after[0]) &&
      after.slice(1).every(light),
    { hover, after, value: hovered.value },
  );
  await pub.screenshot({ path: `${OUT}/7-publish.png` });
  await pub.close();

  // 8. display only 2.5: a RAC Meter — the accessibility tree reads 「N of 5 stars」, not a percent.
  await write(placed.id, { defaultValue: 2.5, isReadOnly: true });
  await page.waitForTimeout(500);
  pub = await openPublish();
  r = await read(pub, placed.id);
  const cdp = await pub.context().newCDPSession(pub);
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  const meter = nodes.find((n) => n.role?.value === "meter");
  // (Chrome's AX node: the meter's value text is its `value` · a `valuetext` property.)
  const ax = meter && {
    name: meter.name?.value,
    value: meter.value?.value,
    valuetext:
      meter.properties?.find((p) => p.name === "valuetext")?.value?.value ??
      meter.value?.value ??
      meter.description?.value,
    properties: meter.properties?.map((p) => `${p.name}=${p.value?.value}`),
  };
  const half = [
    await pubPixel(pub, r, 2 * 22 + 18 * 0.3, TOP + 18 * 0.55),
    await pubPixel(pub, r, 2 * 22 + 18 * 0.7, TOP + 18 * 0.55),
  ];
  await pub.mouse.click(r.x + 4 * 22 + 9, r.y + TOP + 9);
  await pub.waitForTimeout(100);
  const pressed = await read(pub, placed.id);
  record(
    "8-meter",
    // (Chrome's AX tree keeps the meter's value 2.5 (not 50 %) but leaves its `valuetext` property
    //  empty — the text RAC writes (`aria-valuetext`) is checked on the element; what a screen reader
    //  reads is G6's VoiceOver check.)
    r.role === "meter" &&
      !r.type &&
      ax?.value === 2.5 &&
      /2\.5/.test(String(r.valuetext)) &&
      !/%/.test(String(r.valuetext)) &&
      dark(half[0]) &&
      light(half[1]) &&
      pressed.fills.join() === r.fills.join(),
    { r, ax, half },
  );
  await pub.close();

  // 9. disabled input: a press changes nothing.
  await write(placed.id, {
    isReadOnly: null,
    isDisabled: true,
    defaultValue: 2,
  });
  await page.waitForTimeout(500);
  pub = await openPublish();
  r = await read(pub, placed.id);
  await pub.mouse.click(r.x + 4 * 22 + 9, r.y + TOP + 9);
  await pub.waitForTimeout(100);
  const dis = await read(pub, placed.id);
  record("9-disabled-no-press", dis.value === "2", { value: dis.value });
  await pub.close();

  record("10-page-errors", errors.length === 0, { errors });
} catch (error) {
  record("run", false, { error: String(error?.stack ?? error) });
  await page.screenshot({ path: `${OUT}/error.png` }).catch(() => {});
} finally {
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
  const failed = results.filter((r) => !r.pass);
  process.stdout.write(
    failed.length
      ? `FAIL ${failed.length}/${results.length}\n`
      : `ALL PASS ${results.length}/${results.length}\n`,
  );
  await browser.close();
  process.exit(failed.length ? 1 : 0);
}
