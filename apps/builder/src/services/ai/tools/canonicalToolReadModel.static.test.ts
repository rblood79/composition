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
  it("builds the shared read model from canonical traversal, not snapshot helpers", async () => {
    const source = await readFile(
      resolve(__dirname, "canonicalToolReadModel.ts"),
      "utf-8",
    );

    expect(source).toContain("visitCanonicalDocumentElements");
    expect(source).not.toContain("canonicalElementSnapshot");
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
