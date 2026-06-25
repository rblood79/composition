/**
 * Collection Data Cache System
 *
 * API 호출 결과를 캐싱하여 중복 요청을 방지하고 성능을 향상시킵니다.
 *
 * Features:
 * - TTL(Time-to-Live) 기반 자동 만료
 * - 캐시 키 기반 저장/조회
 * - 수동 캐시 무효화
 * - 메모리 제한 (최대 항목 수)
 *
 * @since 2025-01-02
 */
export interface CacheEntry<T> {
    /** 캐시된 데이터 */
    data: T;
    /** 캐시 생성 시간 (timestamp) */
    createdAt: number;
    /** 마지막 접근 시간 (LRU용) */
    lastAccessedAt: number;
    /** TTL (밀리초) */
    ttl: number;
}
export interface CacheOptions {
    /** TTL (기본: 5분) */
    ttl?: number;
    /** 최대 캐시 항목 수 (기본: 100) */
    maxEntries?: number;
}
/**
 * Collection Data Cache 클래스
 *
 * @example
 * ```typescript
 * const cache = new CollectionDataCache({ ttl: 60000 }); // 1분 TTL
 *
 * // 캐시 저장
 * cache.set('users-list', userData);
 *
 * // 캐시 조회
 * const cached = cache.get('users-list');
 * if (cached) {
 *   return cached; // 캐시 히트
 * }
 * ```
 */
declare class CollectionDataCache {
    private cache;
    private ttl;
    private maxEntries;
    constructor(options?: CacheOptions);
    /**
     * 캐시 키 생성
     *
     * PropertyDataBinding 또는 DataBinding 설정에서 고유 키를 생성합니다.
     */
    static createKey(binding: unknown): string;
    /**
     * 캐시에서 데이터 조회
     *
     * @returns 캐시 데이터 또는 undefined (캐시 미스 또는 만료)
     */
    get<T>(key: string): T | undefined;
    /**
     * 캐시에 데이터 저장
     */
    set<T>(key: string, data: T, ttl?: number): void;
    /**
     * 특정 키의 캐시 무효화
     */
    invalidate(key: string): void;
    /**
     * 패턴에 매칭되는 모든 캐시 무효화
     *
     * @param pattern 정규식 패턴 또는 prefix 문자열
     */
    invalidateMatching(pattern: string | RegExp): void;
    /**
     * 모든 캐시 삭제
     */
    clear(): void;
    /**
     * 캐시 통계
     */
    getStats(): {
        size: number;
        maxEntries: number;
        ttl: number;
    };
    /**
     * LRU(Least Recently Used) 정리
     *
     * 가장 오래된 항목부터 삭제
     */
    private evictLRU;
}
export declare const collectionDataCache: CollectionDataCache;
/**
 * 캐시 키 생성 헬퍼
 */
export declare const createCacheKey: typeof CollectionDataCache.createKey;
export default CollectionDataCache;
//# sourceMappingURL=useCollectionDataCache.d.ts.map