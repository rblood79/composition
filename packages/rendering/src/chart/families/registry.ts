/**
 * ADR-306 — family 등록과 지연 로드 (breakdown §4.3).
 *
 * 첫 화면 번들에 드는 것은 이 파일 (등록 기구) 과 `CHART_FAMILY_OF` (종류 목록) 뿐이다 — family 의
 * 계산 코드 · sample 은 각자 chunk (`import()`) 다 (사용자 결정 2).
 *
 * - `computeChartScene` 은 동기라 로드를 시작하지 않는다. 로드는 DOM (`Chart.components.tsx` effect) 과
 *   Builder scene-node 층 (`ruleShapes.ts`) 이 건다 — resolver 는 Preview · Publish 도 지나는 공용
 *   순수 함수라 걸지 않는다.
 * - 완료는 `subscribeChartFamilies` 로 알리고 `chartFamilyEpoch()` 가 1 오른다. Chart 계산 결과를 잡는
 *   memo 의 키에 epoch 를 넣는다 (메모리 `feedback-memo-key-needs-async-readiness`).
 * - 진행 중이면 같은 promise, 실패하면 다음 호출이 다시 시도한다 (실패 promise 를 남기지 않는다).
 */
import type { ChartFamilyId } from "../types";
import type { ChartFamily } from "./types";

type Loader = () => Promise<ChartFamily>;

/**
 * family → chunk. 아직 구현되지 않은 family 는 표에 없다 (breakdown §8 — Phase 4 · 5 가 더한다) —
 * 그 종류의 scene 은 `chartFamily.unavailable` 설정 오류다.
 */
const LOADERS: Partial<Record<ChartFamilyId, Loader>> = {
  kpi: () => import("./kpi").then((module) => module.kpiFamily),
  category: () => import("./category").then((module) => module.categoryFamily),
  distribution: () =>
    import("./distribution").then((module) => module.distributionFamily),
  matrix: () => import("./matrix").then((module) => module.matrixFamily),
};

const loaded = new Map<ChartFamilyId, ChartFamily>();
const inflight = new Map<ChartFamilyId, Promise<ChartFamily>>();
const failed = new Map<ChartFamilyId, unknown>();
const listeners = new Set<() => void>();
let epoch = 0;

function notify(): void {
  epoch += 1;
  for (const listener of [...listeners]) listener();
}

/** 이 build 에 그 family 의 chunk 가 있는가 (없으면 종류가 설정 오류로 그려진다). */
export function chartFamilyAvailable(id: ChartFamilyId): boolean {
  return LOADERS[id] !== undefined;
}

/** 동기 조회 — 로드됐으면 family, 아니면 undefined. */
export function getChartFamily(id: ChartFamilyId): ChartFamily | undefined {
  return loaded.get(id);
}

/** 마지막 로드 실패 (다시 시도하면 지워진다). */
export function chartFamilyError(id: ChartFamilyId): unknown {
  return failed.get(id);
}

export function loadChartFamily(id: ChartFamilyId): Promise<ChartFamily> {
  const ready = loaded.get(id);
  if (ready) return Promise.resolve(ready);
  const pending = inflight.get(id);
  if (pending) return pending;
  const loader = LOADERS[id];
  if (!loader)
    return Promise.reject(new Error(`CHART_FAMILY_UNAVAILABLE:${id}`));
  failed.delete(id);
  const promise = loader().then(
    (family) => {
      inflight.delete(id);
      loaded.set(id, family);
      notify();
      return family;
    },
    (error: unknown) => {
      inflight.delete(id);
      failed.set(id, error);
      // 실패도 알린다 — DOM 이 다시 시도 버튼을 낸다.
      notify();
      throw error;
    },
  );
  inflight.set(id, promise);
  return promise;
}

export function subscribeChartFamilies(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 로드 · 실패마다 +1. memo 키 · `useSyncExternalStore` snapshot. */
export function chartFamilyEpoch(): number {
  return epoch;
}

/**
 * 테스트 전용 — 로더를 바꿔 끼운다 (실패 · 지연 재현). 반환 함수가 원래대로 되돌리고 로드 상태를
 * 지운다.
 */
export function __setChartFamilyLoaderForTest(
  id: ChartFamilyId,
  loader: Loader | undefined,
): () => void {
  const original = LOADERS[id];
  LOADERS[id] = loader;
  loaded.delete(id);
  inflight.delete(id);
  failed.delete(id);
  return () => {
    LOADERS[id] = original;
    loaded.delete(id);
    inflight.delete(id);
    failed.delete(id);
  };
}
