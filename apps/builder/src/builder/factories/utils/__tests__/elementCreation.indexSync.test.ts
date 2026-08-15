import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 복합 컴포넌트(NumberField/Select/ComboBox 등 COMPLEX_COMPONENT_TAGS) 추가 경로
 * `addElementsToStore` 의 canonical ↔ derived store 동기화 계약 가드.
 *
 * 배경: `mergeElementsCanonicalPrimary` 는 "canonical store mutation only.
 * Derived store cache updates are caller-owned" 계약이다 (canonicalMutations.ts).
 * canonical merge 후 `useStore.setState` + `_rebuildIndexes` 가 빠지면, 추가된
 * 복합 컴포넌트가 canonical 에는 들어가 Skia 화면엔 보이지만 legacy
 * `elementsMap` 에는 없어 Delete 핸들러 (`elementsMap.get(id)` → undefined) 가
 * "Only body elements selected" 로 삭제를 거부한다.
 *
 * ADR-184 파일럿 (2026-08-15): 순서 (canonical → set → rebuild → history →
 * persist) 는 `runCanonicalMutation` (canonicalMutationRunner.ts) 이 소유한다.
 * 순서 자체의 단언은 러너 단위 테스트 (canonicalMutationRunner.test.ts) 가
 * 담당하고, 본 가드는 이 파일이 **러너를 경유**하며 수동 순서 형태로 회귀하지
 * 않았는지를 지킨다.
 */
describe("addElementsToStore canonical/derived index sync contract (ADR-184 러너 경유)", () => {
  it("runCanonicalMutation 경유 + canonical 스테이지가 merge, store 스테이지가 setState 를 담당한다", async () => {
    const source = await readFile(
      resolve(__dirname, "../elementCreation.ts"),
      "utf-8",
    );

    const fnIndex = source.indexOf("export function addElementsToStore");
    expect(fnIndex).toBeGreaterThanOrEqual(0);

    const runnerIndex = source.indexOf("runCanonicalMutation({", fnIndex);
    expect(runnerIndex).toBeGreaterThan(fnIndex);

    const canonicalStageIndex = source.indexOf("canonical: () =>", runnerIndex);
    const mergeIndex = source.indexOf(
      "mergeElementsCanonicalPrimary([parent, ...children])",
      canonicalStageIndex,
    );
    const storeStageIndex = source.indexOf("store: () =>", runnerIndex);
    const setStateIndex = source.indexOf("useStore.setState(", storeStageIndex);

    // canonical 스테이지 (merge) 가 store 스테이지 (setState) 앞 — 러너가
    // 이 순서로 실행한다 (스테이지 선언 순서는 가독 계약).
    expect(canonicalStageIndex).toBeGreaterThan(runnerIndex);
    expect(mergeIndex).toBeGreaterThan(canonicalStageIndex);
    expect(storeStageIndex).toBeGreaterThan(mergeIndex);
    expect(setStateIndex).toBeGreaterThan(storeStageIndex);
  });

  it("수동 rebuild/persist 를 재도입하지 않는다 (③⑤ 는 러너 소유)", async () => {
    const source = await readFile(
      resolve(__dirname, "../elementCreation.ts"),
      "utf-8",
    );

    // 러너 경유 후 이 파일에 수동 _rebuildIndexes / 로컬 persist 헬퍼가
    // 다시 생기면 수동 순서 형태로의 회귀 신호다 (이중 rebuild 또는 러너 우회).
    expect(source).not.toContain("_rebuildIndexes");
    expect(source).not.toContain("persistActiveCanonicalDocument");
  });

  it("store 스테이지가 parent + children 추가 + layoutVersion 증가를 유지한다", async () => {
    const source = await readFile(
      resolve(__dirname, "../elementCreation.ts"),
      "utf-8",
    );

    const fnIndex = source.indexOf("export function addElementsToStore");
    const setStateStart = source.indexOf("useStore.setState(", fnIndex);
    const setStateBlock = source.slice(
      setStateStart,
      source.indexOf("history:", setStateStart),
    );

    // 구조 변경이므로 elements 에 parent + children 추가 + layoutVersion 증가 (레이아웃
    // 재계산 트리거). createAddElementAction 의 검증된 형태와 동일.
    expect(setStateBlock).toContain(
      "elements: [...prev.elements, parent, ...children]",
    );
    expect(setStateBlock).toContain("layoutVersion: prev.layoutVersion + 1");
  });
});
