#!/usr/bin/env node
// ADR-248 G0: old public component insertion and authored axis/state combinations.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createInstrumentedContext, createIsolatedProject, loadStorageState } from "./perf-baseline.mjs";

const root = resolve(import.meta.dirname, "../../..");
const baselineDir = resolve(root, "docs/adr/design/248-baseline");
const inventory = JSON.parse(readFileSync(resolve(baselineDir, "inventory.json"), "utf8"));
const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
assert.equal(head, inventory.baselineHead);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sourcePaths = execFileSync("git", ["ls-files", "-z", "apps/builder/src", "packages/shared/src", "packages/specs/src", "packages/engine/src"], { cwd: root })
  .toString().split("\0").filter(Boolean);
const sourceDigest = createHash("sha256");
for (const path of sourcePaths) sourceDigest.update(path).update("\0").update(readFileSync(resolve(root, path))).update("\0");
const cases = [
  { semanticId: "button-combo", type: "Button", ref: "component-button", props: { variant: "premium", size: "lg" } },
  { semanticId: "toggle-selected", type: "ToggleButton", ref: "component-togglebutton", props: { variant: "accent", size: "lg", isSelected: true } },
  { semanticId: "toggle-disabled", type: "ToggleButton", ref: "component-togglebutton", props: { variant: "accent", size: "lg", isSelected: false, isDisabled: true } },
  { semanticId: "date-picker", type: "DatePicker", ref: "component-datepicker", props: {} },
  { semanticId: "chart", type: "Chart", ref: "component-chart", props: {} },
  { semanticId: "table", type: "Table", ref: "component-table", props: {} },
];
const scenario = {
  id: "adr248-old-visual-combinations-v1", seed: 248,
  viewport: { width: 1440, height: 900 }, dpr: 1, theme: "default-light", font: "app-default",
  operations: [{ op: "setViewport", scale: 0.8, x: 300, y: 180 }, ...cases.map((item) => ({ op: "insertRefEditCaptureRemove", ...item, parent: "page-body", style: { x: 30, y: 30, width: 250, height: 170 } }))],
};
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1]) throw new Error("--out path required");
const out = resolve(process.argv[outIndex + 1]);
mkdirSync(resolve(out, "canvas"), { recursive: true });
const baseUrl = process.env.BUILDER_URL ?? "http://localhost:5173";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const { context, page, errors } = await createInstrumentedContext(browser, {
    storageState: loadStorageState(resolve(root, "apps/builder/scripts/.auth-session.json"), baseUrl),
    frameCapture: false, deviceScaleFactor: scenario.dpr,
  });
  try {
    await page.setViewportSize(scenario.viewport);
    await createIsolatedProject(page, baseUrl);
    const servedIndexSha256 = sha256(await (await page.request.get(baseUrl)).body());
    await page.evaluate(() => window.__composition_APPLY_VIEWPORT__?.({ scale: 0.8, x: 300, y: 180 }));
    const rows = [];
    for (const item of cases) {
      const observed = await page.evaluate(async (item) => {
        const state = window.__composition_STORE__.getState();
        const body = state.elements.find((entry) => entry.type === "body" && entry.page_id === state.currentPageId);
        const projectId = window.__canonical_STORE__.getState().currentProjectId;
        const origin = state.elements.find((entry) => entry.id === item.ref);
        if (!body || !origin) throw new Error(`${item.semanticId}: page body/origin unavailable`);
        const id = `adr248-visual-${item.semanticId}`;
        const now = new Date().toISOString();
        await state.addElement({
          id, type: "ref", ref: item.ref, componentName: item.type,
          parent_id: body.id, page_id: state.currentPageId, created_at: now, updated_at: now,
          props: { ...item.props, style: { position: "absolute", left: "30px", top: "30px", width: "250px", height: "170px" } },
        });
        const doc = window.__canonical_STORE__.getState().getDocument(projectId);
        const find = (nodes, id) => {
          for (const node of nodes ?? []) { if (node.id === id) return node; const nested = find(node.children, id); if (nested) return nested; }
          return null;
        };
        const authored = find(doc.children, id);
        const { resolveCanonicalDocument } = await import("/src/resolvers/canonical/index.ts");
        const resolved = find(resolveCanonicalDocument(doc), id);
        return {
          id, status: authored ? "AUTHORED" : "REJECTED_BY_OLD_STORE",
          authored: authored ? { type: authored.type, ref: authored.ref, variant: authored.props?.variant ?? null, size: authored.props?.size ?? null, isSelected: authored.props?.isSelected ?? null, isDisabled: authored.props?.isDisabled ?? null } : null,
          reader: resolved ? { type: resolved.type, variant: resolved.props?.variant ?? null, size: resolved.props?.size ?? null, isSelected: resolved.props?.isSelected ?? null, isDisabled: resolved.props?.isDisabled ?? null, childTypes: (resolved.children ?? []).map((child) => child.type) } : null,
        };
      }, item);
      await page.waitForTimeout(450);
      const geometry = await page.evaluate((id) => {
        const item = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.()?.get(id);
        return item ? { x: item.x, y: item.y, width: item.width, height: item.height } : null;
      }, observed.id);
      const screenshot = `canvas/${item.semanticId}.png`;
      const png = await page.screenshot({
        path: resolve(out, screenshot), animations: "disabled",
        clip: { x: 300, y: 180, width: 500, height: 360 },
      });
      rows.push({ semanticId: item.semanticId, status: observed.status, authored: observed.authored, reader: observed.reader, geometry, screenshot, pngSha256: sha256(png) });
      await page.evaluate(async (id) => window.__composition_STORE__.getState().removeElement(id), observed.id);
    }
    const environment = await page.evaluate(async () => ({
      viewport: { width: innerWidth, height: innerHeight }, dpr: devicePixelRatio,
      theme: document.documentElement.dataset.theme ?? "default-light",
      font: getComputedStyle(document.body).fontFamily,
      fontLoadStatus: await document.fonts.ready.then(() => document.fonts.status),
    }));
    const report = {
      head, executionBuildIdentity: `dev-source:${sourceDigest.digest("hex")}:index:${servedIndexSha256}`,
      buildIndexSha256: sha256(readFileSync(resolve(root, "apps/builder/dist/index.html"))),
      scenario, scenarioHash: sha256(JSON.stringify(scenario)), runtimeEnvironment: environment,
      rows, errors,
    };
    writeFileSync(resolve(out, "baseline.json"), `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(JSON.stringify({ rows: rows.map(({ semanticId, status, geometry, pngSha256 }) => ({ semanticId, status, geometry, pngSha256 })), errors }) + "\n");
  } finally { await context.close(); }
} finally { await browser.close(); }
