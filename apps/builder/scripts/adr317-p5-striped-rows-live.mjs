#!/usr/bin/env node
// ADR-317 Phase 5 live — Table 「Striped rows」 in the real Builder → Publish (Chrome · WebKit):
//   1. Components 「table」 → Table · Users (1,000 행) 연결 · 가상 표 · 행 선택 multiple · Type 열
//      「Merge same values」 (Type = A A A B B B …)
//   2. Design 패널 「Striped rows」 스위치 → Table `isStriped`
//   3. Canvas: 표본 행이 둘째마다 `striped` · 병합 묶음의 Type 칸이 묶음 첫 행의 줄무늬 (`cellStripe`)
//   4. Publish: 보이는 행이 aria-rowindex 짝수마다 `data-striped` · 계산된 바탕 = table-stripe
//      (#f8f8f8) · 안 칠한 행은 Table 바탕 · inline 바탕 0
//   5. 행 선택 (클릭) → 그 행은 선택 칠 (줄무늬가 아니다)
//   6. 가상 표 스크롤 (500 행 근처) → 그려진 행이 다시 자리마다 짝 · 홀
//   7. 병합 칸: 묶음 첫 행의 줄무늬를 따른다 (`data-stripe` on · off — 계산된 바탕)
//   8. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr317-p5-striped-rows-live.mjs <out-dir> [--browser webkit]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, webkit } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr317-p5-live";
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
const BROWSER = process.argv.includes("--browser")
  ? process.argv[process.argv.indexOf("--browser") + 1]
  : "chrome";
const browser =
  BROWSER === "webkit"
    ? await webkit.launch({ headless: false })
    : await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1920, height: 1100 },
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

const STRIPE = "rgb(248, 248, 248)";
const BASE_BG = "rgb(255, 255, 255)";

const tableRecords = () =>
  page.evaluate(() => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    const all = [...r.canvasInputs.values()];
    const type = (x) => r.typeOf(x);
    const header = all.find((x) => type(x) === "TableHeader");
    const columns = header?.children.map((c) => r.canvasInputs.get(c)) ?? [];
    return {
      table: all.find((x) => type(x) === "Table")?.id,
      type: columns.find((c) => c?.props.key === "type")?.id,
    };
  });

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

/** A Design panel switch by its label (the Property tab) — or its chip (a boolean not yet shown). */
const flip = async (label, shot) => {
  const toggle = page.getByRole("switch", { name: label }).first();
  const chip = page
    .locator('.panel-wrapper[data-panel="properties"] .property-chips button')
    .filter({ hasText: label })
    .first();
  for (let i = 0; i < 30; i++) {
    if (await toggle.count()) {
      await toggle.evaluate((el) => el.click());
      await page.waitForTimeout(1200);
      return;
    }
    if (await chip.count()) {
      const before = await chip.getAttribute("aria-pressed");
      await chip.click();
      await page.waitForTimeout(1200);
      if (before === "true") return;
      if (await toggle.count()) {
        const on = await toggle.isChecked().catch(() => null);
        if (on === false) {
          await toggle.evaluate((el) => el.click());
          await page.waitForTimeout(1200);
        }
      }
      return;
    }
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: `${OUT}/${shot}-missing.png` });
  throw new Error(`no switch or chip: ${label}`);
};

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("adr317 striped rows live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);
  const components = railButton(page, "components");
  if ((await components.getAttribute("aria-pressed")) !== "true") {
    await components.click();
    await page.waitForTimeout(900);
  }
  const item = page
    .locator("button, [role='button'], [role='option'], [role='gridcell']")
    .filter({ hasText: /^table$/i })
    .first();
  await item.waitFor({ state: "visible", timeout: 15000 });
  await item.click();
  await page.waitForTimeout(1500);
  const placed = await tableRecords();
  await page.evaluate((tableId) => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    ws.execute(
      h.commands.setDataEntries({
        puts: [
          {
            kind: "collection",
            id: "data:collection:users",
            name: "Users",
            schema: [
              { id: "f-id", key: "id", type: "string" },
              { id: "f-name", key: "name", type: "string" },
              { id: "f-type", key: "type", type: "string" },
              { id: "f-status", key: "status", type: "number" },
            ],
            mockData: Array.from({ length: 1000 }, (_, i) => ({
              id: `p${i + 1}`,
              name: `Name ${i + 1}`,
              type: Math.floor(i / 3) % 2 ? "B" : "A",
              status: i + 1,
            })),
            useMockData: true,
          },
        ],
      }),
    );
    const id = ws.root.canvasInputs.get(tableId).sourceId;
    ws.execute(
      h.binding.catalogBindingCommand(
        [{ kind: "node", id }],
        h.binding.catalogBindingRef({
          source: "dataTable",
          collectionId: "users",
          name: "Users",
        }),
      ),
    );
    ws.execute(h.rowDisplay.setRowDisplay(id, { mode: "virtual" }));
    ws.execute(
      h.commands.setFields({
        targets: [ws.positionOfRecord(tableId).target],
        props: { selectionMode: { kind: "set", value: "multiple" } },
        label: "Table",
      }),
    );
  }, placed.table);
  await page.waitForTimeout(1500);
  const bound = await tableRecords();
  await page.evaluate((typeId) => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    ws.execute(
      h.commands.setFields({
        targets: [ws.positionOfRecord(typeId).target],
        props: { mergeSameValues: { kind: "set", value: true } },
        label: "Column",
      }),
    );
  }, bound.type);
  await page.waitForTimeout(1200);
  record(
    "1 Table · Users 1,000 행 · 가상 표 · 행 선택 multiple · Type 병합",
    !!bound.table && !!bound.type,
    bound,
  );

  await page.evaluate((id) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    ws.selectItems([ws.itemOfRecord(id)]);
  }, bound.table);
  await openDesign();
  await flip(/^Striped rows$|^줄무늬 행$/, "striped");
  await page.screenshot({ path: `${OUT}/builder-striped.png` });
  const props = await page.evaluate(
    (tableId) =>
      window.__COMPOSITION_CATALOG__.workspace.root.canvasInputs.get(tableId)
        .props,
    bound.table,
  );
  record("2 Design 패널 「Striped rows」 → isStriped", props.isStriped === true, {
    isStriped: props.isStriped,
  });

  const canvas = await page.evaluate(() => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    const all = [...r.canvasInputs.values()];
    const type = (x) => r.typeOf(x);
    const body = all.find((x) => type(x) === "TableBody");
    const rows = body.children
      .map((c) => r.canvasInputs.get(c))
      .filter((x) => x && type(x) === "Row");
    return rows.slice(0, 8).map((row) => ({
      striped: row.derivedProps?.striped === "true",
      cells: row.children
        .map((c) => r.canvasInputs.get(c))
        .filter((x) => x && type(x) === "Cell")
        .map((cell) => cell.derivedProps?.cellStripe ?? "-"),
    }));
  });
  // (Type A A A B B B: runs p1..p3 (unshaded first) · p4..p6 (shaded first) · p7..p9 …)
  const canvasStripes = canvas.map((row) => row.striped);
  const canvasRuns = canvas.map((row) =>
    row.cells.filter((cell) => cell !== "-"),
  );
  record(
    "3 Canvas: 둘째 행마다 striped · 병합 묶음 칸은 첫 행의 줄무늬",
    JSON.stringify(canvasStripes) ===
      JSON.stringify(canvasStripes.map((_, i) => i % 2 === 1)) &&
      JSON.stringify(canvasRuns.slice(0, 6)) ===
        JSON.stringify([[], ["off"], [], [], ["on"], []]),
    { canvasStripes, canvasRuns },
  );

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
  await pub.waitForSelector('[role="row"][data-key="p1"]', { timeout: 60000 });
  await pub.waitForTimeout(1200);
  /** The drawn body rows: place (aria-rowindex − the header's), key, mark, computed · inline paint. */
  const drawn = () =>
    pub.evaluate(() =>
      [...document.querySelectorAll('[role="row"][data-key]')]
        .map((row) => ({
          place: Number(row.getAttribute("aria-rowindex")) - 1,
          key: row.getAttribute("data-key"),
          striped: row.hasAttribute("data-striped"),
          bg: getComputedStyle(row).backgroundColor,
          inline: row.style.backgroundColor,
          selected: row.getAttribute("aria-selected") === "true",
          typeCell: (() => {
            const cell = row.querySelector('[data-stripe]');
            return cell
              ? `${cell.getAttribute("data-stripe")}:${getComputedStyle(cell).backgroundColor}`
              : "-";
          })(),
        }))
        .sort((a, b) => a.place - b.place),
    );
  const parityOk = (rows) =>
    rows.length > 0 &&
    rows.every((row) => row.striped === (row.place % 2 === 0));
  const d4 = await drawn();
  await pub.screenshot({ path: `${OUT}/publish-striped.png` });
  const shaded = d4.filter((row) => row.striped && !row.selected);
  const plain = d4.filter((row) => !row.striped && !row.selected);
  record(
    "4 Publish: aria-rowindex 짝수마다 data-striped · 바탕 #f8f8f8 · 나머지 Table 바탕 · inline 0",
    parityOk(d4) &&
      shaded.every((row) => row.bg === STRIPE) &&
      plain.every((row) => row.bg !== STRIPE) &&
      d4.every((row) => row.inline === ""),
    {
      rows: d4.length,
      first: d4.slice(0, 6).map((r) => `${r.place}:${r.key}:${r.striped}:${r.bg}`),
    },
  );

  // 5. Select the second row (shaded): its selection paint, not the stripe.
  await pub.locator('[role="row"][data-key="p2"] [role="rowheader"]').click();
  await pub.waitForTimeout(700);
  const p2 = (await drawn()).find((row) => row.key === "p2");
  record(
    "5 행 선택 → 그 행은 선택 칠 (줄무늬 아님)",
    !!p2 && p2.selected && p2.bg !== STRIPE,
    p2,
  );

  // 7 (before the scroll — the top rows hold the runs). Type A A A B B B: p2's Type cell `off`
  //    (base over a shaded row), p5's `on` (stripe over an unshaded row).
  const cells = d4
    .filter((row) => ["p2", "p5"].includes(row.key))
    .map((row) => `${row.key}:${row.typeCell}`);
  record(
    "7 병합 칸: 묶음 첫 행의 줄무늬 (p2 off → 흰 바탕 · p5 on → #f8f8f8)",
    JSON.stringify(cells) ===
      JSON.stringify([`p2:off:${BASE_BG}`, `p5:on:${STRIPE}`]),
    { cells },
  );

  // 6. Scroll the virtual Table to row ~500: the drawn rows by their place again.
  await pub.evaluate(() => {
    const grid = document.querySelector('[role="grid"]');
    const scroller =
      [grid, ...grid.querySelectorAll("*")].find(
        (el) => el.scrollHeight > el.clientHeight + 10,
      ) ?? grid;
    scroller.scrollTop = scroller.scrollHeight / 2;
  });
  await pub.waitForTimeout(1500);
  const d6 = await drawn();
  await pub.screenshot({ path: `${OUT}/publish-scrolled.png` });
  record(
    "6 가상 표 스크롤 (중간) → 그려진 행이 자리마다 짝 · 홀",
    parityOk(d6.filter((row) => !row.selected)) &&
      d6.some((row) => row.place > 300),
    {
      rows: d6.length,
      sample: d6.slice(0, 4).map((r) => `${r.place}:${r.key}:${r.striped}`),
    },
  );
  record("8 page error 0", errors.length === 0, errors);
} catch (error) {
  record("run", false, String(error?.stack ?? error));
} finally {
  writeFileSync(
    `${OUT}/results-${BROWSER}.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
  await browser.close();
}
