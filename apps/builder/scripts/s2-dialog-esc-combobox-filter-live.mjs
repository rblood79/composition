#!/usr/bin/env node
// S2 Dialog isKeyboardDismissDisabled · ComboBox filter live (2026-11-23, S2 체크리스트 부록 D.3 2단계):
//   1. Design 패널: Dialog 를 고르면 Behavior 에 「Esc 로 닫지 않음」 칩 → 문서 isKeyboardDismissDisabled true
//   2. Design 패널: ComboBox 의 「필터 방식」 을 「으로 시작」 으로 → 문서 defaultFilter "startsWith"
//   3. Publish: Dialog 를 열고 Esc → 열린 채 (Modal 의 RAC isKeyboardDismissDisabled)
//   4. Publish: ComboBox 에 「a」 → Aardvark 만 (시작). 같은 화면의 둘째 ComboBox (기본 — 포함) 는 Aardvark · Cat · Kangaroo
//   5. Undo: 두 편집을 되돌리면 두 prop 이 없다
//   6. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-dialog-esc-combobox-filter-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT =
  process.argv[2] ?? "/private/tmp/s2-dialog-esc-combobox-filter-live";
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
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("dialog esc combobox filter live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    {
      timeout: 30000,
    },
  );
  await page.waitForTimeout(1500);

  const placed = await page.evaluate(() => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const r = ws.root;
    const ctx = {
      graph: ws.runtime.graph,
      records: ws.root.domInputs,
      selection: () => [],
      itemOfRecord: (i) => ws.itemOfRecord(i),
      pageContent: () => ({ kind: "node", id: "project:node:home-body" }),
      newId: ws.newId,
    };
    const add = (type) => {
      const before = new Set(r.canvasInputs.keys());
      ws.execute(h.palette.catalogPaletteInsertPlan(ctx, type).command);
      return [...r.canvasInputs.values()].filter((x) => !before.has(x.id));
    };
    const trigger = add("Dialog");
    const dialog = trigger.find((x) => r.typeOf(x) === "Dialog");
    const first = add("ComboBox").find((x) => r.typeOf(x) === "ComboBox");
    const second = add("ComboBox").find((x) => r.typeOf(x) === "ComboBox");
    return {
      dialogRecord: dialog?.id,
      comboRecord: first.id,
      combo: first.sourceId,
      second: second.sourceId,
    };
  });
  await page.waitForTimeout(800);

  const panel = page.locator('.panel-wrapper[data-panel="properties"]');
  const select = (recordId) =>
    page.evaluate((id) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      ws.selectItems([ws.itemOfRecord(id)]);
    }, recordId);
  // (The record's resolved prop — a Dialog inside the placed instance is written as its override.)
  const readProp = (recordId, key) =>
    page.evaluate(
      ({ id, key }) =>
        window.__COMPOSITION_CATALOG__.workspace.root.canvasInputs.get(id)
          ?.props?.[key],
      { id: recordId, key },
    );

  // 1. Dialog: the chip in Behavior.
  await select(placed.dialogRecord);
  await page.waitForTimeout(800);
  if (!(await panel.isVisible())) {
    await page.mouse.click(1895, 572);
    await page.waitForTimeout(1000);
  }
  const chip = panel.getByRole("button", {
    name: /^(Escape won't close|Esc 로 닫지 않음)$/,
  });
  await chip.scrollIntoViewIfNeeded();
  await chip.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/builder-dialog.png` });
  const locked = await readProp(
    placed.dialogRecord,
    "isKeyboardDismissDisabled",
  );
  const derived = await page.evaluate(() => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    const modal = [...r.canvasInputs.values()].find(
      (x) => r.typeOf(x) === "Modal",
    );
    return modal?.derivedProps?._dialogKeyboardDismissDisabled;
  });
  record(
    "1 패널: Dialog 「Esc 로 닫지 않음」 칩 → isKeyboardDismissDisabled · Modal 파생",
    locked === true && derived === true,
    { locked, derived },
  );

  // 2. ComboBox: 「Filter mode」 → 「Starts with」.
  await select(placed.comboRecord);
  await page.waitForTimeout(800);
  const filterField = panel.getByRole("group", {
    name: /^(Filter mode|필터 방식)$/,
  });
  await filterField.scrollIntoViewIfNeeded();
  // (Two options — the panel's segmented toggle.)
  await filterField.getByText(/^(Starts with|으로 시작)$/).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/builder-combobox.png` });
  const filter = await readProp(placed.comboRecord, "defaultFilter");
  record(
    "2 패널: ComboBox 필터 방식 「으로 시작」 → defaultFilter",
    filter === "startsWith",
    {
      filter,
    },
  );
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
  );
  await page.waitForTimeout(400);

  // 3 – 4. Publish.
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
  await pub.setViewportSize({ width: 1920, height: 1100 });
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector(".react-aria-ComboBox", { timeout: 60000 });
  await pub.waitForTimeout(1500);

  // (The DialogTrigger's Button — the first page button outside the ComboBoxes.)
  const triggerButton = pub
    .locator("button")
    .filter({ hasNot: pub.locator(".react-aria-ComboBox") })
    .first();
  await triggerButton.click();
  await pub.waitForTimeout(500);
  const openBefore = await pub.locator('[role="dialog"]').count();
  await pub.keyboard.press("Escape");
  await pub.waitForTimeout(500);
  const openAfter = await pub.locator('[role="dialog"]').count();
  await pub.screenshot({ path: `${OUT}/publish-dialog-after-esc.png` });
  record(
    "3 Publish: Dialog 를 열고 Esc → 열린 채",
    openBefore > 0 && openAfter > 0,
    {
      openBefore,
      openAfter,
    },
  );
  // (Close it by its own Cancel · Close button so the page is free.)
  await pub
    .locator('[role="dialog"] button')
    .first()
    .click()
    .catch(() => {});
  await pub.waitForTimeout(500);

  const optionsAfter = async (n) => {
    const input = pub.locator(".react-aria-ComboBox input").nth(n);
    await input.click();
    await input.fill("a");
    await pub.waitForTimeout(500);
    const shown = await pub.locator('[role="option"]').allTextContents();
    await pub.keyboard.press("Escape");
    await input.fill("");
    await pub.keyboard.press("Escape");
    await pub.waitForTimeout(300);
    return shown.map((text) => text.trim());
  };
  const starts = await optionsAfter(0);
  await pub.screenshot({ path: `${OUT}/publish-combobox.png` });
  const contains = await optionsAfter(1);
  record(
    "4 Publish: 「a」 — 시작은 Aardvark, 기본 (포함) 은 Aardvark · Cat · Kangaroo",
    same(starts, ["Aardvark"]) &&
      same(contains, ["Aardvark", "Cat", "Kangaroo"]),
    { starts, contains },
  );
  await pub.close();

  // 5. Undo both edits.
  const undone = await page.evaluate(
    ({ dialog, combo }) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const r = ws.root;
      const read = () => {
        const d = r.canvasInputs.get(dialog)?.props?.isKeyboardDismissDisabled;
        const c = r.canvasInputs.get(combo)?.props?.defaultFilter;
        return { d, c };
      };
      for (
        let i = 0;
        i < 6 && (read().d === true || read().c === "startsWith");
        i += 1
      )
        ws.undo();
      return read();
    },
    { dialog: placed.dialogRecord, combo: placed.comboRecord },
  );
  record(
    "5 Undo: 두 편집이 없다",
    undone.d !== true && undone.c !== "startsWith",
    { undone },
  );
  record("6 page error 0", errors.length === 0, errors);
} catch (error) {
  record("error", false, String(error?.stack ?? error));
} finally {
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
