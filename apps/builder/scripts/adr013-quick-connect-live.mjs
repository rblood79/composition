#!/usr/bin/env node
// adr013-quick-connect-live.mjs — ADR-013 Quick Connect live (실제 빌더, headed Playwright).
//   1) 팔레트로 ListBox 추가 → 선택 → Properties Data 행 「New table」 → Creator 가 연결 모드
//      (대상 note + 「Create & connect」)
//   2) 그 사이 다른 요소 (Button) 를 선택해도 대상은 ListBox — preset 생성 후 ListBox 의
//      `props.dataBinding.collectionId` = 새 collection · `x-composition.dataBinding` 없음 · Button 무변경
//   3) History: undo 1회 → collection 삭제 (store · IndexedDB) + 바인딩 해제 · redo → 같은 id 로 복원
//   4) 대상 삭제 후 「Create & connect」 → 무변경 (collection 수 그대로 · 오류 토스트)
//   5) 일반 Data 패널 Add Table → note 0 · 「Create」 (종전 동작)
//   6) page error 0 · native dialog 0
//   --types=ListBox,GridList,... : 2) 를 여러 대상 타입으로 반복 (기본 ListBox 만)
// 사용: node apps/builder/scripts/adr013-quick-connect-live.mjs [--headed] [--types=A,B]
//       (dev 서버 5173 · .auth-session.json)
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR =
  process.env.ADR013_OUT ?? "/private/tmp/adr013-quick-connect-live";
const headed = process.argv.includes("--headed");
const typesArg = process.argv.find((a) => a.startsWith("--types="));
const TYPES = typesArg ? typesArg.slice(8).split(",") : ["ListBox"];
const log = (...a) => console.log("[adr013 live]", ...a);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
};

const RAIL_ORDER = [
  "navigator",
  "components",
  "datatable",
  "datatableEditor",
  "theme",
  "ai",
  "properties",
  "styles",
  "interactions",
  "history",
];
async function setPanel(page, panelId, open) {
  const button = page
    .locator(".panel-toggle-rail button")
    .nth(RAIL_ORDER.indexOf(panelId));
  if (((await button.getAttribute("aria-pressed")) === "true") !== open) {
    await button.click();
    await page.waitForTimeout(900);
  }
}

async function idbCollections(page, projectId) {
  return page.evaluate(async (projectId) => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("composition");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const rows = await new Promise((res, rej) => {
      const r = db
        .transaction("collections", "readonly")
        .objectStore("collections")
        .getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    db.close();
    return rows.filter((row) => row.project_id === projectId);
  }, projectId);
}

/** 요소의 두 바인딩 자리 (canonical 노드 기준) */
async function bindingOf(page, id) {
  return page.evaluate((elementId) => {
    const st = window.__composition_STORE__.getState();
    const snap = st.readCanonicalDataBindingSnapshot(elementId);
    const el = st.elements.find((e) => e.id === elementId);
    return {
      exists: Boolean(el),
      props: snap?.props ?? null,
      extension: snap?.extension ?? null,
      customId: el?.customId ?? null,
    };
  }, id);
}

/** Preview(Compare Mode) iframe 에서 대상 요소의 항목 수 — ListBox option · GridList/Table row · Menu menuitem */
async function readPreviewItems(page, elementId) {
  // iframe 은 compare 토글마다 교체돼 첫 그리기까지 수 초 — 대상이 나타날 때까지 기다린다
  await page
    .waitForFunction(
      (id) =>
        [...document.querySelectorAll("iframe")].some((f) =>
          f.contentDocument?.querySelector(`[data-element-id^="${id}"]`),
        ),
      elementId,
      { timeout: 15_000 },
    )
    .catch(() => {});
  return page.evaluate((id) => {
    for (const frame of document.querySelectorAll("iframe")) {
      const doc = frame.contentDocument;
      const el = doc?.querySelector(`[data-element-id^="${id}"]`);
      if (!el) continue;
      const items = el.querySelectorAll(
        '[role="option"], [role="row"]:not([aria-rowindex="1"]) , [role="menuitem"], [role="gridcell"]',
      );
      return {
        found: true,
        role: el.getAttribute("role"),
        items: items.length,
        text: (el.textContent ?? "").slice(0, 120),
      };
    }
    return { found: false };
  }, elementId);
}
/**
 * Compare Mode 는 한 번만 켠다 — 토글마다 iframe 이 교체되고 새 iframe 은 다음 canonical 변경까지
 * 문서를 못 받는 경우가 있어 (resend gap) 켠 채로 두고 읽는다.
 */
async function ensureCompareMode(page) {
  const compare = page
    .locator(".header_right .builder-control-group button")
    .first();
  if (
    (await compare.getAttribute("aria-pressed")) !== "true" &&
    (await compare.getAttribute("aria-checked")) !== "true"
  ) {
    await compare.click();
    await page.waitForTimeout(2500);
  }
}
async function withCompareMode(page, fn) {
  await ensureCompareMode(page);
  return fn();
}
/** Preview 반영은 비동기 (postMessage → 렌더) — 조건이 맞을 때까지 다시 읽는다 */
async function waitPreviewItems(
  page,
  elementId,
  predicate,
  timeoutMs = 12_000,
) {
  const start = Date.now();
  let last = await readPreviewItems(page, elementId);
  while (!predicate(last) && Date.now() - start < timeoutMs) {
    await page.waitForTimeout(500);
    last = await readPreviewItems(page, elementId);
  }
  return last;
}

async function addFromPalette(page, type) {
  await setPanel(page, "components", true);
  await page.evaluate(() =>
    window.__composition_STORE__.getState().setSelectedElement(null),
  );
  // 새 프로젝트의 팔레트는 Components 페이지 origin 의 `ref` 인스턴스를 놓는다 (type:"ref" +
  //   componentName) — 직접 노드와 인스턴스 둘 다 대상으로 본다
  const before = await page.evaluate(
    (t) =>
      window.__composition_STORE__
        .getState()
        .elements.filter((e) => e.type === t || e.componentName === t)
        .map((e) => e.id),
    type,
  );
  // 팔레트 라벨은 소문자 + 공백 ("list box") — 검색창으로 좁힌 뒤 라벨을 공백 제거·소문자로 대조
  const search = page
    .locator(
      '[data-panel-id="components"] input[type="search"], [data-panel-id="components"] input',
    )
    .first();
  await search.waitFor({ state: "visible", timeout: 20_000 });
  await search.fill(type);
  await page.waitForTimeout(400);
  const items = page.locator(`[data-panel-id="components"] .list-item`);
  const n = await items.count();
  let item = null;
  for (let i = 0; i < n; i++) {
    const label =
      (await items.nth(i).locator(".list-item-name").textContent()) ?? "";
    if (label.replace(/\s+/g, "").toLowerCase() === type.toLowerCase()) {
      item = items.nth(i);
      break;
    }
  }
  if (!item) throw new Error(`팔레트에 ${type} 없음 (${n} items)`);
  await item.click();
  const id = await page
    .waitForFunction(
      ({ t, before }) =>
        window.__composition_STORE__
          .getState()
          .elements.find(
            (e) =>
              (e.type === t || e.componentName === t) && !before.includes(e.id),
          )?.id ?? null,
      { t: type, before },
      { timeout: 15_000 },
    )
    .then((h) => h.jsonValue())
    .catch(() => null);
  await page.waitForTimeout(800);
  if (!id) {
    const types = await page.evaluate(() =>
      window.__composition_STORE__.getState().elements.map((e) => e.type),
    );
    throw new Error(`${type} 미생성 (elements: ${types.join(",")})`);
  }
  await setPanel(page, "components", false);
  return id;
}

async function openConnectCreator(page, elementId) {
  await page.evaluate(
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    elementId,
  );
  await page.waitForTimeout(600);
  await setPanel(page, "properties", true);
  const newTable = page
    .locator('[data-panel-id="properties"] button[aria-label="New table"]')
    .first();
  await newTable.waitFor({ state: "visible", timeout: 10_000 });
  await newTable.click();
  const creator = page.locator(".datatable-creator");
  await creator.waitFor({ timeout: 10_000 });
  return creator;
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({
  storageState: STORAGE_STATE,
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning")
    consoleErrors.push(`${m.type()}: ${m.text().slice(0, 300)}`);
});
let dialogs = 0;
page.on("dialog", (d) => {
  dialogs += 1;
  d.dismiss().catch(() => {});
});

try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr013-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const projectId = page.url().split("/builder/")[1];
  log("project", projectId);

  await ensureCompareMode(page);

  // 미끼 요소 — 실행 중 선택을 이쪽으로 옮긴다
  const buttonId = await addFromPalette(page, "Button");

  for (const type of TYPES) {
    const targetId = await addFromPalette(page, type);
    const targetBefore = await bindingOf(page, targetId);
    const creator = await openConnectCreator(page, targetId);

    // 1) 연결 모드 표시
    const note = await creator.locator(".creator-connect-target").textContent();
    const footer = await creator
      .locator(".creator-footer button")
      .last()
      .textContent();
    record(
      `${type}: Creator 연결 모드 — 대상 note + 「Create & connect」`,
      (note ?? "").includes(targetBefore.customId) &&
        footer === "Create & connect",
      `${note} / ${footer}`,
    );
    await page.screenshot({
      path: resolve(OUT_DIR, `${type}-1-connect-mode.png`),
    });

    // 2) 선택을 Button 으로 옮긴 뒤 preset 생성
    await page.evaluate(
      (id) => window.__composition_STORE__.getState().setSelectedElement(id),
      buttonId,
    );
    await page.waitForTimeout(500);
    const stillOpen = await creator.isVisible();
    const collectionsBefore = (await idbCollections(page, projectId)).length;
    const tableName = `${type} contacts`;
    await creator.locator('input[type="text"]').first().fill(tableName);
    await creator
      .locator(".preset-card", { hasText: "Contacts" })
      .first()
      .click();
    await creator.locator(".creator-footer button").last().click();
    await page.waitForFunction(
      (name) =>
        (
          document.querySelector(
            '[data-panel-id="datatableEditor"] .panel-header',
          )?.textContent ?? ""
        ).includes(name),
      tableName,
      { timeout: 20_000 },
    );
    await page.waitForTimeout(800);
    const collections = await idbCollections(page, projectId);
    const created = collections.find((c) => c.name === tableName);
    const target = await bindingOf(page, targetId);
    const decoy = await bindingOf(page, buttonId);
    const status = await page
      .locator(
        '[data-panel-id="datatableEditor"] [role="status"], .datatable-panel [role="status"]',
      )
      .first()
      .textContent()
      .catch(() => "");
    record(
      `${type}: 생성+연결 — 원래 대상 props.dataBinding.collectionId = 새 collection · extension 없음 · 미끼 Button 무변경 · 선택 변경 중에도 Creator 유지`,
      stillOpen &&
        Boolean(created) &&
        collections.length === collectionsBefore + 1 &&
        target.props?.source === "dataTable" &&
        target.props?.collectionId === created?.id &&
        target.extension === null &&
        decoy.props === null,
      JSON.stringify({
        stillOpen,
        createdId: created?.id,
        target: target.props,
        ext: target.extension,
        decoy: decoy.props,
        status,
      }),
    );
    await page.screenshot({
      path: resolve(OUT_DIR, `${type}-2-connected.png`),
    });

    // 2a) Preview 가 바인딩 데이터를 그린다 (0건 아님) — Select/ComboBox 는 팝오버 닫힘이라 존재만
    const rows = created?.mockData?.length ?? 0;
    const popoverType =
      type === "Select" || type === "ComboBox" || type === "Menu";
    const preview = await withCompareMode(page, () =>
      waitPreviewItems(
        page,
        targetId,
        (p) => p.found && (popoverType || p.items > 0),
      ),
    );
    record(
      `${type}: Preview 가 연결 데이터를 그린다 (${rows}행)`,
      preview.found && (popoverType || preview.items > 0),
      JSON.stringify(preview),
    );

    // 2b) Table 직접 노드 — schema 컬럼이 TableHeader 에 생겼고 (key = field key) Preview 를
    //     열어 두어도 늦은 ADD_COLUMN_ELEMENTS 로 중복되지 않는다
    const columnsOf = () =>
      page.evaluate((tableId) => {
        const els = window.__composition_STORE__.getState().elements;
        const header = els.find(
          (e) => e.parent_id === tableId && e.type === "TableHeader",
        );
        return header
          ? els
              .filter((e) => e.parent_id === header.id && e.type === "Column")
              .map((e) => e.props.key)
          : null;
      }, targetId);
    const isDirectTable = await page.evaluate(
      (id) =>
        window.__composition_STORE__
          .getState()
          .elements.find((e) => e.id === id)?.type === "Table",
      targetId,
    );
    if (isDirectTable) {
      const schemaKeys = created?.schema.map((f) => f.key) ?? [];
      const cols = await columnsOf();
      // 그룹과 버튼이 같은 aria-label — 버튼 (마지막) 을 누른다
      // 라벨이 켜짐/꺼짐에 따라 바뀌므로 그룹 안 첫 버튼으로 잡는다
      await ensureCompareMode(page);
      await page.waitForTimeout(3000);
      const previewHeaders = await page.evaluate((id) => {
        for (const frame of document.querySelectorAll("iframe")) {
          const doc = frame.contentDocument;
          const table = doc?.querySelector(`[data-element-id^="${id}"]`);
          const ths = table?.querySelectorAll('[role="columnheader"]');
          if (ths && ths.length)
            return [...ths].map((t) => t.textContent?.trim());
        }
        return null;
      }, targetId);
      const colsAfterPreview = await columnsOf();
      record(
        "Table: schema 컬럼이 TableHeader 에 생성 (key = field key) · Preview 를 열어도 중복 0",
        JSON.stringify(cols) === JSON.stringify(schemaKeys) &&
          JSON.stringify(colsAfterPreview) === JSON.stringify(schemaKeys),
        JSON.stringify({ schemaKeys, cols, colsAfterPreview, previewHeaders }),
      );
      await page.screenshot({
        path: resolve(OUT_DIR, `${type}-2b-columns.png`),
      });
    }

    // 3) undo 1회 → collection + 바인딩 (+ Table 컬럼) 함께 원상 · redo → 같은 id
    if (process.env.ADR013_DEBUG) {
      const dump = await page.evaluate(() => {
        const st = window.__composition_STORE__.getState();
        const frames = [...document.querySelectorAll("iframe")].map((f) => ({
          src: f.src,
          ids: [
            ...(f.contentDocument?.querySelectorAll("[data-element-id]") ?? []),
          ]
            .slice(0, 40)
            .map((e) => e.getAttribute("data-element-id")),
        }));
        return { page: st.currentPageId, frames };
      });
      const entries = await page.evaluate(() => {
        // historyManager 는 전역이 아니라 store 액션으로만 — 페이지 스택 길이는 History 패널 store 가 안다
        return window.__composition_STORE__.getState().historyState ?? null;
      });
      log("DEBUG", JSON.stringify({ targetId, dump, entries }).slice(0, 1500));
    }
    await page.evaluate(() => window.__composition_STORE__.getState().undo());
    await page.waitForTimeout(1200);
    const afterUndo = {
      idb: (await idbCollections(page, projectId)).some(
        (c) => c.id === created?.id,
      ),
      binding: await bindingOf(page, targetId),
      cols: isDirectTable ? await columnsOf() : null,
    };
    await page.evaluate(() => window.__composition_STORE__.getState().redo());
    await page.waitForTimeout(1200);
    const afterRedo = {
      idb: (await idbCollections(page, projectId)).some(
        (c) => c.id === created?.id,
      ),
      binding: await bindingOf(page, targetId),
      cols: isDirectTable ? await columnsOf() : null,
    };
    record(
      `${type}: undo 1회 = collection 삭제 + 바인딩 해제${isDirectTable ? " + 컬럼 제거" : ""} · redo = 같은 id 로 복원`,
      afterUndo.idb === false &&
        afterUndo.binding.props === null &&
        afterRedo.idb === true &&
        afterRedo.binding.props?.collectionId === created?.id &&
        (!isDirectTable ||
          (afterUndo.cols?.length === 0 &&
            JSON.stringify(afterRedo.cols) ===
              JSON.stringify(created?.schema.map((f) => f.key)))),
      JSON.stringify({
        undo: {
          idb: afterUndo.idb,
          props: afterUndo.binding.props,
          cols: afterUndo.cols,
        },
        redo: {
          idb: afterRedo.idb,
          props: afterRedo.binding.props,
          cols: afterRedo.cols,
        },
      }),
    );

    // 3b) Table 재연결 — 기존 컬럼 보존 (기본) → 명시적 교체
    if (isDirectTable) {
      const creator2 = await openConnectCreator(page, targetId);
      const keptNote = await creator2
        .locator("[data-column-plan]")
        .textContent();
      await creator2
        .locator(".preset-card", { hasText: "Products" })
        .first()
        .click();
      await page.waitForTimeout(300);
      const unmatchedNote = await creator2
        .locator("[data-column-plan]")
        .textContent();
      const colsBefore = await columnsOf();
      await creator2.locator(".creator-footer button").last().click();
      await page.waitForFunction(
        () =>
          /Products/.test(
            document.querySelector(
              '[data-panel-id="datatableEditor"] .panel-header',
            )?.textContent ?? "",
          ),
        null,
        { timeout: 20_000 },
      );
      await page.waitForTimeout(800);
      const colsPreserved = await columnsOf();
      const bindingPreserved = await bindingOf(page, targetId);
      const products = (await idbCollections(page, projectId)).find(
        (c) => c.name === "Products",
      );
      record(
        "Table 재연결 (기본 보존): 기존 컬럼 그대로 · 바인딩만 새 collection · 이전 collection 유지 · unmatched 표시",
        JSON.stringify(colsPreserved) === JSON.stringify(colsBefore) &&
          bindingPreserved.props?.collectionId === products?.id &&
          (await idbCollections(page, projectId)).some(
            (c) => c.id === created?.id,
          ) &&
          /kept/.test(keptNote ?? "") &&
          /missing from the new schema/.test(unmatchedNote ?? ""),
        JSON.stringify({
          keptNote,
          unmatchedNote,
          colsBefore,
          colsPreserved,
          binding: bindingPreserved.props,
        }),
      );

      // 명시적 교체
      const creator3 = await openConnectCreator(page, targetId);
      await creator3
        .locator(".preset-card", { hasText: "Products" })
        .first()
        .click();
      await creator3.locator(".react-aria-Checkbox").first().click();
      await page.waitForTimeout(200);
      await creator3.locator(".creator-footer button").last().click();
      await page.waitForTimeout(2500);
      const colsReplaced = await columnsOf();
      const productsSchema = products?.schema.map((f) => f.key) ?? [];
      const replacedOk =
        JSON.stringify(colsReplaced) === JSON.stringify(productsSchema);
      await page.evaluate(() => window.__composition_STORE__.getState().undo());
      await page.waitForTimeout(1200);
      const colsUndone = await columnsOf();
      record(
        "Table 재연결 (명시적 교체): 컬럼 = 새 schema · undo 1회로 이전 컬럼 복원",
        replacedOk &&
          JSON.stringify(colsUndone) === JSON.stringify(colsPreserved),
        JSON.stringify({ productsSchema, colsReplaced, colsUndone }),
      );
      await page.screenshot({
        path: resolve(OUT_DIR, `${type}-3b-replaced.png`),
      });
    }
  }

  // 3c) 연결된 0건 ≠ 미연결 — 빈 테이블로 연결한 ListBox 는 Preview 에서 option 0 (factory 정적 items 가 되살아나지 않음)
  {
    const emptyTarget = await addFromPalette(page, "ListBox");
    const before = await withCompareMode(page, () =>
      waitPreviewItems(page, emptyTarget, (p) => p.found && p.items > 0),
    );
    const creator = await openConnectCreator(page, emptyTarget);
    await creator.locator(".creator-method").nth(0).click();
    await creator.locator('input[type="text"]').first().fill("Empty rows");
    await creator.locator(".creator-footer button").last().click();
    await page.waitForFunction(
      () =>
        (
          document.querySelector(
            '[data-panel-id="datatableEditor"] .panel-header',
          )?.textContent ?? ""
        ).includes("Empty rows"),
      null,
      { timeout: 20_000 },
    );
    await page.waitForTimeout(800);
    const after = await withCompareMode(page, () =>
      waitPreviewItems(page, emptyTarget, (p) => p.found && p.items === 0),
    );
    const binding = await bindingOf(page, emptyTarget);
    record(
      "연결된 0건 ≠ 미연결: 빈 테이블 연결 뒤 Preview option 0 (정적 items 미복귀) · 바인딩은 새 collection",
      before.found &&
        before.items > 0 &&
        after.found &&
        after.items === 0 &&
        Boolean(binding.props?.collectionId),
      JSON.stringify({ before, after, binding: binding.props }),
    );
  }

  // 4) 대상 삭제 후 실행 → 무변경
  {
    const victimId = await addFromPalette(page, "GridList");
    const creator = await openConnectCreator(page, victimId);
    await page.evaluate(
      (id) => window.__composition_STORE__.getState().removeElement(id),
      victimId,
    );
    await page.waitForTimeout(800);
    const before = (await idbCollections(page, projectId)).length;
    await creator
      .locator(".preset-card", { hasText: "Contacts" })
      .first()
      .click();
    await creator.locator(".creator-footer button").last().click();
    await page.waitForTimeout(1500);
    const after = (await idbCollections(page, projectId)).length;
    const toast = await page
      .locator('[role="alert"], .toast, [data-toast]')
      .allTextContents()
      .catch(() => []);
    record(
      "대상 삭제 뒤 「Create & connect」 → 무변경 (collection 수 동일) + 오류 안내",
      after === before &&
        toast.some((t) => /target element is gone|대상 요소가 없어/.test(t)),
      JSON.stringify({ before, after, toast }),
    );
    await page.screenshot({ path: resolve(OUT_DIR, "4-target-missing.png") });
  }

  // 4b) G3 — 새로고침 hydration: 바인딩 · collection · (Table) 컬럼이 그대로 · 요소 삭제 뒤 collection 보존
  {
    const snapshotBefore = await page.evaluate(() => {
      const st = window.__composition_STORE__.getState();
      return st.elements
        .filter((e) => e.props?.dataBinding?.source === "dataTable")
        .map((e) => ({
          id: e.id,
          type: e.type,
          collectionId: e.props.dataBinding.collectionId,
        }));
    });
    const columnsBefore = await page.evaluate(() => {
      const st = window.__composition_STORE__.getState();
      return st.elements
        .filter((e) => e.type === "Column")
        .map((e) => [e.parent_id, e.props.key]);
    });
    const idbBefore = (await idbCollections(page, projectId))
      .map((c) => c.id)
      .sort();
    await page.reload({ waitUntil: "networkidle" });
    await waitReady(page);
    const snapshotAfter = await page.evaluate(() => {
      const st = window.__composition_STORE__.getState();
      return st.elements
        .filter((e) => e.props?.dataBinding?.source === "dataTable")
        .map((e) => ({
          id: e.id,
          type: e.type,
          collectionId: e.props.dataBinding.collectionId,
        }));
    });
    const columnsAfter = await page.evaluate(() => {
      const st = window.__composition_STORE__.getState();
      return st.elements
        .filter((e) => e.type === "Column")
        .map((e) => [e.parent_id, e.props.key]);
    });
    const idbAfter = (await idbCollections(page, projectId))
      .map((c) => c.id)
      .sort();
    record(
      "새로고침 hydration: 바인딩 요소 · Table 컬럼 · collection 이 그대로",
      snapshotBefore.length > 0 &&
        JSON.stringify(snapshotBefore) === JSON.stringify(snapshotAfter) &&
        JSON.stringify(columnsBefore) === JSON.stringify(columnsAfter) &&
        JSON.stringify(idbBefore) === JSON.stringify(idbAfter),
      JSON.stringify({
        bound: snapshotAfter.length,
        columns: columnsAfter.length,
        collections: idbAfter.length,
      }),
    );

    // 연결된 요소 삭제 → collection 은 남는다 (HC5)
    const victim = snapshotAfter[0];
    await page.evaluate(
      (id) => window.__composition_STORE__.getState().removeElement(id),
      victim.id,
    );
    await page.waitForTimeout(1000);
    const stillThere = (await idbCollections(page, projectId)).some(
      (c) => c.id === victim.collectionId,
    );
    const elementGone = await page.evaluate(
      (id) =>
        !window.__composition_STORE__
          .getState()
          .elements.some((e) => e.id === id),
      victim.id,
    );
    record(
      "연결된 요소 삭제 뒤 collection 보존",
      stillThere && elementGone,
      JSON.stringify({ victim, stillThere, elementGone }),
    );
  }

  // 5) 일반 Data 패널 Add Table — 종전 동작
  {
    await setPanel(page, "datatable", true);
    const panel = page.locator(".datatable-panel");
    await panel.waitFor({ timeout: 15_000 });
    await panel
      .locator('button:has-text("Add Table"), button:has-text("테이블 추가")')
      .click();
    const creator = page.locator(".datatable-creator");
    await creator.waitFor({ timeout: 10_000 });
    const notes = await creator.locator(".creator-connect-target").count();
    const footer = await creator
      .locator(".creator-footer button")
      .last()
      .textContent();
    record(
      "일반 Data 패널 생성은 종전 그대로 — note 0 · 「Create」",
      notes === 0 && footer === "Create",
      `${notes} / ${footer}`,
    );
  }

  record(
    "page error 0 · native dialog 0",
    errors.length === 0 && dialogs === 0,
    JSON.stringify({ errors, dialogs }),
  );
  if (process.env.ADR013_DEBUG)
    log("console", JSON.stringify(consoleErrors.slice(0, 40), null, 1));
} catch (error) {
  record("harness", false, String(error?.stack ?? error));
  await page
    .screenshot({ path: resolve(OUT_DIR, "error.png") })
    .catch(() => {});
} finally {
  writeFileSync(
    resolve(OUT_DIR, "findings.json"),
    JSON.stringify({ at: new Date().toISOString(), findings }, null, 2),
  );
  await browser.close();
}
const failed = findings.filter((f) => !f.pass).length;
log(
  `${findings.length - failed}/${findings.length} PASS → ${OUT_DIR}/findings.json`,
);
process.exit(failed === 0 ? 0 : 1);
