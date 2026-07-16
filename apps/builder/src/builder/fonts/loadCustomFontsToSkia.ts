/**
 * FontRegistryV2 ↔ SkiaFontManager 브릿지 모듈
 *
 * Phase A+B에서 구축한 FontRegistryV2 데이터를
 * Skia Canvas 렌더링에 반영하는 Phase C 핵심 로직.
 *
 * 동일 패밀리의 여러 weight/style 변형을 개별 로드한다.
 */

import { loadFontRegistry, type FontFaceAsset } from "@composition/shared";
import { skiaFontManager } from "../workspace/canvas/skia/fontManager";
import { resolveFontUrl } from "../../fonts/builtinFonts";

/** 빌트인 폰트 — unloadFont 대상에서 제외 */
const PROTECTED_FAMILIES = new Set(["Pretendard", "Inter"]);

/**
 * Canvas 2D 측정 경로(USE_CANVAS2D_MEASURE)를 위해 document.fonts에도 폰트를 등록한다.
 * CanvasKit은 CSS @font-face를 사용하지 않으므로 두 경로가 별도로 로드해야 한다.
 * Pretendard는 index.css의 @import로 이미 로드되어 있으므로 스킵.
 *
 * weight/style descriptor를 전달하여 브라우저가 올바른 face를 매핑하도록 한다.
 * 미전달 시 font-weight: 700 요청에도 400 face가 매핑되어 fake-bold 처리됨.
 */
async function registerFontInBrowser(
  family: string,
  url: string,
  weight?: string,
  style?: string,
): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  // weight/style 포함한 특정 face가 이미 로드되어 있으면 스킵
  const checkStr = `${weight ?? 400} ${style === "italic" ? "italic " : ""}12px "${family}"`;
  if (document.fonts.check(checkStr)) return;
  try {
    const descriptors: FontFaceDescriptors = {};
    if (weight) descriptors.weight = weight;
    if (style) descriptors.style = style;
    const face = new FontFace(family, `url(${url})`, descriptors);
    await face.load();
    document.fonts.add(face);
  } catch (e) {
    console.warn(`[registerFontInBrowser] ${family} CSS 등록 실패:`, e);
  }
}

/**
 * 빌트인 Variable 폰트를 Skia에 로드한다.
 *
 * Variable font = 모든 weight(100~900) + OpenType features 단일 파일.
 * - Pretendard Variable: cv02/cv03/cv04/cv11 (single-story a) 지원
 * - Inter Variable: cv01~cv11, ss01~ss08 지원
 *
 * public/fonts/ 에 위치한 woff2를 직접 fetch.
 */
export async function loadBuiltinFontsToSkia(): Promise<void> {
  const builtins: Array<{ family: string; url: string; fallbackUrl?: string }> =
    [
      {
        family: "Pretendard",
        url: resolveFontUrl("fonts/PretendardVariable.woff2"),
      },
      {
        family: "Inter",
        url: resolveFontUrl("fonts/InterVariable.woff2"),
      },
    ];

  for (const { family, url, fallbackUrl } of builtins) {
    if (skiaFontManager.hasFont(family)) continue;
    try {
      await skiaFontManager.loadFont(family, url);
      // Canvas 2D 측정 경로를 위해 document.fonts에도 등록 (Pretendard 제외: 이미 CSS로 로드됨)
      if (family !== "Pretendard") {
        await registerFontInBrowser(family, url);
      }
    } catch (e) {
      console.warn(`[loadBuiltinFontsToSkia] ${family} Variable 로드 실패:`, e);
      if (fallbackUrl) {
        try {
          await skiaFontManager.loadFont(family, fallbackUrl);
          if (family !== "Pretendard") {
            await registerFontInBrowser(family, fallbackUrl);
          }
        } catch (e2) {
          console.error(
            `[loadBuiltinFontsToSkia] ${family} fallback도 실패:`,
            e2,
          );
        }
      }
    }
  }
}

/** @deprecated loadBuiltinFontsToSkia()로 대체 */
export const loadPretendardToSkia = loadBuiltinFontsToSkia;

/**
 * data URL → ArrayBuffer 변환.
 * 브라우저 fetch API가 data: URI를 지원한다.
 */
async function dataUrlToArrayBuffer(dataUrl: string): Promise<ArrayBuffer> {
  const response = await fetch(dataUrl);
  return response.arrayBuffer();
}

/**
 * 단일 FontFaceAsset을 SkiaFontManager에 로드.
 * weight/style 정보를 포함하여 같은 family의 여러 변형을 개별 등록한다.
 * @returns 로드 성공 여부
 */
async function loadSingleFontToSkia(face: FontFaceAsset): Promise<boolean> {
  const family = face.family.trim();
  if (!family) return false;

  const weight = face.weight;
  const style = face.style;

  // 같은 family+weight+style 변형이 이미 있으면 스킵
  if (skiaFontManager.hasFont(family, weight, style)) return true;

  try {
    if (face.source.type === "data-url-temp") {
      const buffer = await dataUrlToArrayBuffer(face.source.url);
      skiaFontManager.loadFontFromBuffer(family, buffer, weight, style);
      // Canvas 2D 측정 경로를 위해 document.fonts에도 등록 (weight/style descriptor 포함)
      await registerFontInBrowser(family, face.source.url, weight, style);
    } else {
      // project-asset, remote-url
      await skiaFontManager.loadFont(family, face.source.url, weight, style);
      await registerFontInBrowser(family, face.source.url, weight, style);
    }
    return true;
  } catch (e) {
    console.warn(`[loadCustomFontsToSkia] 폰트 로드 실패 (${family}):`, e);
    return false;
  }
}

/**
 * FontRegistryV2의 모든 커스텀 폰트를 SkiaFontManager에 로드.
 * 이미 로드된 변형은 hasFont(family, weight, style) 체크로 스킵.
 * @returns 로드된 폰트 수
 */
export async function loadAllCustomFontsToSkia(): Promise<number> {
  const registry = loadFontRegistry();

  let loaded = 0;
  for (const face of registry.faces) {
    const ok = await loadSingleFontToSkia(face);
    if (ok) loaded++;
  }

  // 부트 폰트 배치(빌트인 → 커스텀)의 종료 지점 — FromData 전체 재파싱을
  // 첫 rAF 프레임의 lazy getFontMgr() 경로에서 분리해 여기서 선지불한다.
  // (커스텀 폰트 0개여도 빌트인 로드가 dirty 를 세팅한 상태라 warm 필요)
  skiaFontManager.warmFontMgr();
  return loaded;
}

/**
 * 레지스트리와 SkiaFontManager를 동기화한다.
 * - 레지스트리에 없는 폰트 → Skia에서 제거 (빌트인 제외)
 * - 레지스트리에 있지만 Skia에 없는 폰트 → 로드
 * @returns 새로 로드된 폰트 수
 */
export async function syncCustomFontsWithSkia(): Promise<number> {
  const registry = loadFontRegistry();
  const registryFamilies = new Set(registry.faces.map((f) => f.family.trim()));

  // Skia에 있지만 레지스트리에 없는 폰트 제거
  for (const family of skiaFontManager.getFamilies()) {
    if (PROTECTED_FAMILIES.has(family)) continue;
    if (!registryFamilies.has(family)) {
      skiaFontManager.unloadFont(family);
    }
  }

  // 레지스트리에 있지만 Skia에 없는 변형 로드
  let loaded = 0;
  for (const face of registry.faces) {
    const ok = await loadSingleFontToSkia(face);
    if (ok) loaded++;
  }

  // 동기화 배치 종료 지점 — notifyLayoutChange 이후 프레임이 dirty 재구축을
  // 프레임 안에서 지불하지 않도록 여기서 선재구축한다.
  skiaFontManager.warmFontMgr();
  return loaded;
}
