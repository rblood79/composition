/**
 * ColorPickerPalettes — 색 피커 아래 「Document · Theme」 팔레트 (panel-ui 05 #1, 2026-09-15)
 *
 * Document = 이 문서에서 쓰인 색 자동 수집 (useDocumentColors — 저장소 없음).
 * Theme = ADR-110 theme/tokens 의 실제 모델: 현재 accent tint 사다리 (theme 이 쓰는 lightness 6)
 * + neutral tone 사다리 (Tailwind 50 · 200 · 400 · 600 · 800 · 950) 두 행 — ThemesPanel Colors
 * 절과 같은 값, 이름 있는 팔레트는 없다. swatch 28 · 6열 gap 8 (208, 팝오버 215 안) · 헤더 28 ·
 * 그룹 라벨 18 — 새 값 0. 스와치 클릭 = 그 색을 commit (입력 필드와 같은 경로).
 */

/** Tailwind 사다리에서 고르는 6 단 — 50 · 200 · 400 · 600 · 800 · 950 (모두 실제 팔레트 값) */
export const NEUTRAL_LADDER_STEPS = [50, 200, 400, 600, 800, 950] as const;

export interface ColorPickerPalettesProps {
  /** 현재 색 (hex8) — 같은 색의 스와치에 선택 링 */
  value: string;
  onSelect: (hex8: string) => void;
}
