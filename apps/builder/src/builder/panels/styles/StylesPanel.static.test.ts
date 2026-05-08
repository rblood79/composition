import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("StylesPanel canonical selected data contract", () => {
  it("uses selected element data instead of direct element-map reads for panel type/style", async () => {
    const source = await readFile(
      resolve(__dirname, "StylesPanel.tsx"),
      "utf-8",
    );

    expect(source).toContain(
      "const selectedElement = useDebouncedSelectedElementData();",
    );
    expect(source).toContain("const type = selectedElement?.type ?? null;");
    expect(source).toContain("selectedElement?.style");
    expect(source).not.toContain("s.elementsMap.get(id)");
  });
});
