/**
 * Export/Import 관련 타입 정의
 *
 * @since 2026-01-02 Phase 1
 */

// ============================================
// Error Codes
// ============================================

/**
 * Export/Import 에러 코드
 */
export enum ExportErrorCode {
  // 검증 오류 (Phase 1)
  VALIDATION_ERROR = "VALIDATION_ERROR",
  MISSING_FIELD = "MISSING_FIELD",
  INVALID_TYPE = "INVALID_TYPE",
  PARENT_CYCLE = "PARENT_CYCLE",
  UNSUPPORTED_TAG = "UNSUPPORTED_TAG",
  EXPORT_LIMIT_EXCEEDED = "EXPORT_LIMIT_EXCEEDED",

  // 페이지 오류 (Phase 2)
  PAGE_NOT_FOUND = "PAGE_NOT_FOUND",
  NO_PAGES = "NO_PAGES",
  NO_ELEMENTS = "NO_ELEMENTS",

  // 이벤트 런타임 오류 (Phase 3)
  UNSUPPORTED_ACTION = "UNSUPPORTED_ACTION",
  API_CALL_FAILED = "API_CALL_FAILED",
  POPUP_BLOCKED = "POPUP_BLOCKED",
  HANDLER_DUPLICATE = "HANDLER_DUPLICATE",
  HANDLER_POOL_HIGH = "HANDLER_POOL_HIGH",

  // 버전/마이그레이션 오류 (Phase 4)
  UNKNOWN_VERSION = "UNKNOWN_VERSION",
  MIGRATION_FAILED = "MIGRATION_FAILED",
  ASSET_TOO_LARGE = "ASSET_TOO_LARGE",

  // 보안 오류
  SECURITY_BLOCKED = "SECURITY_BLOCKED",
  INVALID_URL_SCHEME = "INVALID_URL_SCHEME",
  FILE_TOO_LARGE = "FILE_TOO_LARGE",

  // 파싱 오류
  PARSE_ERROR = "PARSE_ERROR",
}

/**
 * 에러 심각도
 */
export type ErrorSeverity = "error" | "warning" | "info" | "debug";

/**
 * Export 에러 상세
 */
export interface ExportError {
  code: ExportErrorCode;
  message: string;
  field?: string;
  detail?: string;
  severity: ErrorSeverity;
}

// ============================================
// Export Data Types
// ============================================

/**
 * 프로젝트 메타데이터 (Phase 4)
 */
export interface ProjectMetadata {
  builderVersion: string;
  exportedBy?: string;
  description?: string;
  thumbnail?: string;
}

/**
 * 내보내기용 프로젝트 데이터
 */
// ============================================
// Validation Limits
// ============================================

/**
 * 데이터 제한 상수
 */
export const EXPORT_LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_THUMBNAIL_SIZE: 512 * 1024, // 512KB
  MAX_PROJECT_NAME_LENGTH: 120,
  MAX_DESCRIPTION_LENGTH: 1000,
} as const;

/**
 * 성능 목표 (ms)
 */
export const PERFORMANCE_TARGETS = {
  JSON_PARSE: 120,
  ZOD_VALIDATION: 180,
  RENDER_INIT: 250,
} as const;
