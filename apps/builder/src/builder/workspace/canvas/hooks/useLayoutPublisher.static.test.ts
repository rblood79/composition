import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("useLayoutPublisher invalidation contract", () => {
  it("republishes layout when page/frame input structure changes without layoutVersion bump", async () => {
    const source = await readFile(
      resolve(__dirname, "useLayoutPublisher.ts"),
      "utf-8",
    );

    expect(source).toMatch(
      /const layoutInputKey = \[\.\.\.pages, \.\.\.framePages\]/,
    );
    expect(source).toMatch(/createPageElementsSignature\(/);
    expect(source).toMatch(/createPageLayoutSignature\(/);
    expect(source).toMatch(
      /const readinessKey = \[\.\.\.pages, \.\.\.framePages\]/,
    );
    expect(source).toMatch(
      /\}, \[layoutVersion, dimensionKey, layoutInputKey, readinessKey\]\);/,
    );
  });

  it("clears stale page/frame layout maps when the active render mode changes", async () => {
    const source = await readFile(
      resolve(__dirname, "useLayoutPublisher.ts"),
      "utf-8",
    );

    expect(source).toContain("const publishedKeysRef = useRef<Set<string>>");
    expect(source).toContain("const layoutUpdates: Array<");
    expect(source).toContain("const key = getLayoutRootKey(bodyElement);");
    expect(source).toContain('from "../layout/layoutRootKey"');
    expect(source).not.toContain("getFrameElementMirrorId");
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
