#!/usr/bin/env node
// ADR-248 G0: old Builder authoring commit -> IDB head, then refresh -> ready.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
  loadStorageState,
  seedDocument,
  waitReady,
} from "./perf-baseline.mjs";

const root = resolve(import.meta.dirname, "../../..");
const outIndex = process.argv.indexOf("--out");
if (outIndex >= 0 && !process.argv[outIndex + 1])
  throw new Error("--out requires path");
const out = resolve(
  outIndex >= 0
    ? process.argv[outIndex + 1]
    : "/private/tmp/adr248-save-load.json",
);
const baseUrl = process.env.BUILDER_URL ?? "http://localhost:5173";
const repeats = 6; // first run warms the path; five measured samples remain
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const { context, page, errors } = await createInstrumentedContext(browser, {
    storageState: loadStorageState(
      resolve(root, "apps/builder/scripts/.auth-session.json"),
      new URL(baseUrl).origin,
    ),
    frameCapture: false,
  });
  await createIsolatedProject(page, baseUrl);
  const projectId = new URL(page.url()).pathname.split("/").pop();
  const samples = [];
  for (const count of [1, 60, 600, 5_000]) {
    await seedDocument(page, count, "mixed", 1);
    for (let attempt = 0; attempt < repeats; attempt += 1) {
      const save = await page.evaluate(
        async ({ projectId, count, attempt }) => {
          const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open("composition");
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          const readHead = () =>
            new Promise((resolve, reject) => {
              const request = db
                .transaction("document_heads", "readonly")
                .objectStore("document_heads")
                .get(projectId);
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error);
            });
          const before = await readHead();
          const state = window.__composition_STORE__.getState();
          const start = performance.now();
          await state.updateElementProps("perf-seed-0", {
            children: `Save probe ${count}-${attempt}`,
          });
          let after = await readHead();
          while (
            after?.revision === before?.revision &&
            performance.now() - start < 20_000
          ) {
            await new Promise((resolve) => setTimeout(resolve, 5));
            after = await readHead();
          }
          const elapsedMs = performance.now() - start;
          db.close();
          if (!after || after.revision === before?.revision)
            throw new Error(
              `IDB save revision did not advance at ${count} nodes`,
            );
          return {
            elapsedMs: +elapsedMs.toFixed(2),
            beforeRevision: Boolean(before),
            afterCount: after.count,
          };
        },
        { projectId, count, attempt },
      );
      const loadStart = performance.now();
      await page.reload({ waitUntil: "networkidle" });
      await waitReady(page, { settleMs: 0 });
      const loadMs = performance.now() - loadStart;
      const hydratedCount = await page.evaluate(
        () =>
          window.__composition_STORE__
            .getState()
            .elements.filter((element) => element.id.startsWith("perf-seed-"))
            .length,
      );
      if (hydratedCount !== count)
        throw new Error(`Hydration count ${hydratedCount} != ${count}`);
      samples.push({
        count,
        attempt,
        warmup: attempt === 0,
        saveMs: save.elapsedMs,
        loadMs: +loadMs.toFixed(2),
        persistedNodeCount: save.afterCount,
        hydratedCount,
      });
      process.stdout.write(
        `${count}/${attempt}: save ${save.elapsedMs} ms, refresh ready ${loadMs.toFixed(2)} ms\n`,
      );
    }
  }
  const report = {
    head,
    baseUrl,
    fixture: "perf-baseline mixed; one page; cumulative seed",
    saveOracle: "command updateElementProps -> document_heads.revision change",
    loadOracle: "page.reload networkidle -> waitReady",
    repeats,
    samples,
    errors,
  };
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  await context.close();
  if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
} finally {
  await browser.close();
}
