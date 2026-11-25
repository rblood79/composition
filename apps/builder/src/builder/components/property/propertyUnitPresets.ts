/**
 * PropertyUnitInput preset contract and shared preset scales.
 *
 * Settings와 Styles 패널이 서로의 도메인 상수를 참조하지 않고 같은 입력
 * 계약을 사용하도록 property component 계층에서 소유한다.
 *
 * ADR-298 D3 — 토큰 preset 은 라벨 → 토큰 표 하나에서 파생한다. 값은 토큰의 CSS 변수
 * (`tokenToCSSVar`) 이고 숫자를 적지 않는다 — 표시값은 활성 테마 snapshot 이 준다
 * (`getPresetDisplayValue`), commit 은 토큰 참조 (`getPresetCommitValue` → `TokenUse`).
 */
import { tokenToCSSVar } from "@composition/rendering";
import { catalogHeadingFontScale } from "../../../../../../packages/shared/src/catalog/runtime/headingFont";
import type { TokenRef } from "@composition/rendering";

export interface PropertyUnitPreset {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  /** 메뉴 묶음 이름 (Font Size 의 본문 · 제목) — 같은 값이 이어지는 항목끼리 한 묶음. */
  readonly group?: string;
  /**
   * 고르면 `value` 를 쓰는 대신 이것을 실행한다 — `value` 는 메뉴 표시 (「h2 · 24」) 용. Font Size 의 h 단계는
   * 글자 크기가 아니라 제목 요소를 바꾼다 (2026-11-25 — `headingTagFontSizePresets`).
   */
  readonly onSelect?: () => void;
}

const RESET_PRESET: PropertyUnitPreset = {
  id: "reset",
  label: "Reset",
  value: "",
};

/** 패널 크기 단계 라벨 (memory `feedback-panel-scale-labels` — 토큰 원이름은 내부용). */
const SCALE_STEPS = [
  ["xs", "XS"],
  ["sm", "S"],
  ["md", "M"],
  ["lg", "L"],
  ["xl", "XL"],
] as const;

const tokenPreset = (
  id: string,
  label: string,
  ref: string,
  group?: string,
): PropertyUnitPreset => ({
  id,
  label,
  value: tokenToCSSVar(ref as TokenRef),
  ...(group ? { group } : {}),
});

const scale = (
  category: string,
  steps: readonly (readonly [string, string])[] = SCALE_STEPS,
) =>
  steps.map(([step, label]) =>
    tokenPreset(step, label, `{${category}.${step}}`),
  );

export const SPACING_PRESET_OPTIONS: readonly PropertyUnitPreset[] = [
  RESET_PRESET,
  ...scale("spacing"),
];

/** Border Width — 토큰 이름 그대로 (none · thin · thick, 사용자 결정 3 · ADR-298). 숫자는 직접 입력. */
export const BORDER_WIDTH_PRESET_OPTIONS: readonly PropertyUnitPreset[] = [
  RESET_PRESET,
  ...(["none", "thin", "thick"] as const).map((step) =>
    tokenPreset(step, step, `{border.width.${step}}`),
  ),
];

export const BORDER_RADIUS_PRESET_OPTIONS: readonly PropertyUnitPreset[] = [
  RESET_PRESET,
  tokenPreset("none", "None", "{radius.none}"),
  ...scale("radius"),
  tokenPreset("full", "Full", "{radius.full}"),
];

/** Font Size — 본문 XS ~ XL (`text-xs … xl`, M = text-base). */
export const FONT_SIZE_PRESET_OPTIONS: readonly PropertyUnitPreset[] = [
  RESET_PRESET,
  ...SCALE_STEPS.map(([step, label]) =>
    tokenPreset(
      `text-${step}`,
      label,
      `{typography.text-${step === "md" ? "base" : step}}`,
      "Body",
    ),
  ),
];

/**
 * 제목 요소 (Heading · HTML tag `h1`~`h6` 인 Text) 의 Font Size 「Heading」 묶음 = h1 ~ h6 (사용자 결정
 * 2026-11-25 「1번으로 진행」). 제목 크기는 태그가 정한다 — 부모 글자 × h 배율 (`headingFont.ts`) — 그래서
 * 항목은 그 크기를 보이고, 고르면 태그를 바꾼다 (`pick` — 직접 쓴 글자 크기는 같은 편집에서 지운다). 「Reset」
 * 은 지금 태그의 크기로 돌아간다. 옛 S2 제목 토큰 (`text-heading-*`) 단계는 태그와 따로 놀아 메뉴에서 뺐다 —
 * 이미 저장된 토큰은 그대로 그려진다.
 */
export function headingTagFontSizePresets(
  parentFontSize: number,
  pick: (level: number) => void,
): readonly PropertyUnitPreset[] {
  return [1, 2, 3, 4, 5, 6].map((level) => ({
    id: `h${level}`,
    label: `h${level}`,
    value: `${Math.round(parentFontSize * catalogHeadingFontScale(level) * 100) / 100}px`,
    group: "Heading",
    onSelect: () => pick(level),
  }));
}

/** Shadow — S · M · L (`{shadow.sm|md|lg}`, ADR-298 D7). EffectSection 의 preset 메뉴가 읽는다. */
export const SHADOW_PRESET_OPTIONS: readonly PropertyUnitPreset[] = scale(
  "shadow",
  SCALE_STEPS.slice(1, 4),
);
