#!/usr/bin/env node
// ADR-322 G5 live — Cascader 의 검색 · 다중 · 「어느 단계든」 · 「값 넣기」 (Phase 5) 와 HC5 열기 속도.
// 실제 Builder 에서 표 · Cascader 를 놓고 Publish 에서 Chrome · WebKit 으로 판정한다. 기대값은 이 파일에
// 따로 적었다 (원본 표본 항목 · 아래 표의 행에서).
//   1. 검색 (columns): 「강남」 → 결과 없음 (강남구는 가지 — 끝 항목만, 가지는 「어느 단계든」 때만)
//      · 「동」 → 끝 항목 넷 + 경로 · Enter (첫 결과에 RAC 의 가상 focus) 로 고르면 값 = 경로
//   2. 다중 (columns): 두 끝 항목 고르기 → menu 열린 채 · 값 「2개 선택됨 / 2 selected」 · menuitemcheckbox
//   3. 「어느 단계든」: columns 하위 menu 첫 항목 「Computers 전체」 → 값 「Electronics / Computers」 ·
//      drill 「Electronics 전체」 행 → 「Electronics」
//   4. 「값 넣기」 규칙: 가지 computers (끝 항목만) 거절 · 값 그대로 · 콘솔 보고 / desktops → 경로
//   5. HC5: 5,000 끝 항목 · 4 단 (중첩 — 5 × 10 × 10 × 10) Cascader 의 세 방식 열기 vs 같은 문서 Select
//      1,000 행 (mock 상한 — Cascader 에 불리한 대조) 열기, 교대 3 쌍 중앙값, 1x (Chrome 은 4x 병기)
//   6. page error 0
//
//   BROWSER=webkit BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr322-g5-live.mjs <out-dir>
import { mkdirSync, readFileSync } from "node:fs";
import { railButton } from "./railButton.mjs";
import { chromium, webkit } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/adr322-g5-live";
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
const warnings = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));
const settle = (p, ms = 250) => p.waitForTimeout(ms);

// Korean regions (search): 서울 > 강남구 > 역삼동 · 삼성동, 서울 > 중구 > 명동, 부산 > 해운대구 > 우동.
const REGIONS = [
  { id: "11", name: "서울", parent: null },
  { id: "680", name: "강남구", parent: "11" },
  { id: "6801", name: "역삼동", parent: "680" },
  { id: "6802", name: "삼성동", parent: "680" },
  { id: "140", name: "중구", parent: "11" },
  { id: "1401", name: "명동", parent: "140" },
  { id: "26", name: "부산", parent: null },
  { id: "350", name: "해운대구", parent: "26" },
  { id: "3501", name: "우동", parent: "350" },
];
// HC5: 5 × 10 × 10 × 10 = 5,000 leaves, nested (`sub`) — the mock cap counts top rows.
const BIG = Array.from({ length: 5 }, (_, a) => ({
  id: `A${a}`,
  name: `Area ${a}`,
  sub: Array.from({ length: 10 }, (_, b) => ({
    id: `A${a}B${b}`,
    name: `Block ${a}-${b}`,
    sub: Array.from({ length: 10 }, (_, c) => ({
      id: `A${a}B${b}C${c}`,
      name: `Cell ${a}-${b}-${c}`,
      sub: Array.from({ length: 10 }, (_, d) => ({
        id: `A${a}B${b}C${c}D${d}`,
        name: `Leaf ${a}-${b}-${c}-${d}`,
      })),
    })),
  })),
}));
const OPTIONS = Array.from({ length: 1000 }, (_, i) => ({
  id: `o${i}`,
  name: `Option ${i}`,
}));

let ids = {};
try {
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /new project/i }).first().click();
  await settle(page, 300);
  await page.keyboard.type(`adr322 g5 live ${NAME}`);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
    timeout: 30000,
  });
  await settle(page, 1500);

  ids = await page.evaluate(
    async ({ REGIONS, BIG, OPTIONS }) => {
      const h = window.__COMPOSITION_CATALOG__;
      const ws = h.workspace;
      const r = ws.root;
      const c = h.commands;
      const { useDataStore } = await import("/src/builder/stores/data.ts");
      const table = (id, schema, rows) => [
        { op: "create_collection", id, name: id, schema },
        { op: "insert_rows", collectionId: id, rows },
      ];
      const str = (id, key) => ({ id, key, type: "string" });
      await useDataStore.getState().applyDataChange(
        {
          origin: "user",
          ops: [
            ...table("regions", [str("r-id", "id"), str("r-name", "name"), str("r-parent", "parent")], REGIONS),
            ...table("big", [str("b-id", "id"), str("b-name", "name"), { id: "b-sub", key: "sub", type: "array" }], BIG),
            ...table("options", [str("o-id", "id"), str("o-name", "name")], OPTIONS),
          ],
        },
        { projectId: location.pathname.split("/").at(-1) },
      );
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
        return [...r.canvasInputs.values()].find(
          (x) => r.typeOf(x) === type && !before.has(x.id),
        ).sourceId;
      };
      const bind = (id, collection, fieldMap) =>
        ws.execute(
          h.binding.catalogBindingCommand(
            [{ kind: "node", id }],
            { collectionId: `data:collection:${collection}`, fieldMap },
            ws.newId,
          ),
        );
      const set = (id, props) =>
        ws.execute(
          c.setFields({
            targets: [{ kind: "node", id }],
            props: Object.fromEntries(
              Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
            ),
          }),
        );
      const f = (id) => `data:field:${id}`;
      const search = add("Cascader");
      bind(search, "regions", { value: f("r-id"), parentId: f("r-parent") });
      set(search, { label: "Region", isSearchable: true });
      const multi = add("Cascader");
      set(multi, { label: "Multi", selectionMode: "multiple" });
      const any = add("Cascader");
      set(any, { label: "Any", allowsBranchSelection: true });
      const anyDrill = add("Cascader");
      set(anyDrill, { label: "AnyDrill", allowsBranchSelection: true, mode: "drill" });
      const ruled = add("Cascader");
      set(ruled, { label: "Ruled", defaultValue: "books" });
      const rule = (value) => {
        const button = add("Button");
        set(button, { label: `Set ${value}` });
        ws.execute(
          c.setNodeInteractions({
            ownerId: button,
            label: "Rules",
            entries: [
              {
                kind: "interaction",
                id: ws.newId("interaction"),
                ownerId: button,
                trigger: "onPress",
                actions: [
                  { opcode: "capability", target: { nodeId: ruled }, capabilityId: "setValue", value },
                ],
              },
            ],
          }),
        );
      };
      rule("computers");
      rule("desktops");
      const big = add("Cascader");
      bind(big, "big", { value: f("b-id"), children: f("b-sub") });
      set(big, { label: "Big" });
      const bigTree = add("Cascader");
      bind(bigTree, "big", { value: f("b-id"), children: f("b-sub") });
      set(bigTree, { label: "BigTree", mode: "tree" });
      const bigDrill = add("Cascader");
      bind(bigDrill, "big", { value: f("b-id"), children: f("b-sub") });
      set(bigDrill, { label: "BigDrill", mode: "drill" });
      const select = add("Select");
      bind(select, "options", { value: f("o-id") });
      set(select, { label: "Select1000" });
      ws.selectItems([]);
      return { search, multi, any, anyDrill, ruled, big, select };
    },
    { REGIONS, BIG, OPTIONS },
  );
  await settle(page, 2000);

  // 0. The Design panel names the three switches (the panel language's words).
  await page.evaluate((source) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const field = [...ws.root.canvasInputs.values()].find((x) => x.sourceId === source);
    ws.selectItems([ws.itemOfRecord(field.id)]);
  }, ids.search);
  await settle(page, 600);
  const design = railButton(page, "properties");
  if ((await design.getAttribute("aria-pressed")) !== "true") {
    await design.click();
    await settle(page, 1200);
  }
  // (The panel scrolls — collect its text while scrolling to the end; WebKit's window is short.)
  const panelText = await page.evaluate(async () => {
    const header = [...document.querySelectorAll("*")].find(
      (el) => el.childElementCount === 0 && el.textContent === "Content",
    );
    let box = header?.parentElement;
    while (box && !(box.scrollHeight > box.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(box).overflowY)))
      box = box.parentElement;
    let text = document.body.innerText;
    for (let i = 0; box && i < 40; i++) {
      box.scrollTop += 240;
      await new Promise((done) => setTimeout(done, 120));
      text += "\n" + box.innerText;
      if (box.scrollTop + box.clientHeight >= box.scrollHeight - 2) break;
    }
    return text;
  });
  await page.screenshot({ path: `${OUT}/${NAME}-panel.png` });
  const labels = {
    search: /Search items|항목 검색/.test(panelText),
    anyLevel: /Select any level|어느 단계든 고르기/.test(panelText),
    mode: /Selection mode|선택 모드/i.test(panelText),
    rawKey: /properties\.(searchItems|selectAnyLevel)/.test(panelText),
  };
  record(
    "0 Design 패널 — 「Search items」 · 「Select any level」 · 「Selection Mode」 (번역 키 그대로 0)",
    labels.search && labels.anyLevel && labels.mode && !labels.rawKey,
    labels,
  );
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.selectItems([]));

  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => ["Preview", "미리보기"].includes(b.getAttribute("aria-label")))
      ?.click(),
  );
  const pub = await popup;
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  pub.on("console", (m) => {
    if (m.type() === "warning") warnings.push(m.text());
  });
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector(".react-aria-Cascader button", { timeout: 60000 });
  await settle(pub, 1500);
  const field = (n) => pub.locator(".react-aria-Cascader").nth(n);
  const valueOf = (n) => field(n).locator(".react-aria-SelectValue").first().textContent();
  const opener = (n) => field(n).locator("button").first();
  const closeAll = async () => {
    for (let i = 0; i < 4; i++) {
      if (!(await pub.locator('[role="menu"], [role="dialog"]').count())) break;
      await pub.keyboard.press("Escape");
      await settle(pub, 200);
    }
  };

  // (HC5_ONLY=1 — the timing step alone.)
  if (!process.env.HC5_ONLY) {
  // 1. search.
  await opener(0).click();
  await pub.waitForSelector('input[type="search"], [role="searchbox"]', { timeout: 10000 });
  await settle(pub, 300);
  const levels = await pub.locator('[role="menu"]').last().ariaSnapshot();
  await pub.keyboard.type("강남");
  await settle(pub, 400);
  const gangnam = await pub.locator('[role="menu"]').last().ariaSnapshot();
  await pub.keyboard.press("ControlOrMeta+A");
  await pub.keyboard.type("동");
  await settle(pub, 400);
  const dong = await pub.locator('[role="menu"]').last().ariaSnapshot();
  await pub.screenshot({ path: `${OUT}/${NAME}-search-open.png` });
  // (RAC Autocomplete puts virtual focus on the first result — Enter picks it.)
  await pub.keyboard.press("Enter");
  await settle(pub, 600);
  const searched = await valueOf(0);
  record(
    "1 검색 — 「강남」 결과 없음 (가지) · 「동」 끝 항목 넷 + 경로 · 고르기 → 값 경로",
    !/menuitem[^"]*"강남구/.test(gangnam) &&
      (dong.match(/menuitem/g) ?? []).length === 4 &&
      /서울 \/ 강남구 \/ 역삼동/.test(dong) &&
      searched === "서울 / 강남구 / 역삼동",
    { levels: levels.replace(/\n/g, " ¶ "), gangnam: gangnam.replace(/\n/g, " ¶ "), dong: dong.replace(/\n/g, " ¶ "), searched },
  );
  await closeAll();
  await pub.screenshot({ path: `${OUT}/${NAME}-search.png` });

  // 2. multiple.
  await opener(1).click();
  await pub.waitForSelector('[role="menu"]', { timeout: 10000 });
  await settle(pub, 300);
  await pub.getByRole("menuitemcheckbox", { name: "Books" }).click();
  await settle(pub, 300);
  const stillOpen = await pub.locator('[role="menu"]').count();
  await pub.getByRole("menuitem", { name: "Clothing" }).hover();
  await settle(pub, 500);
  await pub.getByRole("menuitemcheckbox", { name: "Men", exact: true }).click();
  await settle(pub, 300);
  const multiSnap = await pub.locator('[role="menu"]').first().ariaSnapshot();
  await closeAll();
  const multiValue = await valueOf(1);
  record(
    "2 다중 — 고른 뒤 menu 열린 채 · menuitemcheckbox [checked] · 값 「2개 선택됨 · 2 selected」",
    stillOpen >= 1 &&
      /menuitemcheckbox "Books" \[checked\]/.test(multiSnap) &&
      /^(2개 선택됨|2 selected)$/.test(multiValue ?? ""),
    { stillOpen, multiValue, multiSnap: multiSnap.replace(/\n/g, " ¶ ") },
  );

  // 3. any level.
  await opener(2).click();
  await pub.waitForSelector('[role="menu"]', { timeout: 10000 });
  await settle(pub, 300);
  await pub.getByRole("menuitem", { name: "Electronics" }).first().hover();
  await settle(pub, 500);
  await pub.getByRole("menuitem", { name: "Computers" }).hover();
  await settle(pub, 500);
  const levelItem = pub.locator('[role="menu"]').nth(2).locator('[role^="menuitem"]').first();
  const levelName = await levelItem.textContent();
  await pub.screenshot({ path: `${OUT}/${NAME}-any-columns.png` });
  await levelItem.click();
  await settle(pub, 600);
  const anyValue = await valueOf(2);
  await closeAll();
  await opener(3).click();
  await pub.waitForSelector('[role="grid"]', { timeout: 10000 });
  await settle(pub, 300);
  await pub.getByRole("row", { name: "Electronics" }).click();
  await settle(pub, 400);
  const drillFirst = await pub.locator('[role="row"]').first().textContent();
  await pub.screenshot({ path: `${OUT}/${NAME}-any-drill.png` });
  await pub.locator('[role="row"]').first().click();
  await settle(pub, 600);
  const drillValue = await valueOf(3);
  await closeAll();
  record(
    "3 「어느 단계든」 — columns 「Computers 전체」 → 「Electronics / Computers」 · drill 「Electronics 전체」 → 「Electronics」",
    /Computers/.test(levelName ?? "") &&
      anyValue === "Electronics / Computers" &&
      /Electronics/.test(drillFirst ?? "") &&
      drillValue === "Electronics",
    { levelName, anyValue, drillFirst, drillValue },
  );

  // 4. rules.
  const before = warnings.length;
  await pub.getByRole("button", { name: "Set computers" }).click();
  await settle(pub, 400);
  const refusedValue = await valueOf(4);
  const refusal = warnings.slice(before);
  await pub.getByRole("button", { name: "Set desktops" }).click();
  await settle(pub, 400);
  const written = await valueOf(4);
  record(
    "4 「값 넣기」 — 가지 computers 거절 (값 Books · 보고) · desktops → 경로",
    refusedValue === "Books" &&
      refusal.some((w) => w.includes("가지 항목: computers")) &&
      written === "Electronics / Computers / Desktops",
    { refusedValue, refusal: refusal.slice(0, 2), written },
  );

  }
  // 5. HC5 — open to the first list drawn, then the next frame. (SKIP_HC5=1 — the behaviour steps alone.)
  if (!process.env.SKIP_HC5) {
  // (P0 P4's measure: click → the list's rows in the DOM → the next frame → a task. Each open is
  //  closed to no popover at all before the next — a Select's listbox is no menu · dialog.)
  const closePopovers = async () => {
    for (let i = 0; i < 8; i++) {
      if (!(await pub.locator(".react-aria-Popover").count())) return true;
      // (A script click leaves focus on body — Esc reaches no popover; a press outside closes it.)
      await pub.mouse.click(1560, 960);
      await settle(pub, 250);
    }
    return false;
  };
  const openTime = async (fieldIndex, selector) => {
    const ms = await pub.evaluate(
      ({ fieldIndex, selector }) =>
        new Promise((resolve) => {
          const field = document.querySelectorAll(".react-aria-Cascader, .react-aria-Select")[fieldIndex];
          const button = field.querySelector("button");
          const start = performance.now();
          button.click();
          const tick = () => {
            if (document.querySelector(selector))
              requestAnimationFrame(() => setTimeout(() => resolve(performance.now() - start)));
            else if (performance.now() - start > 10000) resolve(-1);
            else requestAnimationFrame(tick);
          };
          tick();
        }),
      { fieldIndex, selector },
    );
    if (!(await closePopovers())) return -2;
    await settle(pub, 300);
    return ms;
  };
  const index = await pub.evaluate(() =>
    [...document.querySelectorAll(".react-aria-Cascader, .react-aria-Select")].map((el) =>
      el.classList.contains("react-aria-Select") ? "select" : "cascader",
    ),
  );
  // (Preview is the document as opened — one Big field per mode, set before it opens.)
  const bigIndexOf = { columns: 5, tree: 6, drill: 7 };
  const selectIndex = index.indexOf("select");
  const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
  const measure = async (rate) => {
    const cdp = !WEBKIT ? await context.newCDPSession(pub) : undefined;
    if (cdp) await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    const out = {};
    for (const [mode, selector] of [
      ["columns", '[role="menu"] [role^="menuitem"]'],
      ["tree", '[role="treegrid"] [role="row"]'],
      ["drill", '[role="grid"] [role="row"]'],
    ]) {
      // (One open each first — the lazy chunk loads once; the measured opens are warm.)
      await openTime(bigIndexOf[mode], selector);
      await openTime(selectIndex, '[role="listbox"] [role="option"]');
      const pairs = [];
      for (let i = 0; i < 3; i++) {
        const cascader = await openTime(bigIndexOf[mode], selector);
        const select = await openTime(selectIndex, '[role="listbox"] [role="option"]');
        pairs.push([cascader, select]);
      }
      const c = median(pairs.map((p) => p[0]));
      const s = median(pairs.map((p) => p[1]));
      process.stdout.write(`  HC5 ${rate}x ${mode} ${JSON.stringify(pairs.map((p) => p.map(Math.round)))}\n`);
      out[mode] = { cascader: Math.round(c), select: Math.round(s), ratio: +(c / s).toFixed(2) };
    }
    if (cdp) await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    return out;
  };
  const x1 = await measure(1);
  const x4 = WEBKIT ? undefined : await measure(4);
  const within = (m) => Object.values(m).every((row) => row.cascader >= 0 && row.select >= 0 && row.ratio <= 1.5);
  record(
    "5 HC5 — 5,000 끝 항목 · 4 단 열기 ≤ Select 1,000 열기 × 1.5 (세 방식, 1x" + (WEBKIT ? ")" : " · 4x)"),
    within(x1) && (!x4 || within(x4)),
    { x1, x4 },
  );
  }
} catch (error) {
  record("실행 오류", false, String(error).split("\n").slice(0, 3).join(" | "));
}
record("6 page error 0", errors.length === 0, errors.slice(0, 4));
await browser.close();
const failed = results.filter((r) => !r.pass).length;
process.stdout.write(`\n[${NAME}] ${failed ? `FAIL ${failed}` : `ALL PASS ${results.length}`}\n`);
process.exit(failed ? 1 : 0);
