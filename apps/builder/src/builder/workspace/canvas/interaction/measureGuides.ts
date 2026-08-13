/**
 * Alt 홀드 거리 측정 판정 (Figma Alt-measure 어법)
 *
 * 선택 bbox 와 호버 대상 rect 사이의 거리 세그먼트를 계산하는 순수 함수.
 * 스냅과 무관한 정적 측정 — 드래그 없이 hover + Alt 만으로 표시된다.
 *
 * - 분리(disjoint) 축: 마주 보는 edge 사이 1세그먼트 (직교 겹침 중앙에 배치,
 *   겹침이 없으면 선택 bbox 중앙).
 * - 포함(containment — 양축 모두): 안쪽 박스의 4변 → 바깥 박스 4변 inset
 *   4세그먼트 (Figma 의 부모/컨테이너 측정 동형).
 * - 한 축만 겹치는 부분 겹침: 그 축은 측정 없음 (V1 범위).
 */

export interface MeasureRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MeasureGuide {
  /** 측정 축 — "x" = 가로 거리 (수평 세그먼트), "y" = 세로 거리 (수직 세그먼트) */
  axis: "x" | "y";
  /** 세그먼트 구간 (측정 축 좌표, start < end) */
  start: number;
  end: number;
  /** 세그먼트가 그려질 직교 축 좌표 */
  cross: number;
  /** 거리 값 (= end - start, scene px) */
  value: number;
}

/** 0 에 붙은 간격은 측정 표시 생략 (겹침/접촉) */
const MIN_MEASURE_GAP = 0.5;

function push(
  guides: MeasureGuide[],
  axis: "x" | "y",
  start: number,
  end: number,
  cross: number,
): void {
  if (end - start > MIN_MEASURE_GAP) {
    guides.push({ axis, start, end, cross, value: end - start });
  }
}

export function resolveMeasureGuides(
  selection: MeasureRect,
  target: MeasureRect,
): MeasureGuide[] {
  const guides: MeasureGuide[] = [];
  const selRight = selection.x + selection.width;
  const selBottom = selection.y + selection.height;
  const targetRight = target.x + target.width;
  const targetBottom = target.y + target.height;

  const selInTarget =
    target.x <= selection.x &&
    targetRight >= selRight &&
    target.y <= selection.y &&
    targetBottom >= selBottom;
  const targetInSel =
    selection.x <= target.x &&
    selRight >= targetRight &&
    selection.y <= target.y &&
    selBottom >= targetBottom;

  if (selInTarget || targetInSel) {
    // 포함 — 안쪽 박스 기준 4방 inset
    const inner = selInTarget ? selection : target;
    const outer = selInTarget ? target : selection;
    const innerCenterX = inner.x + inner.width / 2;
    const innerCenterY = inner.y + inner.height / 2;
    push(guides, "x", outer.x, inner.x, innerCenterY);
    push(
      guides,
      "x",
      inner.x + inner.width,
      outer.x + outer.width,
      innerCenterY,
    );
    push(guides, "y", outer.y, inner.y, innerCenterX);
    push(
      guides,
      "y",
      inner.y + inner.height,
      outer.y + outer.height,
      innerCenterX,
    );
    return guides;
  }

  // 분리 축 — 직교 겹침 중앙 (겹침 없으면 선택 bbox 중앙)
  const yOverlapLo = Math.max(selection.y, target.y);
  const yOverlapHi = Math.min(selBottom, targetBottom);
  const crossY =
    yOverlapHi > yOverlapLo
      ? (yOverlapLo + yOverlapHi) / 2
      : selection.y + selection.height / 2;
  const xOverlapLo = Math.max(selection.x, target.x);
  const xOverlapHi = Math.min(selRight, targetRight);
  const crossX =
    xOverlapHi > xOverlapLo
      ? (xOverlapLo + xOverlapHi) / 2
      : selection.x + selection.width / 2;

  if (target.x >= selRight) {
    push(guides, "x", selRight, target.x, crossY);
  } else if (targetRight <= selection.x) {
    push(guides, "x", targetRight, selection.x, crossY);
  }
  if (target.y >= selBottom) {
    push(guides, "y", selBottom, target.y, crossX);
  } else if (targetBottom <= selection.y) {
    push(guides, "y", targetBottom, selection.y, crossX);
  }
  return guides;
}
