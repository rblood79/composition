#!/usr/bin/env node
// ADR-248 G0: old page-layout/placement/guide values through public canonical actions.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
  loadStorageState,
  waitReady,
} from "./perf-baseline.mjs";

const root = resolve(import.meta.dirname, "../../..");
const baselineDir = resolve(root, "docs/adr/design/248-baseline");
const inventory = JSON.parse(
  readFileSync(resolve(baselineDir, "inventory.json"), "utf8"),
);
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (head !== inventory.baselineHead)
  throw new Error("Page authoring baseline uses another HEAD");
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out requires path");
const out = resolve(process.argv[outIndex + 1]);
mkdirSync(out, { recursive: true });
const baseUrl = process.env.BUILDER_URL ?? "http://localhost:5173";
const scenario = {
  id: "adr248-old-page-authoring-v1",
  seed: 248,
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  theme: "default-light",
  font: "app-default",
  operations: [
    { op: "createNewProject" },
    { op: "setPageLayout", direction: "horizontal", gap: 96, columns: 2 },
    {
      op: "setPagePlacement",
      page: "page",
      style: { position: "absolute", left: 48, top: 64 },
    },
    {
      op: "setPageGuides",
      page: "page",
      breakpoint: "desktop",
      guides: [{ id: "guide-x", axis: "x", position: 120 }],
    },
    { op: "refresh" },
  ],
  expectedRelations: [["guide-x", "page"]],
};
const scenarioHash = createHash("sha256")
  .update(JSON.stringify(scenario))
  .digest("hex");
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const { context, page, errors } = await createInstrumentedContext(browser, {
    storageState: loadStorageState(
      resolve(root, "apps/builder/scripts/.auth-session.json"),
      baseUrl,
    ),
    frameCapture: false,
    deviceScaleFactor: scenario.dpr,
  });
  try {
    await createIsolatedProject(page, baseUrl);
    const projectId = new URL(page.url()).pathname.split("/").pop();
    const pageId = await page.evaluate(
      () => window.__composition_STORE__.getState().currentPageId,
    );
    if (!pageId) throw new Error("Current page missing");
    const readDocumentValues = () =>
      page.evaluate(
        ({ projectId, pageId }) => {
          const doc = window.__canonical_STORE__
            ?.getState()
            ?.getDocument?.(projectId);
          if (!doc) throw new Error("Old canonical document unavailable");
          return {
            direction: doc.pageLayout?.direction ?? null,
            gap: doc.pageLayout?.gap ?? null,
            columns: doc.pageLayout?.columns ?? null,
            placement: doc.pageLayout?.placements?.[pageId] ?? null,
            guides: doc.pageGuides?.[pageId]?.desktop ?? null,
          };
        },
        { projectId, pageId },
      );
    const readPersistedValues = () =>
      page.evaluate(
        async ({ projectId, pageId }) => {
          const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open("composition");
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          try {
            const tx = db.transaction(
              ["document_heads", "document_parts"],
              "readonly",
            );
            const get = (request) =>
              new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
              });
            const [head, part] = await Promise.all([
              get(tx.objectStore("document_heads").get(projectId)),
              get(
                tx.objectStore("document_parts").get([projectId, "document"]),
              ),
            ]);
            const doc = part ? JSON.parse(part.value) : null;
            return {
              hasRevision: Boolean(head?.revision),
              direction: doc?.pageLayout?.direction ?? null,
              gap: doc?.pageLayout?.gap ?? null,
              columns: doc?.pageLayout?.columns ?? null,
              placement: doc?.pageLayout?.placements?.[pageId] ?? null,
              guides: doc?.pageGuides?.[pageId]?.desktop ?? null,
            };
          } finally {
            db.close();
          }
        },
        { projectId, pageId },
      );
    const before = await readDocumentValues();
    await page.evaluate(
      ({ pageId }) => {
        const store = window.__canonical_STORE__.getState();
        store.setPageLayout({ direction: "horizontal", gap: 96, columns: 2 });
        store.setPagePlacements([
          {
            pageId,
            placement: { style: { position: "absolute", left: 48, top: 64 } },
          },
        ]);
        store.setPageGuides([
          {
            pageId,
            breakpoint: "desktop",
            guides: [{ id: "guide-x", axis: "x", position: 120 }],
          },
        ]);
      },
      { pageId },
    );
    const expected = (value) =>
      value.direction === "horizontal" &&
      value.gap === 96 &&
      value.columns === 2 &&
      value.placement?.style?.position === "absolute" &&
      value.placement?.style?.left === 48 &&
      value.placement?.style?.top === 64 &&
      value.guides?.length === 1 &&
      value.guides[0].id === "guide-x" &&
      value.guides[0].axis === "x" &&
      value.guides[0].position === 120;
    const after = await readDocumentValues();
    if (!expected(after))
      throw new Error(`Old page authoring failed: ${JSON.stringify(after)}`);
    await page.waitForFunction(
      async ({ projectId, pageId }) => {
        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open("composition");
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        try {
          const tx = db.transaction("document_parts", "readonly");
          const part = await new Promise((resolve, reject) => {
            const request = tx
              .objectStore("document_parts")
              .get([projectId, "document"]);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          const doc = part ? JSON.parse(part.value) : null;
          return (
            doc?.pageLayout?.direction === "horizontal" &&
            doc?.pageLayout?.placements?.[pageId]?.style?.left === 48 &&
            doc?.pageGuides?.[pageId]?.desktop?.[0]?.position === 120
          );
        } finally {
          db.close();
        }
      },
      { projectId, pageId },
      { timeout: 20_000 },
    );
    const persisted = await readPersistedValues();
    if (!persisted.hasRevision || !expected(persisted))
      throw new Error(
        `Old page IDB value failed: ${JSON.stringify(persisted)}`,
      );
    const canvas = page.locator('[data-testid="skia-canvas-unified"]');
    await canvas.waitFor({ state: "visible" });
    const screenshotOptions = {
      animations: "disabled",
      clip: { x: 100, y: 100, width: 620, height: 400 },
    };
    const afterPng = await page.screenshot({
      ...screenshotOptions,
      path: resolve(out, "after.png"),
    });
    await page.reload({ waitUntil: "networkidle" });
    await waitReady(page, { settleMs: 0 });
    const refreshed = await readDocumentValues();
    if (!expected(refreshed))
      throw new Error(`Old page refresh failed: ${JSON.stringify(refreshed)}`);
    await page.locator('[data-testid="skia-canvas-unified"]').waitFor({
      state: "visible",
    });
    const refreshedPng = await page.screenshot({
      ...screenshotOptions,
      path: resolve(out, "after-refresh.png"),
    });
    const sha256 = (value) => createHash("sha256").update(value).digest("hex");
    if (sha256(afterPng) !== sha256(refreshedPng))
      throw new Error("Old page authoring Canvas changed after refresh");
    const report = {
      head,
      runtime: "old Builder dev",
      scenarioHash,
      scenario,
      fontState: await page.evaluate(() => ({
        bodyFamily: getComputedStyle(document.body).fontFamily,
        loadStatus: document.fonts.status,
      })),
      before,
      after,
      persisted,
      refreshed,
      semanticTree: [
        {
          id: "page",
          type: "page",
          guides: refreshed.guides.map((guide) => guide.id),
        },
      ],
      screenshots: {
        after: { path: "after.png", sha256: sha256(afterPng) },
        afterRefresh: {
          path: "after-refresh.png",
          sha256: sha256(refreshedPng),
        },
      },
      errors,
    };
    if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
    writeFileSync(
      resolve(out, "baseline.json"),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    process.stdout.write(
      `${out}/baseline.json: page layout, placement and guide survived IDB refresh\n`,
    );
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
