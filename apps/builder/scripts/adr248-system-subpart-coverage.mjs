#!/usr/bin/env node
// ADR-248 G0: locate non-palette visual types in the frozen old Builder's
// system Components tree and connect each occurrence to its authored origin.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
  loadStorageState,
} from "./perf-baseline.mjs";

const root = resolve(import.meta.dirname, "../../..");
const baselineDir = resolve(root, "docs/adr/design/248-baseline");
const readJson = (name) =>
  JSON.parse(readFileSync(resolve(baselineDir, name), "utf8"));
const manifest = readJson("coverage-manifest.json");
const stateOrigins = readJson("state-origins-production/baseline.json");
const creationAudit = readJson("creation-route-audit.json");
const readme = readFileSync(resolve(baselineDir, "README.md"), "utf8");
const expectedBuildHash =
  /production `dist\/index\.html` SHA-256: `([a-f0-9]{64})`/.exec(readme)?.[1];
const buildHash = createHash("sha256")
  .update(readFileSync(resolve(root, "apps/builder/dist/index.html")))
  .digest("hex");
if (!expectedBuildHash || buildHash !== expectedBuildHash)
  throw new Error("Frozen production build hash changed");
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (head !== manifest.source.baselineHead)
  throw new Error("Frozen baseline HEAD changed");
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out requires path");
const out = resolve(process.argv[outIndex + 1]);
const baseUrl = process.env.BUILDER_URL;
if (!baseUrl || !baseUrl.endsWith("/composition"))
  throw new Error(
    "BUILDER_URL must be the frozen /composition production base",
  );
const missingTypes = manifest.types
  .filter(
    (entry) =>
      entry.oldBaseline.filter(
        (baseline) =>
          !baseline.fixture.startsWith("unlisted-simple-production/") &&
          !baseline.fixture.startsWith("unlisted-composite-production/") &&
          !baseline.fixture.startsWith("system-root-ref-production/") &&
          !baseline.fixture.startsWith("section-host-production/"),
      ).length === 0,
  )
  .map((entry) => entry.type);
const scenario = {
  id: "adr248-old-system-origin-subpart-coverage-v1",
  seed: 248,
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  theme: "default-light",
  font: "app-default",
  operation: "inspectSystemComponentsAncestry",
  types: missingTypes,
};
const scenarioHash = createHash("sha256")
  .update(JSON.stringify(scenario))
  .digest("hex");
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const { context, page, errors } = await createInstrumentedContext(browser, {
    storageState: loadStorageState(
      resolve(root, "apps/builder/scripts/.auth-session.json"),
      new URL(baseUrl).origin,
    ),
    frameCapture: false,
    deviceScaleFactor: scenario.dpr,
  });
  try {
    await createIsolatedProject(page, baseUrl);
    const nodes = await page.evaluate(() =>
      window.__composition_STORE__
        .getState()
        .elements.filter(
          (entry) => !entry.deleted && entry.page_id === "page-components",
        )
        .map((entry) => ({
          id: entry.id,
          type: entry.type,
          componentName: entry.componentName ?? null,
          parentId: entry.parent_id ?? null,
          slotRole: entry.metadata?.slotRole ?? null,
        })),
    );
    const byId = new Map(nodes.map((entry) => [entry.id, entry]));
    const rootFor = (node) => {
      const path = [];
      const seen = new Set();
      let current = node;
      while (current) {
        if (seen.has(current.id)) throw new Error(`${node.id}: parent cycle`);
        seen.add(current.id);
        path.push({
          id: current.id,
          type: current.type,
          slotRole: current.slotRole,
        });
        if (current.id === "page-components-body") {
          return { root: current, path };
        }
        if (current.parentId === "page-components-body") {
          return { root: current, path };
        }
        current = byId.get(current.parentId);
      }
      throw new Error(`${node.id}: parent chain misses Components body`);
    };
    const stateOriginIds = new Set(stateOrigins.origins.map((item) => item.id));
    const rows = missingTypes.map((type) => {
      const occurrences = nodes
        .filter((entry) => entry.type === type)
        .map((entry) => {
          const { root: origin, path } = rootFor(entry);
          const rootBaseline = manifest.types
            .find((item) => item.type === origin.type)
            ?.oldBaseline.find((item) =>
              item.fixture.startsWith("palette-production-base/canvas/"),
            );
          const systemStateBaseline = stateOriginIds.has(origin.id)
            ? `state-origins-production/canvas/${origin.id}.png`
            : null;
          return {
            id: entry.id,
            rootId: origin.id,
            rootType: origin.type,
            rootComponentName: origin.componentName,
            path,
            existingRootCanvasFixture:
              rootBaseline?.fixture ?? systemStateBaseline,
          };
        });
      return {
        type,
        oldCreationRoute:
          creationAudit.routes.find((route) => route.type === type)?.oldMode ??
          "UNCLASSIFIED",
        status: occurrences.length
          ? "PRESENT_IN_SYSTEM_ORIGIN"
          : "ABSENT_FROM_SYSTEM_ORIGINS",
        occurrences,
      };
    });
    const summary = {
      typesWithoutPaletteOrStateBaseline: missingTypes.length,
      systemNodes: nodes.length,
      typesPresent: rows.filter((row) => row.occurrences.length).length,
      typesAbsent: rows.filter((row) => !row.occurrences.length).length,
      typesWithExistingRootCanvasFixture: rows.filter((row) =>
        row.occurrences.some((item) => item.existingRootCanvasFixture),
      ).length,
      distinctObservedRoots: new Set(
        rows.flatMap((row) => row.occurrences.map((item) => item.rootId)),
      ).size,
    };
    const report = {
      head,
      buildIndexSha256: buildHash,
      scenario,
      scenarioHash,
      summary,
      rows,
      errors,
    };
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
    if (errors.length || missingTypes.length !== 56)
      throw new Error("System subpart coverage probe is incomplete");
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
