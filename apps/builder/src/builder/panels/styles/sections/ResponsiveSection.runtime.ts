/**
 * ResponsiveSection — breakpoint override 관리 허브 (ADR-154 개정 1)
 *
 * 개정 모델: 편집은 어느 breakpoint 에서든 기본 base(전역)다. breakpoint 전용 override 는
 * **이 섹션에서 명시적으로 opt-in** 한다 — eligible(Layout·Transform) 속성을 헤더 「+」 메뉴로
 * 추가하면 현재 값이 해당 tier override 로 복사되고, 이후 그 속성 편집이 override 로
 * 라우팅된다(store `setResponsiveStyleOverrideEnabled` + `shouldWriteBreakpointOverride`).
 *
 * 배경·border·radius·typography 등 non-eligible 속성은 항상 전역이라 여기 노출되지 않는다.
 * desktop = base 이므로 override 관리는 tablet/mobile 에서만. override 존재 판정은 raw
 * `element.responsive`(useResponsiveOverrides) — 병합 map 재판정 금지.
 *
 * 시각 어법 (panel-ui 04, 2026-09-14):
 * - Responsive 절: Visibility 는 「🖥 📱 📱」 다중 선택 seg 한 줄 (desktop 은 base 라 잠김 —
 *   base `display` 를 그대로 비춘다). 종전 카드 3장 (각 60) + Show All / Hide All 버튼 + 도움말
 *   (구 ResponsiveVisibilityEditor, 삭제) 은 5탭 중 가장 긴 탭 (794) 의 원인이었다.
 * - Overrides 절 (tablet/mobile 만): 헤더 「tablet · 2」 카운트 + 「+」 메뉴 (추가할 속성 고르기),
 *   행은 다른 절과 같은 lrow 「width · 100%」 + 28 열 × (override 해제). 종전 chip + select.
 *
 * UI 편차 주기(2026-07-23): 브레인스토밍 스케치는 per-property 토글 dot 이었으나, Layout/
 * Transform 섹션 입력이 이질적(fieldset/grid/unit-input 혼재)이라 per-row dot 은 침습적이고
 * 일관성이 낮다. override 를 이 단일 섹션에 집약하는 편이 명료·유지보수 유리.
 */

import { type BreakpointName } from "@composition/shared";

import { Monitor, Smartphone, Tablet } from "lucide-react";

import { ACTION_ICONS } from "../../../config/actionIcons";

export const BP_LABEL: Record<BreakpointName, string> = {
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
};

export const BP_ICON: Record<BreakpointName, typeof Monitor> = {
  desktop: Monitor,
  tablet: Tablet,
  mobile: Smartphone,
};

export const AddIcon = ACTION_ICONS.add;

/**
 * "Add override" 메뉴가 제공하는 주요 eligible 속성 (shorthand 형태 + 대표 transform).
 * `longhands` 는 override 존재/제거 판정용 — shorthand 는 store longhand 로 분배 저장되므로
 * (ADR-909) longhand 중 하나라도 있으면 active. eligibility SSOT 는
 * `RESPONSIVE_ELIGIBLE_STYLE_PROPS`(shared) — 이 목록은 그 부분집합(대표 UI 노출).
 */
export const PRIMARY_ELIGIBLE: {
  key: string;
  label: string;
  longhands: string[];
}[] = [
  { key: "width", label: "Width", longhands: ["width"] },
  { key: "height", label: "Height", longhands: ["height"] },
  { key: "minWidth", label: "Min Width", longhands: ["minWidth"] },
  { key: "maxWidth", label: "Max Width", longhands: ["maxWidth"] },
  { key: "minHeight", label: "Min Height", longhands: ["minHeight"] },
  { key: "maxHeight", label: "Max Height", longhands: ["maxHeight"] },
  { key: "display", label: "Display", longhands: ["display"] },
  { key: "flexDirection", label: "Direction", longhands: ["flexDirection"] },
  { key: "justifyContent", label: "Justify", longhands: ["justifyContent"] },
  { key: "alignItems", label: "Align", longhands: ["alignItems"] },
  { key: "gap", label: "Gap", longhands: ["rowGap", "columnGap"] },
  {
    key: "padding",
    label: "Padding",
    longhands: ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"],
  },
  {
    key: "margin",
    label: "Margin",
    longhands: ["marginTop", "marginRight", "marginBottom", "marginLeft"],
  },
];

/**
 * 「+」 메뉴가 추가할 수 있는 override 키 — 이미 켠 속성은 빼고, 라벨 위치 · orientation 으로 방향이
 * 정해지는 요소 (orientationDrivenTags) 는 Direction 도 뺀다. 그 요소의 방향 정본은 tier 축이 없는 prop
 * 이라, tier flexDirection 은 켜는 순간 seed 기본값 (row) 으로 라벨을 옆으로 옮기고 이후 Direction 토글
 * (전역 prop) 이 그 tier 에 닿지 않았다. 이미 있는 tier 값은 아래 행에서 지울 수 있다.
 */
export function addableOverrideKeys(
  overridden: ReadonlySet<string>,
  directionDriven: boolean,
): string[] {
  return PRIMARY_ELIGIBLE.filter(
    (p) =>
      !(directionDriven && p.key === "flexDirection") &&
      !p.longhands.some((lh) => overridden.has(lh)),
  ).map((p) => p.key);
}

export const PRIMARY_COVERED_KEYS = new Set(
  PRIMARY_ELIGIBLE.flatMap((p) => p.longhands),
);

/**
 * 행에 보일 override 값 — longhand 값이 전부 같으면 하나, 다르면 순서대로 공백 join
 * (padding 「8px 16px 8px 16px」). 값이 없는 longhand 는 건너뛴다.
 */
export function describeOverrideValue(
  values: Record<string, unknown>,
  longhands: readonly string[],
): string {
  const present = longhands
    .map((lh) => values[lh])
    .filter((v) => v !== undefined && v !== null)
    .map((v) => String(v));
  if (present.length === 0) return "";
  return new Set(present).size === 1 ? present[0]! : present.join(" ");
}

export interface OverrideRow {
  readonly key: string;
  readonly label: string;
  readonly name: string;
  readonly value: string;
}
