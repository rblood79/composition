import { getDB } from "../../lib/db";

/**
 * 저장 옵션 인터페이스
 */
export interface SaveOptions {
  /** 저장 여부 (기본값: true) */
  shouldSave?: boolean;
  /** 상호작용 소스 (예: 'preview', 'inspector', 'direct') */
  source?: string;
  /** 히스토리 기록 여부 (기본값: true) */
  recordHistory?: boolean;
  /** 프리뷰 상호작용에서 저장 허용 여부 (기본값: true) */
  allowPreviewSaves?: boolean;
  /** 직렬화 검증 수행 여부 (기본값: false) */
  validateSerialization?: boolean;
}

/**
 * 검증 실패 정보
 */
export interface ValidationError {
  elementId: string;
  field: string;
  message: string;
  timestamp: Date;
}

/**
 * 성능 메트릭 인터페이스
 */
export interface PerformanceMetrics {
  saveOperations: number;
  averageSaveTime: number;
  skipCounts: {
    preview: number;
    validation: number;
  };
}

/**
 * 테이블 타입 제한
 */
export type SaveTable = "elements" | "pages" | "projects";

/**
 * 저장 페이로드 인터페이스
 */
export interface SavePayload {
  table: SaveTable;
  id: string;
  data: Record<string, unknown>;
}

/**
 * SaveService 클래스
 *
 * 로컬 저장(IndexedDB)을 처리합니다.
 *
 * @updated 2025-12-29 - 실시간/수동 모드 분기 제거 (항상 로컬 저장)
 */
export class SaveService {
  private static instance: SaveService;
  private validationErrors: ValidationError[] = [];
  private statusMessage: string = "";
  private metrics: PerformanceMetrics = {
    saveOperations: 0,
    averageSaveTime: 0,
    skipCounts: {
      preview: 0,
      validation: 0,
    },
  };

  private constructor() {}

  /**
   * 싱글톤 인스턴스 가져오기
   */
  static getInstance(): SaveService {
    if (!SaveService.instance) {
      SaveService.instance = new SaveService();
    }
    return SaveService.instance;
  }

  /**
   * 검증 오류 목록 조회
   */
  getValidationErrors(): ValidationError[] {
    return this.validationErrors;
  }

  /**
   * 검증 오류 초기화
   */
  clearValidationErrors(): void {
    this.validationErrors = [];
  }

  /**
   * 상태 메시지 조회
   */
  getStatusMessage(): string {
    return this.statusMessage;
  }

  /**
   * 성능 지표 조회
   */
  getPerformanceMetrics() {
    return this.metrics;
  }

  /**
   * 값 직렬화 가능성 검증
   */
  private validateSerializable(
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    const validatedData: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      try {
        JSON.stringify(value);
        validatedData[key] = value;
      } catch {
        this.validationErrors.push({
          elementId: "unknown",
          field: key,
          message: "직렬화 불가능한 값입니다.",
          timestamp: new Date(),
        });
        this.metrics.skipCounts.validation++;
        this.statusMessage = `⚠️ 직렬화 불가능한 값 감지 - 필드: ${key}`;
      }
    }

    return validatedData;
  }

  /**
   * IndexedDB에 데이터 저장 (로컬 저장)
   */
  private async saveToIndexedDB(payload: SavePayload): Promise<void> {
    const { table, id, data } = payload;

    try {
      const db = await getDB();
      if (table !== "projects") {
        throw new Error(
          `Legacy save table '${table}' is not available after canonical document cutover`,
        );
      }
      await db.projects.update(id, data);
      this.statusMessage = `✅ [IndexedDB] ${table} 저장 완료: ${id}`;
    } catch (error) {
      this.statusMessage = `❌ [IndexedDB] 저장 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`;
      console.warn(`⚠️ [IndexedDB] ${table} 저장 중 오류:`, error);
      throw error;
    }
  }

  /**
   * 속성 변경 저장 (IndexedDB에 즉시 저장)
   * @param payload 저장할 데이터 정보
   * @param options 저장 옵션
   */
  async savePropertyChange(
    payload: SavePayload,
    options: SaveOptions = {},
  ): Promise<void> {
    const startTime = performance.now();

    // 프리뷰 상호작용 소스 확인
    if (options.source === "preview" && !options.allowPreviewSaves) {
      this.metrics.skipCounts.preview++;
      return;
    }

    // 직렬화 검증
    if (options.validateSerialization) {
      try {
        this.validateSerializable(payload.data);
      } catch (error) {
        this.validationErrors.push({
          elementId: payload.id,
          field: Object.keys(payload.data)[0] || "unknown",
          message:
            error instanceof Error ? error.message : "알 수 없는 검증 오류",
          timestamp: new Date(),
        });
        return;
      }
    }

    // 항상 IndexedDB에 즉시 저장 (로컬 우선)
    await this.saveToIndexedDB(payload);

    // 성능 메트릭 업데이트
    const endTime = performance.now();
    this.metrics.saveOperations++;
    this.metrics.averageSaveTime =
      (this.metrics.averageSaveTime * (this.metrics.saveOperations - 1) +
        (endTime - startTime)) /
      this.metrics.saveOperations;
  }

  /**
   * 성능 메트릭 리셋
   */
  resetMetrics(): void {
    this.metrics = {
      saveOperations: 0,
      averageSaveTime: 0,
      skipCounts: {
        preview: 0,
        validation: 0,
      },
    };
    this.statusMessage = "📊 SaveService 성능 메트릭이 리셋되었습니다.";
  }

  /**
   * 상세 성능 보고서 생성
   */
  getDetailedReport(): {
    metrics: PerformanceMetrics;
    validationErrors: ValidationError[];
    summary: string;
  } {
    const totalSkips =
      this.metrics.skipCounts.preview + this.metrics.skipCounts.validation;
    const successRate =
      this.metrics.saveOperations > 0
        ? (
            ((this.metrics.saveOperations - this.validationErrors.length) /
              this.metrics.saveOperations) *
            100
          ).toFixed(2)
        : "100.00";

    return {
      metrics: this.metrics,
      validationErrors: this.validationErrors,
      summary: `저장 작업: ${this.metrics.saveOperations}회, 평균 시간: ${this.metrics.averageSaveTime.toFixed(2)}ms, 건너뜀: ${totalSkips}회, 성공률: ${successRate}%`,
    };
  }
}

/**
 * SaveService 싱글톤 인스턴스
 */
export const saveService = SaveService.getInstance();

/**
 * 개발용 성능 모니터링 유틸리티 (콘솔에서 사용 가능)
 */
if (typeof window !== "undefined") {
  (
    window as Window & typeof globalThis & { saveServiceUtils?: unknown }
  ).saveServiceUtils = {
    getReport: () => saveService.getDetailedReport(),
    getMetrics: () => saveService.getPerformanceMetrics(),
    getValidationErrors: () => saveService.getValidationErrors(),
    resetMetrics: () => saveService.resetMetrics(),
    clearValidationErrors: () => saveService.clearValidationErrors(),
  };
}
