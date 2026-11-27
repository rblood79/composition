#!/usr/bin/env node
// ADR-322 G3 live — Cascader 의 `tree` · `drill` 방식 (Phase 3): 실제 Builder 에서 팔레트로 놓고 Publish 에서
// 키보드 · 포인터 전 경로를 Chrome · WebKit 으로 돈다. 판정값은 브라우저의 focus · DOM 속성 · 접근성
// 스냅샷 (기대값은 이 파일에 따로 적었다 — 원본의 표본 항목 세 단계).
//   1. Tab 으로 여는 Button · Enter 로 첫 단계 menu (첫 항목 focus) · aria-expanded
//   2. → · → 로 셋째 단계 · ↓ Enter 로 고르기 → 전부 닫힘 · focus 가 Button · 값 글자 = 경로
//   3. 다시 열면 고른 항목 menuitemradio [checked] (접근성 스냅샷) · ← 로 한 단계 닫힘 · Esc 로 전부
//   4. 포인터: Button 누르기 → 가지 항목에 올리면 하위 menu → 끝 항목 누르기 → 값 글자
//   5. 접근성 스냅샷 — 첫 단계 menu (가지 = menuitem + 하위 메뉴, 끝 = menuitemradio)
//   6. page error 0
//
//   BROWSER=webkit BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr322-g3-live.mjs <out-dir>
import { mkdirSync, readFileSync } from "node:fs";
import { chromium, webkit } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr322-g3-live";
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

const setMode = (mode) =>
  page.evaluate((mode) => {
    const { workspace: ws, commands: c } = window.__COMPOSITION_CATALOG__;
    const r = ws.root;
    const field = [...r.canvasInputs.values()].find(
      (x) => r.typeOf(x) === "Cascader",
    );
    ws.execute(
      c.setFields({
        targets: [ws.itemOfRecord(field.id).target],
        props: { mode: { kind: "set", value: mode } },
      }),
    );
  }, mode);

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
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector(".react-aria-Cascader button", { timeout: 60000 });
  await settle(pub, 800);
  return pub;
};
const dialogs = (p) => p.locator('[role="dialog"]').count();

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await settle(page, 300);
  await page.keyboard.type(`adr322 g3 live ${NAME}`);
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

  // ── tree ──
  await setMode("tree");
  await settle(page, 600);
  let pub = await openPublish();
  let button = pub.locator(".react-aria-Cascader button").first();
  await button.focus();
  await pub.keyboard.press("Enter");
  await pub.waitForSelector('[role="treegrid"]', { timeout: 10000 });
  await settle(pub, 400);
  const treeStart = await focused(pub);
  // (Focus may land on the dialog first — Tab into the tree.)
  if (!/^row:/.test(treeStart)) {
    await pub.keyboard.press("Tab");
    await settle(pub);
  }
  const treeFirst = await focused(pub);
  await pub.keyboard.press("ArrowRight");
  await settle(pub);
  await pub.keyboard.press("ArrowDown");
  await settle(pub);
  await pub.keyboard.press("ArrowRight");
  await settle(pub);
  await pub.keyboard.press("ArrowDown");
  await settle(pub);
  await pub.keyboard.press("ArrowDown");
  await settle(pub);
  const treeAt = await focused(pub);
  await pub.screenshot({ path: `${OUT}/${NAME}-tree-open.png` });
  const treeSnap = await pub.locator('[role="treegrid"]').ariaSnapshot();
  await pub.keyboard.press("Enter");
  await settle(pub, 600);
  record(
    "T1 tree — Enter 로 열고 → ↓ → ↓ ↓ Enter → 닫힘 · focus Button · 값 = 경로 (columns 와 같은 정답)",
    /Electronics/.test(treeFirst) &&
      /Desktops/.test(treeAt) &&
      (await dialogs(pub)) === 0 &&
      (await focused(pub)) === "open" &&
      (await valueText(pub)) === "Electronics / Computers / Desktops",
    {
      start: treeStart,
      first: treeFirst,
      at: treeAt,
      dialogs: await dialogs(pub),
      focus: await focused(pub),
      value: await valueText(pub),
    },
  );
  record(
    "T2 tree 접근성 — treegrid · 펼친 가지 [expanded]",
    /treegrid/.test(treeSnap) && /expanded/.test(treeSnap),
    treeSnap.replace(/\n/g, " ¶ ").slice(0, 600),
  );
  await pub.keyboard.press("Enter");
  await pub.waitForSelector('[role="treegrid"]', { timeout: 10000 });
  await settle(pub, 400);
  const reopenSnap = await pub.locator('[role="treegrid"]').ariaSnapshot();
  await pub.keyboard.press("Escape");
  await settle(pub, 500);
  record(
    "T3 tree — 다시 열면 조상이 펼쳐진 채 고른 행 [selected] · Esc 로 닫힘 · focus Button",
    /row "Desktops"[^¶\n]*\[selected\]/.test(reopenSnap) &&
      (await dialogs(pub)) === 0 &&
      (await focused(pub)) === "open",
    {
      snap: reopenSnap.replace(/\n/g, " ¶ ").slice(0, 600),
      dialogs: await dialogs(pub),
      focus: await focused(pub),
    },
  );
  await pub.close();

  // ── drill ──
  await setMode("drill");
  await settle(page, 600);
  pub = await openPublish();
  button = pub.locator(".react-aria-Cascader button").first();
  await button.focus();
  await pub.keyboard.press("Enter");
  await pub.waitForSelector('[role="grid"]', { timeout: 10000 });
  await settle(pub, 400);
  const drillFirst = await focused(pub);
  await pub.keyboard.press("Enter");
  await settle(pub, 300);
  const drillSecond = await focused(pub);
  await pub.keyboard.press("ArrowDown");
  await settle(pub);
  await pub.keyboard.press("Enter");
  await settle(pub, 300);
  const drillThird = await focused(pub);
  await pub.screenshot({ path: `${OUT}/${NAME}-drill-open.png` });
  await pub.keyboard.press("Enter");
  await settle(pub, 600);
  record(
    "D1 drill — Enter 로 열기 (첫 행 focus) · Enter 들어가기 · ↓ Enter · Enter 고르기 → 닫힘 · 값",
    /Electronics/.test(drillFirst) &&
      /Computers/.test(drillSecond) &&
      /Smartphones/.test(drillThird) &&
      (await dialogs(pub)) === 0 &&
      (await focused(pub)) === "open" &&
      (await valueText(pub)) === "Electronics / Phones / Smartphones",
    {
      first: drillFirst,
      second: drillSecond,
      third: drillThird,
      dialogs: await dialogs(pub),
      focus: await focused(pub),
      value: await valueText(pub),
    },
  );
  // reopen → the picked level; breadcrumb back to the top; Esc
  await pub.keyboard.press("Enter");
  await pub.waitForSelector('[role="grid"]', { timeout: 10000 });
  await settle(pub, 400);
  const gridSnap = await pub.locator('[role="grid"]').ariaSnapshot();
  await pub
    .locator(
      '[role="dialog"] .react-aria-Breadcrumbs a, [role="dialog"] .react-aria-Breadcrumbs [role="link"]',
    )
    .first()
    .click();
  await settle(pub, 400);
  const topRows = await pub
    .locator('[role="grid"] [role="row"]')
    .allTextContents();
  const afterCrumb = await focused(pub);
  await pub.keyboard.press("Escape");
  await settle(pub, 500);
  record(
    "D2 drill — 다시 열면 고른 단계 · 그 행 [selected] · breadcrumb 으로 첫 단계 · focus 유지 · Esc 닫힘",
    /row "Smartphones"[^¶\n]*\[selected\]/.test(gridSnap) &&
      topRows.join(",") === "Electronics,Clothing,Books" &&
      afterCrumb !== "body" &&
      (await dialogs(pub)) === 0,
    {
      snap: gridSnap.replace(/\n/g, " ¶ ").slice(0, 500),
      topRows,
      afterCrumb,
      dialogs: await dialogs(pub),
    },
  );
  await pub.close();
} catch (error) {
  record("실행 오류", false, String(error).split("\n").slice(0, 3).join(" | "));
}
record("E page error 0", errors.length === 0, errors.slice(0, 4));
await browser.close();
const failed = results.filter((r) => !r.pass).length;
process.stdout.write(
  `\n[${NAME}] ${failed ? `FAIL ${failed}` : `ALL PASS ${results.length}`}\n`,
);
process.exit(failed ? 1 : 0);
