// ADR-248 후속: 합성 규모 fixture, 공개 명령과 실제 액션 바. 카운트/시간을 분리한다.
// BUILDER_URL / OUT / COUNTS(600,5000) / RUNS(3). 기본 시간은 precise coverage 없이 측정.
// Production input lane: DIST=<VITE_COMPOSITION_HARNESS=1 build> INPUT_ONLY=1
// CPU=1|4 WARMUP=2 RUNS=30 OUT=<unique run>. Uses the same sibling fixture;
// Event Timing is primary, capture→2-rAF/LoAF completion proxy are separate metrics.
import { chromium } from "playwright";
import { countsByClass, judge, renderVerdict } from "./perf-ratchet-gate.mjs";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { serveDist } from "./adr248-g5-boot-bundle.mjs";
const inputOnly = process.env.INPUT_ONLY === "1";
// PROFILE=1 is a separate diagnostic run; its latency is not a comparison oracle.
const profile = process.env.PROFILE === "1";
if (profile && !inputOnly) throw Error("PROFILE requires INPUT_ONLY=1");
const dist = process.env.DIST;
const cpu = Number(process.env.CPU ?? 1);
const warmup = Number(process.env.WARMUP ?? 0);
if (
  dist &&
  (!inputOnly ||
    process.env.DIAGNOSTICS === "1" ||
    process.env.BASELINE_MODULES)
)
  throw Error("DIST requires INPUT_ONLY=1 without dev module instrumentation");
if (![1, 4].includes(cpu) || !Number.isInteger(warmup) || warmup < 0)
  throw Error("CPU must be 1/4 and WARMUP a nonnegative integer");
const server = dist
  ? await serveDist(dist, Number(process.env.PORT ?? 4188))
  : null;
const base = server?.url ?? process.env.BUILDER_URL ?? "http://localhost:5173";
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
auth.origins = auth.origins.map((o) => ({
  ...o,
  origin: new URL(base).origin,
}));
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
if (profile) {
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
}
// ADR-243 measurement convention: Event Timing >=16 ms, with LoAF as attribution only.
// Installed only in this isolated measurement browser; no product telemetry.
if (inputOnly)
  await context.addInitScript(() => {
    const h = (window.__adr248Events = {
      events: [],
      loafs: [],
      supported: PerformanceObserver.supportedEntryTypes,
    });
    if (h.supported.includes("event"))
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          if (e.interactionId > 0)
            h.events.push({
              name: e.name,
              id: e.interactionId,
              start: e.startTime,
              duration: e.duration,
              processingStart: e.processingStart,
              processingEnd: e.processingEnd,
            });
      }).observe({ type: "event", durationThreshold: 16, buffered: true });
    if (h.supported.includes("long-animation-frame"))
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) h.loafs.push(e.toJSON());
      }).observe({ type: "long-animation-frame", buffered: true });
  });
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
  profile,
  extended,
  browser: browser.version(),
  environment: {
    mode: dist ? "production-harness" : "dev",
    headed: true,
    viewport: [1440, 900],
    dpr: 1,
    cpuThrottle: cpu,
    warmup,
    runs,
  },
};
try {
  if (dist)
    result.build = JSON.parse(readFileSync(`${dist}/version.json`, "utf8"));
  await page.goto(`${base}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page
    .locator("#new-project-name")
    .fill("ADR248 structural action bar perf");
  await page.locator("#new-project-name").press("Enter");
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.canvas,
    null,
    { timeout: 90000 },
  );
  await page.bringToFront();
  for (const count of counts) {
    await page.bringToFront();
    const data = await page.evaluate(
      async ({ count, runs, diagnostics, extended, inputOnly }) => {
        const { workspace: w, commands: c } = window.__COMPOSITION_CATALOG__;
        if (inputOnly && !window.__adr248StepTrace) {
          window.__adr248StepTrace = [];
          w.runtime.subscribeSteps(({ result }) => {
            window.__adr248StepTrace.push({
              revision: result.revision,
              operations: result.forward?.map(({ kind, id, field }) => ({
                kind,
                id,
                field,
              })),
              stack: new Error().stack,
            });
          });
        }
        const module = (path) =>
          import(
            performance
              .getEntriesByType("resource")
              .map((e) => e.name)
              .find((n) => n.includes(path)) ?? path
          );
        const actions = inputOnly
          ? null
          : await module("/src/builder/catalogRuntime/actionBar.ts");
        const shortcuts = inputOnly
          ? null
          : await module("/src/builder/catalogRuntime/shortcuts.ts");
        const sceneModule = inputOnly
          ? null
          : await module("/src/builder/catalogRuntime/canvasScene.ts");
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
        if (inputOnly)
          return {
            count,
            fixture: {
              siblings: count,
              selectedForActionBar: count,
              depthBelowBody: 1,
              projectNodes: Object.values(
                w.runtime.graph.exportDocument().entries,
              ).filter((e) => e.kind === "node").length,
            },
            visibility: document.visibilityState,
            values: [],
          };
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
      { count, runs, diagnostics, extended, inputOnly },
    );
    result.samples.push(data);
    if (process.env.INPUT === "1" || inputOnly) {
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      const probe = () =>
        page.evaluate(() => {
          const start = performance.now();
          let value = 0;
          for (let i = 0; i < 3e7; i++) value += i % 7;
          return { ms: performance.now() - start, value };
        });
      const unthrottled = await probe();
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
      data.throttle = { requested: cpu, unthrottled, applied: await probe() };
      data.inputs = [];
      data.warmupInputs = [];
      for (let i = -warmup; i < runs; i++) {
        await page.bringToFront();
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
          const revision = w.runtime.graph.revision;
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
                  eventStart: event.timeStamp,
                  captureStart: start,
                  inputToTwoRafMs: performance.now() - start,
                  selected: w.session.getSnapshot().selection.length,
                  visibility: document.visibilityState,
                  focus: document.hasFocus(),
                  revisionBefore: revision,
                  revisionAfter: w.runtime.graph.revision,
                  plans: window.__adr248Plans,
                };
                window.__adr248Plans = undefined;
              }),
            );
          };
          window.addEventListener("keydown", onKey, true);
        });
        if (profile && i >= 0) await cdp.send("Profiler.start");
        await page.keyboard.press(
          process.platform === "darwin" ? "Meta+a" : "Control+a",
        );
        await page.waitForFunction(() => window.__adr248Input !== null);
        if (profile && i >= 0) {
          const captured = await cdp.send("Profiler.stop");
          writeFileSync(
            `${out}/profile-${count}-${i}.json`,
            JSON.stringify(captured),
          );
        }
        const input = await page.evaluate(() => window.__adr248Input);
        if (input.selected !== count) {
          result.inputFailure = { count, index: i, input };
          throw Error("keyboard selection mismatch");
        }
        if (
          !(await page
            .getByRole("toolbar", { name: /Selection actions|선택 액션/ })
            .isVisible())
        )
          throw Error("keyboard action bar missing");
        if (input.visibility !== "visible" || !input.focus)
          throw Error("input was not foreground");
        if (inputOnly) {
          // Wait for observer delivery and trailing frames; never count this quiet wait as latency.
          const timing = await page.evaluate(async (input) => {
            const h = window.__adr248Events;
            if (!h.supported.includes("event"))
              throw Error("Event Timing unsupported");
            let timedOut = false;
            for (;;) {
              const now = performance.now();
              const last = Math.max(
                input.captureStart + input.inputToTwoRafMs,
                ...h.loafs
                  .filter((l) => l.startTime >= input.eventStart)
                  .map((l) => l.startTime + l.duration),
              );
              if (now - last >= 1000) break;
              if (now - input.captureStart > 5000) {
                timedOut = true;
                break;
              }
              await new Promise((r) => setTimeout(r, 50));
            }
            // Meta keydown can precede A by less than 2 ms. Match the closest timestamp,
            // not the first keydown in that window, so modifier timing cannot replace A.
            const key = h.events
              .filter(
                (e) =>
                  e.name === "keydown" &&
                  Math.abs(e.start - input.eventStart) < 0.1,
              )
              .sort(
                (a, b) =>
                  Math.abs(a.start - input.eventStart) -
                  Math.abs(b.start - input.eventStart),
              )[0];
            const group = key ? h.events.filter((e) => e.id === key.id) : [];
            const longest = group.reduce(
              (a, e) => (!a || e.duration > a.duration ? e : a),
              null,
            );
            const loafs = h.loafs.filter(
              (l) =>
                l.startTime + l.duration > input.eventStart &&
                l.startTime < performance.now(),
            );
            const w = window.__COMPOSITION_CATALOG__.workspace;
            return {
              observed: Boolean(longest),
              eventTimingMs: longest?.duration ?? 16,
              inputDelayMs: longest
                ? longest.processingStart - longest.start
                : null,
              processingMs: longest
                ? longest.processingEnd - longest.processingStart
                : null,
              presentationMs: longest
                ? longest.start + longest.duration - longest.processingEnd
                : null,
              events: group,
              unmatchedEvents: key
                ? []
                : h.events.filter(
                    (e) =>
                      e.start >= input.eventStart - 2 &&
                      e.start <= performance.now(),
                  ),
              keydownMatchDeltaMs: key
                ? Math.abs(key.start - input.eventStart)
                : null,
              loafs,
              timedOut,
              completionProxyMs:
                Math.max(
                  input.eventStart + (longest?.duration ?? 16),
                  input.captureStart + input.inputToTwoRafMs,
                  ...loafs.map((l) => l.startTime + l.duration),
                ) - input.eventStart,
              durableRevision: w.runtime.durableRevision,
              finalRevision: w.runtime.graph.revision,
              finalSelected: w.session.getSnapshot().selection.length,
              unexpectedSteps: window.__adr248StepTrace?.filter(
                (step) => step.revision > input.revisionBefore,
              ),
            };
          }, input);
          Object.assign(input, timing);
          if (
            input.timedOut ||
            input.finalSelected !== count ||
            input.finalRevision !== input.revisionBefore ||
            input.durableRevision !== input.finalRevision
          ) {
            result.inputFailure = { count, index: i, input };
            throw Error("selection completion/graph invariant failed");
          }
        }
        (i < 0 ? data.warmupInputs : data.inputs).push(input);
        if (inputOnly && i >= 0 && (i + 1) % 10 === 0) {
          writeFileSync(`${out}/results.json`, JSON.stringify(result, null, 2));
          console.log(
            `Progress ${count} siblings, CPU ${cpu}x: ${i + 1}/${runs}`,
          );
        }
      }
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    }
    writeFileSync(`${out}/results.json`, JSON.stringify(result, null, 2));
    if (inputOnly) {
      console.log(
        `Measured ${count} siblings: ${data.inputs.length} inputs, CPU ${cpu}x`,
      );
      continue;
    }
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
  if (inputOnly) {
    // CSS visibility alone does not establish that the bar is inside the viewport.
    // Read this after all timing samples so the diagnostic adds no work to an input.
    result.inputSurface = await page
      .getByRole("toolbar", { name: /Selection actions|선택 액션/ })
      .evaluate((bar) => {
        const r = bar.getBoundingClientRect();
        return {
          rect: r.toJSON(),
          viewport: [innerWidth, innerHeight],
          intersectsViewport:
            r.right > 0 &&
            r.bottom > 0 &&
            r.left < innerWidth &&
            r.top < innerHeight,
        };
      });
  }
  await page.screenshot({ path: `${out}/builder.png` });
} catch (error) {
  result.failure = String(error);
  result.failureState = await page
    .evaluate(() => {
      const h = window.__COMPOSITION_CATALOG__;
      const w = h?.workspace;
      const state = w?.session.getSnapshot();
      const page = state?.pageId && w.runtime.graph.getEntry(state.pageId);
      const body =
        page?.children?.[0] && w.runtime.graph.getEntry(page.children[0]);
      const active = document.activeElement;
      return {
        path: location.pathname,
        ready: document.readyState,
        handle: Object.keys(h ?? {}),
        input: window.__adr248Input,
        revision: w?.runtime.graph.revision,
        durableRevision: w?.runtime.durableRevision,
        selected: state?.selection.length,
        bodyChildren: body?.children?.length,
        steps: window.__adr248StepTrace,
        active: active && {
          tag: active.tagName,
          role: active.getAttribute("role"),
          editable: active.isContentEditable,
          canvas: Boolean(active.closest('[data-canvas-container="true"]')),
        },
      };
    })
    .catch(() => null);
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw error;
} finally {
  writeFileSync(`${out}/results.json`, JSON.stringify(result, null, 2));
  await browser.close();
  server?.close();
}
if (errors.length) process.exitCode = 1;

if (!inputOnly) {
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
}
