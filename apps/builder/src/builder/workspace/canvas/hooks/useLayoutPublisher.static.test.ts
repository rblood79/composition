import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("useLayoutPublisher invalidation contract", () => {
  it("republishes layout when page/frame input structure changes without layoutVersion bump", async () => {
    const source = await readFile(
      resolve(__dirname, "useLayoutPublisher.ts"),
      "utf-8",
    );

    expect(source).toMatch(/\[\.\.\.pages, \.\.\.framePages\]/);
    expect(source).toMatch(/createPageElementsSignature\(/);
    expect(source).toMatch(/createPageLayoutSignature\(/);
    expect(source).toMatch(
      /\}, \[layoutVersion, dimensionKey, layoutInputKey, readinessKey\]\);/,
    );
  });

  // ADR-172 Phase 2: 세 키는 훅 본문에서 매 렌더 조립되고 있었다. 팬/줌은 rAF
  // 당 1회 리렌더를 유발하므로 요소당 116 키 문자열 조립이 프레임마다 돌았다
  // (N=9,728 에서 프레임당 12.8MB). memo 가 빠지면 그 비용이 그대로 복귀한다.
  it("memoizes the three publish keys (ADR-172 Phase 2)", async () => {
    const source = await readFile(
      resolve(__dirname, "useLayoutPublisher.ts"),
      "utf-8",
    );

    for (const key of ["dimensionKey", "layoutInputKey", "readinessKey"]) {
      expect(source).toMatch(new RegExp(`const ${key} = useMemo\\(`));
    }
    // 훅 본문 직접 조립 복귀 차단 — `const X = [...pages` / `const X = pages`
    expect(source).not.toMatch(
      /const (dimensionKey|layoutInputKey|readinessKey) =\s*(\[\.\.\.)?pages/,
    );
  });

  // ADR-172 R1 (HIGH): addElement 는 elements/layoutVersion 갱신 후
  // pageIndex/elementsMap 을 **별도 commit** 으로 rebuild 하고, 두 번째 commit 은
  // layoutVersion 이 불변이다. deps 를 layoutVersion 으로 좁히면 그 commit 이
  // 통째로 누락돼 신규 child 가 layoutMap 없이 투명/미등록으로 남는다.
  // 배열 identity 를 deps 로 두는 것이 그 계약의 유일한 표현이다.
  it("keys memo on page/frame array identity, never on layoutVersion alone (R1)", async () => {
    const source = await readFile(
      resolve(__dirname, "useLayoutPublisher.ts"),
      "utf-8",
    );

    // 세 memo 의 deps 가 모두 [framePages, pages]
    const depsOccurrences = source.match(/\[framePages, pages\]/g) ?? [];
    expect(depsOccurrences.length).toBe(3);
    // layoutVersion 이 deps 배열 선두로 등장하는 곳은 useEffect 단 1곳.
    // memo deps 로 새어 들어가면 여기서 2 이상이 된다.
    const layoutVersionDeps = source.match(/\[layoutVersion[,\]]/g) ?? [];
    expect(layoutVersionDeps.length).toBe(1);
  });

  it("clears stale page/frame layout maps when the active render mode changes", async () => {
    const source = await readFile(
      resolve(__dirname, "useLayoutPublisher.ts"),
      "utf-8",
    );

    expect(source).toContain("const publishedKeysRef = useRef<Set<string>>");
    expect(source).toContain("const layoutUpdates: Array<");
    expect(source).toMatch(
      /const key =\s*bodyElement\.page_id\s*\?\?\s*getFrameElementMirrorId\(bodyElement\)\s*\?\?\s*bodyElement\.id;/,
    );
    expect(source).toContain("activeKeys.add(key);");
    expect(source).toContain(
      "const sourceElementById = new Map<string, CanvasLayoutNode>();",
    );
    expect(source).toContain(
      "sourceElementById.set(resolvedBody.id, resolvedBody);",
    );
    expect(source).toContain("for (const element of pageElements)");
    expect(source).toContain("elementById: sourceElementById,");
    expect(source).toContain("layoutUpdates.push({ key, map: layoutMap });");
    expect(source).toMatch(/publishFilteredChildrenMap\(null, key\);/);
    expect(source).toMatch(/publishSyntheticElementsMap\(null, key\);/);
    expect(source).toMatch(
      /publishLayoutMapsBatch\(layoutUpdates, staleKeys\);/,
    );
    expect(source).not.toMatch(/publishLayoutMap\(layoutMap, key\);/);
    expect(source).toContain("publishedKeysRef.current = activeKeys;");
  });

  it("does not independently resolve canonical refs while publishing layout", async () => {
    const source = await readFile(
      resolve(__dirname, "useLayoutPublisher.ts"),
      "utf-8",
    );

    expect(source).not.toContain("resolveCanonicalRefTree");
    expect(source).not.toMatch(/const resolvedTree = resolveCanonicalRefTree/);
  });

  it("uses projectionVersion as part of the layout publish invalidation key", async () => {
    const source = await readFile(
      resolve(__dirname, "useLayoutPublisher.ts"),
      "utf-8",
    );

    expect(source).toContain("input.projectionVersion");
  });

  // ADR-154 R1: responsive override 는 시그니처/엔진 소비 이전에 resolve 되어야
  // activeBreakpoint·override 변경이 자연히 캐시 miss 를 유발한다. resolve 가
  // signature 계산 앞단에서 누락되면 편집이 캐시 히트로 흡수돼 무반영이 된다.
  it("resolves responsive overrides before signature/layout (ADR-154)", async () => {
    const source = await readFile(
      resolve(__dirname, "useLayoutPublisher.ts"),
      "utf-8",
    );

    // resolve helper import + activeBreakpoint 읽기
    expect(source).toContain("resolveResponsiveLayoutNode");
    expect(source).toContain(
      "const activeBreakpoint = useStore.getState().activeBreakpoint;",
    );
    // body + 각 요소가 resolve 를 거침 (포맷 무관 — 인자 순서만 확인)
    expect(source).toMatch(
      /resolveResponsiveLayoutNode\(\s*bodyElement,\s*activeBreakpoint,?\s*\)/,
    );
    expect(source).toMatch(
      /resolveResponsiveLayoutNode\(\s*element,\s*activeBreakpoint,?\s*\)/,
    );
    // 시그니처는 resolved body/elements 로 계산 (raw 아님)
    expect(source).toMatch(
      /createPageLayoutSignature\(\s*resolvedBody,\s*freshElements,?\s*\)/,
    );
    expect(source).toContain("bodyElement: resolvedBody,");
  });
});
