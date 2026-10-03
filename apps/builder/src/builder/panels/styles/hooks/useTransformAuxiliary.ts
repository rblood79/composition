import { useMemo } from "react";
import {
  inferFillGrow,
  inferSizeMode,
  type SizeMode,
} from "../../../stores/utils/sizeModeResolver";
import { useStylesHost } from "../stylesHost";
import { resolveSpecPreset } from "../utils/specPresetResolver";
import { useElementStyleContext } from "./useElementStyleContext";

/** ADR-082 A1: the parent's `display` (effective style → type container default → `block`). */
export function useParentDisplay(id: string | null): string {
  return useStylesHost().useParentLayout(id).display;
}

/** The parent's `flexDirection` (effective style → type container default → `row`). */
export function useParentFlexDirection(id: string | null): string {
  return useStylesHost().useParentLayout(id).flexDirection;
}

function useSizeMode(id: string | null, axis: "width" | "height"): SizeMode {
  const { style, type, size, sizing } = useElementStyleContext(id);
  const parentDisplay = useParentDisplay(id);
  const parentFlexDirection = useParentFlexDirection(id);
  const specPreset = useMemo(() => resolveSpecPreset(type, size), [type, size]);
  return useMemo(() => {
    if (sizing?.[axis]) return "fill";
    const resolvedStyle = { ...(style ?? {}) };
    if (resolvedStyle[axis] == null && specPreset[axis] != null) {
      resolvedStyle[axis] = specPreset[axis];
    }
    return inferSizeMode(
      resolvedStyle,
      axis,
      parentDisplay,
      parentFlexDirection,
    );
  }, [style, sizing, axis, parentDisplay, parentFlexDirection, specPreset]);
}

export function useWidthSizeMode(id: string | null): SizeMode {
  return useSizeMode(id, "width");
}

export function useHeightSizeMode(id: string | null): SizeMode {
  return useSizeMode(id, "height");
}

/**
 * Fill 의 grow 계수 (`2fr` → 2) — flex 부모 주축에서만, 그 외·Fill 아님은 null.
 * W/H 필드가 `fill` (1) 과 `Nfr` (N ≠ 1) 표기를 가르는 데 쓴다.
 */
export function useFillGrow(
  id: string | null,
  axis: "width" | "height",
): number | null {
  const { style, sizing } = useElementStyleContext(id);
  const parentDisplay = useParentDisplay(id);
  const parentFlexDirection = useParentFlexDirection(id);
  return useMemo(
    () =>
      sizing?.[axis]?.factor ??
      inferFillGrow(
        style ?? undefined,
        axis,
        parentDisplay,
        parentFlexDirection,
      ),
    [style, sizing, axis, parentDisplay, parentFlexDirection],
  );
}
