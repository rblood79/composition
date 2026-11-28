#!/usr/bin/env node
// ADR-326 G2 live — Cascader `columns` 의 열린 내용이 원본 노드 (Popover · SearchField · CascaderList ·
// CascaderItem) 로 그려진다 (breakdown §4.3 · §4.6 · Phase 0 의 Phase 2 조건). 실제 Builder 에서 팔레트로 놓고
// 한 항목 (Books) 의 배경을 쓴 뒤 Publish 에서 Chrome · WebKit 으로 판정한다. 기대값은 이 파일에 적었다.
//   1. 포인터로 열기 — menu 하나 · focus = 검색 칸 · 열린 상자 폭 = 여는 Button 폭 (±1) · 테두리 하나
//      (상자의 outline/border + 목록의 border 중 보이는 것이 하나)
//   2. 행 ↔ record — 목록 요소 = CascaderList record (`data-catalog-id`) · 행 class `react-aria-CascaderItem` ·
//      Books 행의 배경 = Builder 에서 쓴 값 (이웃 행은 그대로)
//   3. 루트 잎 Books 고르기 → 다시 열기 → Esc → 닫힘 · focus Button (Phase 0 발견 — 지금 결함)
//   4. 검색 「lap」 → 결과 Laptops · ↓ Enter → 값 = 경로 · 닫힘 · focus Button · 다시 열면 검색 칸 빈 값 · 단계 목록
//   5. 키보드 — 검색 칸에서 ↓ (가상 focus Electronics) · → 하위 단계 · → 셋째 단계 · ↓ Enter → 값 · focus Button
//   6. 바깥 클릭 → 닫힘 · focus Button (공용 Popover 의 복원을 끔 — Phase 0 P1 조건)
//   7. 하위 단계 상자 — `data-size` 가 있다 (Menu 시트의 SubmenuTrigger 블록) · 테두리 하나
//   8. page error 0
//
//   BROWSER=webkit BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr326-g2-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, webkit } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr326-g2-live";
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
    return `${el.getAttribute("role") ?? el.tagName.toLowerCase()}:${el.textContent?.trim()}`;
  });
const active = (p) =>
  p.evaluate(() => {
    const el = document.activeElement;
    const id = el?.getAttribute("aria-activedescendant");
    return id ? document.getElementById(id)?.textContent?.trim() : undefined;
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

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await settle(page, 300);
  await page.keyboard.type(`adr326 g2 live ${NAME}`);
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
  await page
    .locator("button, [role='button'], [role='option'], [role='gridcell']")
    .filter({ hasText: /^cascader$/i })
    .first()
    .click();
  await settle(page, 1500);

  // The Builder's records: the list box and the Books item — write Books' background.
  const ids = await page.evaluate(
    async ({ COMMANDS, PAINT, INK, HOVER }) => {
      const c = await import(COMMANDS);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const records = [...ws.root.domInputs.values()];
      const typeOf = (r) => ws.root.typeOf(r);
      const list = records.find((r) => typeOf(r) === "CascaderList");
      const books = records.find(
        (r) => typeOf(r) === "CascaderItem" && r.props.id === "books",
      );
      const laptops = records.find(
        (r) => typeOf(r) === "CascaderItem" && r.props.id === "laptops",
      );
      ws.execute(
        c.setFields({
          targets: [ws.itemOfRecord(books.id).target],
          visual: { backgroundColor: { kind: "set", value: PAINT } },
        }),
      );
      // (A field narrower than the page — its open box takes its width, not the viewport's.)
      const field = records.find((r) => typeOf(r) === "Cascader");
      ws.execute(
        c.setFields({
          targets: [ws.itemOfRecord(field.id).target],
          visual: { width: { kind: "set", value: 260 } },
        }),
      );
      // (판독 1 수리: 항목 글자색 → 라벨 · 필드 size → 목록 · 행 · 라벨 글자 · 원본 Hover → 행.)
      ws.execute(
        c.setFields({
          targets: [ws.itemOfRecord(books.id).target],
          visual: { color: { kind: "set", value: INK } },
        }),
      );
      ws.execute(
        c.setFields({
          targets: [ws.itemOfRecord(field.id).target],
          props: { size: { kind: "set", value: "XL" } },
        }),
      );
      ws.execute(
        c.setLibraryDefault({
          definitionId: books.definitionId,
          scope: "stateRules",
          state: "hover",
          key: "backgroundColor",
          write: { kind: "set", value: HOVER },
          newId: ws.newId,
        }),
      );
      return { list: list?.id, books: books?.id, laptops: laptops?.id };
    },
    { COMMANDS, PAINT, INK, HOVER },
  );
  await settle(page, 1200);

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
  pub.on("response", (r) => {
    if (r.status() >= 400) consoleErrors.push(`${r.status()} ${r.url()}`);
  });
  pub.on("console", (m) => {
    // (The Preview window's `favicon.ico` 404 is the dev server's, not the page's.)
    if (m.type() === "error" && !/favicon\.ico/.test(m.location()?.url ?? ""))
      consoleErrors.push(`${m.text().slice(0, 200)} @ ${m.location()?.url}`);
  });
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector(".react-aria-Cascader button", { timeout: 60000 });
  await settle(pub, 800);
  const button = pub.locator(".react-aria-Cascader button").first();
  const buttonWidth = (await button.boundingBox()).width;

  // 1. open (pointer)
  await button.click();
  await pub.waitForSelector('[role="menu"]', { timeout: 10000 });
  await settle(pub, 400);
  const open = await boxes(pub);
  const first = open[0];
  record(
    "1 열기 — menu 하나 · focus 검색 칸 · 폭 = Button 폭 · 테두리 하나",
    (await menus(pub)) === 1 &&
      (await focused(pub)) === "input:" &&
      !!first &&
      Math.abs(first.width - buttonWidth) <= 1 &&
      Number(first.popoverEdge) + Number(first.listEdge) === 1,
    {
      menus: await menus(pub),
      focus: await focused(pub),
      buttonWidth,
      open,
    },
  );
  await pub.screenshot({ path: `${OUT}/${NAME}-open.png` });

  // 2. rows ↔ records
  const rows = await pub.evaluate(
    ({ books }) => {
      const items = [
        ...document.querySelectorAll('[role="menu"] [role^="menuitem"]'),
      ];
      const row = (el) => ({
        text: el.textContent.trim(),
        className: el.className,
        id: el.getAttribute("data-catalog-id"),
        background: getComputedStyle(el).backgroundColor,
      });
      return {
        rows: items.map(row),
        books: items
          .filter((el) => el.getAttribute("data-catalog-id") === books)
          .map(row),
      };
    },
    { books: ids.books },
  );
  record(
    "2 행 ↔ record — 목록 = CascaderList record · 행 class · Books 배경만",
    first?.listId === ids.list &&
      rows.rows.length === 3 &&
      rows.rows.every(
        (r) => /\breact-aria-CascaderItem\b/.test(r.className) && !!r.id,
      ) &&
      rows.books.length === 1 &&
      rows.books[0].background === PAINT &&
      rows.rows.filter((r) => r.background === PAINT).length === 1,
    { ids, listId: first?.listId, rows },
  );

  // 11. the item's color · the field's size (판독 1 h1 · m1)
  const look = await pub.evaluate(() => {
    const items = [
      ...document.querySelectorAll('[role="menu"] [role^="menuitem"]'),
    ];
    const books = items.find((el) => el.textContent.trim() === "Books");
    const label = (el) => el.querySelector('.react-aria-Text[slot="label"]');
    return {
      listSize: document
        .querySelector('[role="menu"]')
        ?.getAttribute("data-size"),
      // (수리 검증 m2: the list scrolls in 300 at most — HEAD's level Menu had `Menu.css` 300.)
      listMax: getComputedStyle(document.querySelector('[role="menu"]'))
        .maxHeight,
      rowSizes: items.map((el) => el.getAttribute("data-size")),
      booksLabel: books && getComputedStyle(label(books)).color,
      chevron: items
        .map((el) => el.querySelector('[slot="descriptor"]'))
        .filter(Boolean)
        .map(
          (el) =>
            getComputedStyle(el).color ===
            getComputedStyle(el.closest('[role^="menuitem"]')).color,
        ),
      labelPx: items.map((el) =>
        parseFloat(getComputedStyle(label(el)).fontSize),
      ),
    };
  });
  record(
    "11 글자색 · size · 높이 — Books 라벨 = 행 색 (흰색) · chevron = 행 색 · 목록 · 행 XL · 라벨 글자 > 14 · 목록 max-height 300",
    look.booksLabel === INK &&
      look.chevron.length === 2 &&
      look.chevron.every(Boolean) &&
      look.listSize === "XL" &&
      look.listMax === "300px" &&
      look.rowSizes.every((size) => size === "XL") &&
      look.labelPx.every((px) => px > 14),
    look,
  );

  // 12. the origin's Hover background (판독 1 m3) — Clothing (no written background)
  await pub.getByRole("menuitem", { name: "Clothing" }).hover();
  await settle(pub, 300);
  const hovered = await pub.evaluate(() => {
    const row = [
      ...document.querySelectorAll('[role="menu"] [role^="menuitem"]'),
    ].find((el) => el.textContent.trim() === "Clothing");
    return {
      hovered: row?.hasAttribute("data-hovered"),
      mark: row?.getAttribute("data-catalog-hover"),
      background: row && getComputedStyle(row).backgroundColor,
    };
  });
  record(
    "12 Hover — 원본에 쓴 Hover 배경이 행에",
    hovered.hovered === true &&
      hovered.mark === "background-color" &&
      hovered.background === HOVER,
    hovered,
  );
  await pub.mouse.move(5, 5);
  await settle(pub, 200);

  // 3. a root leaf, then Esc on reopen
  await pub.getByRole("menuitemradio", { name: "Books" }).click();
  await settle(pub, 600);
  const picked = { menus: await menus(pub), value: await valueText(pub) };
  await button.click();
  await pub.waitForSelector('[role="menu"]', { timeout: 10000 });
  await settle(pub, 400);
  await pub.keyboard.press("Escape");
  await settle(pub, 500);
  record(
    "3 루트 잎 Books → 다시 열기 → Esc → 닫힘 · focus Button",
    picked.menus === 0 &&
      picked.value === "Books" &&
      (await menus(pub)) === 0 &&
      (await focused(pub)) === "open",
    { picked, menus: await menus(pub), focus: await focused(pub) },
  );
  if (await menus(pub)) {
    await pub.mouse.click(1500, 900);
    await settle(pub, 400);
  }

  // 4. search
  await button.click();
  await pub.waitForSelector('[role="menu"]', { timeout: 10000 });
  await settle(pub, 400);
  await pub.keyboard.type("lap");
  await settle(pub, 400);
  const found = await pub
    .locator('[role="menu"] [role^="menuitem"]')
    .allTextContents();
  await pub.keyboard.press("ArrowDown");
  await settle(pub, 150);
  await pub.keyboard.press("Enter");
  await settle(pub, 600);
  const afterSearch = {
    menus: await menus(pub),
    focus: await focused(pub),
    value: await valueText(pub),
  };
  await button.click();
  await pub.waitForSelector('[role="menu"]', { timeout: 10000 });
  await settle(pub, 400);
  const reopened = {
    focus: await focused(pub),
    rows: await pub
      .locator('[role="menu"] [role^="menuitem"]')
      .allTextContents(),
  };
  record(
    "4 검색 lap → Laptops · ↓ Enter → 값 · 다시 열면 빈 검색 · 단계 목록",
    found.length === 1 &&
      /Laptops/.test(found[0]) &&
      afterSearch.menus === 0 &&
      afterSearch.focus === "open" &&
      afterSearch.value === "Electronics / Computers / Laptops" &&
      reopened.focus === "input:" &&
      reopened.rows.some((t) => t.trim() === "Electronics"),
    { found, afterSearch, reopened },
  );

  // 5. keyboard into the third level (from the open above)
  await pub.keyboard.press("ArrowDown");
  await settle(pub, 150);
  const firstActive = await active(pub);
  await pub.keyboard.press("ArrowRight");
  await settle(pub, 400);
  const second = await focused(pub);
  const levelBoxes = await boxes(pub);
  await pub.screenshot({ path: `${OUT}/${NAME}-levels.png` });
  await pub.keyboard.press("ArrowRight");
  await settle(pub, 400);
  const third = await focused(pub);
  await pub.keyboard.press("ArrowDown");
  await settle(pub, 150);
  await pub.keyboard.press("Enter");
  await settle(pub, 600);
  record(
    "5 키보드 — ↓ (가상 focus) · → · → · ↓ Enter → 값 · focus Button",
    firstActive === "Electronics" &&
      second === "menuitem:Computers" &&
      /^menuitemradio:Laptops/.test(third) &&
      (await menus(pub)) === 0 &&
      (await focused(pub)) === "open" &&
      (await valueText(pub)) === "Electronics / Computers / Desktops",
    {
      firstActive,
      second,
      third,
      menus: await menus(pub),
      focus: await focused(pub),
      value: await valueText(pub),
    },
  );
  const sub = levelBoxes.find((b) => b.trigger === "SubmenuTrigger");
  record(
    "7 하위 단계 상자 — data-size · 테두리 하나",
    !!sub && !!sub.size && Number(sub.popoverEdge) + Number(sub.listEdge) === 1,
    { levelBoxes },
  );

  // 9. accessibility tree — ADR-322 G2's (5 · 3): the first level, the search box's name, the picked
  //    leaf checked three levels down
  await button.click();
  await pub.waitForSelector('[role="menu"]', { timeout: 10000 });
  await settle(pub, 400);
  const firstSnap = await pub.locator('[role="menu"]').first().ariaSnapshot();
  const searchName = await pub.evaluate(() =>
    document
      .querySelector('[data-trigger="Cascader"] input')
      ?.getAttribute("aria-label"),
  );
  await pub.keyboard.press("ArrowDown");
  await settle(pub, 150);
  await pub.keyboard.press("ArrowRight");
  await settle(pub, 400);
  await pub.keyboard.press("ArrowRight");
  await settle(pub, 400);
  const thirdSnap = await pub.locator('[role="menu"]').nth(2).ariaSnapshot();
  record(
    "9 접근성 — 첫 단계 (가지 menuitem · 끝 menuitemradio) · 검색 칸 이름 · 고른 잎 [checked]",
    /menuitem "Electronics"/.test(firstSnap) &&
      /menuitem "Clothing"/.test(firstSnap) &&
      /menuitemradio "Books"/.test(firstSnap) &&
      ["Search", "검색"].includes(searchName) &&
      /menuitemradio "Desktops" \[checked\]/.test(thirdSnap),
    {
      firstSnap: firstSnap.replace(/\n/g, " ¶ "),
      searchName,
      thirdSnap: thirdSnap.replace(/\n/g, " ¶ "),
    },
  );
  for (let i = 0; i < 4 && (await menus(pub)); i++) {
    await pub.keyboard.press("Escape");
    await settle(pub, 250);
  }

  // 6. outside click
  await button.click();
  await pub.waitForSelector('[role="menu"]', { timeout: 10000 });
  await settle(pub, 400);
  await pub.mouse.click(1500, 900);
  await settle(pub, 500);
  record(
    "6 바깥 클릭 → 닫힘 · focus Button",
    (await menus(pub)) === 0 && (await focused(pub)) === "open",
    { menus: await menus(pub), focus: await focused(pub) },
  );
  await pub.screenshot({ path: `${OUT}/${NAME}-end.png` });
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
