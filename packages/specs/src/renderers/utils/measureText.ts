/**
 * Spec 전용 텍스트 폭 측정 유틸리티
 *
 * Canvas 2D measureText()를 사용하여 Spec shapes에서
 * 텍스트 폭을 정확하게 측정합니다.
 * 추정값(fontSize * 0.6 * charCount) 대신 실측값을 사용.
 *
 * @since 2026-04-05
 * @see ADR-051
 */

let _ctx: CanvasRenderingContext2D | null = null;

function getCtx(): CanvasRenderingContext2D | null {
  if (!_ctx) {
    if (typeof document === "undefined") return null;
    _ctx = document.createElement("canvas").getContext("2d");
  }
  return _ctx;
}

/**
 * 텍스트 폭 측정 (Canvas 2D)
 *
 * @param text - 측정할 텍스트
 * @param fontSize - 폰트 크기 (px)
 * @param fontFamily - 폰트 패밀리
 * @param fontWeight - 폰트 굵기 (기본 400)
 * @returns 텍스트 폭 (px), Canvas 미지원 시 fontSize * 0.6 * text.length 근사값
 */
export function measureSpecTextWidth(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: number | string = 400,
): number {
  if (!text) return 0;
  const ctx = getCtx();
  if (!ctx) {
    // SSR / Canvas 미지원: 근사값
    return text.length * fontSize * 0.6;
  }
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  return ctx.measureText(text).width;
}

/**
 * Wrap 텍스트 블록 높이 측정기 — consumer(builder) 주입식 hook.
 *
 * spec escape(listbox_item 등)가 멀티라인 wrap 블록 높이를 알아야 stacked slot
 * (label/description) offset 을 paint 와 정합시킬 수 있다. 측정 엔진은 렌더러와 동일해야
 * (builder = CanvasKit Paragraph 기반 `measureWrappedTextHeight`) ±1줄 발산이 없으므로,
 * specs 가 자체 Canvas 2D greedy wrap 을 구현하는 대신 **consumer 가 주입**한다
 * (package boundary: specs ← builder — specs 는 인터페이스만 선언).
 *
 * 미주입(SSR/단위 테스트/비-builder consumer) 시 `measureSpecWrappedTextHeight` 가 null 을
 * 반환하고 caller 는 단일 줄(lineHeight) fallback — 기존 동작 보존(BC).
 *
 * @since 2026-07-22 (ListBox 행 긴 label/description wrap 겹침 수정)
 */
export type SpecWrappedTextHeightMeasurer = (
  text: string,
  fontSize: number,
  fontWeight: number | string,
  fontFamily: string,
  maxWidth: number,
  lineHeight?: number,
) => number;

let _wrappedHeightMeasurer: SpecWrappedTextHeightMeasurer | null = null;

/** consumer(builder)가 렌더러 동일 엔진 측정기를 주입. null 로 해제 가능(테스트). */
export function setSpecWrappedTextHeightMeasurer(
  measurer: SpecWrappedTextHeightMeasurer | null,
): void {
  _wrappedHeightMeasurer = measurer;
}

/**
 * 주입된 측정기로 wrap 블록 높이(px)를 측정. 미주입/빈 텍스트/무효 폭 → null (caller 가
 * 단일 줄 fallback).
 */
export function measureSpecWrappedTextHeight(
  text: string,
  fontSize: number,
  fontWeight: number | string,
  fontFamily: string,
  maxWidth: number,
  lineHeight?: number,
): number | null {
  if (!text || maxWidth <= 0 || !_wrappedHeightMeasurer) return null;
  return _wrappedHeightMeasurer(
    text,
    fontSize,
    fontWeight,
    fontFamily,
    maxWidth,
    lineHeight,
  );
}
