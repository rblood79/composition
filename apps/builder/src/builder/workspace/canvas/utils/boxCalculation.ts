/**
 * Box Calculation Utilities
 *
 * border-box 크기 계산과 자식-부모 fit 계산을 제공하는
 * 렌더러 독립적 순수 수학 유틸리티.
 *
 * @since 2026-02-17 Phase 0
 */

// ============================================
// Types
// ============================================

/** 2D 크기 */
export interface Size2D {
  width: number;
  height: number;
}

/** 2D 스케일 */
export interface Scale2D {
  x: number;
  y: number;
}

/** 4방향 값 (padding, border, margin) */
export interface BoxSides {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// ============================================
// Fit-to-View Calculation
// ============================================

/**
 * 자식을 부모 영역에 맞추기 위한 스케일 계산
 *
 * fit-to-view 로직의 순수 수학 버전.
 * 부모 영역(padding 제외)에 자식이 들어가도록 스케일을 계산합니다.
 *
 * @param parentSize - 부모 크기
 * @param childSize - 자식 크기 (스케일 적용 전 원본)
 * @param childScale - 자식의 현재 스케일 (기본: {x:1, y:1})
 * @param padding - 부모와 자식 사이 여백 (기본: 0)
 * @param uniformScaling - 비율 유지 여부 (기본: true)
 * @returns 적용해야 할 스케일
 *
 * @example
 * const scale = calculateFitScale(
 *   { width: 200, height: 100 },
 *   { width: 300, height: 80 },
 *   { x: 1, y: 1 },
 *   10, // padding
 *   true
 * );
 * // scale = { x: 0.6, y: 0.6 } (300*0.6 = 180 <= 200-20)
 */
export function calculateFitScale(
  parentSize: Size2D,
  childSize: Size2D,
  childScale: Scale2D = { x: 1, y: 1 },
  padding: number = 0,
  uniformScaling: boolean = true,
): Scale2D {
  const maxWidth = parentSize.width - padding * 2;
  const maxHeight = parentSize.height - padding * 2;

  if (maxWidth <= 0 || maxHeight <= 0) {
    return { x: 0, y: 0 };
  }

  // 자식의 원래 크기 (스케일 적용 전)
  const childBaseWidth =
    childScale.x !== 0 ? childSize.width / childScale.x : childSize.width;
  const childBaseHeight =
    childScale.y !== 0 ? childSize.height / childScale.y : childSize.height;

  let scaleX = childScale.x;
  let scaleY = childScale.y;

  const widthOverflow = maxWidth - Math.round(childSize.width);
  const heightOverflow = maxHeight - Math.round(childSize.height);

  if (widthOverflow < 0 && childBaseWidth > 0) {
    scaleX = maxWidth / childBaseWidth;
  }
  if (heightOverflow < 0 && childBaseHeight > 0) {
    scaleY = maxHeight / childBaseHeight;
  }

  if (scaleX <= 0 || scaleY <= 0) {
    return { x: 0, y: 0 };
  }

  if (uniformScaling || childScale.x === childScale.y) {
    const scale = Math.min(scaleX, scaleY);
    return { x: scale, y: scale };
  }

  const ratio = childScale.x / childScale.y;
  if (widthOverflow < heightOverflow) {
    return { x: scaleX, y: scaleX / ratio };
  }
  return { x: scaleY * ratio, y: scaleY };
}

// ============================================
// Border-Box Size Calculation
// ============================================

/**
 * border-box 모델에서 content 영역 크기 계산
 *
 * CSS box-sizing: border-box와 동일:
 * contentWidth = totalWidth - paddingLeft - paddingRight - borderLeft - borderRight
 *
 * @param totalSize - border-box 기준 전체 크기
 * @param padding - padding (4방향)
 * @param border - border (4방향)
 * @returns content 영역 크기
 */
export function calculateContentSize(
  totalSize: Size2D,
  padding: BoxSides,
  border: BoxSides,
): Size2D {
  return {
    width: Math.max(
      0,
      totalSize.width -
        padding.left -
        padding.right -
        border.left -
        border.right,
    ),
    height: Math.max(
      0,
      totalSize.height -
        padding.top -
        padding.bottom -
        border.top -
        border.bottom,
    ),
  };
}

/**
 * content 영역에서 border-box 전체 크기 역산
 *
 * totalWidth = contentWidth + paddingLeft + paddingRight + borderLeft + borderRight
 *
 * @param contentSize - content 영역 크기
 * @param padding - padding (4방향)
 * @param border - border (4방향)
 * @returns border-box 기준 전체 크기
 */
export function calculateBorderBoxSize(
  contentSize: Size2D,
  padding: BoxSides,
  border: BoxSides,
): Size2D {
  return {
    width:
      contentSize.width +
      padding.left +
      padding.right +
      border.left +
      border.right,
    height:
      contentSize.height +
      padding.top +
      padding.bottom +
      border.top +
      border.bottom,
  };
}

/**
 * 최소 필요 크기 계산 (border + padding + content)
 *
 * self-rendering 컴포넌트의 auto 크기 계산에 사용하는 패턴.
 *
 * @param contentSize - 콘텐츠 크기 (텍스트 측정 결과 등)
 * @param padding - padding { top, right, bottom, left }
 * @param borderWidth - 균일한 border 너비 (단일 값)
 * @returns border-box 기준 최소 크기
 */
export function calculateMinRequiredSize(
  contentSize: Size2D,
  padding: BoxSides,
  borderWidth: number = 0,
): Size2D {
  return {
    width:
      borderWidth +
      padding.left +
      contentSize.width +
      padding.right +
      borderWidth,
    height:
      borderWidth +
      padding.top +
      contentSize.height +
      padding.bottom +
      borderWidth,
  };
}

// ============================================
// Anchor / Centering
// ============================================

/**
 * anchor 0.5 기반 중앙 배치 오프셋 계산
 *
 * @param containerSize - 컨테이너(부모) 크기
 * @returns 중앙 좌표
 */
export function calculateCenter(containerSize: Size2D): {
  x: number;
  y: number;
} {
  return {
    x: containerSize.width / 2,
    y: containerSize.height / 2,
  };
}

/**
 * 요소를 수직 중앙에 배치하기 위한 Y 오프셋 계산
 *
 * Slider의 트랙을 컨테이너 수직 중앙에 배치할 때 사용.
 * slider.y = (containerHeight - trackHeight) / 2
 *
 * @param containerHeight - 컨테이너 높이
 * @param childHeight - 자식 높이
 * @returns Y 오프셋
 */
export function calculateVerticalCenter(
  containerHeight: number,
  childHeight: number,
): number {
  return (containerHeight - childHeight) / 2;
}
