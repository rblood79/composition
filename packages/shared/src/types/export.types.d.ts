/**
 * Export/Import 관련 타입 정의
 *
 * @since 2026-01-02 Phase 1
 */
import type { CompositionDocument } from "./composition-document.types";
import type { FontRegistryV2 } from "./font.types";
/**
 * Export/Import 에러 코드
 */
export declare enum ExportErrorCode {
    VALIDATION_ERROR = "VALIDATION_ERROR",
    MISSING_FIELD = "MISSING_FIELD",
    INVALID_TYPE = "INVALID_TYPE",
    PARENT_CYCLE = "PARENT_CYCLE",
    UNSUPPORTED_TAG = "UNSUPPORTED_TAG",
    EXPORT_LIMIT_EXCEEDED = "EXPORT_LIMIT_EXCEEDED",
    PAGE_NOT_FOUND = "PAGE_NOT_FOUND",
    NO_PAGES = "NO_PAGES",
    NO_ELEMENTS = "NO_ELEMENTS",
    UNSUPPORTED_ACTION = "UNSUPPORTED_ACTION",
    API_CALL_FAILED = "API_CALL_FAILED",
    POPUP_BLOCKED = "POPUP_BLOCKED",
    HANDLER_DUPLICATE = "HANDLER_DUPLICATE",
    HANDLER_POOL_HIGH = "HANDLER_POOL_HIGH",
    UNKNOWN_VERSION = "UNKNOWN_VERSION",
    MIGRATION_FAILED = "MIGRATION_FAILED",
    ASSET_TOO_LARGE = "ASSET_TOO_LARGE",
    SECURITY_BLOCKED = "SECURITY_BLOCKED",
    INVALID_URL_SCHEME = "INVALID_URL_SCHEME",
    FILE_TOO_LARGE = "FILE_TOO_LARGE",
    PARSE_ERROR = "PARSE_ERROR"
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
export interface ExportedProjectData {
    version: string;
    exportedAt: string;
    project: {
        id: string;
        name: string;
    };
    document: CompositionDocument;
    currentPageId?: string | null;
    fontRegistry?: FontRegistryV2;
    metadata?: ProjectMetadata;
}
/**
 * Import 결과 (성공)
 */
export interface ImportResultSuccess {
    success: true;
    data: ExportedProjectData;
    warnings?: ExportError[];
}
/**
 * Import 결과 (실패)
 */
export interface ImportResultFailure {
    success: false;
    error: ExportError;
    errors?: ExportError[];
}
/**
 * Import 결과
 */
export type ImportResult = ImportResultSuccess | ImportResultFailure;
/**
 * 데이터 제한 상수
 */
export declare const EXPORT_LIMITS: {
    readonly MAX_FILE_SIZE: number;
    readonly MAX_THUMBNAIL_SIZE: number;
    readonly MAX_PROJECT_NAME_LENGTH: 120;
    readonly MAX_DESCRIPTION_LENGTH: 1000;
};
/**
 * 성능 목표 (ms)
 */
export declare const PERFORMANCE_TARGETS: {
    readonly JSON_PARSE: 120;
    readonly ZOD_VALIDATION: 180;
    readonly RENDER_INIT: 250;
};
//# sourceMappingURL=export.types.d.ts.map