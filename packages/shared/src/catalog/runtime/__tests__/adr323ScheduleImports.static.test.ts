import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ADR-323 G1 (HC6 · breakdown §5.2) — the schedule geometry (`@composition/rendering/schedule/
 * timeGrid` · `dateAxis`) is read only by the lazy chunks that draw Timeline · EventCalendar · Gantt.
 * No other source module imports it by value (types are erased) and no barrel re-exports it — a value
 * import from a first-screen module would put it in the initial bundle. A dynamic `import()` is the
 * way in. Later Phases add their lazy modules to `LAZY_READERS`.
 */
const ROOT = resolve(__dirname, "../../../../../..");
const SOURCES = [
  "packages/shared/src",
  "packages/rendering/src",
  "apps/builder/src",
  "apps/publish/src",
];
/** Lazy-only modules allowed a value import (repo-relative). */
const LAZY_READERS: readonly string[] = [];
const GEOMETRY = /(^|\/)schedule\/(timeGrid|dateAxis)(\.ts)?$/;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "__tests__") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(path));
    else if (
      /\.(ts|tsx|mts)$/.test(entry.name) &&
      !/\.(test|spec)\.tsx?$/.test(entry.name)
    )
      out.push(path);
  }
  return out;
}

/** The static `import` · `export … from` specifiers of a source and whether each is type-only. */
function staticImports(source: string): { from: string; typeOnly: boolean }[] {
  const out: { from: string; typeOnly: boolean }[] = [];
  for (const match of source.matchAll(
    /^\s*(import|export)\s+(type\s+)?(?:[^;'"]*?\s+from\s+)?["']([^"']+)["']/gms,
  )) {
    // `import { type A, type B } from` — every named binding is a type.
    const named = /^\s*(?:import|export)\s+\{([^}]*)\}\s+from/s.exec(match[0]);
    const typeOnly =
      Boolean(match[2]) ||
      (named !== null &&
        named[1]!
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean)
          .every((name) => name.startsWith("type ")));
    out.push({ from: match[3]!, typeOnly });
  }
  return out;
}

describe("ADR-323 — the schedule geometry stays off the first screen", () => {
  const files = SOURCES.flatMap((dir) => sourceFiles(resolve(ROOT, dir)));

  it("scans the sources (sanity)", () => {
    expect(files.length).toBeGreaterThan(500);
    expect(
      files.some((file) => file.endsWith("rendering/src/schedule/timeGrid.ts")),
    ).toBe(true);
  });

  it("no value import of timeGrid · dateAxis outside the lazy readers", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const path = relative(ROOT, file);
      if (path.startsWith("packages/rendering/src/schedule/")) continue;
      if (LAZY_READERS.includes(path)) continue;
      for (const { from, typeOnly } of staticImports(
        readFileSync(file, "utf8"),
      ))
        if (GEOMETRY.test(from) && !typeOnly)
          offenders.push(`${path} ← ${from}`);
    }
    expect(offenders).toEqual([]);
  });

  it("the import reader tells value from type imports", () => {
    expect(
      staticImports(
        [
          'import { layoutScheduleTimeGrid } from "@composition/rendering/schedule/timeGrid";',
          'import type { DateAxis } from "../schedule/dateAxis";',
          'import { type DateAxis, type DateAxisRow } from "./schedule/dateAxis";',
          'import { type DateAxis, createDateAxis } from "./schedule/dateAxis";',
          'export * from "./schedule/timeGrid";',
          'import "./schedule/dateAxis";',
        ].join("\n"),
      ),
    ).toEqual([
      { from: "@composition/rendering/schedule/timeGrid", typeOnly: false },
      { from: "../schedule/dateAxis", typeOnly: true },
      { from: "./schedule/dateAxis", typeOnly: true },
      { from: "./schedule/dateAxis", typeOnly: false },
      { from: "./schedule/timeGrid", typeOnly: false },
      { from: "./schedule/dateAxis", typeOnly: false },
    ]);
  });
});
