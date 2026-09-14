/**
 * useResponsiveOverrides — 선택 요소의 breakpoint override 요약 (ADR-154)
 *
 * Inspector 반응형 배지/섹션이 소비하는 read 훅. desktop = base(props.style)
 * 이므로 override 판정은 **raw `element.responsive`** 를 읽는다 (병합 map 에서
 * `style?.X != null` 재판정 금지 — feedback-merged-style-map-kills-override-detection).
 */

import { useMemo } from "react";
import type { BreakpointName, ResponsiveVisibility } from "@composition/shared";
import { useStore } from "../../../stores";
import { useCanonicalPropertyElement } from "../../properties/hooks/useCanonicalPropertyRead";

export interface ResponsiveOverridesInfo {
  /** 현재 활성 breakpoint (canvasSettings SSOT) */
  activeBreakpoint: BreakpointName;
  /** desktop(=base) 편집 중인지 */
  isBase: boolean;
  /** 활성 breakpoint 에서 override 된 style prop 키 (정렬) — "어느 필드" 표시용 */
  activeOverriddenProps: string[];
  /** 활성 breakpoint 의 override 값 (키 → raw 값) — Overrides 목록 행 「width · 100%」 표시용 */
  activeOverrideValues: Record<string, unknown>;
  /** 활성 breakpoint override 개수 (배지 count) */
  activeOverrideCount: number;
  /** tablet+mobile 전체 override 항목 수 (요약) */
  totalOverrideCount: number;
  /** 요소 visibility override (raw, tablet/mobile) */
  visibility: ResponsiveVisibility;
  /** base(props.style.display === "none") — desktop 가시성 표시용 */
  baseHidden: boolean;
}

const EMPTY_PROPS: string[] = [];
const EMPTY_VALUES: Record<string, unknown> = {};

export function useResponsiveOverrides(): ResponsiveOverridesInfo {
  const activeBreakpoint = useStore((s) => s.activeBreakpoint);
  const selectedElementId = useStore((s) => s.selectedElementId);
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
