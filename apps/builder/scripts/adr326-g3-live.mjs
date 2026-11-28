#!/usr/bin/env node
// ADR-326 G3 live — Cascader `tree` · `drill` 의 열린 내용이 원본 노드 (Popover · SearchField · Breadcrumbs ·
// 「Back」 ActionButton · CascaderList · CascaderItem) 로 그려진다 (breakdown §4.3 · §4.4 · §4.6). 실제 Builder 에서
// 팔레트로 Cascader 와 비교용 Breadcrumbs 를 놓고, Cascader 아래에 항목 사슬 (Alpha > Beta > Gamma > Delta >
// Epsilon > Leaf — 경로 5 crumb) 을 넣어 Publish 에서 Chrome · WebKit 으로 판정한다. 기대값은 이 파일에 적었다.
//   1. drill 열기 — dialog 하나 · focus 검색 칸 · 상자 폭 = Button 폭 · 맨 위 단계는 경로 줄 없음 · 뒤로 disabled (안 보임)
//      (사용자 결정 2026-11-29 — 경로 줄은 들어간 단계만, 「뒤로」 는 검색 칸과 한 줄)
//   2. 경로 줄의 computed 간격 = 같은 size 의 Breadcrumbs 컴포넌트 (목록 gap · crumb gap · 글자 크기 · crumb flex-shrink 0)
//   3. 키보드 — Tab → 첫 행 · Enter → 하위 단계 (경로 2 crumb · 뒤로 enabled) · 뒤로 → 첫 단계 · Esc → 닫힘 · focus Button
//   4. 깊은 경로 (시작 값 Leaf — 5 crumb) × 폭 420 · 240: 보이는 crumb + 접힌 메뉴 = 전체 경로 (빠짐 · 겹침 0) ·
//      메뉴의 모든 항목과 보이는 crumb 이 각자 그 단계로
//   5. 검색 중 경로 줄 · 뒤로가 숨는다 (검색 칸에 「lea」 — 결과 Leaf, 잎만 고를 수 있다)
//   6. tree — treegrid = CascaderList record · 행 class · Books 배경 · 가지의 펼침 버튼 (aria-expanded) → 하위 행
//   7. 항목 안에 slot 없는 Text 를 하나 더 — columns 행이 그 글자를 그림 (Phase 2 의 jsdom 무한 갱신 판정)
//   8. page error 0 · console error 0
//
//   BROWSER=webkit BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr326-g3-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, webkit } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr326-g3-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const HEADLESS = process.argv.includes("--headless");
const WEBKIT = process.env.BROWSER === "webkit";
const NAME = WEBKIT ? "webkit" : "chrome";
const COMMANDS = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const PAINT = "rgb(255, 228, 196)";
// (판독 1 수리 — Books 의 글자색 · CascaderItem 원본의 Hover 배경.)
const INK = "rgb(255, 255, 255)";
const HOVER = "rgb(171, 205, 239)";

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
const consoleErrors = [];
const notFound = [];
context.on("response", (r) => {
  if (r.status() === 404) notFound.push(r.url());
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

const settle = (p, ms = 250) => p.waitForTimeout(ms);
const focused = (p) =>
  p.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "body";
    if (el.closest(".react-aria-Cascader") && el.tagName === "BUTTON")
      return "open";
    if (el.tagName === "INPUT") return `input:${el.value}`;
    // (A row's name is its label part — a branch row also holds its item count, 2026-11-29.)
    return `${el.getAttribute("role") ?? el.tagName.toLowerCase()}:${(el.querySelector('[slot="label"]')?.textContent ?? el.textContent)?.trim()}`;
  });
const active = (p) =>
  p.evaluate(() => {
    const el = document.activeElement;
    const id = el?.getAttribute("aria-activedescendant");
    const row = id ? document.getElementById(id) : null;
    return row
      ? (row.querySelector('[slot="label"]')?.textContent ?? row.textContent)?.trim()
      : undefined;
  });
const menus = (p) => p.locator('[role="menu"]').count();
const valueText = (p) =>
  p.evaluate(
    () =>
      document.querySelector(".react-aria-Cascader .react-aria-SelectValue")
        ?.textContent,
  );
/** The open boxes: each popover's width · its visible edges (outline/border) and its list's border. */
const boxes = (p) =>
  p.evaluate(() =>
    [...document.querySelectorAll(".react-aria-Popover")].map((pop) => {
      const s = getComputedStyle(pop);
      const list = pop.querySelector('[role="menu"]');
      const l = list && getComputedStyle(list);
      const edge = (st) =>
        (st.outlineStyle !== "none" && parseFloat(st.outlineWidth) > 0) ||
        parseFloat(st.borderTopWidth) > 0;
      return {
        trigger: pop.getAttribute("data-trigger"),
        size: pop.getAttribute("data-size"),
        catalogId: pop.getAttribute("data-catalog-id"),
        width: pop.getBoundingClientRect().width,
        popoverEdge: edge(s),
        listEdge: !!l && parseFloat(l.borderTopWidth) > 0,
        listClass: list?.className,
        listId: list?.getAttribute("data-catalog-id"),
      };
    }),
  );

const CHAIN = [
  ["alpha", "Alpha"],
  ["beta", "Beta"],
  ["gamma", "Gamma"],
  ["delta", "Delta"],
  ["epsilon", "Epsilon"],
  ["leaf", "Leaf"],
];
// (The levels entered down to the leaf's — no crumb of the top level, 사용자 결정 2026-11-29.)
const PATH = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"];

const write = (p, fn, arg) =>
  p.evaluate(
    async ({ COMMANDS, fn, arg }) => {
      const c = await import(COMMANDS);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const records = [...ws.root.domInputs.values()];
      const typeOf = (r) => ws.root.typeOf(r);
      const field = records.find((r) => typeOf(r) === "Cascader");
      const set = (props) =>
        ws.execute(
          c.setFields({
            targets: [ws.itemOfRecord(field.id).target],
            props: Object.fromEntries(
              Object.entries(props).map(([k, v]) => [
                k,
                { kind: "set", value: v },
              ]),
            ),
          }),
        );
      const width = (value) =>
        ws.execute(
          c.setFields({
            targets: [ws.itemOfRecord(field.id).target],
            visual: { width: { kind: "set", value } },
          }),
        );
      return new Function("ctx", `return (${fn})(ctx)`)({
        c,
        ws,
        records,
        typeOf,
        field,
        set,
        width,
        arg,
      });
    },
    { COMMANDS, fn: fn.toString(), arg },
  );

const trail = (p) =>
  p.evaluate(() => {
    const dialog = document.querySelector('section[role="dialog"]');
    const list = dialog?.querySelector(".react-aria-Breadcrumbs");
    if (!list) return null;
    return {
      shown: getComputedStyle(list).display !== "none",
      crumbs: [...list.querySelectorAll(":scope > .react-aria-Breadcrumb")].map(
        (crumb) =>
          crumb.classList.contains("breadcrumb-menu")
            ? "…"
            : crumb.textContent.trim(),
      ),
    };
  });
const backButton = (p) =>
  p.evaluate(() => {
    const back = document.querySelector(
      'section[role="dialog"] button[slot="back"]',
    );
    return back
      ? {
          disabled: back.disabled || back.hasAttribute("data-disabled"),
          shown: getComputedStyle(back).display !== "none",
          name: back.getAttribute("aria-label"),
        }
      : null;
  });
const rows = (p) =>
  p.evaluate(() =>
    [
      ...document.querySelectorAll(
        'section[role="dialog"] [role="grid"] [role="row"], section[role="dialog"] [role="treegrid"] [role="row"]',
      ),
    ].map((row) =>
      (row.querySelector('[slot="label"]')?.textContent ?? row.textContent).trim(),
    ),
  );
const dialogs = (p) => p.locator('[role="dialog"]').count();

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await settle(page, 300);
  await page.keyboard.type(`adr326 g3 live ${NAME}`);
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
  for (const name of [/^breadcrumbs$/i, /^cascader$/i]) {
    await page
      .locator("button, [role='button'], [role='option'], [role='gridcell']")
      .filter({ hasText: name })
      .first()
      .click();
    await settle(page, 1500);
  }
  // The field: drill, 260 wide, Books painted, a chain of six levels under the list box.
  await write(
    page,
    ({ c, ws, records, typeOf, set, width, arg }) => {
      // (`searchScope: "global"` — case 5 reads the flat results; the default narrows the level
      //  shown, `adr326-reference-live.mjs`.)
      set({ mode: "drill", searchScope: "global" });
      width(260);
      const books = records.find(
        (r) => typeOf(r) === "CascaderItem" && r.props.id === "books",
      );
      ws.execute(
        c.setFields({
          targets: [ws.itemOfRecord(books.id).target],
          visual: { backgroundColor: { kind: "set", value: arg.PAINT } },
        }),
      );
      const list = records.find((r) => typeOf(r) === "CascaderList");
      let host = ws.itemOfRecord(list.id).target;
      const item = records.find(
        (r) => typeOf(r) === "CascaderItem" && r.props.id === "books",
      );
      for (const [key, label] of arg.CHAIN) {
        const id = `project:node:g3-${key}`;
        ws.execute(
          c.insertCollectionItem({
            host,
            key,
            rootId: id,
            entries: [
              {
                kind: "node",
                id,
                definitionId: item.definitionId.includes("cascaderitem")
                  ? item.definitionId
                  : "lib:definition:origin-component-cascaderitem",
                children: [],
                props: {
                  id: { kind: "set", value: key },
                  label: { kind: "set", value: label },
                },
                visual: {},
                sizing: {},
                descendantOverrides: [],
              },
            ],
            newId: ws.newId,
          }),
        );
        host = { kind: "node", id };
      }
      return true;
    },
    { PAINT, CHAIN },
  );
  await settle(page, 1200);

  // (The Preview window takes the document as it opens: each Builder edit below opens it again.)
  let pub;
  let button;
  const publish = async () => {
    await pub?.close();
    const popup = context.waitForEvent("page", { timeout: 30000 });
    await page.evaluate(() =>
      [...document.querySelectorAll("button")]
        .find((b) =>
          ["Preview", "미리보기"].includes(b.getAttribute("aria-label")),
        )
        ?.click(),
    );
    pub = await popup;
    pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
    pub.on("response", (r) => {
      if (r.status() >= 400) consoleErrors.push(`${r.status()} ${r.url()}`);
    });
    pub.on("console", (m) => {
      if (m.type() === "error" && !/favicon\.ico/.test(m.location()?.url ?? ""))
        consoleErrors.push(`${m.text().slice(0, 200)} @ ${m.location()?.url}`);
    });
    await pub.waitForURL((u) => String(u) !== "about:blank", {
      timeout: 30000,
    });
    await pub.waitForSelector(".react-aria-Cascader button", {
      timeout: 60000,
    });
    await settle(pub, 800);
    button = pub.locator(".react-aria-Cascader button").first();
  };
  await publish();
  const openIt = async () => {
    await button.click();
    await pub.waitForSelector('section[role="dialog"]', { timeout: 10000 });
    await settle(pub, 500);
  };
  const closeIt = async () => {
    await pub.keyboard.press("Escape");
    await settle(pub, 400);
  };

  // 1. drill open
  const buttonWidth = (await button.boundingBox()).width;
  await openIt();
  const box = await pub.evaluate(() => {
    const pop = document.querySelector(
      '.react-aria-Popover[data-trigger="Cascader"]',
    );
    const s = getComputedStyle(pop);
    const list = pop.querySelector(".react-aria-CascaderList");
    return {
      width: pop.getBoundingClientRect().width,
      role: pop.getAttribute("role"),
      edges:
        Number(
          (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) ||
            parseFloat(s.borderTopWidth) > 0,
        ) +
        Number(!!list && parseFloat(getComputedStyle(list).borderTopWidth) > 0),
      listId: list?.getAttribute("data-catalog-id"),
      rowClass: list?.querySelector('[role="row"]')?.className,
    };
  });
  const t1 = await trail(pub);
  const b1 = await backButton(pub);
  record(
    "1 drill 열기 — dialog 하나 · focus 검색 칸 · 폭 = Button · 테두리 하나 · 맨 위 단계: 경로 줄 없음 · 뒤로 disabled (안 보임)",
    (await dialogs(pub)) === 1 &&
      (await focused(pub)) === "input:" &&
      Math.abs(box.width - buttonWidth) <= 1 &&
      box.edges === 1 &&
      /__list$/.test(box.listId ?? "") &&
      box.rowClass === "react-aria-CascaderItem" &&
      t1 === null &&
      b1?.disabled === true &&
      b1?.shown === false &&
      ["Back", "뒤로"].includes(b1?.name),
    {
      dialogs: await dialogs(pub),
      focus: await focused(pub),
      buttonWidth,
      box,
      t1,
      b1,
    },
  );
  await pub.screenshot({ path: `${OUT}/${NAME}-drill-open.png` });

  // 2. the trail's computed spacing = a Breadcrumbs component's (same size) — a level under the top
  //    (the top level draws no trail): Tab → the first row, Enter → into it.
  await pub.keyboard.press("Tab");
  const tabbed = await focused(pub);
  await pub.keyboard.press("Enter");
  await settle(pub, 400);
  const spacing = await pub.evaluate(() => {
    const read = (list) => {
      const crumb = list.querySelector(":scope > .react-aria-Breadcrumb");
      const ls = getComputedStyle(list);
      const cs = getComputedStyle(crumb);
      return {
        size: list.getAttribute("data-size"),
        listGap: ls.columnGap,
        crumbGap: cs.columnGap,
        fontSize: cs.fontSize,
        shrink: cs.flexShrink,
      };
    };
    const own = document.querySelector(
      'section[role="dialog"] .react-aria-Breadcrumbs',
    );
    const page = [...document.querySelectorAll(".react-aria-Breadcrumbs")].find(
      (list) => !list.closest(".react-aria-Popover"),
    );
    return { trail: read(own), component: page && read(page) };
  });
  record(
    "2 경로 줄 간격 = Breadcrumbs 컴포넌트 (목록 gap · crumb gap · 글자 · flex-shrink 0)",
    !!spacing.component &&
      JSON.stringify(spacing.trail) === JSON.stringify(spacing.component) &&
      spacing.trail.shrink === "0",
    spacing,
  );

  // 3. keyboard: Tab → first row · Enter → in (above) · Back → up · Esc → closed
  const inRows = await rows(pub);
  const t3 = await trail(pub);
  const b3 = await backButton(pub);
  await pub.locator('section[role="dialog"] button[slot="back"]').click();
  await settle(pub, 400);
  const upRows = await rows(pub);
  await closeIt();
  record(
    "3 키보드 — Tab 첫 행 · Enter 하위 단계 · 경로 「Electronics」 · 뒤로 → 첫 단계 · Esc 닫힘 · focus Button",
    tabbed === "row:Electronics" &&
      JSON.stringify(inRows) === JSON.stringify(["Computers", "Phones"]) &&
      JSON.stringify(t3?.crumbs) === JSON.stringify(["Electronics"]) &&
      b3?.disabled === false &&
      JSON.stringify(upRows.slice(0, 3)) ===
        JSON.stringify(["Electronics", "Clothing", "Books"]) &&
      (await dialogs(pub)) === 0 &&
      (await focused(pub)) === "open",
    {
      tabbed,
      inRows,
      t3,
      b3,
      upRows,
      dialogs: await dialogs(pub),
      focus: await focused(pub),
    },
  );

  // 4. deep path × two widths
  await write(page, ({ set }) => set({ value: "leaf" }));
  for (const fieldWidth of [420, 240]) {
    await write(page, ({ width, arg }) => width(arg), fieldWidth);
    await settle(page, 600);
    await publish();
    await openIt();
    const start = await trail(pub);
    const startRows = await rows(pub);
    const shownCrumbs = (start?.crumbs ?? []).filter((c) => c !== "…");
    await pub.locator('section[role="dialog"] .breadcrumb-menu button').click();
    await settle(pub, 400);
    const menu = await pub.evaluate(() =>
      [
        ...document.querySelectorAll(
          '[role="menu"][aria-label="More items"] [role="menuitem"]',
        ),
      ].map((item) => item.textContent.trim()),
    );
    await pub.keyboard.press("Escape");
    await settle(pub, 300);
    const union = [shownCrumbs[0], ...menu, ...shownCrumbs.slice(1)];
    // (Each crumb of the path goes to its level: a menu item, else the shown crumb.)
    const moves = [];
    for (const [index, name] of PATH.entries()) {
      if ((await dialogs(pub)) === 0) await openIt();
      // (Back to the start level first — the leaf's parent.)
      const here = await trail(pub);
      const inMenu = !(here?.crumbs ?? []).includes(name);
      if (inMenu) {
        await pub
          .locator('section[role="dialog"] .breadcrumb-menu button')
          .click();
        await settle(pub, 300);
        await pub
          .locator('[role="menu"][aria-label="More items"] [role="menuitem"]')
          .filter({ hasText: new RegExp(`^${name}$`) })
          .click();
      } else if (index !== PATH.length - 1) {
        await pub
          .locator('section[role="dialog"] .react-aria-Breadcrumbs')
          .getByRole("link", { name, exact: true })
          .click();
      }
      await settle(pub, 400);
      const got = await rows(pub);
      // (A crumb's level holds the next item of the chain.)
      const expected = [CHAIN[index + 1][1]];
      // (A crumb moves the level, not the page — the Preview's route stays.)
      const url = pub.url();
      moves.push({
        name,
        inMenu,
        got,
        url,
        ok: JSON.stringify(got) === JSON.stringify(expected) && !/#$/.test(url),
      });
      await closeIt();
    }
    record(
      `4 깊은 경로 (폭 ${fieldWidth}) — 보이는 crumb + 메뉴 = 전체 경로 · 각 항목이 그 단계로`,
      JSON.stringify(startRows) === JSON.stringify(["Leaf"]) &&
        JSON.stringify(union) === JSON.stringify(PATH) &&
        start?.crumbs.includes("…") &&
        moves.every((move) => move.ok),
      { start, menu, union, moves },
    );
    await pub.screenshot({ path: `${OUT}/${NAME}-deep-${fieldWidth}.png` });
  }

  // 5. searching hides the trail and Back
  await openIt();
  await pub.keyboard.type("lea");
  await settle(pub, 500);
  const t5 = await trail(pub);
  const b5 = await backButton(pub);
  const found = await pub.evaluate(() =>
    [
      ...document.querySelectorAll(
        'section[role="dialog"] [role="menu"] [role^="menuitem"]',
      ),
    ].map((row) => (row.querySelector('[slot="label"]')?.textContent ?? row.textContent).trim()),
  );
  record(
    "5 검색 중 경로 줄 · 뒤로 숨김 · 결과 Leaf (잎만 고를 수 있음)",
    t5?.shown === false &&
      b5?.shown === false &&
      found.length === 1 &&
      found[0].startsWith("Leaf"),
    { t5, b5, found },
  );
  await closeIt();
  await closeIt();

  // 6. tree
  await write(page, ({ set }) => set({ mode: "tree", value: "books" }));
  await settle(page, 600);
  await publish();
  await openIt();
  const tree = await pub.evaluate(() => {
    const grid = document.querySelector(
      'section[role="dialog"] [role="treegrid"]',
    );
    const rowEls = [...grid.querySelectorAll('[role="row"]')];
    return {
      dialogs: document.querySelectorAll('[role="dialog"]').length,
      listId: grid.getAttribute("data-catalog-id"),
      listClass: grid.className,
      rows: rowEls.map((row) => ({
        text: (row.querySelector('[slot="label"]')?.textContent ?? row.textContent).trim(),
        cls: row.className,
        bg: row.style.backgroundColor,
        expanded: row.getAttribute("aria-expanded"),
        chevron: !!row.querySelector('button[slot="chevron"] .react-aria-Icon'),
      })),
    };
  });
  await pub
    .locator('section[role="dialog"] [role="row"]')
    .first()
    .locator('button[slot="chevron"]')
    .click();
  await settle(pub, 500);
  const expandedRows = await rows(pub);
  // (판독 1 수리: depth indent over the size block · a pointer hover paints the row.)
  const indent = await pub.evaluate(() => {
    const [parent, child] = document.querySelectorAll(
      'section[role="dialog"] [role="treegrid"] [role="row"]',
    );
    return {
      parent: getComputedStyle(parent).paddingInlineStart,
      child: getComputedStyle(child).paddingInlineStart,
    };
  });
  const booksRow = pub
    .locator('section[role="dialog"] [role="row"]')
    // (By its label — a branch row also holds its item count, 2026-11-29.)
    .filter({ has: pub.locator('[slot="label"]', { hasText: /^Clothing$/ }) });
  await booksRow.hover();
  await settle(pub, 300);
  const hovered = await booksRow.evaluate((row) => ({
    attr: row.hasAttribute("data-hovered"),
    bg: getComputedStyle(row).backgroundColor,
  }));
  const turned = await pub.evaluate(() => {
    const icon = document.querySelector(
      'section[role="dialog"] [role="row"][aria-expanded="true"] button[slot="chevron"] .react-aria-Icon',
    );
    return icon ? getComputedStyle(icon).transform : null;
  });
  record(
    "6 tree — treegrid = CascaderList · 행 record · Books 배경 · 펼침 버튼 → 하위 행 · 깊이 들여쓰기 · hover 칠",
    tree.dialogs === 1 &&
      /__list$/.test(tree.listId ?? "") &&
      tree.listClass === "react-aria-CascaderList" &&
      tree.rows.every((row) => row.cls === "react-aria-CascaderItem") &&
      tree.rows.find((row) => row.text === "Books")?.bg === PAINT &&
      tree.rows[0]?.expanded === "false" &&
      tree.rows[0]?.chevron &&
      JSON.stringify(expandedRows.slice(0, 3)) ===
        JSON.stringify(["Electronics", "Computers", "Phones"]) &&
      !!turned &&
      turned !== "none" &&
      parseFloat(indent.child) > parseFloat(indent.parent) &&
      hovered.attr &&
      hovered.bg !== "rgba(0, 0, 0, 0)",
    { tree, expandedRows, turned, indent, hovered },
  );
  await pub.screenshot({ path: `${OUT}/${NAME}-tree.png` });

  // 7. (Phase 2 의 찾은 것) 항목 안에 slot 없는 Text 를 하나 더 — columns 행이 그 글자를 그리고 page error 0
  await write(page, ({ c, ws, records, typeOf, set }) => {
    set({ mode: "columns" });
    const books = records.find(
      (r) => typeOf(r) === "CascaderItem" && r.props.id === "books",
    );
    ws.execute(
      c.insertNodes({
        parent: ws.itemOfRecord(books.id).target,
        index: 1,
        entries: [
          {
            kind: "node",
            id: "project:node:g3-extra-text",
            definitionId: "lib:definition:text",
            children: [],
            props: { children: { kind: "set", value: "Extra" } },
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
        ],
        rootIds: ["project:node:g3-extra-text"],
        newId: ws.newId,
      }),
    );
    return true;
  });
  await settle(page, 600);
  const errorsBefore = errors.length;
  await publish();
  await button.click();
  await pub.waitForSelector('[role="menu"]', { timeout: 10000 });
  await settle(pub, 800);
  const extraRow = await pub.evaluate(
    () =>
      [...document.querySelectorAll('[role="menu"] [role^="menuitem"]')]
        .map((row) => row.textContent.trim())
        .find((text) => text.startsWith("Books")) ?? null,
  );
  record(
    "7 항목 안 slot 없는 Text — 행이 그 글자를 그림 · page error 0 (jsdom 의 무한 갱신은 브라우저에서 없음)",
    extraRow === "BooksExtra" && errors.length === errorsBefore,
    { extraRow, errors: errors.slice(errorsBefore, errorsBefore + 3) },
  );
  await closeIt();
} catch (error) {
  record("실행 오류", false, String(error).split("\n").slice(0, 3).join(" | "));
  const pages = context.pages();
  const last = pages[pages.length - 1];
  writeFileSync(
    `${OUT}/${NAME}-error-dom.html`,
    await last
      .evaluate(
        () =>
          [
            ...document.querySelectorAll(
              ".react-aria-Popover, [data-testid='underlay']",
            ),
          ]
            .map((el) => el.outerHTML.slice(0, 4000))
            .join("\n\n----\n\n") +
          "\n\n====\n\n" +
          (document.querySelector(".react-aria-Cascader")?.outerHTML ?? ""),
      )
      .catch(() => ""),
  );
  await last.screenshot({ path: `${OUT}/${NAME}-error.png` }).catch(() => {});
}
record("console error 0", consoleErrors.length === 0, {
  consoleErrors: consoleErrors.slice(0, 4),
  notFound: notFound.slice(0, 6),
});
record("8 page error 0", errors.length === 0, errors.slice(0, 4));
await browser.close();
writeFileSync(`${OUT}/${NAME}.json`, JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.pass).length;
process.stdout.write(
  `\n[${NAME}] ${failed ? `FAIL ${failed}` : `ALL PASS ${results.length}`}\n`,
);
process.exit(failed ? 1 : 0);
