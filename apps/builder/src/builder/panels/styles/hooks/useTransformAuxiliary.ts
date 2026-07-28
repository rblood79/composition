import { useMemo } from "react";
import {
  inferSizeMode,
  type SizeMode,
} from "../../../stores/utils/sizeModeResolver";
// ADR-912 단계5 step4 (2026-06-17): TAG_SPEC_MAP 직독 → builder resolveContainerStylesFallback.
//   TAG_SPEC_MAP[type].containerStyles 는 catalog cutover spec(ListBox 등) 삭제 시 undefined →
//   부모 display/flexDirection fallback 소실(9-grid 정렬 비활성 회귀). builder fallback 은 spec
//   부재 시 LOWERCASE_COMPONENT_RULE_CONTAINER catalog rule.containerStyles 를 합성하므로 복구.
import { resolveContainerStylesFallback } from "../../../workspace/canvas/layout/engines/implicitStyles";
import { useCanonicalPropertyElement } from "../../properties/hooks/useCanonicalPropertyRead";
import { resolveSpecPreset } from "../utils/specPresetResolver";
import { useElementStyleContext } from "./useElementStyleContext";

function useParentId(id: string | null): string | null {
  const element = useCanonicalPropertyElement(id ?? "");
  return element?.parent_id ?? null;
}

/**
 * ADR-082 A1: 부모 Spec containerStyles.{display|flexDirection} fallback.
 *
 * inline 값이 없으면 부모의 type 기반 Spec containerStyles 에서 조회.
 * Fill/Hug mode 판정이 부모 Spec 기본값(예: ListBoxSpec.display="flex")도
 * 반영하도록 함. 소비 우선순위: effective style → spec/container fallback → 기본값.
 */
function resolveParentContainerStyle(
  parentId: string | null,
  property: "display" | "flexDirection",
  fallback: string,
  parent: {
    type?: string;
    style?: Record<string, unknown>;
  },
): string {
  if (!parentId) return fallback;
  const inline = parent.style?.[property];
  if (typeof inline === "string" && inline) return inline;
  const type = parent.type;
  if (type) {
    // ADR-912 단계5 step4: spec.containerStyles → builder catalog-aware fallback.
    //   spec 존재 시 spec.containerStyles, catalog cutover spec 삭제 시 rule.containerStyles 합성.
    const fb = resolveContainerStylesFallback(type.toLowerCase(), {});
    const specValue = fb[property];
    if (typeof specValue === "string") return specValue;
  }
  return fallback;
}

export function useParentDisplay(id: string | null): string {
  const parentId = useParentId(id);
  const parent = useElementStyleContext(parentId);
  return resolveParentContainerStyle(parentId, "display", "block", parent);
}

export function useParentFlexDirection(id: string | null): string {
  const parentId = useParentId(id);
  const parent = useElementStyleContext(parentId);
  return resolveParentContainerStyle(parentId, "flexDirection", "row", parent);
}

function useSizeMode(id: string | null, axis: "width" | "height"): SizeMode {
  const { style, type, size } = useElementStyleContext(id);
  const parentDisplay = useParentDisplay(id);
  const parentFlexDirection = useParentFlexDirection(id);
  const specPreset = useMemo(() => resolveSpecPreset(type, size), [type, size]);
  return useMemo(() => {
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
  }, [style, axis, parentDisplay, parentFlexDirection, specPreset]);
}

export function useWidthSizeMode(id: string | null): SizeMode {
  return useSizeMode(id, "width");
}

export function useHeightSizeMode(id: string | null): SizeMode {
  return useSizeMode(id, "height");
}
