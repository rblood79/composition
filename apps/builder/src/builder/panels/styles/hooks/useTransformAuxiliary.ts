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

function useParentId(id: string | null): string | null {
  const element = useCanonicalPropertyElement(id ?? "");
  return element?.parent_id ?? null;
}

/**
 * ADR-082 A1: 부모 Spec containerStyles.{display|flexDirection} fallback.
 *
 * inline 값이 없으면 부모의 type 기반 Spec containerStyles 에서 조회.
 * SelfAlignment 9-grid 가 부모 Spec 기본값(예: ListBoxSpec.display="flex")에서도
 * 활성화되도록 함. 소비 우선순위: `props.style` → `spec.containerStyles` → 기본값.
 */
function resolveParentContainerStyle(
  parentId: string | null,
  property: "display" | "flexDirection",
  fallback: string,
  parent: { type?: string; props?: { style?: Record<string, unknown> } } | null,
): string {
  if (!parentId) return fallback;
  const style = parent?.props?.style as Record<string, unknown> | undefined;
  const inline = style?.[property];
  if (typeof inline === "string" && inline) return inline;
  const type = parent?.type;
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
  const parent = useCanonicalPropertyElement(parentId ?? "") ?? null;
  return resolveParentContainerStyle(parentId, "display", "block", parent);
}

export function useParentFlexDirection(id: string | null): string {
  const parentId = useParentId(id);
  const parent = useCanonicalPropertyElement(parentId ?? "") ?? null;
  return resolveParentContainerStyle(parentId, "flexDirection", "row", parent);
}

function useSizeMode(id: string | null, axis: "width" | "height"): SizeMode {
  const element = useCanonicalPropertyElement(id ?? "");
  const style =
    (element?.props?.style as Record<string, unknown> | null) ?? null;
  const parentDisplay = useParentDisplay(id);
  const parentFlexDirection = useParentFlexDirection(id);
  return useMemo(
    () =>
      style
        ? inferSizeMode(style, axis, parentDisplay, parentFlexDirection)
        : "fit",
    [style, axis, parentDisplay, parentFlexDirection],
  );
}

export function useWidthSizeMode(id: string | null): SizeMode {
  return useSizeMode(id, "width");
}

export function useHeightSizeMode(id: string | null): SizeMode {
  return useSizeMode(id, "height");
}

const V_MAP: Record<string, string> = {
  "flex-start": "Top",
  start: "Top",
  center: "Center",
  "flex-end": "Bottom",
  end: "Bottom",
  stretch: "",
};
const H_MAP: Record<string, string> = {
  "flex-start": "left",
  start: "left",
  center: "center",
  "flex-end": "right",
  end: "right",
  stretch: "",
};

export function useSelfAlignmentKeys(id: string | null): string[] {
  const parentDisplay = useParentDisplay(id);
  const element = useCanonicalPropertyElement(id ?? "");
  const style = element?.props?.style as Record<string, unknown> | undefined;
  const alignSelf = String(style?.alignSelf ?? "");
  const justifySelf = String(style?.justifySelf ?? "");
  return useMemo(() => {
    const isFlexOrGrid =
      parentDisplay === "flex" ||
      parentDisplay === "inline-flex" ||
      parentDisplay === "grid" ||
      parentDisplay === "inline-grid";
    if (!isFlexOrGrid) return [];
    const v = V_MAP[alignSelf] ?? "";
    const h = H_MAP[justifySelf] ?? "";
    if (!v && !h) return [];
    return [`${h}${v}`];
  }, [parentDisplay, alignSelf, justifySelf]);
}
