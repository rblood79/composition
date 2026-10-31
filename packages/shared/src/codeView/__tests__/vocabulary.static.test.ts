import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CODE_VIEW_VOCABULARY } from "../vocabulary";

/**
 * ADR-285 G1 — the vocabulary table against the sources: every `emit` is a generator function and
 * every `read` a reader function (the parser or the builder's planner — `codeViewEdit.ts` ·
 * `codeViewViews.ts`). No form is pending: each is read back (the strict round trip of the
 * acceptance set — `adr284CodeView.test.tsx` — is the behavior gate).
 */
const here = dirname(fileURLToPath(import.meta.url));
const generator = [
  "../generate.ts",
  "../files/app.ts",
  "../files/definitions.ts",
]
  .map((file) => readFileSync(join(here, file), "utf8"))
  .join("\n");
const readers = [
  readFileSync(join(here, "../inverse/parse.ts"), "utf8"),
  ...[
    "codeViewEdit.ts",
    "codeViewViews.ts",
    "codeViewApp.ts",
    "codeViewData.ts",
  ].map((file) =>
    readFileSync(
      join(
        here,
        "../../../../../apps/builder/src/builder/catalogRuntime",
        file,
      ),
      "utf8",
    ),
  ),
].join("\n");

describe("the code view vocabulary (ADR-285 Decision 2)", () => {
  it.each(CODE_VIEW_VOCABULARY.map((item) => [item.form, item]))(
    "%s — its emit and read exist",
    (_, item) => {
      expect(generator).toMatch(new RegExp(`\\b${item.emit}\\(`));
      expect(readers).toMatch(new RegExp(`\\b${item.read}\\(`));
    },
  );

  it("no form is pending (each has a reader)", () => {
    expect(CODE_VIEW_VOCABULARY.filter((item) => !item.read)).toEqual([]);
  });
});
