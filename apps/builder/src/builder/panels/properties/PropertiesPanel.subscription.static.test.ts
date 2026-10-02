import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ADR-203 Properties field subscription boundary", () => {
  it("GenericField는 계약 객체의 currentValue 대신 canonical scalar value를 읽는다", async () => {
    const source = await readFile(
      resolve(__dirname, "generic/GenericFieldRenderer.tsx"),
      "utf8",
    );

    expect(source).toContain("useFieldValue(");
    expect(source).toContain("areGenericFieldPropsEqual");
    expect(source).not.toContain("const value = field.currentValue");
  });
});
