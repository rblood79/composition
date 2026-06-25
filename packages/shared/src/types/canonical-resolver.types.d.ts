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
import type { CanonicalNode, CompositionDocument } from "./composition-document.types";
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
export declare function computeDescendantsFingerprint(_descendantOverrides: Record<string, unknown> | undefined): string;
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
export declare function computeSlotBindingFingerprint(_slotChildren: CanonicalNode[] | undefined): string;
/**
 * resolver 캐시 키 — 4-tuple.
 *
 * 조합이 같으면 resolved subtree가 동일하다는 것을 보장.
 *
 * - `docVersion`: 문서 포맷 버전 (`CompositionDocument.version`)
 * - `rootRefId`: 캐시 루트 ref 노드의 `id`
 * - `descendantsFingerprint`: `ref.descendants` 객체의 stable hash
 *   (`computeDescendantsFingerprint` 생성)
 * - `slotBindingFingerprint`: slot children 배열 구조 hash
 *   (`computeSlotBindingFingerprint` 생성)
 *
 * readonly tuple — 구조적 불변성 보장. 비교는 모든 요소 === 일치.
 */
export type ResolverCacheKey = readonly [
    docVersion: string,
    rootRefId: string,
    descendantsFingerprint: string,
    slotBindingFingerprint: string
];
/**
 * resolver 출력 노드.
 *
 * `CanonicalNode`를 상속하고 resolver 메타 필드 2개를 추가:
 * - `_resolvedFrom`: resolve 과정에서 원본으로 사용된 ref id (UI 마커용)
 * - `_overrides`: override된 필드 경로 목록 (Properties 패널 dot 마커용)
 *
 * `_` prefix 필드는 resolver가 주입하며, 저장 포맷에 포함하지 않는다.
 * serializer는 `_` prefix 필드를 strip한다.
 */
export interface ResolvedNode extends CanonicalNode {
    /** resolve 과정에서 원본으로 사용된 reusable ref id */
    _resolvedFrom?: string;
    /**
     * override된 필드 경로 목록 (dot notation).
     * 예: `["fill", "name", "children[0].content"]`
     * Properties 패널 "원본과 다름" dot 마커 표시에 사용.
     */
    _overrides?: string[];
    /** 자식도 ResolvedNode */
    children?: ResolvedNode[];
}
/**
 * resolver 캐시 인터페이스.
 *
 * Preview iframe과 Skia sprite 양쪽이 **공통 resolver의 동일 인스턴스**를 공유.
 * Phase 2에서 실제 구현체가 이 인터페이스를 만족해야 한다 (Gate G2 (a) 전제).
 *
 * invalidation 단위:
 * - `invalidateSubtree(rootRefId)` — ref root 기준 subtree dirty (가장 일반적)
 * - `invalidateAll()` — 전체 캐시 flush (문서 교체 / 대규모 변경 시)
 */
export interface ResolverCache {
    /**
     * 캐시에서 resolved subtree 조회.
     * @returns hit 시 `ResolvedNode`, miss 시 `undefined`
     */
    get(key: ResolverCacheKey): ResolvedNode | undefined;
    /**
     * resolved subtree를 캐시에 저장.
     */
    set(key: ResolverCacheKey, tree: ResolvedNode): void;
    /**
     * ref root를 기준으로 subtree 단위 캐시 무효화.
     *
     * invalidation 전파 규칙:
     * - 해당 `rootRefId`를 포함하는 모든 캐시 엔트리 제거
     * - 형제 ref instance는 영향 없음 (cache hit 유지)
     * - 조상 ref로의 전파는 resolver가 부모 key 재계산 시 자동 miss 처리
     *
     * @param rootRefId — 무효화할 ref 노드의 id
     */
    invalidateSubtree(rootRefId: string): void;
    /**
     * 전체 캐시 flush.
     * 문서 교체 / `docVersion` 변경 / 대규모 구조 변경 시 호출.
     */
    invalidateAll(): void;
    /**
     * 캐시 성능 통계.
     * 실측 기반 Phase 2 regression gate 검증에 사용
     * (`RESOLVER_PERFORMANCE_CONTRACT` 수치와 대조).
     */
    stats(): {
        hits: number;
        misses: number;
        /** 현재 캐시에 저장된 엔트리 수 */
        size: number;
    };
}
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
export declare const RESOLVER_PERFORMANCE_CONTRACT: {
    /** cold cache resolve P50 (ms) — 1000-node tree */
    readonly coldResolveP50Ms: 5;
    /** cold cache resolve P99 (ms) — 1000-node tree */
    readonly coldResolveP99Ms: 50;
    /** hot cache (cache hit) fetch P50 (ms) */
    readonly hotResolveP50Ms: 0.5;
    /** hot cache (cache hit) fetch P99 (ms) */
    readonly hotResolveP99Ms: 5;
};
/**
 * `CompositionDocument.imports` 의 `<importKey>:<nodeId>` ref 를 resolve 할 때
 * 이미 로드된 외부 canonical document 를 동기 조회하는 컨텍스트.
 *
 * 외부 fetch/prefetch 정책은 runtime adapter 책임이며, core resolver 는 이
 * 컨텍스트가 제공하는 loaded document 만 소비한다.
 */
export interface ImportResolverContext {
    resolveImportDocument: (importKey: string, source: string) => CompositionDocument | undefined;
}
/**
 * `ResolveFn` — canonical resolver 함수 시그니처.
 *
 * 실행 순서 (ADR-903 Hard Constraint #3):
 * `ref resolve → descendants apply → slot contract validate → resolved tree`
 *
 * @param doc — 전체 CompositionDocument (reusable 원본 조회 포함)
 * @param cache — 선택적 ResolverCache 인스턴스. Preview/Skia 공유 인스턴스 전달 권장
 * @param imports — 선택적 import resolver context. `<importKey>:<nodeId>` ref
 *                  조회 시 loaded import document 를 동기 제공
 * @returns 문서 top-level children 전체를 resolve한 ResolvedNode 배열
 *
 * @stub 실제 구현은 Phase 2+
 */
export type ResolveFn = (doc: CompositionDocument, cache?: ResolverCache, imports?: ImportResolverContext) => ResolvedNode[];
/**
 * `resolve` — `ResolveFn` stub 구현체.
 *
 * Phase 2에서 실제 resolver로 교체된다.
 * Phase 1 adapter에서 import하여 "resolver 연결 지점"으로 사용.
 *
 * @stub 실제 구현은 Phase 2+
 */
export declare const resolve: ResolveFn;
//# sourceMappingURL=canonical-resolver.types.d.ts.map