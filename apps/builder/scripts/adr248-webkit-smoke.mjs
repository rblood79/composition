#!/usr/bin/env node
// ADR-248 G0: WebKit can author and draw a structural Canvas fixture.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { webkit } from "playwright";
import { createIsolatedProject } from "./perf-baseline.mjs";

const root = resolve(import.meta.dirname, "../../..");
const outIndex = process.argv.indexOf("--out");
if (outIndex >= 0 && !process.argv[outIndex + 1])
  throw new Error("--out requires path");
const out = resolve(
  outIndex >= 0
    ? process.argv[outIndex + 1]
    : "/private/tmp/adr248-webkit-smoke.json",
);
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const baseUrl = process.env.BUILDER_URL ?? "http://localhost:5173";
const browser = await webkit.launch({ headless: true });
try {
  const context = await browser.newContext({
    storageState: JSON.parse(
      readFileSync(
        resolve(root, "apps/builder/scripts/.auth-session.json"),
        "utf8",
      ),
    ),
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await createIsolatedProject(page, baseUrl);
  const id = "adr248-webkit-frame";
  await page.evaluate(async (id) => {
    const state = window.__composition_STORE__.getState();
    const pageId = state.currentPageId;
    const body = state.elements.find(
      (element) => element.page_id === pageId && element.type === "body",
    );
    if (!body) throw new Error("Page body missing");
    const now = new Date().toISOString();
    await state.addComplexElement(
      {
        id,
        type: "frame",
        parent_id: body.id,
        page_id: pageId,
        created_at: now,
        updated_at: now,
        props: {
          style: {
            position: "absolute",
            left: "40px",
            top: "40px",
            width: "240px",
            height: "120px",
            backgroundColor: "#dbe7ff",
          },
        },
      },
      [],
    );
    window.__composition_APPLY_VIEWPORT__?.({ scale: 0.8, x: 100, y: 100 });
  }, id);
  await page.waitForTimeout(700);
  const result = await page.evaluate(
    (id) => ({
      canvasCount: document.querySelectorAll(
        '[data-testid="skia-canvas-unified"]',
      ).length,
      geometry:
        window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.()?.get(id) ??
        null,
      font: getComputedStyle(document.body).fontFamily,
    }),
    id,
  );
  if (result.canvasCount !== 1 || !result.geometry || errors.length) {
    throw new Error(
      `WebKit Canvas baseline failed: ${JSON.stringify({ result, errors })}`,
    );
  }
  writeFileSync(
    out,
    `${JSON.stringify({ head, browser: "webkit", version: browser.version(), result, errors }, null, 2)}\n`,
  );
  process.stdout.write(`${out}: frame 240x120, Canvas present, errors 0\n`);
  await context.close();
} finally {
  await browser.close();
}
