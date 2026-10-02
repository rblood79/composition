/**
 * useResponsiveOverrides — 선택 요소의 breakpoint override 요약 (ADR-154)
 *
 * Inspector 반응형 배지/섹션이 소비하는 read 훅. desktop = base(props.style)
 * 이므로 override 판정은 **raw `element.responsive`** 를 읽는다 (병합 map 에서
 * `style?.X != null` 재판정 금지 — feedback-merged-style-map-kills-override-detection).
 */

import { useMemo } from "react";
import type { ResponsiveVisibility } from "@composition/shared";
import { useCanonicalPropertyElement } from "../../properties/hooks/useCanonicalPropertyRead";
import { useStylesActiveBreakpoint, useStylesSelectedId } from "../stylesHost";
import { ResponsiveOverridesInfo } from "./useResponsiveOverrides";

/**
 * ADR-248 4e-7: the old element store's part of `useResponsiveOverrides.ts` (moved out so the catalog Builder's
 * import graph does not reach the old store). Goes with the old store.
 */
const EMPTY_PROPS: string[] = [];

const EMPTY_VALUES: Record<string, unknown> = {};

/** The old store's read: the raw `element.responsive` of the selected element. */
export function useStoreResponsiveOverrides(): ResponsiveOverridesInfo {
  const activeBreakpoint = useStylesActiveBreakpoint();
  const selectedElementId = useStylesSelectedId();
  const element = useCanonicalPropertyElement(selectedElementId ?? "");

  return useMemo(() => {
    const responsive = element?.responsive;
    const styles = (responsive?.styles ?? {}) as Record<
      string,
      Record<string, unknown>
    >;
    const visibility = (responsive?.visibility ?? {}) as ResponsiveVisibility;

    // 활성 breakpoint override prop 목록
    const activeOverriddenProps =
      activeBreakpoint === "desktop"
        ? EMPTY_PROPS
        : Object.keys(styles)
            .filter((key) => styles[key]?.[activeBreakpoint] !== undefined)
            .sort();
    const activeOverrideValues =
      activeBreakpoint === "desktop"
        ? EMPTY_VALUES
        : Object.fromEntries(
            activeOverriddenProps.map((key) => [
              key,
              styles[key]?.[activeBreakpoint],
            ]),
          );

    // tablet+mobile 전체 override 항목 수 (style prop×bp + visibility)
    let totalOverrideCount = 0;
    for (const key of Object.keys(styles)) {
      for (const bp of ["tablet", "mobile"] as const) {
        if (styles[key]?.[bp] !== undefined) totalOverrideCount++;
      }
    }
    for (const bp of ["tablet", "mobile"] as const) {
      if (visibility[bp] !== undefined) totalOverrideCount++;
    }

    const baseHidden =
      (element?.props?.style as Record<string, unknown> | undefined)
        ?.display === "none";

    return {
      activeBreakpoint,
      isBase: activeBreakpoint === "desktop",
      activeOverriddenProps,
      activeOverrideValues,
      activeOverrideCount: activeOverriddenProps.length,
      totalOverrideCount,
      visibility,
      baseHidden,
    };
  }, [element, activeBreakpoint]);
}
