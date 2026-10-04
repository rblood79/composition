// ADR-248 후속: 합성 규모 fixture, 공개 명령과 실제 액션 바. 카운트/시간을 분리한다.
// BUILDER_URL / OUT / COUNTS(600,5000) / RUNS(3). 기본 시간은 precise coverage 없이 측정.
import { chromium } from "playwright";
import { countsByClass, judge, renderVerdict } from "./perf-ratchet-gate.mjs";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const base = process.env.BUILDER_URL ?? "http://localhost:5173";
const out = process.env.OUT ?? "/private/tmp/adr248-followup";
const counts = (process.env.COUNTS ?? "600,5000").split(",").map(Number);
const runs = Number(process.env.RUNS ?? 3);
if (
  !counts.length ||
  counts.some((count) => ![600, 5000].includes(count)) ||
  !Number.isInteger(runs) ||
  runs < 1
) {
  throw new Error(
    "COUNTS must contain 600/5000 and RUNS must be a positive integer",
  );
}
mkdirSync(out, { recursive: true });
const auth = JSON.parse(
  readFileSync(new URL("./.auth-session.json", import.meta.url), "utf8"),
);
auth.origins = auth.origins.map((o) => ({ ...o, origin: base }));
const browser = await chromium.launch({ channel: "chrome", headless: false });
const context = await browser.newContext({
  storageState: auth,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
// Optional captured Vite responses from the baseline HEAD: isolate A/B without editing the tree.
const baseline = process.env.BASELINE_MODULES;
if (baseline) {
  for (const name of [
    "shortcuts.ts",
    "canvasBinding.ts",
    "canvasMenu.ts",
    "CatalogActionBar.tsx",
  ]) {
    await context.route(`**/${name}*`, (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: readFileSync(`${baseline}/${name}`, "utf8"),
      }),
    );
  }
}
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send("Performance.enable");
await page.exposeFunction("adr248TaskDuration", async () => {
  const metrics = await cdp.send("Performance.getMetrics");
  return metrics.metrics.find((m) => m.name === "TaskDuration").value * 1000;
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const result = {
  baseline: baseline ?? null,
  head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  base,
  errors,
  samples: [],
};
try {
  await page.goto(`${base}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.keyboard.type("ADR248 structural action bar perf");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.canvas);
  await page.bringToFront();
  for (const count of counts) {
    const data = await page.evaluate(
      async ({ count, runs }) => {
        const { workspace: w, commands: c } = window.__COMPOSITION_CATALOG__;
        const module = (path) =>
          import(
            performance
              .getEntriesByType("resource")
              .map((e) => e.name)
              .find((n) => n.includes(path)) ?? path
          );
        const actions = await module(
          "/src/builder/catalogRuntime/actionBar.ts",
        );
        const shortcuts = await module(
          "/src/builder/catalogRuntime/shortcuts.ts",
        );
        const sceneModule = await module(
          "/src/builder/catalogRuntime/canvasScene.ts",
        );
        const frames = () =>
          new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          );
        const saved = async () => {
          for (let n = 0; n < 400; n++) {
            if (w.runtime.durableRevision === w.runtime.graph.revision) return;
            await new Promise((r) => setTimeout(r, 25));
          }
          throw Error("save timeout");
        };
        const body = w.runtime.graph.getEntry(w.session.getSnapshot().pageId)
          .children[0];
        const old = w.runtime.graph.getEntry(body).children;
        if (old.length)
          w.execute(
            c.removeTargets({
              targets: old.map((id) => ({ kind: "node", id })),
            }),
          );
        const entries = Array.from({ length: count }, (_, i) => ({
          kind: "node",
          id: `project:node:followup-${i}`,
          definitionId: "lib:definition:type-frame",
          children: [],
          props: {},
          visual: { backgroundColor: { kind: "set", value: "#dbe7ff" } },
          sizing: {
            width: { kind: "set", value: 80 },
            height: { kind: "set", value: 30 },
          },
          placement: {
            kind: "absolute",
            x: 20 + (i % 10) * 90,
            y: 20 + Math.floor(i / 10) * 40,
          },
          descendantOverrides: [],
        }));
        w.execute(
          c.insertNodes({
            parent: { kind: "node", id: body },
            entries,
            rootIds: entries.map((e) => e.id),
            newId: w.newId,
          }),
        );
        w.session.clearSelection();
        await frames();
        await saved();
        const engine = Object.values(w.root.layout).find(
          (v) => v && typeof v.getLayoutsBatch === "function",
        );
        let active = false,
          counts = {};
        const original = engine.getLayoutsBatch.bind(engine);
        engine.getLayoutsBatch = (ids) => {
          if (active) {
            counts.geometryCalls = (counts.geometryCalls ?? 0) + 1;
            counts.geometryIds = (counts.geometryIds ?? 0) + ids.length;
          }
          return original(ids);
        };
        const sync = sceneModule.CatalogCanvasScene.prototype.sync;
        sceneModule.CatalogCanvasScene.prototype.sync = function () {
          const r = sync.call(this);
          if (active && r.kind === "patched")
            counts.canvasGeometry =
              (counts.canvasGeometry ?? 0) + r.update.geometryQueries;
          return r;
        };
        const sample = async (name, fn) => {
          const before = await window.adr248TaskDuration();
          counts = {};
          active = true;
          const start = performance.now();
          fn();
          const commandMs = performance.now() - start;
          if (name === "actionBar") active = false;
          await frames();
          const settledMs = performance.now() - start;
          await saved();
          active = false;
          const taskMs = (await window.adr248TaskDuration()) - before;
          return { name, commandMs, settledMs, taskMs, counts: { ...counts } };
        };
        const values = [];
        try {
          for (let i = 0; i < runs; i++) {
            values.push(
              await sample("reorder", () =>
                w.execute(
                  c.moveNodes({
                    ids: [entries[0].id],
                    parent: { kind: "node", id: body },
                    index: count - 1,
                    newId: w.newId,
                  }),
                ),
              ),
            );
            w.undo();
            await frames();
            await saved();
            values.push(
              await sample("delete", () =>
                w.execute(
                  c.removeTargets({
                    targets: [{ kind: "node", id: entries[0].id }],
                  }),
                ),
              ),
            );
            w.undo();
            await frames();
            await saved();
          }
          // 큰 선택의 geometry 준비를 같은 host/model 생성 경로에서 측정한다.
          w.selectRecords(entries.map((e) => w.root.recordsOfSource(e.id)[0]));
          await frames();
          for (let i = 0; i < runs; i++)
            values.push(
              await sample("actionBar", () => {
                const s = w.session.getSnapshot();
                const state = actions.catalogActionBarState(
                  w.runtime.graph,
                  w.root.domInputs,
                  s.selection,
                  s.pageId,
                );
                const m = actions.catalogActionBarModel(
                  shortcuts.catalogMenuHost(w),
                  state,
                );
                if (
                  m?.context !== "multi" ||
                  !m.items.some((x) => x.id === "align")
                )
                  throw Error("action bar missing");
              }),
            );
          const order = w.runtime.graph.getEntry(body).children;
          if (order.length !== count || order[0] !== entries[0].id)
            throw Error("undo order mismatch");
          w.session.clearSelection();
          await frames();
          await saved();
          return {
            count,
            visibility: document.visibilityState,
            values,
            undoRestored: true,
          };
        } finally {
          engine.getLayoutsBatch = original;
          sceneModule.CatalogCanvasScene.prototype.sync = sync;
        }
      },
      { count, runs },
    );
    result.samples.push(data);
    writeFileSync(`${out}/results.json`, JSON.stringify(result, null, 2));
    const classes = Object.fromEntries(
      ["reorder", "delete", "actionBar"].map((name) => {
        const values = data.values.filter((v) => v.name === name);
        return [
          name,
          {
            counts: Object.fromEntries(
              ["geometryCalls", "geometryIds"].map((key) => [
                key,
                Math.max(...values.map((v) => v.counts[key] ?? 0)),
              ]),
            ),
          },
        ];
      }),
    );
    writeFileSync(
      `${out}/frame-${count}.json`,
      JSON.stringify({ results: classes }, null, 2),
    );
    console.log(JSON.stringify(data));
  }
  if (process.env.LIVE === "1") {
    await page.evaluate(() => {
      const w = window.__COMPOSITION_CATALOG__.workspace;
      const body = w.runtime.graph.getEntry(w.session.getSnapshot().pageId)
        .children[0];
      w.selectRecords(
        w.runtime.graph
          .getEntry(body)
          .children.map((id) => w.root.recordsOfSource(id)[0]),
      );
    });
    await page
      .getByRole("toolbar", { name: /Selection actions|선택 액션/ })
      .getByRole("button", { name: /^Align$|^정렬$/ })
      .click();
    await page
      .getByRole("menuitem", { name: /^Align left$|^왼쪽 정렬$/i })
      .click();
    result.live = await page.evaluate(async () => {
      const w = window.__COMPOSITION_CATALOG__.workspace;
      const body = w.runtime.graph.getEntry(w.session.getSnapshot().pageId)
        .children[0];
      const ids = w.runtime.graph.getEntry(body).children;
      if (!ids.every((id) => w.runtime.graph.getEntry(id).placement.x === 20))
        throw Error("UI align failed");
      w.undo();
      if (
        !ids.every(
          (id, i) =>
            w.runtime.graph.getEntry(id).placement.x === 20 + (i % 10) * 90,
        )
      )
        throw Error("UI align undo failed");
      w.session.clearSelection();
      for (let i = 0; i < 400; i++) {
        if (w.runtime.durableRevision === w.runtime.graph.revision)
          return { aligned: ids.length, undo: true };
        await new Promise((r) => setTimeout(r, 25));
      }
      throw Error("UI save timeout");
    });
    await page.reload();
    await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.canvas);
    result.live.reload = await page.evaluate(() => {
      const w = window.__COMPOSITION_CATALOG__.workspace;
      const body = w.runtime.graph.getEntry(w.session.getSnapshot().pageId)
        .children[0];
      const ids = w.runtime.graph.getEntry(body).children;
      if (
        !ids.every(
          (id, i) =>
            id === `project:node:followup-${i}` &&
            w.runtime.graph.getEntry(id).placement.x === 20 + (i % 10) * 90,
        )
      )
        throw Error("reload mismatch");
      return ids.length;
    });
    writeFileSync(`${out}/results.json`, JSON.stringify(result, null, 2));
  }
  await page.screenshot({ path: `${out}/builder.png` });
} finally {
  await browser.close();
}
if (errors.length) process.exitCode = 1;

const ratchet = JSON.parse(
  readFileSync(
    new URL("../perf/adr248-followup-ratchet.json", import.meta.url),
    "utf8",
  ),
);
const measured = Object.fromEntries(
  result.samples.map(({ count }) => [
    count,
    countsByClass(
      JSON.parse(readFileSync(`${out}/frame-${count}.json`, "utf8")),
    ),
  ]),
);
const verdict = judge(ratchet, measured);
console.log(
  renderVerdict(verdict, { header: "ADR-248 followup geometry ratchet" }),
);
if (verdict.overA.length) process.exitCode = 1;
