/**
 * @fileoverview Canonical Resolver Cache Contracts — ADR-903 P0
 *
 * resolver 캐시 life-cycle:
 * - Preview iframe과 Skia sprite 양쪽이 **공통 resolver의 동일 캐시 인스턴스**
 *   공유 (cross-renderer reuse) — Gate G2 (a)의 전제
 * - invalidation 단위: ref root를 루트로 하는 subtree. 하나의 descendants path
 *   override 변경 시 해당 ref instance의 resolved subtree만 dirty. 형제 ref
 *   instance는 cache hit 유지
 * - parent propagation: subtree dirty가 조상 ref로 전파되는 경우는
 *   (1) 자식 ref가 다른 reusable로 교체 (2) slot children 배열 구조 변경 뿐.
 *   속성 patch는 subtree 내부에만 dirty
 *
 * P0 범위: 타입 시그니처 + 성능 계약 수치 박제. 구현은 Phase 2+.
 */
// ──────────────────────────────────────────────────────────────────────────────
// Fingerprint Helpers
// ──────────────────────────────────────────────────────────────────────────────
/**
 * `descendants` 객체의 stable hash를 계산한다.
 *
 * key 정렬 후 deep-equal 기반. resolver 캐시 키의 4번째 요소인
 * `descendantsFingerprint` 생성에 사용.
 *
 * @param descendantOverrides — `RefNode.descendants` 또는 undefined
 * @returns stable hash string (key 정렬 + deep-equal 기반)
 *
 * @stub 실제 구현은 Phase 2+
 */
export function computeDescendantsFingerprint(_descendantOverrides) {
    throw new Error("P0 stub — computeDescendantsFingerprint: Phase 2+ 구현 대상");
}
/**
 * slot children 배열 구조의 stable hash를 계산한다.
 *
 * 배열 구조(id, type 순서) 기반. resolver 캐시 키의 4번째 요소인
 * `slotBindingFingerprint` 생성에 사용.
 *
 * parent propagation 규칙:
 * - slot children 배열 **구조** 변경 시 조상 ref로 dirty 전파
 * - 개별 자식 속성 patch는 subtree 내부에만 dirty (전파 없음)
 *
 * @param slotChildren — slot에 채워진 CanonicalNode 배열 또는 undefined
 * @returns stable hash string (배열 구조 기반)
 *
 * @stub 실제 구현은 Phase 2+
 */
export function computeSlotBindingFingerprint(_slotChildren) {
    throw new Error("P0 stub — computeSlotBindingFingerprint: Phase 2+ 구현 대상");
}
// ──────────────────────────────────────────────────────────────────────────────
// Performance Contract
// ──────────────────────────────────────────────────────────────────────────────
/**
 * resolver 성능 상한 계약 — P0에서 수치 박제.
 *
 * 이 수치는 Phase 2 resolver 구현 완료 시 실측으로 검증하고,
 * 실측값이 이 상한을 초과하면 성능 regression으로 간주한다.
 * (Phase 2 Gate G2 regression 기준으로 사용)
 *
 * 측정 조건:
 * - 1000-node tree (중첩 ref 5단계, descendants 평균 3 override) 기준
 * - macOS M-series CPU, Node.js 20+, cold/hot 구분
 *
 * Phase 2 완료 시 실측 기반으로 수치 업데이트 가능.
 * 수치 완화(상한 증가)는 PR에서 명시적 승인 필요.
 */
export const RESOLVER_PERFORMANCE_CONTRACT = {
    /** cold cache resolve P50 (ms) — 1000-node tree */
    coldResolveP50Ms: 5,
    /** cold cache resolve P99 (ms) — 1000-node tree */
    coldResolveP99Ms: 50,
    /** hot cache (cache hit) fetch P50 (ms) */
    hotResolveP50Ms: 0.5,
    /** hot cache (cache hit) fetch P99 (ms) */
    hotResolveP99Ms: 5,
};
/**
 * `resolve` — `ResolveFn` stub 구현체.
 *
 * Phase 2에서 실제 resolver로 교체된다.
 * Phase 1 adapter에서 import하여 "resolver 연결 지점"으로 사용.
 *
 * @stub 실제 구현은 Phase 2+
 */
export const resolve = (_doc, _cache, _imports) => {
    throw new Error("P0 stub — resolve: Phase 2+ 구현 대상");
};
//# sourceMappingURL=canonical-resolver.types.js.map