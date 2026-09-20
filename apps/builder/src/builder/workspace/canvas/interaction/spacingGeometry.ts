/**
 * ADR-222 Phase 1 — padding·gap 띠와 핸들의 순수 기하 (breakdown §3).
 *
 * 입력은 scene 좌표의 owner border-box · border 두께 · effective padding · in-flow
 * 자식 bounds 와 gap 값이다. 자식 위치와 부모 경계의 거리를 padding 으로 쓰지 않고
 * (alignment 여유가 섞인다) **설정된 값**으로 띠를 만든다. 0 값은 두께 0 띠 + 합성
 * 핸들이다 — 사선으로 부풀리지 않는다. 히트와 그리기가 같은 결과를 읽는다.
 */

import { pointInBox, type BoundingBox } from "../selection/types";
import type {
  SpacingBoxMetrics,
  SpacingProperty,
  SpacingSide,
} from "../../../presentation/editorPresentationSpacingCapability";
import { PADDING_PROPERTY_BY_SIDE } from "../../../presentation/editorPresentationSpacingCapability";

export type SpacingBandKind = "padding" | "gap";

/** 띠의 조절 축 — "y" 는 위아래로 끌어 값을 바꾸는 가로 띠, "x" 는 좌우로 끄는 세로 띠 */
export type SpacingBandAxis = "x" | "y";

export interface SpacingBand {
  readonly id: string;
  readonly kind: SpacingBandKind;
  readonly side: SpacingSide | null;
  readonly gapIndex: number | null;
  readonly property: SpacingProperty;
  readonly axis: SpacingBandAxis;
  /** 띠 영역 (scene) — 값 0 이면 두께 0 */
  readonly rect: BoundingBox;
  /** 현재 값 (px) */
  readonly value: number;
  /** 포인터를 +축 방향으로 끌 때 값이 커지면 +1 */
  readonly sign: 1 | -1;
}

export interface SpacingGapGeometryInput {
  readonly axis: "horizontal" | "vertical";
  readonly value: number;
  readonly reverse: boolean;
  /** in-flow 자식 bounds (scene) — 순서 무관, 축 위치로 정렬한다 */
  readonly childBounds: readonly BoundingBox[];
}

export interface SpacingGeometryInput {
  readonly ownerBounds: BoundingBox;
  readonly border: SpacingBoxMetrics;
  readonly padding: SpacingBoxMetrics | null;
  readonly gap: SpacingGapGeometryInput | null;
}

/** 상시 핸들 길이·두께 (화면 px, breakdown §1.2 초기 제안값) */
export const SPACING_HANDLE_LENGTH = 12;
export const SPACING_HANDLE_THICKNESS = 2;
export const SPACING_HANDLE_THICKNESS_ACTIVE = 3;
/** 핸들 히트 영역 최소 크기 (화면 px) */
export const SPACING_HANDLE_HIT = 12;
/** 두께 0 띠의 최소 히트 두께 (화면 px) */
export const SPACING_BAND_MIN_HIT = 4;

function paddingBox(
  ownerBounds: BoundingBox,
  border: SpacingBoxMetrics,
): BoundingBox {
  return {
    x: ownerBounds.x + border.left,
    y: ownerBounds.y + border.top,
    width: Math.max(0, ownerBounds.width - border.left - border.right),
    height: Math.max(0, ownerBounds.height - border.top - border.bottom),
  };
}

function buildPaddingBands(
  pb: BoundingBox,
  padding: SpacingBoxMetrics,
): SpacingBand[] {
  const band = (
    side: SpacingSide,
    rect: BoundingBox,
    axis: SpacingBandAxis,
    sign: 1 | -1,
  ): SpacingBand => ({
    id: `padding:${side}`,
    kind: "padding",
    side,
    gapIndex: null,
    property: PADDING_PROPERTY_BY_SIDE[side],
    axis,
    rect,
    value: padding[side],
    sign,
  });
  // 네 띠 모두 padding-box 의 한 변 **전체** 길이다 — 상·하는 폭 전체, 좌·우는 높이 전체 (Figma 와
  // 같다, 2026-09-20 사용자 지적: 좌·우 사선이 상·하 padding 만큼 짧았다). 코너는 겹치지만
  // 히트는 배열 순서 (상·하 먼저) 라 코너 소유는 종전대로 상·하 띠다 (§3.2).
  return [
    // 바깥쪽으로 끌면 커진다 (2026-09-17 사용자 지적 — top 은 위로, right 는 오른쪽으로)
    band(
      "top",
      { x: pb.x, y: pb.y, width: pb.width, height: padding.top },
      "y",
      -1,
    ),
    band(
      "bottom",
      {
        x: pb.x,
        y: pb.y + pb.height - padding.bottom,
        width: pb.width,
        height: padding.bottom,
      },
      "y",
      1,
    ),
    band(
      "left",
      { x: pb.x, y: pb.y, width: padding.left, height: pb.height },
      "x",
      -1,
    ),
    band(
      "right",
      {
        x: pb.x + pb.width - padding.right,
        y: pb.y,
        width: padding.right,
        height: pb.height,
      },
      "x",
      1,
    ),
  ];
}

function buildGapBands(
  pb: BoundingBox,
  padding: SpacingBoxMetrics | null,
  gap: SpacingGapGeometryInput,
): SpacingBand[] {
  if (gap.childBounds.length < 2) return [];
  const pad = padding ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const contentX = pb.x + pad.left;
  const contentWidth = Math.max(0, pb.width - pad.left - pad.right);
  const contentY = pb.y + pad.top;
  const contentHeight = Math.max(0, pb.height - pad.top - pad.bottom);
  const vertical = gap.axis === "vertical";
  const sorted = [...gap.childBounds].sort((a, b) =>
    vertical ? a.y - b.y : a.x - b.x,
  );
  const property: SpacingProperty = vertical ? "rowGap" : "columnGap";
  const sign: 1 | -1 = gap.reverse ? -1 : 1;
  const bands: SpacingBand[] = [];
  for (let index = 0; index < sorted.length - 1; index++) {
    const previous = sorted[index];
    const next = sorted[index + 1];
    // 설정된 gap 폭만 띠로 잡는다 — 정렬 여유·margin 은 포함하지 않는다 (§3.3).
    // 시각 순서상 앞 자식의 끝에서 시작하고 다음 자식의 시작을 넘지 않는다.
    const start = vertical
      ? previous.y + previous.height
      : previous.x + previous.width;
    const limit = vertical ? next.y : next.x;
    const thickness = Math.max(0, Math.min(gap.value, limit - start));
    bands.push({
      id: `gap:${index}`,
      kind: "gap",
      side: null,
      gapIndex: index,
      property,
      axis: vertical ? "y" : "x",
      rect: vertical
        ? { x: contentX, y: start, width: contentWidth, height: thickness }
        : { x: start, y: contentY, width: thickness, height: contentHeight },
      value: gap.value,
      sign,
    });
  }
  return bands;
}

export function buildSpacingBands(
  input: SpacingGeometryInput,
): readonly SpacingBand[] {
  const pb = paddingBox(input.ownerBounds, input.border);
  const bands: SpacingBand[] = [];
  if (input.padding) bands.push(...buildPaddingBands(pb, input.padding));
  if (input.gap) bands.push(...buildGapBands(pb, input.padding, input.gap));
  return bands;
}

/** 띠 중앙의 핸들 rect (scene) — 길이·두께는 화면 px 고정 */
export function resolveSpacingHandleRect(
  band: SpacingBand,
  zoom: number,
  active = false,
): BoundingBox {
  const length = SPACING_HANDLE_LENGTH / zoom;
  const thickness =
    (active ? SPACING_HANDLE_THICKNESS_ACTIVE : SPACING_HANDLE_THICKNESS) /
    zoom;
  const cx = band.rect.x + band.rect.width / 2;
  const cy = band.rect.y + band.rect.height / 2;
  return band.axis === "y"
    ? {
        x: cx - length / 2,
        y: cy - thickness / 2,
        width: length,
        height: thickness,
      }
    : {
        x: cx - thickness / 2,
        y: cy - length / 2,
        width: thickness,
        height: length,
      };
}

export interface SpacingHit {
  readonly band: SpacingBand;
  readonly onHandle: boolean;
}

/**
 * 핸들 (화면 12×12 px 정사각) → 띠 영역 (두께 0 은 최소 4 px) 순으로 판정한다.
 * 겹치면 먼저 만난 것 — 띠 배열 순서는 padding 4변 → gap 이다.
 */
export function hitTestSpacingBands(
  point: { x: number; y: number },
  bands: readonly SpacingBand[],
  zoom: number,
): SpacingHit | null {
  const hit = SPACING_HANDLE_HIT / zoom;
  for (const band of bands) {
    const cx = band.rect.x + band.rect.width / 2;
    const cy = band.rect.y + band.rect.height / 2;
    if (
      pointInBox(point, {
        x: cx - hit / 2,
        y: cy - hit / 2,
        width: hit,
        height: hit,
      })
    ) {
      return { band, onHandle: true };
    }
  }
  const minHit = SPACING_BAND_MIN_HIT / zoom;
  for (const band of bands) {
    const rect = band.rect;
    const expanded: BoundingBox =
      band.axis === "y" && rect.height < minHit
        ? { ...rect, y: rect.y + rect.height / 2 - minHit / 2, height: minHit }
        : band.axis === "x" && rect.width < minHit
          ? { ...rect, x: rect.x + rect.width / 2 - minHit / 2, width: minHit }
          : rect;
    if (pointInBox(point, expanded)) {
      return { band, onHandle: false };
    }
  }
  return null;
}

/** 띠 축 기준 pointer 이동량 → 값 delta (scene px, zoom 은 호출부가 나눈다) */
export function spacingDeltaFromPointer(
  band: SpacingBand,
  dx: number,
  dy: number,
): number {
  return (band.axis === "y" ? dy : dx) * band.sign;
}

/** 조절 축에 맞는 커서 */
export function resolveSpacingCursor(band: SpacingBand): string {
  return band.axis === "y" ? "ns-resize" : "ew-resize";
}
