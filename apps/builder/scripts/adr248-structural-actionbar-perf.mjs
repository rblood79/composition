// ADR-248 후속: 합성 규모 fixture, 공개 명령과 실제 액션 바. 카운트/시간을 분리한다.
// BUILDER_URL / OUT / COUNTS(600,5000) / RUNS(3). 기본 시간은 precise coverage 없이 측정.
import { chromium } from "playwright";
import { countsByClass, judge, renderVerdict } from "./perf-ratchet-gate.mjs";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const base = process.env.BUILDER_URL ?? "http://localhost:5173";
const out = process.env.OUT ?? "/private/tmp/adr248-followup";
const counts = (process.env.COUNTS ?? "600,5000").split(",").map(Number);
const runs = Number(process.env.RUNS ?? 3);
const diagnostics = process.env.DIAGNOSTICS === "1";
const extended = process.env.EXTENDED === "1";
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
    "actionBar.ts",
  ]) {
    if (
      process.env.BASELINE_FILES &&
      !process.env.BASELINE_FILES.split(",").includes(name)
    )
      continue;
    if (name === "actionBar.ts" && !existsSync(`${baseline}/${name}`)) continue;
    await context.route(`**/${name}*`, (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: readFileSync(`${baseline}/${name}`, "utf8"),
      }),
    );
  }
}
const page = await context.newPage();
// Opt-in attribution, confined to this isolated browser. Timings are inclusive and must not
// be added to commandMs. Keep normal ratchet runs free of this timing instrumentation.
if (diagnostics) {
  await context.route("**/catalogRuntime/canvasMenu.ts*", async (route) => {
    const response = await route.fetch();
    const source = baseline
      ? readFileSync(`${baseline}/canvasMenu.ts`, "utf8")
      : await response.text();
    const needle = "command(host.graph);";
    if (source.split(needle).length !== 2)
      throw Error("canvasMenu planning instrumentation no longer matches");
    await route.fulfill({
      response,
      body: source.replace(
        needle,
        `{
        const start = performance.now();
        try { command(host.graph); }
        finally {
          window.__adr248Plans?.push({ id, ms: performance.now() - start });
        }
      }`,
      ),
    });
  });
}
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
  baselineFiles: process.env.BASELINE_FILES ?? null,
  head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  base,
  errors,
  samples: [],
  diagnostics,
  extended,
  browser: browser.version(),
  environment: {
    mode: "dev",
    headed: true,
    viewport: [1440, 900],
    dpr: 1,
    cpuThrottle: 1,
    warmup: 0,
    runs,
  },
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
      async ({ count, runs, diagnostics, extended }) => {
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
          if (diagnostics) window.__adr248Plans = [];
          const start = performance.now();
          fn();
          const commandMs = performance.now() - start;
          if (name === "actionBar") active = false;
          await frames();
          const settledMs = performance.now() - start;
          await saved();
          active = false;
          const taskMs = (await window.adr248TaskDuration()) - before;
          const plans = window.__adr248Plans;
          window.__adr248Plans = undefined;
          return {
            name,
            commandMs,
            settledMs,
            taskMs,
            counts: { ...counts },
            ...(diagnostics ? { plans } : {}),
          };
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
            if (extended) {
              values.push(
                await sample("reparent", () =>
                  w.execute(
                    c.moveNodes({
                      ids: [entries[0].id],
                      parent: { kind: "node", id: entries[count - 1].id },
                      newId: w.newId,
                    }),
                  ),
                ),
              );
              if (
                w.runtime.graph.ownerOf(entries[0].id) !== entries[count - 1].id
              )
                throw Error("reparent owner mismatch");
              w.undo();
              await frames();
              await saved();
              const targets = entries
                .slice(0, Math.floor(count / 10))
                .map((e) => ({ kind: "node", id: e.id }));
              values.push(
                await sample("multiDelete", () =>
                  w.execute(c.removeTargets({ targets })),
                ),
              );
              if (
                w.runtime.graph.getEntry(body).children.length !==
                count - targets.length
              )
                throw Error("multi delete count mismatch");
              w.undo();
              await frames();
              await saved();
            }
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
            fixture: {
              siblings: count,
              selectedForActionBar: count,
              depthBelowBody: 1,
              moved: 1,
              deleted: 1,
              multiDeleted: extended ? Math.floor(count / 10) : null,
              projectNodes: Object.values(
                w.runtime.graph.exportDocument().entries,
              ).filter((e) => e.kind === "node").length,
            },
            visibility: document.visibilityState,
            values,
            undoRestored: true,
          };
        } finally {
          engine.getLayoutsBatch = original;
          sceneModule.CatalogCanvasScene.prototype.sync = sync;
        }
      },
      { count, runs, diagnostics, extended },
    );
    result.samples.push(data);
    if (process.env.INPUT === "1") {
      data.inputs = [];
      for (let i = 0; i < runs; i++) {
        await page.evaluate(async () => {
          const w = window.__COMPOSITION_CATALOG__.workspace;
          const body = w.runtime.graph.getEntry(w.session.getSnapshot().pageId)
            .children[0];
          w.selectRecords([
            w.root.recordsOfSource(
              w.runtime.graph.getEntry(body).children[0],
            )[0],
          ]);
          document.querySelector('[data-canvas-container="true"]')?.focus();
          await new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          );
          window.__adr248Input = null;
          window.__adr248Plans = [];
          const onKey = (event) => {
            if (
              event.key.toLowerCase() !== "a" ||
              !(event.metaKey || event.ctrlKey)
            )
              return;
            window.removeEventListener("keydown", onKey, true);
            const start = performance.now();
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                window.__adr248Input = {
                  inputToTwoRafMs: performance.now() - start,
                  selected: w.session.getSnapshot().selection.length,
                  visibility: document.visibilityState,
                  plans: window.__adr248Plans,
                };
                window.__adr248Plans = undefined;
              }),
            );
          };
          window.addEventListener("keydown", onKey, true);
        });
        await page.keyboard.press(
          process.platform === "darwin" ? "Meta+a" : "Control+a",
        );
        await page.waitForFunction(() => window.__adr248Input !== null);
        const input = await page.evaluate(() => window.__adr248Input);
        if (input.selected !== count)
          throw Error("keyboard selection mismatch");
        if (
          !(await page
            .getByRole("toolbar", { name: /Selection actions|선택 액션/ })
            .isVisible())
        )
          throw Error("keyboard action bar missing");
        data.inputs.push(input);
      }
    }
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
    // Deletion stays available through overflow; its command still commits one history step.
    await page.evaluate(() => {
      const w = window.__COMPOSITION_CATALOG__.workspace;
      const body = w.runtime.graph.getEntry(w.session.getSnapshot().pageId)
        .children[0];
      w.selectRecords(
        w.runtime.graph
          .getEntry(body)
          .children.map((id) => w.root.recordsOfSource(id)[0]),
      );
      window.__adr248UndoDepth = w.runtime.historyDepth.undo;
    });
    await page
      .getByRole("toolbar", { name: /Selection actions|선택 액션/ })
      .getByRole("button", { name: /^(More actions|더 보기)$/ })
      .click();
    await page.getByRole("menuitem", { name: /^(Delete|삭제)/ }).click();
    result.live.overflow = await page.evaluate(async () => {
      const w = window.__COMPOSITION_CATALOG__.workspace;
      const body = w.runtime.graph.getEntry(w.session.getSnapshot().pageId)
        .children[0];
      const children = () => w.runtime.graph.getEntry(body).children;
      if (
        children().length ||
        w.runtime.historyDepth.undo !== window.__adr248UndoDepth + 1
      )
        throw Error("overflow deletion/history mismatch");
      w.undo();
      const restored = [...children()];
      w.redo();
      if (children().length) throw Error("overflow redo mismatch");
      w.undo();
      if (JSON.stringify(children()) !== JSON.stringify(restored))
        throw Error("overflow undo order mismatch");
      w.session.clearSelection();
      for (let i = 0; i < 400; i++) {
        if (w.runtime.durableRevision === w.runtime.graph.revision)
          return {
            deleted: restored.length,
            historySteps: 1,
            undo: true,
            redo: true,
          };
        await new Promise((r) => setTimeout(r, 25));
      }
      throw Error("overflow save timeout");
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
    const hit = await page.evaluate(() => {
      const { workspace: w, canvas } = window.__COMPOSITION_CATALOG__;
      const identity = w.root.recordsOfSource("project:node:followup-0")[0];
      const bounds = canvas.boundsOf(identity);
      const camera = canvas.camera();
      const rect = document
        .querySelector('[data-canvas-container="true"]')
        .getBoundingClientRect();
      return {
        identity,
        x: rect.left + (bounds.x + bounds.width / 2) * camera.zoom + camera.x,
        y: rect.top + (bounds.y + bounds.height / 2) * camera.zoom + camera.y,
      };
    });
    await page.mouse.click(hit.x, hit.y);
    await page.waitForFunction((identity) => {
      const selection =
        window.__COMPOSITION_CATALOG__.workspace.session.getSnapshot()
          .selection;
      return selection.length === 1 && selection[0].identity === identity;
    }, hit.identity);
    result.live.pointerSelection = true;
    writeFileSync(`${out}/results.json`, JSON.stringify(result, null, 2));
  }
  if (process.env.COMPARE === "1") {
    await page
      .getByRole("button", {
        name: "Compare Mode (Preview + Skia)",
        exact: true,
      })
      .click();
    await page.waitForFunction(() =>
      document
        .querySelector("#previewFrame")
        ?.contentDocument?.querySelector('[data-catalog-id*="followup-0"]'),
    );
    result.compare = await page.evaluate(() => {
      const w = window.__COMPOSITION_CATALOG__.workspace;
      const body = w.runtime.graph.getEntry(w.session.getSnapshot().pageId)
        .children[0];
      const ids = w.runtime.graph.getEntry(body).children;
      const identities = [body, ...ids].map(
        (id) => w.root.recordsOfSource(id)[0],
      );
      const geometry = w.root.getGeometry(identities);
      const doc = document.querySelector("#previewFrame").contentDocument;
      const elements = new Map(
        [...doc.querySelectorAll("[data-catalog-id]")].map((e) => [
          e.getAttribute("data-catalog-id"),
          e,
        ]),
      );
      const origin = geometry.get(identities[0]);
      const domOrigin = elements.get(identities[0]).getBoundingClientRect();
      let maxDelta = 0;
      for (const identity of identities.slice(1)) {
        const canvas = geometry.get(identity);
        const dom = elements.get(identity)?.getBoundingClientRect();
        if (!canvas || !dom) throw Error("compare node missing");
        maxDelta = Math.max(
          maxDelta,
          Math.abs(canvas.x - origin.x - (dom.x - domOrigin.x)),
          Math.abs(canvas.y - origin.y - (dom.y - domOrigin.y)),
          Math.abs(canvas.width - dom.width),
          Math.abs(canvas.height - dom.height),
        );
      }
      if (maxDelta > 1) throw Error(`compare geometry delta ${maxDelta}`);
      return {
        count: ids.length,
        maxDelta,
        visibility: document.visibilityState,
      };
    });
    writeFileSync(`${out}/results.json`, JSON.stringify(result, null, 2));
  }
  await page.screenshot({ path: `${out}/builder.png` });
} finally {
  writeFileSync(`${out}/results.json`, JSON.stringify(result, null, 2));
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
