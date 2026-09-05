import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ADR-203 Properties field subscription boundary", () => {
  it("PropertiesPanelContent는 선택 객체 대신 id와 scalar type만 구독한다", async () => {
    const source = await readFile(
      resolve(__dirname, "PropertiesPanel.tsx"),
      "utf8",
    );
    const content = source.slice(
      source.indexOf("function PropertiesPanelContent()"),
    );

    expect(content).toContain(
      "const selectedElementId = useStore((state) => state.selectedElementId);",
    );
    expect(content).toContain("useCanonicalPropertyElementType(");
    expect(content).not.toContain("useDebouncedSelectedElementData()");
  });

  it("GenericField는 계약 객체의 currentValue 대신 canonical scalar value를 읽는다", async () => {
    const source = await readFile(
      resolve(__dirname, "generic/GenericFieldRenderer.tsx"),
      "utf8",
    );

    expect(source).toContain("useCanonicalPropertyValue(");
    expect(source).toContain("areGenericFieldPropsEqual");
    expect(source).not.toContain("const value = field.currentValue");
  });
});
