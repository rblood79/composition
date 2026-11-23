#!/usr/bin/env node
// S2 §9 시각 prop live (2026-11-24, S2 체크리스트 §9.1 「패널」 시각):
//   1. 「color swatch picker」 density spacious · rounding full → Canvas 항목 간격 6 · swatch 원,
//      Publish 간격 6px · swatch 모서리 원
//   2. 「card view」 density compact → Canvas 카드 간격 12 · Publish gap 12px
//   3. 「accordion」 density compact · isQuiet → Publish Disclosure data-density compact · data-quiet
//   4. 「calendar」 3 개월 · selectionAlignment start → Canvas 첫 제목 = Publish 첫 제목 (이번 달)
//   5. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-visual-props-live.mjs <out-dir>
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/s2-visual-props-live";
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

/** The first record of `type` (its edit target) — and a write of `props` to it, one command. */
const write = (type, props) =>
  page.evaluate(
    ({ type, props }) => {
      const { workspace: ws, commands: c } = window.__COMPOSITION_CATALOG__;
      const r = ws.root;
      const record = [...r.canvasInputs.values()]
        .filter((x) => r.typeOf(x) === type)
        .at(-1);
      if (Object.keys(props).length)
        ws.execute(
          c.setFields({
            targets: [ws.itemOfRecord(record.id).target],
            props: Object.fromEntries(
              Object.entries(props).map(([k, v]) => [
                k,
                { kind: "set", value: v },
              ]),
            ),
          }),
        );
      return record.id;
    },
    { type, props },
  );

/** The space between the first two records of `type` (Canvas boxes). */
const canvasGap = (type) =>
  page.evaluate((type) => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    const [a, b] = [...r.canvasInputs.values()]
      .filter((x) => r.typeOf(x) === type)
      .slice(0, 2)
      .map((x) => r.getGeometry([x.id]).get(x.id));
    return b.x - (a.x + a.width);
  }, type);

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("visual props live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  await place(/^color swatch picker$/i);
  await write("ColorSwatchPicker", { density: "spacious", rounding: "full" });
  await place(/^card view$/i);
  await write("CardView", { density: "compact" });
  await place(/^accordion$/i);
  await write("Accordion", { density: "compact", isQuiet: true });
  await place(/^calendar$/i);
  await write("Calendar", {
    visibleDuration: { months: 3 },
    selectionAlignment: "start",
  });
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
  );
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/builder.png` });
  const canvas = {
    swatchGap: await canvasGap("ColorSwatchPickerItem"),
    cardGap: await canvasGap("Card"),
    swatchRounding: await page.evaluate(() => {
      const r = window.__COMPOSITION_CATALOG__.workspace.root;
      return [...r.canvasInputs.values()]
        .filter((x) => r.typeOf(x) === "ColorSwatch")
        .map((x) => x.props.rounding);
    }),
    heading: await page.evaluate(() => {
      const r = window.__COMPOSITION_CATALOG__.workspace.root;
      const heading = [...r.canvasInputs.values()].find(
        (x) => r.typeOf(x) === "CalendarHeading",
      );
      return heading
        ? String(
            heading.derivedProps?._calendarHeading ??
              heading.props.children ??
              "",
          )
        : null;
    }),
  };

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
  await pub.waitForSelector(".react-aria-ColorSwatchPicker", {
    timeout: 60000,
  });
  await pub.waitForTimeout(1500);
  await pub.screenshot({ path: `${OUT}/publish.png`, fullPage: true });
  const dom = await pub.evaluate(() => {
    const picker = document.querySelector(".react-aria-ColorSwatchPicker");
    const swatch = picker.querySelector(".react-aria-ColorSwatch");
    const view = document.querySelector(".react-aria-CardView");
    const disclosure = document.querySelector(".react-aria-Disclosure");
    const headings = [
      ...document.querySelectorAll(
        ".react-aria-Calendar .react-aria-Heading, .react-aria-Calendar h2",
      ),
    ].map((h) => h.textContent);
    return {
      swatchGap: getComputedStyle(picker).columnGap,
      swatchRadius: getComputedStyle(swatch).borderTopLeftRadius,
      swatchWidth: swatch.getBoundingClientRect().width,
      cardGap: getComputedStyle(view).columnGap,
      density: disclosure?.getAttribute("data-density"),
      quiet: disclosure?.getAttribute("data-quiet"),
      headings,
    };
  });
  const now = new Date();
  const month = [
    now.toLocaleString("en-US", { month: "long" }),
    `${now.getMonth() + 1}월`,
  ];
  record(
    "1 ColorSwatchPicker spacious · full: Canvas 간격 6 · swatch full / Publish gap 6px · 원",
    canvas.swatchGap === 6 &&
      canvas.swatchRounding.every((v) => v === "full") &&
      dom.swatchGap === "6px" &&
      parseFloat(dom.swatchRadius) >= dom.swatchWidth / 2 - 0.5,
    { canvas: { gap: canvas.swatchGap, rounding: canvas.swatchRounding }, dom },
  );
  record(
    "2 CardView compact: Canvas 간격 12 · Publish gap 12px",
    canvas.cardGap === 12 && dom.cardGap === "12px",
    { canvas: canvas.cardGap, dom: dom.cardGap },
  );
  record(
    "3 Accordion compact · quiet → Publish Disclosure data-density compact · data-quiet",
    dom.density === "compact" && dom.quiet === "true",
    { density: dom.density, quiet: dom.quiet },
  );
  record(
    "4 Calendar 3 개월 · align start: Publish 첫 달 = 이번 달",
    dom.headings.length >= 2 &&
      month.some((m) => String(dom.headings[1]).includes(m)),
    { headings: dom.headings, month, canvasHeading: canvas.heading },
  );
} catch (error) {
  record("run", false, String(error?.stack ?? error));
  await page.screenshot({ path: `${OUT}/error.png` }).catch(() => {});
}

record("5 page error 0", errors.length === 0, errors);
await browser.close();
const failed = results.filter((r) => !r.pass);
process.stdout.write(
  `\n${results.length - failed.length}/${results.length} PASS\n`,
);
process.exit(failed.length ? 1 : 0);
