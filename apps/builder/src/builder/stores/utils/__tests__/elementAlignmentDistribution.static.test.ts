import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("store utility structural contracts", () => {
  it("does not require store Element maps for geometry and lookup utilities", async () => {
    const alignmentSource = await readFile(
      resolve(__dirname, "../elementAlignment.ts"),
      "utf-8",
    );
    const distributionSource = await readFile(
      resolve(__dirname, "../elementDistribution.ts"),
      "utf-8",
    );
    const helperSource = await readFile(
      resolve(__dirname, "../elementHelpers.ts"),
      "utf-8",
    );

    expect(alignmentSource).toContain("interface AlignableElementNode");
    expect(alignmentSource).toContain(
      "elementsMap: ReadonlyMap<string, AlignableElementNode>",
    );
    expect(alignmentSource).not.toContain("../../../types/core/store.types");
    expect(alignmentSource).not.toContain("Map<string, Element>");

    expect(distributionSource).toContain("interface DistributableElementNode");
    expect(distributionSource).toContain(
      "elementsMap: ReadonlyMap<string, DistributableElementNode>",
    );
    expect(distributionSource).not.toContain("../../../types/core/store.types");
    expect(distributionSource).not.toContain("Map<string, Element>");

    expect(helperSource).toContain(
      "getElementById = <TElement extends Element>",
    );
    expect(helperSource).toContain(
      "elementsMap: ReadonlyMap<string, TElement>",
    );
    expect(helperSource).toContain(
      "childrenMap: ReadonlyMap<string, readonly TElement[]>",
    );
    expect(helperSource).not.toContain("Map<string, Element>");
    expect(helperSource).not.toContain("Map<string, Element[]>");
  });
});
