#!/usr/bin/env node
// disabled field 의 입력 글자 색 live (2026-11-23) — Canvas 가 휴지 색 (#292929) 으로 그리던 것.
//   TextField · TokenField · DateField 를 값과 함께 놓고, 각각 휴지 · disabled 둘:
//   ① Canvas · Publish 의 입력 상자 안 가장 진한 픽셀 (= 글자 색) 이 채널 ±16 안에서 같다
//   ② disabled 의 글자 색이 휴지 글자 색과 다르다 (두 consumer 모두)
//   ③ page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-disabled-field-text-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/s2-disabled-field-text-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";

const FIELDS = [
  { type: "TextField", input: "Input", dom: ".react-aria-Input", value: "Hello world" },
  { type: "TokenField", input: "TokenInput", dom: ".react-aria-TokenInput", value: "Hello world" },
  { type: "DateField", input: "DateInput", dom: ".react-aria-DateInput", value: "2026-11-23" },
];
const CASES = FIELDS.flatMap((f) => [
  { ...f, key: `${f.type}-rest`, props: { value: f.value } },
  { ...f, key: `${f.type}-disabled`, props: { value: f.value, isDisabled: true } },
]);

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
  viewport: { width: 1920, height: 1000 },
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

// the darkest pixel in a clip (the text's full color — antialiased edges are lighter)
const darkest = (where, clip) =>
  where.screenshot({ clip }).then((png) =>
    where.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let best = [255, 255, 255];
      let lum = 765;
      for (let i = 0; i < d.length; i += 4) {
        const l = d[i] + d[i + 1] + d[i + 2];
        if (l < lum) {
          lum = l;
          best = [d[i], d[i + 1], d[i + 2]];
        }
      }
      return best;
    }, png.toString("base64")),
  );

try {
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /new project/i }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type("disabled field text live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
    timeout: 30000,
  });
  await page.waitForTimeout(1500);

  const placed = await page.evaluate((cases) => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const r = ws.root;
    const ctx = {
      graph: ws.runtime.graph,
      records: ws.root.domInputs,
      selection: () => ws.session.getSnapshot().selection,
      itemOfRecord: (i) => ws.itemOfRecord(i),
      pageContent: () => ({ kind: "node", id: "project:node:home-body" }),
      newId: ws.newId,
    };
    const set = (value) => ({ kind: "set", value });
    return cases.map((c) => {
      ws.selectRecords([]);
      const before = new Set(r.canvasInputs.keys());
      ws.execute(h.palette.catalogPaletteInsertPlan(ctx, c.type).command);
      const field = [...r.canvasInputs.values()].find(
        (x) => r.typeOf(x) === c.type && !before.has(x.id),
      );
      ws.execute(
        h.commands.setFields({
          targets: [{ kind: "node", id: field.sourceId }],
          props: Object.fromEntries(Object.entries(c.props).map(([k, v]) => [k, set(v)])),
        }),
      );
      return { key: c.key, source: field.sourceId };
    });
  }, CASES);
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.selectRecords([]));
  await page.waitForTimeout(800);

  // the input record of each field (by source — record ids follow the scene)
  const inputOf = (c, source) =>
    page.evaluate(
      ({ source, type, input }) => {
        const r = window.__COMPOSITION_CATALOG__.workspace.root;
        const field = [...r.canvasInputs.values()].find(
          (x) => x.sourceId === source && r.typeOf(x) === type,
        );
        const find = (id) => {
          const n = r.canvasInputs.get(id);
          if (!n) return undefined;
          if (r.typeOf(n) === input) return n.id;
          for (const k of n.children ?? []) {
            const hit = find(k);
            if (hit) return hit;
          }
        };
        return { fieldId: field.id, inputId: find(field.id) };
      },
      { source, type: c.type, input: c.input },
    );

  const canvasColors = {};
  const ids = {};
  for (const [i, c] of CASES.entries()) {
    const { fieldId, inputId } = await inputOf(c, placed[i].source);
    ids[c.key] = { fieldId, inputId };
    await page.evaluate((id) => {
      const h = window.__COMPOSITION_CATALOG__;
      const b = h.canvas.boundsOf(id);
      h.canvas.setCamera({ scale: 1, x: 40 - b.x, y: 160 - b.y });
    }, inputId);
    await page.waitForTimeout(600);
    const clip = await page.evaluate((id) => {
      const h = window.__COMPOSITION_CATALOG__;
      const b = h.canvas.boundsOf(id);
      const cam = h.canvas.camera();
      const el =
        document.querySelector('[data-canvas-container="true"]') ??
        document.querySelector('[data-catalog-canvas="true"]');
      const r = el.getBoundingClientRect();
      return {
        x: r.left + b.x * cam.zoom + cam.x + 2,
        y: r.top + b.y * cam.zoom + cam.y + 2,
        width: b.width * cam.zoom - 4,
        height: b.height * cam.zoom - 4,
      };
    }, inputId);
    await page.screenshot({ path: `${OUT}/canvas-${c.key}.png`, clip });
    canvasColors[c.key] = await darkest(page, clip);
  }

  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => ["Preview", "미리보기"].includes(b.getAttribute("aria-label")))
      ?.click(),
  );
  const pub = await popup;
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  await pub.bringToFront();
  await pub.waitForURL((url) => String(url) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector(".react-aria-DateInput", { timeout: 60000 });
  await pub.waitForTimeout(1200);

  const pubColors = {};
  for (const c of CASES) {
    const clip = await pub.evaluate(
      ({ fieldId, dom }) => {
        const el = document
          .querySelector(`[data-catalog-id="${CSS.escape(fieldId)}"]`)
          ?.querySelector(dom);
        if (!el) return null;
        el.scrollIntoView({ block: "center" });
        const b = el.getBoundingClientRect();
        return { x: b.x + 2, y: b.y + 2, width: b.width - 4, height: b.height - 4 };
      },
      { fieldId: ids[c.key].fieldId, dom: c.dom },
    );
    if (!clip) {
      pubColors[c.key] = null;
      continue;
    }
    await pub.screenshot({ path: `${OUT}/publish-${c.key}.png`, clip });
    pubColors[c.key] = await darkest(pub, clip);
  }

  const near = (a, b) => !!a && !!b && a.every((v, i) => Math.abs(v - b[i]) <= 16);
  record(
    "① Canvas · Publish — the input text's color matches (±16 a channel)",
    CASES.every((c) => near(canvasColors[c.key], pubColors[c.key])),
    { canvasColors, pubColors },
  );
  record(
    "② disabled text differs from resting text in both consumers",
    FIELDS.every(
      (f) =>
        !near(canvasColors[`${f.type}-rest`], canvasColors[`${f.type}-disabled`]) &&
        !near(pubColors[`${f.type}-rest`], pubColors[`${f.type}-disabled`]),
    ),
    { canvasColors, pubColors },
  );
} catch (e) {
  record("run", false, { error: String(e?.stack ?? e) });
} finally {
  record("③ page error 0", errors.length === 0, { errors });
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
  const failed = results.filter((r) => !r.pass).length;
  process.stdout.write(`\n${results.length - failed}/${results.length} PASS\n`);
  process.exit(failed ? 1 : 0);
}
