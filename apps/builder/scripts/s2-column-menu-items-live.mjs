#!/usr/bin/env node
// S2 Column `menuItems` live (2026-11-24, S2 체크리스트 §9.2): a Column's MenuItem children are its
// menu's own items.
//   1. Components 패널 「table」 → 명령으로 첫 Column 에 MenuItem 「Export」 (Text 자식) 넣기 →
//      Canvas: Column 은 메뉴 열 (isMenu), MenuItem 은 그리지 않음
//   2. Publish: 그 열 머리글 메뉴 버튼 → 메뉴 항목 끝에 「Export」, 머리글 글자에는 없음
//   3. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-column-menu-items-live.mjs <out-dir>
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/s2-column-menu-items-live";
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

const place = async (label) => {
  const components = railButton(page, "components");
  if ((await components.getAttribute("aria-pressed")) !== "true") {
    await components.click();
    await page.waitForTimeout(900);
  }
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
  );
  const item = page
    .locator("button, [role='button'], [role='option'], [role='gridcell']")
    .filter({ hasText: label })
    .first();
  await item.waitFor({ state: "visible", timeout: 15000 });
  await item.click();
  await page.waitForTimeout(1500);
};

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

const field = (label) =>
  page
    .locator(".panel-wrapper[data-panel='properties'] fieldset", {
      has: page.locator("legend", { hasText: label }),
    })
    .first();

/** The first record of `type` (its edit target) — and a write of `props` to it, one command. */
const write = (type, props) =>
  page.evaluate(
    ({ type, props }) => {
      const { workspace: ws, commands: c } = window.__COMPOSITION_CATALOG__;
      const r = ws.root;
      const record = [...r.canvasInputs.values()]
        .filter((x) => r.typeOf(x) === type)
        .at(-1);
      if (Object.keys(props).length)
        ws.execute(
          c.setFields({
            targets: [ws.itemOfRecord(record.id).target],
            props: Object.fromEntries(
              Object.entries(props).map(([k, v]) => [
                k,
                { kind: "set", value: v },
              ]),
            ),
          }),
        );
      return record.id;
    },
    { type, props },
  );

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("column menu items live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);
  await place(/^table$/i);
  const canvas = await page.evaluate(() => {
    const { workspace: ws, commands: c } = window.__COMPOSITION_CATALOG__;
    const r = ws.root;
    // (A data Column — its name text; the selection column has a Checkbox, no menu.)
    const column = [...r.canvasInputs.values()].find(
      (x) =>
        r.typeOf(x) === "Column" &&
        typeof x.props.children === "string" &&
        x.props.children !== "",
    );
    const target = ws.itemOfRecord(column.id).target;
    if (target.kind !== "node") return { error: "column not owned", target };
    const blank = { visual: {}, sizing: {}, descendantOverrides: [] };
    ws.execute(
      c.insertNodes({
        parent: { kind: "node", id: target.id },
        entries: [
          {
            kind: "node",
            id: "project:node:live-export",
            definitionId: "lib:definition:type-MenuItem",
            children: ["project:node:live-export-text"],
            props: { id: { kind: "set", value: "export" } },
            ...blank,
          },
          {
            kind: "node",
            id: "project:node:live-export-text",
            definitionId: "lib:definition:text",
            children: [],
            props: { children: { kind: "set", value: "Export" } },
            ...blank,
          },
        ],
        rootIds: ["project:node:live-export"],
        newId: ws.newId,
      }),
    );
    const now = ws.root;
    const item = [...now.canvasInputs.values()].find(
      (x) => x.sourceId === "project:node:live-export",
    );
    const col = item ? now.canvasInputs.get(item.parentId) : undefined;
    const box = item ? now.getGeometry([item.id]).get(item.id) : undefined;
    return {
      colType: col ? now.typeOf(col) : null,
      colSource: col?.sourceId,
      target: target.id,
      name: col?.props.children,
      isMenu: col?.props.isMenu,
      itemBox: box ? { w: box.width, h: box.height } : null,
    };
  });
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
  );
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/builder.png` });
  record(
    "1 Canvas: Column 메뉴 열 · MenuItem 상자 없음",
    canvas.isMenu === true && (!canvas.itemBox || canvas.itemBox.w === 0),
    canvas,
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
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector(".catalog-column-menu-button", { timeout: 60000 });
  await pub.waitForTimeout(1000);
  const button = pub.locator(".catalog-column-menu-button").first();
  const headerText = await button.innerText();
  await button.click();
  await pub.waitForTimeout(800);
  const items = await pub.evaluate(() =>
    [...document.querySelectorAll('[role="menuitem"]')].map((e) =>
      e.textContent.trim(),
    ),
  );
  await pub.screenshot({ path: `${OUT}/publish-menu.png` });
  record(
    "2 Publish: 열 메뉴 끝에 Export · 머리글 글자에는 없음",
    items.at(-1) === "Export" && !headerText.includes("Export"),
    { headerText, items },
  );
} catch (error) {
  record("run", false, String(error?.stack ?? error));
  await page.screenshot({ path: `${OUT}/error.png` }).catch(() => {});
}

record("3 page error 0", errors.length === 0, errors);
await browser.close();
const failed = results.filter((r) => !r.pass);
process.stdout.write(
  `\n${results.length - failed.length}/${results.length} PASS\n`,
);
process.exit(failed.length ? 1 : 0);
