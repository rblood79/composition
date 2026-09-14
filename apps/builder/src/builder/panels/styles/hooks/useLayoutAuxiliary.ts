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
 * ADR-923 Phase 4 (G4 전반, reviews/923 r2 l3) — Direction · Alignment 의 flex 판정은
 * outer 와 무관하게 **inner formatting context 가 flex 인가** 다: `flex` 와 `inline-flex` 는
 * 같은 flex 컨테이너다 (CSS Display 3 — outer 만 다르다). 종전 `display === "flex"` 는
 * 사용자가 지정한 `inline-flex` 요소를 block 으로 표시해 Direction/Alignment 토글이 죽었다
 * (2026-06-27 회귀와 같은 표면). catalog 가 아직 `flex` 라 Button 표시는 무변경.
 */
function isFlexDisplay(display: string): boolean {
  const d = display.trim().toLowerCase();
  return d === "flex" || d === "inline-flex";
}

/**
 * Flex Direction 토글 키 — display 가 flex | inline-flex 이면 column|row, 아니면 block
 */
export function useFlexDirectionKeys(id: string | null): string[] {
  const { display, flexDirection } = useResolvedLayoutFields(id);
  return useMemo(() => {
    if (!isFlexDisplay(display)) return ["block"];
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
const SPACING_VALUES = new Set([
  "space-around",
  "space-between",
  "space-evenly",
]);

/**
 * Space (between/around/evenly) 가 켜져 주축이 분산된 상태면 그 축 — 3×3 그리드가 점 → 막대로
 * 바뀌고 교차축만 고른다 (panel-ui 01, 2026-09-14). 아니면 null.
 */
export function useFlexDistributionAxis(
  id: string | null,
): "row" | "column" | null {
  const { display, flexDirection, justifyContent } =
    useResolvedLayoutFields(id);
  return useMemo(() => {
    if (!isFlexDisplay(display) || !SPACING_VALUES.has(justifyContent)) {
      return null;
    }
    return flexDirection === "column" ? "column" : "row";
  }, [display, flexDirection, justifyContent]);
}

export function useFlexAlignmentKeys(id: string | null): string[] {
  const { display, flexDirection, alignItems, justifyContent } =
    useResolvedLayoutFields(id);
  return useMemo(() => {
    if (!isFlexDisplay(display)) return [];
    // 주축이 분산 (space-*) 이면 주축 위치는 "center" 로 두고 교차축만 키에 싣는다 —
    //   그리드가 막대 모드라 주축 칸은 의미가 없다.
    const distributed = SPACING_VALUES.has(justifyContent);
    let vertical: string;
    let horizontal: string;
    if (flexDirection === "column") {
      vertical = distributed ? "Center" : (V_MAP[justifyContent] ?? "");
      horizontal = H_MAP[alignItems] ?? "";
    } else {
      vertical = V_MAP[alignItems] ?? "";
      horizontal = distributed ? "center" : (H_MAP[justifyContent] ?? "");
    }
    if (!vertical && !horizontal) return [];
    return [`${horizontal}${vertical}`];
  }, [display, flexDirection, alignItems, justifyContent]);
}

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
