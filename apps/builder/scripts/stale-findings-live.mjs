// 2026-10-04 코드 발견 수정 live: (2) Chart 예산 안내가 Canvas 크기로 풀리는지,
// (3a) 겹친 페이지의 Skia 페인트 순서 · 헤더 DOM 층 순서. Usage:
//   node scripts/stale-findings-live.mjs <outDir>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const state = JSON.parse(
  readFileSync(new URL("./.auth-session.json", import.meta.url), "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 200)}`);
});
await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await page.waitForTimeout(300);
await page.keyboard.type(`findings live ${Date.now() % 100000}`);
await page.keyboard.press("Enter");
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForTimeout(2500);
const shot = async (name) =>
  writeFileSync(`${OUT}/${name}.png`, await page.screenshot());
const results = {};

// (2) Chart: insert, select, open Design → Property; the budget line needs the Canvas size.
const chart = await page.evaluate(() => {
  const { workspace, commands, palette } = window.__COMPOSITION_CATALOG__;
  const graph = workspace.runtime.graph;
  workspace.execute(
    commands.insertNodes({
      parent: { kind: "node", id: "project:node:home-body" },
      entries: [
        {
          kind: "node",
          id: "project:node:chart",
          definitionId: palette.catalogPaletteDefinitionId(graph.library, "Chart"),
          children: [],
          props: {
            data: {
              kind: "set",
              value: Array.from({ length: 40 }, (_, i) => ({
                category: `C${i}`,
                value: i,
              })),
            },
          },
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
        {
          // A red box in the home page, inside the area the second page will cover.
          kind: "node",
          id: "project:node:marker",
          definitionId: "lib:definition:type-frame",
          children: [],
          props: {},
          visual: { backgroundColor: { kind: "set", value: "#ff0000" } },
          sizing: {
            width: { kind: "set", value: 300 },
            height: { kind: "set", value: 300 },
          },
          placement: { kind: "absolute", x: 1300, y: 500 },
          descendantOverrides: [],
        },
      ],
      rootIds: ["project:node:chart", "project:node:marker"],
      newId: workspace.newId,
    }),
  );
  const record = workspace.root.recordsOfSource("project:node:chart")[0];
  workspace.selectRecords([record]);
  const rect = workspace.root.getGeometry([record]).get(record);
  return { record, width: rect?.width, height: rect?.height };
});
await page.waitForTimeout(600);
await page.evaluate(async () => {
  const view = await import("/src/builder/panels/design/designPanelView.ts");
  view.openDesignPanel("property");
});
await page.waitForTimeout(800);
const propertyTab = page.getByRole("tab", { name: /^(Property|속성)$/ });
if (await propertyTab.count()) await propertyTab.first().click();
await page.waitForTimeout(800);
// The budget line sits in the Interaction section, below the fold of the floating panel.
await page.mouse.move(1270, 400);
for (let i = 0; i < 30; i++) {
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(150);
}
await page.waitForTimeout(500);
await shot("2-panel-scrolled");
const interaction = page.locator(
  '[data-panel="properties"] [data-section-id="interaction"]',
);
if (await interaction.count()) {
  await interaction.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
}
const panelText = await page
  .locator('[data-panel="properties"]')
  .innerText()
  .catch(() => "");
results.bodyHasInteraction = await page.evaluate(() => {
  const text = document.body.innerText;
  const i = text.indexOf("Interaction");
  return i >= 0 ? text.slice(i, i + 400) : null;
});
results.sections = await page.evaluate(() => ({
  panels: [...document.querySelectorAll("[data-panel]")].map((el) =>
    el.getAttribute("data-panel"),
  ),
  sections: [...document.querySelectorAll("[data-section-id]")].map((el) =>
    el.getAttribute("data-section-id"),
  ),
}));
const budgetLine = panelText
  .split("\n")
  .find((line) => /all shown|Showing \d+ \/|전부 표시|표시 \d+ \//.test(line));
results.chartBudget = { ...chart, budgetLine: budgetLine ?? null, pass: !!budgetLine };
await shot("2-chart-budget");

// (3a) Two pages, the second placed over the home page.
const pages = await page.evaluate(async () => {
  const { workspace, commands } = window.__COMPOSITION_CATALOG__;
  const tree = await import("/src/builder/catalogRuntime/pageTree.ts");
  const graph = workspace.runtime.graph;
  const project = graph.getEntry(graph.projectId);
  const list = project.pageIds.map((id) => graph.getEntry(id));
  const { command, pageId } = tree.catalogNewPageCommand(list, workspace.newId);
  workspace.execute(command);
  const home = workspace.root.pageFrameRects().get(project.pageIds[0]);
  workspace.execute(
    commands.updatePage({
      id: pageId,
      fields: {
        placement: {
          base: {
            position: "absolute",
            left: Math.round(home.x + home.width / 2),
            top: Math.round(home.y + 120),
          },
          breakpoints: {},
        },
      },
    }),
  );
  const rects = Object.fromEntries(workspace.root.pageFrameRects());
  return { home: project.pageIds[0], second: pageId, rects };
});
await page.waitForTimeout(800);
const homeTop = async () =>
  page.evaluate(({ home, second }) => {
    const { workspace } = window.__COMPOSITION_CATALOG__;
    return {
      active: workspace.session.getSnapshot().pageId,
      roots: workspace.root.pageRootRecords(),
      headerOrder: [...document.querySelectorAll("[data-page-header]")].map(
        (el) => el.getAttribute("data-page-id") ?? el.textContent?.trim(),
      ),
      home,
      second,
    };
  }, pages);
await page.evaluate(({ home }) => {
  window.__COMPOSITION_CATALOG__.workspace.session.setPage(home);
}, pages);
await page.waitForTimeout(800);
results.overlapHomeActive = await homeTop();
await shot("3a-home-active");
await page.evaluate(({ second }) => {
  window.__COMPOSITION_CATALOG__.workspace.session.setPage(second);
}, pages);
await page.waitForTimeout(800);
results.overlapSecondActive = await homeTop();
await shot("3a-second-active");
// Hover the home page's red box while page 2 (on top) covers it: its outline is cut there.
await page.evaluate(() => {
  const { workspace } = window.__COMPOSITION_CATALOG__;
  const record = workspace.root.recordsOfSource("project:node:marker")[0];
  workspace.session.setHover(workspace.itemOfRecord(record));
});
await page.waitForTimeout(600);
await shot("3a-hover-covered");
await page.evaluate(({ home }) => {
  const { workspace } = window.__COMPOSITION_CATALOG__;
  workspace.session.setPage(home);
  const record = workspace.root.recordsOfSource("project:node:marker")[0];
  workspace.session.setHover(workspace.itemOfRecord(record));
}, pages);
await page.waitForTimeout(600);
await shot("3a-hover-top");
results.pages = pages;
results.errors = errors;
writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
await browser.close();
