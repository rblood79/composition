import { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../../env/supabase.client";
import {
  classifyError,
  logError,
  ApiError,
  ApiErrorType,
} from "./ErrorHandler";
import { globalQueryCache } from "../../utils/smartCache";
import { globalRequestDeduplicator } from "../../utils/requestDeduplication";
import { globalPerformanceMonitor } from "../../utils/performanceMonitor";

export abstract class BaseApiService {
  protected readonly supabase: SupabaseClient;
  private readonly rateLimiter = new Map<string, number>();
  // 개발 환경에서는 rate limit 완화 (1000 req/min), 프로덕션에서는 60 req/min
  private readonly maxRequestsPerMinute = import.meta.env.DEV ? 1000 : 60;

  constructor() {
    // 전역 싱글톤 인스턴스 사용
    this.supabase = supabase;
  }

  protected async rateLimitCheck(operation: string): Promise<boolean> {
    const now = Date.now();
    const key = `${operation}-${Math.floor(now / 60000)}`;
    const count = this.rateLimiter.get(key) || 0;

    if (count >= this.maxRequestsPerMinute) {
      const error: ApiError = {
        type: ApiErrorType.RATE_LIMIT_ERROR,
        message: "Rate limit exceeded. Please try again later.",
        operation,
        timestamp: new Date().toISOString(),
      };
      logError(error);
      throw new Error(error.message);
    }

    this.rateLimiter.set(key, count + 1);

    // 개발 환경에서만 디버그 로그
    if (import.meta.env.DEV && count > 10) {
      console.warn(
        `[Rate Limit] ${operation}: ${count + 1}/${this.maxRequestsPerMinute} requests in this minute`,
      );
    }

    return true;
  }

  protected validateInput<T>(
    input: T,
    validator: (input: T) => boolean,
    operation: string,
  ): T {
    if (!validator(input)) {
      const error: ApiError = {
        type: ApiErrorType.VALIDATION_ERROR,
        message: "Invalid input provided",
        operation,
        timestamp: new Date().toISOString(),
      };
      logError(error);
      throw new Error(error.message);
    }
    return input;
  }

  protected async handleApiCall<T>(
    operation: string,
    apiCall: () => Promise<{ data: T | null; error: unknown }>,
  ): Promise<T> {
    await this.rateLimitCheck(operation);

    try {
      const { data, error } = await apiCall();

      if (error) {
        const apiError = classifyError(error, operation);
        logError(apiError);
        throw new Error(apiError.message);
      }

      if (!data) {
        const apiError: ApiError = {
          type: ApiErrorType.NOT_FOUND_ERROR,
          message: `No data returned from ${operation}`,
          operation,
          timestamp: new Date().toISOString(),
        };
        logError(apiError);
        throw new Error(apiError.message);
      }

      return data;
    } catch (error) {
      const apiError = classifyError(error, operation);
      logError(apiError);
      throw error;
    }
  }

  // 삭제 작업을 위한 별도 메서드 (데이터 반환 불필요)
  protected async handleDeleteCall(
    operation: string,
    apiCall: () => Promise<{ error: unknown }>,
  ): Promise<void> {
    await this.rateLimitCheck(operation);

    try {
      const { error } = await apiCall();

      if (error) {
        const apiError = classifyError(error, operation);
        logError(apiError);
        throw new Error(apiError.message);
      }
    } catch (error) {
      const apiError = classifyError(error, operation);
      logError(apiError);
      throw error;
    }
  }

  /**
   * 캐싱이 적용된 API 호출 (GET 요청용)
   *
   * - SmartCache로 캐싱 (기본 5분 TTL)
   * - Request Deduplication으로 중복 요청 방지
   * - Performance Monitor로 성능 추적
   *
   * @param queryKey - 캐시 키 (예: "pages:project-123")
   * @param operation - 작업 이름 (로깅용)
   * @param apiCall - 실제 API 호출 함수
   * @param options - 캐싱 옵션 { staleTime?: number, allowNull?: boolean }
   * @returns API 응답 데이터
   */
  protected async handleCachedApiCall<T>(
    queryKey: string,
    operation: string,
    apiCall: () => Promise<{ data: T | null; error: unknown }>,
    options: { staleTime?: number; allowNull?: boolean } = {},
  ): Promise<T> {
    // 1. 캐시 확인 (rate limit 전에 체크)
    const cached = globalQueryCache.get(queryKey);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      const staleTime = options.staleTime ?? 5 * 60 * 1000; // 기본 5분

      if (age < staleTime) {
        // ✅ Cache hit - rate limit 체크 불필요
        globalPerformanceMonitor.recordCacheHit(queryKey, 0);
        console.log(`📦 [Cache HIT] ${operation} (${queryKey})`);
        return cached.data as T;
      }
    }

    // 2. Request Deduplication 체크 (rate limit 전에 체크)
    const wasDeduplicated = globalRequestDeduplicator.isPending(queryKey);
    const fetchStart = performance.now();

    // 3. Rate limit 체크 (실제 API 호출 전에만)
    if (!wasDeduplicated) {
      await this.rateLimitCheck(operation);
    }

    try {
      const result = await globalRequestDeduplicator.deduplicate(
        queryKey,
        async () => {
          const { data, error } = await apiCall();

          if (error) {
            const apiError = classifyError(error, operation);
            logError(apiError);
            throw new Error(apiError.message);
          }

          // allowNull 옵션이 false이고 data가 null이면 에러
          if (!data && !options.allowNull) {
            const apiError: ApiError = {
              type: ApiErrorType.NOT_FOUND_ERROR,
              message: `No data returned from ${operation}`,
              operation,
              timestamp: new Date().toISOString(),
            };
            logError(apiError);
            throw new Error(apiError.message);
          }

          return data as T; // allowNull=true면 null도 허용
        },
      );

      const fetchTime = performance.now() - fetchStart;

      // 3. 성능 모니터링 (첫 번째 요청만)
      if (!wasDeduplicated) {
        globalPerformanceMonitor.recordCacheMiss(queryKey, fetchTime);
        globalPerformanceMonitor.recordFetchComplete(queryKey, fetchTime, true);

        // 캐시에 저장
        globalQueryCache.set(queryKey, { data: result, timestamp: Date.now() });
      }

      globalPerformanceMonitor.recordDeduplication(queryKey, wasDeduplicated);

      return result;
    } catch (error) {
      const fetchTime = performance.now() - fetchStart;
      globalPerformanceMonitor.recordFetchComplete(queryKey, fetchTime, false);

      const apiError = classifyError(error, operation);
      logError(apiError);
      throw error;
    }
  }

  /**
   * 캐시 무효화 (Mutation 작업 후 호출)
   *
   * @param cacheKeyPattern - 무효화할 캐시 키 패턴 (예: "pages:", "elements:")
   */
  protected invalidateCache(cacheKeyPattern: string): void {
    // globalQueryCache는 Map 기반이므로 순회하며 삭제
    for (const key of globalQueryCache.keys()) {
      if (String(key).startsWith(cacheKeyPattern)) {
        globalQueryCache.delete(key);
        console.log(`🗑️ [Cache INVALIDATE] ${key}`);
      }
    }
  }
}

// Note: ElementsApiService 의 진정한 정의는 `apps/builder/src/adapters/canonical/legacyElementsApiService.ts` 에 있다 (ADR-116 G5 second work, 2026-05-01 격리). 본 file 에 있던 stale duplicate 클래스 + elementsApi 싱글톤 export 는 dead code 였으며, 모든 caller 가 `services/api/index.ts` 경유로 adapter 영역의 정의를 사용한다.
