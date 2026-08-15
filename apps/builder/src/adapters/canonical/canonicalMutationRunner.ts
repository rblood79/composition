/**
 * @fileoverview canonical mutation 순서 러너 (ADR-184).
 *
 * 4단 순서 (① canonical → ② store set → ③ `_rebuildIndexes` → ④ history →
 * ⑤ persist 백그라운드) 를 **러너가 소유**한다 — 신규 mutation 은 스테이지
 * 함수만 제공하며, set-1차 형태의 순서 위반은 시그니처상 표현 불가.
 *
 * 적용 범위는 **신규 mutation 경로 한정** — 기존 경로 (breakdown §4-3
 * allowlist 15파일) 는 이관하지 않는다 ("회귀 위험 대비 이득 작음" 선행 판정,
 * state-management.md 잔존 표). 신규 경로의 wrapper 직호출은
 * `canonicalMutationRunner.static.test.ts` 가 차단한다.
 *
 * 부분 실패 semantics (R3 — 러너는 새 복구 로직을 발명하지 않는다):
 * - 동기 구간 (canonical / store / rebuild / history) 은 throw 전파 (현행 관례)
 * - persist 는 fire-and-forget + 오류 로깅 (현행 `persistActiveCanonicalDocument`
 *   관례 — 메모리 상태는 정상 유지)
 *
 * `rebuildIndexes` 는 builder store 소유라 ESM circular import chain 차단을
 * 위해 callback registration pattern 을 쓴다 (canonicalMutations.ts 의
 * `registerCanonicalMutationStoreActions` 와 동일 이유 — BuilderCore 가 등록).
 */

import type { DocumentPersistOptions } from "@/lib/db";
import { getDB } from "@/lib/db";
import { useCanonicalDocumentStore } from "../../builder/stores/canonical/canonicalDocumentStore";
import type { CanonicalMutationResult } from "./canonicalMutations";

// ─────────────────────────────────────────────
// Bridge registration (BuilderCore DI)
// ─────────────────────────────────────────────

export interface CanonicalMutationRunnerBridge {
  /** ③ 스테이지 — builder store 의 `_rebuildIndexes()` closure */
  rebuildIndexes: () => void;
}

let _bridge: CanonicalMutationRunnerBridge | null = null;

export function registerCanonicalMutationRunnerBridge(
  bridge: CanonicalMutationRunnerBridge,
): void {
  _bridge = bridge;
}

/** 테스트 / 모듈 재로드 후 초기화 (afterEach 에서 호출 가능). */
export function resetCanonicalMutationRunnerBridge(): void {
  _bridge = null;
}

export function isCanonicalMutationRunnerBridgeRegistered(): boolean {
  return _bridge !== null;
}

function getBridge(): CanonicalMutationRunnerBridge {
  if (!_bridge) {
    throw new Error(
      "[canonicalMutationRunner] bridge not registered. " +
        "Call registerCanonicalMutationRunnerBridge() before running mutations.",
    );
  }
  return _bridge;
}

// ─────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────

export interface CanonicalMutationStages<
  TResult extends CanonicalMutationResult = CanonicalMutationResult,
> {
  /**
   * ① canonical document 갱신 — wrapper (`mergeElementsCanonicalPrimary` /
   * `setElementsCanonicalPrimary` / `moveElement*` 등) 호출 closure. **required**
   * — canonical 없이 store 만 갱신하는 형태 (set-1차 위반) 는 타입 에러.
   */
  canonical: () => TResult;
  /**
   * ② store set — legacy mirror (elements 배열 / layoutVersion 등) 갱신.
   * move형은 canonical derive (`getCanonicalOrStoreElements`) 반영도 이 슬롯.
   * canonical-only silent edit (useTextEdit 형) 은 생략 가능.
   */
  store?: (result: TResult) => void;
  /**
   * ④ history 기록 — rebuild **뒤** 슬롯 (기준형 `addElementsToStore` +
   * CLAUDE.md 파이프라인 Memory → Index → History → DB 정합). prev-상태
   * 캡처가 필요하면 러너 호출 **전** closure 로 캡처한다 (batch형 관례).
   */
  history?: (result: TResult) => void;
  /**
   * ⑤ persist 옵션 — persist 자체는 러너 소유 (호출자 선택 아님). 대량 감소가
   * 의도된 mutation (삭제 계열) 만 급감 가드 통과 사유를 명시한다.
   */
  persistOptions?: DocumentPersistOptions;
}

/**
 * canonical mutation 을 고정 순서로 실행한다.
 *
 * canonical → store set → rebuildIndexes → history → persist(백그라운드).
 * 반환값은 ① canonical 스테이지의 결과 (`CanonicalMutationResult`).
 */
export function runCanonicalMutation<TResult extends CanonicalMutationResult>(
  stages: CanonicalMutationStages<TResult>,
): TResult {
  const bridge = getBridge();

  const result = stages.canonical(); // ①
  stages.store?.(result); // ②
  bridge.rebuildIndexes(); // ③ — 러너 소유
  stages.history?.(result); // ④
  void persistActiveCanonicalDocumentInBackground(stages.persistOptions); // ⑤

  return result;
}

/**
 * 활성 canonical document 를 IndexedDB 에 저장 (fire-and-forget).
 * 각 store action 파일의 로컬 `persistActiveCanonicalDocument` 와 동일 형태 —
 * 러너 경유 경로에서는 이 단일 구현이 대체한다.
 */
async function persistActiveCanonicalDocumentInBackground(
  options?: DocumentPersistOptions,
): Promise<void> {
  try {
    const canonical = useCanonicalDocumentStore.getState();
    const projectId = canonical.currentProjectId;
    if (!projectId) return;
    const doc = canonical.documents.get(projectId);
    if (!doc) return;
    const db = await getDB();
    await db.documents.put(projectId, doc, options);
  } catch (error) {
    console.warn(
      "⚠️ [canonicalMutationRunner] canonical document 저장 중 오류 (메모리는 정상):",
      error,
    );
  }
}
