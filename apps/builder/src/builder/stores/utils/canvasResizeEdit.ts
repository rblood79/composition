import {
  getFillBehavior,
  getRatioDependentAxis,
  isValidFillFactor,
  type BreakpointName,
  type FillAxes,
  type FillParentContext,
  type SizeAxis,
} from "@composition/shared";
import type { Element } from "../../../types/core/store.types";
import { parseAspectRatio } from "../../utils/aspectRatio";
import { buildSizingEdit } from "./sizingEdit";
import { inferSizeMode, resolveSizeMode } from "./sizeModeResolver";

/**
 * ADR-224 breakdown §4.3 · §5 — 캔버스 핸들 resize 의 저장 계약.
 *
 * marker 축을 직접 resize 하면 **그 축의 Fill 만** 해제되고 CSS px 로 굳는다 (Size 메뉴에서
 * Fixed 를 고른 것과 같은 한 경로 — `buildSizingEdit` css mode). 다른 축의 Fill 은 보존한다.
 * Ratio 잠금이 있으면 driver 축 하나만 commit 한다 (종속 축은 auto + ratio 그대로) — 그
 * 축 선택은 `resolveResizeRatioLock` 이 준다.
 */
export interface CanvasResizeRequest {
  width?: number;
  height?: number;
}

export interface ResizeRatioLock {
  /** 사용자가 쓰는 축 — 종속 축 (`auto`) 의 반대 */
  driver: SizeAxis;
  /** width / height */
  ratio: number;
}

const roundCssPx = (v: number): number => Math.round(v * 100) / 100;

/** Ratio 잠금 (종속 축이 하나 있고 ratio 가 파싱되는 경우) — 아니면 null. */
export function resolveResizeRatioLock(
  effectiveStyle: Record<string, unknown>,
  fill: FillAxes | undefined,
): ResizeRatioLock | null {
  const dependent = getRatioDependentAxis(effectiveStyle, fill);
  if (!dependent) return null;
  const ratio = parseAspectRatio(effectiveStyle.aspectRatio);
  if (!ratio) return null;
  return { driver: dependent === "height" ? "width" : "height", ratio };
}

/**
 * 드래그 미리보기가 엔진에 보낼 Fill 해제 키 — commit 이 지우는 것과 같은 집합
 * (`resolveSizeMode("fixed").remove`) 에, projection 이 넣은 `min* : 0px` (authored 가 없을
 * 때 fraction Fill 에만) 를 더한다. 값 `""` = 엔진 입력에서 제거.
 */
export function resolveFillReleasePatch(
  effectiveStyle: Record<string, unknown>,
  fill: FillAxes | undefined,
  axis: SizeAxis,
  context: FillParentContext,
): Record<string, ""> {
  const marker = fill?.[axis];
  const markerActive = !!marker && isValidFillFactor(marker.factor);
  const legacy =
    !markerActive &&
    inferSizeMode(
      effectiveStyle,
      axis,
      context.display,
      context.flexDirection,
    ) === "fill";
  if (!markerActive && !legacy) return {};
  const patch: Record<string, ""> = {};
  for (const key of resolveSizeMode(
    "fixed",
    axis,
    context.display,
    context.flexDirection,
  ).remove) {
    patch[key] = "";
  }
  if (
    markerActive &&
    getFillBehavior(axis, effectiveStyle, context) === "fraction"
  ) {
    const min = axis === "width" ? "minWidth" : "minHeight";
    const authored = effectiveStyle[min];
    if (authored == null || authored === "" || authored === "auto")
      patch[min] = "";
  }
  return patch;
}

/**
 * 요청된 축마다 `buildSizingEdit` css mode 를 순서대로 적용해 한 요소 갱신으로 합친다.
 * 축 하나라도 계획을 못 세우면 null (부분 commit 0).
 */
export function buildCanvasResizeEdit(
  source: Element,
  effective: Element,
  request: CanvasResizeRequest,
  context: FillParentContext,
  breakpoint: BreakpointName,
): Partial<Element> | null {
  let current: Element = source;
  let merged: Partial<Element> = {};
  for (const axis of ["width", "height"] as const) {
    const px = request[axis];
    if (px === undefined) continue;
    if (!Number.isFinite(px) || px < 0) return null;
    const updates = buildSizingEdit(
      current,
      effective,
      { axis, mode: "css", value: `${roundCssPx(px)}px` },
      context,
      breakpoint,
    );
    if (!updates) return null;
    current = { ...current, ...updates } as Element;
    merged = { ...merged, ...updates };
  }
  return merged;
}
