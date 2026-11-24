#!/usr/bin/env node
// 그룹 명령의 ⌘G 단축키 · 한국어 문구 live (ADR-316 §4.7 — 2026-11-24 남은 확인):
//   1. 한국어 (composition-locale ko-KR) 에서 frame 둘 선택 → 캔버스 focus → ⌘G → 새 frame 하나 (노드 이름 「Group」) 가 둘을 품는다
//   2. Layers 행 이름 「Group」 (노드 이름은 번역하지 않는다)
//   3. ⌘⇧G → 그룹 해제 (frame 둘이 다시 본문 아래)
//   4. Layers 행 우클릭 메뉴에 「그룹화」 (단축키 표시 ⌘G 포함)
//   5. 머리 메뉴 검색 「그룹」 → 「그룹화」 · 「그룹 해제」 와 단축키 표시
//   6. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/frame-group-shortcut-ko-live.mjs <out-dir>
//   BROWSER=webkit 이면 Playwright WebKit 으로 (⌘ = Meta)
import { mkdirSync, readFileSync } from "node:fs";
import { chromium, webkit } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/frame-group-shortcut-ko-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const useWebkit = process.env.BROWSER === "webkit";

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
const browser = useWebkit
  ? await webkit.launch({ headless: false })
  : await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1920, height: 1100 },
});
await context.addInitScript(() => {
  try {
    localStorage.setItem("composition-locale", "ko-KR");
  } catch {}
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

/** The page body's frames (direct and nested): record id · node name · parent's type · children. */
const frames = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const r = ws.root;
    const graph = ws.runtime.graph;
    const inputs = [...r.canvasInputs.values()];
    const parentOf = new Map();
    for (const x of inputs) for (const c of x.children) parentOf.set(c, x.id);
    return inputs
      .filter((x) => r.typeOf(x) === "frame")
      .map((x) => ({
        record: x.id,
        name: graph.getEntry(x.sourceId)?.name,
        parent: parentOf.get(x.id),
        children: x.children.length,
      }));
  });

const selectRecords = (ids) =>
  page.evaluate((ids) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    ws.selectItems(ids.map((id) => ws.itemOfRecord(id)));
  }, ids);

const focusCanvas = () =>
  page.evaluate(() =>
    document
      .querySelector('[data-canvas-container="true"]')
      ?.focus({ preventScroll: true }),
  );

const layersTree = () =>
  page.getByRole("treegrid", { name: "Layers", exact: true });

const layerNames = async () => {
  const tree = layersTree();
  await tree.waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(600);
  return tree
    .getByRole("row")
    .evaluateAll((rows) =>
      rows.map((row) => (row.textContent ?? "").replace(/\s+/g, " ").trim()),
    );
};

try {
  await page.goto(`${BASE}/dashboard`);
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10000 });
  await input.fill(`group-ko-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 90000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  // Set-up: two frames placed from the palette (Components rail — the first rail button whose
  // panel lists 「frame」).
  const placeFrame = async () => {
    await page.evaluate(() =>
      window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
    );
    const item = page
      .locator("button.list-item")
      .filter({ hasText: /^frame$/i })
      .first();
    if (!(await item.isVisible().catch(() => false))) {
      await page
        .locator('.panel-toggle-rail button[aria-label="컴포넌트"]')
        .first()
        .click();
      await page.waitForTimeout(900);
    }
    await item.waitFor({ state: "visible", timeout: 15000 });
    await item.click();
    await page.waitForTimeout(1500);
  };
  await placeFrame();
  await placeFrame();
  const placed = await frames();

  // 1. ⌘G on the focused canvas.
  await selectRecords(placed.map((f) => f.record));
  await focusCanvas();
  await page.keyboard.press("Meta+g");
  await page.waitForTimeout(1200);
  const grouped = await frames();
  const group = grouped.find((f) => f.name === "Group");
  const insideGroup = grouped.filter((f) => group && f.parent === group.record);
  record(
    "1 ⌘G (캔버스 focus) → frame 「Group」 하나가 frame 둘을 품는다",
    placed.length === 2 && !!group && insideGroup.length === 2,
    { placed: placed.length, frames: grouped },
  );

  // 2. Layers row 「Group」.
  await page
    .locator('.panel-toggle-rail button[aria-label="탐색기"]')
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(900);
  const names = await layerNames();
  await page.screenshot({ path: `${OUT}/2-layers-group.png` });
  record("2 Layers 행 이름 「Group」", names.includes("Group"), { names });

  // 4. Context menu on the group's Layers row.
  let menuTexts = [];
  try {
    // Select the two inner frames first so 「그룹화」 is an enabled choice.
    await selectRecords(insideGroup.map((f) => f.record));
    await page.waitForTimeout(400);
    const innerRow = layersTree()
      .locator('[role="row"][aria-selected="true"]')
      .first();
    await innerRow.click({ button: "right" });
    await page.waitForTimeout(600);
    menuTexts = await page
      .getByRole("menuitem")
      .evaluateAll((items) =>
        items.map((i) => (i.textContent ?? "").replace(/\s+/g, " ").trim()),
      );
    await page.screenshot({ path: `${OUT}/4-context-menu.png` });
    await page.keyboard.press("Escape");
  } catch (error) {
    menuTexts = [`error: ${String(error).slice(0, 200)}`];
  }
  record(
    "4 Layers 우클릭 메뉴에 「그룹화」 (⌘G 표시)",
    menuTexts.some((t) => t.includes("그룹화") && /⌘\s*G|G$/i.test(t)),
    {
      group: menuTexts.filter((t) => t.includes("그룹")),
      count: menuTexts.length,
    },
  );

  // 3. ⌘⇧G ungroups the group.
  await selectRecords([group.record]);
  await focusCanvas();
  await page.keyboard.press("Meta+Shift+g");
  await page.waitForTimeout(1200);
  const ungrouped = await frames();
  record(
    "3 ⌘⇧G → 그룹 해제 (frame 둘 · 「Group」 없음)",
    ungrouped.length === 2 && !ungrouped.some((f) => f.name === "Group"),
    { frames: ungrouped },
  );

  // 5. Header menu search 「그룹」.
  let headerTexts = [];
  try {
    await page
      .getByRole("button", { name: "메뉴", exact: true })
      .first()
      .click();
    await page.waitForTimeout(500);
    await page.getByRole("searchbox").first().fill("그룹");
    await page.waitForTimeout(600);
    headerTexts = await page
      .getByRole("menuitem")
      .evaluateAll((items) =>
        items.map((i) => (i.textContent ?? "").replace(/\s+/g, " ").trim()),
      );
    await page.screenshot({ path: `${OUT}/5-header-menu.png` });
    await page.keyboard.press("Escape");
  } catch (error) {
    headerTexts = [`error: ${String(error).slice(0, 200)}`];
  }
  record(
    "5 머리 메뉴 검색 「그룹」 → 「그룹화」 · 「그룹 해제」",
    headerTexts.some((t) => t.startsWith("그룹화")) &&
      headerTexts.some((t) => t.startsWith("그룹 해제")),
    { items: headerTexts },
  );

  record("6 page error 0", errors.length === 0, { errors });
} catch (error) {
  record("run", false, { error: String(error).slice(0, 800), errors });
  await page.screenshot({ path: `${OUT}/error.png` }).catch(() => {});
} finally {
  await browser.close();
  const failed = results.filter((r) => !r.pass).length;
  process.stdout.write(`\n${results.length - failed}/${results.length} PASS\n`);
  process.exitCode = failed ? 1 : 0;
}
