import {
  type CustomFontAsset,
  inferFontFormatFromName,
  stripExtension,
} from "@composition/shared/utils";
import {
  loadFontRegistry,
  saveFontRegistry,
  addFontFace,
  removeFontFace,
  buildRegistryFontFaceCss,
  registryToLegacyFonts,
  FONT_REGISTRY_STORAGE_KEY,
  type FontFaceAsset,
  type FontRegistryV2,
} from "@composition/shared";
import type { FontFormat } from "@composition/shared";

const STYLE_ID = "composition-custom-fonts";

// ============================================
// Registry-based API (v2)
// ============================================

/**
 * 레지스트리 저장 + DOM CSS 주입 + 이벤트 발생
 */
export function saveRegistryAndNotify(registry: FontRegistryV2): void {
  if (typeof window === "undefined") return;

  saveFontRegistry(registry);
  injectRegistryFontStyle();
  window.dispatchEvent(new CustomEvent("composition:custom-fonts-updated"));
}

/**
 * File → FontFaceAsset 변환 (v2 타입)
 *
 * family 이름 결정 우선순위:
 * 1. 호출자가 명시적으로 지정한 family
 * 2. 폰트 바이너리 내부 이름 (CanvasKit name 테이블 추출)
 * 3. 파일명에서 확장자 제거
 */
export async function createFontFaceFromFile(
  file: File,
  family?: string,
  /** 읽기 실패 문구 — 순수 모듈이라 호출부가 해소해 넘긴다 (ADR-200 후속). */
  unreadableMessage = "Could not read the font file.",
): Promise<FontFaceAsset> {
  const source = await readFileAsDataUrl(file, unreadableMessage);
  const legacyFormat = inferFontFormatFromName(file.name);
  const format: FontFormat | undefined =
    legacyFormat === "embedded-opentype" || legacyFormat === "svg"
      ? undefined
      : legacyFormat;
  const now = new Date().toISOString();

  // 폰트 바이너리에서 family/weight/style 추출
  const meta = await extractFontMetadata(source);
  const resolvedFamily = family || meta.family || stripExtension(file.name);

  // 바이너리 메타 우선, fallback으로 파일명 추론
  const fileNameHints = inferWeightStyleFromFileName(file.name);
  const weight = meta.weight ?? fileNameHints.weight;
  const style = meta.style ?? fileNameHints.style;

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    family: resolvedFamily.trim(),
    weight,
    style,
    format,
    display: "swap",
    source: {
      type: "data-url-temp",
      url: source,
      originalFileName: file.name,
      mimeType: file.type || undefined,
      byteSize: file.size,
    },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * v2 레지스트리 기반 @font-face CSS를 DOM에 주입
 */
export function injectRegistryFontStyle(targetDoc: Document = document): void {
  const registry = loadFontRegistry();
  const css = buildRegistryFontFaceCss(registry);

  const existing = targetDoc.getElementById(STYLE_ID);
  if (!css) {
    existing?.remove();
    return;
  }

  const styleEl = existing ?? targetDoc.createElement("style");
  styleEl.id = STYLE_ID;
  styleEl.textContent = css;

  if (!existing) {
    targetDoc.head.appendChild(styleEl);
  }
}

// ============================================
// Legacy-compatible API (하위 호환)
// ============================================

/**
 * 레지스트리에서 레거시 형태로 폰트 목록 반환
 * TypographySection fontOptions 등에서 사용
 */
export function getCustomFonts(): CustomFontAsset[] {
  const registry = loadFontRegistry();
  return registryToLegacyFonts(registry);
}

// ============================================
// Internal helpers
// ============================================

interface FontMetadata {
  family: string | null;
  weight?: string;
  style?: "normal" | "italic";
}

/**
 * 폰트 바이너리에서 family/weight/style 메타데이터를 추출한다.
 *
 * - family: CanvasKit FontMgr name 테이블에서 추출
 * - weight: OS/2 테이블 usWeightClass (100~900)
 * - style: OS/2 테이블 fsSelection bit 0 (italic)
 *
 * CanvasKit 미초기화 시 family=null → 파일명 fallback.
 * OS/2 테이블 파싱 실패 시 weight/style=undefined → 파일명 추론 fallback.
 */
async function extractFontMetadata(dataUrl: string): Promise<FontMetadata> {
  const result: FontMetadata = { family: null };

  try {
    const response = await fetch(dataUrl);
    const buffer = await response.arrayBuffer();

    // 1) OS/2 테이블에서 weight/style 추출 (CanvasKit 불필요)
    const os2 = parseOS2Table(buffer);
    if (os2) {
      // usWeightClass → 가장 가까운 100 단위로 정규화
      const rounded = Math.round(os2.usWeightClass / 100) * 100;
      const clamped = Math.max(100, Math.min(900, rounded));
      result.weight = String(clamped);

      // fsSelection bit 0 = italic
      if (os2.fsSelection & 0x0001) {
        result.style = "italic";
      }
    }

    // 2) CanvasKit으로 family 이름 추출
    const { isCanvasKitInitialized, getCanvasKit } =
      await import("../workspace/canvas/skia/initCanvasKit");
    if (isCanvasKitInitialized()) {
      const ck = getCanvasKit();
      const tempMgr = ck.FontMgr.FromData(buffer);
      if (tempMgr && tempMgr.countFamilies() > 0) {
        result.family = tempMgr.getFamilyName(0) || null;
      }
      tempMgr?.delete();
    }
  } catch {
    // 파싱 실패 시 빈 결과 반환 → 파일명 fallback
  }

  return result;
}

/**
 * OpenType/TrueType 바이너리에서 OS/2 테이블을 파싱한다.
 * usWeightClass + fsSelection만 추출.
 *
 * @see https://learn.microsoft.com/en-us/typography/opentype/spec/os2
 */
function parseOS2Table(
  buffer: ArrayBuffer,
): { usWeightClass: number; fsSelection: number } | null {
  try {
    const view = new DataView(buffer);

    // sfVersion (0x00010000=TrueType, 0x4F54544F='OTTO'=CFF)
    // numTables at offset 4
    const numTables = view.getUint16(4);

    // Table directory starts at offset 12
    for (let i = 0; i < numTables; i++) {
      const offset = 12 + i * 16;
      // type: 4 bytes ASCII
      const type =
        String.fromCharCode(view.getUint8(offset)) +
        String.fromCharCode(view.getUint8(offset + 1)) +
        String.fromCharCode(view.getUint8(offset + 2)) +
        String.fromCharCode(view.getUint8(offset + 3));

      if (type === "OS/2") {
        const tableOffset = view.getUint32(offset + 8);
        // usWeightClass: OS/2 offset +4 (UInt16)
        const usWeightClass = view.getUint16(tableOffset + 4);
        // fsSelection: OS/2 offset +62 (UInt16)
        const fsSelection = view.getUint16(tableOffset + 62);
        return { usWeightClass, fsSelection };
      }
    }
  } catch {
    // 파싱 실패
  }
  return null;
}

/**
 * 파일명에서 font-weight / font-style 추론.
 * 예: "NanumGothic-Bold.woff2" → weight: "700"
 *     "Roboto-LightItalic.ttf" → weight: "300", style: "italic"
 */
function inferWeightStyleFromFileName(fileName: string): {
  weight?: string;
  style?: "normal" | "italic";
} {
  const base = stripExtension(fileName).toLowerCase();

  const weightMap: Record<string, string> = {
    thin: "100",
    hairline: "100",
    extralight: "200",
    ultralight: "200",
    light: "300",
    regular: "400",
    normal: "400",
    medium: "500",
    semibold: "600",
    demibold: "600",
    bold: "700",
    extrabold: "800",
    ultrabold: "800",
    black: "900",
    heavy: "900",
  };

  let weight: string | undefined;
  let style: "normal" | "italic" | undefined;

  // italic 검출
  if (base.includes("italic")) {
    style = "italic";
  }

  // weight 검출 (가장 긴 매치 우선)
  const sortedKeys = Object.keys(weightMap).sort((a, b) => b.length - a.length);
  for (const keyword of sortedKeys) {
    if (base.includes(keyword)) {
      weight = weightMap[keyword];
      break;
    }
  }

  return { weight, style };
}

function readFileAsDataUrl(
  file: File,
  /** 순수 모듈이라 훅을 못 쓴다 — 호출부가 해소한 문구를 넘긴다. */
  unreadableMessage: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(unreadableMessage));
    reader.readAsDataURL(file);
  });
}

// ============================================
// Re-exports (소비자 변경 최소화)
// ============================================

export {
  addFontFace,
  removeFontFace,
  loadFontRegistry,
  FONT_REGISTRY_STORAGE_KEY,
};
export type { FontFaceAsset, FontRegistryV2 };

/** 기본 폰트 패밀리 — body 상속, 스타일 패널 폴백 등에서 참조 */
export const DEFAULT_FONT_FAMILY = "Pretendard";

/**
 * CanvasKit fontFamilies 말미 공통 fallback 체인.
 *
 * 측정기(canvaskitTextMeasurer)와 렌더러(specShapeConverter)가 같은 기본
 * 폰트로 수렴해야 한다 (canvas-rendering.md §3 — 불일치 시 줄바꿈 위치
 * 어긋남). 선두는 DEFAULT_BASE_TYPOGRAPHY 의 첫 family 와 동일한
 * DEFAULT_FONT_FAMILY — 구 렌더러 tail 은 "Inter" 로 어긋나 기본 폰트
 * 텍스트가 측정(Pretendard)↔렌더(Inter)로 발산했다.
 */
export const CANVAS_FONT_FALLBACK_FAMILIES: readonly string[] = [
  DEFAULT_FONT_FAMILY,
  "system-ui",
  "sans-serif",
];

/** Base Typography 타입 */
export type BaseTypography = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
};

/**
 * 프로젝트 기본 타이포그래피 단일 정본 (ADR-056)
 *
 * Canvas(ROOT_COMPUTED_STYLE) / Preview(postMessage) / Publish(index.css)
 * 3경로의 font-family, font-size, line-height 기준값.
 *
 * 정본 위치: apps/builder/src/builder/fonts/customFonts.ts
 */
export const DEFAULT_BASE_TYPOGRAPHY: BaseTypography = {
  fontFamily:
    "Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, 'Helvetica Neue', 'Segoe UI', sans-serif",
  fontSize: 16,
  lineHeight: 1.5,
};

/** CSS font-family 체인에서 첫 번째 패밀리 이름만 추출 */
export function extractFirstFontFamily(raw: string): string {
  return (
    raw
      .split(",")[0]
      .trim()
      .replace(/^["']|["']$/g, "") || DEFAULT_FONT_FAMILY
  );
}

/** CSS font-weight 문자열 → 숫자 문자열 정규화 ("normal"→"400", "bold"→"700") */
export function normalizeFontWeight(raw: string): string {
  if (raw === "normal") return "400";
  if (raw === "bold") return "700";
  return raw;
}

export const DEFAULT_FONT_OPTIONS = [
  { value: "reset", label: "Reset" },
  { value: "Pretendard", label: "Pretendard" },
  { value: "Inter", label: "Inter" },
];

// ============================================
// Font Weight 정보
// ============================================

const WEIGHT_LABELS: Record<string, string> = {
  "100": "Thin",
  "200": "Extra Light",
  "300": "Light",
  "400": "Normal",
  "500": "Medium",
  "600": "Semi Bold",
  "700": "Bold",
  "800": "Extra Bold",
  "900": "Black",
};

/** 빌트인 Variable font families — 100~900 전체 weight 지원 */
const VARIABLE_FONT_FAMILIES = new Set(["Pretendard", "Inter"]);

/**
 * 특정 폰트 패밀리의 가용 weight 옵션을 반환한다.
 *
 * - 빌트인(Pretendard/Inter): Variable font, 100~900 전체
 * - 커스텀 폰트: registry에서 해당 family의 face별 weight 수집
 */
export function getFontWeightOptions(
  family: string,
  registryFaces: ReadonlyArray<{ family: string; weight?: string }>,
): Array<{ value: string; label: string }> {
  let weights: string[];

  if (VARIABLE_FONT_FAMILIES.has(family)) {
    weights = ["100", "200", "300", "400", "500", "600", "700", "800", "900"];
  } else {
    const familyFaces = registryFaces.filter((f) => f.family === family);
    if (familyFaces.length > 0) {
      const weightSet = new Set<string>();
      for (const face of familyFaces) {
        weightSet.add(face.weight ?? "400");
      }
      weights = Array.from(weightSet).sort((a, b) => Number(a) - Number(b));
    } else {
      weights = ["400"];
    }
  }

  return [
    { value: "reset", label: "Reset" },
    ...weights.map((w) => ({
      value: w,
      label: WEIGHT_LABELS[w] ?? w,
    })),
  ];
}
