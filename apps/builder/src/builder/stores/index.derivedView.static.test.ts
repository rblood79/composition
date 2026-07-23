import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("builder store canonical derived view callers", () => {
  it("uses active canonical document traversal without useCanonicalElements hooks", async () => {
    const source = await readFile(resolve(__dirname, "index.ts"), "utf-8");

    // ADR-126 가드 유지 — derived view caller 는 active canonical document 를 순회하고
    // legacy useCanonicalElements/useCanonicalSelectedElement 훅을 쓰지 않는다.
    // 순회 헬퍼는 8cb3be971 (2026-05-11) 리팩토링으로 visitCanonicalDocumentElements →
    // getCanonicalDocumentElementsView (문서 참조당 1회 캐시된 shared view) 로 대체됐고,
    // elements 파생은 useMemo 대신 view 직접 참조로 전환됨. selected element 파생은 useMemo 유지.
    expect(source).toContain("useActiveCanonicalDocument");
    expect(source).toContain("getCanonicalDocumentElementsView");
    expect(source).toContain(
      "const canonicalSelectedElement = useMemo(() => {",
    );
    expect(source).not.toContain("useCanonicalElements");
    expect(source).not.toContain("useCanonicalSelectedElement");
  });
});
