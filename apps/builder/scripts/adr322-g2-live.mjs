#!/usr/bin/env node
// ADR-322 G2 live — Cascader 의 `columns` 방식 (Phase 2): 실제 Builder 에서 팔레트로 놓고 Publish 에서
// 키보드 · 포인터 전 경로를 Chrome · WebKit 으로 돈다. 판정값은 브라우저의 focus · DOM 속성 · 접근성
// 스냅샷 (기대값은 이 파일에 따로 적었다 — 원본의 표본 항목 세 단계).
//   1. Tab 으로 여는 Button · Enter 로 첫 단계 menu (첫 항목 focus) · aria-expanded
//   2. → · → 로 셋째 단계 · ↓ Enter 로 고르기 → 전부 닫힘 · focus 가 Button · 값 글자 = 경로
//   3. 다시 열면 고른 항목 menuitemradio [checked] (접근성 스냅샷) · ← 로 한 단계 닫힘 · Esc 로 전부
//   4. 포인터: Button 누르기 → 가지 항목에 올리면 하위 menu → 끝 항목 누르기 → 값 글자
//   5. 접근성 스냅샷 — 첫 단계 menu (가지 = menuitem + 하위 메뉴, 끝 = menuitemradio)
//   6. page error 0
//
//   BROWSER=webkit BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr322-g2-live.mjs <out-dir>
import { mkdirSync, readFileSync } from "node:fs";
import { chromium, webkit } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr322-g2-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const HEADLESS = process.argv.includes("--headless");
const WEBKIT = process.env.BROWSER === "webkit";
const NAME = WEBKIT ? "webkit" : "chrome";

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
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

const settle = (p, ms = 250) => p.waitForTimeout(ms);
const focused = (p) =>
  p.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "body";
    if (el.closest(".react-aria-Cascader") && el.tagName === "BUTTON")
      return "open";
    return `${el.getAttribute("role") ?? el.tagName.toLowerCase()}:${el.textContent?.trim()}`;
  });
const menus = (p) => p.locator('[role="menu"]').count();
const valueText = (p) =>
  p.evaluate(
    () =>
      document.querySelector(".react-aria-Cascader .react-aria-SelectValue")
        ?.textContent,
  );

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await settle(page, 300);
  await page.keyboard.type(`adr322 g2 live ${NAME}`);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
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
  await pub.waitForSelector(".react-aria-Cascader button", { timeout: 60000 });
  await settle(pub, 800);
  const button = pub.locator(".react-aria-Cascader button").first();

  // 1. keyboard open
  await button.focus();
  await pub.keyboard.press("Enter");
  await pub.waitForSelector('[role="menu"]', { timeout: 10000 });
  await settle(pub);
  record(
    "1 Enter → 첫 단계 menu · 첫 항목 focus · aria-expanded",
    (await menus(pub)) === 1 &&
      (await focused(pub)) === "menuitem:Electronics" &&
      (await button.getAttribute("aria-expanded")) === "true",
    {
      menus: await menus(pub),
      focus: await focused(pub),
      expanded: await button.getAttribute("aria-expanded"),
    },
  );
  await pub.screenshot({ path: `${OUT}/${NAME}-open.png` });
  const firstSnap = await pub.locator('[role="menu"]').first().ariaSnapshot();
  record(
    "5 접근성 — 첫 단계: 가지 menuitem (하위 메뉴) · 끝 menuitemradio",
    /menuitem "Electronics"/.test(firstSnap) &&
      /menuitem "Clothing"/.test(firstSnap) &&
      /menuitemradio "Books"/.test(firstSnap),
    firstSnap.replace(/\n/g, " ¶ "),
  );

  // 2. into the third level, pick
  await pub.keyboard.press("ArrowRight");
  await settle(pub);
  const second = await focused(pub);
  await pub.keyboard.press("ArrowRight");
  await settle(pub);
  const third = await focused(pub);
  await pub.keyboard.press("ArrowDown");
  await settle(pub, 100);
  await pub.keyboard.press("Enter");
  await settle(pub, 600);
  record(
    "2 → → ↓ Enter — 닫힘 · focus Button · 값 = 경로",
    second === "menuitem:Computers" &&
      third === "menuitemradio:Laptops" &&
      (await menus(pub)) === 0 &&
      (await focused(pub)) === "open" &&
      (await valueText(pub)) === "Electronics / Computers / Desktops",
    {
      second,
      third,
      menus: await menus(pub),
      focus: await focused(pub),
      value: await valueText(pub),
    },
  );

  // 3. reopen — checked, ← one level, Esc all
  await pub.keyboard.press("Enter");
  await settle(pub);
  await pub.keyboard.press("ArrowRight");
  await settle(pub);
  await pub.keyboard.press("ArrowRight");
  await settle(pub);
  const thirdSnap = await pub.locator('[role="menu"]').nth(2).ariaSnapshot();
  await pub.keyboard.press("ArrowLeft");
  await settle(pub);
  const afterLeft = { menus: await menus(pub), focus: await focused(pub) };
  for (let i = 0; i < 3 && (await menus(pub)); i++) {
    await pub.keyboard.press("Escape");
    await settle(pub);
  }
  await settle(pub, 300);
  record(
    "3 다시 열기 — 「Desktops」 [checked] · ← 한 단계 닫힘 · Esc 로 전부 · focus Button",
    /menuitemradio "Desktops" \[checked\]/.test(thirdSnap) &&
      afterLeft.menus === 2 &&
      afterLeft.focus === "menuitem:Computers" &&
      (await menus(pub)) === 0 &&
      (await focused(pub)) === "open",
    {
      thirdSnap: thirdSnap.replace(/\n/g, " ¶ "),
      afterLeft,
      focus: await focused(pub),
    },
  );

  // 4. pointer
  await button.click();
  await pub.waitForSelector('[role="menu"]', { timeout: 10000 });
  await settle(pub);
  await pub.getByRole("menuitem", { name: "Electronics" }).hover();
  await settle(pub, 500);
  await pub.getByRole("menuitem", { name: "Phones" }).hover();
  await settle(pub, 500);
  await pub.getByRole("menuitemradio", { name: "Smartphones" }).click();
  await settle(pub, 600);
  record(
    "4 포인터 — 올려서 하위 menu · 끝 항목 누르기 → 값",
    (await menus(pub)) === 0 &&
      (await valueText(pub)) === "Electronics / Phones / Smartphones",
    { menus: await menus(pub), value: await valueText(pub) },
  );
  await pub.screenshot({ path: `${OUT}/${NAME}-picked.png` });
} catch (error) {
  record("실행 오류", false, String(error).split("\n").slice(0, 3).join(" | "));
}
record("6 page error 0", errors.length === 0, errors.slice(0, 4));
await browser.close();
const failed = results.filter((r) => !r.pass).length;
process.stdout.write(
  `\n[${NAME}] ${failed ? `FAIL ${failed}` : `ALL PASS ${results.length}`}\n`,
);
process.exit(failed ? 1 : 0);
