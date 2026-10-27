import { describe, expect, it } from "vitest";
import {
  parseReferenceApi,
  readReferenceFiles,
  REFERENCE_DIRS,
} from "./support/referenceApiTables";

/**
 * ADR-287 G0 — the reference API tables read with no error. The counts are the snapshot's
 * (`.claude/skills/*`): a skill update that changes them shows here first.
 */
const rowCount = (files: ReturnType<typeof readReferenceFiles>) =>
  files.reduce(
    (sum, file) =>
      sum + [...file.tables.values()].reduce((n, rows) => n + rows.length, 0),
    0,
  );

describe("ADR-287 G0 — reference API tables", () => {
  it("reads the RAC snapshot (53 files) and the S2 snapshot (70 files) with 0 errors", () => {
    const rac = readReferenceFiles(REFERENCE_DIRS.rac);
    const s2 = readReferenceFiles(REFERENCE_DIRS.s2);
    expect(rac).toHaveLength(53);
    expect(s2).toHaveLength(70);
    expect([...rac, ...s2].flatMap((file) => file.errors)).toEqual([]);
    expect(rowCount(rac)).toBe(10_673);
    expect(rowCount(s2)).toBe(3_012);
  });

  it("names the files whose API section has no rows (the snapshot printed headings only)", () => {
    const empty = (dir: string) =>
      readReferenceFiles(dir)
        .filter((file) => !file.tables.size)
        .map((file) => file.file);
    expect(empty(REFERENCE_DIRS.rac)).toEqual(["Toast"]);
    expect(empty(REFERENCE_DIRS.s2)).toEqual([
      "IllustratedMessage",
      "LabeledValue",
      "icons",
    ]);
  });

  it("reads a row's prop · type (with its `|`) · default · description", () => {
    const meter = readReferenceFiles(REFERENCE_DIRS.s2).find(
      (file) => file.file === "Meter",
    )!;
    expect(
      meter.tables.get("Meter")?.find((row) => row.prop === "value"),
    ).toEqual({
      prop: "value",
      type: "number | undefined",
      default: "0",
      description: "The current value (controlled).",
    });
    expect(
      meter.tables.get("Meter")?.find((row) => row.prop === "variant")?.type,
    ).toBe('"informative" | "negative" | "notice" | "positive" | undefined');
  });

  it("an unreadable row is an error, not a dropped row", () => {
    const file = parseReferenceApi(
      "## API\n\n| Name | Type | Default | Description |\n| `x` | broken\n",
      "X.md",
    );
    expect(file.errors).toHaveLength(1);
  });
});
