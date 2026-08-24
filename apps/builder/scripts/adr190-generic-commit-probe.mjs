#!/usr/bin/env node
/**
 * ADR-190 Phase 1 / G1 — generic canonical commit 의 sparse lane 진입 실측.
 *
 * ADR-189 의 G0 fixture 를 그대로 쓰되, 판정 대상이 다르다. G0 는 "full rebuild
 * 가 얼마나 비싼가" 를 쟀고, 여기서는 같은 `updateElementProps` commit 이
 * **patch queue 에 진입해 subtree splice 를 타는가** 를 본다.
 *
 * 판정 축:
 *  - queueCount / patchSuccessCount / patchFallbackCount
 *  - full build 발생 여부 (subtree=false 인 build metric)
 *  - render.frame p95 (120Hz gate)
 *  - registry 미등재 키 patch 가 fail-closed 로 full rebuild 하는지
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

function parseArgs(argv) {
  const options = {
    baseUrl: "http://localhost:5173",
    out: "/private/tmp/adr190-phase1-g1.json",
    repeats: 8,
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

function summarize(values) {
  const round = (v) => Number(v.toFixed(3));
  return {
    count: values.length,
    p50: round(percentile(values, 0.5)),
    p95: round(percentile(values, 0.95)),
    max: round(Math.max(0, ...values)),
  };
}

async function waitForSettledFrames(page, count = 5) {
  await page.evaluate(
    (frameCount) =>
      new Promise((done) => {
        let remaining = frameCount;
        const next = () => {
          remaining -= 1;
          if (remaining <= 0) done();
          else requestAnimationFrame(next);
        };
        requestAnimationFrame(next);
      }),
    count,
  );
}

async function createProject(page, baseUrl) {
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
  const projectName = `adr190-g1-${Date.now()}`;
  await page.getByLabel("New project name").fill(projectName);
  await page.locator('form.new-project-form button[type="submit"]').click();
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 30000 });
  await page.goto(`${page.url()}?adr187Metrics=1&adr189Metrics=1`, {
    waitUntil: "networkidle",
  });
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
      const state = store.getState();
      if (!state.currentPageId) throw new Error("current page is unavailable");
      const active = state.elements.filter(
        (el) => el.page_id === state.currentPageId,
      );
      const body = active.find((el) => el.type === "body");
      if (!body) throw new Error("active body is unavailable");
      const countToAdd = targetTier - active.length;
      if (countToAdd < 0) {
        throw new Error(
          `tier ${targetTier} < active ${active.length}`,
        );
      }
      if (countToAdd > 0) {
        const offset = Math.max(priorTier, active.length);
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
          priorTier === 0 ? "adr190-target" : `adr190-seed-${targetTier}`;
        await state.addComplexElement(
          makeFrame(0, targetId),
          Array.from({ length: countToAdd - 1 }, (_, i) =>
            makeFrame(i + 1, `adr190-node-${offset + i + 1}`),
          ),
        );
      }
      const next = store.getState();
      const count = next.elements.filter(
        (el) => el.page_id === state.currentPageId,
      ).length;
      if (count !== targetTier) {
        throw new Error(`expected ${targetTier} elements, got ${count}`);
      }
      next.setSelectedElement("adr190-target");
      return { activePageElementCount: count };
    },
    { targetTier: tier, priorTier: previousTier },
  );
}

/** styleFactory 는 run index 를 받아 patch 할 style 객체를 만든다. */
async function runCommit(page, repeat, styleKind) {
  await page.evaluate(() => {
    window.__composition_COMMIT_LANE_DEBUG__.reset();
    window.__composition_PERF__.reset();
    window.__composition_PERF__.resetLongTasks();
    window.__composition_STORE_COMMIT_SINK_DEBUG__?.reset();
  });

  await page.evaluate(
    async ({ runIndex, kind }) => {
      const store = window.__composition_STORE__;
      const state = store.getState();
      const target = state.elementsMap.get("adr190-target");
      if (!target) throw new Error("commit target is unavailable");
      const currentStyle = target.props?.style ?? {};
      const nextStyle =
        kind === "unknown-key"
          ? // registry 미등재 키 — fail-closed 로 full rebuild 해야 한다.
            { ...currentStyle, adr190UnknownProbeKey: `${runIndex}` }
          : { ...currentStyle, left: runIndex % 2 === 0 ? "64px" : "96px" };
      await state.updateElementProps("adr190-target", { style: nextStyle });
      await new Promise((done) => {
        let remaining = 4;
        const next = () => {
          remaining -= 1;
          if (remaining <= 0) done();
          else requestAnimationFrame(next);
        };
        requestAnimationFrame(next);
      });
    },
    { runIndex: repeat, kind: styleKind },
  );

  const debug = await page.evaluate(() =>
    window.__composition_COMMIT_LANE_DEBUG__.snapshot(),
  );
  const sinkDebug = await page.evaluate(
    () => window.__composition_STORE_COMMIT_SINK_DEBUG__?.read() ?? null,
  );
  const perf = await page.evaluate(() => ({
    frame: window.__composition_PERF__.snapshot("render.frame"),
    record: window.__composition_PERF__.snapshot("render.skia.record.content"),
  }));
  const fullBuilds = debug.buildMetrics.filter((m) => !m.subtree);
  const subtreeBuilds = debug.buildMetrics.filter((m) => m.subtree);
  return {
    repeat: repeat + 1,
    styleKind,
    queueCount: debug.queueCount,
    patchSuccessCount: debug.patchSuccessCount,
    patchFallbackCount: debug.patchFallbackCount,
    fullBuildCount: fullBuilds.length,
    fullBuildVisits: fullBuilds.at(-1)?.visits ?? 0,
    subtreeBuildCount: subtreeBuilds.length,
    subtreeVisits: subtreeBuilds.at(-1)?.visits ?? 0,
    damageBounds: debug.lastDamageBounds,
    sink: sinkDebug,
    frameP95: perf.frame?.p95 ?? 0,
    recordP95: perf.record?.p95 ?? 0,
  };
}

/** unknown 키를 제거해 다음 tier 의 known 실행이 오염되지 않게 한다. */
async function restoreCleanStyle(page) {
  await page.evaluate(async () => {
    const store = window.__composition_STORE__;
    const state = store.getState();
    const target = state.elementsMap.get("adr190-target");
    if (!target) return;
    const { adr190UnknownProbeKey, ...clean } = target.props?.style ?? {};
    void adr190UnknownProbeKey;
    await state.updateElementProps("adr190-target", { style: clean });
    await new Promise((done) => {
      let remaining = 4;
      const next = () => {
        remaining -= 1;
        if (remaining <= 0) done();
        else requestAnimationFrame(next);
      };
      requestAnimationFrame(next);
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!existsSync(options.storageState)) {
    throw new Error(`storage state not found: ${options.storageState}`);
  }
  const browser = await chromium.launch({
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const context = await browser.newContext({
    storageState: JSON.parse(readFileSync(options.storageState, "utf8")),
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
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

      const known = [];
      for (let i = 0; i < options.repeats; i += 1) {
        known.push(await runCommit(page, i, "known-key"));
      }
      // fail-closed 확인은 tier 당 2회면 충분하다 (판정이 이진값).
      // 주의: unknown 키는 style 에 그대로 남아 이후 모든 commit 을 fail-closed
      // 시킨다 (fail-closed 판정이 patch 전체를 보기 때문). tier 간 오염을 막으려고
      // known 실행 뒤에 돌리고, 끝나면 style 을 다시 깨끗하게 되돌린다.
      const unknown = [];
      for (let i = 0; i < 2; i += 1) {
        unknown.push(await runCommit(page, i, "unknown-key"));
      }
      await restoreCleanStyle(page);

      tiers.push({
        n: tier,
        seed,
        known,
        unknown,
        aggregate: {
          knownQueueTotal: known.reduce((s, r) => s + r.queueCount, 0),
          knownPatchSuccessTotal: known.reduce(
            (s, r) => s + r.patchSuccessCount,
            0,
          ),
          knownFallbackTotal: known.reduce(
            (s, r) => s + r.patchFallbackCount,
            0,
          ),
          knownFullBuildTotal: known.reduce((s, r) => s + r.fullBuildCount, 0),
          knownSinkPublished: known.reduce(
            (s, r) => s + (r.sink?.published ?? 0),
            0,
          ),
          knownSinkDelivered: known.reduce(
            (s, r) => s + (r.sink?.delivered ?? 0),
            0,
          ),
          knownSinkUnsinked: known.reduce(
            (s, r) => s + (r.sink?.unsinked ?? 0),
            0,
          ),
          knownSinkFailed: known.reduce((s, r) => s + (r.sink?.failed ?? 0), 0),
          knownFrameMs: summarize(known.map((r) => r.frameP95)),
          knownRecordMs: summarize(known.map((r) => r.recordP95)),
          unknownQueueTotal: unknown.reduce((s, r) => s + r.queueCount, 0),
          unknownFullBuildTotal: unknown.reduce(
            (s, r) => s + r.fullBuildCount,
            0,
          ),
        },
      });
    }
    const result = {
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      environment: {
        baseUrl: options.baseUrl,
        browser: await browser.version(),
        repeats: options.repeats,
        viewport: { width: 1440, height: 900 },
      },
      project,
      tiers,
      diagnostics: { errors },
    };
    writeFileSync(options.out, `${JSON.stringify(result, null, 2)}\n`);
    process.stdout.write(
      `${JSON.stringify(
        {
          out: options.out,
          errors: errors.length,
          tiers: tiers.map(({ n, aggregate }) => ({ n, aggregate })),
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
