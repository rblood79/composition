import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const previewFiles = [
  "App.tsx",
  "router/CanvasRouter.tsx",
  "components/CanonicalNodeRenderer.tsx",
  "utils/layoutResolver.ts",
] as const;

describe("preview frame mirror contract", () => {
  it("routes page/frame ownership through frameMirror or frameElementLoader", async () => {
    for (const file of previewFiles) {
      const source = await readFile(resolve(__dirname, file), "utf-8");

      expect(source).not.toContain("getLegacyLayoutId");
      expect(source).not.toContain("withLegacyLayoutId");
      expect(source).not.toContain("hasLegacyLayoutId");
      expect(source).not.toContain("matchesLegacyLayoutId");
      expect(source).not.toContain("legacyToCanonical");
    }
  });

  it("resolves preview canonical documents with the shared import registry", async () => {
    const source = await readFile(resolve(__dirname, "App.tsx"), "utf-8");

    expect(source).toContain(
      "const canonicalImportRegistry = getSharedImportRegistry();",
    );
    expect(source).toContain(".prefetchDocumentImports(canonicalDocument)");
    expect(
      source.match(
        /resolveCanonicalDocument\(\s*canonicalDocument,\s*undefined,\s*canonicalImportRegistry,\s*\)/g,
      ) ?? [],
    ).toHaveLength(2);
  });

  it("renders canonical document content even when legacy preview elements are empty", async () => {
    const source = await readFile(resolve(__dirname, "App.tsx"), "utf-8");

    expect(source).toContain("const hasPreviewContentSource =");
    expect(source).toContain(
      "canonicalDocument !== null || elements.length > 0",
    );
    expect(source).toContain("!hasPreviewContentSource ? (");
    expect(source).not.toContain("elements.length === 0 ? (");
  });

  it("does not expose page order_num on the preview runtime page contract", async () => {
    const storeTypes = await readFile(
      resolve(__dirname, "store/types.ts"),
      "utf-8",
    );
    const router = await readFile(
      resolve(__dirname, "router/CanvasRouter.tsx"),
      "utf-8",
    );

    expect(storeTypes).not.toContain("order_num");
    expect(router).not.toContain("order_num");
  });

  it("uses node.id fallback when canonical page metadata pageId is missing", async () => {
    const source = await readFile(resolve(__dirname, "App.tsx"), "utf-8");

    expect(source).toContain("const resolvedPageId");
    expect(source).toContain("node.id");
    expect(source).toContain("meta?.pageId");
  });
});
