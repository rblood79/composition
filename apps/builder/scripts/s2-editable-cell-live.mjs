#!/usr/bin/env node
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

const OUT = process.argv[2] ?? "/private/tmp/s2-editable-cell-live";
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
      .find((c) => c?.props.key === "name");
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
  await page.keyboard.type("editable cell live");
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
    "1 Components 「table」 → Table · Users 연결 · name Column",
    !!bound.table && !!bound.name,
    bound,
  );

  // 2. Design panel switches.
  await selectRecord(bound.name);
  await openDesign();
  await flip(/^Editable$|^편집 가능$/, "editable");
  await page.screenshot({ path: `${OUT}/builder-column-editable.png` });
  await selectRecord(bound.table);
  await page.waitForTimeout(800);
  await flip(/^Totals row$|^합계 행$/, "totals");
  const after = await tableRecords();
  record(
    "2 Design 패널: Column 「Editable」 → name 칸마다 Form · edit 버튼 / Table 「Totals row」 → 합계 행",
    after.forms.length > 0 &&
      after.buttons.length === after.forms.length &&
      !!after.footerRow,
    after,
  );

  // 3. Canvas.
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
  );
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/builder-canvas.png` });
  const canvas = await page.evaluate(
    async ({ ids, repo }) => {
      const h = window.__COMPOSITION_CATALOG__;
      const r = h.workspace.root;
      // (Dev server modules — the app's own instances.)
      const binding =
        await import("/src/builder/catalogRuntime/canvasBinding.ts");
      const library = await import(
        `/@fs${repo}/packages/shared/src/catalog/runtime/libraryVisual.ts`
      );
      const data = (id) => binding.catalogCanvasNodeData(r, id);
      const geometry = (id) => r.getGeometry([id]).get(id);
      const footer = r.canvasInputs.get(ids.footerRow);
      const derived = (record) => library.catalogDerivedRestVisual(r, record);
      return {
        formsHidden: ids.forms.map((id) => data(id)?.visible),
        buttons: ids.buttons.map((id) => ({
          visible: data(id)?.visible,
          width: geometry(id)?.width,
          derived: r.canvasInputs.get(id).derivedProps?._editButtonHidden,
        })),
        footerFill: data(ids.footerRow)?.box?.fillColor
          ? [...data(ids.footerRow).box.fillColor].map((c) =>
              Math.round(c * 255),
            )
          : footer?.derivedProps,
        footerCells: footer.children.map((c) => {
          const cell = r.canvasInputs.get(c);
          return { ...cell.visual, ...derived(cell) }.fontWeight;
        }),
      };
    },
    { ids: after, repo: REPO },
  );
  record(
    "3 Canvas: Form 안 그림 · edit 버튼 상자만 · 합계 행 #e1e1e1 · 합계 칸 700",
    canvas.formsHidden.every((v) => v === false) &&
      canvas.buttons.every(
        (b) => b.visible === false && b.width > 0 && b.derived === true,
      ) &&
      JSON.stringify(canvas.footerFill) ===
        JSON.stringify([225, 225, 225, 255]) &&
      canvas.footerCells.every((w) => w === 700),
    canvas,
  );

  // 4 · 5. Publish.
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
  await pub.waitForSelector('tbody [role="row"]', { timeout: 60000 });
  await pub.waitForTimeout(1200);
  const firstName = () =>
    pub.evaluate(
      () =>
        document
          .querySelector('tbody [role="row"] [role="rowheader"]')
          ?.textContent?.trim() ?? "",
    );
  const editButton = pub
    .locator('tbody [role="row"]')
    .first()
    .locator('[slot="edit"]');
  const restVisibility = await editButton.evaluate(
    (el) => getComputedStyle(el).visibility,
  );
  await pub.locator('tbody [role="row"]').first().hover();
  await pub.waitForTimeout(300);
  const hoverVisibility = await editButton.evaluate(
    (el) => getComputedStyle(el).visibility,
  );
  await pub.screenshot({ path: `${OUT}/publish-hover.png` });
  await editButton.click();
  await pub.waitForSelector(".catalog-edit-cell-popover form", {
    timeout: 10000,
  });
  await pub.waitForTimeout(500);
  const input = pub.locator('.catalog-edit-cell-popover input[name="name"]');
  const startValue = await input.inputValue();
  const popoverBox = await pub
    .locator(".catalog-edit-cell-popover")
    .evaluate((el) => {
      const b = el.getBoundingClientRect();
      return {
        width: Math.round(b.width),
        padding: getComputedStyle(el.querySelector(".catalog-edit-cell-body"))
          .paddingTop,
      };
    });
  await pub.screenshot({ path: `${OUT}/publish-popover.png` });
  await input.fill("Bori");
  await pub.getByRole("button", { name: /^Save$|^저장$/ }).click();
  await pub.waitForTimeout(800);
  const saved = await firstName();
  const closedAfterSave =
    (await pub.locator(".catalog-edit-cell-popover").count()) === 0;
  await pub.locator('tbody [role="row"]').first().hover();
  await editButton.click();
  await pub.waitForSelector(".catalog-edit-cell-popover form", {
    timeout: 10000,
  });
  await input.fill("Zed");
  await pub.getByRole("button", { name: /^Cancel$|^취소$/ }).click();
  await pub.waitForTimeout(800);
  const cancelled = await firstName();
  record(
    "4 Publish: edit 버튼 휴지 hidden → hover visible · popover (padding 8) Form 값 → Save 로 바뀜 · Cancel 은 그대로",
    restVisibility === "hidden" &&
      hoverVisibility === "visible" &&
      startValue === "Bora" &&
      popoverBox.padding === "8px" &&
      saved === "Bori" &&
      closedAfterSave &&
      cancelled === "Bori",
    {
      restVisibility,
      hoverVisibility,
      startValue,
      popoverBox,
      saved,
      closedAfterSave,
      cancelled,
    },
  );
  const footerBefore = await pub.evaluate(() => {
    const row = document.querySelector('tfoot [role="row"]');
    const cells = [
      ...row.querySelectorAll('[role="gridcell"], [role="rowheader"]'),
    ];
    return {
      background: getComputedStyle(row).backgroundColor,
      weights: cells.map((c) => getComputedStyle(c).fontWeight),
      disabled: row.hasAttribute("data-disabled"),
      opacity: getComputedStyle(row).opacity,
    };
  });
  await pub.locator('tfoot [role="row"]').first().click();
  await pub.waitForTimeout(300);
  await pub.keyboard.press(
    process.platform === "darwin" ? "Meta+KeyA" : "Control+KeyA",
  );
  await pub.waitForTimeout(400);
  await pub.screenshot({ path: `${OUT}/publish-footer.png` });
  const selection = await pub.evaluate(() => ({
    footer: document
      .querySelector('tfoot [role="row"]')
      ?.getAttribute("aria-selected"),
    body: [...document.querySelectorAll('tbody [role="row"]')].map((r) =>
      r.getAttribute("aria-selected"),
    ),
  }));
  record(
    "5 Publish 합계 행: 바탕 rgb(225, 225, 225) · 칸 700 · 흐려지지 않음 · 누르기 · 전체 선택에도 선택 안 됨",
    footerBefore.background === "rgb(225, 225, 225)" &&
      footerBefore.weights.every((w) => w === "700") &&
      !footerBefore.disabled &&
      footerBefore.opacity === "1" &&
      selection.footer !== "true",
    { footerBefore, selection },
  );
  await pub.close();
  record("6 page error 0", errors.length === 0, errors);
} catch (error) {
  record("error", false, String(error?.stack ?? error));
} finally {
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
