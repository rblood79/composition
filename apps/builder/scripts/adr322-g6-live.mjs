#!/usr/bin/env node
// ADR-322 G6 live — Cascader 의 단계별 원격 로드 (사용자 결정 4) · 폼 값 · 필수 검증 (breakdown §3.1).
// 실제 Builder 에서 원격 표 · endpoint · Cascader · Form 을 놓고 Publish 에서 Chrome · WebKit 으로 판정한다.
// 원격 응답은 이 파일의 route 가 준다 (기대값은 아래 표에서 손으로 적었다).
//   1. columns: 열면 첫 단계 (요청 parent 없음) · 서울 위로 → 「불러오는 중…」 → 강남구 · 중구 · 강남구 → 역삼동 고르기
//      → 값 「서울 / 강남구 / 역삼동」 · 요청 「· 11 · 680」 한 번씩 · 다시 열어도 새 요청 0
//   2. 실패 · 다시 시도: 부산 첫 요청 500 → 「불러오지 못함 — 다시 시도」 → 누르면 해운대구
//   3. tree · drill: 같은 표 — tree 에서 서울 펼침 · drill 에서 서울 들어가기 → 강남구 · 중구
//   4. 선언 위반: A/01 고른 뒤 B 를 열면 B 도 01 → 두 항목 고를 수 없음 · 값이 비고 콘솔 「서버 계약 위반」
//   5. 선언 없는 endpoint: 단계별로 묻지 않는다 (요청 1) · 콘솔 안내
//   6. 검색: 「불러온 항목에서만 찾는다」
//   7. Form (native): 필수 빈 값 → 제출 0 · focus 가 여는 버튼 / 고른 뒤 → FormData category=books
//   8. page error 0
//
//   BROWSER=webkit BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr322-g6-live.mjs <out-dir>
import { mkdirSync, readFileSync } from "node:fs";
import { chromium, webkit } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/adr322-g6-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const HEADLESS = process.argv.includes("--headless");
const WEBKIT = process.env.BROWSER === "webkit";
const NAME = WEBKIT ? "webkit" : "chrome";
const API = "https://adr322-g6.example.test";

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
const settle = (p, ms = 250) => p.waitForTimeout(ms);

// The remote hierarchy, one level per request (`?parent=`).
const REGIONS = {
  "": [
    { id: "11", name: "서울", has: true },
    { id: "26", name: "부산", has: true },
    { id: "36", name: "세종", has: false },
  ],
  11: [
    { id: "680", name: "강남구", has: true },
    { id: "140", name: "중구", has: true },
  ],
  680: [
    { id: "6801", name: "역삼동", has: false },
    { id: "6802", name: "삼성동", has: false },
  ],
  140: [{ id: "1401", name: "명동", has: false }],
  26: [{ id: "350", name: "해운대구", has: false }],
};
const DUP = {
  "": [
    { id: "A", name: "A", has: true },
    { id: "B", name: "B", has: true },
    { id: "C", name: "C", has: true },
  ],
  A: [{ id: "01", name: "One", has: false }],
  B: [{ id: "01", name: "Uno", has: false }],
  C: [
    { id: "07", name: "First sibling", has: false },
    { id: "07", name: "Second sibling", has: false },
    { id: "07#1", name: "Unique sibling", has: false },
  ],
};
const requests = [];
let failBusan = true;
await context.route(`${API}/**`, async (route) => {
  const url = new URL(route.request().url());
  const parent = url.searchParams.get("parent") ?? "";
  requests.push(`${url.pathname}?${parent}`);
  await new Promise((done) => setTimeout(done, 400));
  if (url.pathname === "/regions" && parent === "26" && failBusan) {
    failBusan = false;
    return route.fulfill({ status: 500, headers: { "access-control-allow-origin": "*" }, body: "x" });
  }
  const table = url.pathname === "/dup" ? DUP : REGIONS;
  const items =
    url.pathname === "/plain"
      ? parent === ""
        ? [{ id: "p1", name: "P1", has: true }]
        : [{ id: "p11", name: "P11", has: false }]
      : (table[parent] ?? []);
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ items }),
  });
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

try {
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /new project/i }).first().click();
  await settle(page, 300);
  await page.keyboard.type(`adr322 g6 live ${NAME}`);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
    timeout: 30000,
  });
  await settle(page, 1500);

  await page.evaluate(async (API) => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const r = ws.root;
    const c = h.commands;
    const schema = (p) => [
      { id: `${p}-id`, key: "id", type: "string" },
      { id: `${p}-name`, key: "name", type: "string" },
      { id: `${p}-parent`, key: "parent", type: "string" },
      { id: `${p}-has`, key: "has", type: "boolean" },
    ];
    const remote = (name, path, declared) => [
      {
        kind: "collection",
        id: `data:collection:${name}`,
        name,
        schema: schema(name),
        keyField: `${name}-id`,
        mockData: [],
        useMockData: false,
        executionPolicy: { mode: "auto" },
      },
      {
        kind: "endpoint",
        id: `data:endpoint:${name}`,
        name: `list${name}`,
        method: "GET",
        baseUrl: API,
        path,
        headers: [],
        queryParams: [{ key: "parent", value: "{{ parentKey }}", type: "string", required: false }],
        bodyType: "none",
        responseMapping: { dataPath: "items", ...(declared ? { keysUnique: true } : {}) },
        targetCollectionId: `data:collection:${name}`,
        executionMode: "client",
      },
    ];
    ws.execute(
      c.setDataEntries({
        puts: [
          ...remote("regions", "/regions", true),
          ...remote("dup", "/dup", true),
          ...remote("plain", "/plain", false),
        ],
        label: "remote",
      }),
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
    const bind = (id, name, valueField = "id") =>
      ws.execute(
        h.binding.catalogBindingCommand(
          [{ kind: "node", id }],
          {
            collectionId: `data:collection:${name}`,
            fieldMap: {
              value: `data:field:${name}-${valueField}`,
              parentId: `data:field:${name}-parent`,
              hasChildren: `data:field:${name}-has`,
            },
          },
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
    const lazy = add("Cascader");
    bind(lazy, "regions");
    set(lazy, { label: "Lazy" });
    const lazyTree = add("Cascader");
    bind(lazyTree, "regions");
    set(lazyTree, { label: "LazyTree", mode: "tree" });
    const lazyDrill = add("Cascader");
    bind(lazyDrill, "regions");
    set(lazyDrill, { label: "LazyDrill", mode: "drill" });
    const dup = add("Cascader");
    bind(dup, "dup");
    set(dup, { label: "Dup", name: "dup" });
    const mapped = add("Cascader");
    bind(mapped, "regions", "name");
    set(mapped, { label: "Mapped", name: "mapped" });
    const button = add("Button");
    set(button, { label: "Set unopened branch" });
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
              {
                opcode: "capability",
                target: { nodeId: dup },
                capabilityId: "setValue",
                value: "A",
              },
            ],
          },
        ],
      }),
    );
    const plain = add("Cascader");
    bind(plain, "plain");
    set(plain, { label: "Plain" });
    // A Form with a required Cascader (the origin's sample items) named `category`.
    const form = add("Form");
    const field = "project:node:g6-category";
    ws.execute(
      c.insertNodes({
        parent: { kind: "node", id: form },
        entries: [
          {
            kind: "node",
            id: field,
            definitionId: h.palette.catalogPaletteDefinitionId(ws.runtime.graph.library, "Cascader"),
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
        ],
        rootIds: [field],
        newId: ws.newId,
      }),
    );
    set(field, { label: "Category", name: "category", isRequired: true });
    ws.selectItems([]);
  }, API);
  await settle(page, 2000);

  // A slow module exposes any gap between mounting the field and registering its native control.
  await context.route(/cascaderForm\.components/, async (route) => {
    await new Promise((done) => setTimeout(done, 1200));
    await route.continue();
  });
  await context.addInitScript(() => {
    const observer = new MutationObserver(() => {
      const field = document.querySelector("form .react-aria-Cascader button");
      if (!field) return;
      observer.disconnect();
      const form = field.closest("form");
      for (const input of form.querySelectorAll("input[required]"))
        if (!input.closest(".react-aria-Cascader"))
          input.value =
            input.type === "email" ? "viewer@example.test" : "valid";
      let submitted = false;
      const capture = (event) => {
        event.preventDefault();
        submitted = true;
      };
      form.addEventListener("submit", capture);
      form.requestSubmit();
      form.removeEventListener("submit", capture);
      window.__coldCascader = {
        submitted,
        inputs: form.querySelectorAll("input[name=category][required]").length,
        focused: document.activeElement === field,
      };
    });
    observer.observe(document, { childList: true, subtree: true });
  });
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
  await settle(pub, 2000);
  const field = (label) =>
    pub.locator(".react-aria-Cascader").filter({ has: pub.getByText(label, { exact: true }) }).first();
  const valueOf = (label) => field(label).locator(".react-aria-SelectValue").first().textContent();
  const opener = (label) => field(label).locator("button").first();
  const closeAll = async () => {
    for (let i = 0; i < 4; i++) {
      if (!(await pub.locator('[role="menu"], [role="dialog"]').count())) break;
      await pub.keyboard.press("Escape");
      await settle(pub, 200);
    }
  };
  const lastMenu = () => pub.locator('[role="menu"]').last();
  const levelRequests = (path) => requests.filter((r) => r.startsWith(path));
  const LOADING = /불러오는 중…|Loading…/;
  const RETRY = /불러오지 못함 — 다시 시도|Couldn't load — Retry/;

  const cold = await pub.evaluate(() => window.__coldCascader);
  record(
    "R4 첫 렌더 필수값 검증",
    cold?.inputs === 1 && !cold.submitted && cold.focused,
    cold ?? {},
  );
  await pub.getByRole("button", { name: "Set unopened branch" }).click();
  const ruled = await field("Dup").locator("input[name=dup]").inputValue();
  record(
    "R4 미로드 가지의 규칙 값 거절",
    ruled === "" && warnings.some((w) => w.includes("가지 항목")),
    { ruled },
  );

  // 1. columns.
  const firstRequests = levelRequests("/regions?");
  await opener("Lazy").click();
  await pub.waitForSelector('[role="menu"]', { timeout: 10000 });
  await settle(pub, 300);
  const firstLevel = await lastMenu().ariaSnapshot();
  process.stdout.write(`  first: ${firstLevel.replace(/\n/g, " ¶ ")} · requests ${JSON.stringify(requests)} · warnings ${JSON.stringify(warnings.filter((w) => w.includes("DBG322")).slice(-8))}\n`);
  await pub.getByRole("menuitem", { name: "서울" }).hover();
  // (The submenu opens after RAC's hover delay; the answer comes 400 ms after the request.)
  await pub.waitForFunction(() => document.querySelectorAll('[role="menu"]').length > 1, null, { timeout: 5000 });
  const loading = await lastMenu().ariaSnapshot();
  await settle(pub, 900);
  const seoul = await lastMenu().ariaSnapshot();
  await pub.getByRole("menuitem", { name: "강남구" }).hover();
  await settle(pub, 1100);
  await pub.getByRole("menuitemradio", { name: "역삼동" }).click();
  await settle(pub, 500);
  const picked = await valueOf("Lazy");
  await closeAll();
  await opener("Lazy").click();
  await settle(pub, 300);
  await pub.getByRole("menuitem", { name: "서울" }).hover();
  await settle(pub, 800);
  await closeAll();
  const asked = levelRequests("/regions");
  record(
    "1 columns — 첫 단계 · 「불러오는 중…」 · 강남구 › 역삼동 → 값 · 요청 한 번씩 · 다시 열어도 0",
    /서울/.test(firstLevel) &&
      /부산/.test(firstLevel) &&
      /세종/.test(firstLevel) &&
      LOADING.test(loading) &&
      /강남구/.test(seoul) &&
      /중구/.test(seoul) &&
      picked === "서울 / 강남구 / 역삼동" &&
      JSON.stringify(asked) === JSON.stringify(["/regions?", "/regions?11", "/regions?680"]),
    { firstRequests, firstLevel: firstLevel.replace(/\n/g, " ¶ "), loading: loading.replace(/\n/g, " ¶ "), seoul: seoul.replace(/\n/g, " ¶ "), picked, asked },
  );
  await pub.screenshot({ path: `${OUT}/${NAME}-columns.png` });

  // 2. a failure and a retry.
  await opener("Lazy").click();
  await settle(pub, 300);
  await pub.getByRole("menuitem", { name: "부산" }).hover();
  await settle(pub, 1100);
  const failed = await lastMenu().ariaSnapshot();
  await lastMenu().locator('[role^="menuitem"]', { hasText: RETRY }).click();
  await settle(pub, 1100);
  const retried = await lastMenu().ariaSnapshot();
  await closeAll();
  record(
    "2 실패 · 다시 시도 — 500 → 「불러오지 못함 — 다시 시도」 → 해운대구 (요청 26 두 번)",
    RETRY.test(failed) &&
      /해운대구/.test(retried) &&
      levelRequests("/regions?26").length === 2,
    { failed: failed.replace(/\n/g, " ¶ "), retried: retried.replace(/\n/g, " ¶ "), asked26: levelRequests("/regions?26").length },
  );

  // 3. tree · drill (the same table — its levels here already).
  await opener("LazyTree").focus();
  await pub.keyboard.press("Enter");
  await pub.waitForSelector('[role="treegrid"]', { timeout: 10000 });
  await settle(pub, 400);
  await pub.locator('[role="treegrid"] [role="row"]').first().focus();
  await pub.keyboard.press("ArrowRight");
  await settle(pub, 600);
  const treeRows = await pub.locator('[role="treegrid"] [role="row"]').allTextContents();
  await closeAll();
  await opener("LazyDrill").focus();
  await pub.keyboard.press("Enter");
  await pub.waitForSelector('[role="grid"]', { timeout: 10000 });
  await settle(pub, 400);
  // (The search field takes focus on open — 2026-11-28 사용자 결정; the level's first row, as the
  //  tree's step does. ADR-326 Phase 3 G3.)
  await pub.locator('[role="grid"] [role="row"]').first().focus();
  await pub.keyboard.press("Enter");
  await settle(pub, 600);
  const drillRows = await pub.locator('[role="grid"] [role="row"]').allTextContents();
  await closeAll();
  record(
    "3 tree · drill — 서울 펼침 · 들어가기 → 강남구 · 중구",
    treeRows.includes("강남구") && treeRows.includes("중구") && drillRows.join() === "강남구,중구",
    { treeRows, drillRows },
  );

  // 4. the declaration broken.
  await opener("Dup").click();
  await settle(pub, 300);
  await pub.getByRole("menuitem", { name: "A", exact: true }).hover();
  await settle(pub, 1100);
  await pub.getByRole("menuitemradio", { name: "One" }).click();
  await settle(pub, 500);
  const dupPicked = await valueOf("Dup");
  await opener("Dup").click();
  await settle(pub, 300);
  await pub.getByRole("menuitem", { name: "B", exact: true }).hover();
  await settle(pub, 1100);
  const uno = await lastMenu().ariaSnapshot();
  await pub.getByRole("menuitem", { name: "A", exact: true }).hover();
  await settle(pub, 600);
  const one = await lastMenu().ariaSnapshot();
  await closeAll();
  await settle(pub, 400);
  const dupAfter = await valueOf("Dup");
  record(
    "4 선언 위반 — A/01 고른 뒤 B/01 도착 → 둘 다 [disabled] · 값 비움 · 「서버 계약 위반」",
    dupPicked === "A / One" &&
      /Uno"? \[disabled\]/.test(uno) &&
      /One"? \[disabled\]/.test(one) &&
      dupAfter !== "A / One" &&
      warnings.some((w) => w.includes("서버 계약 위반")),
    { dupPicked, uno: uno.replace(/\n/g, " ¶ "), one: one.replace(/\n/g, " ¶ "), dupAfter, warned: warnings.filter((w) => w.includes("계약")).slice(0, 2) },
  );

  await opener("Dup").click();
  await pub.getByRole("menuitem", { name: "C", exact: true }).hover();
  const first = pub.getByRole("menuitemradio", { name: "First sibling" });
  const second = pub.getByRole("menuitemradio", { name: "Second sibling" });
  await first.waitFor();
  const duplicatesBlocked =
    (await first.isDisabled()) && (await second.isDisabled());
  await pub.getByRole("menuitemradio", { name: "Unique sibling" }).click();
  const unique = await field("Dup").locator("input[name=dup]").inputValue();
  record(
    "R4 중복 형제와 순번을 포함한 실제 key",
    duplicatesBlocked && unique === "07#1",
    { duplicatesBlocked, unique },
  );
  await closeAll();

  // 5. no declaration: not asked one by one.
  await opener("Plain").click();
  await settle(pub, 300);
  const plainSnap = await lastMenu().ariaSnapshot();
  await closeAll();
  record(
    "5 선언 없는 endpoint — 단계별 요청 0 (첫 응답만) · 콘솔 안내",
    levelRequests("/plain").length === 1 &&
      /P1/.test(plainSnap) &&
      warnings.some((w) => w.includes("선언해야")),
    { plain: levelRequests("/plain"), plainSnap: plainSnap.replace(/\n/g, " ¶ ") },
  );

  // 6. search over the loaded items only.
  await opener("Lazy").click();
  await pub.waitForSelector('input[type="search"], [role="searchbox"]', { timeout: 10000 });
  await settle(pub, 300);
  await pub.keyboard.type("동");
  await settle(pub, 500);
  const searchText = await pub.locator(".react-aria-Popover").last().innerText();
  await closeAll();
  record(
    "6 검색 — 불러온 항목 (역삼동 · 삼성동) + 「불러온 항목에서만 찾는다」",
    /역삼동/.test(searchText) &&
      !/명동/.test(searchText) &&
      /불러온 항목에서만 찾는다|Searching the loaded items only/.test(searchText),
    { searchText: searchText.replace(/\n/g, " ¶ ") },
  );

  // Another binding shares the row cache, uses names as values, and opens a still-unloaded branch.
  await opener("Mapped").click();
  await pub.getByRole("menuitem", { name: "서울", exact: true }).hover();
  await pub.getByRole("menuitem", { name: "중구", exact: true }).hover();
  await pub.getByRole("menuitemradio", { name: "명동", exact: true }).click();
  const mapped = await field("Mapped")
    .locator("input[name=mapped]")
    .inputValue();
  const mappedPath = await valueOf("Mapped");
  record(
    "R4 행 id로 하위 요청 후 매핑된 값 제출",
    mapped === "명동" &&
      mappedPath === "서울 / 중구 / 명동" &&
      levelRequests("/regions?140").length === 1,
    { mapped, mappedPath, requests: levelRequests("/regions") },
  );
  await closeAll();

  // 7. the Form (native): a required empty Cascader blocks · a value carries.
  await pub.evaluate(() => {
    window.__submits = [];
    const form = document.querySelector("form");
    form.addEventListener("submit", (event) => {
      window.__submits.push([...new FormData(event.target).entries()].filter(([k]) => k === "category"));
    });
    // (The Form origin's own TextField is required — only the Cascader's check is under test.)
    for (const input of form.querySelectorAll("input"))
      if (!input.closest(".react-aria-Cascader")) input.removeAttribute("required");
  });
  const submitButton = pub.locator('form button[type="submit"]').first();
  await submitButton.click();
  await settle(pub, 500);
  const blocked = await pub.evaluate(() => ({
    submits: window.__submits.length,
    focused: document.activeElement?.closest(".react-aria-Cascader") ? document.activeElement.tagName : document.activeElement?.tagName,
    invalid: document.querySelector("form .react-aria-Cascader")?.getAttribute("data-invalid"),
  }));
  await opener("Category").click();
  await settle(pub, 400);
  await pub.getByRole("menuitemradio", { name: "Books" }).click();
  await settle(pub, 400);
  await pub.evaluate(() => {
    for (const input of document.querySelectorAll("form input"))
      if (!input.closest(".react-aria-Cascader")) input.removeAttribute("required");
  });
  await submitButton.click();
  await settle(pub, 500);
  const sent = await pub.evaluate(() => window.__submits);
  record(
    "7 Form (native) — 필수 빈 값: 제출 0 · focus 여는 버튼 · invalid / Books 고른 뒤: category=books",
    blocked.submits === 0 &&
      blocked.focused === "BUTTON" &&
      blocked.invalid === "true" &&
      JSON.stringify(sent) === JSON.stringify([[["category", "books"]]]),
    { blocked, sent },
  );
  await pub.screenshot({ path: `${OUT}/${NAME}-form.png` });
} catch (error) {
  record("실행 오류", false, String(error).split("\n").slice(0, 3).join(" | "));
}
record("8 page error 0", errors.length === 0, errors.slice(0, 4));
await browser.close();
const failed = results.filter((r) => !r.pass).length;
process.stdout.write(`\n[${NAME}] ${failed ? `FAIL ${failed}` : `ALL PASS ${results.length}`}\n`);
process.exit(failed ? 1 : 0);
