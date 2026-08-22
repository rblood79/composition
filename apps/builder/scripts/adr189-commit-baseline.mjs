#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

function parseArgs(argv) {
  const options = {
    baseUrl: "http://localhost:5173",
    out: "/private/tmp/adr189-phase0-g0-baseline.json",
    repeats: 5,
    storageState: resolve("apps/builder/scripts/.auth-session.json"),
    tiers: [50, 500, 5000],
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];
    if (value === "--base-url") options.baseUrl = next;
    else if (value === "--out") options.out = next;
    else if (value === "--repeats") options.repeats = Number(next);
    else if (value === "--storage-state") options.storageState = resolve(next);
    else if (value === "--tiers") options.tiers = next.split(",").map(Number);
    else continue;
    index += 1;
  }
  return options;
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

function round(value) {
  return Number(value.toFixed(3));
}

function summarize(values) {
  return {
    count: values.length,
    p50: round(percentile(values, 0.5)),
    p95: round(percentile(values, 0.95)),
    p99: round(percentile(values, 0.99)),
    max: round(Math.max(0, ...values)),
  };
}

async function waitForSettledFrames(page, count = 5) {
  await page.evaluate(
    (frameCount) =>
      new Promise((resolvePromise) => {
        let remaining = frameCount;
        const next = () => {
          remaining -= 1;
          if (remaining <= 0) resolvePromise();
          else requestAnimationFrame(next);
        };
        requestAnimationFrame(next);
      }),
    count,
  );
}

async function createProject(page, baseUrl) {
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
  const projectName = `codex-adr189-g0-${Date.now()}`;
  await page.getByLabel("New project name").fill(projectName);
  await page.locator('form.new-project-form button[type="submit"]').click();
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 30000 });
  const builderUrl = `${page.url()}?adr187Metrics=1&adr189Metrics=1`;
  await page.goto(builderUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(
    () =>
      Boolean(
        window.__composition_STORE__ &&
        window.__composition_PERF__ &&
        window.__composition_COMMIT_LANE_DEBUG__,
      ),
    undefined,
    { timeout: 30000 },
  );
  return { projectName, url: page.url() };
}

async function seedTier(page, tier, previousTier) {
  return page.evaluate(
    async ({ targetTier, priorTier }) => {
      const store = window.__composition_STORE__;
      const state = store?.getState();
      if (!state?.currentPageId) throw new Error("current page is unavailable");
      const activeElements = state.elements.filter(
        (element) => element.page_id === state.currentPageId,
      );
      const body = activeElements.find((element) => element.type === "body");
      if (!body) throw new Error("active body is unavailable");
      const countToAdd = targetTier - activeElements.length;
      if (countToAdd < 0) {
        throw new Error(
          `tier ${targetTier} is smaller than active count ${activeElements.length}`,
        );
      }
      if (countToAdd > 0) {
        const offset = Math.max(priorTier, activeElements.length);
        const makeFrame = (index, id) => ({
          id,
          type: "frame",
          parent_id: body.id,
          page_id: state.currentPageId,
          order_num: offset + index,
          props: {
            style: {
              height: index === 0 && priorTier === 0 ? "120px" : "8px",
              left:
                index === 0 && priorTier === 0
                  ? "20px"
                  : `${((offset + index) % 80) * 12}px`,
              position: "absolute",
              top:
                index === 0 && priorTier === 0
                  ? "30px"
                  : `${Math.floor((offset + index) / 80) * 12}px`,
              width: index === 0 && priorTier === 0 ? "120px" : "8px",
            },
          },
        });
        const targetId =
          priorTier === 0 ? "adr189-target" : `adr189-seed-${targetTier}`;
        const parent = makeFrame(0, targetId);
        const children = Array.from({ length: countToAdd - 1 }, (_, index) =>
          makeFrame(index + 1, `adr189-node-${offset + index + 1}`),
        );
        await state.addComplexElement(parent, children);
      }
      const next = store.getState();
      const count = next.elements.filter(
        (element) => element.page_id === state.currentPageId,
      ).length;
      if (count !== targetTier) {
        throw new Error(`expected ${targetTier} active elements, got ${count}`);
      }
      next.setSelectedElement("adr189-target");
      return { activePageElementCount: count };
    },
    { targetTier: tier, priorTier: previousTier },
  );
}

async function runCommit(page, tier, repeat) {
  await page.evaluate(() => {
    window.__composition_COMMIT_LANE_DEBUG__.reset();
    window.__composition_PERF__.reset();
    window.__composition_PERF__.resetLongTasks();
  });

  const result = await page.evaluate(
    async ({ runIndex }) => {
      const store = window.__composition_STORE__;
      const state = store.getState();
      const target = state.elementsMap.get("adr189-target");
      if (!target) throw new Error("commit target is unavailable");
      const currentStyle = target.props?.style ?? {};
      const nextLeft = runIndex % 2 === 0 ? "64px" : "96px";
      await state.updateElementProps("adr189-target", {
        style: { ...currentStyle, left: nextLeft },
      });
      await pageWaitForCommit();

      function pageWaitForCommit() {
        return new Promise((resolvePromise) => {
          let remaining = 4;
          const next = () => {
            remaining -= 1;
            if (remaining <= 0) resolvePromise();
            else requestAnimationFrame(next);
          };
          requestAnimationFrame(next);
        });
      }
      return {
        targetStyle: store.getState().elementsMap.get("adr189-target")?.props
          ?.style,
      };
    },
    { runIndex: repeat },
  );

  const debug = await page.evaluate(() =>
    window.__composition_COMMIT_LANE_DEBUG__.snapshot(),
  );
  const perf = await page.evaluate(() => {
    const labels = [
      "render.content.build",
      "render.skia.record.content",
      "render.skia.flush.content",
      "render.skia.flush.main",
      "render.frame",
    ];
    return Object.fromEntries(
      labels.map((label) => [
        label,
        window.__composition_PERF__.snapshot(label),
      ]),
    );
  });
  const longTasks = await page.evaluate(() =>
    window.__composition_PERF__.snapshotLongTasks(),
  );
  const fullBuilds = debug.buildMetrics.filter((metric) => !metric.subtree);
  const stream = fullBuilds[fullBuilds.length - 1] ?? null;
  const record = perf["render.skia.record.content"];
  const flush = perf["render.skia.flush.content"];
  return {
    n: tier,
    repeat: repeat + 1,
    targetStyle: result.targetStyle,
    streamBuild: stream,
    fullBuildCount: fullBuilds.length,
    fullBuildVisits: stream?.visits ?? 0,
    fixtureVisitOffset: (stream?.visits ?? 0) - tier,
    spatialIndexMs: debug.spatialIndexDurationsMs,
    recordContent: record,
    flushContent: flush,
    flushMain: perf["render.skia.flush.main"],
    contentBuild: perf["render.content.build"],
    renderFrame: perf["render.frame"],
    longTasks,
  };
}

function aggregate(runs) {
  const stream = runs.map((run) => run.streamBuild?.durationMs ?? 0);
  const record = runs.map((run) => run.recordContent?.p95 ?? 0);
  const flush = runs.map((run) => run.flushContent?.p95 ?? 0);
  const spatial = runs.flatMap((run) => run.spatialIndexMs ?? []);
  const recordPlusStream = runs.map(
    (run) => (run.streamBuild?.durationMs ?? 0) + (run.recordContent?.p95 ?? 0),
  );
  const fixtureVisitOffsets = runs.map((run) => run.fixtureVisitOffset);
  const fixedVisibleShellVisits = fixtureVisitOffsets[0] ?? 0;
  return {
    streamBuildMs: summarize(stream),
    recordContentMs: summarize(record),
    flushContentMs: summarize(flush),
    spatialIndexMs: summarize(spatial),
    recordPlusStreamMs: summarize(recordPlusStream),
    fullRebuildVisits: runs.map((run) => run.fullBuildVisits),
    fixedVisibleShellVisits,
    negativeContractPass: fixtureVisitOffsets.every(
      (offset) => offset === fixedVisibleShellVisits,
    ),
    longTaskCount: runs.reduce(
      (sum, run) =>
        sum + run.longTasks.reduce((inner, task) => inner + task.count, 0),
      0,
    ),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!existsSync(options.storageState)) {
    throw new Error(`storage state not found: ${options.storageState}`);
  }
  const storageState = JSON.parse(readFileSync(options.storageState, "utf8"));
  const browser = await chromium.launch({
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const context = await browser.newContext({
    storageState,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  try {
    const project = await createProject(page, options.baseUrl);
    const tiers = [];
    let previousTier = 0;
    for (const tier of options.tiers) {
      const seed = await seedTier(page, tier, previousTier);
      previousTier = tier;
      await page.waitForTimeout(tier >= 5000 ? 5000 : 2000);
      await waitForSettledFrames(page);
      const runs = [];
      for (let repeat = 0; repeat < options.repeats; repeat += 1) {
        runs.push(await runCommit(page, tier, repeat));
      }
      tiers.push({ n: tier, seed, runs, aggregate: aggregate(runs) });
    }
    const result = {
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      environment: {
        baseUrl: options.baseUrl,
        browser: await browser.version(),
        repeats: options.repeats,
        viewport: { width: 1440, height: 900 },
        fixture:
          "canonical frame siblings under active body; one target style commit",
      },
      project,
      tiers,
      diagnostics: { errors },
    };
    writeFileSync(options.out, `${JSON.stringify(result, null, 2)}\n`);
    process.stdout.write(
      `${JSON.stringify({ out: options.out, tiers: tiers.map(({ n, aggregate }) => ({ n, aggregate })) }, null, 2)}\n`,
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
