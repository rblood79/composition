#!/usr/bin/env node
// disabled TreeItem 의 라벨 · chevron 색 live (2026-11-23) — S2 TreeView `isDisabled: gray-400`.
//   Tree 를 놓고 첫 top-level 항목을 disabled:
//   ① Canvas · Publish 의 라벨 · chevron 가장 진한 픽셀이 채널 ±16 안에서 같다 (disabled · 평소 항목 둘)
//   ② disabled 항목의 라벨 · chevron 이 평소 항목과 다르다 (두 consumer 모두)
//   ③ page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-tree-disabled-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/s2-tree-disabled-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(`${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1500)}\n`);
};

const state = JSON.parse(readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"));
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({ storageState: state, viewport: { width: 1600, height: 1000 } });
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

// the darkest pixel in a clip (the full color — antialiased edges are lighter); null for no box (a
// leaf row's chevron is hidden)
const darkest = (where, clip) =>
  !clip || clip.width <= 0 || clip.height <= 0
    ? Promise.resolve(null)
    : where.screenshot({ clip }).then((png) =>
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
  await page.keyboard.type("tree disabled live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const r = ws.root;
    const ctx = {
      graph: ws.runtime.graph,
      records: ws.root.domInputs,
      selection: () => [],
      itemOfRecord: (i) => ws.itemOfRecord(i),
      pageContent: () => ({ kind: "node", id: "project:node:home-body" }),
      newId: ws.newId,
    };
    ws.execute(h.palette.catalogPaletteInsertPlan(ctx, "Tree").command);
    const first = [...r.canvasInputs.values()].find(
      (x) => r.typeOf(x) === "TreeItem" && r.typeOf(r.canvasInputs.get(x.parentId)) === "Tree",
    );
    ws.execute(
      h.commands.setFields({
        targets: [{ kind: "node", id: first.sourceId }],
        props: { isDisabled: { kind: "set", value: true } },
      }),
    );
    ws.selectRecords([]);
  });
  await page.waitForTimeout(800);

  // the first two top-level items: label Text · chevron Icon record ids (the scene's)
  const rows = await page.evaluate(() => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    const items = [...r.canvasInputs.values()].filter(
      (x) => r.typeOf(x) === "TreeItem" && r.typeOf(r.canvasInputs.get(x.parentId)) === "Tree",
    );
    const find = (id, type) => {
      const n = r.canvasInputs.get(id);
      if (!n) return undefined;
      if (r.typeOf(n) === type) return n.id;
      for (const k of n.children ?? []) {
        if (r.typeOf(r.canvasInputs.get(k)) === "TreeItem") continue;
        const hit = find(k, type);
        if (hit) return hit;
      }
    };
    return items.slice(0, 2).map((item) => ({
      disabled: item.props.isDisabled === true,
      label: find(item.id, "Text"),
      chevron: find(item.id, "Icon"),
    }));
  });

  const canvasClip = (id) =>
    page.evaluate((id) => {
      const h = window.__COMPOSITION_CATALOG__;
      const b = h.canvas.boundsOf(id);
      const cam = h.canvas.camera();
      const el =
        document.querySelector('[data-canvas-container="true"]') ??
        document.querySelector('[data-catalog-canvas="true"]');
      const r = el.getBoundingClientRect();
      return { x: r.left + b.x * cam.zoom + cam.x, y: r.top + b.y * cam.zoom + cam.y, width: b.width * cam.zoom, height: b.height * cam.zoom };
    }, id);
  await page.evaluate((id) => {
    const h = window.__COMPOSITION_CATALOG__;
    const b = h.canvas.boundsOf(id);
    h.canvas.setCamera({ scale: 1, x: 80 - b.x, y: 200 - b.y });
  }, rows[0].label);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/1-canvas.png` });
  const canvas = [];
  for (const row of rows)
    canvas.push({
      disabled: row.disabled,
      label: await darkest(page, await canvasClip(row.label)),
      chevron: await darkest(page, await canvasClip(row.chevron)),
    });

  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => ["Preview", "미리보기"].includes(b.getAttribute("aria-label")))
      ?.click(),
  );
  const pub = await popup;
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector(".react-aria-TreeItem", { timeout: 60000 });
  await pub.waitForTimeout(1200);
  await pub.screenshot({ path: `${OUT}/2-publish.png` });
  const clips = await pub.evaluate(() =>
    [...document.querySelectorAll(".react-aria-Tree > .react-aria-TreeItem")].slice(0, 2).map((row) => {
      const box = (el) => {
        const b = el.getBoundingClientRect();
        return { x: b.x, y: b.y, width: b.width, height: b.height };
      };
      return {
        disabled: row.hasAttribute("data-disabled"),
        label: box(row.querySelector(".react-aria-Text")),
        // (a leaf row's chevron button is `visibility: hidden` — no glyph drawn)
        chevron:
          getComputedStyle(row.querySelector("[slot=chevron]")).visibility === "hidden"
            ? null
            : box(row.querySelector("[slot=chevron] svg")),
      };
    }),
  );
  const publish = [];
  for (const c of clips)
    publish.push({ disabled: c.disabled, label: await darkest(pub, c.label), chevron: await darkest(pub, c.chevron) });

  const near = (a, b) => (a === null && b === null) || (!!a && !!b && a.every((v, i) => Math.abs(v - b[i]) <= 16));
  record(
    "① Canvas · Publish — label · chevron colors match (±16 a channel), disabled and resting rows",
    canvas.length === 2 &&
      publish.length === 2 &&
      canvas.every((c, i) => c.disabled === publish[i].disabled && near(c.label, publish[i].label) && near(c.chevron, publish[i].chevron)),
    { canvas, publish },
  );
  record(
    "② the disabled row's label · chevron differ from the resting row's text color (both consumers)",
    [canvas, publish].every(
      (side) => side[0].chevron && !near(side[0].label, side[1].label) && !near(side[0].chevron, side[1].label),
    ),
    { canvas, publish },
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
