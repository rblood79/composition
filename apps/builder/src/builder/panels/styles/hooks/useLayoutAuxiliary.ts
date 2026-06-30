import { useMemo } from "react";
import { resolveLayoutSpecPreset } from "../utils/specPresetResolver";
import { firstDefined } from "../utils/styleValueHelpers";
import { useElementStyleContext } from "./useElementStyleContext";
import { resolveDrivenFlexDirection } from "../utils/orientationDrivenTags";

interface ResolvedLayoutFields {
  display: string;
  flexDirection: string;
  alignItems: string;
  justifyContent: string;
  flexWrap: string;
}

function asString(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return String(value);
}

function useResolvedLayoutFields(id: string | null): ResolvedLayoutFields {
  const { style, type, size, props } = useElementStyleContext(id);

  const specPreset = useMemo(
    () => resolveLayoutSpecPreset(type, size, props),
    [type, size, props],
  );

  return useMemo(() => {
    const s = style ?? {};

    // 그룹 축 prop derive 컨테이너(ToggleButtonGroup/Toolbar=orientation,
    // RadioGroup/CheckboxGroup=labelPosition)는 그룹 root flexDirection SSOT 가
    // 별도 prop 이라, 패널 Direction 표시도 그 prop 을 inline style.flexDirection
    // 보다 우선해야 SSOT 와 일치(stale inline 잔재로 토글이 어긋나는 것 방지).
    const drivenFlexDirection = resolveDrivenFlexDirection(type, props);

    return {
      display: firstDefined(s.display, asString(specPreset.display), "block"),
      flexDirection:
        drivenFlexDirection ??
        firstDefined(
          s.flexDirection,
          asString(specPreset.flexDirection),
          "row",
        ),
      alignItems: firstDefined(
        s.alignItems,
        asString(specPreset.alignItems),
        "",
      ),
      justifyContent: firstDefined(
        s.justifyContent,
        asString(specPreset.justifyContent),
        "",
      ),
      flexWrap: firstDefined(
        s.flexWrap,
        asString(specPreset.flexWrap),
        "nowrap",
      ),
    };
  }, [style, specPreset, type, props]);
}

/**
 * Flex Direction 토글 키 — display=flex 이면 column|row, 아니면 block
 */
export function useFlexDirectionKeys(id: string | null): string[] {
  const { display, flexDirection } = useResolvedLayoutFields(id);
  return useMemo(() => {
    if (display !== "flex") return ["block"];
    if (flexDirection === "column") return ["column"];
    return ["row"];
  }, [display, flexDirection]);
}

const V_MAP: Record<string, string> = {
  "flex-start": "Top",
  start: "Top",
  center: "Center",
  "flex-end": "Bottom",
  end: "Bottom",
};
const H_MAP: Record<string, string> = {
  "flex-start": "left",
  start: "left",
  center: "center",
  "flex-end": "right",
  end: "right",
};

/**
 * Flex Alignment 9-grid 토글 키
 */
export function useFlexAlignmentKeys(id: string | null): string[] {
  const { display, flexDirection, alignItems, justifyContent } =
    useResolvedLayoutFields(id);
  return useMemo(() => {
    if (display !== "flex") return [];
    let vertical: string;
    let horizontal: string;
    if (flexDirection === "column") {
      vertical = V_MAP[justifyContent] ?? "";
      horizontal = H_MAP[alignItems] ?? "";
    } else {
      vertical = V_MAP[alignItems] ?? "";
      horizontal = H_MAP[justifyContent] ?? "";
    }
    if (!vertical && !horizontal) return [];
    return [`${horizontal}${vertical}`];
  }, [display, flexDirection, alignItems, justifyContent]);
}

const SPACING_VALUES = new Set([
  "space-around",
  "space-between",
  "space-evenly",
]);

/**
 * Justify Content Spacing 토글 키
 */
export function useJustifyContentSpacingKeys(id: string | null): string[] {
  const { justifyContent } = useResolvedLayoutFields(id);
  return useMemo(() => {
    if (SPACING_VALUES.has(justifyContent)) return [justifyContent];
    return [];
  }, [justifyContent]);
}

/**
 * Flex Wrap 토글 키
 */
export function useFlexWrapKeys(id: string | null): string[] {
  const { flexWrap } = useResolvedLayoutFields(id);
  return useMemo(() => [flexWrap || "nowrap"], [flexWrap]);
}
