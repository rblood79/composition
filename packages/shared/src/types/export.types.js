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
export var ExportErrorCode;
(function (ExportErrorCode) {
    // 검증 오류 (Phase 1)
    ExportErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ExportErrorCode["MISSING_FIELD"] = "MISSING_FIELD";
    ExportErrorCode["INVALID_TYPE"] = "INVALID_TYPE";
    ExportErrorCode["PARENT_CYCLE"] = "PARENT_CYCLE";
    ExportErrorCode["UNSUPPORTED_TAG"] = "UNSUPPORTED_TAG";
    ExportErrorCode["EXPORT_LIMIT_EXCEEDED"] = "EXPORT_LIMIT_EXCEEDED";
    // 페이지 오류 (Phase 2)
    ExportErrorCode["PAGE_NOT_FOUND"] = "PAGE_NOT_FOUND";
    ExportErrorCode["NO_PAGES"] = "NO_PAGES";
    ExportErrorCode["NO_ELEMENTS"] = "NO_ELEMENTS";
    // 이벤트 런타임 오류 (Phase 3)
    ExportErrorCode["UNSUPPORTED_ACTION"] = "UNSUPPORTED_ACTION";
    ExportErrorCode["API_CALL_FAILED"] = "API_CALL_FAILED";
    ExportErrorCode["POPUP_BLOCKED"] = "POPUP_BLOCKED";
    ExportErrorCode["HANDLER_DUPLICATE"] = "HANDLER_DUPLICATE";
    ExportErrorCode["HANDLER_POOL_HIGH"] = "HANDLER_POOL_HIGH";
    // 버전/마이그레이션 오류 (Phase 4)
    ExportErrorCode["UNKNOWN_VERSION"] = "UNKNOWN_VERSION";
    ExportErrorCode["MIGRATION_FAILED"] = "MIGRATION_FAILED";
    ExportErrorCode["ASSET_TOO_LARGE"] = "ASSET_TOO_LARGE";
    // 보안 오류
    ExportErrorCode["SECURITY_BLOCKED"] = "SECURITY_BLOCKED";
    ExportErrorCode["INVALID_URL_SCHEME"] = "INVALID_URL_SCHEME";
    ExportErrorCode["FILE_TOO_LARGE"] = "FILE_TOO_LARGE";
    // 파싱 오류
    ExportErrorCode["PARSE_ERROR"] = "PARSE_ERROR";
})(ExportErrorCode || (ExportErrorCode = {}));
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
};
/**
 * 성능 목표 (ms)
 */
export const PERFORMANCE_TARGETS = {
    JSON_PARSE: 120,
    ZOD_VALIDATION: 180,
    RENDER_INIT: 250,
};
//# sourceMappingURL=export.types.js.map