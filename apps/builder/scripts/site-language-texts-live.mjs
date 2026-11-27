#!/usr/bin/env node
// Site language — the texts the page draws follow Site settings 「Language」 (not the Builder's):
//   1. Korean site: a FilterBar's buttons (Canvas records) — 필터 추가 · 조건 편집 · 지우기
//   2. Korean site: a Stepper placed owns Korean steps · panels; the Design 「+」 adds 「단계 4」
//   3. Korean site: the FilterBar's 「Saved filters」 「+」 (the Property panel) names 「저장된 필터 1」
//   4. Publish: the bar's buttons and the current step's panel in Korean
//   3c. The Design panel's start-condition group row menu is named by the group (not 「g1 동작」)
//   3b. Korean chips: 「다음으로 시작」 (no particle) · numbers and a date field's day in the locale's
//       writing · a one-condition group 「묶음 (조건 1)」 — the Canvas records and the Publish names
//   5. English site again: the FilterBar's buttons back to English (template texts follow the site);
//      the placed steps stay (the page's own nodes); 「Group (1 condition)」 · 「Nov 5, 2026」
//   5b. No site language: the browser's (ko-KR here) — the bar's buttons in Korean, like RAC's words
//   6. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/site-language-texts-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/site-language-texts-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 800)}\n`,
  );
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const state = JSON.parse(
  readFileSync(
    process.env.AUTH_STATE ?? `${REPO}/apps/builder/scripts/.auth-session.json`,
    "utf8",
  ),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  locale: "ko-KR",
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

/** The drawn texts: the FilterBar's buttons, the Stepper's step labels · panel contents. */
const drawn = () =>
  page.evaluate(() => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    const all = [...r.canvasInputs.values()];
    const under = (top) => {
      const out = [];
      const walk = (record) => {
        out.push(record);
        for (const id of record.children ?? []) {
          const child = r.canvasInputs.get(id);
          if (child) walk(child);
        }
      };
      walk(top);
      return out;
    };
    const bar = all.find((x) => r.typeOf(x) === "FilterBar");
    const stepper = all.find((x) => r.typeOf(x) === "Stepper");
    const text = (id) => String(r.canvasInputs.get(id)?.props.children);
    const list = stepper
      ? r.canvasInputs.get(
          stepper.children.find(
            (id) => r.typeOf(r.canvasInputs.get(id)) === "StepList",
          ),
        )
      : undefined;
    return {
      buttons: bar
        ? under(bar)
            .filter((x) => r.typeOf(x) === "ActionButton" && !x.hidden)
            .map(
              (x) =>
                under(x)
                  .filter((y) => r.typeOf(y) === "Text" && !y.hidden)
                  .map((y) => String(y.props.children))[0] ??
                x.props["aria-label"],
            )
        : null,
      steps: list
        ? list.children.map((id) => text(r.canvasInputs.get(id).children[0]))
        : null,
      panels: stepper
        ? stepper.children
            .map((id) => r.canvasInputs.get(id))
            .filter((x) => r.typeOf(x) === "StepPanel")
            .map((x) => text(x.children[0]))
        : null,
      listRecord: list?.id,
      chips: all
        .filter((x) => r.typeOf(x) === "FilterChip" && !x.hidden)
        .map((x) => String(x.props.label)),
      barNode: bar?.sourceId,
      barRecord: bar?.id,
    };
  });

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("site language texts live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const h = window.__COMPOSITION_CATALOG__;
    h.workspace.execute(h.commands.setSiteSettings({ patch: { lang: "ko" } }));
  });

  // Place a FilterBar and a Stepper from the palette.
  const button = railButton(page, "components");
  if ((await button.getAttribute("aria-pressed")) !== "true") {
    await button.click();
    await page.waitForTimeout(900);
  }
  for (const name of [/^filter ?bar$/i, /^stepper$/i]) {
    await page.evaluate(() =>
      window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
    );
    const item = page
      .locator("button, [role='button'], [role='option'], [role='gridcell']")
      .filter({ hasText: name })
      .first();
    await item.waitFor({ state: "visible", timeout: 15000 });
    await item.click();
    await page.waitForTimeout(1500);
  }
  const ko = await drawn();
  record(
    "1 Korean site: FilterBar buttons · the sample chip on the Canvas",
    ["필터 추가", "조건 편집", "지우기", "조건 메뉴", "조건 삭제", "포함", "값"].every(
      (word) => ko.buttons?.includes(word),
    ),
    ko.buttons,
  );
  record(
    "2a Korean site: the placed Stepper's steps · panels",
    same(ko.steps, ["단계 1", "단계 2", "단계 3"]) &&
      same(ko.panels, ["단계 1 내용", "단계 2 내용", "단계 3 내용"]),
    { steps: ko.steps, panels: ko.panels },
  );
  await page.evaluate(async (listRecord) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const loaded = (path) =>
      performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((entry) => new URL(entry).pathname === path)
        .at(-1) ?? path;
    const { catalogItemInsertChoices } = await import(
      loaded("/src/builder/catalogRuntime/itemInsert.ts")
    );
    const choices = catalogItemInsertChoices(
      { graph: ws.runtime.graph, readModel: ws.readModel, newId: ws.newId },
      ws.positionOfRecord(listRecord),
    );
    ws.execute(choices[0].build());
  }, ko.listRecord);
  const added = await drawn();
  record(
    "2b Design 「+」 adds 「단계 4」",
    added.steps?.[3] === "단계 4",
    added.steps,
  );
  await page.screenshot({ path: `${OUT}/1-builder-ko.png` });

  // 3. The Property panel's 「Saved filters」 「+」 on the FilterBar (a bar filtering a bound Table).
  await page.evaluate(
    async ({ barNode, repo }) => {
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
                { id: "f-score", key: "score", type: "number", label: "Score" },
                { id: "f-joined", key: "joined", type: "date", label: "Joined" },
              ],
              mockData: [
                { id: "p1", name: "Kim", score: 2000, joined: "2026-11-06" },
              ],
              useMockData: true,
            },
          ],
        }),
      );
      const graph = ws.runtime.graph;
      const project = graph.getEntry(graph.projectId);
      const body = graph.getEntry(project.pageIds[0]).children[0];
      const table = ws.newId("node");
      ws.execute(
        c.insertNodes({
          parent: { kind: "node", id: body },
          entries: [
            {
              kind: "node",
              id: table,
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
          rootIds: [table],
          newId: ws.newId,
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
      const { setFilterBarTargets } = await import(
        `/@fs${repo}/packages/shared/src/catalog/commands/filterBar.ts`
      );
      ws.execute(setFilterBarTargets(barNode, [table]));
      const at = (id, field, op, value) => ({
        id,
        fields: [[`data:field:${field}`]],
        op,
        value,
      });
      ws.execute(
        c.setFields({
          targets: [{ kind: "node", id: barNode }],
          props: {
            defaultQuery: {
              kind: "set",
              value: {
                id: "filter-scope",
                op: "and",
                items: [
                  at("c1", "f-name", "startsWith", "Kim"),
                  at("c2", "f-score", "gte", 1234.5),
                  at("c3", "f-joined", "after", "2026-11-05"),
                  {
                    id: "g1",
                    op: "or",
                    items: [at("c4", "f-name", "contains", "a")],
                  },
                ],
              },
            },
          },
        }),
      );
    },
    { barNode: ko.barNode, repo: REPO },
  );
  await page.waitForTimeout(800);
  // 3b. The chips' words.
  const chipsKo = (await drawn()).chips;
  const barEntry = await page.evaluate((id) => {
    const graph = window.__COMPOSITION_CATALOG__.workspace.runtime.graph;
    const entry = graph.getEntry(id);
    return { filtersOf: entry.filtersOf, query: entry.props.defaultQuery?.kind };
  }, ko.barNode);
  record(
    "3b Korean chips on the Canvas",
    same(chipsKo, [
      "Name 다음으로 시작 Kim",
      "Score 이상 1,234.5",
      "Joined 이후 2026. 11. 5.",
      "묶음 (조건 1)",
    ]),
    { chipsKo, barEntry },
  );

  await page.evaluate((id) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    ws.selectItems([ws.itemOfRecord(id)]);
  }, ko.barRecord);
  await page.waitForTimeout(800);
  const properties = railButton(page, "properties");
  if ((await properties.getAttribute("aria-pressed")) !== "true") {
    await properties.click();
    await page.waitForTimeout(900);
  }
  // 3c. The start conditions' group row menu is named by the group (Builder language — en-US here).
  const groupMenu = await page.evaluate(() =>
    [...document.querySelectorAll("[data-filter-tree] button[aria-label]")]
      .map((b) => b.getAttribute("aria-label"))
      .filter((name) => /묶음|Group|g1/.test(name ?? "")),
  );
  record(
    "3c Panel: the group row menu is named 「Group (1 condition) actions」, not its id",
    same(groupMenu, ["Group (1 condition) actions"]),
    { groupMenu },
  );
  const presetField = page.locator(".filter-presets-field").first();
  await presetField.waitFor({ state: "visible", timeout: 15000 });
  await presetField.locator("button").last().click();
  await page.waitForTimeout(800);
  const presetName = await page.evaluate((id) => {
    const graph = window.__COMPOSITION_CATALOG__.workspace.runtime.graph;
    const value = graph.getEntry(id).props.presets;
    return value?.kind === "set" ? value.value?.[0]?.name : null;
  }, ko.barNode);
  record(
    "3 「Saved filters」 + names the preset in the site's language",
    presetName === "저장된 필터 1",
    { presetName },
  );
  await page.screenshot({ path: `${OUT}/2-builder-preset.png` });

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
  await pub.waitForSelector(".react-aria-StepList", { timeout: 60000 });
  await pub.waitForTimeout(1000);
  const published = await pub.evaluate(() => ({
    buttons: [...document.querySelectorAll("button")].map((b) =>
      (b.textContent ?? "").trim(),
    ),
    chips: [...document.querySelectorAll('[role="toolbar"] [role="group"]')].map(
      (g) => g.getAttribute("aria-label"),
    ),
    text: document.body.innerText,
  }));
  record(
    "4 Publish: bar buttons · step labels · current panel in Korean",
    ["필터 추가", "지우기"].every((t) => published.buttons.includes(t)) &&
      published.text.includes("단계 1") &&
      published.text.includes("단계 1 내용") &&
      same(published.chips, chipsKo),
    {
      buttons: published.buttons.filter(Boolean).slice(0, 12),
      chips: published.chips,
    },
  );
  await pub.screenshot({ path: `${OUT}/3-publish-ko.png` });
  await pub.close();

  // 5. English site again.
  await page.evaluate(() => {
    const h = window.__COMPOSITION_CATALOG__;
    h.workspace.execute(h.commands.setSiteSettings({ patch: { lang: "en" } }));
  });
  await page.waitForTimeout(800);
  const en = await drawn();
  record(
    "5 English site: bar buttons back to English · placed steps stay",
    ["Add filter", "Edit conditions", "Clear"].every((word) =>
      en.buttons?.includes(word),
    ) &&
      same(en.steps, ["단계 1", "단계 2", "단계 3", "단계 4"]),
    { buttons: en.buttons, steps: en.steps },
  );
  record(
    "5c English chips",
    same(en.chips, [
      "Name Starts with Kim",
      "Score At least 1,234.5",
      "Joined After Nov 5, 2026",
      "Group (1 condition)",
    ]),
    en.chips,
  );
  // 5b. No site language: the environment's (this browser: ko-KR).
  await page.evaluate(() => {
    const h = window.__COMPOSITION_CATALOG__;
    h.workspace.execute(
      h.commands.setSiteSettings({ patch: { lang: undefined } }),
    );
  });
  await page.waitForTimeout(800);
  const unset = await drawn();
  const lang = await page.evaluate(() => navigator.language);
  record(
    "5b No site language → the browser's (ko-KR): bar buttons · chips in Korean",
    lang === "ko-KR" &&
      ["필터 추가", "조건 편집", "지우기"].every((word) =>
        unset.buttons?.includes(word),
      ) &&
      same(unset.chips, chipsKo),
    { lang, buttons: unset.buttons, chips: unset.chips },
  );
  record("6 page error 0", errors.length === 0, { errors });
} catch (error) {
  record("run", false, { error: String(error?.stack ?? error) });
} finally {
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  const passed = results.filter((r) => r.pass).length;
  process.stdout.write(`\n${passed}/${results.length} PASS → ${OUT}/results.json\n`);
  await browser.close();
}
