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
    fixtureProfile: "dense",
    headed: false,
    lane: "paint",
    layoutProperty: "position",
    out: "/private/tmp/adr187-phase0-baseline.json",
    projectUrl: null,
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
    else if (value === "--fixture-profile") options.fixtureProfile = next;
    else if (value === "--headed") {
      options.headed = true;
      continue;
    } else if (value === "--out") options.out = next;
    else if (value === "--project-url") options.projectUrl = next;
    else if (value === "--lane") options.lane = next;
    else if (value === "--layout-property") options.layoutProperty = next;
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
  if (options.projectUrl) {
    const projectUrl = new URL(options.projectUrl);
    const baseUrl = new URL(options.baseUrl);
    if (projectUrl.origin !== baseUrl.origin) {
      throw new Error(
        `--project-url origin must match --base-url: ${projectUrl.origin} !== ${baseUrl.origin}`,
      );
    }
    if (!/^\/builder\/[^/]+$/.test(projectUrl.pathname)) {
      throw new Error("--project-url must point to /builder/<project-id>");
    }
    if (options.tiers.length !== 1) {
      throw new Error(
        "--project-url runs require exactly one --tiers value to avoid mutating an existing project across tiers",
      );
    }
  }
  if (options.serveDist && !existsSync(join(options.distDir, "index.html"))) {
    throw new Error(`production dist is unavailable: ${options.distDir}`);
  }
  if (
    !Number.isFinite(options.durationMs) ||
    options.durationMs <= 0 ||
    !Number.isInteger(options.repeats) ||
    options.repeats <= 0 ||
    !["dense", "document-scale", "flow-layout"].includes(options.fixtureProfile) ||
    !["paint", "layout"].includes(options.lane) ||
    !["position", "width", "height", "padding", "gap"].includes(
      options.layoutProperty,
    ) ||
    options.tiers.some((tier) => !Number.isInteger(tier) || tier < 2)
  ) {
    throw new Error("duration, repeats, and tiers must be positive");
  }
  if (
    options.lane === "layout" &&
    !["document-scale", "flow-layout"].includes(options.fixtureProfile)
  ) {
    throw new Error(
      "layout lane requires --fixture-profile document-scale or flow-layout",
    );
  }
  if (
    options.fixtureProfile !== "flow-layout" &&
    options.layoutProperty !== "position"
  ) {
    throw new Error(
      "width/height/padding/gap layout runs require --fixture-profile flow-layout",
    );
  }
  if (
    options.fixtureProfile === "flow-layout" &&
    options.tiers.some((tier) => tier < 5)
  ) {
    throw new Error("flow-layout fixture requires tiers >= 5");
  }
  if (
    options.fixtureProfile === "flow-layout" &&
    options.layoutProperty === "position"
  ) {
    throw new Error(
      "flow-layout fixture supports width/height/padding/gap, not position",
    );
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

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

function summarizeDurations(values) {
  if (values.length === 0) {
    return { count: 0, max: 0, p50: 0, p95: 0, p99: 0 };
  }
  const round = (value) => Number(value.toFixed(3));
  return {
    count: values.length,
    max: round(Math.max(...values)),
    p50: round(percentile(values, 0.5)),
    p95: round(percentile(values, 0.95)),
    p99: round(percentile(values, 0.99)),
  };
}

function summarizeLayoutTrace(events) {
  const functionCalls = events.filter(
    (event) => event.ph === "X" && event.name === "FunctionCall",
  );
  const readDurations = (predicate) =>
    functionCalls
      .filter(predicate)
      .map((event) => Number(event.dur ?? 0) / 1000);
  return {
    previewHandleMessage: summarizeDurations(
      readDurations(
        (event) => event.args?.data?.functionName === "handleMessage",
      ),
    ),
    runtimeApply: summarizeDurations(
      readDurations((event) =>
        String(event.args?.data?.url ?? "").includes(
          "/presentation/editorPresentationRuntime.ts",
        ),
      ),
    ),
    skiaRenderFrame: summarizeDurations(
      readDurations(
        (event) => event.args?.data?.functionName === "renderFrame",
      ),
    ),
  };
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
    ...(runs.some((run) => run.layout)
      ? {
          layout: {
            allSkiaSnapshotsAvailable: runs.every(
              (run) => run.layout?.during?.available === true,
            ),
            allCanvasChangedDuring: runs.every(
              (run) =>
                run.layout?.canvasBefore?.sha256 !==
                run.layout?.canvasDuring?.sha256,
            ),
            allCanvasRestored: runs.every(
              (run) =>
                run.layout?.canvasBefore?.sha256 ===
                run.layout?.canvasRestored?.sha256,
            ),
            allCenterHitsContainTarget: runs.every((run) =>
              run.layout?.during?.centerHitIds?.includes("adr187-target"),
            ),
            allClippedHitWidthsMatchPreview: runs.every(
              (run) =>
                run.layout?.during?.hitBounds?.width ===
                run.layout?.previewGeometry?.clippedWidth,
            ),
            allCommandCountsStable: runs.every(
              (run) =>
                run.layout?.before?.commandCount ===
                  run.layout?.during?.commandCount &&
                run.layout?.before?.commandCount ===
                  run.layout?.restored?.commandCount,
            ),
            allDrawHitBoundsAtomic: runs.every(
              (run) =>
                JSON.stringify(run.layout?.during?.bounds) !==
                  JSON.stringify(run.layout?.before?.bounds) &&
                run.layout?.during?.presentationRevision >
                  run.layout?.before?.presentationRevision &&
                run.layout?.during?.presentationRevision <
                  run.layout?.restored?.presentationRevision,
            ),
            allUnaffectedIdentityStable: runs.every(
              (run) =>
                run.layout?.unrelatedBefore?.boundsIdentity ===
                  run.layout?.unrelatedDuring?.boundsIdentity &&
                run.layout?.unrelatedBefore?.hitBoundsIdentity ===
                  run.layout?.unrelatedDuring?.hitBoundsIdentity &&
                run.layout?.unrelatedBefore?.boundsIdentity ===
                  run.layout?.unrelatedRestored?.boundsIdentity,
            ),
            allAffectedDrawHitGeometryAtomic: runs.every((run) => {
              const bounds = run.layout?.during?.bounds;
              const hitBounds = run.layout?.during?.hitBounds;
              return Boolean(
                bounds &&
                  hitBounds &&
                  bounds.x === hitBounds.x &&
                  bounds.y === hitBounds.y &&
                  bounds.width === hitBounds.width &&
                  bounds.height === hitBounds.height,
              );
            }),
            allTerminalCanonicalHandoff: runs.every((run) => {
              const before = run.layout?.canonicalBefore;
              const during = run.layout?.canonicalDuring;
              const after = run.layout?.canonicalAfter;
              return (
                JSON.stringify(before) === JSON.stringify(during) &&
                JSON.stringify(before) === JSON.stringify(after) &&
                run.layout?.restored?.bounds?.x ===
                  run.layout?.before?.bounds?.x &&
                run.layout?.restored?.bounds?.y ===
                  run.layout?.before?.bounds?.y &&
                run.layout?.restored?.bounds?.width ===
                  run.layout?.before?.bounds?.width &&
                run.layout?.restored?.bounds?.height ===
                  run.layout?.before?.bounds?.height
              );
            }),
            allPreviewSiblingCaptured: runs.every(
              (run) =>
                run.layout?.siblingDuring !== null &&
                run.layout?.previewSiblingRect !== null,
            ),
            medianRawPublishP95Ms: median(
              runs.map((run) =>
                percentile(run.layout?.rawPublishDurationsMs ?? [], 0.95),
              ),
            ),
            medianRuntimeFrameApplyCount: median(
              runs.map((run) => run.layout?.runtimeFrameApplyCount ?? 0),
            ),
            medianRuntimeApplyP95Ms: median(
              runs.map(
                (run) => run.layout?.traceDurations?.runtimeApply.p95 ?? 0,
              ),
            ),
            medianRuntimeApplyP99Ms: median(
              runs.map(
                (run) => run.layout?.traceDurations?.runtimeApply.p99 ?? 0,
              ),
            ),
            medianSkiaRenderFrameP95Ms: median(
              runs.map(
                (run) => run.layout?.traceDurations?.skiaRenderFrame.p95 ?? 0,
              ),
            ),
            medianSkiaRenderFrameP99Ms: median(
              runs.map(
                (run) => run.layout?.traceDurations?.skiaRenderFrame.p99 ?? 0,
              ),
            ),
            medianPreviewHandleP95Ms: median(
              runs.map(
                (run) =>
                  run.layout?.traceDurations?.previewHandleMessage.p95 ?? 0,
              ),
            ),
            medianPreviewHandleP99Ms: median(
              runs.map(
                (run) =>
                  run.layout?.traceDurations?.previewHandleMessage.p99 ?? 0,
              ),
            ),
          },
        }
      : {}),
  };
}

async function createIsolatedProject(page, baseUrl) {
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
  // G6 layout fixture is defined against the 390x844 mobile canvas. Do not
  // inherit the operator's persisted breakpoint (desktop would overlap the
  // system page and change the clipping contract under test).
  await page.evaluate(() => {
    window.localStorage.setItem("builder-breakpoint", "mobile");
  });
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

async function openExistingProject(page, projectUrl) {
  const url = new URL(projectUrl);
  url.searchParams.set("adr187Metrics", "1");
  await page.goto(url.toString(), { waitUntil: "networkidle" });
  // Keep the G6 geometry contract independent of the operator's persisted
  // breakpoint while reusing the already authenticated Builder project.
  await page.evaluate(() => {
    window.localStorage.setItem("builder-breakpoint", "mobile");
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(
    () =>
      Boolean(
        window.__composition_STORE__ &&
          window.__composition_EDITOR_PRESENTATION_PHASE0_METRICS__,
      ),
    undefined,
    { timeout: 30000 },
  );
  return { mode: "existing", projectName: null, projectUrl: page.url() };
}

async function seedTier(
  page,
  tier,
  previousTier,
  fixtureProfile,
  allowExistingProject = false,
) {
  return page.evaluate(
    async ({ targetTier, priorTier, profile, allowExistingProject }) => {
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
      const flowIds = [
        "adr187-flow-parent",
        "adr187-target",
        "adr187-flow-sibling",
      ];
      const existingFlowElements = activeElements.filter((element) =>
        flowIds.includes(element.id),
      );
      const hasFlowFixture = existingFlowElements.length === flowIds.length;
      const shouldSeedFlow =
        profile === "flow-layout" && priorTier === 0 && !hasFlowFixture;
      if (countToAdd < 0 && !(allowExistingProject && shouldSeedFlow)) {
        throw new Error(
          `tier ${targetTier} is smaller than active count ${existingCount}`,
        );
      }
      if (profile === "flow-layout" && priorTier === 0) {
        if (existingFlowElements.length > 0 && !hasFlowFixture) {
          throw new Error(
            `existing flow fixture is incomplete: ${existingFlowElements
              .map((element) => element.id)
              .join(", ")}`,
          );
        }
        if (hasFlowFixture && !allowExistingProject) {
          throw new Error("flow fixture already exists in isolated project");
        }
        if (hasFlowFixture) {
          const hasFiller = activeElements.some(
            (element) => element.id === "adr187-flow-filler-0",
          );
          if (!hasFiller) {
            await state.addComplexElement(
              {
                id: "adr187-flow-filler-0",
                type: "frame",
                parent_id: body.id,
                page_id: currentPageId,
                order_num: 10,
                props: {
                  style: {
                    height: "8px",
                    position: "absolute",
                    top: "2000px",
                    width: "8px",
                  },
                },
              },
              [],
            );
          }
        }
        if (!hasFlowFixture) {
          const flowParent = {
            id: "adr187-flow-parent",
            type: "frame",
            parent_id: body.id,
            page_id: currentPageId,
            order_num: 0,
            props: {
              style: {
                display: "flex",
                flexDirection: "row",
                gap: "8px",
                height: "180px",
                padding: "8px",
                position: "static",
                width: "360px",
              },
            },
          };
          const flowTarget = {
            id: "adr187-target",
            type: "frame",
            parent_id: flowParent.id,
            page_id: currentPageId,
            order_num: 0,
            props: {
              style: {
                height: "60px",
                position: "static",
                width: "100px",
              },
            },
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
          };
          const flowSibling = {
            id: "adr187-flow-sibling",
            type: "frame",
            parent_id: flowParent.id,
            page_id: currentPageId,
            order_num: 1,
            props: {
              style: {
                height: "60px",
                position: "static",
                width: "100px",
              },
            },
          };
          await state.addComplexElement(flowParent, [flowTarget, flowSibling]);
          const afterFlow = store.getState();
          const flowCount = afterFlow.elements.filter(
            (element) => element.page_id === currentPageId,
          ).length;
          const fillerCount = allowExistingProject
            ? Math.max(1, targetTier - flowCount)
            : targetTier - flowCount;
          for (let index = 0; index < fillerCount; index += 1) {
            await afterFlow.addComplexElement(
              {
                id: `adr187-flow-filler-${index}`,
                type: "frame",
                parent_id: body.id,
                page_id: currentPageId,
                order_num: index + 10,
                props: {
                  style: {
                    height: "8px",
                    position: "absolute",
                    top: `${2000 + index * 12}px`,
                    width: "8px",
                  },
                },
              },
              [],
            );
          }
        }
      } else if (countToAdd > 0) {
        const offset = Math.max(priorTier, existingCount);
        const makeBox = (index, id) => {
          const isTarget = index === 0 && priorTier === 0;
          const documentScale = profile === "document-scale";
          const absoluteIndex = offset + index;
          return {
            id,
            // `Box`는 Skia scene 내부 synthetic type이라 canonical Preview DOM fixture로
            // 사용하면 React가 <box> unknown tag warning을 낸다. document-scale profile은
            // 실제 canonical layout primitive인 frame을 사용한다.
            type:
              documentScale || profile === "flow-layout" ? "frame" : "Box",
            parent_id: body.id,
            page_id: currentPageId,
            order_num: offset + index,
            props: {
              style: {
                height: isTarget ? "120px" : "8px",
                left: documentScale ? "20px" : `${absoluteIndex % 100}px`,
                position: "absolute",
                // document-scale은 총 문서 N만 늘리고 가시 draw workload V는 고정한다.
                // dense profile은 기존 ADR-187 baseline 재현을 위해 그대로 보존한다.
                top: documentScale
                  ? isTarget
                    ? "30px"
                    : `${2000 + absoluteIndex * 12}px`
                  : `${Math.floor(absoluteIndex / 100) * 9}px`,
                width: isTarget ? "120px" : "8px",
              },
            },
            ...(isTarget
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
          };
        };
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
      if (!allowExistingProject && nextActiveCount !== targetTier) {
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
    {
      targetTier: tier,
      priorTier: previousTier,
      profile: fixtureProfile,
      allowExistingProject,
    },
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

async function captureCanvasScreenshot(page) {
  const bytes = await page
    .locator('canvas[data-testid="skia-canvas-unified"]')
    .screenshot({ animations: "disabled" });
  return {
    byteLength: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
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

async function runLayoutDrag(
  page,
  cdp,
  options,
  tier,
  repeat,
  traceDir,
  layoutProperty,
) {
  await page.waitForFunction(
    () =>
      Boolean(
        window.__composition_EDITOR_PRESENTATION_DEBUG__ &&
          window.__composition_RENDER_COMMAND_DEBUG__,
      ),
    undefined,
    { timeout: 30000 },
  );
  await page.evaluate(() => {
    window.__composition_EDITOR_PRESENTATION_PHASE0_METRICS__.reset();
    window.__composition_PERF__?.resetLongTasks();
  });

  const canvasBefore = await captureCanvasScreenshot(page);
  const traceEvents = await startTrace(cdp);
  const runStartedAt = Date.now();
  const rawLayout = await page.evaluate(
    async ({ durationMs, runIndex, property }) => {
      const presentation = window.__composition_EDITOR_PRESENTATION_DEBUG__;
      const renderCommands = window.__composition_RENDER_COMMAND_DEBUG__;
      const store = window.__composition_STORE__;
      if (!presentation || !renderCommands || !store) {
        throw new Error("ADR-188 live debug boundary is unavailable");
      }
      const projectId = window.location.pathname
        .split("/")
        .filter(Boolean)
        .at(-1);
      if (!projectId) throw new Error("project id is unavailable");

      const targetId =
        property === "padding" || property === "gap"
          ? "adr187-flow-parent"
          : "adr187-target";
      const siblingId =
        property === "position" ? null : "adr187-flow-sibling";
      const unrelatedId = siblingId
        ? "adr187-flow-filler-0"
        : "adr187-node-2";
      const target = { kind: "canonical-node", nodeId: targetId };
      const currentPageId = store.getState().currentPageId;
      const clipOwnerId = store
        .getState()
        .elements.find(
          (element) =>
            element.page_id === currentPageId && element.type === "body",
        )?.id;
      const before = renderCommands.readNode(targetId);
      const siblingBefore = siblingId
        ? renderCommands.readNode(siblingId)
        : null;
      const unrelatedBefore = renderCommands.readNode(unrelatedId);
      const clipOwnerBefore = clipOwnerId
        ? renderCommands.readNode(clipOwnerId)
        : null;
      const canonicalBefore = store.getState().elementsMap.get(targetId)?.props
        ?.style;
      const diagnosticsBefore = presentation.diagnostics();
      const handle = presentation.begin({
        commitIntent: `layout-${property}`,
        ownerId: `adr188-g6-layout-${runIndex}`,
        projectId,
        targets: [target],
      });

      const rawPublishDurationsMs = [];
      const cadenceMs = 1000 / 120;
      const startedAt = performance.now();
      let lastValue =
        property === "padding" ? 24 : property === "gap" ? 32 : 180;
      let lastPosition = { left: 80, top: 45 };
      let rawPublishCount = 0;
      const finalLeft = Math.max(
        80,
        (clipOwnerBefore?.bounds?.width ?? 800) - 40,
      );
      while (performance.now() - startedAt < durationMs) {
        const progress = Math.min(
          1,
          (performance.now() - startedAt) / durationMs,
        );
        const value =
          property === "position"
            ? {
                left: 80 + Math.round(progress * (finalLeft - 80)),
                top: 45 + Math.round(Math.sin(progress * Math.PI * 4) * 15),
              }
            : {
                [property]:
                  property === "width"
                    ? 100 + Math.round(progress * 80)
                    : property === "height"
                      ? 60 + Math.round(progress * 40)
                      : property === "padding"
                        ? 8 + Math.round(progress * 16)
                        : 8 + Math.round(progress * 24),
              };
        lastValue =
          property === "position"
            ? value.left
            : value[property];
        if (property === "position") lastPosition = value;
        const publishStartedAt = performance.now();
        handle.publish({
          patch:
            property === "position"
              ? value
              : { [property]: lastValue },
          target,
          type: "style.patch",
        });
        rawPublishDurationsMs.push(performance.now() - publishStartedAt);
        rawPublishCount += 1;
        await new Promise((resolvePromise) =>
          setTimeout(resolvePromise, cadenceMs),
        );
      }

      await new Promise((resolvePromise) => {
        let remaining = 4;
        const next = () => {
          remaining -= 1;
          if (remaining <= 0) resolvePromise();
          else requestAnimationFrame(next);
        };
        requestAnimationFrame(next);
      });

      const during = renderCommands.readNode(targetId);
      const siblingDuring = siblingId
        ? renderCommands.readNode(siblingId)
        : null;
      const unrelatedDuring = renderCommands.readNode(unrelatedId);
      const iframe = document.querySelector("iframe#previewFrame");
      const previewTarget = iframe?.contentDocument?.querySelector(
        `[data-canonical-id="${targetId}"]`,
      );
      const previewClipOwner = clipOwnerId
        ? iframe?.contentDocument?.querySelector(
            `[data-canonical-id="${clipOwnerId}"]`,
          )
        : null;
      const previewStyle = previewTarget
        ? {
            gap: getComputedStyle(previewTarget).gap,
            height: getComputedStyle(previewTarget).height,
            left: getComputedStyle(previewTarget).left,
            padding: getComputedStyle(previewTarget).padding,
            top: getComputedStyle(previewTarget).top,
            width: getComputedStyle(previewTarget).width,
          }
        : null;
      const previewSibling = siblingId
        ? iframe?.contentDocument?.querySelector(
            `[data-canonical-id="${siblingId}"]`,
          )
        : null;
      const previewSiblingRect = previewSibling?.getBoundingClientRect();
      const previewTargetRect = previewTarget?.getBoundingClientRect();
      const previewClipOwnerRect = previewClipOwner?.getBoundingClientRect();
      const previewGeometry =
        previewTargetRect && previewClipOwnerRect
          ? {
              clippedHeight: Math.max(
                0,
                Math.min(previewTargetRect.bottom, previewClipOwnerRect.bottom) -
                  Math.max(previewTargetRect.top, previewClipOwnerRect.top),
              ),
              clippedWidth: Math.max(
                0,
                Math.min(previewTargetRect.right, previewClipOwnerRect.right) -
                  Math.max(previewTargetRect.left, previewClipOwnerRect.left),
              ),
              ownerHeight: previewClipOwnerRect.height,
              ownerWidth: previewClipOwnerRect.width,
              targetX: previewTargetRect.x,
              targetY: previewTargetRect.y,
              targetHeight: previewTargetRect.height,
              targetWidth: previewTargetRect.width,
            }
          : null;
      const diagnosticsDuring = presentation.diagnostics();
      const canonicalDuring = store.getState().elementsMap.get(targetId)?.props
        ?.style;
      const phaseMetricsDuring =
        window.__composition_EDITOR_PRESENTATION_PHASE0_METRICS__.snapshot();
      window.__composition_ADR188_G6_ACTIVE_HANDLE__ = handle;

      return {
        before,
        canonicalBefore,
        canonicalDuring,
        clipOwnerBefore,
        during,
        expected:
          property === "position"
            ? lastPosition
            : { property, value: lastValue },
        phaseMetricsDuring,
        previewGeometry,
        previewStyle,
        previewSiblingRect: previewSiblingRect
          ? {
              height: previewSiblingRect.height,
              width: previewSiblingRect.width,
              x: previewSiblingRect.x,
              y: previewSiblingRect.y,
            }
          : null,
        rawPublishCount,
        rawPublishDurationsMs,
        siblingBefore,
        siblingDuring,
        unrelatedBefore,
        unrelatedDuring,
        runtimeFrameApplyCount:
          diagnosticsDuring.frameApplyCount - diagnosticsBefore.frameApplyCount,
      };
    },
    { durationMs: options.durationMs, runIndex: repeat, property: layoutProperty },
  );
  const longTasks = await page.evaluate(
    () => window.__composition_PERF__?.snapshotLongTasks() ?? [],
  );
  const tracePath = resolve(
    traceDir,
    `adr188-layout-n${tier}-run${repeat + 1}.trace.json.gz`,
  );
  const trace = await finishTrace(cdp, traceEvents, tracePath);
  const canvasDuring = await captureCanvasScreenshot(page);
  const terminal = await page.evaluate(async (property) => {
    const handle = window.__composition_ADR188_G6_ACTIVE_HANDLE__;
    const renderCommands = window.__composition_RENDER_COMMAND_DEBUG__;
    const store = window.__composition_STORE__;
    if (!handle || !renderCommands || !store) {
      throw new Error("ADR-188 terminal boundary is unavailable");
    }
    handle.cancel("pointer-cancel");
    delete window.__composition_ADR188_G6_ACTIVE_HANDLE__;
    await new Promise((resolvePromise) => {
      let remaining = 4;
      const next = () => {
        remaining -= 1;
        if (remaining <= 0) resolvePromise();
        else requestAnimationFrame(next);
      };
      requestAnimationFrame(next);
    });
    const targetId =
      property === "padding" || property === "gap"
        ? "adr187-flow-parent"
        : "adr187-target";
    const unrelatedId =
      property !== "position"
        ? "adr187-flow-filler-0"
        : "adr187-node-2";
    const siblingId = property === "position" ? null : "adr187-flow-sibling";
    const iframe = document.querySelector("iframe#previewFrame");
    const previewTarget = iframe?.contentDocument?.querySelector(
      `[data-canonical-id="${targetId}"]`,
    );
    return {
      canonicalAfter: store.getState().elementsMap.get(targetId)?.props?.style,
      phaseMetricsAfterTerminal:
        window.__composition_EDITOR_PRESENTATION_PHASE0_METRICS__.snapshot(),
      previewStyleAfter: previewTarget
        ? {
            gap: getComputedStyle(previewTarget).gap,
            height: getComputedStyle(previewTarget).height,
            left: getComputedStyle(previewTarget).left,
            padding: getComputedStyle(previewTarget).padding,
            top: getComputedStyle(previewTarget).top,
            width: getComputedStyle(previewTarget).width,
          }
        : null,
      restored: renderCommands.readNode(targetId),
      siblingRestored: siblingId
        ? renderCommands.readNode(siblingId)
        : null,
      unrelatedRestored: renderCommands.readNode(unrelatedId),
    };
  }, layoutProperty);
  const canvasRestored = await captureCanvasScreenshot(page);
  const { phaseMetricsDuring: drag, ...layoutDuring } = rawLayout;
  const { phaseMetricsAfterTerminal: afterTerminal, ...terminalLayout } =
    terminal;
  const layout = {
    ...layoutDuring,
    ...terminalLayout,
    canvasBefore,
    canvasDuring,
    canvasRestored,
  };
  layout.traceDurations = summarizeLayoutTrace(traceEvents);

  return {
    afterTerminal,
    actualDragDurationMs: Date.now() - runStartedAt,
    drag,
    layout,
    longTasks,
    rawMoveCount: layout.rawPublishCount,
    runWallTimeMs: Date.now() - runStartedAt,
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
  if (options.serveDist) {
    const benchmarkOrigin = new URL(options.baseUrl).origin;
    const hasBenchmarkOrigin = storageState.origins?.some(
      (entry) => entry.origin === benchmarkOrigin,
    );
    if (!hasBenchmarkOrigin) {
      const authenticatedOrigin = storageState.origins?.find((entry) =>
        entry.localStorage?.some(
          (item) => item.name === "composition-auth-prod",
        ),
      );
      if (authenticatedOrigin) {
        storageState.origins.push({
          origin: benchmarkOrigin,
          localStorage: authenticatedOrigin.localStorage.map((entry) => ({
            ...entry,
          })),
        });
      }
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

    const project = options.projectUrl
      ? await openExistingProject(page, options.projectUrl)
      : await createIsolatedProject(page, options.baseUrl);
    const tiers = [];
    let previousTier = 0;
    for (const tier of options.tiers) {
      const seed = await seedTier(
        page,
        tier,
        previousTier,
        options.fixtureProfile,
        Boolean(options.projectUrl),
      );
      previousTier = tier;
      await page.waitForTimeout(tier >= 5000 ? 5000 : 2000);
      await waitForSettledFrames(page);
      const productPreview = await enableSplitPreview(page);
      if (options.lane === "paint") await openColorArea(page);
      const runs = [];
      for (let repeat = 0; repeat < options.repeats; repeat += 1) {
        runs.push(
          options.lane === "layout"
            ? await runLayoutDrag(
                page,
                cdp,
              options,
              tier,
              repeat,
              options.traceDir,
              options.layoutProperty,
            )
            : await runDrag(
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
        fixtureProfile: options.fixtureProfile,
        headless: !options.headed,
        lane: options.lane,
        layoutProperty: options.layoutProperty,
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
