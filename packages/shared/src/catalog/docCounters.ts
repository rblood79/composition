/**
 * ADR-265 Phase 0 — 문서 층 (graph · transaction · runtime step · composition root · read model ·
 * Layers · 선택 · 메뉴) 의 결정적 카운트.
 *
 * 프레임 하니스 (`perf-baseline.mjs` frame lane) 가 부류마다 reset → snapshot 해
 * `results.<부류>.counts.doc` 로 기록하고, ratchet (ADR-246) 이 그 값을 상한으로 막는다. 호출부는
 * 전부 `process.env.NODE_ENV === "development"` 게이트 안이라 production 빌드에서는 사라진다
 * (ADR-263 `renderCounters.ts` 와 같은 형태). 고정 필드에 정수만 더한다 — 문서 층 함수 안의 순수
 * 카운트 (훑은 id · 비교 · 재계산 수) 만 두고, React 커밋 · GC 에 흔들리는 값은 넣지 않는다.
 */
export interface DocCounters {
  /** `graph.collectAffectedIds` 호출 수 · 큐에서 꺼낸 수 · 그중 소유 자식 확장으로 들어간 수 · 결과 크기 합. (C1) */
  affectedCalls: number;
  affectedVisited: number;
  affectedSubtree: number;
  affectedResult: number;
  /** `graph.replace` 가 old · new entry 에서 열거한 edge 수 (body 같은 큰 컨테이너는 children 만큼). */
  replaceEdges: number;
  /** commit 이 복제한 children id 수 (`ownedRecord` 의 `structuredClone` — 이전 entry 와 공유하면 0). */
  commitChildrenCloned: number;
  /** `validateDefinitionCycles` 가 훑은 정의 수. (C10) */
  definitionCycleChecks: number;
  /** transaction 의 staged entry 수 · entry 검증 수 · `structuredClone(ops)` 의 직렬 길이 (상수 비용). */
  stagedEntries: number;
  validatedEntries: number;
  opsCloneBytes: number;
  /** runtime step 수 · 무효화 id 수 · 저장 대기열 entry JSON 길이 합 (상수 비용). */
  steps: number;
  stepInvalidated: number;
  persistStringifyBytes: number;
  /** composition root plan: resolver 방문 · 레이아웃 입력 방문 · 전체 입력 그래프를 훑은 step 수. (C3) */
  rootResolverVisits: number;
  rootLayoutInputVisits: number;
  rootWholeGraphSteps: number;
  /** `keep` 이 통째로 복사한 page member Set 의 크기 합. (C3) */
  rootMembersCopied: number;
  /** `stateReaders` · `overrideDependents` 가 훑은 record 수. (C4) */
  stateReadersScanned: number;
  overrideDependentsScanned: number;
  /** deliver 의 notice 수 · canvas · dom 리스너 호출 수. */
  deliverNotices: number;
  deliverCanvas: number;
  deliverDom: number;
  /** read model: stale 로 모은 read 수 · 그중 byIndex 로 들어온 수 · 재계산 수 · 값 비교 JSON 길이 합. (C2) */
  readStale: number;
  readStaleByIndex: number;
  readRecomputed: number;
  readCompareBytes: number;
  /** workspace afterStep: 테마 상태 계산 · root 교체 · Components key 직렬화 길이. (C5) */
  themeStateComputed: number;
  rootReplaced: number;
  componentsKeyBytes: number;
  /** Layers: rebuild 수 · 만든 행 수 · step 마다 본 gated 행 · 이름 재판정 행 수. (C6) */
  layersRebuilds: number;
  layersRowsBuilt: number;
  layersGatedChecked: number;
  layersRenameChecked: number;
  /** 선택: `findPositionOfRecord` 의 형제 비교 수. (C8) */
  selectSiblingCompares: number;
  /** 자동 HTML id 의 빈 번호 탐색 수 (`catalogUniqueHtmlId` · Attributes 패널). (C11) */
  htmlIdProbes: number;
  /** 메뉴 · 액션 바: 명령 dry-run 수 · 그 계획이 거절된 수. (C7) */
  menuDryRuns: number;
  menuRefusals: number;
  /** `useCatalogEditContract` 의 `invalidatedIds.includes` 호출 수. (C9) */
  editContractIncludes: number;
}

const counters: DocCounters = {
  affectedCalls: 0,
  affectedVisited: 0,
  affectedSubtree: 0,
  affectedResult: 0,
  replaceEdges: 0,
  commitChildrenCloned: 0,
  definitionCycleChecks: 0,
  stagedEntries: 0,
  validatedEntries: 0,
  opsCloneBytes: 0,
  steps: 0,
  stepInvalidated: 0,
  persistStringifyBytes: 0,
  rootResolverVisits: 0,
  rootLayoutInputVisits: 0,
  rootWholeGraphSteps: 0,
  rootMembersCopied: 0,
  stateReadersScanned: 0,
  overrideDependentsScanned: 0,
  deliverNotices: 0,
  deliverCanvas: 0,
  deliverDom: 0,
  readStale: 0,
  readStaleByIndex: 0,
  readRecomputed: 0,
  readCompareBytes: 0,
  themeStateComputed: 0,
  rootReplaced: 0,
  componentsKeyBytes: 0,
  layersRebuilds: 0,
  layersRowsBuilt: 0,
  layersGatedChecked: 0,
  layersRenameChecked: 0,
  selectSiblingCompares: 0,
  htmlIdProbes: 0,
  menuDryRuns: 0,
  menuRefusals: 0,
  editContractIncludes: 0,
};

/** 카운터 객체 — 호출부가 필드를 직접 더한다 (dev 게이트 안에서만). */
export const docCounters: DocCounters = counters;

export function snapshotDocCounters(): DocCounters {
  return { ...counters };
}

export function resetDocCounters(): void {
  for (const key of Object.keys(counters) as Array<keyof DocCounters>)
    counters[key] = 0;
}
