#!/usr/bin/env node
// ADR-248 G0: old public updateNode values through document, IDB and refresh.
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
const inventory = JSON.parse(
  readFileSync(
    resolve(root, "docs/adr/design/248-baseline/inventory.json"),
    "utf8",
  ),
);
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (head !== inventory.baselineHead)
  throw new Error("Old node field baseline uses another HEAD");
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out requires path");
const out = resolve(process.argv[outIndex + 1]);
mkdirSync(out, { recursive: true });
const nodeId = "adr248-node-fields";
const patch = {
  name: "Field sample",
  fills: [
    {
      id: "fill-one",
      enabled: true,
      opacity: 1,
      blendMode: "normal",
      type: "color",
      color: "#ff0000ff",
    },
  ],
  responsive: { visibility: { mobile: false } },
  enabled: true,
  sizing: { width: { factor: 1 } },
  metadata: { type: "legacy-element-props", note: "field-sample" },
  slot: false,
  theme: { mode: "dark", tint: "blue" },
};
const scenario = {
  id: "adr248-old-node-fields-v1",
  seed: 248,
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  theme: "default-light",
  font: "app-default",
  operations: [
    {
      op: "insert",
      id: "node",
      component: "Text",
      parent: "page",
      text: "필드",
    },
    { op: "updateNode", id: "node", fields: Object.keys(patch).sort() },
    { op: "refresh" },
  ],
  expectedRelations: [["node", "page"]],
};
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const baseUrl = process.env.BUILDER_URL ?? "http://localhost:5173";
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
      async ({ nodeId }) => {
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
            type: "Text",
            parent_id: body.id,
            page_id: state.currentPageId,
            order_num: 0,
            created_at: now,
            updated_at: now,
            props: {
              children: "필드",
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
      { nodeId },
    );
    const readCanonical = () =>
      page.evaluate(
        ({ projectId, nodeId }) => {
          const doc = window.__canonical_STORE__
            .getState()
            .getDocument(projectId);
          const find = (nodes) => {
            for (const node of nodes) {
              if (node.id === nodeId) return node;
              const child = find(node.children ?? []);
              if (child) return child;
            }
            return null;
          };
          const node = find(doc.children);
          if (!node) throw new Error("Old node not found");
          return Object.fromEntries(
            [
              "name",
              "fills",
              "responsive",
              "enabled",
              "sizing",
              "metadata",
              "slot",
              "theme",
            ].map((key) => [key, node[key] ?? null]),
          );
        },
        { projectId, nodeId },
      );
    const readPersisted = () =>
      page.evaluate(
        async ({ projectId, nodeId }) => {
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
                .get([projectId, `node:${nodeId}`]);
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error);
            });
            const node = part ? JSON.parse(part.value) : null;
            return node
              ? Object.fromEntries(
                  [
                    "name",
                    "fills",
                    "responsive",
                    "enabled",
                    "sizing",
                    "metadata",
                    "slot",
                    "theme",
                  ].map((key) => [key, node[key] ?? null]),
                )
              : null;
          } finally {
            db.close();
          }
        },
        { projectId, nodeId },
      );
    const beforeRaw = await readCanonical();
    const before = {
      ...beforeRaw,
      metadata: beforeRaw.metadata
        ? {
            type: beforeRaw.metadata.type,
            customId: beforeRaw.metadata.customId,
            hasSourceParentId: Boolean(beforeRaw.metadata.sourceParentId),
          }
        : null,
    };
    await page.evaluate(
      ({ nodeId, patch }) =>
        window.__canonical_STORE__.getState().updateNode(nodeId, patch),
      { nodeId, patch },
    );
    const after = await readCanonical();
    if (JSON.stringify(after) !== JSON.stringify(patch))
      throw new Error(
        `Old updateNode changed values: ${JSON.stringify(after)}`,
      );
    await page.waitForFunction(
      async ({ projectId, nodeId }) => {
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
              .get([projectId, `node:${nodeId}`]);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          return part && JSON.parse(part.value).name === "Field sample";
        } finally {
          db.close();
        }
      },
      { projectId, nodeId },
      { timeout: 20_000 },
    );
    const persisted = await readPersisted();
    if (JSON.stringify(persisted) !== JSON.stringify(patch))
      throw new Error("Old updateNode IDB values changed");
    await page
      .locator('[data-testid="skia-canvas-unified"]')
      .waitFor({ state: "visible" });
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
    const refreshed = await readCanonical();
    if (JSON.stringify(refreshed) !== JSON.stringify(patch))
      throw new Error("Old updateNode refresh values changed");
    const refreshedPng = await page.screenshot({
      ...screenshotOptions,
      path: resolve(out, "after-refresh.png"),
    });
    if (sha256(afterPng) !== sha256(refreshedPng))
      throw new Error("Old node field Canvas changed after refresh");
    if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
    const report = {
      head,
      runtime: "old Builder dev",
      scenarioHash: sha256(JSON.stringify(scenario)),
      scenario,
      input: patch,
      before,
      after,
      persisted,
      refreshed,
      screenshots: {
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
    process.stdout.write(
      `${out}/baseline.json: 8 node fields survived IDB refresh\n`,
    );
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
