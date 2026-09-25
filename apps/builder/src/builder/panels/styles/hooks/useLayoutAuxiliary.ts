import { useMemo } from "react";
import { resolveLayoutSpecPreset } from "../utils/specPresetResolver";
import { firstDefined } from "../utils/styleValueHelpers";
import { useElementStyleContext } from "./useElementStyleContext";
import {
  resolveDirectionDrivenProp,
  resolveDrivenFlexDirection,
} from "../utils/orientationDrivenTags";

interface ResolvedLayoutFields {
  display: string;
  /** Direction 이 그룹 축 prop (orientation · labelPosition) 을 따르는가. */
  directionDriven: boolean;
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
    //   표시 축은 **렌더가 실제로 따르는 축** 이다 — prop 에서 옮긴 고정 규칙 (top=column · side=row)
    //   은 catalog 가 방향을 정하지 않을 때 (grid 인 ProgressBar · Meter · Slider 의 top) 만 쓴다.
    //   · catalog base + 변형의 flex 방향이 먼저 — ColorField 는 base 가 row 라 top 도 row 로 그린다.
    //   · 라벨 위치 컨테이너는 인라인 방향이 더 먼저 — DOM (root 인라인 > `[data-label-position]`) ·
    //     Canvas (implicitStyles 가 인라인을 마지막에 얹는다) 둘 다 인라인을 따른다. 인라인은 스타일
    //     붙여넣기로 지금도 들어온다. orientation 컨테이너는 Canvas 가 prop 으로 덮어 인라인을 보지 않는다.
    //   Alignment 도 같은 축으로 매핑한다 — 다르면 정렬 점이 가로 · 세로가 뒤바뀐 칸에 쓰였다.
    const drivenProp = resolveDirectionDrivenProp(type);
    const premiseFlexDirection = resolveDrivenFlexDirection(type, props);
    const resolvedDisplay = firstDefined(
      s.display,
      asString(specPreset.display),
      "block",
    );
    const renderedFlexDirection = isFlexDisplay(resolvedDisplay)
      ? toFlexAxis(
          (drivenProp === "labelPosition" ? asString(s.flexDirection) : undefined) ??
            asString(specPreset.flexDirection),
        )
      : undefined;
    const drivenFlexDirection =
      premiseFlexDirection === undefined
        ? undefined
        : (renderedFlexDirection ?? premiseFlexDirection);

    return {
      display: resolvedDisplay,
      directionDriven: drivenFlexDirection !== undefined,
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
/** `row` · `row-reverse` → row, `column*` → column, 그 외 undefined. */
function toFlexAxis(value: string | undefined): "row" | "column" | undefined {
  if (!value) return undefined;
  if (value.startsWith("column")) return "column";
  if (value.startsWith("row")) return "row";
  return undefined;
}

function isFlexDisplay(display: string): boolean {
  const d = display.trim().toLowerCase();
  return d === "flex" || d === "inline-flex";
}

/**
 * Flex Direction 토글 키 — display 가 flex | inline-flex 이면 column|row, 아니면 block
 */
export function useFlexDirectionKeys(id: string | null): string[] {
  const { display, flexDirection, directionDriven } =
    useResolvedLayoutFields(id);
  return useMemo(() => {
    // 그룹 축 prop 컨테이너는 display 와 무관하게 그 prop 을 보인다 — ProgressBar · Meter · Slider 의
    //   top 은 grid 라, display 로 판정하면 disable 된 block 이 선택돼 보였다.
    if (directionDriven) return [flexDirection === "column" ? "column" : "row"];
    if (!isFlexDisplay(display)) return ["block"];
    if (flexDirection === "column") return ["column"];
    return ["row"];
  }, [display, flexDirection, directionDriven]);
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
function isGridDisplay(display: unknown): boolean {
  if (typeof display !== "string") return false;
  const d = display.trim().toLowerCase();
  return d === "grid" || d === "inline-grid";
}

/**
 * Alignment · Space · Wrap 비활성 — grid 컨테이너. 세 핸들러는 flex 속성과 `display: flex` 를 쓰므로
 * grid 에서 누르면 grid 가 조용히 flex 가 된다 (ProgressBar · Meter · Slider 는 막대가 폭 0 으로
 * 사라졌다). 판정: 해석된 display 가 grid 이거나, catalog 기본이 grid (side variant 로 flex 가 된
 * 상태도 — 그 방향은 labelPosition 이 정한다). 모드 전환은 Direction 이 맡는다.
 */
export function useLayoutAlignmentDisabled(id: string | null): boolean {
  const { style, type, size, props } = useElementStyleContext(id);
  return useMemo(() => {
    const inlineDisplay = style?.display;
    if (inlineDisplay !== undefined && inlineDisplay !== "") {
      return isGridDisplay(inlineDisplay);
    }
    if (isGridDisplay(resolveLayoutSpecPreset(type, size).display)) {
      return true;
    }
    return isGridDisplay(resolveLayoutSpecPreset(type, size, props).display);
  }, [style, type, size, props]);
}

export function useFlexWrapKeys(id: string | null): string[] {
  const { flexWrap } = useResolvedLayoutFields(id);
  return useMemo(() => [flexWrap || "nowrap"], [flexWrap]);
}
