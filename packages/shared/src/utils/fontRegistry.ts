/**
 * Font Registry v2 관리 모듈
 *
 * localStorage 기반 FontRegistryV2 CRUD + 레거시 마이그레이션.
 *
 * @since 2026-03-04 ADR-014 Phase A
 */

import type { CustomFontAsset } from "./font.utils";
import { CUSTOM_FONT_STORAGE_KEY } from "./font.utils";
import type {
  FontRegistryV2,
  FontFaceAsset,
  FontFormat,
} from "../types/font.types";
import { FONT_LIMITS } from "../types/font.types";
import { resolveAssetUrl } from "./assetRef";

// ============================================
// Storage Key
// ============================================

export const FONT_REGISTRY_STORAGE_KEY = "composition.font-registry";

// ============================================
// Registry CRUD
// ============================================

function createEmptyRegistry(): FontRegistryV2 {
  return { version: 2, faces: [] };
}

export function loadFontRegistry(): FontRegistryV2 {
  if (typeof window === "undefined") return createEmptyRegistry();

  try {
    const raw = localStorage.getItem(FONT_REGISTRY_STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isValidRegistry(parsed)) return parsed;
    }
  } catch {
    // parse 실패 시 마이그레이션 시도
  }

  // v2 키 없음 → 레거시 마이그레이션 시도
  const migrated = migrateFromLegacy();
  if (migrated) {
    saveFontRegistry(migrated);
    return migrated;
  }

  return createEmptyRegistry();
}

export function saveFontRegistry(registry: FontRegistryV2): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(FONT_REGISTRY_STORAGE_KEY, JSON.stringify(registry));
}

export function addFontFace(
  registry: FontRegistryV2,
  face: FontFaceAsset,
): FontRegistryV2 {
  if (registry.faces.length >= FONT_LIMITS.MAX_FACES) {
    throw new Error(`폰트 수 제한 초과 (최대 ${FONT_LIMITS.MAX_FACES}개)`);
  }

  // 중복 검사: 같은 family + weight + style
  const duplicate = registry.faces.find(
    (f) =>
      f.family === face.family &&
      (f.weight ?? "400") === (face.weight ?? "400") &&
      (f.style ?? "normal") === (face.style ?? "normal"),
  );
  if (duplicate) {
    // 기존 항목 교체
    return {
      ...registry,
      faces: registry.faces.map((f) =>
        f.id === duplicate.id ? { ...face, id: duplicate.id } : f,
      ),
    };
  }

  return { ...registry, faces: [...registry.faces, face] };
}

export function removeFontFace(
  registry: FontRegistryV2,
  faceId: string,
): FontRegistryV2 {
  return {
    ...registry,
    faces: registry.faces.filter((f) => f.id !== faceId),
  };
}

// ============================================
// Validation
// ============================================

function isValidRegistry(value: unknown): value is FontRegistryV2 {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return obj.version === 2 && Array.isArray(obj.faces);
}

export function validateFontFile(file: File): string | null {
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  if (
    !FONT_LIMITS.ALLOWED_EXTENSIONS.includes(
      ext as (typeof FONT_LIMITS.ALLOWED_EXTENSIONS)[number],
    )
  ) {
    return `허용되지 않은 확장자: ${ext} (허용: ${FONT_LIMITS.ALLOWED_EXTENSIONS.join(", ")})`;
  }

  if (file.size > FONT_LIMITS.MAX_FILE_SIZE) {
    const maxMB = FONT_LIMITS.MAX_FILE_SIZE / (1024 * 1024);
    return `파일 크기 초과: ${(file.size / (1024 * 1024)).toFixed(1)}MB (최대 ${maxMB}MB)`;
  }

  return null;
}

// ============================================
// Legacy Migration
// ============================================

/**
 * 레거시 format → v2 FontFormat 변환
 * .eot/.svg는 v2에서 지원하지 않으므로 undefined 반환
 */
function convertLegacyFormat(
  format: CustomFontAsset["format"],
): FontFormat | undefined {
  if (!format) return undefined;
  if (format === "embedded-opentype" || format === "svg") return undefined;
  return format;
}

export function migrateLegacyFace(legacy: CustomFontAsset): FontFaceAsset {
  const now = new Date().toISOString();
  const isDataUrl = legacy.source.startsWith("data:");

  return {
    id: legacy.id,
    family: legacy.family,
    format: convertLegacyFormat(legacy.format),
    display: "swap",
    source: {
      type: isDataUrl ? "data-url-temp" : "remote-url",
      url: legacy.source,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function migrateFromLegacy(): FontRegistryV2 | null {
  try {
    const raw = localStorage.getItem(CUSTOM_FONT_STORAGE_KEY);
    if (!raw) return null;

    const legacyFonts: unknown = JSON.parse(raw);
    if (!Array.isArray(legacyFonts)) return null;

    const faces = (legacyFonts as CustomFontAsset[]).map(migrateLegacyFace);
    return { version: 2, faces };
  } catch {
    return null;
  }
}

// ============================================
// CSS Generation (v2 compatible)
// ============================================

function escapeCssString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function buildRegistryFontFaceCss(registry: FontRegistryV2): string {
  if (registry.faces.length === 0) return "";

  return registry.faces
    .filter((face) => face.family.trim() && face.source.url.trim())
    .flatMap((face) => {
      // ADR-235 — `asset:` 은 실행 문맥 해석기로. 준비 전이면 이 face 는 건너뛴다 (요청 0);
      // 호출자가 준비 후 다시 주입한다.
      const src = resolveAssetUrl(face.source.url.trim());
      if (!src) return [];
      const family = escapeCssString(face.family.trim());
      const format = face.format ? ` format('${face.format}')` : "";
      const weight = face.weight ? `\n  font-weight: ${face.weight};` : "";
      const style =
        face.style && face.style !== "normal"
          ? `\n  font-style: ${face.style};`
          : "";
      const display = face.display ?? "swap";

      return [
        `@font-face {\n  font-family: "${family}";\n  src: url("${src}")${format};${weight}${style}\n  font-display: ${display};\n}`,
      ];
    })
    .join("\n\n");
}

/**
 * FontRegistryV2 → CustomFontAsset[] 역변환
 * 레거시 API와의 호환을 위해 제공
 */
export function registryToLegacyFonts(
  registry: FontRegistryV2,
): CustomFontAsset[] {
  return registry.faces.map((face) => ({
    id: face.id,
    family: face.family,
    source: face.source.url,
    format: face.format,
  }));
}
