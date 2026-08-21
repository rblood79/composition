#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createServer } from "node:http";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright";

function parseArgs(argv) {
  const options = {
    baseUrl: "http://localhost:5173/composition",
    durationMs: 5000,
    distDir: resolve("apps/builder/dist"),
    headed: false,
    out: "/private/tmp/adr187-phase0-baseline.json",
    repeats: 5,
    storageState: resolve("apps/builder/scripts/.auth-session.json"),
    serveDist: false,
    tiers: [50, 500, 5000],
    traceDir: "/private/tmp/adr187-phase0-traces",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];
    if (value === "--base-url") options.baseUrl = next;
    else if (value === "--dist-dir") options.distDir = resolve(next);
    else if (value === "--duration-ms") options.durationMs = Number(next);
    else if (value === "--headed") {
      options.headed = true;
      continue;
    } else if (value === "--out") options.out = next;
    else if (value === "--repeats") options.repeats = Number(next);
    else if (value === "--serve-dist") {
      options.serveDist = true;
      continue;
    } else if (value === "--storage-state") {
      options.storageState = resolve(next);
    }
    else if (value === "--tiers") {
      options.tiers = next.split(",").map(Number);
    } else if (value === "--trace-dir") options.traceDir = next;
    else continue;
    index += 1;
  }
  return options;
}

function assertOptions(options) {
  if (!existsSync(options.storageState)) {
    throw new Error(`storage state not found: ${options.storageState}`);
  }
  if (options.serveDist && !existsSync(join(options.distDir, "index.html"))) {
    throw new Error(`production dist is unavailable: ${options.distDir}`);
  }
  if (
    !Number.isFinite(options.durationMs) ||
    options.durationMs <= 0 ||
    !Number.isInteger(options.repeats) ||
    options.repeats <= 0 ||
    options.tiers.some((tier) => !Number.isInteger(tier) || tier < 2)
  ) {
    throw new Error("duration, repeats, and tiers must be positive");
  }
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

async function startProductionBundleHost(options) {
  if (!options.serveDist) return null;
  const base = new URL(options.baseUrl);
  const port = Number(base.port || 80);
  const distRoot = resolve(options.distDir);
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", base.origin);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/composition") pathname = "/";
    else if (pathname.startsWith("/composition/")) {
      pathname = pathname.slice("/composition".length);
    }
    const relativePath = pathname.replace(/^\/+/, "");
    let filePath = resolve(distRoot, relativePath || "index.html");
    if (!filePath.startsWith(`${distRoot}${sep}`) && filePath !== distRoot) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    if (!existsSync(filePath) || extname(filePath) === "") {
      filePath = join(distRoot, "index.html");
    }
    try {
      const body = readFileSync(filePath);
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type":
          contentTypes[extname(filePath)] ?? "application/octet-stream",
        "Document-Policy": "js-profiling",
      });
      response.end(body);
    } catch (error) {
      response.writeHead(500).end(String(error));
    }
  });
  await new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(port, "127.0.0.1", resolvePromise);
  });
  return server;
}

function subtractCounters(after, before) {
  return Object.fromEntries(
    Object.keys(after).map((key) => [key, after[key] - before[key]]),
  );
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
    : sorted[midpoint];
}

function aggregateRuns(runs) {
  const counterKeys = Object.keys(runs[0]?.drag.counters ?? {});
  const medianCounters = Object.fromEntries(
    counterKeys.map((key) => [
      key,
      median(runs.map((run) => run.drag.counters[key])),
    ]),
  );
  return {
    medianDragCounters: medianCounters,
    medianFrameApplyP95Ms: median(
      runs.map((run) => run.drag.durations.frameApply.p95),
    ),
    medianFrameApplyP99Ms: median(
      runs.map((run) => run.drag.durations.frameApply.p99),
    ),
    medianFrameApplyMaxMs: median(
      runs.map((run) => run.drag.durations.frameApply.max),
    ),
    totalLongTaskOccurrences: runs.reduce(
      (runSum, run) =>
        runSum +
        run.longTasks.reduce(
          (summarySum, summary) => summarySum + summary.count,
          0,
        ),
      0,
    ),
    maxLongTaskMs: Math.max(
      0,
      ...runs.flatMap((run) => run.longTasks.map((summary) => summary.max)),
    ),
  };
}

async function createIsolatedProject(page, baseUrl) {
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
  const projectName = `codex-adr187-phase0-${Date.now()}`;
  const projectNameInput = page.getByLabel("New project name");
  try {
    await projectNameInput.waitFor({ state: "visible", timeout: 10000 });
  } catch (error) {
    const body = (await page.locator("body").innerText()).slice(0, 2000);
    throw new Error(
      `dashboard form unavailable at ${page.url()}: ${body}\n${error}`,
    );
  }
  await projectNameInput.fill(projectName);
  await page.locator('form.new-project-form button[type="submit"]').click();
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 30000 });
  const projectUrl = page.url();
  const separator = projectUrl.includes("?") ? "&" : "?";
  await page.goto(`${projectUrl}${separator}adr187Metrics=1`, {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(
    () =>
      Boolean(
        window.__composition_STORE__ &&
          window.__composition_EDITOR_PRESENTATION_PHASE0_METRICS__,
      ),
    undefined,
    { timeout: 30000 },
  );
  return { projectName, projectUrl: page.url() };
}

async function seedTier(page, tier, previousTier) {
  return page.evaluate(
    async ({ targetTier, priorTier }) => {
      const store = window.__composition_STORE__;
      if (!store) throw new Error("Builder store global is unavailable");
      const state = store.getState();
      const currentPageId = state.currentPageId;
      if (!currentPageId) throw new Error("current page is unavailable");
      const activeElements = state.elements.filter(
        (element) => element.page_id === currentPageId,
      );
      const body = activeElements.find((element) => element.type === "body");
      if (!body) throw new Error("active page body is unavailable");

      const existingCount = activeElements.length;
      const countToAdd = targetTier - existingCount;
      if (countToAdd < 0) {
        throw new Error(
          `tier ${targetTier} is smaller than active count ${existingCount}`,
        );
      }
      if (countToAdd > 0) {
        const offset = Math.max(priorTier, existingCount);
        const makeBox = (index, id) => ({
          id,
          type: "Box",
          parent_id: body.id,
          page_id: currentPageId,
          order_num: offset + index,
          props: {
            style: {
              height: index === 0 && priorTier === 0 ? "120px" : "8px",
              left: `${(offset + index) % 100}px`,
              position: "absolute",
              top: `${Math.floor((offset + index) / 100) * 9}px`,
              width: index === 0 && priorTier === 0 ? "120px" : "8px",
            },
          },
          ...(index === 0 && priorTier === 0
            ? {
                fills: [
                  {
                    id: "adr187-fill",
                    type: "color",
                    color: "#3366CCFF",
                    enabled: true,
                    opacity: 1,
                    blendMode: "normal",
                  },
                ],
              }
            : {}),
        });
        const batchId =
          priorTier === 0 ? "adr187-target" : `adr187-seed-${targetTier}`;
        const parent = makeBox(0, batchId);
        const children = Array.from({ length: countToAdd - 1 }, (_, index) =>
          makeBox(index + 1, `adr187-node-${offset + index + 1}`),
        );
        await state.addComplexElement(parent, children);
      }

      const nextState = store.getState();
      const nextActiveCount = nextState.elements.filter(
        (element) => element.page_id === currentPageId,
      ).length;
      if (nextActiveCount !== targetTier) {
        throw new Error(
          `active page count mismatch: expected ${targetTier}, got ${nextActiveCount}`,
        );
      }
      nextState.setSelectedElement("adr187-target");
      return {
        activePageElementCount: nextActiveCount,
        totalStoreElementCount: nextState.elements.length,
      };
    },
    { targetTier: tier, priorTier: previousTier },
  );
}

async function openColorArea(page, forceReopen = false) {
  const colorArea = page.locator(".react-aria-ColorArea");
  if (!forceReopen && (await colorArea.isVisible().catch(() => false))) {
    const existingBounds = await colorArea
      .boundingBox({ timeout: 5000 })
      .catch(() => null);
    if (existingBounds) return colorArea;
  }

  if (await colorArea.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await colorArea
      .waitFor({ state: "hidden", timeout: 5000 })
      .catch(() => {});
  }

  const stylePanelButton = page.getByLabel("스타일", { exact: true }).first();
  if ((await stylePanelButton.getAttribute("aria-pressed")) !== "true") {
    await stylePanelButton.click();
  }
  const fillButton = page.getByLabel("Edit background fill", { exact: true });
  await fillButton.waitFor({ state: "visible", timeout: 30000 });
  await fillButton.click();
  await colorArea.waitFor({ state: "visible", timeout: 30000 });
  return colorArea;
}

async function enableSplitPreview(page) {
  const enableButton = page.getByLabel("Compare Mode (Preview + Skia)", {
    exact: true,
  });
  if (await enableButton.isVisible().catch(() => false)) {
    await enableButton.click();
  }
  await page
    .locator(".workspace--compare-mode")
    .waitFor({ state: "visible", timeout: 30000 });
  const iframe = page.locator("iframe#previewFrame");
  await iframe.waitFor({ state: "visible", timeout: 30000 });
  await page.waitForFunction(
    () => {
      const frame = document.querySelector("iframe#previewFrame");
      return Boolean(
        frame?.contentDocument?.body &&
          frame.contentDocument.body.dataset.preview === "true" &&
          !frame.contentDocument.body.querySelector(".preview-loading") &&
          frame.contentDocument.body.querySelectorAll("[data-element-id]")
            .length > 0,
      );
    },
    undefined,
    { timeout: 30000 },
  );
  return {
    iframeSrc: await iframe.getAttribute("src"),
    mode: "split",
    renderedElementCount: await iframe.evaluate((element) =>
      element.contentDocument?.body.querySelectorAll("[data-element-id]")
        .length ?? 0,
    ),
  };
}

async function waitForSettledFrames(page, count = 4) {
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

async function startTrace(cdp) {
  const events = [];
  cdp.on("Tracing.dataCollected", ({ value }) => events.push(...value));
  await cdp.send("Tracing.start", {
    categories: "devtools.timeline,v8.execute,blink.user_timing",
    options: "record-as-much-as-possible",
  });
  return events;
}

async function finishTrace(cdp, events, path) {
  const complete = new Promise((resolvePromise) => {
    cdp.once("Tracing.tracingComplete", resolvePromise);
  });
  await cdp.send("Tracing.end");
  await complete;
  const traceJson = JSON.stringify({ traceEvents: events });
  const compressed = gzipSync(traceJson);
  writeFileSync(path, compressed);
  return {
    eventCount: events.length,
    gzipBytes: compressed.byteLength,
    path,
    sha256: createHash("sha256").update(compressed).digest("hex"),
  };
}

async function runDrag(page, cdp, options, tier, repeat, traceDir) {
  let colorArea = page.locator(".react-aria-ColorArea");
  let bounds = await colorArea
    .boundingBox({ timeout: 5000 })
    .catch(() => null);
  if (!bounds) {
    colorArea = await openColorArea(page, true);
    bounds = await colorArea.boundingBox({ timeout: 10000 });
  }
  if (!bounds) throw new Error("ColorArea bounds are unavailable");

  await page.evaluate(() => {
    window.__composition_EDITOR_PRESENTATION_PHASE0_METRICS__.reset();
    window.__composition_PERF__?.resetLongTasks();
  });
  const traceEvents = await startTrace(cdp);
  const runStartedAt = Date.now();
  const startX = bounds.x + bounds.width * 0.15;
  const startY = bounds.y + bounds.height * (0.2 + repeat * 0.1);
  await page.mouse.move(startX, startY);
  await page.mouse.down();

  const cadenceMs = 1000 / 120;
  const dragStartedAt = Date.now();
  let step = 0;
  while (Date.now() - dragStartedAt < options.durationMs) {
    const progress = Math.min(
      1,
      (Date.now() - dragStartedAt) / options.durationMs,
    );
    const x = bounds.x + bounds.width * (0.15 + progress * 0.7);
    const y =
      bounds.y +
      bounds.height *
        (0.15 + ((repeat + 1) * 0.13 + Math.sin(progress * Math.PI * 4) * 0.1) % 0.7);
    await page.mouse.move(x, y);
    await page.waitForTimeout(cadenceMs);
    step += 1;
  }
  const actualDragDurationMs = Date.now() - dragStartedAt;

  const drag = await page.evaluate(() =>
    window.__composition_EDITOR_PRESENTATION_PHASE0_METRICS__.snapshot(),
  );
  await page.mouse.up();
  await waitForSettledFrames(page);
  const afterTerminal = await page.evaluate(() =>
    window.__composition_EDITOR_PRESENTATION_PHASE0_METRICS__.snapshot(),
  );
  const longTasks = await page.evaluate(
    () => window.__composition_PERF__?.snapshotLongTasks() ?? [],
  );
  const tracePath = resolve(
    traceDir,
    `adr187-n${tier}-run${repeat + 1}.trace.json.gz`,
  );
  const trace = await finishTrace(cdp, traceEvents, tracePath);

  return {
    afterTerminal,
    actualDragDurationMs,
    drag,
    rawMoveCount: step,
    runWallTimeMs: Date.now() - runStartedAt,
    longTasks,
    terminalDelta: subtractCounters(
      afterTerminal.counters,
      drag.counters,
    ),
    trace,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  assertOptions(options);
  mkdirSync(options.traceDir, { recursive: true });
  const productionBundleHost = await startProductionBundleHost(options);
  const storageState = JSON.parse(readFileSync(options.storageState, "utf8"));
  // The checked-in browser session is captured against the dev storage key,
  // while a production bundle reads the same Supabase session from the prod
  // key. Mirror it only inside this isolated context; never rewrite the source
  // session file or print token values.
  for (const origin of storageState.origins ?? []) {
    const devSession = origin.localStorage?.find(
      (entry) => entry.name === "composition-auth-dev",
    );
    const hasProdSession = origin.localStorage?.some(
      (entry) => entry.name === "composition-auth-prod",
    );
    if (devSession && !hasProdSession) {
      origin.localStorage.push({
        name: "composition-auth-prod",
        value: devSession.value,
      });
    }
  }
  let browser;
  const consoleMessages = [];
  const pageErrors = [];
  try {
    browser = await chromium.launch({
      channel: "chrome",
      headless: !options.headed,
    });
    const context = await browser.newContext({
      storageState,
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        consoleMessages.push({ type: message.type(), text: message.text() });
        if (message.type() === "error") {
          process.stderr.write(`[browser:error] ${message.text()}\n`);
        }
      }
    });
    page.on("pageerror", (error) => {
      pageErrors.push(String(error));
      process.stderr.write(`[browser:pageerror] ${error}\n`);
    });
    page.on("response", (response) => {
      if (response.status() >= 400) {
        process.stderr.write(
          `[browser:response] ${response.status()} ${response.url()}\n`,
        );
      } else if (
        response.request().resourceType() === "script" &&
        response.headers()["content-type"]?.includes("text/html")
      ) {
        process.stderr.write(
          `[browser:script-mime] ${response.headers()["content-type"]} ${response.url()}\n`,
        );
      }
    });

    const project = await createIsolatedProject(page, options.baseUrl);
    const tiers = [];
    let previousTier = 0;
    for (const tier of options.tiers) {
      const seed = await seedTier(page, tier, previousTier);
      previousTier = tier;
      await page.waitForTimeout(tier >= 5000 ? 5000 : 2000);
      await waitForSettledFrames(page);
      const productPreview = await enableSplitPreview(page);
      await openColorArea(page);
      const runs = [];
      for (let repeat = 0; repeat < options.repeats; repeat += 1) {
        runs.push(
          await runDrag(
            page,
            cdp,
            options,
            tier,
            repeat,
            options.traceDir,
          ),
        );
      }
      tiers.push({
        aggregate: aggregateRuns(runs),
        n: tier,
        runs,
        seed,
        productPreview,
      });
    }

    const result = {
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      environment: {
        baseUrl: options.baseUrl,
        browser: await browser.version(),
        durationMs: options.durationMs,
        headless: !options.headed,
        productPreview: "Builder top toggle group split mode",
        repeats: options.repeats,
        viewport: { width: 1440, height: 900 },
      },
      project,
      tiers,
      diagnostics: {
        consoleMessages,
        pageErrors,
      },
    };
    writeFileSync(options.out, `${JSON.stringify(result, null, 2)}\n`);
    process.stdout.write(
      `${JSON.stringify({ out: options.out, project, tiers: tiers.map(({ aggregate, n, seed }) => ({ aggregate, n, seed })) }, null, 2)}\n`,
    );
  } finally {
    await browser?.close();
    if (productionBundleHost) {
      await new Promise((resolvePromise) =>
        productionBundleHost.close(resolvePromise),
      );
    }
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
