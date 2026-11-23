#!/usr/bin/env node
// S2 §9 숨김 prop live (2026-11-24, S2 체크리스트 §9.1 · §9.2 「숨김」): binding 이 받기만 하고 패널에
// 내지 않는 S2 · RAC prop 이 Publish 의 RAC 컴포넌트에 닿는다.
//   1. Components 패널 「number field」 → Design 패널에 「Increment label」 · 「Decrement label」 칸이 없다
//   2. 명령으로 incrementAriaLabel 「More」 · decrementAriaLabel 「Less」 → Publish 증감 버튼 aria-label
//   3. 「select」 autoComplete 「country」 → Publish 숨은 select 의 autocomplete
//   4. 「grid list」 selectionMode multiple · escapeKeyBehavior none → Publish 에서 항목 클릭 뒤 Esc 에도 선택 유지
//   5. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-hidden-props-live.mjs <out-dir>
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/s2-hidden-props-live";
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

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("hidden props live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  // 1. NumberField: no panel field for the hidden labels.
  await place(/^number field$/i);
  const numberId = await write("NumberField", {});
  await page.evaluate((id) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    ws.selectItems([ws.itemOfRecord(id)]);
  }, numberId);
  await openDesign();
  await page.waitForTimeout(800);
  const panelText = await page
    .locator(".panel-wrapper[data-panel='properties']")
    .innerText();
  await page.screenshot({ path: `${OUT}/builder-numberfield-panel.png` });
  record(
    "1 Design 패널에 Increment · Decrement label 칸 없음 (숨김)",
    panelText.length > 50 &&
      !/Increment label|Decrement label/i.test(panelText),
    { panelLength: panelText.length },
  );

  // 2 · 3 · 4. Writes (hidden — commands), then Publish.
  await write("NumberField", {
    incrementAriaLabel: "More",
    decrementAriaLabel: "Less",
  });
  await place(/^select$|^picker$/i);
  await write("Select", { autoComplete: "country" });
  await place(/^grid list$/i);
  await write("GridList", {
    selectionMode: "multiple",
    escapeKeyBehavior: "none",
  });
  await page.waitForTimeout(1000);

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
  await pub.waitForSelector(".react-aria-NumberField", { timeout: 60000 });
  await pub.waitForTimeout(1500);
  const labels = await pub.evaluate(() =>
    [...document.querySelectorAll(".react-aria-NumberField button")].map((b) =>
      b.getAttribute("aria-label"),
    ),
  );
  record(
    "2 Publish NumberField 증감 버튼 aria-label = More · Less",
    labels.includes("More") && labels.includes("Less"),
    { labels },
  );
  const autoComplete = await pub.evaluate(() =>
    [...document.querySelectorAll("select, input")]
      .map((el) => el.getAttribute("autocomplete"))
      .filter(Boolean),
  );
  record(
    "3 Publish Select 의 숨은 select autocomplete = country",
    autoComplete.includes("country"),
    { autoComplete },
  );
  const row = pub.locator(".react-aria-GridList [role='row']").first();
  await row.click();
  await pub.waitForTimeout(300);
  const before = await row.getAttribute("aria-selected");
  await pub.keyboard.press("Escape");
  await pub.waitForTimeout(300);
  const after = await row.getAttribute("aria-selected");
  await pub.screenshot({ path: `${OUT}/publish.png` });
  record(
    "4 Publish GridList escapeKeyBehavior none: 클릭 → 선택, Esc 뒤에도 선택",
    before === "true" && after === "true",
    { before, after },
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
