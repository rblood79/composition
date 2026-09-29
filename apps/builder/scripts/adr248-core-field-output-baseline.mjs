#!/usr/bin/env node
// ADR-248 G0: observe every core document field in a newly created old Builder project.
// This is a cold-load value snapshot. It does not replace field-specific edit scenarios.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
  loadStorageState,
} from "./perf-baseline.mjs";

const root = resolve(import.meta.dirname, "../../..");
const baselineDir = resolve(root, "docs/adr/design/248-baseline");
const inventory = JSON.parse(
  readFileSync(resolve(baselineDir, "inventory.json"), "utf8"),
);
const keys = Object.entries(inventory.fieldMapping).flatMap(([family, fields]) =>
  Object.keys(fields).map((field) => `${family}.${field}`),
);
if (keys.length !== 51 || new Set(keys).size !== 51)
  throw new Error("Core field inventory changed");
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (head !== inventory.baselineHead)
  throw new Error("Core field output baseline uses another HEAD");
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out requires path");
const out = resolve(process.argv[outIndex + 1]);
mkdirSync(out, { recursive: true });
const baseUrl = process.env.BUILDER_URL ?? "http://localhost:5173";
const scenario = {
  id: "adr248-old-core-field-defaults-v1",
  seed: 248,
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  theme: "default-light",
  font: "app-default",
  operations: [{ op: "createNewProject" }, { op: "readCoreFields" }],
  expectedRelations: [],
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
    const fields = await page.evaluate(
      async ({ projectId, keys }) => {
        const doc = window.__canonical_STORE__
          ?.getState()
          ?.getDocument?.(projectId);
        if (!doc) throw new Error("Old canonical document unavailable");
        const nodes = [];
        const visit = (children) => {
          for (const node of children ?? []) {
            nodes.push(node);
            visit(node.children);
          }
        };
        visit(doc.children);
        const guideCollections = Object.values(doc.pageGuides ?? {}).flatMap(
          (tiers) => Object.values(tiers ?? {}),
        );
        const subjects = {
          CanonicalNode: nodes,
          FrameNode: nodes.filter((node) => node.type === "frame"),
          RefNode: nodes.filter((node) => node.type === "ref"),
          CompositionDocument: [doc],
          ThemeDefinition: Object.values(doc.themes?.items ?? {}),
          ThemesCollection: doc.themes ? [doc.themes] : [],
          PagePlacement: Object.values(doc.pageLayout?.placements ?? {}),
          PageLayoutSettingsDocument: doc.pageLayout ? [doc.pageLayout] : [],
          PageGuideLine: guideCollections.flat(),
        };
        const normalize = (value) =>
          JSON.stringify(value)
            ?.replace(
              /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
              "<uuid>",
            )
            .replace(
              /\b\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z\b/g,
              "<timestamp>",
            ) ?? "undefined";
        const digest = async (value) => {
          const bytes = new TextEncoder().encode(normalize(value));
          const hash = await crypto.subtle.digest("SHA-256", bytes);
          return {
            sha256: Array.from(new Uint8Array(hash), (byte) =>
              byte.toString(16).padStart(2, "0"),
            ).join(""),
            byteLength: bytes.byteLength,
          };
        };
        const result = [];
        for (const key of keys) {
          const [family, field] = key.split(".");
          const records = subjects[family];
          if (!records) throw new Error(`${key}: missing subject family`);
          const present = records.filter((value) =>
            Object.prototype.hasOwnProperty.call(value, field),
          );
          const samples = [];
          for (const value of present.slice(0, 3)) {
            const current = value[field];
            const summary = await digest(current);
            samples.push({
              kind: Array.isArray(current)
                ? "array"
                : current === null
                  ? "null"
                  : typeof current,
              ...summary,
              ...(typeof current === "string" ||
              typeof current === "number" ||
              typeof current === "boolean"
                ? { scalar: normalize(current) }
                : {}),
              ...(current && typeof current === "object"
                ? { keys: Object.keys(current).slice(0, 12) }
                : {}),
            });
          }
          result.push({
            key,
            subjectCount: records.length,
            presentCount: present.length,
            samples,
            status: present.length
              ? "OBSERVED_ON_NEW_OLD_PROJECT"
              : "ABSENT_ON_NEW_OLD_PROJECT",
          });
        }
        return { nodeCount: nodes.length, fields: result };
      },
      { projectId, keys },
    );
    if (fields.fields.length !== 51)
      throw new Error(
        `Expected 51 core field observations, got ${fields.fields.length}`,
      );
    if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
    const report = {
      head,
      runtime: "old Builder dev",
      scenarioHash,
      scenario,
      fontState: await page.evaluate(() => ({
        bodyFamily: getComputedStyle(document.body).fontFamily,
        loadStatus: document.fonts.status,
      })),
      nodeCount: fields.nodeCount,
      summary: {
        fields: fields.fields.length,
        fieldsPresent: fields.fields.filter((entry) => entry.presentCount)
          .length,
        fieldsAbsent: fields.fields
          .filter((entry) => !entry.presentCount)
          .map((entry) => entry.key),
      },
      fields: fields.fields,
      errors,
    };
    writeFileSync(
      resolve(out, "baseline.json"),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    process.stdout.write(
      `${out}/baseline.json: ${report.summary.fieldsPresent}/51 fields present on new old project\n`,
    );
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
