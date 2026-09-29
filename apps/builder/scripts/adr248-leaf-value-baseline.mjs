#!/usr/bin/env node
// ADR-248 G0: old Builder leaf edit value through command, document, IDB and refresh.
// The scenario contains semantic operations only; old document records are output oracles.
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
const manifest = JSON.parse(
  readFileSync(resolve(baselineDir, "coverage-manifest.json"), "utf8"),
);
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (head !== manifest.source.baselineHead)
  throw new Error("G0 leaf baseline HEAD differs from the frozen old Builder");

const outputIndex = process.argv.indexOf("--out");
if (outputIndex >= 0 && !process.argv[outputIndex + 1])
  throw new Error("--out requires path");
const out = resolve(
  outputIndex >= 0
    ? process.argv[outputIndex + 1]
    : "/private/tmp/adr248-leaf-value",
);
const baseUrl = process.env.BUILDER_URL ?? "http://localhost:5173";
const scenario = {
  id: "adr248-old-leaf-value-v1",
  seed: 248,
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  theme: "default-light",
  font: "app-default",
  operations: [
    {
      op: "insert",
      id: "leaf",
      component: "Text",
      parent: "page",
      text: "초안",
    },
    { op: "setText", id: "leaf", text: "확정" },
    { op: "refresh" },
  ],
  expectedRelations: [["leaf", "page"]],
};
const scenarioHash = createHash("sha256")
  .update(JSON.stringify(scenario))
  .digest("hex");
const nodeId = "adr248-leaf-value";
const initialText = scenario.operations[0].text;
const finalText = scenario.operations[1].text;
mkdirSync(out, { recursive: true });

async function readPersistedLeaf(page, projectId) {
  return page.evaluate(
    async ({ projectId, nodeId }) => {
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
            tx.objectStore("document_parts").get([projectId, `node:${nodeId}`]),
          ),
        ]);
        const node = part ? JSON.parse(part.value) : null;
        return {
          revision: head?.revision ?? null,
          nodeId: node?.id ?? null,
          nodeType: node?.type ?? null,
          nodeText: node?.props?.children ?? null,
        };
      } finally {
        db.close();
      }
    },
    { projectId, nodeId },
  );
}

async function waitForPersistedText(
  page,
  projectId,
  expected,
  priorRevision = null,
) {
  let observed;
  await page.waitForFunction(
    async ({ projectId, nodeId, expected, priorRevision }) => {
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
            tx.objectStore("document_parts").get([projectId, `node:${nodeId}`]),
          ),
        ]);
        return Boolean(
          head?.revision &&
          head.revision !== priorRevision &&
          part &&
          JSON.parse(part.value).props?.children === expected,
        );
      } finally {
        db.close();
      }
    },
    { projectId, nodeId, expected, priorRevision },
    { timeout: 20_000 },
  );
  observed = await readPersistedLeaf(page, projectId);
  if (
    observed.nodeId !== nodeId ||
    observed.nodeType !== "Text" ||
    observed.nodeText !== expected ||
    observed.revision === priorRevision
  )
    throw new Error(`Persisted leaf mismatch: ${JSON.stringify(observed)}`);
  return observed;
}

async function readLeaf(page, projectId) {
  return page.evaluate(
    ({ projectId, nodeId }) => {
      const doc = window.__canonical_STORE__
        ?.getState()
        ?.getDocument?.(projectId);
      if (!doc) throw new Error("Old canonical document unavailable");
      const find = (nodes) => {
        for (const node of nodes ?? []) {
          if (node.id === nodeId) return node;
          const nested = find(node.children);
          if (nested) return nested;
        }
        return null;
      };
      const node = find(doc.children);
      const element = window.__composition_STORE__
        .getState()
        .elements.find((item) => item.id === nodeId);
      const layout = window.__composition_LAYOUT_DEBUG__
        ?.getSharedLayoutMap?.()
        ?.get(nodeId);
      return {
        canonical: node
          ? { id: node.id, type: node.type, text: node.props?.children ?? null }
          : null,
        element: element
          ? {
              id: element.id,
              type: element.type,
              parentIsPageBody:
                element.parent_id ===
                window.__composition_STORE__
                  .getState()
                  .elements.find(
                    (item) =>
                      item.type === "body" &&
                      item.page_id ===
                        window.__composition_STORE__.getState().currentPageId,
                  )?.id,
              text: element.props?.children ?? null,
            }
          : null,
        layout: layout
          ? {
              x: layout.x,
              y: layout.y,
              width: layout.width,
              height: layout.height,
            }
          : null,
      };
    },
    { projectId, nodeId },
  );
}

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
    await page.evaluate(
      async ({ nodeId, text }) => {
        const state = window.__composition_STORE__.getState();
        const body = state.elements.find(
          (item) =>
            item.type === "body" && item.page_id === state.currentPageId,
        );
        if (!body) throw new Error("Page body missing");
        const now = new Date().toISOString();
        await state.addComplexElement(
          {
            id: nodeId,
            customId: "leaf",
            type: "Text",
            parent_id: body.id,
            page_id: state.currentPageId,
            order_num: 0,
            created_at: now,
            updated_at: now,
            props: {
              children: text,
              style: {
                position: "absolute",
                left: "100px",
                top: "80px",
                width: "240px",
                height: "60px",
                fontSize: "32px",
              },
            },
          },
          [],
        );
      },
      { nodeId, text: initialText },
    );
    await page.evaluate(() =>
      window.__composition_APPLY_VIEWPORT__?.({ scale: 1, x: 100, y: 100 }),
    );
    const persistedBefore = await waitForPersistedText(
      page,
      projectId,
      initialText,
    );
    const before = await readLeaf(page, projectId);
    if (
      before.canonical?.text !== initialText ||
      before.element?.text !== initialText ||
      !before.element.parentIsPageBody ||
      !before.layout
    )
      throw new Error(`Old leaf creation failed: ${JSON.stringify(before)}`);
    const canvas = page.locator('[data-testid="skia-canvas-unified"]');
    await canvas.waitFor({ state: "visible" });
    const beforePng = await page.screenshot({
      path: resolve(out, "before.png"),
      animations: "disabled",
      clip: { x: 100, y: 100, width: 620, height: 400 },
    });
    await page.evaluate(
      async ({ nodeId, text }) => {
        await window.__composition_STORE__
          .getState()
          .updateElementProps(nodeId, {
            children: text,
          });
      },
      { nodeId, text: finalText },
    );
    const persistedAfter = await waitForPersistedText(
      page,
      projectId,
      finalText,
      persistedBefore.revision,
    );
    const after = await readLeaf(page, projectId);
    if (
      after.canonical?.text !== finalText ||
      after.element?.text !== finalText
    )
      throw new Error(`Old leaf edit failed: ${JSON.stringify(after)}`);
    const afterPng = await page.screenshot({
      path: resolve(out, "after.png"),
      animations: "disabled",
      clip: { x: 100, y: 100, width: 620, height: 400 },
    });
    await page.reload({ waitUntil: "networkidle" });
    await waitReady(page, { settleMs: 0 });
    await page.evaluate(() =>
      window.__composition_APPLY_VIEWPORT__?.({ scale: 1, x: 100, y: 100 }),
    );
    const refreshed = await readLeaf(page, projectId);
    const persistedRefreshed = await readPersistedLeaf(page, projectId);
    if (
      refreshed.canonical?.text !== finalText ||
      refreshed.element?.text !== finalText ||
      !refreshed.element?.parentIsPageBody ||
      persistedRefreshed.nodeText !== finalText ||
      persistedRefreshed.nodeId !== nodeId ||
      persistedRefreshed.nodeType !== "Text" ||
      !refreshed.layout
    )
      throw new Error(`Old leaf refresh failed: ${JSON.stringify(refreshed)}`);
    const refreshedPng = await page.screenshot({
      path: resolve(out, "after-refresh.png"),
      animations: "disabled",
      clip: { x: 100, y: 100, width: 620, height: 400 },
    });
    const sha256 = (value) => createHash("sha256").update(value).digest("hex");
    if (sha256(beforePng) === sha256(afterPng))
      throw new Error("Old Text leaf edit did not change the Canvas capture");
    if (sha256(afterPng) !== sha256(refreshedPng))
      throw new Error("Old Text leaf capture changed after refresh");
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
      refreshed,
      semanticTree: [
        { id: "leaf", type: refreshed.element.type, parent: "page" },
      ],
      persisted: {
        nodeId: persistedRefreshed.nodeId,
        nodeType: persistedRefreshed.nodeType,
        beforeText: persistedBefore.nodeText,
        afterText: persistedAfter.nodeText,
        afterRefreshText: persistedRefreshed.nodeText,
        revisionChangedOnEdit:
          persistedBefore.revision !== persistedAfter.revision,
      },
      screenshots: {
        before: { path: "before.png", sha256: sha256(beforePng) },
        after: { path: "after.png", sha256: sha256(afterPng) },
        afterRefresh: {
          path: "after-refresh.png",
          sha256: sha256(refreshedPng),
        },
      },
      errors,
    };
    writeFileSync(
      resolve(out, "baseline.json"),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
    process.stdout.write(
      `${out}/baseline.json: old leaf value and refresh verified\n`,
    );
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
