#!/usr/bin/env node
// ADR-248 Phase 0: old Header export/import, OPFS directory link and project switch.
import assert from "node:assert/strict";
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
assert.equal(head, inventory.baselineHead);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sourcePaths = execFileSync(
  "git",
  [
    "ls-files",
    "-z",
    "apps/builder/src",
    "packages/shared/src",
    "packages/specs/src",
    "packages/engine/src",
  ],
  { cwd: root },
)
  .toString()
  .split("\0")
  .filter(Boolean);
const sourceDigest = createHash("sha256");
for (const path of sourcePaths)
  sourceDigest
    .update(path)
    .update("\0")
    .update(readFileSync(resolve(root, path)))
    .update("\0");
const scenario = {
  id: "adr248-old-storage-public-surfaces-v1",
  seed: 248,
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  theme: "default-light",
  font: "app-default",
  operations: [
    { op: "createProject", id: "first" },
    { op: "insertText", id: "saved-text", value: "Before export" },
    { op: "connectFolder", location: "isolated-OPFS" },
    { op: "exportProject", format: "v2-zip" },
    { op: "editText", id: "saved-text", value: "After export" },
    { op: "importProject", format: "v2-zip", source: "own-export" },
    { op: "refresh" },
    { op: "createProject", id: "second" },
    { op: "switchProject", id: "first" },
  ],
  expectedRelations: [["saved-text", "first"]],
};
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out path required");
const out = resolve(process.argv[outIndex + 1]);
mkdirSync(out, { recursive: true });
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
    await page.setViewportSize(scenario.viewport);
    await createIsolatedProject(page, baseUrl);
    const firstUrl = page.url();
    const projectId = new URL(firstUrl).pathname.split("/").pop();
    const servedIndexSha256 = sha256(
      await (await page.request.get(baseUrl)).body(),
    );
    const readValue = () =>
      page.evaluate(
        async ({ projectId }) => {
          const doc = window.__canonical_STORE__
            .getState()
            .getDocument(projectId);
          const find = (nodes, id) => {
            for (const node of nodes ?? []) {
              if (node.id === id) return node;
              const nested = find(node.children, id);
              if (nested) return nested;
            }
            return null;
          };
          const node = find(doc?.children, "adr248-saved-text");
          const db = await new Promise((resolve, reject) => {
            const req = indexedDB.open("composition");
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          try {
            const part = await new Promise((resolve, reject) => {
              const req = db
                .transaction("document_parts", "readonly")
                .objectStore("document_parts")
                .get([projectId, "node:adr248-saved-text"]);
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => reject(req.error);
            });
            return {
              memory: node?.props?.children ?? null,
              persisted: part
                ? (JSON.parse(part.value).props?.children ?? null)
                : null,
            };
          } finally {
            db.close();
          }
        },
        { projectId },
      );
    await page.evaluate(async () => {
      const state = window.__composition_STORE__.getState();
      const body = state.elements.find(
        (item) => item.type === "body" && item.page_id === state.currentPageId,
      );
      if (!body) throw new Error("Page body missing");
      const now = new Date().toISOString();
      await state.addElement({
        id: "adr248-saved-text",
        type: "Text",
        parent_id: body.id,
        page_id: state.currentPageId,
        created_at: now,
        updated_at: now,
        props: {
          children: "Before export",
          style: {
            position: "absolute",
            left: "100px",
            top: "100px",
            width: "220px",
            height: "50px",
          },
        },
      });
    });
    await page.waitForFunction(
      async ({ projectId }) => {
        const db = await new Promise((resolve, reject) => {
          const req = indexedDB.open("composition");
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        try {
          const part = await new Promise((resolve, reject) => {
            const req = db
              .transaction("document_parts", "readonly")
              .objectStore("document_parts")
              .get([projectId, "node:adr248-saved-text"]);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          return (
            part && JSON.parse(part.value).props?.children === "Before export"
          );
        } finally {
          db.close();
        }
      },
      { projectId },
      { timeout: 20_000 },
    );
    const before = await readValue();
    assert.deepEqual(before, {
      memory: "Before export",
      persisted: "Before export",
    });
    const folder = await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle("adr248-g0-storage", {
        create: true,
      });
      const connected = await window.__composition_CONNECT_FOLDER__(dir);
      const manifest = await (
        await dir.getFileHandle("manifest.json")
      ).getFile();
      const parsed = JSON.parse(await manifest.text());
      return {
        status: connected.status,
        revision: parsed.revision,
        partKeys: Object.keys(parsed.parts ?? {}).sort(),
      };
    });
    const menu = page.locator(".header-menu-button");
    await menu.click();
    const exportItem = page
      .locator(".header-menu-item")
      .filter({ hasText: /^Export$/ });
    const downloadPromise = page.waitForEvent("download", { timeout: 20_000 });
    await exportItem.click();
    const download = await downloadPromise;
    const zipPath = resolve(out, "old-export.composition.zip");
    await download.saveAs(zipPath);
    const zipBytes = readFileSync(zipPath);
    const exported = {
      filename: download.suggestedFilename(),
      bytes: zipBytes.length,
      sha256: sha256(zipBytes),
    };
    assert.ok(exported.bytes > 0);
    await page.evaluate(async () =>
      window.__composition_STORE__
        .getState()
        .updateElementProps("adr248-saved-text", { children: "After export" }),
    );
    await page.waitForFunction(() => {
      const projectId = window.__canonical_STORE__.getState().currentProjectId;
      const doc = window.__canonical_STORE__.getState().getDocument(projectId);
      return JSON.stringify(doc).includes("After export");
    });
    const afterEdit = await readValue();
    assert.equal(afterEdit.memory, "After export");
    await page
      .locator('input[type="file"][accept*=".zip"]')
      .setInputFiles(zipPath);
    await page.waitForFunction(
      () => {
        const projectId =
          window.__canonical_STORE__.getState().currentProjectId;
        const doc = window.__canonical_STORE__
          .getState()
          .getDocument(projectId);
        return (
          JSON.stringify(doc).includes("Before export") &&
          !JSON.stringify(doc).includes("After export")
        );
      },
      { timeout: 20_000 },
    );
    const imported = await readValue();
    assert.equal(imported.memory, "Before export");
    await page.reload({ waitUntil: "networkidle" });
    await waitReady(page, { settleMs: 0 });
    const refreshed = await readValue();
    assert.deepEqual(refreshed, before);
    await createIsolatedProject(page, baseUrl);
    const secondProjectId = new URL(page.url()).pathname.split("/").pop();
    assert.notEqual(secondProjectId, projectId);
    await page.goto(firstUrl, { waitUntil: "networkidle" });
    await waitReady(page, { settleMs: 0 });
    const switchedBack = await readValue();
    assert.deepEqual(switchedBack, before);
    const environment = await page.evaluate(async () => ({
      viewport: { width: innerWidth, height: innerHeight },
      dpr: devicePixelRatio,
      theme: document.documentElement.dataset.theme ?? "default-light",
      font: getComputedStyle(document.body).fontFamily,
      fontLoadStatus: await document.fonts.ready.then(
        () => document.fonts.status,
      ),
    }));
    const report = {
      head,
      executionBuildIdentity: `dev-source:${sourceDigest.digest("hex")}:index:${servedIndexSha256}`,
      buildIndexSha256: sha256(
        readFileSync(resolve(root, "apps/builder/dist/index.html")),
      ),
      scenario,
      scenarioHash: sha256(JSON.stringify(scenario)),
      runtimeEnvironment: environment,
      oldOutput: {
        before,
        folder,
        exported,
        afterEdit,
        imported,
        refreshed,
        switchedBack,
      },
      errors,
    };
    writeFileSync(
      resolve(out, "baseline.json"),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    process.stdout.write(
      JSON.stringify({ output: report.oldOutput, errors }) + "\n",
    );
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
