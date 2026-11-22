#!/usr/bin/env node
// S2 체크리스트 §4.1 Chart live (2026-11-22) — S2 에 Chart 가 없어 글자 단계 · Tooltip 값만 따른다 (headed Chrome).
//   ① Canvas — Chart 를 놓고 툴팁을 켠다 (장면이 그려진다 · page error 0), 축 글자 영역 캡처
//   ② Publish — 축 글자 `<text>` 의 font-size = 11 (`{typography.text-2xs}` — S2 ui-xs)
//   ③ Publish — 막대에 hover 하면 툴팁: 모서리 8 · 여백 4 / 9 · 글자 12 · 행간 16 (S2 Tooltip)
//   ④ Publish — Chart 요소의 툴팁 변수 4 가 catalog 토큰에서 풀린다
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-chart-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/s2-chart-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1200)}\n`,
  );
};

const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1400, height: 800 },
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("S2 chart live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  const canvas = await page.evaluate(() => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const set = (value) => ({ kind: "set", value });
    const ctx = () => ({
      graph: ws.runtime.graph,
      records: ws.root.domInputs,
      selection: () => ws.session.getSnapshot().selection,
      itemOfRecord: (i) => ws.itemOfRecord(i),
      pageContent: () => ({ kind: "node", id: "project:node:home-body" }),
      newId: ws.newId,
    });
    ws.selectRecords([]);
    ws.execute(h.palette.catalogPaletteInsertPlan(ctx(), "Chart").command);
    const chart = [...ws.root.domInputs.values()].find(
      (r) => ws.root.typeOf(r) === "Chart",
    );
    ws.execute(
      h.commands.setFields({
        targets: [{ kind: "node", id: chart.sourceId }],
        props: { showTooltip: set(true) },
      }),
    );
    ws.selectRecords([]);
    const geo = ws.root.getGeometry([chart.id]).get(chart.id);
    const rule = ws.root.canvasInputs.get(chart.id)?.props?._chartRule;
    return {
      geometry: geo,
      metrics: rule?.metrics,
      tooltipRadius: rule?.tooltipRadius,
    };
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/1-canvas.png` });
  record(
    "① Canvas — the Chart draws with the token axis font (rule metrics carry the TokenRef)",
    canvas.geometry?.width > 0 && errors.length === 0,
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
  await pub.bringToFront();
  await pub.waitForURL((url) => String(url) !== "about:blank", {
    timeout: 30000,
  });
  await pub.waitForSelector(".react-aria-Chart svg text", { timeout: 60000 });
  await pub.waitForTimeout(1200);
  const axis = await pub.evaluate(() => {
    const texts = [...document.querySelectorAll(".react-aria-Chart svg text")];
    const sizes = texts.map(
      (t) => t.getAttribute("font-size") ?? getComputedStyle(t).fontSize,
    );
    const chart = document.querySelector(".react-aria-Chart");
    const cs = getComputedStyle(chart);
    const vars = Object.fromEntries(
      ["radius", "padding", "font-size", "line-height"].map((k) => [
        k,
        cs.getPropertyValue(`--chart-tooltip-${k}`).trim(),
      ]),
    );
    return {
      count: texts.length,
      sizes: [...new Set(sizes)],
      computed: [...new Set(texts.map((t) => getComputedStyle(t).fontSize))],
      vars,
    };
  });
  record(
    "② Publish — axis text is 11px",
    axis.count > 0 && axis.computed.length === 1 && axis.computed[0] === "11px",
    axis,
  );
  record(
    "④ Publish — the Chart's tooltip variables resolve from the catalog tokens",
    axis.vars.radius !== "" &&
      axis.vars.padding !== "" &&
      axis.vars["font-size"] !== "" &&
      axis.vars["line-height"] !== "",
    axis.vars,
  );
  await pub.screenshot({ path: `${OUT}/2-publish.png` });

  const plot = await pub.evaluate(() => {
    const r = document
      .querySelector(".react-aria-Chart svg")
      .getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  let tip = null;
  for (const fx of [0.15, 0.3, 0.5, 0.7]) {
    await pub.mouse.move(plot.x + plot.w * fx, plot.y + plot.h * 0.6, {
      steps: 4,
    });
    await pub.waitForTimeout(400);
    tip = await pub.evaluate(() => {
      const el = document.querySelector(".react-aria-Chart-tooltip");
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        text: el.textContent,
        radius: cs.borderTopLeftRadius,
        padding: [
          cs.paddingTop,
          cs.paddingRight,
          cs.paddingBottom,
          cs.paddingLeft,
        ],
        fontSize: cs.fontSize,
        lineHeight: cs.lineHeight,
      };
    });
    if (tip) break;
  }
  await pub.screenshot({ path: `${OUT}/3-tooltip.png` });
  record(
    "③ Publish — hover tooltip = S2 Tooltip (radius 8 · padding 4 / 9 · font 12 · line 16)",
    tip !== null &&
      tip.radius === "8px" &&
      tip.padding.join(" ") === "4px 9px 4px 9px" &&
      tip.fontSize === "12px" &&
      tip.lineHeight === "16px",
    tip,
  );
  record("no page errors", errors.length === 0, errors);
} finally {
  writeFileSync(
    `${OUT}/result.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
  process.stdout.write(
    `errors ${errors.length}: ${errors.slice(0, 5).join(" | ")}\n`,
  );
  await browser.close();
}
