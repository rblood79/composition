#!/usr/bin/env node
// ADR-320 G4 live — the condition builder in a real Publish tab (Phase 4), Chrome or WebKit. Rows
// and tree shapes are written here (Users: Ann A 1 · Ben A 2 · Cal B 1 · Dee B 2 · Eve C 1 · Fox C 2):
//   0. a bound Table → 「Add filter bar」 → the start 「Type is one of A, B」 (Ann Ben Cal Dee)
//   1. pointer: 「Edit conditions」 → the builder (a RAC Tree, one row)
//   2. pointer: 「Add group」 → 「Status」 → its comparison menu opens on its row → 「Equals」 → its
//      value editor → 1 → Enter: `c1 or(status=1)` → Ann Cal · the chips 「Type …」 · 「Group (1 …)」
//   3. pointer: the group's menu → 「Add condition」 › 「Name」 → 「Equals」 → 「Dee」 · Apply:
//      `c1 or(status=1 name=Dee)` → Ann Cal Dee
//   4. pointer: the group's 「Or」 → 「And」 → no row; back to 「Or」 → Ann Cal Dee
//   5. keyboard drag: the first row's drag button · Enter → arrows to 「on」 the group → Enter:
//      `or(status=1 name=Dee c1)` → Ann Ben Cal Dee Eve (levels 1 2 2 2)
//   6. pointer drag: that row (level 2) onto the top of the group row (before it): `c1 or(…)` →
//      Ann Cal Dee (levels 1 1 2 2)
//   7. keyboard: the name row's menu → 「Group」 → a level-2 group; its menu offers 「Add group」;
//      again → a level-3 group, whose menu offers no 「Add group」 (Decision 3)
//   8. page errors 0
//
//   BUILDER_URL=http://localhost:5173 [BROWSER=webkit] node apps/builder/scripts/adr320-g4-live.mjs <out-dir> [--headless]
import { mkdirSync, readFileSync } from "node:fs";
import { chromium, webkit } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr320-g4-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const HEADLESS = process.argv.includes("--headless");

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1200)}\n`,
  );
};

const state = JSON.parse(
  readFileSync(
    process.env.AUTH_STATE ?? `${REPO}/apps/builder/scripts/.auth-session.json`,
    "utf8",
  ),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const WEBKIT = process.env.BROWSER === "webkit";
const browser = WEBKIT
  ? await webkit.launch({ headless: HEADLESS })
  : await chromium.launch({ headless: HEADLESS, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1920, height: 1100 },
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

/** The bar's Canvas records: type · texts · box relative to the bar. */
const barRecords = () =>
  page.evaluate(() => {
    const { workspace: ws, canvas } = window.__COMPOSITION_CATALOG__;
    const r = ws.root;
    const bar = [...r.canvasInputs.values()].find(
      (x) => r.typeOf(x) === "FilterBar",
    );
    if (!bar) return null;
    const g = canvas.boundsOf(bar.id);
    const rows = [];
    const visit = (id) => {
      const rec = r.canvasInputs.get(id);
      if (!rec || rec.hidden) return;
      const b = canvas.boundsOf(id);
      rows.push({
        id,
        node: rec.sourceId,
        type: r.typeOf(rec),
        text:
          typeof rec.props?.children === "string"
            ? rec.props.children
            : undefined,
        label: rec.props?.label,
        x: b && b.x - g.x,
        y: b && b.y - g.y,
        w: b?.width,
        h: b?.height,
      });
      for (const child of rec.children) visit(child);
    };
    visit(bar.id);
    const node = ws.runtime.graph.getEntry(bar.sourceId);
    return { rows, filtersOf: node?.filtersOf ?? null, barNode: bar.sourceId };
  });

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("adr320 g4 live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    {
      timeout: 30000,
    },
  );
  await page.waitForTimeout(1500);

  // 0. A Users collection and a bound Table (the product commands — the data UI is not this gate's).
  const tableNode = await page.evaluate(async () => {
    const {
      workspace: ws,
      commands: c,
      palette,
      binding,
    } = window.__COMPOSITION_CATALOG__;
    ws.execute(
      c.setDataEntries({
        puts: [
          {
            kind: "collection",
            id: "data:collection:users",
            name: "Users",
            schema: [
              { id: "f-id", key: "id", type: "string" },
              { id: "f-name", key: "name", type: "string", label: "Name" },
              { id: "f-type", key: "type", type: "string", label: "Type" },
              {
                id: "f-status",
                key: "status",
                type: "number",
                label: "Status",
              },
            ],
            mockData: [
              { id: "p1", name: "Ann", type: "A", status: 1 },
              { id: "p2", name: "Ben", type: "A", status: 2 },
              { id: "p3", name: "Cal", type: "B", status: 1 },
              { id: "p4", name: "Dee", type: "B", status: 2 },
              { id: "p5", name: "Eve", type: "C", status: 1 },
              { id: "p6", name: "Fox", type: "C", status: 2 },
            ],
            useMockData: true,
          },
        ],
      }),
    );
    const graph = ws.runtime.graph;
    const project = graph.getEntry(graph.projectId);
    const pageEntry = graph.getEntry(project.pageIds[0]);
    const body = pageEntry.children[0];
    const id = ws.newId("node");
    ws.execute(
      c.insertNodes({
        parent: { kind: "node", id: body },
        entries: [
          {
            kind: "node",
            id,
            definitionId: palette.catalogPaletteDefinitionId(
              graph.library,
              "Table",
            ),
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
        ],
        rootIds: [id],
        newId: ws.newId,
      }),
    );
    ws.execute(
      binding.catalogBindingCommand(
        [{ kind: "node", id }],
        binding.catalogBindingRef({
          source: "dataTable",
          collectionId: "users",
          name: "Users",
        }),
      ),
    );
    const [recordId] = ws.recordsOfNode(id);
    ws.selectRecords([recordId]);
    return id;
  });
  await page.waitForTimeout(800);

  // 0. 「Add filter bar」, then its start condition.
  await openRail("properties");
  const add = page.getByRole("button", { name: /^add filter bar$/i }).first();
  await add.waitFor({ state: "visible", timeout: 15000 });
  await add.click();
  await page.waitForTimeout(1200);
  const bar = await barRecords();
  await page.evaluate((node) => {
    const { workspace: ws, commands: c } = window.__COMPOSITION_CATALOG__;
    ws.execute(
      c.setFields({
        targets: [{ kind: "node", id: node }],
        props: {
          defaultQuery: {
            kind: "set",
            value: {
              id: "filter-scope",
              op: "and",
              items: [
                {
                  id: "c1",
                  fields: [["data:field:f-type"]],
                  op: "oneOf",
                  value: ["A", "B"],
                },
              ],
            },
          },
        },
      }),
    );
    ws.selectItems([]);
  }, bar.barNode);
  await page.waitForTimeout(800);
  const rail = railButton(page, "properties");
  if ((await rail.getAttribute("aria-pressed")) === "true") await rail.click();

  // Publish.
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
  await pub.waitForSelector(".react-aria-FilterBar", { timeout: 60000 });
  await pub.waitForTimeout(1500);
  const read = () =>
    pub.evaluate(() => {
      const barEl =
        document.querySelector(".react-aria-FilterBar") ?? document.body;
      return {
        bar: !!document.querySelector(".react-aria-FilterBar"),
        body: document.body.innerText.slice(0, 300),
        chips: [...barEl.querySelectorAll('[role="group"]')].map((chip) =>
          chip.getAttribute("aria-label"),
        ),
        rows: [...document.querySelectorAll('[role="grid"] [role="row"]')]
          .map((row) => /Ann|Ben|Cal|Dee|Eve|Fox/.exec(row.textContent)?.[0])
          .filter(Boolean),
        live: [...document.querySelectorAll("[aria-live]")]
          .map((el) => el.textContent)
          .join(" | "),
        menu: [
          ...document.querySelectorAll(
            '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]',
          ),
        ].map((item) => item.textContent.trim()),
        dialog: !!document.querySelector('[role="dialog"]'),
        tree: [
          ...document.querySelectorAll('[role="treegrid"] [role="row"]'),
        ].map(
          (row) =>
            `${row.getAttribute("aria-level")} ${row.getAttribute("aria-label")}`,
        ),
        focused: document.activeElement?.textContent?.trim() ?? "",
      };
    });
  const settle = (ms = 500) => pub.waitForTimeout(ms);
  const chipButton = (index, name) =>
    pub
      .locator('.react-aria-FilterBar [role="group"]')
      .nth(index)
      .getByRole("button", { name });

  const rowOf = (label) =>
    pub.locator(`[role="treegrid"] [role="row"][aria-label="${label}"]`);
  const rowAt = (level, index = 0) =>
    pub.locator(`[role="treegrid"] [role="row"][aria-level="${level}"]`).nth(index);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  let now = await read();
  record(
    "0 Publish — the start is one chip and filters the Table (4 rows)",
    now.chips.length === 1 && same(now.rows, ["Ann", "Ben", "Cal", "Dee"]),
    now,
  );

  // 1. Edit conditions.
  await pub.getByRole("button", { name: "Edit conditions" }).click();
  await pub.waitForSelector('[role="treegrid"]', { timeout: 15000 });
  await settle();
  now = await read();
  record("1 「Edit conditions」 opens the builder", same(now.tree, ["1 Type Is one of A, B"]), now.tree);
  await pub.screenshot({ path: `${OUT}/1-builder.png` });

  // 2. Add group → Status → Equals → 1.
  await pub.getByRole("button", { name: "Add group" }).click();
  await settle();
  await pub.keyboard.type("Sta");
  await settle(300);
  await pub.getByRole("menuitem", { name: "Status" }).click();
  await settle(800);
  const opened = (await read()).menu;
  await pub.getByRole("menuitemradio", { name: "Equals" }).click();
  await pub.waitForSelector('[role="dialog"] input', { timeout: 10000 });
  await settle();
  await pub.keyboard.type("1");
  await pub.keyboard.press("Enter");
  await settle(900);
  now = await read();
  record(
    "2 「Add group」 · Status · Equals · 1 → `c1 or(status=1)` → Ann Cal",
    opened.includes("Equals") &&
      same(now.tree, ["1 Type Is one of A, B", "1 Conditions Or", "2 Status Equals 1"]) &&
      same(now.rows, ["Ann", "Cal"]) &&
      now.chips.length === 2,
    { opened, now },
  );
  await pub.screenshot({ path: `${OUT}/2-group.png` });

  // 3. The group's menu → Add condition › Name → Equals → Dee.
  await rowOf("Conditions Or").getByRole("button", { name: "Group actions" }).click();
  await settle();
  await pub.getByRole("menuitem", { name: "Add condition" }).click();
  await settle();
  await pub.keyboard.type("Na");
  await settle(300);
  const submenu = (await read()).menu;
  await pub.screenshot({ path: `${OUT}/3a-submenu.png` });
  await pub.getByRole("menuitem", { name: "Name" }).last().click();
  await settle(800);
  const nameOps = await read();
  await pub.screenshot({ path: `${OUT}/3b-ops.png` });
  await pub.getByRole("menuitemradio", { name: "Equals" }).click();
  await settle(800);
  await pub.screenshot({ path: `${OUT}/3c-editor.png` });
  // (Its candidates leave this condition out — Decision 9: under the 「or」 the rows of
  //  `status = 1`, Ann · Cal. Dee is typed.)
  await pub.waitForSelector('[role="dialog"] input', { timeout: 10000 });
  await settle();
  const candidates = (
    await pub.locator('[role="dialog"] [role="option"]').allTextContents()
  ).map((text) => text.replace(/\d+$/, ""));
  await pub.keyboard.type("Dee");
  await pub.keyboard.press("Enter");
  await settle(900);
  now = await read();
  record(
    "3 group menu · Add condition › Name · Equals (candidates Ann · Cal) · Dee → `c1 or(status=1 name=Dee)` → Ann Cal Dee",
    same(candidates, ["Ann", "Cal"]) &&
    same(now.tree, [
      "1 Type Is one of A, B",
      "1 Conditions Or",
      "2 Status Equals 1",
      "2 Name Equals Dee",
    ]) && same(now.rows, ["Ann", "Cal", "Dee"]),
    { candidates, now },
  );

  // 4. Or → And → Or.
  await rowOf("Conditions Or").getByRole("button", { name: "Or", exact: true }).click();
  await settle(700);
  const anded = await read();
  await rowOf("Conditions And").getByRole("button", { name: "And", exact: true }).click();
  await settle(700);
  now = await read();
  record(
    "4 the group's 「Or」 → 「And」 (no row) → 「Or」 (Ann Cal Dee)",
    anded.tree.includes("1 Conditions And") &&
      anded.rows.length === 0 &&
      same(now.rows, ["Ann", "Cal", "Dee"]),
    { anded: anded.rows, now: now.rows },
  );

  // 5. Keyboard drag: the first row onto the group.
  await rowOf("Type Is one of A, B").getByRole("button", { name: /drag/i }).focus();
  await pub.keyboard.press("Enter");
  await settle(500);
  const heard = [];
  let onGroup = false;
  for (let step = 0; step < 10 && !onGroup; step += 1) {
    const live = (await read()).live;
    heard.push(live.slice(-80));
    if (/on Conditions Or/i.test(live.slice(-120))) onGroup = true;
    else {
      await pub.keyboard.press("ArrowDown");
      await settle(300);
    }
  }
  await pub.keyboard.press("Enter");
  await settle(900);
  now = await read();
  record(
    "5 keyboard drag — drag button · Enter · arrows to 「on」 the group · Enter → `or(status=1 name=Dee c1)`",
    onGroup &&
      same(now.tree.map((row) => row.split(" ")[0]), ["1", "2", "2", "2"]) &&
      now.tree[3] === "2 Type Is one of A, B" &&
      same(now.rows, ["Ann", "Ben", "Cal", "Dee", "Eve"]),
    { heard, now },
  );
  await pub.screenshot({ path: `${OUT}/5-keyboard-drag.png` });

  // 6. Pointer drag: that row before the group row.
  const handle = rowOf("Type Is one of A, B").getByRole("button", { name: /drag/i });
  const group = await rowOf("Conditions Or").boundingBox();
  const from = await handle.boundingBox();
  await pub.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await pub.mouse.down();
  await pub.mouse.move(from.x + from.width / 2, from.y - 20, { steps: 6 });
  await pub.mouse.move(group.x + group.width / 2, group.y + 3, { steps: 8 });
  await settle(300);
  await pub.mouse.move(group.x + group.width / 2, group.y + 2, { steps: 2 });
  await pub.mouse.up();
  await settle(900);
  now = await read();
  record(
    "6 pointer drag — the row onto the group row's top edge (before it) → `c1 or(…)` → Ann Cal Dee",
    same(now.tree, [
      "1 Type Is one of A, B",
      "1 Conditions Or",
      "2 Status Equals 1",
      "2 Name Equals Dee",
    ]) && same(now.rows, ["Ann", "Cal", "Dee"]),
    now,
  );
  await pub.screenshot({ path: `${OUT}/6-pointer-drag.png` });

  // 7. Keyboard: Group twice — the third level offers no 「Add group」.
  const menuOf = async (row, name) => {
    const target = row.getByRole("button", { name });
    // (RAC returns focus to a closed menu's trigger after it closes — wait until the focus we
    //  give stays.)
    for (let i = 0; i < 10; i += 1) {
      await target.focus();
      await settle(150);
      if (await target.evaluate((el) => el === document.activeElement)) break;
    }
    await pub.keyboard.press("Enter");
    await settle(400);
    return (await read()).menu;
  };
  const pickByKeys = async (label) => {
    const items = (await read()).menu;
    const at = items.indexOf(label);
    for (let i = 0; i < at; i += 1) await pub.keyboard.press("ArrowDown");
    await pub.keyboard.press("Enter");
    await settle(800);
  };
  let menu = await menuOf(rowOf("Name Equals Dee"), "Condition actions");
  await pickByKeys("Group");
  const level2 = (await read()).tree;
  const second = await menuOf(rowOf("Conditions And"), "Group actions");
  await pub.keyboard.press("Escape");
  await settle(300);
  menu = await menuOf(rowOf("Name Equals Dee"), "Condition actions");
  await pickByKeys("Group");
  const level3 = (await read()).tree;
  const third = await menuOf(rowAt(3), "Group actions");
  const deepest = await (async () => {
    await pub.keyboard.press("Escape");
    await settle(300);
    return menuOf(rowOf("Name Equals Dee"), "Condition actions");
  })();
  await pub.keyboard.press("Escape");
  now = await read();
  record(
    "7 keyboard — 「Group」 twice: a level-2 group (its menu has 「Add group」), a level-3 group (none); its condition offers no 「Group」",
    menu.includes("Group") &&
      level2.includes("2 Conditions And") &&
      second.includes("Add group") &&
      level3.includes("3 Conditions Or") &&
      !third.includes("Add group") &&
      third.includes("Add condition") &&
      !deepest.includes("Group") &&
      same(now.rows, ["Ann", "Cal", "Dee"]),
    { level2, second, level3, third, deepest, rows: now.rows },
  );
  await pub.screenshot({ path: `${OUT}/7-depth.png` });
  await pub.close();
} catch (error) {
  record("harness", false, String(error?.stack ?? error));
} finally {
  record("8 page errors 0", errors.length === 0, errors);
  const failed = results.filter((r) => !r.pass).length;
  process.stdout.write(
    failed ? `FAILED ${failed}\n` : `ALL PASS ${results.length}\n`,
  );
  await browser.close();
}
