/**
 * Font Registry v2 관리 모듈
 *
 * localStorage 기반 FontRegistryV2 CRUD + 레거시 마이그레이션.
 *
 * @since 2026-03-04 ADR-014 Phase A
 */
import type { CustomFontAsset } from "./font.utils";
import type { FontRegistryV2, FontFaceAsset } from "../types/font.types";
export declare const FONT_REGISTRY_STORAGE_KEY = "composition.font-registry";
export declare function loadFontRegistry(): FontRegistryV2;
export declare function saveFontRegistry(registry: FontRegistryV2): void;
export declare function addFontFace(registry: FontRegistryV2, face: FontFaceAsset): FontRegistryV2;
export declare function removeFontFace(registry: FontRegistryV2, faceId: string): FontRegistryV2;
export declare function validateFontFile(file: File): string | null;
export declare function migrateLegacyFace(legacy: CustomFontAsset): FontFaceAsset;
export declare function buildRegistryFontFaceCss(registry: FontRegistryV2): string;
/**
 * FontRegistryV2 → CustomFontAsset[] 역변환
 * 레거시 API와의 호환을 위해 제공
 */
export declare function registryToLegacyFonts(registry: FontRegistryV2): CustomFontAsset[];
//# sourceMappingURL=fontRegistry.d.ts.map