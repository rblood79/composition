#!/usr/bin/env node
// ADR-317 Phase 1 — 사용자 결정 8 live: EditableCell 에 그 열 타입으로 읽을 수 없는 값을 저장하면
// 칸이 비워지지 않고 원래 값이 남는다 (세션 `update` 의 판정 — 묶음 쓰기와 같은 함수).
//   1. Components 「table」 → Table · Users (status = number) 연결 · status Column 「Editable」
//   2. Publish: 첫 행 status (2) 편집 → 「abc」 Save → 칸 그대로 2 · 경고 「읽을 수 없는 값」
//   3. 같은 칸 「7」 Save → 7 (읽히는 값은 그대로 쓴다) · 「」 (빈 값) Save → 빈 칸
//   4. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr317-p1-editable-unread-live.mjs <out-dir>
//
// (아래는 s2-editable-cell-live.mjs 의 머리 — 열기 · 연결 · 스위치 도우미.)
// S2 TableFooter look · EditableCell live (2026-11-23, S2 체크리스트 §9.3 6-6):
//   1. Components 패널 「table」 → Table, 데이터 (Users — name · type · status) 연결 · 다중 선택
//   2. Design 패널: Column 「name」 선택 → 「Editable」 스위치 켜기 / Table 선택 → 「Totals row」 켜기
//   3. Canvas: name 칸마다 Form (닫힘 — 안 그림) · edit 버튼 (상자만 · 글리프 안 그림) ·
//      합계 행 바탕 gray-200 (#e1e1e1) · 합계 칸 굵게 700
//   4. Publish: 휴지 edit 버튼 visibility hidden → 행 hover 때 visible · 누르면 popover Form
//      (name 칸 = 값) → 고쳐서 Save → 칸 글자 바뀜 · 다시 열어 Cancel → 그대로
//   5. Publish 합계 행: 바탕 rgb(225, 225, 225) · 칸 font-weight 700 · 누르기 · 전체 선택에도 선택 안 됨
//   6. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-editable-cell-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr317-p1-live";
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

/** The Table's records on the Canvas: its ids, the name Column, the footer row and the parts. */
const tableRecords = () =>
  page.evaluate(() => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    const all = [...r.canvasInputs.values()];
    const type = (x) => r.typeOf(x);
    const table = all.find((x) => type(x) === "Table");
    const header = all.find((x) => type(x) === "TableHeader");
    const name = header?.children
      .map((c) => r.canvasInputs.get(c))
      .find((c) => c?.props.key === "status");
    return {
      table: table?.id,
      name: name?.id,
      forms: all.filter((x) => type(x) === "Form").map((x) => x.id),
      buttons: all
        .filter((x) => type(x) === "ActionButton" && x.props.slot === "edit")
        .map((x) => x.id),
      footerRow: all.find(
        (x) =>
          type(x) === "Row" &&
          type(r.canvasInputs.get(x.parentId) ?? {}) === "TableFooter",
      )?.id,
    };
  });

const selectRecord = (id) =>
  page.evaluate((id) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    ws.selectItems([ws.itemOfRecord(id)]);
  }, id);

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

/** A Design panel switch by its label (the Property tab). */
const flip = async (label, shot) => {
  const toggle = page.getByRole("switch", { name: label }).first();
  try {
    await toggle.waitFor({ state: "attached", timeout: 15000 });
  } catch (error) {
    await page.screenshot({ path: `${OUT}/${shot}-missing.png` });
    const text = await page
      .locator('.panel-wrapper[data-panel="properties"]')
      .textContent();
    throw new Error(`${String(error)}\npanel: ${text?.slice(0, 1200)}`);
  }
  // (RAC Switch: the role is on its visually hidden input — its own click toggles it.)
  await toggle.evaluate((el) => el.click());
  await page.waitForTimeout(1200);
};

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("adr317 unread live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  // 1. Components panel → Table, then its data.
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
            mockData: [
              { id: "p1", name: "Bora", type: "B", status: 2 },
              { id: "p2", name: "Chan", type: "A", status: 1 },
              { id: "p3", name: "Ara", type: "B", status: 3 },
            ],
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
  record(
    "1 Components 「table」 → Table · Users 연결 · status Column",
    !!bound.table && !!bound.name,
    bound,
  );

  // 2. status Column 「Editable」 · Publish.
  await selectRecord(bound.name);
  await openDesign();
  await flip(/^Editable$|^편집 가능$/, "editable");
  const after = await tableRecords();
  record(
    "1b status Column 「Editable」 → 칸마다 Form",
    after.forms.length > 0,
    after.forms.length,
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
  const warns = [];
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  pub.on("console", (m) => {
    if (m.type() === "warning" || m.type() === "warn") warns.push(m.text());
  });
  await pub.setViewportSize({ width: 1920, height: 1100 });
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector('tbody [role="row"]', { timeout: 60000 });
  await pub.waitForTimeout(1200);
  const row = pub.locator('tbody [role="row"]').first();
  const statusText = () =>
    row.evaluate((el) => {
      const cells = [
        ...el.querySelectorAll('[role="gridcell"], [role="rowheader"]'),
      ];
      const cell = cells.find((c) => c.querySelector('[slot="edit"]'));
      return (cell?.textContent ?? "").trim();
    });
  const save = async (text) => {
    await row.hover();
    await row.locator('[slot="edit"]').click();
    await pub.waitForSelector(".catalog-edit-cell-popover form", {
      timeout: 10000,
    });
    const input = pub.locator(
      '.catalog-edit-cell-popover input[name="status"]',
    );
    const start = await input.inputValue();
    await input.fill(text);
    await pub.getByRole("button", { name: /^Save$|^저장$/ }).click();
    await pub.waitForTimeout(900);
    return start;
  };
  const before = await statusText();
  const startA = await save("abc");
  const afterAbc = await statusText();
  await pub.screenshot({ path: `${OUT}/publish-after-abc.png` });
  const warned = warns.some(
    (w) => w.includes("Editable cell") && w.includes("status"),
  );
  record(
    "2 Publish: status 2 → 「abc」 Save → 칸 그대로 · 경고에 읽을 수 없는 필드",
    before === "2" && startA === "2" && afterAbc === "2" && warned,
    { before, startA, afterAbc, warns: warns.slice(-3) },
  );
  await save("7");
  const after7 = await statusText();
  await save("");
  const afterEmpty = await statusText();
  record(
    "3 Publish: 「7」 → 7 · 빈 값 → 빈 칸",
    after7 === "7" && afterEmpty === "",
    { after7, afterEmpty },
  );
  await pub.close();
  record("4 page error 0", errors.length === 0, errors);
} catch (error) {
  record("error", false, String(error?.stack ?? error));
} finally {
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
