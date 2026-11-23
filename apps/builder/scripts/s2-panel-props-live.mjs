#!/usr/bin/env node
// S2 §9 패널 prop live (2026-11-24, S2 체크리스트 §9.1 · §9.2 「패널」):
//   1. Components 패널 「side nav」 → Design 패널에 「Expanded items」 칸
//   2. 명령으로 SideNav expandedKeys = [자식 있는 항목] → Canvas 에 그 항목의 자식이 상자를 가진다
//   3. 「menu」 → Menu 선택 시 Design 패널에 「Close on select」 · 「Focus wrap」 칸
//   4. Publish: SideNav 그 항목 aria-expanded="true"
//   5. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-panel-props-live.mjs <out-dir>
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/s2-panel-props-live";
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

const select = (type) =>
  page.evaluate((type) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const r = ws.root;
    const record = [...r.canvasInputs.values()]
      .filter((x) => r.typeOf(x) === type)
      .at(-1);
    ws.selectItems([ws.itemOfRecord(record.id)]);
  }, type);

const panelText = async () => {
  await openDesign();
  await page.waitForTimeout(800);
  return page.locator(".panel-wrapper[data-panel='properties']").innerText();
};

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("panel props live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  // 1. SideNav: the Expanded items field.
  await place(/^side nav$/i);
  await select("SideNav");
  const navPanel = await panelText();
  await page.screenshot({ path: `${OUT}/builder-sidenav-panel.png` });
  record(
    "1 SideNav Design 패널에 Expanded items 칸",
    /Expanded items/i.test(navPanel),
    {
      has: /Expanded items/i.test(navPanel),
    },
  );

  // 2. Write the keys; the child items get boxes on the Canvas.
  const canvas = await page.evaluate(() => {
    const { workspace: ws, commands: c } = window.__COMPOSITION_CATALOG__;
    const r = ws.root;
    const items = [...r.canvasInputs.values()].filter(
      (x) => r.typeOf(x) === "SideNavItem",
    );
    const parent = items.find((item) =>
      item.children.some(
        (id) => r.typeOf(r.canvasInputs.get(id)) === "SideNavItem",
      ),
    );
    const child = parent.children.find(
      (id) => r.typeOf(r.canvasInputs.get(id)) === "SideNavItem",
    );
    const height = () => r.getGeometry([child]).get(child)?.height ?? 0;
    const nav = [...r.canvasInputs.values()].find(
      (x) => r.typeOf(x) === "SideNav",
    );
    const key = String(parent.props.id ?? parent.id);
    const write = (keys) =>
      ws.execute(
        c.setFields({
          targets: [ws.itemOfRecord(nav.id).target],
          props: { expandedKeys: { kind: "set", value: keys } },
        }),
      );
    write([]);
    const closed = height();
    write([key]);
    return { key, parent: parent.id, closed, open: height() };
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/builder-sidenav-expanded.png` });
  record(
    "2 SideNav 펼침 키 [] → 자식 상자 0, [항목] → 자식 상자 생김 (Canvas)",
    canvas.closed === 0 && canvas.open > 0,
    canvas,
  );

  // 3. Menu: the panel fields.
  await place(/^menu$/i);
  await select("Menu");
  const menuPanel = await panelText();
  await page.screenshot({ path: `${OUT}/builder-menu-panel.png` });
  record(
    "3 Menu Design 패널에 Close on select · Focus wrap 칸",
    /Close on select|선택 시 닫기/i.test(menuPanel) &&
      /Focus wrap|이어 이동/i.test(menuPanel),
    { length: menuPanel.length },
  );

  // 4. Publish.
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
  await pub.waitForSelector(".react-aria-SideNav", { timeout: 60000 });
  await pub.waitForTimeout(1500);
  const expanded = await pub.evaluate((id) => {
    const el = document.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
    return (
      el?.getAttribute("aria-expanded") ??
      el?.closest("[aria-expanded]")?.getAttribute("aria-expanded") ??
      el?.querySelector("[aria-expanded]")?.getAttribute("aria-expanded") ??
      null
    );
  }, canvas.parent);
  await pub.screenshot({ path: `${OUT}/publish.png` });
  record("4 Publish SideNav 그 항목 aria-expanded=true", expanded === "true", {
    expanded,
  });
} catch (error) {
  record("run", false, String(error?.stack ?? error));
  await page.screenshot({ path: `${OUT}/error.png` }).catch(() => {});
}

record("5 page error 0", errors.length === 0, errors);
await browser.close();
const failed = results.filter((r) => !r.pass);
process.stdout.write(
  `\n${results.length - failed.length}/${results.length} PASS\n`,
);
process.exit(failed.length ? 1 : 0);
