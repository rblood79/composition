export interface PropertyColorProps {
  label?: string;
  value: string; // Hex color string (e.g., "#FF0000") 또는 CSS 색상 표현
  onChange: (value: string) => void;
  /**
   * 드래그 중 연속 호출 — 캔버스 preview 채널 (updateStylePreview) 배선용.
   * 생략 시 커밋-only 동작 (드롭 시점에만 캔버스 반영).
   */
  onPreview?: (value: string) => void;
  /** ADR-187: migrated owner가 frame scheduling을 직접 소유하는지 여부. */
  presentationOwnsFrameScheduling?: boolean;
  /**
   * The catalog Builder: drags call `onPreview` (the Styles host previews on the Canvas) without
   * the presentation channel; the release commits only a changed value.
   */
  livePreview?: boolean;
  onPresentationCancel?: (reason: "pointer-cancel" | "escape") => void;
  placeholder?: string;
  className?: string;
  /**
   * 「■ 000000」 — 상자 안에 16 swatch + HEX 글자 (panel-ui 02, 2026-09-14). 기본 (false) 은
   * 종전처럼 swatch 가 상자를 채운다 (28 열 아이콘 자리용).
   */
  showValue?: boolean;
}

/**
 * hex8 (#RRGGBBAA) → 저장 포맷 정규화 — 불투명이면 종전 저장 포맷(#RRGGBB) 유지,
 * 알파 사용 시에만 hex8 그대로 기록한다.
 */
export function normalizeHexForStyle(hexa: string): string {
  return /^#[0-9a-fA-F]{8}$/.test(hexa) && hexa.slice(7).toLowerCase() === "ff"
    ? hexa.slice(0, 7)
    : hexa;
}

/** 값 비교 memo 는 그대로, 호출은 최신 콜백으로 (`withLatestCallbacks`). */
