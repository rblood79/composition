import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 복합 컴포넌트(NumberField/Select/ComboBox 등 COMPLEX_COMPONENT_TAGS) 추가 경로
 * `addElementsToStore` 의 canonical ↔ derived store 동기화 계약 가드.
 *
 * 배경: `mergeElementsCanonicalPrimary` 는 "canonical store mutation only.
 * Derived store cache updates are caller-owned" 계약이다 (canonicalMutations.ts).
 * 이 caller(addElementsToStore)가 canonical merge 후 `useStore.setState` +
 * `_rebuildIndexes` 를 호출하지 않으면, 추가된 복합 컴포넌트가 canonical 에는 들어가
 * Skia 화면엔 보이지만 legacy `elementsMap` 에는 없어 Delete 핸들러
 * (`elementsMap.get(id)` → undefined)가 "Only body elements selected" 로 삭제를
 * 거부한다. 새로고침(canonical → elementsMap hydrate) 후에만 회복되던 버그.
 *
 * 순서 엄수: canonical merge 1차 → setState → _rebuildIndexes
 * (set 1차로 두면 _rebuildIndexes 가 stale canonical mirror 를 빌드하는 race).
 */
describe("addElementsToStore canonical/derived index sync contract", () => {
  it("calls mergeElementsCanonicalPrimary → useStore.setState → _rebuildIndexes in order", async () => {
    const source = await readFile(
      resolve(__dirname, "../elementCreation.ts"),
      "utf-8",
    );

    const fnIndex = source.indexOf("export function addElementsToStore");
    expect(fnIndex).toBeGreaterThanOrEqual(0);

    const mergeIndex = source.indexOf(
      "mergeElementsCanonicalPrimary([parent, ...children]);",
      fnIndex,
    );
    const setStateIndex = source.indexOf("useStore.setState(", mergeIndex);
    const rebuildIndex = source.indexOf(
      "useStore.getState()._rebuildIndexes();",
      setStateIndex,
    );

    // 세 호출이 모두 존재하고 (canonical merge → setState → _rebuildIndexes) 순서다.
    expect(mergeIndex).toBeGreaterThan(fnIndex);
    expect(setStateIndex).toBeGreaterThan(mergeIndex);
    expect(rebuildIndex).toBeGreaterThan(setStateIndex);
  });

  it("setState appends parent + children and bumps layoutVersion", async () => {
    const source = await readFile(
      resolve(__dirname, "../elementCreation.ts"),
      "utf-8",
    );

    const fnIndex = source.indexOf("export function addElementsToStore");
    const setStateBlock = source.slice(
      source.indexOf("useStore.setState(", fnIndex),
      source.indexOf("useStore.getState()._rebuildIndexes();", fnIndex),
    );

    // 구조 변경이므로 elements 에 parent + children 추가 + layoutVersion 증가 (레이아웃
    // 재계산 트리거). createAddElementAction 의 검증된 형태와 동일.
    expect(setStateBlock).toContain(
      "elements: [...prev.elements, parent, ...children]",
    );
    expect(setStateBlock).toContain("layoutVersion: prev.layoutVersion + 1");
  });
});
