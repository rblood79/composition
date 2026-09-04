import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("PagesSection canonical ownership", () => {
  it("leaves page topology synchronization to the BuilderCore bridge", async () => {
    const source = await readFile(
      resolve(__dirname, "PagesSection.tsx"),
      "utf-8",
    );
    const builderCoreSource = await readFile(
      resolve(__dirname, "../../main/BuilderCore.tsx"),
      "utf-8",
    );

    expect(source).toContain("removePageLocal(");
    expect(source).not.toContain("visitCanonicalDocumentElements");
    expect(source).not.toContain("getCanonicalDocumentElementsView");
    expect(source).not.toContain("setElementsCanonicalPrimary");
    expect(source).not.toContain("getActiveCanonicalPageElements");
    expect(builderCoreSource).toContain(
      "setElementsCanonicalPrimary(getPageShellBridgeElements(state))",
    );
  });
});
