import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("canonicalSceneModelLegacy boundary map contract", () => {
  it("keeps legacy Element map return contracts behind boundary aliases", async () => {
    const source = await readFile(
      resolve(__dirname, "canonicalSceneModelLegacy.ts"),
      "utf-8",
    );

    expect(source).toContain("type LegacyElementSnapshot = Element");
    expect(source).toContain("export type LegacyElementMap");
    expect(source).toContain("export type LegacyChildrenByParentMap");
    expect(source).toContain(
      "export function buildLegacyElementMap(\n  elements: readonly Element[],",
    );
    expect(source).toContain(
      "export function buildLegacyChildrenByParent(\n  elements: readonly Element[],",
    );
    expect(source).not.toContain("): Map<string, Element> {");
    expect(source).not.toContain("): Map<string, Element[]> {");
    expect(source).not.toContain("new Map<string, Element[]>()");
  });
});
