#!/usr/bin/env node
// ADR-318 G5 live — Resizable 상태 연동 (Phase 5): 왼쪽 Panel collapsible (48px) · 최소 200px · Group
// 「Remember sizes」 · page 변수 resized · flipped (규칙이 씀) · 이름 붙인 상태 leftSize · leftCollapsed
// (Panel 의 size · isCollapsed 를 따름) 를 Text 하나가 보이고 Publish 에서
//   1. 첫 화면: 이름 붙인 상태 = 시작 값 (50 · false) · 규칙 변수는 기본값 (0 · false)
//   2. → 키 한 번: When 「Resize」 !event.size = 55 · leftSize 55
//   3. 끌기: 끄는 중에는 When 없음 (상태는 따라감) · 놓을 때 When 「Resize」 — resized = leftSize = 그려진 몫 (±0.5)
//   4. Enter: When 「Collapse change」 !event.isCollapsed = true · leftCollapsed true · 다시 Enter → false
//   4b. Do 「Toggle collapse」 (Button) — 접힘 · 펼침, 상태는 따르고 「Collapse change」 는 없음 (RAC 처럼 사용자 변경만)
//   5. Remember sizes: 끈 뒤 다시 열면 그 크기 · 접은 뒤 다시 열면 접힘 · 스위치를 끈 Group 은 작성 크기로
//   6. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr318-g5-live.mjs <out-dir>
//   BROWSER=webkit 이면 Playwright WebKit 으로
import { mkdirSync, readFileSync } from "node:fs";
import { chromium, webkit } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr318-g5-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const MOD = process.platform === "darwin" ? "Meta" : "Control";

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 900)}\n`,
  );
};

const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser =
  process.env.BROWSER === "webkit"
    ? await webkit.launch({ headless: false })
    : await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

const openRail = async (id) => {
  const button = railButton(page, id);
  if ((await button.getAttribute("aria-pressed")) !== "true") {
    await button.click();
    await page.waitForTimeout(900);
  }
};
const placeGroup = async (keepSelection) => {
  await openRail("components");
  if (!keepSelection)
    await page.evaluate(() =>
      window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
    );
  const item = page
    .locator("button, [role='button'], [role='option'], [role='gridcell']")
    .filter({ hasText: /^resizable panels$/i })
    .first();
  await item.waitFor({ state: "visible", timeout: 15000 });
  await item.click();
  await page.waitForTimeout(1500);
};
/** The Groups' records in document order: id · node · children (record ids + types). */
const groups = () =>
  page.evaluate(() => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    return [...r.canvasInputs.values()]
      .filter((x) => r.typeOf(x) === "ResizablePanelGroup")
      .map((g) => ({
        id: g.id,
        node: g.sourceId,
        parent: g.parentId,
        kids: g.children.map((id) => ({
          id,
          node: r.canvasInputs.get(id)?.sourceId,
          type: r.typeOf(r.canvasInputs.get(id)),
        })),
      }));
  });
const write = (recordId, props) =>
  page.evaluate(
    ({ recordId, props }) => {
      const { workspace: ws, commands: c } = window.__COMPOSITION_CATALOG__;
      ws.execute(
        c.setFields({
          targets: [ws.itemOfRecord(recordId).target],
          props: Object.fromEntries(
            Object.entries(props).map(([k, v]) => [
              k,
              v === null ? { kind: "remove" } : { kind: "set", value: v },
            ]),
          ),
        }),
      );
    },
    { recordId, props },
  );
const openPublish = async (ids) => {
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
  await pub.waitForFunction(
    (ids) =>
      ids.every((id) =>
        document.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`),
      ),
    ids,
    { timeout: 60000 },
  );
  // (the interaction chunk — the separator role appears when it has loaded)
  await pub.waitForSelector('[role="separator"]', { timeout: 30000 });
  await pub.waitForTimeout(500);
  return pub;
};
const sep = (pub, id) => pub.locator(`[data-catalog-id="${id}"]`);
const attrs = (pub, id) =>
  sep(pub, id).evaluate((el) =>
    Object.fromEntries(
      [
        "role",
        "aria-orientation",
        "aria-valuenow",
        "aria-valuemin",
        "aria-valuemax",
        "aria-controls",
        "aria-label",
        "aria-disabled",
        "tabindex",
        "data-resizing",
      ].map((n) => [n, el.getAttribute(n)]),
    ),
  );
const width = (pub, id, axis = "w") =>
  pub
    .locator(`[data-catalog-id="${id}"]`)
    .evaluate(
      (el, axis) =>
        el.getBoundingClientRect()[axis === "w" ? "width" : "height"],
      axis,
    );
const center = async (pub, id) => {
  const b = await pub.locator(`[data-catalog-id="${id}"]`).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

const label = (pub, id) =>
  pub.locator(`[data-catalog-id="${id}"]`).evaluate((el) => {
    const text = el.textContent ?? "";
    return Object.fromEntries(text.split(" ").map((part) => part.split("=")));
  });

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("adr318 g5 live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);
  await placeGroup(false);
  const [g] = await groups();
  const [p1, h, p2] = g.kids.map((k) => k.id);
  await write(p1, {
    collapsible: true,
    collapsedSize: "48px",
    minSize: "200px",
  });
  await write(g.id, { rememberSizes: true });
  await page.waitForTimeout(600);

  // Variables · rules · the Text that shows them.
  const [textId, buttonId] = await page.evaluate(
    async ({ panelNode }) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const c = window.__COMPOSITION_CATALOG__.commands;
      const loaded = (path) =>
        performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((name) => new URL(name).pathname === path)
          .at(-1) ?? path;
      const { catalogVariableCommands: v } = await import(
        loaded("/src/builder/catalogRuntime/stateVariables.ts")
      );
      const { catalogInteractionsCommand, catalogNewInteraction } =
        await import(loaded("/src/builder/catalogRuntime/interactions.ts"));
      const { catalogPaletteDefinitionId } = await import(
        loaded("/src/builder/catalogRuntime/paletteInsert.ts")
      );
      const graph = ws.runtime.graph;
      const pageId = graph.getEntry(graph.projectId).pageIds[0];
      const ids = () =>
        new Set(graph.getEntry(graph.projectId).stateVariableIds ?? []);
      const before = ids();
      ws.execute(v.add(pageId, "resized", ws.newId));
      ws.execute(v.add(pageId, "flipped", ws.newId));
      const added = [...ids()].filter((id) => !before.has(id));
      const byName = (name) =>
        added.map((id) => graph.getEntry(id)).find((e) => e.name === name);
      ws.execute(v.setType(byName("resized"), "number"));
      ws.execute(v.setType(byName("flipped"), "boolean"));
      ws.execute(
        v.nameSource(
          pageId,
          panelNode,
          { prop: "size", type: "number" },
          50,
          "leftSize",
          ws.newId,
        ),
      );
      ws.execute(
        v.nameSource(
          pageId,
          panelNode,
          { prop: "isCollapsed", type: "boolean" },
          false,
          "leftCollapsed",
          ws.newId,
        ),
      );
      const owner = { ownerId: panelNode };
      ws.execute(
        catalogInteractionsCommand(
          owner,
          [
            catalogNewInteraction(
              owner,
              "onSizeChange",
              [
                {
                  opcode: "setState",
                  variableId: byName("resized").id,
                  op: "set",
                  value: "!event.size",
                },
              ],
              ws.newId,
            ),
            catalogNewInteraction(
              owner,
              "onCollapsedChange",
              [
                {
                  opcode: "setState",
                  variableId: byName("flipped").id,
                  op: "set",
                  value: "!event.isCollapsed",
                },
              ],
              ws.newId,
            ),
          ],
          "Rules",
        ),
      );
      const body = graph.getEntry(pageId).children[0];
      const nodeId = `project:node:g5-label`;
      ws.execute(
        c.insertNodes({
          parent: { kind: "node", id: body },
          entries: [
            {
              kind: "node",
              id: nodeId,
              definitionId: catalogPaletteDefinitionId(graph.library, "Text"),
              children: [],
              props: {},
              visual: {},
              sizing: {},
              descendantOverrides: [],
            },
          ],
          rootIds: [nodeId],
          newId: ws.newId,
        }),
      );
      const record = ws.root.recordsOfSource(nodeId)[0];
      ws.execute(
        c.setFields({
          targets: [ws.itemOfRecord(record).target],
          props: {
            children: {
              kind: "set",
              value:
                "R={{ resized }} F={{ flipped }} S={{ leftSize }} C={{ leftCollapsed }}",
            },
          },
        }),
      );
      // A Button whose press runs the Do 「Toggle collapse」 on the left Panel.
      const buttonId = `project:node:g5-button`;
      ws.execute(
        c.insertNodes({
          parent: { kind: "node", id: body },
          entries: [
            {
              kind: "node",
              id: buttonId,
              definitionId: catalogPaletteDefinitionId(graph.library, "Button"),
              children: [],
              props: {},
              visual: {},
              sizing: {},
              descendantOverrides: [],
            },
          ],
          rootIds: [buttonId],
          newId: ws.newId,
        }),
      );
      const press = { ownerId: buttonId };
      ws.execute(
        catalogInteractionsCommand(
          press,
          [
            catalogNewInteraction(
              press,
              "onPress",
              [
                {
                  opcode: "capability",
                  target: { nodeId: panelNode },
                  capabilityId: "toggleCollapse",
                },
              ],
              ws.newId,
            ),
          ],
          "Rules",
        ),
      );
      return [record, ws.root.recordsOfSource(buttonId)[0]];
    },
    { panelNode: g.kids[0].node },
  );
  await page.waitForTimeout(800);
  const ids = [g.id, p1, h, p2, textId, buttonId];

  let pub = await openPublish(ids);
  await pub.evaluate(() => localStorage.clear());
  await pub.reload();
  await pub.waitForSelector('[role="separator"]', { timeout: 30000 });
  await pub.waitForTimeout(500);
  const space = (await width(pub, g.id)) - 1;
  const l1 = await label(pub, textId);
  record(
    "1 첫 화면 — 이름 붙인 상태 = 시작 값 50 · false · 규칙 변수는 기본값 (0 · false)",
    l1.S === "50" && l1.C === "false" && l1.R === "0" && l1.F === "false",
    l1,
  );
  // 2. A key's step.
  await sep(pub, h).focus();
  await pub.keyboard.press("ArrowRight");
  await pub.waitForTimeout(300);
  const l2 = await label(pub, textId);
  record(
    "2 → 키 — When 「Resize」 !event.size = 55 · leftSize 55",
    l2.R === "55" && l2.S === "55",
    l2,
  );
  // 3. A drag: told at its end.
  {
    const at = await center(pub, h);
    await pub.mouse.move(at.x, at.y);
    await pub.mouse.down();
    for (let s = 1; s <= 10; s++) await pub.mouse.move(at.x - 15 * s, at.y);
    await pub.waitForTimeout(200);
    const during = await label(pub, textId);
    await pub.mouse.up();
    await pub.waitForTimeout(400);
    const after = await label(pub, textId);
    const drawn = ((await width(pub, p1)) / space) * 100;
    record(
      "3 끌기 — 끄는 중에는 When 없음 (resized 55 그대로) · 놓을 때 resized = leftSize = 그려진 몫",
      during.R === "55" &&
        after.R === after.S &&
        Math.abs(Number(after.R) - drawn) <= 0.5,
      { during, after, drawn },
    );
  }
  // 4. Enter: collapse · expand.
  await sep(pub, h).focus();
  await pub.keyboard.press("Enter");
  await pub.waitForTimeout(300);
  const c1 = await label(pub, textId);
  await pub.keyboard.press("Enter");
  await pub.waitForTimeout(300);
  const c2 = await label(pub, textId);
  record(
    "4 Enter — When 「Collapse change」 true · leftCollapsed true · 다시 Enter → false",
    c1.F === "true" && c1.C === "true" && c2.F === "false" && c2.C === "false",
    { c1, c2 },
  );
  // 4b. The Do 「Toggle collapse」 (a Button's press): the Panel collapses · expands, its state follows,
  //     and no 「Collapse change」 runs (a Do's write is not the user's change).
  await pub.locator(`[data-catalog-id="${buttonId}"]`).click();
  await pub.waitForTimeout(300);
  const doCollapsed = {
    w: await width(pub, p1),
    ...(await label(pub, textId)),
  };
  await pub.locator(`[data-catalog-id="${buttonId}"]`).click();
  await pub.waitForTimeout(300);
  const doExpanded = { w: await width(pub, p1), ...(await label(pub, textId)) };
  record(
    "4b Do 「Toggle collapse」 (Button) — 48 px · leftCollapsed true · 다시 → 펼침 · 「Collapse change」 는 실행되지 않음",
    Math.abs(doCollapsed.w - 48) <= 1 &&
      doCollapsed.C === "true" &&
      doCollapsed.F === "false" &&
      doExpanded.C === "false" &&
      Math.abs(doExpanded.w - (Number(doExpanded.S) / 100) * space) <= 1,
    { doCollapsed, doExpanded },
  );
  // 5. Remember sizes: reload keeps the size, then the collapse.
  const kept = await width(pub, p1);
  await pub.reload();
  await pub.waitForSelector('[role="separator"]', { timeout: 30000 });
  await pub.waitForTimeout(600);
  const reloaded = await width(pub, p1);
  const reloadedLabel = await label(pub, textId);
  await sep(pub, h).focus();
  await pub.keyboard.press("Enter");
  await pub.waitForTimeout(300);
  await pub.reload();
  await pub.waitForSelector('[role="separator"]', { timeout: 30000 });
  await pub.waitForTimeout(600);
  const collapsedAfter = await width(pub, p1);
  const stored = await pub.evaluate(() =>
    Object.keys(localStorage).filter((k) =>
      k.startsWith("composition:resizable:v1:"),
    ),
  );
  await pub.close();
  // The switch off: the authored size again.
  await write(g.id, { rememberSizes: null });
  await page.waitForTimeout(600);
  pub = await openPublish(ids);
  const off = await width(pub, p1);
  await pub.screenshot({ path: `${OUT}/5-switch-off.png` });
  await pub.close();
  record(
    "5 Remember sizes — 다시 열면 그 크기 (상태도) · 접은 뒤 다시 열면 48 px · 스위치를 끄면 반으로",
    Math.abs(reloaded - kept) <= 1 &&
      reloadedLabel.S ===
        String(Math.round((kept / space) * 100 * 100) / 100) &&
      Math.abs(collapsedAfter - 48) <= 1 &&
      stored.length === 1 &&
      Math.abs(off - space / 2) <= 1,
    { kept, reloaded, reloadedLabel, collapsedAfter, stored, off },
  );
  record("6 page error 0", errors.length === 0, errors.slice(0, 5));
} catch (error) {
  record("실행 오류", false, String(error).split("\n").slice(0, 3));
} finally {
  await browser.close();
  const failed = results.filter((r) => !r.pass);
  process.stdout.write(
    `\n${failed.length ? `FAIL ${failed.length}` : "ALL PASS"} (${results.length})\n`,
  );
}
