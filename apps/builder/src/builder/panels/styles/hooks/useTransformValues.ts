import { useMemo } from "react";
import { useElementStyleContext } from "./useElementStyleContext";
import { useLayoutValue } from "./useLayoutValue";
import {
  resolveSpecPreset,
  type TransformSpecPreset,
} from "../utils/specPresetResolver";

export interface TransformTier {
  inline: string | number | undefined;
  effective: number | undefined;
  /** ADR-082 A2: containerStyles/composition 에서 공급된 string 값 ("100%", "fit-content") 포함 */
  specDefault: number | string | undefined;
}

export interface TransformValuesBundle {
  width: TransformTier;
  height: TransformTier;
  top: TransformTier;
  left: TransformTier;
  minWidth: TransformTier;
  maxWidth: TransformTier;
  minHeight: TransformTier;
  maxHeight: TransformTier;
  aspectRatio: TransformTier;
  isBody: boolean;
}

export function useTransformValues(
  id: string | null,
): TransformValuesBundle | null {
  const { style, type, size } = useElementStyleContext(id);

  const effWidth = useLayoutValue(id, "width");
  const effHeight = useLayoutValue(id, "height");
  const effLeft = useLayoutValue(id, "x");
  const effTop = useLayoutValue(id, "y");

  const isBody = type?.toLowerCase() === "body";

  const specPreset = useMemo<TransformSpecPreset>(
    () => resolveSpecPreset(type, size),
    [type, size],
  );

  return useMemo(() => {
    if (!id) return null;
    const styleRec = (style ?? {}) as Record<
      string,
      string | number | undefined
    >;
    const presetRec = specPreset as Record<string, number | string | undefined>;

    const tier = (prop: string, effective?: number): TransformTier => ({
      inline: styleRec[prop],
      effective,
      specDefault: presetRec[prop],
    });

    return {
      width: tier("width", effWidth),
      height: tier("height", effHeight),
      top: tier("top", effTop),
      left: tier("left", effLeft),
      minWidth: tier("minWidth"),
      maxWidth: tier("maxWidth"),
      minHeight: tier("minHeight"),
      maxHeight: tier("maxHeight"),
      aspectRatio: tier("aspectRatio"),
      isBody,
    };
  }, [id, style, specPreset, effWidth, effHeight, effTop, effLeft, isBody]);
}
