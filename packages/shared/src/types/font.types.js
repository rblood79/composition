/**
 * Font Registry v2 타입 정의
 *
 * localStorage 기반 폰트 레지스트리.
 * 레거시 CustomFontAsset[] → FontRegistryV2 마이그레이션 지원.
 *
 * @since 2026-03-04 ADR-014 Phase A
 */
// ============================================
// Constraints
// ============================================
export const FONT_LIMITS = {
    /** 파일당 최대 크기 (5MB) */
    MAX_FILE_SIZE: 5 * 1024 * 1024,
    /** 프로젝트당 최대 폰트 수 */
    MAX_FACES: 20,
    /** 허용 확장자 */
    ALLOWED_EXTENSIONS: [".woff2", ".woff", ".ttf", ".otf"],
    /** 허용 MIME 타입 */
    ALLOWED_MIME_TYPES: [
        "font/woff2",
        "font/woff",
        "font/ttf",
        "font/otf",
        "application/font-woff2",
        "application/font-woff",
        "application/x-font-ttf",
        "application/x-font-opentype",
    ],
};
//# sourceMappingURL=font.types.js.map