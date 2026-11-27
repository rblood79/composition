#!/usr/bin/env node
// ADR-320 G5 live — a scope's tree from outside the session in a real Publish tab (Phase 5), Chrome
// or WebKit. (The G4 header below kept for the shared helpers; the steps are G5's.)
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

const OUT = process.argv[2] ?? "/private/tmp/adr320-g5-live";
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

const pad = (n) => String(n).padStart(2, "0");
const dayOf = (offset) => {
  const at = new Date();
  at.setDate(at.getDate() + offset);
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
};
const TREE = (...items) => ({ id: "filter-scope", op: "and", items });
const TYPE_AB = {
  id: "c1",
  fields: [["data:field:f-type"]],
  op: "oneOf",
  value: ["A", "B"],
};

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("adr320 g5 live");
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

  // Users (joined: Ann · Eve today, Cal yesterday — the relative dates' rows), a bound Table and a
  // Button whose press runs the bar's 「조건 넣기 Status = 2」.
  const ids = await page.evaluate(
    async ({ today, yesterday, older, oldest }) => {
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
                {
                  id: "f-joined",
                  key: "joined",
                  type: "date",
                  label: "Joined",
                },
              ],
              mockData: [
                { id: "p1", name: "Ann", type: "A", status: 1, joined: today },
                { id: "p2", name: "Ben", type: "A", status: 2, joined: older },
                {
                  id: "p3",
                  name: "Cal",
                  type: "B",
                  status: 1,
                  joined: yesterday,
                },
                { id: "p4", name: "Dee", type: "B", status: 2, joined: oldest },
                { id: "p5", name: "Eve", type: "C", status: 1, joined: today },
                { id: "p6", name: "Fox", type: "C", status: 2, joined: oldest },
              ],
              useMockData: true,
            },
          ],
        }),
      );
      const graph = ws.runtime.graph;
      const project = graph.getEntry(graph.projectId);
      const body = graph.getEntry(project.pageIds[0]).children[0];
      const put = (type) => {
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
                  type,
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
        return id;
      };
      const table = put("Table");
      const button = put("Button");
      ws.execute(
        c.setFields({
          targets: [{ kind: "node", id: button }],
          props: { label: { kind: "set", value: "Add Status 2" } },
        }),
      );
      ws.execute(
        binding.catalogBindingCommand(
          [{ kind: "node", id: table }],
          binding.catalogBindingRef({
            source: "dataTable",
            collectionId: "users",
            name: "Users",
          }),
        ),
      );
      const [recordId] = ws.recordsOfNode(table);
      ws.selectRecords([recordId]);
      return { table, button };
    },
    {
      today: dayOf(0),
      yesterday: dayOf(-1),
      older: dayOf(-10),
      oldest: dayOf(-400),
    },
  );
  await page.waitForTimeout(800);

  await openRail("properties");
  const add = page.getByRole("button", { name: /^add filter bar$/i }).first();
  await add.waitFor({ state: "visible", timeout: 15000 });
  await add.click();
  await page.waitForTimeout(1200);
  const bar = await barRecords();
  await page.evaluate(
    ({ node, button, start, presets }) => {
      const { workspace: ws, commands: c } = window.__COMPOSITION_CATALOG__;
      ws.execute(
        c.setFields({
          targets: [{ kind: "node", id: node }],
          props: {
            defaultQuery: { kind: "set", value: start },
            presets: { kind: "set", value: presets },
            rememberFilters: { kind: "set", value: true },
          },
        }),
      );
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
                  target: { nodeId: node },
                  capabilityId: "addFilterCondition",
                  value: { field: "f-status", op: "equals", value: 2 },
                },
              ],
            },
          ],
        }),
      );
      ws.selectItems([]);
    },
    {
      node: bar.barNode,
      button: ids.button,
      start: TREE(TYPE_AB),
      presets: [
        {
          id: "p-today",
          name: "Joined today",
          query: TREE({
            id: "c-joined",
            fields: [["data:field:f-joined"]],
            op: "equals",
            value: "@today",
          }),
        },
        {
          id: "p-gone",
          name: "Gone or Status 1",
          query: TREE({
            id: "g1",
            op: "or",
            items: [
              {
                id: "c-region",
                fields: [["data:field:f-region"]],
                op: "equals",
                value: "서울",
              },
              {
                id: "c-status",
                fields: [["data:field:f-status"]],
                op: "equals",
                value: 1,
              },
            ],
          }),
        },
      ],
    },
  );
  await page.waitForTimeout(800);
  const rail = railButton(page, "properties");
  if ((await rail.getAttribute("aria-pressed")) === "true") await rail.click();

  const openPublish = async () => {
    const popup = context.waitForEvent("page", { timeout: 30000 });
    await page.evaluate(() =>
      [...document.querySelectorAll("button")]
        .find((b) =>
          ["Preview", "미리보기"].includes(b.getAttribute("aria-label")),
        )
        ?.click(),
    );
    const tab = await popup;
    tab.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
    await tab.waitForURL((u) => String(u) !== "about:blank", {
      timeout: 30000,
    });
    await tab.waitForSelector(".react-aria-FilterBar", { timeout: 60000 });
    await tab.waitForTimeout(1500);
    return tab;
  };
  const readOf = (tab) =>
    tab.evaluate(() => {
      const barEl =
        document.querySelector(".react-aria-FilterBar") ?? document.body;
      return {
        hash: location.hash,
        chips: [...barEl.querySelectorAll('[role="group"]')].map((chip) =>
          chip.getAttribute("aria-label"),
        ),
        rows: [...document.querySelectorAll('[role="grid"] [role="row"]')]
          .map((row) => /Ann|Ben|Cal|Dee|Eve|Fox/.exec(row.textContent)?.[0])
          .filter(Boolean),
        refused: barEl.querySelector(".filter-bar-refused")?.textContent ?? "",
        buttons: [...barEl.querySelectorAll("button")].map((b) =>
          b.textContent.trim(),
        ),
        stored: Object.keys(localStorage).filter((key) =>
          key.startsWith("composition:filter-scope:"),
        ),
      };
    });
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const pickPreset = async (tab, name) => {
    await tab.getByRole("button", { name: "Saved filters" }).click();
    await tab.waitForTimeout(400);
    await tab.getByRole("menuitem", { name }).click();
    await tab.waitForTimeout(900);
  };

  let pub = await openPublish();
  let now = await readOf(pub);
  record(
    "0 Publish — the start (Type is one of A, B) · 「Saved filters」 shown · no filter in the address",
    same(now.rows, ["Ann", "Ben", "Cal", "Dee"]) &&
      now.buttons.includes("Saved filters") &&
      !now.hash.includes("f."),
    now,
  );

  await pickPreset(pub, "Joined today");
  now = await readOf(pub);
  const linked = now.hash;
  record(
    "1 a named set with a relative date: 「Joined today」 → Ann Eve · its chip says Today · the address carries it · the browser keeps it",
    same(now.rows, ["Ann", "Eve"]) &&
      now.chips.some((chip) => /Joined Equals Today/.test(chip)) &&
      /[?&]f\./.test(linked) &&
      now.stored.length === 1,
    now,
  );
  await pub.screenshot({ path: `${OUT}/1-today.png` });

  // 2. The address alone: back to the start by hand, then the link's hash again (a link followed).
  await pub.getByRole("button", { name: "Clear" }).click();
  await pub.waitForTimeout(700);
  const cleared = await readOf(pub);
  await pub.evaluate((hash) => (location.hash = hash), linked);
  await pub.waitForTimeout(1200);
  now = await readOf(pub);
  record(
    "2 address — 「Clear」 takes the filter out of the address; the link's address puts 「Joined today」 back",
    same(cleared.rows, ["Ann", "Ben", "Cal", "Dee"]) &&
      !cleared.hash.includes("f.") &&
      same(now.rows, ["Ann", "Eve"]),
    { cleared, now },
  );
  await pub.close();

  // 3. Memory: a new Publish tab (its address has no filter) starts from what the browser kept.
  pub = await openPublish();
  now = await readOf(pub);
  record(
    "3 memory — a new Publish tab starts from the kept tree (Ann Eve), the address follows",
    same(now.rows, ["Ann", "Eve"]) && /[?&]f\./.test(now.hash),
    now,
  );

  // 4. The link alone: the browser's memory cleared, a new tab at the link (the Builder's Publish
  //    tab reads its project from a `blob:` the Builder holds — another browser cannot open it).
  const url = pub.url().split("#")[0] + linked;
  await pub.evaluate(() => {
    for (const key of Object.keys(localStorage))
      if (key.startsWith("composition:filter-scope:"))
        localStorage.removeItem(key);
  });
  const linkTab = await context.newPage();
  linkTab.on("pageerror", (e) => errors.push(`link: ${e.message}`));
  await linkTab.goto(url);
  await linkTab.waitForSelector(".react-aria-FilterBar", { timeout: 30000 });
  await linkTab.waitForTimeout(1500);
  const linkedNow = await readOf(linkTab);
  record(
    "4 the link alone (memory cleared) — the same rows (Ann Eve)",
    same(linkedNow.rows, ["Ann", "Eve"]) && linkedNow.hash === linked,
    linkedNow,
  );
  await linkTab.close();

  // 5. The round 3 반례 by a named set: a deleted field's group is left out whole.
  await pickPreset(pub, "Gone or Status 1");
  now = await readOf(pub);
  record(
    "5 a deleted field's group (named set) — left out whole: all six rows, 「1」 not applied",
    same(now.rows, ["Ann", "Ben", "Cal", "Dee", "Eve", "Fox"]) &&
      /1/.test(now.refused),
    now,
  );

  // 6. A rule's Do: 「Clear」, then the Button's 「조건 넣기 Status = 2」 → Ben Dee.
  await pub.getByRole("button", { name: "Clear" }).click();
  await pub.waitForTimeout(700);
  await pub.getByRole("button", { name: "Add Status 2" }).click();
  await pub.waitForTimeout(900);
  now = await readOf(pub);
  record(
    "6 a Button's Do 「조건 넣기 Status = 2」 → Ben Dee · its chip",
    same(now.rows, ["Ben", "Dee"]) && now.chips.length === 2,
    now,
  );
  await pub.screenshot({ path: `${OUT}/6-do.png` });
  await pub.close();
} catch (error) {
  record("harness", false, String(error?.stack ?? error));
} finally {
  record("7 page errors 0", errors.length === 0, errors);
  const failed = results.filter((r) => !r.pass).length;
  process.stdout.write(
    failed ? `FAILED ${failed}\n` : `ALL PASS ${results.length}\n`,
  );
  await browser.close();
}
