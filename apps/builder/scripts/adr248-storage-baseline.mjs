#!/usr/bin/env node
// ADR-248 G0: old document bytes at fixed node counts; data stores are excluded.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
  seedDocument,
} from "./perf-baseline.mjs";

const root = resolve(import.meta.dirname, "../../..");
const outIndex = process.argv.indexOf("--out");
if (outIndex >= 0 && !process.argv[outIndex + 1])
  throw new Error("--out requires path");
const out = resolve(
  outIndex >= 0
    ? process.argv[outIndex + 1]
    : "/private/tmp/adr248-storage-baseline.json",
);
const baseUrl = process.env.BUILDER_URL ?? "http://localhost:5173";
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const counts = [0, 1, 60, 600, 5_000];
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const { context, page, errors } = await createInstrumentedContext(browser, {
    storageState: JSON.parse(
      readFileSync(
        resolve(root, "apps/builder/scripts/.auth-session.json"),
        "utf8",
      ),
    ),
    frameCapture: false,
  });
  await createIsolatedProject(page, baseUrl);
  const projectId = new URL(page.url()).pathname.split("/").pop();
  const samples = [];
  for (const count of counts) {
    if (count) await seedDocument(page, count, "mixed", 1);
    const sample = await page.evaluate((id) => {
      const document = window.__canonical_STORE__
        ?.getState()
        ?.getDocument?.(id);
      if (!document) throw new Error("Old document missing");
      const byteLength = new TextEncoder().encode(
        JSON.stringify(document),
      ).byteLength;
      const currentPageId =
        window.__composition_STORE__.getState().currentPageId;
      const pageNodes = window.__composition_STORE__
        .getState()
        .elements.filter(
          (element) =>
            element.page_id === currentPageId &&
            element.id.startsWith("perf-seed-"),
        ).length;
      return { byteLength, pageNodes };
    }, projectId);
    samples.push({ count, ...sample });
    process.stdout.write(
      `${count}: ${sample.byteLength} B, ${sample.pageNodes} seed nodes\n`,
    );
  }
  const report = {
    head,
    fixture: "perf-baseline mixed",
    serializer: "TextEncoder(JSON.stringify(document))",
    excluded: ["collections", "api_endpoints", "variables", "asset binary"],
    samples,
    errors,
  };
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  await context.close();
  if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
} finally {
  await browser.close();
}
