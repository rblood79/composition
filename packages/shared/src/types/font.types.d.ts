/**
 * Font Registry v2 타입 정의
 *
 * localStorage 기반 폰트 레지스트리.
 * 레거시 CustomFontAsset[] → FontRegistryV2 마이그레이션 지원.
 *
 * @since 2026-03-04 ADR-014 Phase A
 */
export type FontSourceType = "project-asset" | "remote-url" | "data-url-temp";
export interface FontFileRef {
    type: FontSourceType;
    /** /assets/fonts/*.woff2 | https://... | data:... */
    url: string;
    originalFileName?: string;
    mimeType?: string;
    byteSize?: number;
}
export type FontFormat = "woff2" | "woff" | "truetype" | "opentype";
export interface FontFaceAsset {
    id: string;
    family: string;
    weight?: string;
    style?: "normal" | "italic";
    format?: FontFormat;
    display?: "swap" | "fallback" | "block" | "optional";
    source: FontFileRef;
    createdAt: string;
    updatedAt: string;
}
export interface FontRegistryV2 {
    version: 2;
    faces: FontFaceAsset[];
}
export declare const FONT_LIMITS: {
    /** 파일당 최대 크기 (5MB) */
    readonly MAX_FILE_SIZE: number;
    /** 프로젝트당 최대 폰트 수 */
    readonly MAX_FACES: 20;
    /** 허용 확장자 */
    readonly ALLOWED_EXTENSIONS: readonly [".woff2", ".woff", ".ttf", ".otf"];
    /** 허용 MIME 타입 */
    readonly ALLOWED_MIME_TYPES: readonly ["font/woff2", "font/woff", "font/ttf", "font/otf", "application/font-woff2", "application/font-woff", "application/x-font-ttf", "application/x-font-opentype"];
};
//# sourceMappingURL=font.types.d.ts.map