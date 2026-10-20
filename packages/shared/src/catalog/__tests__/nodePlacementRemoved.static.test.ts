import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ADR-275 G2 (정적): the node `placement` field is gone — an authored absolute box is
 * `layout.position: absolute` + `inset*`, out-of-flow surfaces read `catalogIsOutOfFlow` and edit
 * surfaces `catalogIsAuthoredAbsolute` (`runtime/positioning.ts`). A source file that names the old
 * type, op or field would bring the second position path back. Page `placement` (`PagePlacement`)
 * and overlay `placement` props are other things and are not matched.
 */
const ROOT = resolve(__dirname, "../../../../..");
const SOURCES = ["packages/shared/src", "apps/builder/src", "apps/publish/src"];
const OLD = [
  /\bNodePlacement\b/,
  /\bsetNodePlacement\b/,
  /\b(?:node|record|leaderRecord|child|own|old|root|top|patch|base|target|resolved|instance)\.placement\b/,
  /\bplacement\?\.kind\b/,
  /field: "placement"/,
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory())
      return name === "__tests__" || name === "node_modules"
        ? []
        : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)
      ? [path]
      : [];
  });
}

describe("ADR-275 node placement removed", () => {
  it("no source file reads or writes the node `placement` field", () => {
    const hits = SOURCES.flatMap((source) =>
      sourceFiles(join(ROOT, source)).flatMap((file) =>
        readFileSync(file, "utf8")
          .split("\n")
          .flatMap((line, index) =>
            OLD.some((pattern) => pattern.test(line))
              ? [`${relative(ROOT, file)}:${index + 1}: ${line.trim()}`]
              : [],
          ),
      ),
    );
    expect(hits).toEqual([]);
  });
});
