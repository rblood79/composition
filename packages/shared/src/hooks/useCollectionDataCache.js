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
const DEFAULT_TTL = 5 * 60 * 1000; // 5분
const DEFAULT_MAX_ENTRIES = 100;
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
class CollectionDataCache {
    cache = new Map();
    ttl;
    maxEntries;
    constructor(options = {}) {
        this.ttl = options.ttl || DEFAULT_TTL;
        this.maxEntries = options.maxEntries || DEFAULT_MAX_ENTRIES;
    }
    /**
     * 캐시 키 생성
     *
     * PropertyDataBinding 또는 DataBinding 설정에서 고유 키를 생성합니다.
     */
    static createKey(binding) {
        if (!binding)
            return '';
        try {
            // PropertyDataBinding 형식: { source: 'api', name: 'users' }
            if (typeof binding === 'object' &&
                'source' in binding &&
                'name' in binding) {
                const b = binding;
                return `prop:${b.source}:${b.name}:${b.path || ''}`;
            }
            // DataBinding 형식: { type: 'collection', source: 'api', config: {...} }
            if (typeof binding === 'object' &&
                'type' in binding &&
                'config' in binding) {
                return `data:${JSON.stringify(binding)}`;
            }
            return '';
        }
        catch {
            return '';
        }
    }
    /**
     * 캐시에서 데이터 조회
     *
     * @returns 캐시 데이터 또는 undefined (캐시 미스 또는 만료)
     */
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            return undefined;
        }
        // TTL 확인
        const now = Date.now();
        if (now - entry.createdAt > entry.ttl) {
            this.cache.delete(key);
            return undefined;
        }
        // LRU: 마지막 접근 시간 업데이트
        entry.lastAccessedAt = now;
        return entry.data;
    }
    /**
     * 캐시에 데이터 저장
     */
    set(key, data, ttl) {
        // 최대 항목 수 초과 시 LRU 정리
        if (this.cache.size >= this.maxEntries) {
            this.evictLRU();
        }
        const now = Date.now();
        this.cache.set(key, {
            data,
            createdAt: now,
            lastAccessedAt: now,
            ttl: ttl || this.ttl,
        });
    }
    /**
     * 특정 키의 캐시 무효화
     */
    invalidate(key) {
        this.cache.delete(key);
    }
    /**
     * 패턴에 매칭되는 모든 캐시 무효화
     *
     * @param pattern 정규식 패턴 또는 prefix 문자열
     */
    invalidateMatching(pattern) {
        const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
            }
        }
    }
    /**
     * 모든 캐시 삭제
     */
    clear() {
        this.cache.clear();
    }
    /**
     * 캐시 통계
     */
    getStats() {
        return {
            size: this.cache.size,
            maxEntries: this.maxEntries,
            ttl: this.ttl,
        };
    }
    /**
     * LRU(Least Recently Used) 정리
     *
     * 가장 오래된 항목부터 삭제
     */
    evictLRU() {
        let oldestKey = null;
        let oldestTime = Infinity;
        for (const [key, entry] of this.cache.entries()) {
            if (entry.lastAccessedAt < oldestTime) {
                oldestTime = entry.lastAccessedAt;
                oldestKey = key;
            }
        }
        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }
}
// 싱글톤 캐시 인스턴스
export const collectionDataCache = new CollectionDataCache({
    ttl: DEFAULT_TTL,
    maxEntries: DEFAULT_MAX_ENTRIES,
});
/**
 * 캐시 키 생성 헬퍼
 */
export const createCacheKey = CollectionDataCache.createKey;
export default CollectionDataCache;
//# sourceMappingURL=useCollectionDataCache.js.map