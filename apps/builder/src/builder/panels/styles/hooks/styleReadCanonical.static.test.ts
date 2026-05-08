import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("style hooks canonical read contract", () => {
  it("uses canonical property read hook for shared style context", async () => {
    const source = await readFile(
      resolve(__dirname, "useElementStyleContext.ts"),
      "utf-8",
    );

    expect(source).toContain('useCanonicalPropertyElement(id ?? "")');
    expect(source).not.toContain("useStore");
    expect(source).not.toContain("useCanonicalElements");
    expect(source).not.toContain("canonicalElements?.find(");
    expect(source).not.toContain("s.elementsMap.get(id)?.props");
    expect(source).not.toContain("s.elementsMap.get(id)?.type");
  });

  it("reuses style context for fill and transform reads", async () => {
    const fillSource = await readFile(
      resolve(__dirname, "useFillValues.ts"),
      "utf-8",
    );
    const transformSource = await readFile(
      resolve(__dirname, "useTransformValues.ts"),
      "utf-8",
    );

    expect(fillSource).toContain("useElementStyleContext(selectedId)");
    expect(fillSource).not.toContain("s.elementsMap.get(selectedId)");
    expect(transformSource).toContain('type?.toLowerCase() === "body"');
    expect(transformSource).not.toContain("s.elementsMap.get(id)?.type");
  });

  it("uses canonical property element for reset dirty-state reads", async () => {
    const source = await readFile(
      resolve(__dirname, "useResetStyles.ts"),
      "utf-8",
    );

    expect(source).toContain('useCanonicalPropertyElement(selectedId ?? "")');
    expect(source).toContain("visitCanonicalDocumentElements");
    expect(source).toContain("getActiveCanonicalResetDocument");
    expect(source).toContain("getActiveCanonicalResetElement(selectedId)");
    expect(source).not.toContain("canonicalElementSnapshot");
    expect(source).not.toContain("state.elements.find");
    expect(source).not.toContain(
      "const element = state.elementsMap.get(selectedId);",
    );
  });

  it("uses canonical property element for transform parent and size reads", async () => {
    const source = await readFile(
      resolve(__dirname, "useTransformAuxiliary.ts"),
      "utf-8",
    );

    expect(source).toContain("useCanonicalPropertyElement");
    expect(source).not.toContain("s.elementsMap.get");
    expect(source).not.toContain("state.elementsMap.get(parentId)");
  });
});
