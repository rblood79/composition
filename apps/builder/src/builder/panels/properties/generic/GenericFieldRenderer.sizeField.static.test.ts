import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Properties Appearance — Variant | Size 한 행 (panel-ui 07, 2026-09-15)", () => {
  it("size 는 옵션 4개 이상이면 셀렉트, variant 는 반폭, 긴 라벨 2옵션은 seg 대신 셀렉트", async () => {
    const source = await readFile(
      resolve(__dirname, "GenericFieldRenderer.tsx"),
      "utf-8",
    );
    const span = source.slice(
      source.indexOf("function fieldSpan("),
      source.indexOf("function packFieldRows("),
    );
    expect(span).toContain('case "variant":');
    expect(span).toContain('case "size":');
    const size = source.slice(source.indexOf('case "size":'), source.indexOf('case "boolean":'));
    expect(size).toContain("(field.options?.length ?? 0) > 3");
    expect(size).toContain("<PropertySelect");
    expect(size).toContain("<PropertySizeToggle");
    expect(source).toContain("every((o) => o.label.length <= 7)");
  });
});
