import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("selection slice canonical hierarchy lookup contract", () => {
  it("uses ADR-127 canonical node helpers before store bootstrap elements", async () => {
    const source = await readFile(resolve(__dirname, "selection.ts"), "utf-8");

    expect(source).toContain("getNodeMap");
    expect(source).toContain("getChildren");
    expect(source).toContain("getParent");
    expect(source).not.toContain("visitCanonicalDocumentElements");
    expect(source).not.toContain("getActiveCanonicalSelectionElements");
    expect(source).not.toContain("canonicalElementSnapshot");

    // canonical 문서가 아직 없을 때(bootstrap)의 폴백은 의도된 것이고,
    // `elementsMap`/`childrenMap` 을 O(1) 로 조회한다 (구 elements.find() 선형
    // 스캔에서 개선). 막으려는 것은 그 폴백이 canonical **앞에** 서는 것이므로
    // 이름을 금지하지 말고 순서를 잠근다.
    const canonicalIndex = source.indexOf("getNodeMap().get(elementId)");
    const fallbackIndex = source.indexOf("state.elementsMap.get(elementId)");
    expect(canonicalIndex).toBeGreaterThanOrEqual(0);
    expect(fallbackIndex).toBeGreaterThan(canonicalIndex);
    // 폴백은 canonical 문서 부재로 게이트된다 — 무조건 실행되면 안 된다.
    expect(source).toContain("if (hasCanonicalDocument)");
  });
});
