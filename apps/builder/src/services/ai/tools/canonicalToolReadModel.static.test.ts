import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const TOOL_FILES = [
  "createElement.ts",
  "deleteElement.ts",
  "getEditorState.ts",
  "getSelection.ts",
  "searchElements.ts",
  "updateElement.ts",
];

describe("AI tools canonical read model contract", () => {
  it("reads the AI read host only", async () => {
    // ADR-248 4e-7: the tool read model never reaches the old stores (the open Builder installs
    // the host); the old store host went with 4e-9 C.
    const source = await readFile(
      resolve(__dirname, "canonicalToolReadModel.ts"),
      "utf-8",
    );
    expect(source).toContain("getAiReadHost");
    expect(source).not.toMatch(/builder\/stores|getStoreState/);
  });

  it.each(TOOL_FILES)(
    "%s does not read legacy store element maps directly",
    async (fileName) => {
      const source = await readFile(resolve(__dirname, fileName), "utf-8");

      expect(source).toContain("getAiToolReadModel");
      expect(source).not.toContain("getStoreState");
      expect(source).not.toContain("elementsMap");
      expect(source).not.toContain("childrenMap");
    },
  );
});
