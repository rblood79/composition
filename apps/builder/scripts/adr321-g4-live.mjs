#!/usr/bin/env node
// ADR-321 G4 live — Rating (Phase 4, 사용자 결정 6 「별 5 고정」): 실제 Builder 에서 팔레트로 Rating 을 놓고
//   1. 놓은 Rating: 상자 106 × 32 (M — 별 줄 × 별 + 세로 padding) · 별 다섯이 비어 있다 (시작 값 0)
//   2. 값 3: Canvas 화면 픽셀 — 별 1 ~ 3 가운데 = 별 색, 별 4 · 5 가운데 = 바탕 · Publish 도 같은 자리 같은 색
//   3. 표시 전용 + 값 2.5: 별 3 의 왼쪽 반 = 별 색 · 오른쪽 반 = 바탕 (Canvas · Publish) · 입력 모드 2.5 → 3
//   4. 크기 S · 강조: 상자 96 × 24 · 별 색 = accent content (Canvas · Publish)
//   5. 비활성: 별 색 = disabled content (Canvas · Publish)
//   6. Publish: div.react-aria-Rating 안 span.rating-star × 5 (Phase 5 — RAC Slider · Meter) · Canvas 상자 = DOM 상자 (±1 px)
//   7. page error 0
//
//   BUILDER_URL=http://localhost:5173 AUTH_STATE=<.auth-session.json> node apps/builder/scripts/adr321-g4-live.mjs <out-dir> [--headless]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr321-g4-live";
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

/** Sample points (scene px from the Rating's corner): each star's centre · a half star's two halves. */
const STAR = { M: { star: 18, top: 7 }, S: { star: 16, top: 4 } };
const centre = (size, index) => {
  const { star, top } = STAR[size];
  return [index * (star + 4) + star / 2, top + star / 2];
};
const halves = (size, index) => {
  const { star, top } = STAR[size];
  const x = index * (star + 4);
  // (On the star's middle row, a quarter in from each side — inside the outline ring.)
  return [
    [x + star * 0.3, top + star * 0.55],
    [x + star * 0.7, top + star * 0.55],
  ];
};

const openPublish = async (recordId) => {
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
  await pub.waitForSelector(
    '.react-aria-Rating[role="group"], .react-aria-Rating[role="meter"]',
    { timeout: 30000 },
  );
  await pub.waitForTimeout(600);
  const dom = await pub.evaluate((id) => {
    const el = document.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
    const b = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      cls: String(el.className),
      w: b.width,
      h: b.height,
      // (Phase 5: an input's stars sit in the RAC SliderTrack; a star's fill is its `data-fill`.)
      stars: [...el.querySelectorAll(".rating-star")].map((child) => ({
        cls: String(child.className.baseVal ?? child.className),
        svgs: child.querySelectorAll("svg").length,
        half: child.dataset.fill === "half",
      })),
    };
  }, recordId);
  return { pub, dom };
};

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("adr321 g4 live");
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
  // (The panel covers the page's top-left, where the Rating is placed — close it.)
  await railButton(page, "components").click();
  await page.waitForTimeout(700);

  // 1. placed: 106 × 32, five empty stars.
  const placed = await rating();
  const box1 = placed && (await canvasBox(placed.id));
  const empty = [];
  for (let i = 0; i < 5; i++)
    empty.push(await canvasPixel(placed.id, ...centre("M", i)));
  record(
    "1-placed",
    !!placed && box1?.w === 106 && box1?.h === 32 && empty.every(light),
    {
      box: box1,
      centres: empty,
    },
  );
  await page.screenshot({ path: `${OUT}/1-placed.png` });

  // 2. value 3: stars 1 ~ 3 filled.
  await write(placed.id, { defaultValue: 3 });
  await page.waitForTimeout(500);
  const v3 = [];
  for (let i = 0; i < 5; i++)
    v3.push(await canvasPixel(placed.id, ...centre("M", i)));
  const ok3 = v3.slice(0, 3).every(dark) && v3.slice(3).every(light);
  record("2-canvas-value-3", ok3, { centres: v3 });
  {
    const { pub, dom } = await openPublish(placed.id);
    const p3 = [];
    for (let i = 0; i < 5; i++)
      p3.push(await publishPixel(pub, placed.id, ...centre("M", i)));
    record(
      "2-publish-value-3",
      p3.slice(0, 3).every(dark) &&
        p3.slice(3).every(light) &&
        p3.every((c, i) => near(c, v3[i])),
      { publish: p3, canvas: v3 },
    );
    record(
      "6-publish-dom",
      dom.tag === "div" &&
        dom.cls.includes("react-aria-Rating") &&
        dom.stars.length === 5 &&
        dom.stars.every((s) => s.cls === "rating-star") &&
        Math.abs(dom.w - box1.w) <= 1 &&
        Math.abs(dom.h - box1.h) <= 1,
      { dom, canvas: box1 },
    );
    await pub.screenshot({ path: `${OUT}/2-publish.png` });
    await pub.close();
  }

  // 3. display only 2.5: the third star's left half filled; input mode rounds 2.5 to 3.
  await write(placed.id, { defaultValue: 2.5 });
  await page.waitForTimeout(400);
  const rounded = await canvasPixel(placed.id, ...centre("M", 2));
  await write(placed.id, { isReadOnly: true });
  await page.waitForTimeout(500);
  const [leftPoint, rightPoint] = halves("M", 2);
  const cl = await canvasPixel(placed.id, ...leftPoint);
  const cr = await canvasPixel(placed.id, ...rightPoint);
  record("3-canvas-half", dark(rounded) && dark(cl) && light(cr), {
    inputMode25: rounded,
    left: cl,
    right: cr,
  });
  await page.screenshot({ path: `${OUT}/3-half.png` });
  {
    const { pub, dom } = await openPublish(placed.id);
    const pl = await publishPixel(pub, placed.id, ...leftPoint);
    const pr = await publishPixel(pub, placed.id, ...rightPoint);
    record(
      "3-publish-half",
      dark(pl) &&
        light(pr) &&
        near(pl, cl) &&
        near(pr, cr) &&
        dom.stars[2]?.half,
      { left: pl, right: pr, stars: dom.stars },
    );
    await pub.screenshot({ path: `${OUT}/3-publish.png` });
    await pub.close();
  }

  // 4. size S · emphasized: 96 × 24, accent content.
  await write(placed.id, {
    isReadOnly: null,
    defaultValue: 2,
    size: "S",
    isEmphasized: true,
  });
  await page.waitForTimeout(600);
  const box4 = await canvasBox(placed.id);
  const accent = await canvasPixel(placed.id, ...centre("S", 0));
  const accentWant = [59, 99, 251];
  record(
    "4-canvas-S-emphasized",
    box4?.w === 96 && box4?.h === 24 && near(accent, accentWant, 30),
    { box: box4, centre: accent },
  );
  {
    const { pub, dom } = await openPublish(placed.id);
    const pa = await publishPixel(pub, placed.id, ...centre("S", 0));
    record(
      "4-publish-S-emphasized",
      Math.abs(dom.w - 96) <= 1 &&
        Math.abs(dom.h - 24) <= 1 &&
        near(pa, accent),
      { dom: { w: dom.w, h: dom.h }, publish: pa, canvas: accent },
    );
    await pub.close();
  }

  // 5. disabled: disabled content.
  await write(placed.id, { isDisabled: true });
  await page.waitForTimeout(500);
  const disabled = await canvasPixel(placed.id, ...centre("S", 0));
  const disabledWant = [198, 198, 198];
  {
    const { pub } = await openPublish(placed.id);
    const pd = await publishPixel(pub, placed.id, ...centre("S", 0));
    record(
      "5-disabled",
      near(disabled, disabledWant, 20) && near(pd, disabled),
      { canvas: disabled, publish: pd },
    );
    await pub.screenshot({ path: `${OUT}/5-publish.png` });
    await pub.close();
  }
  await page.screenshot({ path: `${OUT}/5-disabled.png` });

  record("7-page-errors", errors.length === 0, { errors });
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
