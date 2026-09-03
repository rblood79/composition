import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("style hooks canonical read contract", () => {
  it("uses canonical property read hook for shared style context", async () => {
    const source = await readFile(
      resolve(__dirname, "useElementStyleContext.ts"),
      "utf-8",
    );

    expect(source).toContain("useCanonicalPropertyElementsMap");
    expect(source).toContain("elementsMap.get(id)");
    // activeBreakpoint(스칼라 UI 세션 상태)는 canonical 문서에 없어 store 가 SSOT —
    // useStore 로 읽는다 (ADR-154 responsive 표시, StylesPanel/BuilderCanvas 와 동일).
    // 계약의 금지 대상은 "요소(elements)를 store 로 읽어 canonical read hook 을 우회"
    // 하는 것이므로, blanket useStore ban 대신 element-read 경로만 정밀 차단한다.
    expect(source).toContain("state.activeBreakpoint");
    expect(source).not.toContain("state.elements");
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

  it("reads fill action state from the canonical node index", async () => {
    const source = await readFile(
      resolve(__dirname, "useFillActions.ts"),
      "utf-8",
    );

    expect(source).toContain("getNodeMap().get(selectedElementId)");
    expect(source).toContain("readCanonicalNodeFillPayload(node)");
    expect(source).not.toContain("getCanonicalDocumentElementsView");
    expect(source).not.toContain("visitCanonicalDocumentElements");
    expect(source).not.toContain("legacyProps");
  });

  it("uses canonical property element for reset dirty-state reads", async () => {
    const source = await readFile(
      resolve(__dirname, "useResetStyles.ts"),
      "utf-8",
    );

    expect(source).toContain('useCanonicalPropertyElement(selectedId ?? "")');
    expect(source).toContain("getNodeMap");
    expect(source).toContain("getParent");
    expect(source).toContain("getActiveCanonicalResetElement(selectedId)");
    expect(source).not.toContain("getCanonicalDocumentElementsView");
    expect(source).not.toContain("visitCanonicalDocumentElements");
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
