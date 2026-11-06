/**
 * Lucide 아이콘 SVG 경로 레지스트리
 *
 * Lucide 아이콘 라이브러리의 SVG 경로 데이터를 저장.
 * 원본 viewBox: 0 0 24 24, strokeWidth: 2, stroke-linecap: round, stroke-linejoin: round
 *
 * CanvasKit에서 Path.MakeFromSVGString()으로 렌더링.
 *
 * 전체 아이콘 데이터는 lucideIconData.generated.ts에서 자동 생성됨.
 * 빌드 스크립트: packages/rendering/scripts/extract-lucide-icons.mjs
 *
 * @see https://lucide.dev/icons
 */

import {
  LUCIDE_ICON_DATA,
  LUCIDE_ALIASES,
  LUCIDE_ICON_NAMES,
} from "./lucideIconData.generated";
import { spectrumIconData, SPECTRUM_ICON_NAMES } from "./spectrumIcons";

/** Lucide 아이콘 데이터: SVG path `d` 속성 배열 (24x24 viewBox 기준) */
export interface LucideIconData {
  /** 생략하면 Lucide의 24px viewBox와 stroke를 사용한다. */
  viewBoxSize?: number;
  filled?: boolean;
  /** SVG path d 속성 배열 (다중 경로 지원) */
  paths: string[];
  /** circle 요소 (cx, cy, r) — search 등 아이콘용 */
  circles?: Array<{ cx: number; cy: number; r: number }>;
}

/**
 * 전체 아이콘 이름 목록 (검색/UI용)
 */
export { LUCIDE_ICON_NAMES, LUCIDE_ALIASES };

/** 편집기 검색에서 제공하는 Lucide 및 S2 공통 glyph. */
export const ICON_NAMES: readonly string[] = [
  ...LUCIDE_ICON_NAMES,
  ...SPECTRUM_ICON_NAMES,
];

/**
 * 아이콘 경로 데이터 조회
 *
 * @param name - 아이콘 이름 (예: 'chevron-down')
 * @param family - 아이콘 라이브러리 (기본: 'lucide')
 * @returns 아이콘 데이터 또는 null
 */
export function getIconData(
  name: string,
  family: string = "lucide",
  size: string = "M",
): LucideIconData | null {
  if (family !== "lucide") return null;
  const spectrum = spectrumIconData(name, size);
  if (spectrum) return spectrum;

  // 직접 이름 조회
  const direct = LUCIDE_ICON_DATA[name];
  if (direct) return direct;

  // 별칭 조회
  const canonical = LUCIDE_ALIASES[name];
  if (canonical) return LUCIDE_ICON_DATA[canonical] ?? null;

  return null;
}
