#!/usr/bin/env node
// Meter 채움색 live (2026-11-24, S2 체크리스트 parity 정리): S2 `Meter.tsx` fillStyles 는 상태색의
// `-visual` 단 (informative-800 …) 이다. Canvas 는 이미 그 값이었고 생성 CSS 만 `var(--informative)` 였다.
//   1. Components 패널 「meter」 · Design 패널 Value 60 → Publish 의 `.fill` 계산색 = `--informative-visual` (≠ `--informative`)
//   2. Canvas 크롭 스크린샷에 같은 색 픽셀이 있다 (옛 `--informative` 색 픽셀은 없다)
//   3. Design 패널 Variant → negative: Publish `.fill` = `--negative-visual` · Canvas 에 같은 색
//   4. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-meter-fill-live.mjs <out-dir>
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/s2-meter-fill-live";
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

const place = async (label) => {
  const components = railButton(page, "components");
  if ((await components.getAttribute("aria-pressed")) !== "true") {
    await components.click();
    await page.waitForTimeout(900);
  }
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
  );
  const item = page
    .locator("button, [role='button'], [role='option'], [role='gridcell']")
    .filter({ hasText: label })
    .first();
  await item.waitFor({ state: "visible", timeout: 15000 });
  await item.click();
  await page.waitForTimeout(1500);
};

const openDesign = async () => {
  const components = railButton(page, "components");
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
};

const field = (label) =>
  page
    .locator(".panel-wrapper[data-panel='properties'] fieldset", {
      has: page.locator("legend", { hasText: label }),
    })
    .first();

/** Pixels of the Canvas (a cropped screenshot, decoded) within ±3 of each colour. */
async function canvasPixels(colors) {
  const canvas = page.locator("canvas").first();
  const png = await canvas.screenshot();
  return page.evaluate(
    async ({ base64, colors }) => {
      const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob();
      const bitmap = await createImageBitmap(blob);
      const off = document.createElement("canvas");
      off.width = bitmap.width;
      off.height = bitmap.height;
      const ctx = off.getContext("2d");
      ctx.drawImage(bitmap, 0, 0);
      const data = ctx.getImageData(0, 0, off.width, off.height).data;
      const out = {};
      for (const [name, [r, g, b]] of Object.entries(colors)) {
        let n = 0;
        for (let i = 0; i < data.length; i += 4)
          if (
            Math.abs(data[i] - r) <= 3 &&
            Math.abs(data[i + 1] - g) <= 3 &&
            Math.abs(data[i + 2] - b) <= 3
          )
            n++;
        out[name] = n;
      }
      return out;
    },
    { base64: png.toString("base64"), colors },
  );
}

const rgb = (s) => s.match(/\d+/g).slice(0, 3).map(Number);

async function openPublish() {
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
  await pub.waitForSelector(".react-aria-Meter .fill", { timeout: 60000 });
  await pub.waitForTimeout(1200);
  return pub;
}

/** Publish: the fill's computed colour and the two status tokens. */
const publishColors = (pub, status) =>
  pub.evaluate((status) => {
    const meter = document.querySelector(".react-aria-Meter");
    const probe = document.createElement("div");
    document.body.append(probe);
    const read = (v) => {
      probe.style.backgroundColor = v;
      return getComputedStyle(probe).backgroundColor;
    };
    const out = {
      variant: meter.dataset.variant,
      fill: getComputedStyle(meter.querySelector(".fill")).backgroundColor,
      visual: read(`var(--${status}-visual)`),
      plain: read(`var(--${status})`),
    };
    probe.remove();
    return out;
  }, status);

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("meter fill live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  await place(/^meter$|^미터$/i);
  const meterId = await page.evaluate(() => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    return [...r.canvasInputs.values()].find((x) => r.typeOf(x) === "Meter")
      ?.id;
  });

  // The template's value is 0 — the fill has no width. Design panel Value → 60.
  await page.evaluate((id) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    ws.selectItems([ws.itemOfRecord(id)]);
  }, meterId);
  await openDesign();
  const value = field(/^Value$|^값$/);
  await value.waitFor({ state: "visible", timeout: 15000 });
  // The field is a slider (+ maybe a number box): type into the box, else key the slider.
  const box = value.locator("input:not([type='range'])").first();
  if (await box.count()) {
    await box.click();
    await box.fill("60");
    await box.press("Enter");
  } else {
    const slider = value.locator("input[type='range']").first();
    await slider.focus();
    for (let i = 0; i < 60; i++) await page.keyboard.press("ArrowRight");
  }
  await page.waitForTimeout(1200);

  for (const [step, status] of [
    ["1-2", "informative"],
    ["3", "negative"],
  ]) {
    if (status !== "informative") {
      await page.evaluate((id) => {
        const ws = window.__COMPOSITION_CATALOG__.workspace;
        ws.selectItems([ws.itemOfRecord(id)]);
      }, meterId);
      await openDesign();
      const variant = field(/^Variant$|^종류$/);
      await variant.waitFor({ state: "visible", timeout: 15000 });
      const radio = variant.getByRole("radio", { name: /^Negative$|^부정$/i });
      if (await radio.count()) await radio.first().click();
      else {
        await variant.locator("button").first().click();
        await page.waitForTimeout(400);
        await page.getByRole("option", { name: /^Negative$|^부정$/i }).click();
      }
      await page.waitForTimeout(1200);
    }
    await page.evaluate(() =>
      window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
    );
    await page.mouse.move(1900, 1080);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/builder-${status}.png` });
    const pub = await openPublish();
    await pub.screenshot({ path: `${OUT}/publish-${status}.png` });
    const dom = await publishColors(pub, status);
    await pub.close();
    const pixels = await canvasPixels({
      visual: rgb(dom.visual),
      plain: rgb(dom.plain),
    });
    record(
      `${step} ${status}: Publish .fill = --${status}-visual · Canvas 에 같은 색 (옛 --${status} 색 없음)`,
      dom.fill === dom.visual &&
        dom.visual !== dom.plain &&
        pixels.visual > 50 &&
        pixels.plain === 0,
      { dom, pixels },
    );
  }
} catch (error) {
  record("run", false, String(error?.stack ?? error));
  await page.screenshot({ path: `${OUT}/error.png` }).catch(() => {});
}

record("4 page error 0", errors.length === 0, errors);
await browser.close();
const failed = results.filter((r) => !r.pass);
process.stdout.write(
  `\n${results.length - failed.length}/${results.length} PASS\n`,
);
process.exit(failed.length ? 1 : 0);
