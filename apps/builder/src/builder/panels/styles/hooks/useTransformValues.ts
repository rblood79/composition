import { useMemo } from "react";
import { useElementStyleContext } from "./useElementStyleContext";
import { useStylesHost } from "../stylesHost";
import { isBodyType } from "@composition/shared";
import {
  resolveSpecPreset,
  type TransformSpecPreset,
} from "../utils/specPresetResolver";

export interface TransformTier {
  inline: string | number | undefined;
  effective: number | undefined;
  /**
   * The drawn record's effective value where nothing is authored (`catalogEffectiveStyle` —
   * "100%", "fit-content", "68px" …); the old name is the Transform section's.
   */
  specDefault: number | string | undefined;
}

export interface TransformValuesBundle {
  width: TransformTier;
  height: TransformTier;
  position: TransformTier;
  top: TransformTier;
  left: TransformTier;
  minWidth: TransformTier;
  maxWidth: TransformTier;
  minHeight: TransformTier;
  maxHeight: TransformTier;
  aspectRatio: TransformTier;
  /** overflow — Size 절로 이동 (panel-ui 01). record 에 없으면 "visible". */
  overflow: TransformTier;
  isBody: boolean;
}

/**
 * 어느 축의 layout 실측 (`effective`) 을 구독할지 — Size 절은 width/height 만, Position 절은 x/y 만.
 * 안 보는 축을 구독하면 캔버스 드래그 (x/y) 가 Size 절을, 리사이즈 (w/h) 가 Position 절을
 * 매 layout publish 마다 다시 그린다. `none` 은 inline/record 값만 (PositionSection 의 접힘 판정).
 */
export type TransformLayoutAxes = "all" | "size" | "position" | "none";

export function useTransformValues(
  id: string | null,
  layoutAxes: TransformLayoutAxes = "all",
): TransformValuesBundle | null {
  const { style, effective: record, type, size } = useElementStyleContext(id);
  const { useLayoutValue } = useStylesHost();

  const sizeId = layoutAxes === "all" || layoutAxes === "size" ? id : null;
  const positionId =
    layoutAxes === "all" || layoutAxes === "position" ? id : null;
  const effWidth = useLayoutValue(sizeId, "width");
  const effHeight = useLayoutValue(sizeId, "height");
  const effLeft = useLayoutValue(positionId, "x");
  const effTop = useLayoutValue(positionId, "y");

  const isBody = isBodyType(type);

  // record 에 없는 키만 자기 type rule 로 (containerStyles 의 길이 키워드).
  const preset = useMemo<TransformSpecPreset>(
    () => resolveSpecPreset(type, size),
    [type, size],
  );

  return useMemo(() => {
    if (!id) return null;
    const styleRec = (style ?? {}) as Record<
      string,
      string | number | undefined
    >;
    const recordRec = (record ?? {}) as Record<
      string,
      number | string | undefined
    >;
    const presetRec = preset as Record<string, number | string | undefined>;

    const tier = (prop: string, effective?: number): TransformTier => ({
      inline: styleRec[prop],
      effective,
      specDefault: recordRec[prop] ?? presetRec[prop],
    });

    return {
      width: tier("width", effWidth),
      height: tier("height", effHeight),
      position: tier("position"),
      top: tier("top", effTop),
      left: tier("left", effLeft),
      minWidth: tier("minWidth"),
      maxWidth: tier("maxWidth"),
      minHeight: tier("minHeight"),
      maxHeight: tier("maxHeight"),
      aspectRatio: tier("aspectRatio"),
      overflow: tier("overflow"),
      isBody,
    };
  }, [
    id,
    style,
    record,
    preset,
    effWidth,
    effHeight,
    effTop,
    effLeft,
    isBody,
  ]);
}
