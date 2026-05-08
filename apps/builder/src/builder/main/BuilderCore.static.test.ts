import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("BuilderCore canonical document direct cutover contract", () => {
  it("does not hydrate frame elements from legacy DB fallback in restored frame edit mode", async () => {
    const source = await readFile(
      resolve(__dirname, "BuilderCore.tsx"),
      "utf-8",
    );

    expect(source).not.toContain(
      'from "@/adapters/canonical/frameElementLoader";',
    );
    expect(source).not.toContain("isLegacyFrameElementForFrame");
    expect(source).toMatch(/if \(editMode === "layout"\) \{/);
    expect(source).not.toContain("loadFrameElements");
    expect(source).not.toMatch(/elements: await loadFrameElements/);
    expect(source).not.toMatch(
      /const activeFrameId = getSelectedReusableFrameId\(\);/,
    );
    expect(source).not.toMatch(/const frameIds = Array\.from\(/);
    expect(source).not.toMatch(/layouts\.map\(\(layout\) => layout\.id\)/);
    expect(source).not.toContain("fetchLayouts");
    expect(source).not.toContain("currentLayoutId");
    expect(source).not.toContain("getDescendants(currentLayoutId)");
    expect(source).not.toContain("selectCanonicalDocument");
  });

  it("does not merge legacy frame fallback elements into the canonical document", async () => {
    const source = await readFile(
      resolve(__dirname, "BuilderCore.tsx"),
      "utf-8",
    );

    expect(source).not.toMatch(/\blayoutElements\b/);
    expect(source).not.toMatch(/\bmergedElements\b/);
    expect(source).not.toMatch(/setElementsCanonicalPrimary\(mergedElements\)/);
  });

  it("persists active CompositionDocument as primary storage and bridges page shell mutations", async () => {
    const source = await readFile(
      resolve(__dirname, "BuilderCore.tsx"),
      "utf-8",
    );

    expect(source).toContain("db.documents.put(projectId, doc)");
    expect(source).toContain(
      "page shell mutations also update the canonical doc",
    );
    expect(source).toMatch(/if \(state\.pages === pagesRef\) return;/);
    expect(source).toContain("getActiveCanonicalBuilderElements");
    expect(source).toContain("getCanonicalOrBootstrapBuilderElements");
    expect(source).toContain("visitCanonicalDocumentElements");
    expect(source).not.toContain("canonicalElementSnapshot");
    expect(source).not.toContain("canonicalDocumentToElements");
    expect(source).not.toContain("canonicalElements ?? state.elements ?? []");
    expect(source).not.toContain(
      ["Array.from(state.", "elements", "Map.values())"].join(""),
    );
  });

  it("does not re-project canonical document during initial page hydrate", async () => {
    const source = await readFile(
      resolve(__dirname, "BuilderCore.tsx"),
      "utf-8",
    );

    expect(source).toContain("pageShellBridgeSuspendedRef");
    expect(source).toMatch(
      /if \(pageShellBridgeSuspendedRef\.current\) return;/,
    );
    expect(source).toMatch(
      /pageShellBridgeSuspendedRef\.current = true;[\s\S]+const result = await initializeProject\(projectId\)\.finally\(\(\) => \{[\s\S]+pageShellBridgeSuspendedRef\.current = false;/,
    );
  });
});
