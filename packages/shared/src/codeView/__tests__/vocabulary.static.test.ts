import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CODE_VIEW_VOCABULARY } from "../vocabulary";

/**
 * ADR-285 G1 — the vocabulary table against the sources: every `emit` is a generator function,
 * every `read` a reader function (the parser or the builder's planner), and the pending forms (no
 * reader yet — refused when edited) are exactly the list below: it only shrinks.
 */
const here = dirname(fileURLToPath(import.meta.url));
const generator = readFileSync(join(here, "../generate.ts"), "utf8");
const readers = [
  readFileSync(join(here, "../inverse/parse.ts"), "utf8"),
  readFileSync(
    join(
      here,
      "../../../../../apps/builder/src/builder/catalogRuntime/codeViewEdit.ts",
    ),
    "utf8",
  ),
].join("\n");

describe("the code view vocabulary (ADR-285 Decision 2)", () => {
  it.each(CODE_VIEW_VOCABULARY.map((item) => [item.form, item]))(
    "%s — its emit and read exist",
    (_, item) => {
      expect(generator).toMatch(new RegExp(`\\b${item.emit}\\(`));
      if (item.read) expect(readers).toMatch(new RegExp(`\\b${item.read}\\(`));
    },
  );

  it("the pending forms (no reader yet) — the list only shrinks", () => {
    expect(
      CODE_VIEW_VOCABULARY.filter((item) => !item.read).map(
        (item) => item.form,
      ),
    ).toEqual([
      "let {selectedKeys: x, setSelectedKeys: setX} = list",
      "url.searchParams.append(…)",
      "url.searchParams.set(_sort …)",
      "an or of terms",
      ".toSorted((a, b) => collator.compare(…))",
      "Map.groupBy(…) · counts",
      "[{id: 'row-1', count: …}]",
      "useDragAndDrop({…})",
      "prop={x === … && …}",
      "{`…${row?.f ?? ''}…`}",
      "list.update · move · remove · insert … · reload · capability · fetch",
    ]);
  });
});
