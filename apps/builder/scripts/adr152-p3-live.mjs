#!/usr/bin/env node
// adr152-p3-live.mjs — ADR-152 Phase 3 (G2) live: fieldMap (value / icon) 소비 대칭.
//   ListBox · Select · Table 을 같은 collection 에 v2 바인딩 + fieldMap { value: <uid id>, icon: <glyph id> }
//   → Builder Skia 투영 행 key (layout map `projection:{listbox,table}-row:<id>:<itemKey>`) 와
//     Preview iframe DOM (ListBoxItem data-key · Select option value · Table Row data-key · 아이콘 요소) 대조.
//   대조군: fieldMap 없음 → 휴리스틱 key (`id` 컬럼) 양 leg 동일. icon 을 이미지 컬럼으로 바꾸면 DOM 이 img 로.
// 사용: node apps/builder/scripts/adr152-p3-live.mjs [--headed]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR152_OUT ?? "/private/tmp/adr152-p3";
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[ADR-152 p3 live]", ...a);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
};
const RAIL_ORDER = ["navigator", "components", "datatable", "datatableEditor", "theme", "ai", "properties", "styles", "interactions", "history"];
async function setPanel(page, panelId, open) {
  const button = page.locator(".panel-toggle-rail button").nth(RAIL_ORDER.indexOf(panelId));
  if (((await button.getAttribute("aria-pressed")) === "true") !== open) { await button.click(); await page.waitForTimeout(900); }
}
const idb = {
  async getAll(page) {
    return page.evaluate(async () => {
      const db = await new Promise((res, rej) => { const r = indexedDB.open("composition"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      const rows = await new Promise((res, rej) => { const r = db.transaction("collections", "readonly").objectStore("collections").getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      db.close(); return rows;
    });
  },
  async put(page, row) {
    return page.evaluate(async (row) => {
      const db = await new Promise((res, rej) => { const r = indexedDB.open("composition"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      await new Promise((res, rej) => { const tx = db.transaction("collections", "readwrite"); tx.objectStore("collections").put(row); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
      db.close();
    }, row);
  },
};
async function pollUntil(read, ok, maxMs = 12_000, stepMs = 400) {
  const started = Date.now(); let last;
  do { last = await read(); if (ok(last)) return last; await new Promise((r) => setTimeout(r, stepMs)); } while (Date.now() - started < maxMs);
  return last;
}
/** Skia 투영 행 key — layout map 키 `projection:<family>-row:<ownerId>:<itemKey>` 의 itemKey. */
const skiaKeys = (page, family, ownerId) =>
  page.evaluate(({ family, ownerId }) => {
    const map = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.();
    if (!map) return null;
    const prefix = `projection:${family}-row:${ownerId}:`;
    return [...map.keys()].filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length)).filter((k) => k !== "__header__").sort();
  }, { family, ownerId });

/** Preview iframe (compare 모드) DOM 읽기 — ListBox 항목 key/아이콘 · Select option · Table Row. */
async function readPreviewDom(page) {
  const toggle = page.locator('button[aria-label="Compare Mode (Preview + Skia)"], button[aria-label="비교 모드 (Preview + Skia)"]').first();
  if ((await toggle.count()) && (await toggle.getAttribute("aria-pressed")) !== "true") { await toggle.click(); await page.waitForTimeout(4000); }
  const read = async () => {
    for (const f of page.frames()) {
      if (f === page.mainFrame()) continue;
      const r = await f.evaluate(() => {
        const items = [...document.querySelectorAll(".react-aria-ListBox .react-aria-ListBoxItem")];
        // Select 의 hidden native select (RAC HiddenSelect) — option value = item key
        // 페이지에 select 가 여럿 (Table 의 페이지당 행 수 등) — Table 밖의 RAC Select hidden native select 만
        const selects = [...document.querySelectorAll("select")].filter((sel) => !sel.closest(".react-aria-Table, .table-pagination, [class*=pagination]"));
        const options = (selects[0] ? [...selects[0].options] : []).map((o) => o.value).filter((v) => v !== "");
        // Table DOM 행: aria-rowcount (행 수) + `tr.react-aria-Row[data-key]` (ADR-152 후속 — 행 id = shared itemKey)
        const tableEl = document.querySelector(".react-aria-Table");
        const tableRows = tableEl ? Number(tableEl.getAttribute("aria-rowcount") ?? 0) : 0;
        const tableKeys = [...document.querySelectorAll(".react-aria-Table tr.react-aria-Row[data-key]")].map((n) => n.getAttribute("data-key")).sort();
        return {
          listTexts: items.map((n) => n.textContent.trim()),
          listKeys: items.map((n) => n.getAttribute("data-key")).sort(),
          glyphs: items.map((n) => [...n.querySelectorAll("svg")].map((s) => [...s.classList].find((c) => c.startsWith("lucide-") && c !== "lucide")).filter(Boolean)).flat(),
          imgs: items.reduce((acc, n) => acc + n.querySelectorAll("img").length, 0),
          options: options.sort(),
          tableRows,
          tableKeys,
          tableCells: document.querySelectorAll(".react-aria-Table [role=gridcell], .react-aria-Table [role=rowheader]").length,
        };
      }).catch(() => null);
      if (r && (r.listKeys.length || r.options.length || r.tableRows)) return r;
    }
    return null;
  };
  return pollUntil(read, (r) => r && r.listKeys.length > 0 && r.options.length > 0, 25_000);
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({ storageState: STORAGE_STATE, viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr152-p3-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const projectId = page.url().split("/builder/")[1];
  const collectionId = crypto.randomUUID();
  const glyphs = ["star", "moon", "sun"];
  const rows = [1, 2, 3].map((i) => ({ id: `auto-${i}`, uid: `U-${i}`, name: `User ${i}`, glyph: glyphs[i - 1], photo: `https://placehold.co/24x24.png?text=${i}` }));
  await idb.put(page, {
    id: collectionId, name: "Users", project_id: projectId,
    schema: [{ key: "id", type: "string" }, { key: "uid", type: "string" }, { key: "name", type: "string" }, { key: "glyph", type: "string" }, { key: "photo", type: "image" }],
    mockData: rows, useMockData: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  const users = (await idb.getAll(page)).find((c) => c.id === collectionId);
  const fid = Object.fromEntries(users.schema.map((f) => [f.key, f.id]));
  record("시드 write-back 5 필드 id", Object.values(fid).every(Boolean), JSON.stringify(Object.keys(fid)));

  // 요소 3종 — 팔레트는 선택 요소 아래에 넣으므로 매번 선택 해제
  await setPanel(page, "components", true);
  // 팔레트는 선택 요소 아래에 넣는다 — body 를 선택해 두면 새 요소가 body 직계가 되고,
  //   추가 직후 선택이 새 요소로 옮겨가므로 그 id 를 읽는다 (Table 은 page_id 표기가 달라 페이지 필터로 못 찾는다).
  const addByTitle = async (re) => {
    await page.evaluate(() => { const st = window.__composition_STORE__.getState(); st.setSelectedElement(st.elements.find((e) => e.type === "body")?.id ?? null); });
    await page.waitForTimeout(300);
    const handle = await page.evaluateHandle((src) => [...document.querySelectorAll("button.list-item")].find((b) => new RegExp(src, "i").test(b.getAttribute("title") ?? "")), re.source);
    const el = handle.asElement();
    if (!el) throw new Error(`팔레트 버튼 없음 ${re}`);
    await el.scrollIntoViewIfNeeded();
    const countEls = () => page.evaluate(() => window.__composition_STORE__.getState().elements.length);
    const before = await countEls();
    await el.click();
    const after = await pollUntil(countEls, (n) => n > before, 15_000, 300);
    await page.waitForTimeout(800);
    const added = await page.evaluate(() => { const st = window.__composition_STORE__.getState(); const e = st.elements.find((x) => x.id === st.selectedElementId); return e ? { id: e.id, type: e.type } : null; });
    log("palette add", re.source, before, "→", after, JSON.stringify(added));
    return added?.id ?? null;
  };
  const ids = {
    listBox: await addByTitle(/list box element|addElement: ListBox/),
    select: await addByTitle(/^Add select element$|addElement: Select$/),
    table: await addByTitle(/^Add table element$|addElement: Table$/),
  };
  await setPanel(page, "components", false);
  await page.evaluate(() => window.__composition_STORE__.getState().setSelectedElement(null));
  log("ids", JSON.stringify(ids));
  if (!ids.listBox || !ids.select || !ids.table) throw new Error(`요소 미생성 ${JSON.stringify(ids)}`);

  const bind = (fieldMap) =>
    page.evaluate(({ ids, collectionId, fieldMap }) => {
      const st = window.__composition_STORE__.getState();
      const binding = { source: "dataTable", collectionId, name: "Users", ...(fieldMap ? { fieldMap } : {}) };
      for (const id of [ids.listBox, ids.select, ids.table]) st.updateElementProps(id, { dataBinding: binding });
    }, { ids, collectionId, fieldMap });

  // 대조군: fieldMap 없음 → 휴리스틱 key (id 컬럼)
  await bind(null);
  const skiaPlain = await pollUntil(() => skiaKeys(page, "listbox", ids.listBox), (k) => k && k.length === 3);
  const domPlain = await readPreviewDom(page);
  record("대조군 (fieldMap 없음): Skia ListBox key = DOM key = id 컬럼", JSON.stringify(skiaPlain) === JSON.stringify(["auto-1", "auto-2", "auto-3"]) && JSON.stringify(domPlain?.listKeys) === JSON.stringify(skiaPlain), `skia ${JSON.stringify(skiaPlain)} dom ${JSON.stringify(domPlain?.listKeys)}`);

  // fieldMap value=uid · icon=glyph
  await bind({ value: fid.uid, icon: fid.glyph });
  const skiaList = await pollUntil(() => skiaKeys(page, "listbox", ids.listBox), (k) => k && k[0] === "U-1");
  const skiaTable = await pollUntil(() => skiaKeys(page, "table", ids.table), (k) => k && k.length >= 3 && k.includes("U-1"));
  const dom = await pollUntil(() => readPreviewDom(page), (r) => r?.listKeys?.[0] === "U-1", 20_000);
  record("G2 ListBox: Skia 행 key = uid 컬럼 (value 역할) = Preview DOM data-key", JSON.stringify(skiaList) === JSON.stringify(["U-1", "U-2", "U-3"]) && JSON.stringify(dom?.listKeys) === JSON.stringify(skiaList), `skia ${JSON.stringify(skiaList)} dom ${JSON.stringify(dom?.listKeys)}`);
  // 팔레트 ListBox master 는 icon slot 을 구성하지 않는다 (label/description 만) — 두 leg 다 아이콘을 안 그린다.
  //   icon 역할 소비는 `{icon}` · `{value}` 가상 필드로 잰다: master slot 템플릿을 바꾸면 Skia (buildCollectionRowTemplateItem
  //   = projection row.icon/value) 와 DOM (interpolateCollectionRowTemplate + roles) 이 같은 resolver 를 지난다.
  const labelTextId = "component-listbox-item-default__label";
  await page.evaluate((id) => window.__composition_STORE__.getState().updateElementProps(id, { children: "{label} [{icon}] {value}" }), labelTextId);
  const domTpl = await pollUntil(() => readPreviewDom(page), (r) => r?.listTexts?.[0]?.includes("["), 20_000);
  record("G2 ListBox icon 역할 (glyph 컬럼): Preview DOM 행 텍스트 `{label} [{icon}] {value}` = `User n [star|moon|sun] U-n`", JSON.stringify(domTpl?.listTexts) === JSON.stringify(["User 1 [star] U-1", "User 2 [moon] U-2", "User 3 [sun] U-3"]), JSON.stringify(domTpl?.listTexts));
  record("G2 Select: Preview DOM option value = uid 컬럼 (같은 useResolvedCollectionItems 행)", JSON.stringify(dom?.options) === JSON.stringify(["U-1", "U-2", "U-3"]), JSON.stringify(dom?.options));
  record("G2 Table: Skia 행 key = uid 컬럼 (value 역할) · data 행 3 = Preview DOM aria-rowcount 3 (columns 자동 감지)", JSON.stringify((skiaTable ?? []).filter((k) => k.startsWith("U-"))) === JSON.stringify(["U-1", "U-2", "U-3"]) && dom?.tableRows === 3, `skia ${JSON.stringify(skiaTable)} · dom rows ${dom?.tableRows} cells ${dom?.tableCells}`);
  const domTableKeys = await pollUntil(() => readPreviewDom(page), (r) => r?.tableKeys?.length === 3, 20_000);
  record("Table 후속: Preview DOM `tr[data-key]` = Skia 행 key (useResolvedCollectionItems → TanStack getRowId)", JSON.stringify(domTableKeys?.tableKeys) === JSON.stringify(["U-1", "U-2", "U-3"]), `dom ${JSON.stringify(domTableKeys?.tableKeys)}`);
  await page.screenshot({ path: `${OUT_DIR}/01-fieldmap-uid-glyph.png` });

  // icon 을 이미지 컬럼으로 → DOM img (glyph 0)
  await bind({ value: fid.uid, icon: fid.photo });
  const domImg = await pollUntil(() => readPreviewDom(page), (r) => r?.listTexts?.[0]?.includes("[]"), 20_000);
  record("icon 역할 = 이미지 컬럼 → `{icon}` 은 비고 (avatar slot 몫 — 한 값이 두 slot 에 안 잡힌다)", JSON.stringify(domImg?.listTexts) === JSON.stringify(["User 1 [] U-1", "User 2 [] U-2", "User 3 [] U-3"]), JSON.stringify(domImg?.listTexts));

  // 필드 rename (uid → userId, 저장 형태) + 재로드 → key 값 유지 (id 참조)
  await idb.put(page, { ...users, schema: users.schema.map((f) => (f.key === "uid" ? { ...f, key: "userId" } : f)), mockData: users.mockData.map(({ uid, ...r }) => ({ userId: uid, ...r })) });
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  const skiaAfter = await pollUntil(() => skiaKeys(page, "listbox", ids.listBox), (k) => k && k[0] === "U-1");
  const domAfter = await pollUntil(() => readPreviewDom(page), (r) => r?.listKeys?.[0] === "U-1", 25_000);
  record("필드 rename (uid → userId) + 재로드 → Skia · DOM key 유지 (fieldId 참조)", JSON.stringify(skiaAfter) === JSON.stringify(["U-1", "U-2", "U-3"]) && JSON.stringify(domAfter?.listKeys) === JSON.stringify(skiaAfter), `skia ${JSON.stringify(skiaAfter)} dom ${JSON.stringify(domAfter?.listKeys)}`);
  await page.screenshot({ path: `${OUT_DIR}/02-after-rename.png` });
  record("page error 0", errors.length === 0, errors.join(" | ") || "none");
} catch (e) {
  record("harness", false, String(e?.stack ?? e));
  await page.screenshot({ path: `${OUT_DIR}/error.png` }).catch(() => {});
} finally {
  writeFileSync(`${OUT_DIR}/findings.json`, JSON.stringify(findings, null, 2));
  const pass = findings.filter((f) => f.pass).length;
  log(`결과 ${pass}/${findings.length} PASS`);
  await browser.close();
  process.exit(pass === findings.length ? 0 : 1);
}
