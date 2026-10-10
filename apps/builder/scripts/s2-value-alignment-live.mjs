// S2 값 정렬 live (사용자 2026-10-10 「toggle 강조 축 전환」 Phase 4): real Builder (headed
// Chrome, Compare Mode). Meter 의 notice · negative (옛 warning · critical), InlineAlert 기본
// informative (옛 info), CardView variant 가 안의 Card 들에 닿는다 (재해석 큐), Tooltip 집합
// (neutral · informative · negative).
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-value-alignment-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const paletteModule = `/@fs${REPO}/apps/builder/src/builder/catalogRuntime/paletteInsert.ts`;
const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
const page = await context.newPage();
const errors = [];
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1000)}\n`,
  );
};
page.on("pageerror", (e) =>
  errors.push(`pageerror: ${e.message.slice(0, 300)}`),
);
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
async function addToBody(type) {
  return page.evaluate(
    async ({ commands, paletteModule, type }) => {
      const c = await import(commands);
      const palette = await import(paletteModule);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      ws.selectRecords([]);
      const graph = ws.runtime.graph;
      const { pageId } = ws.session.getSnapshot();
      const body = graph.getEntry(pageId).children[0];
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
          label: "Add element",
        }),
      );
      await new Promise((r) => setTimeout(r, 1200));
      return id;
    },
    { commands, paletteModule, type },
  );
}
const setVariant = (source, variant) =>
  page.evaluate(
    async ({ commands, source, variant }) => {
      const c = await import(commands);
      window.__COMPOSITION_CATALOG__.workspace.execute(
        c.setFields({
          targets: [{ kind: "node", id: source }],
          props: { variant: { kind: "set", value: variant } },
        }),
      );
      await new Promise((r) => setTimeout(r, 1200));
    },
    { commands, source, variant },
  );
const stateOf = (source) =>
  page.evaluate((source) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const node = [...root.canvasInputs.values()].find(
      (r) => r.sourceId === source,
    );
    const doc = document.querySelector("#previewFrame").contentDocument;
    const el = doc.querySelector(`[data-catalog-id="${node.id}"]`);
    return {
      variant: node.props.variant,
      domVariant: el?.getAttribute("data-variant") ?? null,
    };
  }, source);

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("S2 value alignment");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
const compare = page
  .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
  .first();
if (await compare.isVisible().catch(() => false)) await compare.click();
await page.waitForTimeout(1500);

// ── Meter: notice · negative (옛 warning · critical) ──
const meter = await addToBody("Meter");
const meterFillColor = () =>
  page.evaluate(() => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const fill = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "MeterFill",
    );
    const painted = window.__composition_SKIA_DEBUG__?.getSkiaNode?.(fill?.id);
    const doc = document.querySelector("#previewFrame").contentDocument;
    const meterNode = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "Meter",
    );
    const el = doc.querySelector(`[data-catalog-id="${meterNode.id}"]`);
    return {
      fill: painted?.box?.fillColor ? [...painted.box.fillColor] : null,
      domVariant: el?.getAttribute("data-variant") ?? null,
      fillVar: el
        ? getComputedStyle(el).getPropertyValue("--fill-color").trim()
        : null,
    };
  });
const meterDefault = await meterFillColor();
await setVariant(meter, "notice");
const meterNotice = await meterFillColor();
await page.screenshot({ path: `${OUT}/meter-notice.png` });
record(
  "Meter variant notice (옛 warning): Preview data-variant · --fill-color 와 Canvas MeterFill 칠이 같이 바뀐다",
  meterDefault.domVariant === "informative" &&
    meterNotice.domVariant === "notice" &&
    meterNotice.fillVar !== meterDefault.fillVar &&
    JSON.stringify(meterNotice.fill) !== JSON.stringify(meterDefault.fill),
  { default: meterDefault, notice: meterNotice },
);
await setVariant(meter, "negative");
const meterNegative = await meterFillColor();
record(
  "Meter variant negative (옛 critical): 두 consumer 가 따라온다",
  meterNegative.domVariant === "negative" &&
    JSON.stringify(meterNegative.fill) !== JSON.stringify(meterNotice.fill),
  { negative: meterNegative },
);

// ── InlineAlert: 기본 informative (옛 info) ──
const alert = await addToBody("InlineAlert");
const alertState = await stateOf(alert);
await page.screenshot({ path: `${OUT}/inline-alert-informative.png` });
record(
  "InlineAlert 기본 변형 informative — record 와 Preview data-variant",
  alertState.variant === "informative" &&
    alertState.domVariant === "informative",
  alertState,
);

// ── CardView: variant 가 안의 Card 들에 닿는다 (재해석 큐) ──
const cardView = await addToBody("CardView");
const cardsState = () =>
  page.evaluate((source) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const view = [...root.canvasInputs.values()].find(
      (r) => r.sourceId === source,
    );
    const walk = (ids) =>
      ids.flatMap((id) => {
        const child = root.canvasInputs.get(id);
        if (!child) return [];
        return root.typeOf(child) === "Card" ? [child] : walk(child.children);
      });
    const cards = walk(view.children);
    const doc = document.querySelector("#previewFrame").contentDocument;
    const dom = cards.map(
      (card) =>
        doc
          .querySelector(`[data-catalog-id="${card.id}"]`)
          ?.getAttribute("data-variant") ?? null,
    );
    return { variants: cards.map((c) => c.props.variant), dom };
  }, cardView);
const cardsBefore = await cardsState();
await setVariant(cardView, "quiet");
const cardsAfter = await cardsState();
await page.screenshot({ path: `${OUT}/cardview-quiet.png` });
record(
  "CardView variant quiet: 안의 Card 들이 재해석되어 record 와 Preview data-variant 가 quiet",
  cardsBefore.variants.length > 0 &&
    cardsBefore.variants.every((v) => v === "primary") &&
    cardsAfter.variants.every((v) => v === "quiet") &&
    cardsAfter.dom.every((v) => v === "quiet"),
  { before: cardsBefore, after: cardsAfter },
);

// (Tooltip 집합 변경 — neutral · informative · negative, positive 삭제 — 은 닫힌 overlay 노드의
// 계약이라 live 표면이 없다: rule 키는 s2ValueAlignment, 패널 선택지는 adr255OverlayTrigger 가 고정.)

record("no page or console errors", errors.length === 0, { errors });
process.stdout.write(
  `\nRESULT ${results.filter((r) => r.pass).length}/${results.length} PASS\n`,
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
