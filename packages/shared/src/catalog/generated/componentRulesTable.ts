import {
  AVATAR_SIZE_PRESETS,
  AVATAR_GROUP_SIZES,
} from "../document/avatarSizeValue";
import {
  SEGMENTED_GROUP_CONTAINER,
  SEGMENTED_ITEM_CONTAINER,
  SEGMENTED_INDICATOR_MOTION,
  SEGMENTED_INDICATOR_BORDER,
} from "../rule/segmentedControl";
import {
  ACTION_BAR_RULE,
  SELECT_BOX_GROUP_RULE,
  SELECT_BOX_RULE,
} from "../rule/selectionComposites";
/**
 * SSOT (직접 편집 정본) — theme rule base D3 시각 SSOT (ADR-912 ②-6-A).
 *
 * **위상 전환 (ADR-912 1A-(a), 2026-06-03)**: 본 테이블은 더 이상 build-time 자동 생성물이 아니다.
 * `generate-rules.ts`(spec→table) 가 1회 생성한 결과를 **freeze 하여 직접 편집 정본으로 승격**했다
 * (build chain `pnpm generate:rules` step 제거됨 — `packages/specs/package.json`). 이후 컴포넌트 시각
 * 규칙(variants/sizes/fill) 변경은 **본 파일을 직접 편집**한다. 생성기 `generate-rules.ts` +
 * `generate:rules` script 는 ADR-912 단계 5 step 3 에서 물리 삭제됨(본 테이블이 독립 정본). 입력이던
 * 124 spec 은 단계 5 step 4 에서 삭제 예정.
 *
 * **소비자**: DOM(generated CSS — `generate-css` 가 본 테이블의 variant 색상 주입) / Skia(runtime
 * `resolveComponentRule`) / Properties·Style Panel — 모두 본 테이블 단일 source 파생(DOM/Skia 시각 대칭).
 * TokenRef(`{color.X}`)는 string 그대로 — runtime resolveCanonicalToken/resolveToken 이 변환.
 */
import type { ComponentRulesTable } from "../../types/catalog-style.types";
import type { PaintImage } from "../rule/rulePaintTree";
import {
  PICKER_BACKGROUND,
  PICKER_CONTENT,
  PICKER_INVALID_WIDTH,
} from "../document/pickerTrigger";
import { SHEET_HANDLE_SELECTORS } from "../document/sheetChrome";
import {
  CATALOG_PRESS_TRANSITION,
  CATALOG_PRESS_WILL_CHANGE,
  catalogPressTransform,
} from "../rule/pressScale";
import {
  centerPadding,
  defineRuleLengthForms,
  em,
  ofHeight,
  resolveToken,
  scaled,
  scaledLengthRef,
  tokenToCSSVar,
} from "@composition/rendering";

// S2 Menu/Picker: hover로 이동한 focus와 키보드 focus의 공통 배경.
const COLLECTION_ITEM_BACKGROUND = {
  default: "{color.transparent}",
  isFocused: "{color.collection-item-focus}",
  isDisabled: "{color.transparent}",
} as const;

/**
 * ADR-259 Phase 2 — S2 `prefix` (TextField · TextArea · NumberField · ComboBox · ColorField): the
 * Text · Icon node in the field's control Group's `prefix` slot. S2 `FieldGroup` (`Field.tsx:291-311`):
 * `gray-600` (field-placeholder), no shrink, `text-to-visual` before the input (6/14 of the
 * text — 4 · 5 · 6 · 7 · 8 px at XS … XL), the input's text size. One block per field rule — the
 * generated sheet and the Canvas part rules (through the Group) read it.
 */
const PREFIX =
  ':is(.react-aria-Text[slot="prefix"], .react-aria-Icon[slot="prefix"])';
const PREFIX_TEXT = '.react-aria-Text[slot="prefix"]';
const FIELD_PREFIX_STATIC = {
  [PREFIX]: {
    color: "var(--field-placeholder)",
    "flex-shrink": "0",
  },
  [PREFIX_TEXT]: { width: "auto" },
} as const;
const prefixSize = (text: string, gap: number) => ({
  [PREFIX]: { "margin-inline-end": `${gap}px` },
  [PREFIX_TEXT]: {
    "font-size": `var(--${text})`,
    "line-height": `var(--${text}--line-height)`,
  },
});
const FIELD_PREFIX_SIZES = {
  XS: prefixSize("text-2xs", 4),
  S: prefixSize("text-xs", 5),
  M: prefixSize("text-sm", 6),
  L: prefixSize("text-base", 7),
  XL: prefixSize("text-lg", 8),
} as const;

// S2 Button shape (2026-10-28 — 사용자 「Button 모서리를 S2 처럼 완전히 둥글게」): S2 `Button` is
// `control({shape: 'pill'})` at every size (Button.tsx); the button sizes' `borderRadius` is
// `{radius.full}`. A field's own button (Picker trigger · NumberField steppers · ComboBox · date
// picker · SearchField button — S2 field buttons, not `Button`s) keeps the corner of its own size:
// one table read by the Canvas (`containerVariants["field-button"]` — the derived `fieldButton`,
// `presence.ts` `catalogFieldButtonSize`) and the DOM (`rootSelectors` — `data-field-button`).
// (2026-10-30 — 사용자 「field 입력폼 부분 S:7, M:8, L:9, XL:10」: the field input box's corner
// (`Input` · `DateInput` · field `sizes`), so a Select trigger · NumberField stepper meets its box.)
// (ADR-295 후속 — S2 field buttons draw no border: Picker `inputButton` · NumberField · ComboBox ·
// DatePicker buttons are `borderStyle: 'none'`. The Canvas read the Button rule's 1px while the DOM
// dropped it by accident — `domBinding` wrapped every field button and its `stepper !== node`
// identity test zeroed the inline border; now both read this block.)
const FIELD_BUTTON_CORNERS = {
  XS: "var(--radius-sm)",
  S: "7px",
  M: "8px",
  L: "9px",
  XL: "10px",
} as const;
const FIELD_BUTTON_CORNER_VARIANTS = Object.fromEntries(
  Object.entries(FIELD_BUTTON_CORNERS).map(([size, corner]) => [
    size,
    { styles: { "border-radius": corner, "border-width": "0" } },
  ]),
);
/** ADR-297 Phase 3c — the field-button corners as the Button's state tree (value condition `fieldButton` —
 *  the DOM's `data-field-button`; the Canvas reads `containerVariants["field-button"]` of the same table). */
const FIELD_BUTTON_CORNER_STATE = {
  borderRadius: { fieldButton: { ...FIELD_BUTTON_CORNERS } },
  borderWidth: {
    fieldButton: Object.fromEntries(
      Object.keys(FIELD_BUTTON_CORNERS).map((size) => [size, "0"]),
    ),
  },
} as const;

// Button and ToggleButton have one root box for CSS generation and Canvas typed definitions.
// Keeping separate copies dropped fit-content in Canvas when the parent became a flex column.
// ADR-295 Phase 3c-2b — toggle 표시 상자 = S2. Checkbox 상자 · Radio 고리 · Switch track 의 높이는 S2
//   `controlSize('sm')` (`{size.height-sm.<S>}` — 터치 × 1.25), Checkbox 모서리는 `controlBorderRadius('sm')`
//   (기기 배율 없음), Radio 의 선택 고리 = (높이 − 4) / 2 (가운데 흰 점 4 — S2 `(4 / 16) * 1rem`), Switch track
//   폭은 `fontRelative(26)` (그 size 의 글자 × 26 / 14), thumb 은 track 높이 − 8 (안쪽 4) · 선택이면 − 6
//   (안쪽 3 — S2 perspective 식의 결과). Canvas 는 `size.indicator` 를 `catalogToggleIndicatorMetrics` 로
//   풀어 읽고, DOM 은 아래 선택자 (생성 시트) 가 같은 값을 읽는다 — 수동 `Checkbox.css` · `Radio.css` ·
//   `Switch.css` 의 size 블록은 빌더 chrome (생성 toggle 시트를 싣지 않는다) 의 것으로 남는다. 선택자는
//   RAC 버튼 (`*Button`) 을 넣어 수동 시트의 그룹 위임 (`[data-radio-size]` …) 보다 specificity 가 같거나 높다.
const TOGGLE_SIZES = ["S", "M", "L", "XL"] as const;
type ToggleSize = (typeof TOGGLE_SIZES)[number];
const toggleBox = (size: ToggleSize) =>
  `var(--catalog-token-size-height-sm-${size})`;
const CHECKBOX_RADIUS: Record<ToggleSize, number> = { S: 4, M: 4, L: 5, XL: 5 };
const RADIO_DOT = 4;
const SWITCH_FONT: Record<ToggleSize, string> = {
  S: "text-xs",
  M: "text-sm",
  L: "text-base",
  XL: "text-lg",
};
const SWITCH_TRACK_EM = 26 / 14;
const SWITCH_THUMB_INSET = 4;
const SWITCH_THUMB_INSET_SELECTED = 3;
const togglePerSize = (
  make: (size: ToggleSize) => Record<string, Record<string, string>>,
): Record<string, { styles: Record<string, string> }> =>
  Object.fromEntries(
    TOGGLE_SIZES.flatMap((size) =>
      Object.entries(make(size)).map(([selector, styles]) => [
        selector,
        { styles },
      ]),
    ),
  );
const CHECKBOX_INDICATOR_SELECTORS = togglePerSize(
  (size): Record<string, Record<string, string>> => ({
    [`&[data-size="${size}"] .react-aria-CheckboxButton .checkbox`]: {
      width: toggleBox(size),
      height: toggleBox(size),
      "border-radius": `${CHECKBOX_RADIUS[size]}px`,
    },
    [`&[data-size="${size}"] .react-aria-CheckboxButton .checkbox svg`]: {
      width: toggleBox(size),
      height: toggleBox(size),
    },
  }),
);
const RADIO_INDICATOR_SELECTORS = togglePerSize(
  (size): Record<string, Record<string, string>> => ({
    [`&[data-size="${size}"] .react-aria-RadioButton .indicator`]: {
      width: toggleBox(size),
      height: toggleBox(size),
      "border-radius": "9999px",
    },
    [`&[data-size="${size}"][data-selected] .react-aria-RadioButton .indicator`]:
      {
        "border-width": `calc((${toggleBox(size)} - ${RADIO_DOT}px) / 2)`,
      },
  }),
);
const switchTrackWidth = (size: ToggleSize) =>
  `calc(var(--catalog-token-${SWITCH_FONT[size]}) * 26 / 14)`;
const SWITCH_INDICATOR_SELECTORS = togglePerSize(
  (size): Record<string, Record<string, string>> => ({
    [`&[data-size="${size}"] .react-aria-SwitchButton .indicator`]: {
      width: switchTrackWidth(size),
      height: toggleBox(size),
      "border-radius": "9999px",
    },
    // (The track's border is 2 — the thumb's start margin is its inset less the border.)
    [`&[data-size="${size}"] .react-aria-SwitchButton .indicator::before`]: {
      width: `calc(${toggleBox(size)} - ${SWITCH_THUMB_INSET * 2}px)`,
      height: `calc(${toggleBox(size)} - ${SWITCH_THUMB_INSET * 2}px)`,
      "border-radius": "9999px",
      margin: `0 ${SWITCH_THUMB_INSET - 2}px`,
    },
    // Selected: the thumb grows to height − 6 and its end sits 3 from the track's end.
    [`&[data-size="${size}"][data-selected] .react-aria-SwitchButton .indicator::before`]:
      {
        width: `calc(${toggleBox(size)} - ${SWITCH_THUMB_INSET_SELECTED * 2}px)`,
        height: `calc(${toggleBox(size)} - ${SWITCH_THUMB_INSET_SELECTED * 2}px)`,
        translate: `calc(${switchTrackWidth(size)} - ${toggleBox(size)} - ${SWITCH_THUMB_INSET - SWITCH_THUMB_INSET_SELECTED}px) 0`,
      },
  }),
);

/**
 * ADR-297 Phase 3b — 상태 스타일 트리 (`structure.stateStyles`) 에서 rule 대부분이 같이 쓰는 가지: 키보드 focus 의 ring
 * 과 disabled 의 흐림 · 조작 차단. 생성 CSS 는 `compileConditionTree` 로 (`:where([data-focus-visible])` ·
 * `:where([data-disabled])`), Canvas 는 disabled 흐림을 같은 트리에서 읽는다 (`disabledStateRules`).
 */
const FOCUS_RING_STATE = {
  focusRing: { isFocusVisible: "{focus.ring.default}" },
} as const;
const DISABLED_STATE = {
  opacity: { isDisabled: 0.38 },
  cursor: { isDisabled: "not-allowed" },
  pointerEvents: { isDisabled: "none" },
} as const;

/**
 * S2 press (`rule/pressScale.ts`) — 상태 트리 한 벌: 누르지 않을 때도 `will-change`, 누르면 perspective 축소.
 */
/** RAC `useSliderThumb` 의 inline `transform` (설치본 대조 — `pressScaleS2.test.ts`). */
export const SLIDER_THUMB_RAC_TRANSFORM = "translate(-50%, -50%)";
const PRESS_STATE = {
  willChange: CATALOG_PRESS_WILL_CHANGE,
  transform: { isPressed: catalogPressTransform() },
} as const;
// S2 1.8.2 Checkbox.box / Radio.circle / Switch.track. 같은 트리를 variant와 부품 CSS가 읽는다.
const toggleActive = (base: string, active: string) => ({
  default: `{color.${base}}`,
  isHovered: `{color.${active}}`,
  isFocusVisible: `{color.${active}}`,
  isPressed: `{color.${active}}`,
});
const TOGGLE_NEUTRAL = toggleActive("neutral-fill", "neutral-fill-hover");
const TOGGLE_ACCENT = toggleActive(
  "selection-accent",
  "selection-accent-hover",
);
const TOGGLE_NEGATIVE = toggleActive(
  "selection-negative",
  "selection-negative-hover",
);
const TOGGLE_LABEL = {
  ...toggleActive("neutral-content", "neutral-content-hover"),
  isDisabled: "{color.disabled-content}",
} as const;
// S2 1.8.2 FieldGroup: focus border and keyboard ring are separate.
const FIELD_INPUT_CONTENT = {
  default: "{color.neutral-content}",
  isHovered: "{color.neutral-content-hover}",
  isPressed: "{color.neutral-content-hover}",
  isFocusVisible: "{color.neutral-content-hover}",
  isDisabled: "{color.disabled-content}",
} as const;
// S2 SearchField icons inherit the field's resting color, even while hovered/pressed.
const SEARCH_FIELD_CONTENT = {
  default: "{color.neutral-content}",
  isDisabled: "{color.disabled-content}",
} as const;
const FIELD_INPUT_BORDER_STATES = {
  isHovered: "{color.neutral-outline-hover}",
  isPressed: "{color.neutral-outline-hover}",
  isInvalid: {
    default: "{color.selection-negative}",
    isHovered: "{color.selection-negative-hover}",
    isPressed: "{color.selection-negative-hover}",
  },
  isFocused: {
    default: "{color.neutral-content-hover}",
    isInvalid: "{color.selection-negative-hover}",
  },
  isFocusWithin: {
    default: "{color.neutral-content-hover}",
    isInvalid: "{color.selection-negative-hover}",
  },
  isDisabled: "{color.disabled-content}",
} as const;

const FIELD_INPUT_BORDER = {
  default: "{color.neutral-outline}",
  ...FIELD_INPUT_BORDER_STATES,
} as const;
const TOGGLE_GROUP_LABEL = {
  default: "{color.neutral-subdued}",
  isDisabled: "{color.disabled-content}",
} as const;
const CONTROL_FOCUS = {
  outline: {
    isFocusVisible: "var(--focus-ring-width) solid var(--focus-ring)",
  },
  outlineOffset: { isFocusVisible: "var(--focus-ring-offset)" },
} as const;
const TOGGLE_SELECTED_FILL = {
  ...TOGGLE_NEUTRAL,
  isEmphasized: TOGGLE_ACCENT,
  isDisabled: "{color.disabled-content}",
} as const;
const RADIO_RING_STATE = {
  borderColor: {
    ...TOGGLE_NEUTRAL,
    isSelected: { isEmphasized: TOGGLE_ACCENT },
    isInvalid: TOGGLE_NEGATIVE,
    isDisabled: "{color.disabled-content}",
  },
  background: "{color.base}",
  ...CONTROL_FOCUS,
  ...PRESS_STATE,
} as const;
const SWITCH_TRACK_STATE = {
  borderColor: {
    ...TOGGLE_NEUTRAL,
    isDisabled: "{color.disabled-content}",
    isSelected: "{color.transparent}",
  },
  background: { default: "{color.base}", isSelected: TOGGLE_SELECTED_FILL },
  ...CONTROL_FOCUS,
} as const;
const SWITCH_THUMB_STATE = {
  background: {
    ...TOGGLE_NEUTRAL,
    isDisabled: "{color.disabled-content}",
    isSelected: "{color.base}",
  },
  transformOrigin: "center",
  ...PRESS_STATE,
} as const;
/**
 * Calendar · RangeCalendar 의 날짜 셀 (RAC `CalendarCell` — rule 이 없는 RAC 부품) 의 선택 · focus. 옛 수동
 * `Calendar.css` · `RangeCalendar.css` · `CalendarCommon.css` 값 — 트리 블록 (0-3-0) 은 공통 시트 (hover · pressed ·
 * invalid, 0-3-0) 뒤 · 범위 시트 (`[data-selection-start]` …) 앞에 실린다.
 */
/**
 * S2 `Calendar.tsx:712` — the day cell presses (2026-11-04; was the manual `CalendarCommon.css` `scale: 0.9`).
 * The cell is the pressed element, so the runtime measures it.
 */
const CALENDAR_CELL_PRESS = {
  ...PRESS_STATE,
  transition: CATALOG_PRESS_TRANSITION,
} as const;
const CALENDAR_CELL_STATE = {
  background: {
    isSelected: {
      default: "var(--accent)",
      isHovered: "color-mix(in srgb, var(--accent) 85%, black)",
    },
  },
  // S2 `Calendar.tsx` cell `color.isDisabled: 'disabled'` — a day outside Min · Max (ADR-309; was the
  // manual `CalendarCommon.css` `[data-disabled]` color-mix).
  color: {
    isSelected: "var(--fg-on-accent)",
    isDisabled: "var(--fg-disabled)",
  },
  cursor: { isDisabled: "not-allowed" },
  outline: { isFocusVisible: "2px solid var(--accent)" },
  outlineOffset: { isFocusVisible: "2px" },
  ...CALENDAR_CELL_PRESS,
} as const;
const RANGE_CALENDAR_CELL_STATE = {
  background: {
    isSelected: {
      default: "transparent",
      isHovered: "color-mix(in srgb, var(--accent-subtle) 50%, var(--accent))",
      isInvalid: "transparent",
    },
  },
  color: { isSelected: "var(--fg)", isDisabled: "var(--fg-disabled)" },
  cursor: { isDisabled: "not-allowed" },
  outline: { isFocusVisible: "2px solid var(--focus-ring)" },
  outlineOffset: {
    isFocusVisible: {
      default: "-2px",
      isSelectionStart: "2px",
      isSelectionEnd: "2px",
    },
  },
  ...CALENDAR_CELL_PRESS,
} as const;
/**
 * RangeCalendar 의 기간 띠 (S2 `selectionBackgroundStyles` · `selectionBorderStyles` — td 의 `::before`, 옛 수동
 * `RangeCalendar.css`): 선택된 날짜 칸 (`td:has(> cell%)`) 마다, 하루만 고른 기간 (시작 = 끝) 은 띠 없이.
 */
const RANGE_BAND = `& .react-aria-CalendarGridBody td:has(> .react-aria-CalendarCell%):not(:has(> [data-selection-start][data-selection-end]))`;
const RANGE_BAND_STATE = {
  content: { isSelected: '""' },
  position: { isSelected: "absolute" },
  zIndex: { isSelected: "-1" },
  inset: { isSelected: "var(--spacing-2xs) 0" },
  background: {
    isSelected: {
      default: "var(--accent-subtle)",
      isInvalid: "var(--negative-subtle)",
    },
  },
  border: { isSelected: "1px solid var(--focus-ring)" },
  borderInlineWidth: { isSelected: "0" },
  borderColor: { isSelected: { isInvalid: "var(--negative)" } },
} as const;
/** 띠의 둥근 시작 (기간 시작 · 주의 첫 날 · 달의 첫 날) · 끝. */
const RANGE_BAND_START = {
  insetInlineStart: { isSelected: "var(--spacing-2xs)" },
  borderInlineStartWidth: { isSelected: "1px" },
  borderStartStartRadius: { isSelected: "var(--radius-full)" },
  borderEndStartRadius: { isSelected: "var(--radius-full)" },
} as const;
const RANGE_BAND_END = {
  insetInlineEnd: { isSelected: "var(--spacing-2xs)" },
  borderInlineEndWidth: { isSelected: "1px" },
  borderStartEndRadius: { isSelected: "var(--radius-full)" },
  borderEndEndRadius: { isSelected: "var(--radius-full)" },
} as const;
const CHECKBOX_SELECTED_FILL = {
  ...TOGGLE_NEUTRAL,
  isEmphasized: TOGGLE_ACCENT,
  isInvalid: TOGGLE_NEGATIVE,
  isDisabled: "{color.disabled-content}",
} as const;
const CHECKBOX_BOX_STATE = {
  borderColor: {
    ...TOGGLE_NEUTRAL,
    isInvalid: TOGGLE_NEGATIVE,
    isDisabled: "{color.disabled-content}",
    isSelected: "{color.transparent}",
    isIndeterminate: "{color.transparent}",
  },
  background: {
    default: "{color.base}",
    isSelected: CHECKBOX_SELECTED_FILL,
    isIndeterminate: CHECKBOX_SELECTED_FILL,
  },
  ...CONTROL_FOCUS,
  "--checkmark-color": "{color.base}",
  ...PRESS_STATE,
} as const;

/**
 * ADR-295 Phase 3c-3 — S2's font-relative spacings (Decision 3, `spectrum-theme.ts` relative spacing):
 * `text-to-visual` (an icon to its text — 6/14 em, touch 8/17 em) and `text-to-control` (a label to its
 * toggle control — 10/14 em on both sets). The control-relative padding is `ofHeight` (`edge-to-text` 3/8 ·
 * `pill` 1/2). `defineRuleLengthForms` (end of file) reads them in the installed maps.
 */
const TEXT_TO_VISUAL = em(6, 14, [8, 17]);
const TEXT_TO_CONTROL = em(10, 14);

const BUTTON_ROOT_BOX = {
  display: "inline-flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  width: "fit-content",
  height: "fit-content",
} as const;

/**
 * Button's root box: an inline Button centres on its line (baseline + half the parent's x-height) —
 * the generated sheet and the engine's line box read this one value (2026-11-02: it lived only in
 * the manual Button.css, so the Canvas set Buttons on the baseline and a Badge beside one sat
 * 0.75px off). ToggleButton keeps the baseline (its sheet never declared `middle`).
 */
const BUTTON_INLINE_ROOT_BOX = {
  ...BUTTON_ROOT_BOX,
  verticalAlign: "middle",
} as const;

/**
 * ADR-297 Phase 3h — Button 칠 = 설치 S2 `Button.tsx` (사용자 결정 2: 확정 8 건 S2 대로 · 저장소에 없는 S2 토큰은
 * 역할별 토큰으로 정렬). 트리 순서 = S2 키 순서 (fill → outline → disabled → static).
 * - #5 pressed = hover 의 단 (`baseColor` 의 `:pressed` = `:hovered` 와 같은 다음 단 · accent `accent-1000`).
 *   S2 fill 은 테두리 폭 0 — 테두리 색은 바탕과 같은 값이라 pressed 에 테두리 링이 생기지 않는다.
 * - #2 outline: 휴지 투명 · hover · pressed `gray-100` (`neutral-surface`). 테두리 primary `baseColor('gray-800')`
 *   (`neutral-fill` → `neutral-fill-hover`) · secondary `baseColor('gray-300')` (`neutral-outline` → `neutral-outline-hover`); S2 에 outline
 *   테두리가 없는 variant 는 그대로.
 * - #7 disabled: S2 `disabled` 색 — 바탕 `{color.disabled}` · 글자는 `{color.disabled-content}` ·
 *   outline 테두리 `border-disabled`. opacity 없음 (`BUTTON_DISABLED_STATE`).
 * - #9 static (variant 바깥): `transparent-overlay-N` = static 색 (white · black) 의 α — S2 `spectrum-theme`
 *   (`lch(from --s2-container-bg …) / α`). primary 800 → hover 900 · secondary 100 → 200 · outline hover 100 ·
 *   disabled 바탕 100 · 글자 400 · outline 테두리 primary 800 → 900 · secondary 300 → 400. primary 글자 `auto` =
 *   바탕 반대색. accent · negative fill 기본색은 유지하고 outline·disabled 공통 static 가지를 적용한다. premium · genai 는 `gradientButtonPaint`.
 */
const S2_OVERLAY_ALPHA = {
  100: 0.11,
  200: 0.14,
  300: 0.17,
  400: 0.21,
  800: 0.85,
  900: 0.94,
} as const;
type StaticTone = "white" | "black";
const overlay = (tone: StaticTone, step: keyof typeof S2_OVERLAY_ALPHA) =>
  `rgba(${tone === "white" ? "255, 255, 255" : "0, 0, 0"}, ${S2_OVERLAY_ALPHA[step]})`;
const opaque = (tone: StaticTone) => (tone === "white" ? "#ffffff" : "#000000");
const opposite = (tone: StaticTone) =>
  tone === "white" ? "#000000" : "#ffffff";
const TRANSPARENT = "{color.transparent}";
const OUTLINE_HOVER_FILL = "{color.neutral-surface}";

interface ButtonPaintSpec {
  /** fill 바탕 — 휴지 · hover (pressed 도 같은 단). */
  readonly fill: readonly [string, string];
  readonly text: string;
  readonly textHover?: string;
  readonly outlineText: string;
  /** outline 테두리 — 휴지 · hover/pressed. */
  readonly outlineBorder: readonly [string, string];
  /**
   * fill 테두리 색 (없으면 바탕과 같은 값). S2 fill 폭은 0이고, 저작 borderWidth가 있으면 이 색을 쓴다.
   * secondary 는 S2 gray-300 테두리 역할을 사용한다.
   */
  readonly fillBorder?: readonly [string, string];
  /** S2 static 가지 — primary · secondary 의 overlay 단, colored = accent · negative (premium · genai 는 `gradientButtonPaint`). */
  readonly static: "primary" | "secondary" | "colored";
}

function buttonStaticPaint(spec: ButtonPaintSpec, tone: StaticTone) {
  const ov = (step: keyof typeof S2_OVERLAY_ALPHA) => overlay(tone, step);
  const [rest, hover] =
    spec.static === "primary"
      ? [ov(800), ov(900)]
      : spec.static === "colored"
        ? spec.fill
        : [ov(100), ov(200)];
  const [borderRest, borderHover] =
    spec.static === "primary"
      ? [ov(800), ov(900)]
      : spec.static === "colored"
        ? ["currentColor", "currentColor"]
        : [ov(300), ov(400)];
  return {
    backgroundColor: {
      default: rest,
      isHovered: hover,
      isPressed: hover,
      isFocusVisible: hover,
      isDisabled: ov(100),
      fillStyle: {
        outline: {
          default: TRANSPARENT,
          isHovered: ov(100),
          isPressed: ov(100),
          isFocusVisible: ov(100),
          isDisabled: TRANSPARENT,
        },
      },
    },
    color: {
      default:
        spec.static === "primary"
          ? opposite(tone)
          : spec.static === "colored"
            ? spec.text
            : opaque(tone),
      fillStyle: { outline: opaque(tone) },
      isDisabled: overlay(tone, 400),
    },
    borderColor: {
      default: TRANSPARENT,
      fillStyle: {
        outline: {
          default: borderRest,
          isHovered: borderHover,
          isPressed: borderHover,
          isFocusVisible: borderHover,
          isDisabled: ov(300),
        },
      },
    },
  };
}

function buttonPaint(spec: ButtonPaintSpec) {
  const [rest, hover] = spec.fill;
  const [outlineRest, outlineHover] = spec.outlineBorder;
  const [borderRest, borderHover] = spec.fillBorder ?? spec.fill;
  const statics = {
    white: buttonStaticPaint(spec, "white"),
    black: buttonStaticPaint(spec, "black"),
  };
  const branch = (key: "backgroundColor" | "color" | "borderColor") => ({
    staticColor: {
      black: statics.black[key],
      white: statics.white[key],
    },
  });
  return {
    paint: {
      backgroundColor: {
        default: rest,
        isHovered: hover,
        isPressed: hover,
        isFocusVisible: hover,
        isDisabled: "{color.disabled}",
        fillStyle: {
          outline: {
            default: TRANSPARENT,
            isHovered: OUTLINE_HOVER_FILL,
            isPressed: OUTLINE_HOVER_FILL,
            isFocusVisible: OUTLINE_HOVER_FILL,
            isDisabled: TRANSPARENT,
          },
        },
        ...branch("backgroundColor"),
      },
      color: {
        default: spec.text,
        isHovered: spec.textHover ?? spec.text,
        isPressed: spec.textHover ?? spec.text,
        isFocusVisible: spec.textHover ?? spec.text,
        isDisabled: "{color.disabled-content}",
        fillStyle: {
          outline: {
            default: spec.outlineText,
            isHovered: "{color.neutral-content-hover}",
            isPressed: "{color.neutral-content-hover}",
            isFocusVisible: "{color.neutral-content-hover}",
            isDisabled: "{color.disabled-content}",
          },
        },
        ...branch("color"),
      },
      borderColor: {
        default: borderRest,
        isHovered: borderHover,
        isPressed: borderHover,
        isFocusVisible: borderHover,
        isDisabled: "{color.disabled}",
        fillStyle: {
          outline: {
            default: outlineRest,
            isHovered: outlineHover,
            isPressed: outlineHover,
            isFocusVisible: outlineHover,
            isDisabled: "{color.border-disabled}",
          },
        },
        ...branch("borderColor"),
      },
    },
  };
}

/**
 * ADR-297 후속 ⑥ — premium · genai 의 그라데이션 = 설치 S2 `Button.tsx` `gradient` (`linearGradient('to bottom right', …)`,
 * 정지점 색은 `dist/private/Button.css` 의 `--g0..2` light 값 — `colorScheme: 'light'` 로 테마와 무관하게 고정). 휴지 = 900 단,
 * hover · pressed · focus = 1000 단.
 */
const S2_GRADIENT = {
  premium: {
    rest: ["#b539c8", "#7155fa", "#3b63fb"], // fuchsia · indigo · blue 900
    hover: ["#9c28af", "#6338ee", "#274dea"], // 1000
    stops: [0, 66, 100],
  },
  genai: {
    rest: ["#d73220", "#d92361", "#7155fa"], // red · magenta · indigo 900
    hover: ["#b72818", "#ba1650", "#6338ee"], // 1000
    stops: [0, 33, 100],
  },
} as const;

/**
 * S2 premium · genai Button (`Button.tsx`): 바탕 `gray-100` (fill · outline 같음, fill disabled 만 `disabled`) 위에
 * 그라데이션 (disabled 면 없음), 테두리 폭 0 (= 투명 — 그라데이션이 border box 를 덮는다), 글자 흰색 (disabled 는 disabled
 * 글자). static: 바탕 `transparent-overlay-100` (그라데이션은 그대로 위), disabled 글자 `transparent-overlay-400`.
 */
function gradientButtonPaint(
  spec: (typeof S2_GRADIENT)[keyof typeof S2_GRADIENT],
) {
  const gradient = (colors: readonly string[]): PaintImage => [
    {
      to: "bottom right",
      stops: colors.map((color, i) => [color, spec.stops[i]!] as const),
    },
  ];
  const hover = gradient(spec.hover);
  const staticTone = (tone: StaticTone) => ({
    background: overlay(tone, 100),
    color: { default: "#ffffff", isDisabled: overlay(tone, 400) },
  });
  return {
    paint: {
      backgroundColor: {
        default: OUTLINE_HOVER_FILL,
        isDisabled: "{color.disabled}",
        fillStyle: { outline: OUTLINE_HOVER_FILL },
        staticColor: {
          black: staticTone("black").background,
          white: staticTone("white").background,
        },
      },
      backgroundImage: {
        default: gradient(spec.rest),
        isHovered: hover,
        isPressed: hover,
        isFocusVisible: hover,
        isDisabled: null,
      },
      color: {
        default: "{color.white}",
        isDisabled: "{color.disabled-content}",
        staticColor: {
          black: staticTone("black").color,
          white: staticTone("white").color,
        },
      },
      borderColor: TRANSPARENT,
    },
  };
}

/** S2 Button — disabled 는 색 (`buttonPaint`) 이지 opacity 가 아니다 (ADR-297 3h #7). */
const BUTTON_DISABLED_STATE = {
  cursor: { isDisabled: "not-allowed" },
  pointerEvents: { isDisabled: "none" },
} as const;

const BUTTON_VARIANTS_BASE = {
  // (outline 글자 = S2 `baseColor('neutral')` — fill 밖 variant 색은 S2 outline 에 없다, #2)
  accent: buttonPaint({
    fill: ["{color.accent-fill}", "{color.accent-fill-hover}"],
    text: "{color.on-accent}",
    outlineText: "{color.neutral-content}",
    outlineBorder: ["currentColor", "currentColor"],
    static: "colored",
  }),
  // 진한 바탕의 한 단 — `neutral-hover` 는 밝은 바탕 (neutral-subtle) 의 다음 단이라 흰 글자가
  // 사라진다 (ADR-293 결정 4, S2 `baseColor('neutral')`)
  primary: buttonPaint({
    fill: ["{color.neutral-fill}", "{color.neutral-fill-hover}"],
    text: "{color.on-neutral}",
    outlineText: "{color.neutral-content}",
    outlineBorder: ["{color.neutral-fill}", "{color.neutral-fill-hover}"],
    static: "primary",
  }),
  secondary: buttonPaint({
    fill: ["{color.neutral-surface}", "{color.neutral-surface-hover}"],
    fillBorder: ["{color.neutral-outline}", "{color.neutral-outline-hover}"],
    text: "{color.neutral-content}",
    textHover: "{color.neutral-content-hover}",
    outlineText: "{color.neutral-content}",
    outlineBorder: ["{color.neutral-outline}", "{color.neutral-outline-hover}"],
    static: "secondary",
  }),
  negative: buttonPaint({
    fill: ["{color.negative-fill}", "{color.negative-fill-hover}"],
    text: "{color.on-negative}",
    outlineText: "{color.neutral-content}",
    outlineBorder: ["currentColor", "currentColor"],
    static: "colored",
  }),
  premium: gradientButtonPaint(S2_GRADIENT.premium),
  genai: gradientButtonPaint(S2_GRADIENT.genai),
};

const BUTTON_VARIANTS = Object.fromEntries(
  Object.entries(BUTTON_VARIANTS_BASE).map(([name, variant]) => [
    name,
    {
      ...variant,
      paint: {
        ...variant.paint,
        backgroundColor: {
          ...variant.paint.backgroundColor,
          isPicker: PICKER_BACKGROUND,
          isSearchFieldPart: "{color.transparent}",
        },
        color: {
          ...variant.paint.color,
          isPicker: PICKER_CONTENT,
          isSearchFieldPart: SEARCH_FIELD_CONTENT,
        },
      },
    },
  ]),
);

/** S2 Button.tsx: fill 0 · outline 2; gradient/field buttons have no border. */
function buttonBoxValue<T extends string | number>(fill: T, outline: T) {
  return {
    default: fill,
    fillStyle: { outline },
    variant: { premium: fill, genai: fill },
    fieldButton: Object.fromEntries(
      Object.keys(FIELD_BUTTON_CORNERS).map((size) => [size, fill]),
    ),
  };
}
const BUTTON_BORDER_WIDTH = buttonBoxValue("0px", "2px");
const BUTTON_SIZES = {
  XS: {
    fontSize: "{typography.text-2xs}",
    lineHeight: "{typography.text-2xs--line-height}",
    fontWeight: 500,
    borderRadius: "{radius.full}",
    borderWidth: "{border.width.none}",
    height: 0,
    minHeight: "{size.height.XS}",
    iconSize: "{typography.text-2xs--line-height}",
    paddingX: ofHeight(1, 2),
    paddingY: 3,
    gap: TEXT_TO_VISUAL,
    iconGap: TEXT_TO_VISUAL,
  },
  S: {
    fontSize: "{typography.text-xs}",
    lineHeight: "{typography.text-xs--line-height}",
    fontWeight: 500,
    borderRadius: "{radius.full}",
    borderWidth: "{border.width.none}",
    height: 0,
    minHeight: "{size.height.S}",
    iconSize: "{typography.text-xs--line-height}",
    paddingX: ofHeight(1, 2),
    paddingY: 4,
    gap: TEXT_TO_VISUAL,
    iconGap: TEXT_TO_VISUAL,
  },
  M: {
    fontSize: "{typography.text-sm}",
    lineHeight: "{typography.text-sm--line-height}",
    fontWeight: 500,
    borderRadius: "{radius.full}",
    borderWidth: "{border.width.none}",
    height: 0,
    minHeight: "{size.height.M}",
    iconSize: "{typography.text-sm--line-height}",
    paddingX: ofHeight(1, 2),
    paddingY: 7,
    gap: TEXT_TO_VISUAL,
    iconGap: TEXT_TO_VISUAL,
  },
  L: {
    fontSize: "{typography.text-base}",
    lineHeight: "{typography.text-base--line-height}",
    fontWeight: 500,
    borderRadius: "{radius.full}",
    borderWidth: "{border.width.none}",
    height: 0,
    minHeight: "{size.height.L}",
    iconSize: "{typography.text-base--line-height}",
    paddingX: ofHeight(1, 2),
    paddingY: 10,
    gap: TEXT_TO_VISUAL,
    iconGap: TEXT_TO_VISUAL,
  },
  XL: {
    fontSize: "{typography.text-lg}",
    lineHeight: "{typography.text-lg--line-height}",
    fontWeight: 500,
    borderRadius: "{radius.full}",
    borderWidth: "{border.width.none}",
    height: 0,
    minHeight: "{size.height.XL}",
    iconSize: "{typography.text-lg--line-height}",
    paddingX: ofHeight(1, 2),
    paddingY: 13,
    gap: TEXT_TO_VISUAL,
    iconGap: TEXT_TO_VISUAL,
  },
} as const;
// CSS and the typed definition use the same border tree to preserve the control height.
const BUTTON_PADDING_BLOCK = (() => {
  const sizes = Object.fromEntries(
    Object.entries(BUTTON_SIZES).map(([name, size]) => [
      name,
      `calc((${tokenToCSSVar(size.minHeight)} - ${tokenToCSSVar(size.fontSize)} * ${tokenToCSSVar(size.lineHeight)} - 2 * var(--catalog-button-border-width)) / 2)`,
    ]),
  );
  return { default: sizes.M, size: sizes };
})();

const ACTION_CONTROL_SIZES = {
  XS: {
    paddingX: ofHeight(3, 8),
    fontSize: "{typography.text-2xs}",
    lineHeight: "{typography.text-2xs--line-height}",
    fontWeight: 500,
    borderRadius: "{radius.sm}",
    borderWidth: "{border.width.thin}",
    height: 0,
    minHeight: "{size.height.XS}",
    paddingY: 2,
    gap: TEXT_TO_VISUAL,
    iconSize: "{typography.text-2xs--line-height}",
  },
  S: {
    paddingX: ofHeight(3, 8),
    fontSize: "{typography.text-xs}",
    lineHeight: "{typography.text-xs--line-height}",
    fontWeight: 500,
    borderRadius: 7,
    borderWidth: "{border.width.thin}",
    height: 0,
    minHeight: "{size.height.S}",
    paddingY: 3,
    gap: TEXT_TO_VISUAL,
    iconSize: "{typography.text-xs--line-height}",
  },
  M: {
    paddingX: ofHeight(3, 8),
    fontSize: "{typography.text-sm}",
    lineHeight: "{typography.text-sm--line-height}",
    fontWeight: 500,
    borderRadius: 8,
    borderWidth: "{border.width.thin}",
    height: 0,
    minHeight: "{size.height.M}",
    paddingY: 6,
    gap: TEXT_TO_VISUAL,
    iconSize: "{typography.text-sm--line-height}",
  },
  L: {
    paddingX: ofHeight(3, 8),
    fontSize: "{typography.text-base}",
    lineHeight: "{typography.text-base--line-height}",
    fontWeight: 500,
    borderRadius: 9,
    borderWidth: "{border.width.thin}",
    height: 0,
    minHeight: "{size.height.L}",
    paddingY: 9,
    gap: TEXT_TO_VISUAL,
    iconSize: "{typography.text-base--line-height}",
  },
  XL: {
    paddingX: ofHeight(3, 8),
    fontSize: "{typography.text-lg}",
    lineHeight: "{typography.text-lg--line-height}",
    fontWeight: 500,
    borderRadius: 10,
    borderWidth: "{border.width.thin}",
    height: 0,
    minHeight: "{size.height.XL}",
    paddingY: 12,
    gap: TEXT_TO_VISUAL,
    iconSize: "{typography.text-lg--line-height}",
  },
} as const;

// S2 1.8.2 ActionButton.btnStyles: ActionButton과 ToggleButton은 같은 칠 계약이다.
const actionActive = (rest: string, active: string) => ({
  default: rest,
  isHovered: active,
  isExpanded: active,
  isPressed: active,
  isFocusVisible: active,
});
const actionRest = (color: string) => ({
  default: color,
  isQuiet: "{color.transparent}",
});
const actionStaticBackground = (channels: string) => {
  const rest = `rgb(${channels} / 0.11)`;
  return {
    ...actionActive(rest, `rgb(${channels} / 0.14)`),
    isQuiet: actionActive("{color.transparent}", `rgb(${channels} / 0.14)`),
    isSelected: actionActive(
      `rgb(${channels} / 0.85)`,
      `rgb(${channels} / 0.94)`,
    ),
    isDisabled: actionRest(rest),
  };
};
const ACTION_BUTTON_PAINT = {
  backgroundColor: {
    ...actionActive("{color.neutral-surface}", "{color.neutral-surface-hover}"),
    isQuiet: actionActive(
      "{color.transparent}",
      "{color.neutral-surface-hover}",
    ),
    isSelected: {
      ...actionActive("{color.neutral-fill}", "{color.neutral-fill-hover}"),
      isEmphasized: actionActive(
        "{color.accent-fill}",
        "{color.accent-fill-hover}",
      ),
    },
    isDisabled: actionRest("{color.neutral-surface}"),
    staticColor: {
      black: actionStaticBackground("0 0 0"),
      white: actionStaticBackground("255 255 255"),
    },
  },
  color: {
    ...actionActive("{color.neutral-content}", "{color.neutral-content-hover}"),
    isSelected: {
      default: "{color.on-neutral}",
      isEmphasized: "{color.on-accent}",
    },
    isDisabled: "{color.disabled-content}",
    staticColor: {
      black: {
        default: "#000000",
        isSelected: "#ffffff",
        isDisabled: "rgb(0 0 0 / 0.21)",
      },
      white: {
        default: "#ffffff",
        isSelected: "#000000",
        isDisabled: "rgb(255 255 255 / 0.21)",
      },
    },
  },
  borderColor: { default: "{color.transparent}" },
};
// S2 1.8.2 ActionButton과 ToggleButton의 그룹 레이아웃 정본.
const ACTION_FOCUS_RING_STATE = {
  outline: {
    isFocusVisible: {
      default: "var(--focus-ring-width) solid var(--focus-ring)",
      staticColor: {
        black: "var(--focus-ring-width) solid #000000",
        white: "var(--focus-ring-width) solid #ffffff",
      },
    },
  },
  outlineOffset: { isFocusVisible: "var(--focus-ring-offset)" },
};
const ACTION_GROUP_BUTTON_COMPOSITION = {
  delegation: [],
  // S2 ActionButton / ToggleButton TextContext의 truncate 기본값.
  staticSelectors: {
    ".react-aria-Text": {
      "min-width": "0px",
      "white-space": "nowrap",
      "text-overflow": "ellipsis",
      overflow: "hidden",
    },
  },
  rootSelectors: {
    "&[data-in-group]": { styles: { "flex-shrink": "0" } },
    "&[data-justified]": {
      styles: { "flex-grow": "1", "flex-basis": "0" },
    },
    '&[data-in-group][data-orientation="vertical"]': {
      styles: { width: "100%" },
    },
    '&[data-density="compact"]': { styles: { "border-radius": "0" } },
    '&[data-density="compact"]:first-child': {
      styles: { "border-start-start-radius": "var(--action-corner)" },
    },
    '&[data-density="compact"]:last-child': {
      styles: { "border-end-end-radius": "var(--action-corner)" },
    },
    '&[data-density="compact"][data-orientation="horizontal"]:first-child': {
      styles: { "border-end-start-radius": "var(--action-corner)" },
    },
    '&[data-density="compact"][data-orientation="vertical"]:last-child': {
      styles: { "border-end-start-radius": "var(--action-corner)" },
    },
    '&[data-density="compact"][data-orientation="horizontal"]:last-child': {
      styles: { "border-start-end-radius": "var(--action-corner)" },
    },
    '&[data-density="compact"][data-orientation="vertical"]:first-child': {
      styles: { "border-start-end-radius": "var(--action-corner)" },
    },
    ...Object.fromEntries(
      Object.entries({ ...FIELD_BUTTON_CORNERS, XS: "6px" }).map(
        ([size, corner]) => [
          `&[data-size="${size}"]`,
          { styles: { "--action-corner": corner } },
        ],
      ),
    ),
  },
};

const ACTION_GROUP_SIZES = Object.fromEntries(
  Object.entries(ACTION_CONTROL_SIZES).map(([size, rule]) => [
    size,
    {
      fontSize: rule.fontSize,
      borderRadius: 0,
      height: 0,
      gap: size === "XS" || size === "S" ? 4 : 8,
    },
  ]),
);

// S2는 border:none. 종전 1px border 공간은 padding에 포함해 높이를 보존한다.
const ACTION_BUTTON_SIZES = Object.fromEntries(
  Object.entries(ACTION_CONTROL_SIZES).map(([size, rule]) => [
    size,
    {
      ...rule,
      minWidth: rule.minHeight,
      borderRadius: size === "XS" ? 6 : rule.borderRadius,
      borderWidth: 0,
      paddingY: rule.paddingY + 1,
    },
  ]),
);

export const COMPONENT_RULES_TABLE: ComponentRulesTable = {
  ActionBar: ACTION_BAR_RULE,
  SelectBoxGroup: SELECT_BOX_GROUP_RULE,
  SelectBox: SELECT_BOX_RULE,
  // ADR-256 Phase 6g — Autocomplete: RAC Autocomplete has no element (its children sit in its
  //   parent's flow). The Canvas lays it out as `display: contents` (engine CSS-DISPLAY-3 §2.5 —
  //   its children are its parent's items; its own box is their union, for selection only).
  Autocomplete: {
    defaultSize: "M",
    variants: {},
    sizes: {
      M: {
        height: 0,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
      },
    },
    structure: {
      archetype: "container",
      element: "div",
      skipCSSGeneration: true,
      containerStyles: {
        display: "contents",
      },
    },
  },
  Avatar: {
    defaultVariant: "default",
    defaultSize: "24",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.neutral-subtle}",
            isHovered: "{color.neutral-subtle}",
            isPressed: "{color.neutral-subtle}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
    },
    sizes: {
      ...Object.fromEntries(
        AVATAR_SIZE_PRESETS.map((size) => [
          String(size),
          { height: size, borderRadius: "{radius.full}" },
        ]),
      ),
      XS: {
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.full}",
        height: 24,
      },
      S: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.full}",
        height: 28,
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.full}",
        height: 32,
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.full}",
        height: 40,
      },
      XL: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.full}",
        height: 48,
      },
    },
    structure: {
      archetype: "simple",
      element: "div",
      containerStyles: {
        // ADR-923 Phase 5 후속 HC2 전환 (2026-09-03): inline-flex → flex. DOM 실효값은 preview rendererMap
        //   `renderAvatar` (LayoutRenderers.tsx) 인라인 `display: "flex"` (shared Avatar.tsx:109 도 flex) 이고
        //   generated/Avatar.css 는 로드되지 않는다 — Canvas (resolveDefaultDisplay) 가 같은 outer 를 읽도록
        //   catalog 를 DOM 에 맞춘다. evidence/923-phase5-followup-hc2-conversion.md.
        display: "flex",
        alignItems: "center",
      },
    },
  },
  AvatarGroup: {
    defaultVariant: "default",
    defaultSize: "24",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
        alpha: 0,
      },
    },
    sizes: {
      ...Object.fromEntries(
        AVATAR_GROUP_SIZES.map((size) => [
          String(size),
          { height: 0, borderRadius: "{radius.full}" },
        ]),
      ),
      XS: {
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.full}",
        height: 0,
      },
      S: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.full}",
        height: 0,
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.full}",
        height: 0,
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.full}",
        height: 0,
      },
      XL: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.full}",
        height: 0,
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: undefined,
      // S2 AvatarGroup (`@react-spectrum/s2/src/AvatarGroup.tsx` `avatar`): each avatar overlaps the
      //   one before by a quarter of its size (`marginStart: calc(var(--size) / -4)`), the first
      //   none (`:first-child: 0`). Here every avatar takes the overlap and the group's start
      //   padding gives the first one's back — the same boxes, with no position condition (the
      //   Canvas part rules match by type and props).
      composition: {
        containerVariants: {
          size: {
            ...Object.fromEntries(
              AVATAR_GROUP_SIZES.map((size, index) => [
                String(size),
                {
                  styles: { padding: `0 0 0 ${size / 64}rem` },
                  nested: [
                    {
                      selector: "> .react-aria-Avatar",
                      styles: { "margin-inline-start": `${-size / 64}rem` },
                    },
                    {
                      selector: "> .react-aria-Text",
                      styles: {
                        "font-size": `${[11, 12, 14, 16, 18, 20, 22][index] / 16}rem`,
                        "line-height": `${[14, 16, 18, 20, 22, 24, 26][index] / 16}rem`,
                      },
                    },
                  ],
                },
              ]),
            ),
            XS: {
              styles: { padding: "0 0 0 6px" },
              nested: [
                {
                  selector: "> .react-aria-Avatar",
                  styles: { "margin-inline-start": "-6px" },
                },
              ],
            },
            S: {
              styles: { padding: "0 0 0 7px" },
              nested: [
                {
                  selector: "> .react-aria-Avatar",
                  styles: { "margin-inline-start": "-7px" },
                },
              ],
            },
            M: {
              styles: { padding: "0 0 0 8px" },
              nested: [
                {
                  selector: "> .react-aria-Avatar",
                  styles: { "margin-inline-start": "-8px" },
                },
              ],
            },
            L: {
              styles: { padding: "0 0 0 10px" },
              nested: [
                {
                  selector: "> .react-aria-Avatar",
                  styles: { "margin-inline-start": "-10px" },
                },
              ],
            },
            XL: {
              styles: { padding: "0 0 0 12px" },
              nested: [
                {
                  selector: "> .react-aria-Avatar",
                  styles: { "margin-inline-start": "-12px" },
                },
              ],
            },
          },
        },
        delegation: [],
      },
    },
  },
  Badge: {
    defaultVariant: "accent",
    defaultSize: "S",
    // ADR-257 후속 — S2 Badge `overflowMode` (default wrap — S2 `Badge.tsx` Text style): the text
    //   wraps at the badge width (`normal`), or stays on one line cut with an ellipsis. Canvas reads
    //   this top-level block (resolver → record visual — layout measure · paint); the DOM sheet is
    //   `Badge.css` `[data-overflow-mode]` (Badge.tsx writes the attribute), as ColorSwatch
    //   `rounding` — structure.composition would emit it but flips the size axis box ownership.
    containerVariants: {
      "overflow-mode": {
        truncate: {
          styles: {
            "white-space": "nowrap",
            "text-overflow": "ellipsis",
          },
        },
        wrap: {
          styles: {
            "white-space": "normal",
          },
        },
      },
    },
    variants: {
      accent: {
        paint: {
          backgroundColor: {
            default: "{color.accent}",
            fillStyle: {
              outline: "{color.transparent}",
              subtle: "{color.accent-subtle}",
            },
          },
          color: {
            default: "{color.on-accent}",
            fillStyle: {
              outline: "{color.gray-1000}",
              subtle: "{color.gray-1000}",
            },
          },
          borderColor: {
            default: "{color.transparent}",
            fillStyle: {
              outline: "{color.accent-content}",
            },
          },
        },
      },
      informative: {
        paint: {
          backgroundColor: {
            default: "{color.informative-background}",
            fillStyle: {
              outline: "{color.transparent}",
              subtle: "{color.informative-subtle}",
            },
          },
          color: {
            default: "{color.white}",
            fillStyle: {
              outline: "{color.gray-1000}",
              subtle: "{color.gray-1000}",
            },
          },
          borderColor: {
            default: "{color.transparent}",
            fillStyle: {
              outline: "{color.informative}",
            },
          },
        },
      },
      neutral: {
        paint: {
          backgroundColor: {
            default: "{color.neutral}",
            fillStyle: {
              outline: "{color.transparent}",
              subtle: "{color.neutral-subtle}",
            },
          },
          color: {
            default: "{color.base}",
            fillStyle: {
              outline: "{color.gray-1000}",
              subtle: "{color.gray-1000}",
            },
          },
          borderColor: {
            default: "{color.transparent}",
            fillStyle: {
              outline: "{color.neutral}",
            },
          },
        },
      },
      positive: {
        paint: {
          backgroundColor: {
            default: "{color.positive-background}",
            fillStyle: {
              outline: "{color.transparent}",
              subtle: "{color.positive-subtle}",
            },
          },
          color: {
            default: "{color.white}",
            fillStyle: {
              outline: "{color.gray-1000}",
              subtle: "{color.gray-1000}",
            },
          },
          borderColor: {
            default: "{color.transparent}",
            fillStyle: {
              outline: "{color.positive}",
            },
          },
        },
      },
      notice: {
        paint: {
          backgroundColor: {
            default: "{color.notice-background}",
            fillStyle: {
              outline: "{color.transparent}",
              subtle: "{color.notice-subtle}",
            },
          },
          color: {
            default: "{color.black}",
            fillStyle: {
              outline: "{color.gray-1000}",
              subtle: "{color.gray-1000}",
            },
          },
          borderColor: {
            default: "{color.transparent}",
            fillStyle: {
              outline: "{color.notice}",
            },
          },
        },
      },
      negative: {
        paint: {
          backgroundColor: {
            default: "{color.negative-background}",
            fillStyle: {
              outline: "{color.transparent}",
              subtle: "{color.negative-subtle}",
            },
          },
          color: {
            default: "{color.on-negative}",
            fillStyle: {
              outline: "{color.gray-1000}",
              subtle: "{color.gray-1000}",
            },
          },
          borderColor: {
            default: "{color.transparent}",
            fillStyle: {
              outline: "{color.negative}",
            },
          },
        },
      },
      gray: {
        paint: {
          backgroundColor: {
            default: "{color.gray}",
            fillStyle: {
              outline: "{color.transparent}",
              subtle: "{color.gray-subtle}",
            },
          },
          color: {
            default: "{color.white}",
            fillStyle: {
              outline: "{color.gray-1000}",
              subtle: "{color.gray-1000}",
            },
          },
          borderColor: {
            default: "{color.transparent}",
            fillStyle: {
              outline: "{color.gray}",
            },
          },
        },
      },
      red: {
        paint: {
          backgroundColor: {
            default: "{color.red}",
            fillStyle: {
              outline: "{color.transparent}",
              subtle: "{color.red-subtle}",
            },
          },
          color: {
            default: "{color.white}",
            fillStyle: {
              outline: "{color.gray-1000}",
              subtle: "{color.gray-1000}",
            },
          },
          borderColor: {
            default: "{color.transparent}",
            fillStyle: {
              outline: "{color.red}",
            },
          },
        },
      },
      orange: {
        paint: {
          backgroundColor: {
            default: "{color.orange}",
            fillStyle: {
              outline: "{color.transparent}",
              subtle: "{color.orange-subtle}",
            },
          },
          color: {
            default: "{color.black}",
            fillStyle: {
              outline: "{color.gray-1000}",
              subtle: "{color.gray-1000}",
            },
          },
          borderColor: {
            default: "{color.transparent}",
            fillStyle: {
              outline: "{color.orange}",
            },
          },
        },
      },
      yellow: {
        paint: {
          backgroundColor: {
            default: "{color.yellow}",
            fillStyle: {
              outline: "{color.transparent}",
              subtle: "{color.yellow-subtle}",
            },
          },
          color: {
            default: "{color.black}",
            fillStyle: {
              outline: "{color.gray-1000}",
              subtle: "{color.gray-1000}",
            },
          },
          borderColor: {
            default: "{color.transparent}",
            fillStyle: {
              outline: "{color.yellow}",
            },
          },
        },
      },
      green: {
        paint: {
          backgroundColor: {
            default: "{color.green-named}",
            fillStyle: {
              outline: "{color.transparent}",
              subtle: "{color.green-named-subtle}",
            },
          },
          color: {
            default: "{color.white}",
            fillStyle: {
              outline: "{color.gray-1000}",
              subtle: "{color.gray-1000}",
            },
          },
          borderColor: {
            default: "{color.transparent}",
            fillStyle: {
              outline: "{color.green-named}",
            },
          },
        },
      },
      blue: {
        paint: {
          backgroundColor: {
            default: "{color.blue}",
            fillStyle: {
              outline: "{color.transparent}",
              subtle: "{color.blue-subtle}",
            },
          },
          color: {
            default: "{color.white}",
            fillStyle: {
              outline: "{color.gray-1000}",
              subtle: "{color.gray-1000}",
            },
          },
          borderColor: {
            default: "{color.transparent}",
            fillStyle: {
              outline: "{color.blue}",
            },
          },
        },
      },
      purple: {
        paint: {
          backgroundColor: {
            default: "{color.purple}",
            fillStyle: {
              outline: "{color.transparent}",
              subtle: "{color.purple-subtle}",
            },
          },
          color: {
            default: "{color.white}",
            fillStyle: {
              outline: "{color.gray-1000}",
              subtle: "{color.gray-1000}",
            },
          },
          borderColor: {
            default: "{color.transparent}",
            fillStyle: {
              outline: "{color.purple}",
            },
          },
        },
      },
      indigo: {
        paint: {
          backgroundColor: {
            default: "{color.indigo}",
            fillStyle: {
              outline: "{color.transparent}",
              subtle: "{color.indigo-subtle}",
            },
          },
          color: {
            default: "{color.white}",
            fillStyle: {
              outline: "{color.gray-1000}",
              subtle: "{color.gray-1000}",
            },
          },
          borderColor: {
            default: "{color.transparent}",
            fillStyle: {
              outline: "{color.indigo}",
            },
          },
        },
      },
      cyan: {
        paint: {
          backgroundColor: {
            default: "{color.cyan}",
            fillStyle: {
              outline: "{color.transparent}",
              subtle: "{color.cyan-subtle}",
            },
          },
          color: {
            default: "{color.white}",
            fillStyle: {
              outline: "{color.gray-1000}",
              subtle: "{color.gray-1000}",
            },
          },
          borderColor: {
            default: "{color.transparent}",
            fillStyle: {
              outline: "{color.cyan}",
            },
          },
        },
      },
      pink: {
        paint: {
          backgroundColor: {
            default: "{color.pink}",
            fillStyle: {
              outline: "{color.transparent}",
              subtle: "{color.pink-subtle}",
            },
          },
          color: {
            default: "{color.white}",
            fillStyle: {
              outline: "{color.gray-1000}",
              subtle: "{color.gray-1000}",
            },
          },
          borderColor: {
            default: "{color.transparent}",
            fillStyle: {
              outline: "{color.pink}",
            },
          },
        },
      },
      turquoise: {
        paint: {
          backgroundColor: {
            default: "{color.turquoise}",
            fillStyle: {
              outline: "{color.transparent}",
              subtle: "{color.turquoise-subtle}",
            },
          },
          color: {
            default: "{color.white}",
            fillStyle: {
              outline: "{color.gray-1000}",
              subtle: "{color.gray-1000}",
            },
          },
          borderColor: {
            default: "{color.transparent}",
            fillStyle: {
              outline: "{color.turquoise}",
            },
          },
        },
      },
      fuchsia: {
        paint: {
          backgroundColor: {
            default: "{color.fuchsia}",
            fillStyle: {
              outline: "{color.transparent}",
              subtle: "{color.fuchsia-subtle}",
            },
          },
          color: {
            default: "{color.white}",
            fillStyle: {
              outline: "{color.gray-1000}",
              subtle: "{color.gray-1000}",
            },
          },
          borderColor: {
            default: "{color.transparent}",
            fillStyle: {
              outline: "{color.fuchsia}",
            },
          },
        },
      },
      magenta: {
        paint: {
          backgroundColor: {
            default: "{color.magenta}",
            fillStyle: {
              outline: "{color.transparent}",
              subtle: "{color.magenta-subtle}",
            },
          },
          color: {
            default: "{color.white}",
            fillStyle: {
              outline: "{color.gray-1000}",
              subtle: "{color.gray-1000}",
            },
          },
          borderColor: {
            default: "{color.transparent}",
            fillStyle: {
              outline: "{color.magenta}",
            },
          },
        },
      },
      chartreuse: {
        paint: {
          backgroundColor: {
            default: "{color.chartreuse}",
            fillStyle: {
              outline: "{color.transparent}",
              subtle: "{color.chartreuse-subtle}",
            },
          },
          color: {
            default: "{color.black}",
            fillStyle: {
              outline: "{color.gray-1000}",
              subtle: "{color.gray-1000}",
            },
          },
          borderColor: {
            default: "{color.transparent}",
            fillStyle: {
              outline: "{color.chartreuse}",
            },
          },
        },
      },
      celery: {
        paint: {
          backgroundColor: {
            default: "{color.celery}",
            fillStyle: {
              outline: "{color.transparent}",
              subtle: "{color.celery-subtle}",
            },
          },
          color: {
            default: "{color.black}",
            fillStyle: {
              outline: "{color.gray-1000}",
              subtle: "{color.gray-1000}",
            },
          },
          borderColor: {
            default: "{color.transparent}",
            fillStyle: {
              outline: "{color.celery}",
            },
          },
        },
      },
      seafoam: {
        paint: {
          backgroundColor: {
            default: "{color.seafoam}",
            fillStyle: {
              outline: "{color.transparent}",
              subtle: "{color.seafoam-subtle}",
            },
          },
          color: {
            default: "{color.white}",
            fillStyle: {
              outline: "{color.gray-1000}",
              subtle: "{color.gray-1000}",
            },
          },
          borderColor: {
            default: "{color.transparent}",
            fillStyle: {
              outline: "{color.seafoam}",
            },
          },
        },
      },
      brown: {
        paint: {
          backgroundColor: {
            default: "{color.brown}",
            fillStyle: {
              outline: "{color.transparent}",
              subtle: "{color.brown-subtle}",
            },
          },
          color: {
            default: "{color.white}",
            fillStyle: {
              outline: "{color.gray-1000}",
              subtle: "{color.gray-1000}",
            },
          },
          borderColor: {
            default: "{color.transparent}",
            fillStyle: {
              outline: "{color.brown}",
            },
          },
        },
      },
      cinnamon: {
        paint: {
          backgroundColor: {
            default: "{color.cinnamon}",
            fillStyle: {
              outline: "{color.transparent}",
              subtle: "{color.cinnamon-subtle}",
            },
          },
          color: {
            default: "{color.white}",
            fillStyle: {
              outline: "{color.gray-1000}",
              subtle: "{color.gray-1000}",
            },
          },
          borderColor: {
            default: "{color.transparent}",
            fillStyle: {
              outline: "{color.cinnamon}",
            },
          },
        },
      },
      silver: {
        paint: {
          backgroundColor: {
            default: "{color.silver}",
            fillStyle: {
              outline: "{color.transparent}",
              subtle: "{color.silver-subtle}",
            },
          },
          color: {
            default: "{color.white}",
            fillStyle: {
              outline: "{color.gray-1000}",
              subtle: "{color.gray-1000}",
            },
          },
          borderColor: {
            default: "{color.transparent}",
            fillStyle: {
              outline: "{color.silver}",
            },
          },
        },
      },
    },
    // ADR-295 Phase 3c-3b: S2 Badge = `control({shape: 'default', wrap: true, icon: true})` — min-height
    //   the control height, padding-inline `edge-to-text` (height × 3/8), the control corner (7 · 8 · 9 · 10 —
    //   not a pill), `text-to-visual` gap, paddingY the S2 centring of the line ((height − line − border×2) / 2).
    sizes: {
      XS: {
        paddingX: ofHeight(3, 8),
        fontSize: "{typography.text-2xs}",
        lineHeight: "{typography.text-2xs--line-height}",
        fontWeight: 600,
        borderRadius: "{radius.sm}",
        borderWidth: "{border.width.thin}",
        height: 0,
        minHeight: "{size.height.XS}",
        paddingY: 2,
        gap: TEXT_TO_VISUAL,
      },
      S: {
        paddingX: ofHeight(3, 8),
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        fontWeight: 600,
        borderRadius: 7,
        borderWidth: "{border.width.thin}",
        height: 0,
        minHeight: "{size.height.S}",
        paddingY: 3,
        gap: TEXT_TO_VISUAL,
      },
      M: {
        paddingX: ofHeight(3, 8),
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        fontWeight: 600,
        borderRadius: 8,
        borderWidth: "{border.width.thin}",
        height: 0,
        minHeight: "{size.height.M}",
        paddingY: 6,
        gap: TEXT_TO_VISUAL,
      },
      L: {
        paddingX: ofHeight(3, 8),
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        fontWeight: 600,
        borderRadius: 9,
        borderWidth: "{border.width.thin}",
        height: 0,
        minHeight: "{size.height.L}",
        paddingY: 9,
        gap: TEXT_TO_VISUAL,
      },
      XL: {
        paddingX: ofHeight(3, 8),
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        fontWeight: 600,
        borderRadius: 10,
        borderWidth: "{border.width.thin}",
        height: 0,
        minHeight: "{size.height.XL}",
        paddingY: 12,
        gap: TEXT_TO_VISUAL,
      },
    },
    structure: {
      archetype: "simple",
      element: "span",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "fit-content",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
      },
    },
  },
  // ADR-912 container shell 3 (2026-06-04): 키를 PascalCase "Body" → lowercase "body" 로 정합.
  //   canonical element.type 은 일관되게 lowercase "body"(elementUtils/pageFrameBinding/App.tsx)
  //   이고 resolveComponentRule 은 type 직접 조회(정규화 없음) → catalog generic 경로의 게이트
  //   type("body")와 일치해야 visual 해소. frame(L2426 lowercase) 선례와 동일 정합. PascalCase
  //   "Body" 키 참조 코드 0건(BodySpec 심볼만 PascalCase, element.type 미사용).
  body: {
    defaultVariant: "default",
    defaultSize: "M",
    // 페이지 body 기본 overflow = auto (스크롤). D3 SSOT 단일 기본값 source — 시스템 페이지
    //   Body factory는 Canvas 스크롤 runtime을 위해 raw overflow:auto만 보존한다. catalog는
    //   패널/Canvas layout fallback을 공급하고 structure mirror가 DOM generated CSS를 공급한다.
    //   overflow는 CONTAINER_STYLES_FALLBACK_KEYS whitelist 멤버다.
    //   (2026-07-21 사용자 요청: 모든 page 기본 overflow=auto, Components 페이지가 visible 이었음)
    containerStyles: {
      overflow: "auto",
      width: "100%",
    },
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.base}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
    },
    sizes: {
      M: {
        fontSize: "{typography.text-md}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    structure: {
      archetype: "default",
      element: "body",
      // DOM generated CSS channel. top-level containerStyles는 Canvas/layout consumer가 읽고,
      // structure mirror는 CSSGenerator가 같은 값을 방출한다.
      containerStyles: {
        overflow: "auto",
        width: "100%",
        // 저작 높이 없는 body 가 페이지 프레임 높이를 채우는 fallback (사용자 결정 2026-09-18:
        //   조건부 `[data-body-viewport-fill] { height: 100vh }` 대신 base 무조건 min-height).
        //   저작 height/minHeight 는 inline 이라 이 값을 덮는다. DOM 채널 전용 — Canvas 는 body
        //   root 를 아트보드 높이로 그린다.
        minHeight: "100%",
        // height 는 두지 않는다 (size 블록 height 0 → 생성 CSS `height: auto`): body 는 최소
        //   페이지 높이에서 내용만큼 자란다 — Chrome 의 body 와 같다. 2026-10-21 의 `height: 100%`
        //   (Compare 모드 definite 높이) 는 세로 flex body 가 넘치는 자식 (overflow 가 visible 이 아닌
        //   Accordion · ListBox …) 을 0 까지 눌러 2026-11-13 사용자 결정으로 뺐다. Canvas 도 같은
        //   모델 — 프레임 = body 그대로, Height 가 없으면 내용만큼 (`compositionRoot` `pageBodySplit`).
      },
      composition: {
        rootSelectors: {},
        delegation: [],
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
      },
    },
  },
  Breadcrumb: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.container}",
            isHovered: "{color.container}",
            isPressed: "{color.container}",
          },
          // S2 `linkStyles` color `neutral-subdued` — a hovered link underlines, its color stays; a
          //   disabled link is `disabled` (no opacity — the current crumb stays `neutral`).
          color: {
            default: "{color.neutral-subdued}",
            isDisabled: "{color.disabled-content}",
          },
        },

        // 현재 페이지 조각 (RAC data-current = 마지막 조각) = S2 `currentStyles` `fontWeight: 'bold'` (700) ·
        //   color `neutral`. Canvas 는 이 값을 읽고, DOM 은 생성 Breadcrumb.css 가 로드되지 않아 손
        //   `Breadcrumbs.css` `.breadcrumb-current` 가 같은 값을 적는다.
        currentTextWeight: 700,

        // 조각 뒤 구분자 = 편집 가능한 Icon 자식 (`slot="separator"`, 사용자 결정 2026-09-29). 기본은 S2 가
        //   그리는 `<ChevronIcon size="M" />` (ui-icons Chevron M — `s2-chevron`), 색은 S2 `chevronStyles`
        //   `neutral` (2026-11-13 S2 구조 — 전에는 lucide `chevron-right` · `neutral-subdued`).
        trailingIcon: {
          name: "s2-chevron",
          color: "{color.neutral}",
        },
      },
    },
    // S2 `Breadcrumbs.tsx` (2026-11-13): iconSize = 구분자 Icon 크기 — S2 는 크기와 관계없이 Chevron M (10,
    //   × `--s2-scale`). gap = label ↔ 구분자 = S2 `chevronStyles` `marginStart: 'text-to-visual'` (6/14 em ·
    //   터치 8/17 em). 조각 사이 간격은 Breadcrumbs.sizes.gap (S2 wrapper gap).
    sizes: {
      S: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 24,
        iconSize: scaled(10),
        gap: TEXT_TO_VISUAL,
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 32,
        iconSize: scaled(10),
        gap: TEXT_TO_VISUAL,
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 40,
        iconSize: scaled(10),
        gap: TEXT_TO_VISUAL,
      },
    },
    structure: {
      archetype: "simple",
      element: "li",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
        pointerEvents: { isDisabled: "none" },
      },
    },
  },
  Breadcrumbs: {
    // S2 `linkStyles` `focusRing()` — a crumb link's keyboard focus box is the outline (2 · offset 2,
    //   `focus-ring` color) around its `sm` corner, and it underlines (`textDecoration.isFocusVisible`)
    //   (2026-11-13 S2 구조 — 전에는 accent `::after` 테두리).
    partStateStyles: {
      "& .breadcrumb-link%": {
        outline: { isFocusVisible: "var(--focus-ring-width) solid var(--focus-ring)" },
        outlineOffset: { isFocusVisible: "2px" },
        textDecoration: { isFocusVisible: "underline" },
      },
    },
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        // (No fill — S2 Breadcrumbs draws none; the composition owns the box, ADR-297 gate.)
        paint: {
          color: {
            default: "{color.neutral-subdued}",
            isHovered: "{color.neutral}",
          },
        },
      },
    },
    // gap = 조각 사이 간격 = S2 wrapper `gap: size(6)` (M) · `size(9)` (L) (× `--s2-scale`). S 는 S2 에 없어
    //   같은 비율 (M × 2/3) 의 4.
    // 글자 = S2 Breadcrumb 링크 `font: controlFont()` (S ui-sm 12 · M ui 14 · L ui-lg 16 — ADR-295 후속).
    // 높이 = S2 Breadcrumbs 항목 `height: controlSize()` (M 32 · L 40 — S 는 control S 24, ADR-295 Phase 3c-3c):
    //   최소 높이 control 토큰 (터치 × 1.25 도 S2 와 같다), 항목은 루트의 `align-items: center` 로 가운데.
    sizes: {
      S: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 0,
        minHeight: "{size.height.S}",
        gap: scaled(4),
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
        minHeight: "{size.height.M}",
        gap: scaled(6),
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
        minHeight: "{size.height.L}",
        gap: scaled(9),
      },
    },
    structure: {
      archetype: "simple",
      element: "nav",
      containerStyles: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "nowrap",
        alignItems: "center",
      },
      // S2 wrapper `marginStart` (M `size(6)` · L `size(9)` — the gap's; S 4 like the gap). A size's
      //   root rule (`catalogContainerVariantRootRules`) — the Canvas start margin, the DOM's device length.
      composition: {
        delegation: [],
        containerVariants: {
          size: {
            S: { styles: { "margin-inline-start": scaledLengthRef(4) } },
            M: { styles: { "margin-inline-start": scaledLengthRef(6) } },
            L: { styles: { "margin-inline-start": scaledLengthRef(9) } },
          },
        },
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
        opacity: { isDisabled: 1 },
        cursor: { isDisabled: "default" },
        pointerEvents: { isDisabled: "auto" },
      },
    },
  },
  Button: {
    // S2 press (`rule/pressScale.ts`): S2 calls `pressScale` on Button · ActionButton · CloseButton · ClearButton
    //   and the field buttons (Picker · ComboBox · DatePicker · NumberField) — not on the RAC Buttons it draws
    //   bare: Disclosure's trigger (S2 `Disclosure.tsx:324`), TreeView's and SideNav's chevron
    //   (`TreeView.tsx:797` · `SideNav.tsx:579`) and the drag handle (`dnd-utils.tsx:120`). Those slots are
    //   excluded here, in one place.
    partStateStyles: {
      "&:not([slot='chevron'], [slot='drag'], [slot='trigger'])%": {
        willChange: CATALOG_PRESS_WILL_CHANGE,
        transform: { isPressed: catalogPressTransform() },
      },
    },
    defaultVariant: "primary",
    defaultSize: "M",
    // top-level containerStyles — Skia layout fallback(resolveContainerStylesFallback 경로 A,
    //   rule.containerStyles 직접 조회) + dirty baseline(resolveCatalogContainerBase line 3 last-wins)
    //   + 스타일 패널 Layout Direction(useLayoutValues specPreset.display) 양쪽이 읽는 단일 layout
    //   정본. structure.containerStyles 는 경로 A 가 못 읽어(top-level 만 조회) Skia 가
    //   INLINE_BLOCK_TAGS("button") → block 으로 자식(Icon/Text)을 세로로 쌓았다(CSS↔Skia 발산,
    //   2026-06-27). display 는 DOM 과 같은 `inline-flex` (ADR-923 Phase 5, 2026-09-02) — 종전
    //   `flex` 는 Direction selector 가 inline-flex 를 block 으로 표시하던 문제의 우회였고 (2026-06-27),
    //   그 표시는 Phase 4 가 패널 판정을 inner 기준(flex | inline-flex)으로 고쳐 해소했다. outer 가
    //   inline 이어야 block 부모 안에서 Button 2 개가 한 줄에 놓인다 (엔진 line box).
    //   gap 은 size 별(sizes[size].gap 4~12px)이라 여기 두지 않음.
    //   justifyContent (ADR-253): 생성 sheet 는 내용을 가운데에 둔다 (`structure.containerStyles`) —
    //   내용보다 넓은 Button (field 의 증감 버튼 · minWidth 가 남는 아이콘 Button) 의 Canvas 자식도 같다.
    containerStyles: BUTTON_INLINE_ROOT_BOX,
    variants: BUTTON_VARIANTS,
    // fontWeight 500 (사용자 결정 2026-09-29 — 버튼 500 · 링크 400): 생성 CSS 는 sizes.fontWeight 만
    //   `font-weight` 로 내보내고 (variant.textWeight 는 Canvas 전용 채널), Canvas 는 textWeight 미선언 시
    //   500 이라 두 소비자가 같은 값이 된다. 안의 Text/Label 자식은 Button 척도를 받았다 (옛 propagationRegistry — 2026-10-05 삭제).
    // minWidth 없음 (사용자 결정 2026-10-14): 2026-08-20 에 넣었던 Spectrum 1 의 "min-width =
    //   2.25 × height" 하한 (XS 45 · S 50 · M 68 · L 95 · XL 122) 을 뺐다 — 설치 S2 1.8.1 `Button.tsx`
    //   에는 min-width 가 없고, paddingX 가 짧은 라벨의 모양을 지킨다. 두 consumer 가 같이 읽던 값이라
    //   생성 CSS `min-width` 와 Canvas `styleOf` 의 min_width 가 함께 사라진다.
    // (A field's own button: its size's corner — `FIELD_BUTTON_CORNERS`; the sizes are S2's pill.)
    containerVariants: { "field-button": FIELD_BUTTON_CORNER_VARIANTS },
    // iconSize = 그 크기 글자의 행간 (ADR-295 Phase 3c — S2 Button 아이콘 `size: '1lh'`: desktop 14 · 16 · 18 · 20 · 22 는
    //   S2 아이콘 단과 같고, 터치는 글자 15 · 17 · 19 · 22 의 행간 18 · 22 · 24 · 26 — × 1.25 가 아니다).
    sizes: BUTTON_SIZES,
    structure: {
      archetype: "button",
      element: "button",
      containerStyles: BUTTON_INLINE_ROOT_BOX,
      stateStyles: {
        ...FIELD_BUTTON_CORNER_STATE,
        boxShadow: {
          isPicker: {
            default: "none",
            isInvalid: `inset 0 0 0 ${PICKER_INVALID_WIDTH}px var(--negative)`,
            isQuiet: {
              default: "none",
              isFocusVisible: `inset 0 -${PICKER_INVALID_WIDTH}px var(--accent)`,
            },
            isDisabled: "none",
          },
        },
        borderWidth: BUTTON_BORDER_WIDTH,
        "--catalog-button-border-width": BUTTON_BORDER_WIDTH,
        paddingTop: BUTTON_PADDING_BLOCK,
        paddingBottom: BUTTON_PADDING_BLOCK,
        ...FOCUS_RING_STATE,
        ...BUTTON_DISABLED_STATE,
        outline: {
          isPicker: { isQuiet: "none" },
          isSearchFieldPart: {
            isFocusVisible: "var(--focus-ring-width) solid var(--focus-ring)",
          },
        },
        outlineOffset: { isSearchFieldPart: "-4px" },
        paddingLeft: { isPicker: { isQuiet: "0" } },
        paddingRight: { isPicker: { isQuiet: "0" } },
      },
      // ADR-297 Phase 3: paint = the variant trees (generated `:where` blocks) — the class stays for
      //   the Skia child-color gate (the Builder chrome ramp is the Builder's own copy — ADR-305 `styles/widgets/utilities.css`).
      buttonBase: true,
      defaultBorder: "color",
      composition: {
        delegation: [],
      },
    },
  },
  ButtonGroup: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
          borderColor: {
            default: "{color.transparent}",
          },
        },
      },
    },
    sizes: {
      XS: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 0,
      },
      S: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 0,
      },
      M: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.md}",
        height: 0,
      },
      L: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.lg}",
        height: 0,
      },
      XL: {
        fontSize: "{typography.text-xl}",
        borderRadius: "{radius.xl}",
        height: 0,
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: { height: "fit-content" },
      stateStyles: {
        opacity: { isDisabled: 0.38 },
      },
    },
  },
  Calendar: {
    // ADR-297 Phase 3g — the day cells' selected · focus (옛 수동 `Calendar.css` · `CalendarCommon.css`).
    partStateStyles: {
      "& .react-aria-CalendarCell%": CALENDAR_CELL_STATE,
      "& .react-aria-CalendarCell%::after": {
        background: { isToday: { isSelected: "var(--fg-on-accent)" } },
      },
    },
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        // (No background, hovered or pressed either — the references paint none, 사용자 2026-10-13
        //   「같이 지워」.)
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
    },
    // 2026-07-07 전수조사 fix: top-level containerStyles 추가 — Calendar 는 spec 삭제(ADR-912
    //   cutover) + structure.composition 부재(archetype "calendar") 라, layout 이
    //   structure.containerStyles(아래)에만 있으면 resolveContainerStylesFallback("calendar") 이
    //   경로 A(top-level rule.containerStyles)·경로 B(structure.composition) 둘 다 미도달 → {}
    //   반환 → 부모 flex-column 에서 align-items:stretch 로 Calendar 가 부모 폭 전체로 stretch
    //   (Skia 350px vs CSS .react-aria-Calendar { width: fit-content } 256px 발산).
    //   TabPanel/Tree 선례처럼 top-level containerStyles 로 승격해 경로 A 가 Skia layout 에 공급.
    //   structure.containerStyles(아래)는 dirty baseline(resolveCatalogContainerBase)용 유지 —
    //   동일값이라 baseline drift 0.
    containerStyles: {
      display: "flex",
      flexDirection: "column",
      width: "fit-content",
      maxWidth: "100%",
    },
    // 사용자 2026-10-13 「RAC, RSC 레퍼런스 모두 border 가 존재하지 않고 padding 도 없다」: RAC
    //   starter `.react-aria-Calendar` · S2 `calendarStyles` 둘 다 border · padding · 배경이 없다 —
    //   picker 안 달력의 여백은 Popover 의 padding (S2 `CalendarPopover` · Popover rule).
    sizes: {
      // ADR-912 단계5 step4 date-color (2026-06-16): paddingY/gap 보강 —
      //   Calendar.spec.ts 삭제 대비 generated Calendar.css(padding NNpx NNpx / gap NNpx) diff-0 유지.
      //   값은 (구) CalendarSpec.sizes 와 동일 (paddingX==paddingY, gap sm:4/md:6/lg:8).
      M: {
        paddingX: 0,
        paddingY: 0,
        gap: 24,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.lg}",
        height: 0,
        iconSize: 26,
      },
    },
    structure: {
      archetype: "calendar",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "column",
        width: "fit-content",
        maxWidth: "100%",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
        ...DISABLED_STATE,
      },
    },
  },
  CalendarGrid: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
          borderColor: {
            default: "{color.transparent}",
          },
        },
      },
    },
    sizes: {
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
        iconSize: 26,
        gap: 0,
      },
    },
  },
  CalendarHeader: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      // ADR-256 Phase 9: the header is a container of nodes (Button[previous] · CalendarHeading ·
      //   Button[next]) — the chevrons are the Buttons' Icon nodes (the old `inline_icon_text`
      //   leadingIcon / trailingIcon are deleted).
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
        },

        textAlign: "center",
      },
      accent: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
        },

        textAlign: "center",
      },
    },
    sizes: {
      // ADR-912 (B+icon): iconSize/gap 은 spec CALENDAR_HEADER_DIMS(sm{20,4}/md{26,6}/lg{32,8}) 동형.
      //   (Phase 9: the nav Button size reads `CALENDAR_HEADER` — manualBoxRules.ts. The calendar has no
      //   size, 2026-10-13: M is its one size.)
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 32,
        iconSize: 26,
        gap: 24,
        paddingX: 0,
      },
    },
    // 2026-07-02: CalendarHeader 는 DOM `<header>`(CalendarCommon.css: display:flex, align-items:center,
    //   Heading flex:1 center)가 이미 flex 컨테이너다. Skia inline_icon_text + DOM `<header>` 양쪽이
    //   동일 layout 을 소비하도록 flex 기본값을 structure.containerStyles baseline 으로 공급 →
    //   Style 패널 Transform/Layout 에 표시되고 편집이 양쪽 동기화(DisclosureHeader 동형). justify-content
    //   space-between = prev chevron 좌 / heading 중앙(flex:1) / next chevron 우. element="header"(시맨틱).
    //   verticalAlign:"middle" = Style 패널 Typography Vertical Align:center 기본값(dirty baseline +
    //   synthetic). Skia inline_icon_text center text 의 실제 세로 중앙 렌더는 primitive text shape 의
    //   verticalAlign:"middle" + specShapeConverter 전달로 처리(structure.containerStyles 는 Skia
    //   primitive 에 직접 안 흐름 — 패널 표시/baseline 전용).
    structure: {
      archetype: "simple",
      element: "header",
      containerStyles: {
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        verticalAlign: "middle",
      },
    },
  },
  // ADR-912 R6 (2026-06-15): Card 본체 S2 재설계 catalog cutover. 구 Card.spec 의 비표준
  //   `isQuiet` boolean 분기(transparent vs layer-2)를 S2 정본 variant 모델(primary/secondary/
  //   tertiary/quiet)로 흡수 — quiet = base transparent. isSelected 2px accent border 는
  //   `selectedBorder: accent`(border 색 전환, ADR-142 §3 데이터 분기)로 대체. 4 variant 의
  //   fill.default 만 다르고 hover/pressed/selected 는 공통(neutral-subtle/accent-subtle).
  //   ToggleButton variant fill 구조 동형. layout(flex/gap/padding)은 factory props.style SSOT
  //   (ADR-907 Layer B) — sizes 의 paddingX/gap 은 DOM base fallback + Skia shell 메트릭.
  Card: {
    // S2 quiet Card: 「Only the preview in quiet cards scales」 (`Card.tsx:510-514` · `:614`).
    partStateStyles: {
      "&% .react-aria-CardPreview": {
        willChange: { variant: { quiet: CATALOG_PRESS_WILL_CHANGE } },
        transform: {
          variant: { quiet: { isPressed: catalogPressTransform() } },
        },
        transition: { variant: { quiet: CATALOG_PRESS_TRANSITION } },
        // ADR-303 (리뷰 m4): S2 `Card.tsx:251` `preview` 스타일 (CardPreview `:609`) — quiet 는 루트가
        //   아니라 미리보기에 hover · focus · selected `elevated`.
        boxShadow: {
          variant: {
            quiet: {
              isHovered: "{shadow.md}",
              isFocusVisible: "{shadow.md}",
              isSelected: "{shadow.md}",
            },
          },
        },
      },
    },
    defaultVariant: "primary",
    defaultSize: "M",
    variants: {
      // primary — 기본 표면(구 spec 의 비-quiet 기본값 보존: layer-2/layer-1/neutral-subtle).
      primary: {
        paint: {
          backgroundColor: {
            // ADR-303 (사용자 결정 1 a): S2 `Card.tsx:94` primary `--s2-container-bg: elevated` 고정 —
            //   hover · focus · selected 는 배경 단이 아니라 그림자 (`structure.stateStyles.boxShadow`).
            default: "{color.elevated}",
            isSelected: {
              default: "{color.accent-subtle}",
            },
          },
          color: {
            default: "{color.neutral}",
            isSelected: {
              default: null,
            },
          },
          borderColor: {
            default: "{color.transparent}",
            isSelected: {
              default: "{color.accent-content}",
            },
          },
        },
      },
      // secondary — 약한 elevation(layer-1 base). S2 secondary 대응.
      secondary: {
        paint: {
          backgroundColor: {
            // ADR-303: S2 `Card.tsx:94` secondary `layer-1` 고정 (그림자는 primary 와 같다).
            default: "{color.layer-1}",
            isSelected: {
              default: "{color.accent-subtle}",
            },
          },
          color: {
            default: "{color.neutral}",
            isSelected: {
              default: null,
            },
          },
          borderColor: {
            default: "{color.transparent}",
            isSelected: {
              default: "{color.accent-content}",
            },
          },
        },
      },
      // tertiary — outline 형(transparent base + 가시 border). S2 tertiary 대응.
      tertiary: {
        paint: {
          backgroundColor: {
            // ADR-303: S2 `Card.tsx:104` tertiary · quiet `transparent` 고정.
            default: "{color.transparent}",
            isSelected: {
              default: "{color.accent-subtle}",
            },
          },
          color: {
            default: "{color.neutral}",
            isSelected: {
              default: null,
            },
          },
          borderColor: {
            // ADR-303: S2 `Card.tsx:117` tertiary 테두리 `gray-100` → hover · focus `gray-200`
            //   (= `neutral-surface` · `neutral-surface-hover`, 두 모드 같은 단). S2 는 box-shadow 2px,
            //   여기는 레이아웃 테두리 1px (`border.width.thin`) — 두께 차이는 ADR-303 breakdown §6.
            default: "{color.neutral-surface}",
            isHovered: "{color.neutral-surface-hover}",
            isFocusVisible: "{color.neutral-surface-hover}",
            isSelected: {
              default: "{color.accent-content}",
            },
          },
        },
      },
      // quiet — 무배경(hover 시만 표시). 구 spec 의 isQuiet=true 흡수.
      quiet: {
        paint: {
          backgroundColor: {
            // ADR-303: S2 `Card.tsx:104` tertiary · quiet `transparent` 고정.
            default: "{color.transparent}",
            isSelected: {
              default: "{color.accent-subtle}",
            },
          },
          color: {
            default: "{color.neutral}",
            isSelected: {
              default: null,
            },
          },
          borderColor: {
            default: "{color.transparent}",
            isSelected: {
              default: "{color.accent-content}",
            },
          },
        },
      },
    },
    sizes: {
      // paddingX=paddingY 균일(구 Card.spec.sizes 보존). layout 실 SSOT 는 factory props.style
      //   (ADR-907 Layer B) — rule padding 은 DOM base fallback + Skia shell 메트릭.
      XS: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        paddingX: 4,
        paddingY: 4,
        gap: 4,
        borderWidth: "{border.width.thin}",
        height: 0,
      },
      S: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        paddingX: 8,
        paddingY: 8,
        gap: 8,
        borderWidth: "{border.width.thin}",
        height: 0,
      },
      M: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        paddingX: 16,
        paddingY: 16,
        gap: 12,
        borderWidth: "{border.width.thin}",
        height: 0,
      },
      L: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        paddingX: 24,
        paddingY: 24,
        gap: 16,
        borderWidth: "{border.width.thin}",
        height: 0,
      },
      XL: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        paddingX: 32,
        paddingY: 32,
        gap: 20,
        borderWidth: "{border.width.thin}",
        height: 0,
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      // 2026-06-24 잔존 catalog 이관 — RSP Card 정본(preview/content/footer 세로 스택)에 맞춰
      //   containerStyles 신설. archetype "default" base CSS 는 display:inline-flex 였는데 factory/
      //   Taffy 는 flex/column → generated CSS(Preview)↔Skia 비대칭(D3 위반)이었음. containerStyles
      //   명시로 generate-css 가 flex/column/width:100% 재생성 → CSS=Skia=factory 3자 정합.
      // overflow 는 두지 않는다 (사용자 결정 2026-11-13): `hidden` 이면 flex item 의 자동 최소 크기가
      //   0 이라, 높이가 정해진 세로 flex 부모 (Height 100% page body) 가 넘칠 때 Card 를 내용보다
      //   작게 눌렀다 (Chrome 과 Canvas 엔진 같은 규칙). 그래서 CardPreview 상단 모서리는 Card 의
      //   radius 로 잘리지 않는다 (2026-06-24 부터 root clip 이 하던 일).
      containerStyles: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        // ADR-171 Phase 3 (2026-07-29): archetype base 가 생성 CSS 에만 emit 하던 값이라
        //   catalog 를 읽는 Skia 에는 안 갔다 (G2 잔존). 실효 DOM 값 그대로 이관 — 값 불변.
        alignItems: "center",
        justifyContent: "center",
      },
      // ADR-223 (2026-09-18): 미지정 archetype base 가 DOM 에만 주던 cursor:pointer 를 generator 전용
      //   rootSelectors 채널에 명시 (Card 는 onPress 를 받는 상호작용 컴포넌트). user-select/transition 은 제거.
      composition: {
        rootSelectors: {
          "&": {
            styles: {
              // S2 Card `textDecoration: 'none'` — a link Card (`href` → RAC Link `<a>`) keeps its
              //   text undecorated (the UA underline would reach every line inside). The Canvas draws
              //   no decoration either.
              "text-decoration": "none",
            },
          },
        },
        // ADR-256 Phase 10 (2026-10-11): S2 Card gives its sections their arrangement and its title ·
        //   description their text (`@react-spectrum/s2/src/Card.tsx` `content` · `footer` · `title` ·
        //   `description` — the Card's `ContentContext` · `FooterContext` · `TextContext`). Content
        //   stacks its title over its description; Footer is the right-aligned action row. Title =
        //   `title` font (bold), description = `body` font; per-size sizes below (desktop scale —
        //   title-xs 12 · title-sm 14 · title 16 · title-lg 18, body-2xs 11 · body-xs 12 · body-sm 14 ·
        //   body 16).
        staticSelectors: {
          // (Its own sections only — `>`: a Content deeper in the Card (an InlineAlert's) keeps its
          //   own arrangement, as the Canvas part rules reach the Card's children only. 판독 M1.)
          "> .react-aria-Content": {
            display: "flex",
            "flex-direction": "column",
            "align-items": "stretch",
          },
          "> .react-aria-Footer": {
            display: "flex",
            "flex-direction": "row",
            "align-items": "center",
            "justify-content": "flex-end",
            gap: "4px",
          },
          '.react-aria-Text[slot="title"]': { "font-weight": "700" },
          '.react-aria-Text[slot="description"]': { "font-weight": "400" },
        },
        sizeSelectors: {
          XS: {
            "> .react-aria-Content": { gap: "4px" },
            '.react-aria-Text[slot="title"]': { "font-size": "12px" },
            '.react-aria-Text[slot="description"]': { "font-size": "11px" },
          },
          S: {
            "> .react-aria-Content": { gap: "4px" },
            '.react-aria-Text[slot="title"]': { "font-size": "12px" },
            '.react-aria-Text[slot="description"]': { "font-size": "11px" },
          },
          M: {
            "> .react-aria-Content": { gap: "6px" },
            '.react-aria-Text[slot="title"]': { "font-size": "14px" },
            '.react-aria-Text[slot="description"]': { "font-size": "12px" },
          },
          L: {
            "> .react-aria-Content": { gap: "6px" },
            '.react-aria-Text[slot="title"]': { "font-size": "16px" },
            '.react-aria-Text[slot="description"]': { "font-size": "14px" },
          },
          XL: {
            "> .react-aria-Content": { gap: "8px" },
            '.react-aria-Text[slot="title"]': { "font-size": "18px" },
            '.react-aria-Text[slot="description"]': { "font-size": "16px" },
          },
        },
        delegation: [],
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
        ...DISABLED_STATE,
        // (ADR-297 Phase 3b: the interactive pointer — was `rootSelectors["&"]`, after the state blocks)
        cursor: { default: "pointer", isDisabled: "not-allowed" },
        // S2 `Card.tsx:464` — a pressable card (link · CardView item) presses; a quiet card's preview
        //   presses instead (`partStateStyles`). A standalone `div` card has no press (S2 too).
        willChange: {
          default: CATALOG_PRESS_WILL_CHANGE,
          variant: { quiet: "auto" },
        },
        transform: {
          isPressed: {
            default: catalogPressTransform(),
            variant: { quiet: "none" },
          },
        },
        transition: CATALOG_PRESS_TRANSITION,
        // ADR-303 (사용자 결정 1 a): S2 `Card.tsx:111` — `emphasized` (= `{shadow.sm}`) → hover · focus ·
        //   selected `elevated` (= `{shadow.md}`); tertiary 는 테두리 (paint), quiet 는 CardPreview 그림자.
        boxShadow: {
          default: "{shadow.sm}",
          isHovered: "{shadow.md}",
          isFocusVisible: "{shadow.md}",
          isSelected: "{shadow.md}",
          variant: { tertiary: "none", quiet: "none" },
        },
      },
    },
  },
  Content: {
    defaultSize: "M",
    variants: {},
    sizes: {
      XS: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      S: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      M: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      L: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      XL: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    structure: {
      archetype: "simple",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "column",
        // ADR-171 Phase 6 2b: CardPreview 와 같은 사유 — archetype base 의 center 를 덮는다.
        alignItems: "stretch",
        width: "100%",
        // (ADR-256 Phase 10: its gap is its owner's — the Card rule's `sizeSelectors`.)
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
      },
    },
  },
  Footer: {
    defaultSize: "M",
    variants: {},
    sizes: {
      XS: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      S: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      M: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      L: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      XL: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    structure: {
      archetype: "simple",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
        // (ADR-256 Phase 10: its alignment and gap are its owner's — the Card rule's
        //   `staticSelectors`. A Card's footer has no top padding of its own — the template's inline
        //   `paddingTop: 8px` was removed, user 2026-10-25 「footer 에 paddingtop:8px 기본값 제거」.)
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
      },
    },
  },
  CardPreview: {
    defaultSize: "M",
    variants: {},
    sizes: {
      XS: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      S: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      M: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      L: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      XL: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    structure: {
      archetype: "simple",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "column",
        // ADR-171 Phase 6 2b: alignItems 는 archetype "simple" base 가 생성 CSS 에만 center 를
        //   emit 하던 값이라 catalog(=Skia)에는 없었다 — 2a 로 CSS 채널이 열리자 DOM center ↔
        //   Skia stretch 잠재 발산이 됐다. 채널이 끊겨 있던 동안의 두 소비자 실효값(stretch)을
        //   명시해 base 를 덮는다. Phase 3 이 Card 본체에 한 처방과 동형.
        alignItems: "stretch",
        width: "100%",
        // origin 인라인에서 이관 (3자 대조: 인라인 = 실효 DOM = 이 값)
        overflow: "hidden",
        // height: "fit-content" 는 **이관 불가** — 생성기 `emitContainerStyles` allowlist 에
        //   `height` 키가 없어 DOM 에 안 실린다(ADR-171 은 Generator 스키마를 확장하지 않는다).
        //   catalog 에 두면 Skia 만 받아 역방향 발산이 되므로 인라인에 남긴다.
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
      },
    },
  },
  CardView: {
    defaultVariant: "primary",
    defaultSize: "M",
    variants: {
      // S2 1.8.0 값 정렬 (2026-10-10): primary · secondary · tertiary · quiet — view 상자는
      //   전부 투명 (S2 CardView 는 variant 를 안의 Card 로 전달한다 — resolver 가 채운다).
      primary: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
      secondary: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
      tertiary: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
      quiet: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
    },
    sizes: {
      XS: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: "auto",
      },
      XL: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: "auto",
      },
      S: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: "auto",
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: "auto",
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: "auto",
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: undefined,
      stateStyles: {
        opacity: { isDisabled: 0.38 },
      },
    },
  },
  Checkbox: {
    // ADR-297 Phase 3g — the indicator box's states (옛 수동 `Checkbox.css` — specificity 순서를 트리 순서로:
    //   selected < invalid < disabled < pressed < selected·pressed < invalid·pressed). RAC 는 상태를 CheckboxButton
    //   (`label`) 에 싣는다. 선택 색은 root 의 `--selected-color` (emphasized 가 정한다 — 수동 sheet).
    partStateStyles: {
      "& .react-aria-CheckboxButton%": { color: TOGGLE_LABEL },
      "& .react-aria-CheckboxButton% .checkbox": CHECKBOX_BOX_STATE,
      "& .react-aria-CheckboxButton% .checkbox svg": {
        strokeDashoffset: { isSelected: 44, isIndeterminate: 44 },
        visibility: {
          default: "hidden",
          isSelected: "visible",
          isIndeterminate: "visible",
        },
      },
    },
    defaultVariant: "default",
    defaultSize: "M",
    // ADR-912 단계 5 step 2: replace-primitive(checkbox indicator) measurement 를 generic
    //   (buildCatalogShapes) 으로 전환하기 위해 label fontWeight 를 rule variant 에 명시한다.
    //   Checkbox.spec.render.shapes 의 label text 는 fontWeight 미emit(→ 측정 fallback 400)
    //   이고 실제 label(자식 Label element)도 400 이므로, generic 측정의 fallback 500 과의
    //   drift 를 차단하려면 variant.textWeight=400 이 필요하다 (Badge 는 spec/generic 둘 다 500
    //   이라 불필요 — Checkbox/Radio/Switch 만 명시). textWeight 는 ComponentRuleVariant 필드.
    variants: {
      default: {
        paint: {
          backgroundColor: CHECKBOX_BOX_STATE.background,
          borderColor: CHECKBOX_BOX_STATE.borderColor,
          color: TOGGLE_LABEL,
        },
        textWeight: 400,
      },
      emphasized: {
        paint: {
          backgroundColor: CHECKBOX_BOX_STATE.background,
          borderColor: CHECKBOX_BOX_STATE.borderColor,
          color: TOGGLE_LABEL,
        },
        textWeight: 400,
      },
    },
    sizes: {
      // ADR-912 단계5 step4 toggle-indicator 그룹 (2026-06-16): Checkbox.spec 삭제 대비 gap/paddingX/
      //   paddingY 보강 (Checkbox.css size 별 gap 6/8/10 + padding 0px 0px 정합). indicator(boxSize/
      //   boxRadius)는 generated CSS 미emit(수동/React) → rule 불요.
      // indicator 채널 배선 + xl (2026-08-21, design-data 감사 §1-3): Skia `checkbox` primitive 는
      //   size.indicator.{boxSize,boxRadius} 를 읽으나 catalog 부재로 전 size 20px 고정이었다
      //   (DOM Checkbox.css --cb-box-size 16/20/24 와 비대칭).
      // ADR-295 Phase 3c-2b: 상자 = S2 `controlSize('sm')` 14 · 16 · 18 · 20 (토큰 — 터치 × 1.25) · 모서리
      //   4 · 4 · 5 · 5 (`CHECKBOX_RADIUS` — DOM 은 `CHECKBOX_INDICATOR_SELECTORS`).
      S: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 0,
        paddingX: 0,
        paddingY: 0,
        gap: TEXT_TO_CONTROL,
        indicator: {
          boxSize: "{size.height-sm.S}",
          boxRadius: CHECKBOX_RADIUS.S,
        },
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
        paddingX: 0,
        paddingY: 0,
        gap: TEXT_TO_CONTROL,
        indicator: {
          boxSize: "{size.height-sm.M}",
          boxRadius: CHECKBOX_RADIUS.M,
        },
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
        paddingX: 0,
        paddingY: 0,
        gap: TEXT_TO_CONTROL,
        indicator: {
          boxSize: "{size.height-sm.L}",
          boxRadius: CHECKBOX_RADIUS.L,
        },
      },
      XL: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
        paddingX: 0,
        paddingY: 0,
        gap: TEXT_TO_CONTROL,
        indicator: {
          boxSize: "{size.height-sm.XL}",
          boxRadius: CHECKBOX_RADIUS.XL,
        },
      },
    },
    // ADR-256 Phase 3 (2026-10-08): 레퍼런스 `CheckboxField > CheckboxButton (indicator + 글자) + Description +
    //   FieldError`. 이 rule 의 요소는 RAC `CheckboxField` (`div`) — 누르는 자리 · 도움말 · 오류를 세로로 둔다
    //   (size 의 gap 이 그 사이). indicator · 글자의 행 (종전 이 요소의 inline-flex 행 · size 별 gap) 은
    //   `.react-aria-CheckboxButton` 블록으로 옮겼다 — 같은 gap 값 (`--cb-button-gap`, sizes 파생). focus 표시는
    //   RAC 가 `data-focus-visible` 을 주는 CheckboxButton 의 것.
    structure: {
      archetype: "toggle-indicator",
      element: "div",
      // (A box taller than its content keeps the row vertically centered, as the old row's
      //   `align-items: center` did — `justify-content` on the column.)
      containerStyles: {
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
      },
      stateStyles: {
        cursor: { isDisabled: "not-allowed" },
      },
      composition: {
        staticSelectors: {
          ".react-aria-CheckboxButton": {
            display: "inline-flex",
            "align-items": "center",
            gap: "var(--cb-button-gap)",
          },
        },
        rootSelectors: CHECKBOX_INDICATOR_SELECTORS,
        delegation: [
          {
            // 행 gap — 크기별 gap 을 root 에 `--cb-button-gap` 으로 (sizes 파생, `variables: "auto"`).
            childSelector: ".react-aria-CheckboxButton",
            prefix: "cb-button",
            variables: "auto",
            autoKeys: ["gap"],
          },
        ],
      },
    },
  },
  CheckboxGroup: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        // ADR-297 Phase 3 닫힘 — 묶음 컨테이너는 상자를 칠하지 않는다 (S2 그대로). 생성 CSS 는 composition 이
        //   상자를 가진 rule 의 variant 칠을 내지 않아 DOM 은 투명이었고, Canvas 만 트리의 바탕 · 테두리를 그렸다.
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: TOGGLE_GROUP_LABEL,
        },
      },
    },
    sizes: {
      // ADR-912 단계5 step4 small-B (2026-06-16): gap 보강 — spec 삭제 후 generated CSS root `gap: Npx`
      //   재생성용 (CheckboxGroup.spec.sizes 미러). 자식 .checkbox-items gap 은 composition
      //   containerVariants.size 의 --cb-items-gap 별도 경로. padding 미emit(ownsContainerBox).
      S: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: 8,
      },
      M: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: 12,
      },
      L: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: 16,
      },
      // xl (2026-08-21, design-data 감사 §1-3): Checkbox xl 채택 동반 — RadioGroup xl(gap 20) 미러.
      XL: {
        fontSize: "{typography.text-xl}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: 20,
      },
    },
    // ADR-912 단계5 step4 (2026-06-17): CheckboxGroup.spec.composition.containerVariants 의
    //   label-position:side Skia 복구 — spec 삭제(91c2be0dd) 시 resolveActiveContainerVariants 가
    //   spec-only 라 side variant(flex-direction:row) 가 Skia layout 에서 회귀했다(side variant
    //   test FAIL). catalog fallback 메커니즘 + 본 필드로 복구. CSS 변수(--cb-items-gap)/orientation
    //   nested 는 DOM generated CSS 전용(Skia 무관)이라 이관 제외 — Skia 가 읽는 styles 만.
    // 2026-10-10: side 는 S2 `field()` 의 grid (`auto 1fr`) — structure.composition 의 side 블록 거울.
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            display: "grid",
            "grid-template-columns": "auto minmax(0, 1fr)",
            "align-items": "start",
          },
        },
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: {
        display: "flex",
      },
      // S2는 그룹 전체를 흐리게 하지 않는다. 상태 색상은 각 부품이 소비한다.
      stateStyles: {
        color: TOGGLE_GROUP_LABEL,
        cursor: { isDisabled: "default" },
      },
      composition: {
        layout: "flex-column",
        gap: "var(--spacing-xs)",
        containerStyles: {
          color: "var(--fg)",
          "--cb-items-gap": "12px",
        },
        containerVariants: {
          size: {
            S: {
              styles: {
                "--cb-items-gap": "8px",
              },
            },
            L: {
              styles: {
                "--cb-items-gap": "16px",
              },
            },
          },
          "label-position": {
            side: {
              styles: {
                display: "grid",
                "grid-template-columns": "auto minmax(0, 1fr)",
                "align-items": "start",
              },
              // side 라벨 열 (2026-10-10 사용자 「모든 field · picker 컴퍼넌트 Label Position - Side 의 label width 가
              //   fit content 가 아니다 — slider 와 같은 패턴」): S2 `field()` (`style-utils.ts`) 처럼 grid —
              //   `auto 1fr` 두 열, 라벨은 1열 (글자 폭), 입력칸 · 도움말 · 오류 문구는 2열 (도움말이 입력칸 아래 같은 x).
              //   라벨 세로 위치: S2 는 baseline (입력칸 글자와 같은 줄) — 엔진에 grid baseline 이 없어 입력칸
              //   행의 가운데 (한 줄 입력칸에서 같은 자리). 그룹 (CheckboxGroup · RadioGroup) 은 위 — 첫 항목 줄.
              //   종전엔 라벨이 176px 고정 열이었다. side Form 은 안의 field 에 `--form-label-width` 를 주어
              //   라벨 열을 맞춘다 (S2 subgrid). Form 밖에서는 변수가 없고 top Form 은 auto — 글자 폭.
              //   text-align 은 `--form-label-align`(label-align variant 또는 Form 상속) 소비.
              //   자식 결합자(`>`)로 한정 — DatePicker popover 안 Calendar 라벨까지 매칭 방지.
              nested: [
                {
                  selector: "> .react-aria-Label",
                  styles: {
                    "grid-column": "1",
                    width: "var(--form-label-width)",
                    "text-align": "var(--form-label-align, start)",
                    "justify-content": "var(--form-label-align, start)",
                  },
                },
                {
                  selector:
                    '> :not(.react-aria-Label, .react-aria-FieldError, [slot="description"])',
                  styles: {
                    "grid-column": "2",
                    "min-width": "0",
                  },
                },
                {
                  selector: "> .react-aria-FieldError",
                  styles: {
                    "grid-column": "2",
                  },
                },
                {
                  selector: '> [slot="description"]',
                  styles: {
                    "grid-column": "2",
                  },
                },
              ],
            },
          },
          // S2 labelAlign (2026-10-09): the side label column's text alignment — the label's
          //   `text-align: var(--form-label-align, start)` above reads it (as the fields' block).
          "label-align": {
            end: {
              styles: {
                "--form-label-align": "end",
              },
            },
          },
          orientation: {
            vertical: {
              nested: [
                {
                  selector: ".checkbox-items",
                  styles: {
                    display: "flex",
                    "flex-direction": "column",
                    gap: "var(--cb-items-gap, var(--spacing-md))",
                  },
                },
              ],
            },
            horizontal: {
              nested: [
                {
                  selector: ".checkbox-items",
                  styles: {
                    display: "flex",
                    "flex-direction": "row",
                    "align-items": "center",
                    gap: "var(--cb-items-gap, var(--spacing-md))",
                  },
                },
              ],
            },
          },
        },
        delegation: [],
      },
    },
  },
  Code: {
    defaultVariant: "default",
    defaultSize: "S",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.neutral-subtle}",
            isHovered: "{color.neutral-subtle}",
            isPressed: "{color.neutral-pressed}",
          },
          color: {
            default: "{color.neutral}",
          },
        },

        // ADR-912 위험군 해소(2026-06-04): Code catalog 측정/렌더 drift 차단. spec render.shapes
        //   fontFamily.mono + fontWeight 400 ↔ buildCatalogShapes fallback sans/500.
        //   rule fontFamily(mono) + textWeight(400) 명시(buildCatalogShapes visual.fontFamily 읽음).
        fontFamily: "JetBrains Mono, Consolas, monospace",

        textWeight: 400,
      },
    },
    sizes: {
      XS: {
        paddingX: 4,
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.xs}",
        height: 18,
      },
      S: {
        paddingX: 6,
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.sm}",
        height: 22,
      },
      M: {
        paddingX: 8,
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.sm}",
        height: 26,
      },
      L: {
        paddingX: 10,
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.md}",
        height: 32,
      },
    },
    structure: {
      archetype: "simple",
      element: "code",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
      },
    },
  },
  // ADR-258 Phase 2: the area is RAC's gradient (`color_area_fill` — the Canvas paints the same
  //   layers, `colorAreaGradient`); the rule paints no box of its own. The box · disabled paint are the
  //   former manual `ColorArea.css` values (사용자 결정 2 — 지금 값 그대로).
  ColorArea: {
    defaultSize: "M",
    variants: {},
    sizes: {
      S: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: scaled(192),
        iconSize: 14,
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: scaled(192),
        iconSize: 18,
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: scaled(192),
        iconSize: 22,
      },
    },
    structure: {
      archetype: "container",
      element: "div",
      // (RAC 의 상태 표시는 rootSelectors 가 정본 — 기본 ring · disabled opacity 없음.)
      skipStateStyles: true,
      composition: {
        delegation: [],
        // S2 ColorArea `size: 192` · `minSize: 64` (`ColorArea.tsx` — 정사각, size 축 없음, ADR-295 Phase 3c-3c — 전 100% × 180).
        containerStyles: {
          width: scaledLengthRef(192),
          height: scaledLengthRef(192),
          "min-width": scaledLengthRef(64),
          "min-height": scaledLengthRef(64),
          "border-radius": "var(--radius-md)",
          "flex-shrink": "0",
          contain: "layout style",
          "touch-action": "none",
        },
        rootSelectors: {
          "&[data-disabled] .react-aria-ColorThumb": {
            styles: { background: "gray !important" },
          },
        },
      },
      stateStyles: {
        // ADR-297 Phase 3c (was `rootSelectors["&[data-disabled]"]` — the Canvas reads it too, `colorControlParts`)
        background: { isDisabled: "gray !important" },
      },
    },
  },
  ColorField: {
    defaultSize: "M",
    defaultVariant: "default",
    variants: { default: { paint: { color: TOGGLE_GROUP_LABEL } } },
    // gap = S2 `--field-gap` (높이 − 행간) / 2 · fontSize = S2 field 글자 (XS 2xs … XL lg — ADR-295 Phase 3c-3b
    //   ③ 까지 한 단 위였다, 3c-3c 에서 S2 로).
    sizes: {
      // ADR-912 단계5 step4 small-B (2026-06-16): gap 보강 — spec 삭제 후 generated CSS `gap: Npx`
      //   재생성용 (ColorField.spec.sizes 미러). padding 은 composition.layout=flex-column root
      //   ownsContainerBox → 미emit 이라 보강 불요(gap 만).
      XS: {
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.sm}",
        height: 0,
        gap: centerPadding("XS"),
        iconSize: 18,
      },
      S: {
        fontSize: "{typography.text-xs}",
        borderRadius: 7,
        height: 0,
        gap: centerPadding("S"),
        iconSize: 20,
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: 8,
        height: 0,
        gap: centerPadding("M"),
        iconSize: 26,
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: 9,
        height: 0,
        gap: centerPadding("L"),
        iconSize: 32,
      },
      XL: {
        fontSize: "{typography.text-lg}",
        borderRadius: 10,
        height: 0,
        gap: centerPadding("XL"),
        iconSize: 36,
      },
    },
    // ADR-913 후속 fix (2026-06-19): label-position:side 를 grid → flex-row 로 통일 (DateField/
    //   TimeField/TextField/NumberField/SearchField/TextArea 동형). field family side SSOT 일원화
    //   (generate-css.ts STRUCTURE_META 도 동시 flex-row 전환). Skia sideMode 트리거 styles 만.
    // 2026-10-10: side 는 S2 `field()` 의 grid (`auto 1fr`) — structure.composition 의 side 블록 거울.
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            display: "grid",
            "grid-template-columns": "auto minmax(0, 1fr)",
            "align-items": "start",
          },
        },
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: undefined,
      stateStyles: {
        color: TOGGLE_GROUP_LABEL,
        cursor: { isDisabled: "default" },
      },
      composition: {
        // ADR-259 Phase 2: the S2 prefix in the control Group (`FIELD_PREFIX_*`).
        staticSelectors: { ...FIELD_PREFIX_STATIC },
        sizeSelectors: { ...FIELD_PREFIX_SIZES },
        // layout:flex-column (2026-10-07, 사용자 지시 「ColorField 레퍼런스에 맞춰」): RSP · RAC 의
        //   ColorField 는 라벨 위 · 입력칸 · 도움말 아래 (TextField 와 같은 field 배치). 2026-06-23 의
        //   flex-row 는 Label · hex 입력 · ColorSwatch 를 한 줄에 두는 옛 factory 모양이었고, 지금
        //   template 에는 ColorSwatch 가 없다 (Label · Input · Description · FieldError).
        layout: "flex-column",
        gap: "var(--spacing-xs)",
        containerStyles: {
          width: "100%",
          color: "var(--fg)",
        },
        containerVariants: {
          "label-position": {
            side: {
              styles: {
                display: "grid",
                "grid-template-columns": "auto minmax(0, 1fr)",
                "align-items": "start",
              },
              // side 라벨 열 (2026-10-10 사용자 「모든 field · picker 컴퍼넌트 Label Position - Side 의 label width 가
              //   fit content 가 아니다 — slider 와 같은 패턴」): S2 `field()` (`style-utils.ts`) 처럼 grid —
              //   `auto 1fr` 두 열, 라벨은 1열 (글자 폭), 입력칸 · 도움말 · 오류 문구는 2열 (도움말이 입력칸 아래 같은 x).
              //   라벨 세로 위치: S2 는 baseline (입력칸 글자와 같은 줄) — 엔진에 grid baseline 이 없어 입력칸
              //   행의 가운데 (한 줄 입력칸에서 같은 자리). 그룹 (CheckboxGroup · RadioGroup) 은 위 — 첫 항목 줄.
              //   종전엔 라벨이 176px 고정 열이었다. side Form 은 안의 field 에 `--form-label-width` 를 주어
              //   라벨 열을 맞춘다 (S2 subgrid). Form 밖에서는 변수가 없고 top Form 은 auto — 글자 폭.
              //   text-align 은 `--form-label-align`(label-align variant 또는 Form 상속) 소비.
              //   자식 결합자(`>`)로 한정 — DatePicker popover 안 Calendar 라벨까지 매칭 방지.
              nested: [
                {
                  selector: "> .react-aria-Label",
                  styles: {
                    "grid-column": "1",
                    width: "var(--form-label-width)",
                    "align-self": "center",
                    "text-align": "var(--form-label-align, start)",
                    "justify-content": "var(--form-label-align, start)",
                  },
                },
                {
                  selector:
                    '> :not(.react-aria-Label, .react-aria-FieldError, [slot="description"])',
                  styles: {
                    "grid-column": "2",
                    "min-width": "0",
                  },
                },
                {
                  selector: "> .react-aria-FieldError",
                  styles: {
                    "grid-column": "2",
                  },
                },
                {
                  selector: '> [slot="description"]',
                  styles: {
                    "grid-column": "2",
                  },
                },
              ],
            },
          },
          "label-align": {
            end: {
              styles: {
                "--form-label-align": "end",
              },
            },
          },
        },
        // (2026-10-25 사용자 요청 「colorfield (origin) - input 의 maxWidth 12 → auto」: 입력칸의 size 별
        //   최대 폭 (`--cf-input-max-width` 9 · 10 · 12 · 14 · 16ch delegation) 을 뺐다 — Input 은 field 폭을 채운다.)
        delegation: [],
      },
    },
  },
  ColorPicker: {
    defaultVariant: "default",
    defaultSize: "M",
    // RAC ColorPicker 는 자기 요소가 없다 (자식에게 색 context 만 준다 — react-aria.adobe.com
    //   ColorPicker). composition 의 DOM shell 도 상자를 그리지 않는다 (`ColorPicker.css` —
    //   `background: none; border: none`). 종전 variant 칠 (바탕 base · layer-2 + 테두리) 은
    //   Canvas 만 그려 1px 테두리가 Preview 와 갈렸다 (2026-10-12) → 세 variant 모두 투명.
    //   variant 이름은 남긴다 — S2 · RAC 에 없는 `variant` 의 존폐는 조사 §4.2 F 묶음 결정.
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
          borderColor: {
            default: "{color.transparent}",
          },
        },
      },
    },
    sizes: {
      S: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.md}",
        height: 0,
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.lg}",
        height: 0,
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.xl}",
        height: 0,
      },
    },
  },
  // ADR-258 Phase 2: RAC's reference tree `ColorSlider > Label + SliderOutput + SliderTrack >
  //   ColorThumb` — the grid (label · output over the track) and the track's box are this rule's (the
  //   former manual `ColorSlider.css` values, 사용자 결정 2); the track's gradient is RAC's
  //   (`color_slider_track` on the Canvas). The rule paints no box of its own.
  ColorSlider: {
    defaultSize: "M",
    variants: {},
    containerStyles: {
      display: "grid",
      gridTemplateAreas: '"label output" "track track"',
      gridTemplateColumns: "1fr auto",
      width: scaledLengthRef(192),
    },
    sizes: {
      S: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: 4,
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: 4,
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: 4,
      },
    },
    structure: {
      archetype: "container",
      element: "div",
      // (RAC 의 상태 표시는 rootSelectors 가 정본 — 기본 ring · disabled opacity 없음.)
      skipStateStyles: true,
      composition: {
        delegation: [],
        containerStyles: {
          display: "grid",
          "grid-template-areas": '"label output" "track track"',
          "grid-template-columns": "1fr auto",
          gap: "4px",
          width: scaledLengthRef(192),
          contain: "layout style",
        },
        staticSelectors: {
          ".react-aria-Label": { "grid-area": "label" },
          ".react-aria-SliderOutput": { "grid-area": "output" },
          ".react-aria-SliderTrack": { "grid-area": "track" },
        },
        // (`[data-orientation]` on both: the track's own sheet sizes it per `data-size` — these
        //  win by the attribute.) S2 `ColorSlider.tsx`: 가로 폭 · 세로 높이 192, 트랙 두께 24 — 모두 `size()`
        //  (터치 × 1.25) → `scaled`. 최대 폭은 없다 (전 300). 폭은 위 containerStyles (orientation 을 적지
        //  않은 노드도 가로다 — 변형 블록은 prop 이 있어야 Canvas 가 고른다), 세로는 폭을 풀고 (S2 block) 높이만.
        containerVariants: {
          orientation: {
            horizontal: {
              nested: [
                {
                  selector: ".react-aria-SliderTrack",
                  styles: {
                    width: "100%",
                    height: scaledLengthRef(24),
                    "border-radius": "var(--radius-md)",
                    "touch-action": "none",
                  },
                },
              ],
            },
            vertical: {
              styles: {
                width: "auto",
                height: scaledLengthRef(192),
                display: "block",
              },
              nested: [
                {
                  selector: ".react-aria-Label",
                  styles: { display: "none" },
                },
                {
                  selector: ".react-aria-SliderOutput",
                  styles: { display: "none" },
                },
                {
                  selector: ".react-aria-SliderTrack",
                  styles: {
                    width: scaledLengthRef(24),
                    height: "100%",
                    "border-radius": "var(--radius-md)",
                  },
                },
              ],
            },
          },
        },
        // The thumb sits on the track's middle across it (RAC places it along); the disabled paint.
        rootSelectors: {
          '&[data-orientation="horizontal"] .react-aria-ColorThumb': {
            styles: { top: "50%" },
          },
          '&[data-orientation="vertical"] .react-aria-ColorThumb': {
            styles: { left: "50%" },
          },
          "&[data-disabled] .react-aria-SliderTrack": {
            styles: { background: "gray !important" },
          },
          "&[data-disabled] .react-aria-ColorThumb": {
            styles: { background: "gray !important", opacity: "0.5" },
          },
        },
      },
    },
  },
  ColorSwatch: {
    defaultVariant: "default",
    defaultSize: "M",
    // S2 1.8.0 ColorSwatch `rounding` (2026-10-10): default → sm · none → 0 · full → 원 (S2 ColorSwatch.tsx
    //   borderRadius) — base (size 블록) 는 S2 기본 `default` 의 {radius.sm} (ADR-295 후속 2026-10-31, 전
    //   {radius.full}). Canvas 가 읽는 top-level 변형이다
    //   (`rulePaint.ts` containerVariantPaint); DOM 은 수동 `ColorSwatch.css` 의 `[data-rounding]`
    //   블록이 같은 값을 적는다. structure.composition 에 두면 `catalogSizeAxisSkip` 의
    //   ownsContainerBox 가 뒤집혀 per-size height 공급이 끊긴다 (live 실측 2×2 — CheckboxGroup
    //   의 top-level 선례와 같은 배치).
    containerVariants: {
      rounding: {
        default: { styles: { "border-radius": "var(--radius-sm)" } },
        none: { styles: { "border-radius": "0" } },
        full: { styles: { "border-radius": "var(--radius-full)" } },
      },
    },
    variants: {
      default: {
        // ADR-297 Phase 3d — a selected swatch keeps its fill and takes the accent ring (was the `selected`
        //   variant the Canvas swapped in for `isSelected`).
        paint: {
          backgroundColor: {
            default: "{color.base}",
            isHovered: "{color.layer-2}",
            isPressed: "{color.layer-1}",
          },
          color: {
            default: "{color.neutral}",
          },
          borderColor: {
            default: "{color.border}",
            isSelected: "{color.accent-content}",
          },
        },
      },
    },
    sizes: {
      // ADR-295 후속: 상자 = S2 `ColorSwatch.tsx` `size` (XS 16 · S 24 · M 32 · L 40 — rem × `--s2-scale`, 터치 × 1.25) → `scaled`.
      // 모서리 = S2 `rounding` 기본 `default` 의 sm (ADR-295 후속 2026-10-31 — 전에는 2026-06-22 reference 의 원형
      //   {radius.full}). `rounding: full` 은 변형 블록이 원으로 (Skia 는 `min(w,h)/2` clamp).
      XS: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: scaled(16),
      },
      S: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: scaled(24),
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.sm}",
        height: scaled(32),
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.sm}",
        height: scaled(40),
      },
    },
    structure: {
      archetype: "simple",
      element: "div",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
        ...DISABLED_STATE,
      },
      // Preview ColorSwatchPicker 항목 틀 = swatch 상자 (2026-09-25 Preview 확인). RAC `ColorSwatchPickerItem` 은 block
      //   div 이고 swatch 는 inline-flex 라 줄 상자 (line-height 24 + baseline 아래 여백) 가 생겨 항목이 28 → 35 로 커졌다
      //   — picker 줄바꿈 2 행이 Canvas 보다 7px 아래. flex 로 두면 swatch 가 flex item 이 되어 줄 상자가 없다 (origin style 의
      //   `display: inline-flex` 인라인도 blockify). Canvas 는 swatch 를 picker 의 직접 자식으로 쌓는다 (항목 틀 없음).
      composition: {
        delegation: [],
        externalStyles: [
          {
            selector:
              ".react-aria-ColorSwatchPicker > .react-aria-ColorSwatchPickerItem",
            styles: { display: "flex" },
          },
        ],
      },
    },
  },
  ColorSwatchPicker: {
    // ADR-297 Phase 3g — the swatch items' focus · selected ring (옛 수동 `ColorSwatchPicker.css` — 생성 sheet 가 없는
    //   rule 이라 상태 블록만 담은 `generated/ColorSwatchPicker.css`).
    partStateStyles: {
      "& .react-aria-ColorSwatchPickerItem%": {
        outline: { isFocusVisible: "2px solid var(--focus-ring)" },
        outlineOffset: { isFocusVisible: "2px" },
      },
      "& .react-aria-ColorSwatchPickerItem%::after": {
        content: { isSelected: '""' },
        position: { isSelected: "absolute" },
        inset: { isSelected: "0" },
        border: { isSelected: "2px solid black" },
        outline: { isSelected: "2px solid white" },
        outlineOffset: { isSelected: "-4px" },
        borderRadius: { isSelected: "inherit" },
      },
    },
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
        alpha: 0,
      },
    },
    sizes: {
      XS: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 0,
        iconSize: scaled(16),
      },
      S: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.md}",
        height: 0,
        iconSize: scaled(24),
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.lg}",
        height: 0,
        iconSize: scaled(32),
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.xl}",
        height: 0,
        iconSize: scaled(40),
      },
    },
  },
  // ADR-258 Phase 2: the handle of a ColorArea · ColorSlider · ColorWheel (RAC ColorThumb) — its
  //   color is RAC's (the displayed color, inline); its box · ring · shadow · focus size are the
  //   former manual sheets' (사용자 결정 2). The Canvas reads the same declarations
  //   (`catalogColorThumbRing` → `color_thumb`).
  ColorThumb: {
    defaultSize: "M",
    variants: {},
    sizes: {
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.full}",
        height: scaled(16),
      },
    },
    structure: {
      archetype: "container",
      element: "div",
      // (RAC 의 상태 표시는 rootSelectors 가 정본 — 기본 ring · disabled opacity 없음.)
      skipStateStyles: true,
      composition: {
        delegation: [],
        containerStyles: {
          border: "4px solid var(--bg-inset)",
          "box-shadow": "var(--shadow-sm)",
          width: scaledLengthRef(16),
          height: scaledLengthRef(16),
          "border-radius": "50%",
          "box-sizing": "border-box",
          "will-change": "transform",
        },
        rootSelectors: {},
      },
      stateStyles: {
        // ADR-297 Phase 3c — the keyboard-focused thumb grows (was `rootSelectors["&[data-focus-visible]"]`)
        width: { isFocusVisible: "{length.size.unit*32/1}" },
        height: { isFocusVisible: "{length.size.unit*32/1}" },
      },
    },
  },
  // ADR-258 Phase 2: RAC's reference tree `ColorWheel > ColorWheelTrack + ColorThumb` — the ring is
  //   the ColorWheelTrack (RAC's conic sweep, `color_wheel_track` on the Canvas). The rule paints no
  //   box of its own; the disabled paint is the former manual `ColorWheel.css` values.
  ColorWheel: {
    defaultSize: "M",
    variants: {},
    // S2 1.8.0 ColorWheel `size` (2026-10-10): 지름은 숫자 prop 하나다 (S2 — size enum 아님).
    //   size 블록의 height 는 content-fit(0) 으로 두고, 지름 기본 192 · 고리 24 (S2) 와 175 floor 는
    //   `catalogColorWheelDiameter` (resolveCatalogRuleCanvasBox.ts) 가 Canvas (`styleOf`) · DOM
    //   (`domBinding` RAC outerRadius/innerRadius + 상자 width/height) 양쪽에 공급한다.
    sizes: {
      S: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.full}",
        height: 0,
        iconSize: 14,
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.full}",
        height: 0,
        iconSize: 18,
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.full}",
        height: 0,
        iconSize: 22,
      },
    },
    structure: {
      archetype: "container",
      element: "div",
      // (RAC 의 상태 표시는 rootSelectors 가 정본 — 기본 ring · disabled opacity 없음.)
      skipStateStyles: true,
      composition: {
        delegation: [],
        // (The box is the diameter square — `domBinding` inline · `styleOf`.)
        containerStyles: {},
        rootSelectors: {
          "&[data-disabled] .react-aria-ColorWheelTrack": {
            styles: { background: "gray !important" },
          },
          "&[data-disabled] .react-aria-ColorThumb": {
            styles: { background: "gray !important", opacity: "0.5" },
          },
        },
      },
    },
  },
  // ADR-258 Phase 2: a ColorWheel's ring (RAC ColorWheelTrack — RAC sizes · paints · clips it).
  ColorWheelTrack: {
    defaultSize: "M",
    variants: {},
    sizes: {
      M: {
        fontSize: "{typography.text-sm}",
        height: 0,
      },
    },
  },
  ComboBox: {
    defaultSize: "M",
    defaultVariant: "default",
    variants: { default: { paint: { color: TOGGLE_GROUP_LABEL } } },
    // ADR-912 단계5 step4 (2026-06-17): ComboBoxSpec.spec 삭제 대비 — generate-css virtual emit 이
    //   base/size block 의 `gap: Npx` 를 byte-identical 재현하려면 gap 필수(Select 동형). paddingY 는
    //   미보충(padding 은 composition.delegation .combobox-container --combo-container-padding 가 담당).
    sizes: {
      XS: {
        paddingX: 4,
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.xs}",
        height: 0,
        iconSize: "{size.icon.XS}",
        gap: centerPadding("XS"),
      },
      S: {
        paddingX: 8,
        fontSize: "{typography.text-xs}",
        borderRadius: 7,
        height: 0,
        iconSize: "{size.icon.S}",
        gap: centerPadding("S"),
      },
      M: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        borderRadius: 8,
        height: 0,
        iconSize: "{size.icon.M}",
        gap: centerPadding("M"),
      },
      L: {
        paddingX: 16,
        fontSize: "{typography.text-base}",
        borderRadius: 9,
        height: 0,
        iconSize: "{size.icon.L}",
        gap: centerPadding("L"),
      },
      XL: {
        paddingX: 24,
        fontSize: "{typography.text-lg}",
        borderRadius: 10,
        height: 0,
        iconSize: "{size.icon.XL}",
        gap: centerPadding("XL"),
      },
    },
    // ADR-913 slice 2 (2026-06-18): label-position:side Skia 복구 — DateField/TimeField 동형
    //   (flex-direction:row). ADR-912 단계5 step4 누락분(measure gap[4]). generated
    //   ComboBox.css:326-329 side 블록과 byte-identical. Skia sideMode 트리거 styles 만.
    // 2026-10-10: side 는 S2 `field()` 의 grid (`auto 1fr`) — structure.composition 의 side 블록 거울.
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            display: "grid",
            "grid-template-columns": "auto minmax(0, 1fr)",
            "align-items": "start",
          },
        },
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      stateStyles: {
        color: TOGGLE_GROUP_LABEL,
        cursor: { isDisabled: "default" },
      },
      composition: {
        // ADR-259 Phase 2: the S2 prefix in the control Group (`FIELD_PREFIX_*`).
        staticSelectors: { ...FIELD_PREFIX_STATIC },
        sizeSelectors: { ...FIELD_PREFIX_SIZES },
        layout: "flex-column",
        gap: "var(--spacing-xs)",
        containerStyles: {
          // 2026-07-15: field 패밀리 root width catalog 정본 (fieldFamilyWidthContract.test.ts).
          //   패널 Transform width = toStr(inline, specDefault, "auto") 이고 specDefault 가 이 값 →
          //   부재 시 "auto" 로 떨어진다 (DatePicker 적발 지점).
          width: "100%",
          color: "var(--fg)",
        },
        containerVariants: {
          "label-position": {
            side: {
              styles: {
                display: "grid",
                "grid-template-columns": "auto minmax(0, 1fr)",
                "align-items": "start",
              },
              // side 라벨 열 (2026-10-10 사용자 「모든 field · picker 컴퍼넌트 Label Position - Side 의 label width 가
              //   fit content 가 아니다 — slider 와 같은 패턴」): S2 `field()` (`style-utils.ts`) 처럼 grid —
              //   `auto 1fr` 두 열, 라벨은 1열 (글자 폭), 입력칸 · 도움말 · 오류 문구는 2열 (도움말이 입력칸 아래 같은 x).
              //   라벨 세로 위치: S2 는 baseline (입력칸 글자와 같은 줄) — 엔진에 grid baseline 이 없어 입력칸
              //   행의 가운데 (한 줄 입력칸에서 같은 자리). 그룹 (CheckboxGroup · RadioGroup) 은 위 — 첫 항목 줄.
              //   종전엔 라벨이 176px 고정 열이었다. side Form 은 안의 field 에 `--form-label-width` 를 주어
              //   라벨 열을 맞춘다 (S2 subgrid). Form 밖에서는 변수가 없고 top Form 은 auto — 글자 폭.
              //   text-align 은 `--form-label-align`(label-align variant 또는 Form 상속) 소비.
              //   자식 결합자(`>`)로 한정 — DatePicker popover 안 Calendar 라벨까지 매칭 방지.
              nested: [
                {
                  selector: "> .react-aria-Label",
                  styles: {
                    "grid-column": "1",
                    width: "var(--form-label-width)",
                    "align-self": "center",
                    "text-align": "var(--form-label-align, start)",
                    "justify-content": "var(--form-label-align, start)",
                  },
                },
                {
                  selector:
                    '> :not(.react-aria-Label, .react-aria-FieldError, [slot="description"])',
                  styles: {
                    "grid-column": "2",
                    "min-width": "0",
                  },
                },
                {
                  selector: "> .react-aria-FieldError",
                  styles: {
                    "grid-column": "2",
                  },
                },
                {
                  selector: '> [slot="description"]',
                  styles: {
                    "grid-column": "2",
                  },
                },
              ],
            },
          },
          "label-align": {
            end: {
              styles: {
                "--form-label-align": "end",
              },
            },
          },
        },
        externalStyles: [
          {
            // The reference's picker popover has no padding of its own (RAC `.combobox-popover`
            //   `padding: 0` · S2 `<Popover padding="none">`): the list's padding is the inset. It
            //   beats the Popover size's padding (`[data-size]`); (The Builder document no longer
            //   loads this sheet — ADR-305; `[data-catalog-id]` scopes it to document nodes.)
            selector:
              '.react-aria-Popover[data-trigger="ComboBox"][data-catalog-id]',
            styles: { padding: "0" },
          },
          {
            selector: '.react-aria-Popover[data-trigger="ComboBox"]',
            styles: {
              width: "var(--trigger-width)",
              "max-width": "none",
              "max-height": "300px",
              overflow: "auto",
              "box-sizing": "border-box",
              contain: "layout style",
            },
            nested: [
              {
                selector: ".react-aria-ListBox",
                styles: {
                  border: "none",
                  background: "transparent",
                  "max-height": "none",
                  "min-height": "24px",
                },
              },
            ],
          },
        ],
        // ADR-253: the container only places its parts. The value is an instance of the Input origin (it
        //   draws the box, with room for the button on its end side) and the button is an instance of
        //   the FieldButton origin, laid over that room.
        delegation: [
          {
            childSelector: ".combobox-container",
            bridges: {
              display: "flex",
              "align-items": "center",
              width: "100%",
            },
          },
          {
            // The button's room: the Input's own inline padding + the button's width.
            childSelector: ".react-aria-Input",
            prefix: "combo-input",
            variables: {
              XS: {
                "--combo-input-pad-end":
                  "{length.size.height.XS*3/16+size.field-button.XS*1/1+typography.text-2xs*10/14-2}",
              },
              S: {
                "--combo-input-pad-end":
                  "{length.size.height.S*3/16+size.field-button.S*1/1+typography.text-xs*10/14-2}",
              },
              M: {
                "--combo-input-pad-end":
                  "{length.size.height.M*3/16+size.field-button.M*1/1+typography.text-sm*10/14-2}",
              },
              L: {
                "--combo-input-pad-end":
                  "{length.size.height.L*3/16+size.field-button.L*1/1+typography.text-base*10/14-2}",
              },
              XL: {
                "--combo-input-pad-end":
                  "{length.size.height.XL*3/16+size.field-button.XL*1/1+typography.text-lg*10/14-2}",
              },
            },
            bridges: {
              "min-width": "0",
              "padding-right": "var(--combo-input-pad-end)",
            },
          },
          {
            // A square inside the control (2px in at xs · sm, 4px from md), over the Input's end. The square
            //   is S2's field button (`{size.field-button.<S>}` — ComboBox · DatePicker `inputButton` S 16 ·
            //   M 20 · L 24 · XL 32, the touch set × 1.25 — ADR-295 Phase 3c-2); the offset and the Input's
            //   end room follow it (the builder pins the pre-295 squares, where they give the pre-295 lengths).
            childSelector: ".react-aria-Button",
            prefix: "combo-btn",
            // (2026-11-09: S2 ComboBox `paddingEnd: height × 3/16 − border 2` — the button ends height × 3/16
            //   from the box's outer edge. The old `+1` matched the Input's 1px border before 3ca03f661.)
            variables: {
              XS: {
                "--combo-btn-size": "var(--catalog-token-size-field-button-XS)",
                "--combo-btn-offset":
                  "{length.size.field-button.XS*-1/1+size.height.XS*-3/16}",
              },
              S: {
                "--combo-btn-size": "var(--catalog-token-size-field-button-S)",
                "--combo-btn-offset":
                  "{length.size.field-button.S*-1/1+size.height.S*-3/16}",
              },
              M: {
                "--combo-btn-size": "var(--catalog-token-size-field-button-M)",
                "--combo-btn-offset":
                  "{length.size.field-button.M*-1/1+size.height.M*-3/16}",
              },
              L: {
                "--combo-btn-size": "var(--catalog-token-size-field-button-L)",
                "--combo-btn-offset":
                  "{length.size.field-button.L*-1/1+size.height.L*-3/16}",
              },
              XL: {
                "--combo-btn-size": "var(--catalog-token-size-field-button-XL)",
                "--combo-btn-offset":
                  "{length.size.field-button.XL*-1/1+size.height.XL*-3/16}",
              },
            },
            bridges: {
              flex: "0 0 auto",
              width: "var(--combo-btn-size)",
              height: "var(--combo-btn-size)",
              // ADR-295 Phase 3: a field button (S2 — not a Button) does not take the Button's S2
              //   min-height (`{size.height.<S>}`) — its square is this size (placement, as `height`).
              "min-height": "0",
              "min-width": "0",
              "margin-inline-start": "var(--combo-btn-offset)",
            },
          },
        ],
      },
    },
  },
  DateField: {
    // ADR-912 단계5 step4 (2026-06-17): DateField.spec.ts 삭제 — gap 은 base/size block byte-identical
    //   (composition flex-column → CSSGenerator size.gap emit), intrinsicHeight 는 layout-only
    //   (CSS 미emit, utils.ts calculateContentHeight datefield 분기가 resolveSkiaRule read-through).
    defaultSize: "M",
    // (2026-11-09: the TextField root's color tree — a disabled field's Label takes the disabled color
    //   (Canvas `catalogToggleButtonGlyphOwner` · DOM inherit), not a dim.)
    defaultVariant: "default",
    variants: { default: { paint: { color: TOGGLE_GROUP_LABEL } } },
    sizes: {
      S: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: centerPadding("S"),
        intrinsicHeight: 32,
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: centerPadding("M"),
        intrinsicHeight: 40,
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: centerPadding("L"),
        intrinsicHeight: 48,
      },
      XL: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: centerPadding("XL"),
        intrinsicHeight: 62,
      },
    },
    // ADR-912 단계5 step4 (2026-06-17): DateField.spec.composition.containerVariants 의
    //   label-position:side Skia 복구 — spec 삭제 회귀. DatePicker/TimeField 동형
    //   (flex-direction:row). resolveActiveContainerVariants 가 spec→catalog fallback 으로 읽음.
    //   Skia sideMode 트리거 styles 만.
    // 2026-10-10: side 는 S2 `field()` 의 grid (`auto 1fr`) — structure.composition 의 side 블록 거울.
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            display: "grid",
            "grid-template-columns": "auto minmax(0, 1fr)",
            "align-items": "start",
          },
        },
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: {
        display: "flex",
      },
      stateStyles: {
        // (2026-11-09: no disabled dim — S2 fields paint disabled colors (the box part · Label), as TextField.
        //   No root ring either — S2 rings the box (`FieldGroup`), and RAC DatePicker · DateRangePicker set the
        //   root's `data-focus-visible` with `within: true`, so a root ring outlined the whole field.)
      },
      composition: {
        layout: "flex-column",
        gap: "var(--spacing-xs)",
        containerStyles: {
          // 2026-07-15: field 패밀리 root width catalog 정본 (fieldFamilyWidthContract.test.ts).
          //   패널 Transform width = toStr(inline, specDefault, "auto") 이고 specDefault 가 이 값 →
          //   부재 시 "auto" 로 떨어진다 (DatePicker 적발 지점).
          width: "100%",
        },
        containerVariants: {
          "label-position": {
            side: {
              styles: {
                display: "grid",
                "grid-template-columns": "auto minmax(0, 1fr)",
                "align-items": "start",
              },
              // side 라벨 열 (2026-10-10 사용자 「모든 field · picker 컴퍼넌트 Label Position - Side 의 label width 가
              //   fit content 가 아니다 — slider 와 같은 패턴」): S2 `field()` (`style-utils.ts`) 처럼 grid —
              //   `auto 1fr` 두 열, 라벨은 1열 (글자 폭), 입력칸 · 도움말 · 오류 문구는 2열 (도움말이 입력칸 아래 같은 x).
              //   라벨 세로 위치: S2 는 baseline (입력칸 글자와 같은 줄) — 엔진에 grid baseline 이 없어 입력칸
              //   행의 가운데 (한 줄 입력칸에서 같은 자리). 그룹 (CheckboxGroup · RadioGroup) 은 위 — 첫 항목 줄.
              //   종전엔 라벨이 176px 고정 열이었다. side Form 은 안의 field 에 `--form-label-width` 를 주어
              //   라벨 열을 맞춘다 (S2 subgrid). Form 밖에서는 변수가 없고 top Form 은 auto — 글자 폭.
              //   text-align 은 `--form-label-align`(label-align variant 또는 Form 상속) 소비.
              //   자식 결합자(`>`)로 한정 — DatePicker popover 안 Calendar 라벨까지 매칭 방지.
              nested: [
                {
                  selector: "> .react-aria-Label",
                  styles: {
                    "grid-column": "1",
                    width: "var(--form-label-width)",
                    "align-self": "center",
                    "text-align": "var(--form-label-align, start)",
                    "justify-content": "var(--form-label-align, start)",
                  },
                },
                {
                  selector:
                    '> :not(.react-aria-Label, .react-aria-FieldError, [slot="description"])',
                  styles: {
                    "grid-column": "2",
                    "min-width": "0",
                  },
                },
                {
                  selector: "> .react-aria-FieldError",
                  styles: {
                    "grid-column": "2",
                  },
                },
                {
                  selector: '> [slot="description"]',
                  styles: {
                    "grid-column": "2",
                  },
                },
              ],
            },
          },
          "label-align": {
            end: {
              styles: {
                "--form-label-align": "end",
              },
            },
          },
        },
        delegation: [
          // ADR-253: 입력 상자는 DateInput 원본의 instance 다 — 상자 · 크기 단계 · 상태 · 조각은 DateInput
          //   rule 의 것이고, field 는 배치만 한다 (폭 · 크기별 최소 폭).
          {
            childSelector: ".react-aria-DateInput",
            prefix: "df-input",
            variables: {
              XS: {
                "--df-input-min-width": "100px",
              },
              S: {
                "--df-input-min-width": "120px",
              },
              M: {
                "--df-input-min-width": "150px",
              },
              L: {
                "--df-input-min-width": "180px",
              },
              XL: {
                "--df-input-min-width": "220px",
              },
            },
            bridges: {
              width: "100%",
              "min-width": "var(--df-input-min-width)",
            },
          },
        ],
      },
    },
  },
  DateInput: {
    defaultVariant: "default",
    defaultSize: "M",
    // (2026-11-09) S2 DateField draws its box with the same `FieldGroup` as TextField
    //   (`@react-spectrum/s2` src/DateField.tsx · Field.tsx `fieldGroupStyles`) — the Input rule's paint.
    variants: {
      default: {
        paint: {
          backgroundColor: "{color.base}",
          color: FIELD_INPUT_CONTENT,
          borderColor: FIELD_INPUT_BORDER,
        },
      },
      accent: {
        paint: {
          backgroundColor: "{color.base}",
          color: FIELD_INPUT_CONTENT,
          borderColor: {
            ...FIELD_INPUT_BORDER,
            default: "{color.accent-content}",
          },
        },
      },
      negative: {
        paint: {
          backgroundColor: "{color.base}",
          color: FIELD_INPUT_CONTENT,
          borderColor: {
            ...FIELD_INPUT_BORDER,
            default: "{color.selection-negative}",
          },
        },
      },
    },
    // ADR-253: DateInput 은 날짜 field 의 입력 상자 부품이다 (DateField · TimeField · DatePicker 가 그 원본의
    //   instance 를 쓴다). 크기 단계는 Input rule 과 같다 — 한 form 안의 입력 상자가 같은 높이 · padding ·
    //   모서리를 갖는다. 높이는 내용 (줄 높이 + padding + border) 이다.
    sizes: {
      XS: {
        fontSize: "{typography.text-2xs}",
        lineHeight: "{typography.text-2xs--line-height}",
        borderRadius: "{radius.xs}",
        borderWidth: "{border.width.thick}",
        height: 0,
        minHeight: "{size.height.XS}",
        paddingX: ofHeight(3, 8),
        paddingY: 1,
      },
      S: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: 7,
        borderWidth: "{border.width.thick}",
        height: 0,
        minHeight: "{size.height.S}",
        paddingX: ofHeight(3, 8),
        paddingY: 2,
      },
      M: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: 8,
        borderWidth: "{border.width.thick}",
        height: 0,
        minHeight: "{size.height.M}",
        paddingX: ofHeight(3, 8),
        paddingY: 5,
      },
      L: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: 9,
        borderWidth: "{border.width.thick}",
        height: 0,
        minHeight: "{size.height.L}",
        paddingX: ofHeight(3, 8),
        paddingY: 8,
      },
      XL: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: 10,
        borderWidth: "{border.width.thick}",
        height: 0,
        minHeight: "{size.height.XL}",
        paddingX: ofHeight(3, 8),
        paddingY: 11,
      },
    },
    // 자기 stylesheet (ADR-253): 상자 · 크기 단계 · 상태 (hover · focus-within · invalid · disabled) 와 그 안의
    //   RAC 조각 (`DateSegment`) 을 이 rule 이 그린다. 부모 rule 은 배치만 한다. 상태 표시는 Input 과 같다
    //   (hover 는 테두리색, focus-within 은 진한 테두리색 — S2 `FieldGroup`).
    structure: {
      archetype: "input-base",
      element: "div",
      containerStyles: {
        display: "inline-flex",
        width: "100%",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
        opacity: { isDisabled: 1 },
        cursor: { isDisabled: "not-allowed" },
        pointerEvents: { isDisabled: "none" },
        // ADR-297 Phase 3c — the box's own states (was `rootSelectors` `&[data-*]`). Order = priority: hover,
        //   invalid, then focus (invalid wins inside it), quiet last. (3h — S2 `field`: invalid beats hover; the
        //   old sheet let hover win by specificity, 0-4-0 over 0-2-0. 사용자 결정 2 · breakdown §6.1 #6.)
        // (2026-11-09: the Input rule's S2 `FieldGroup` states — focus within darkens the border; the
        //   keyboard ring is `FOCUS_RING_STATE`. Was: an accent 2px outline over a 1px `--border` box.)
        background: { isQuiet: "transparent" },
        borderColor: { ...FIELD_INPUT_BORDER_STATES, isQuiet: "transparent" },
        boxShadow: { isQuiet: "none" },
        borderRadius: { isQuiet: "0" },
        borderBottom: { isQuiet: "1px solid var(--neutral-outline)" },
        borderBottomColor: { isQuiet: FIELD_INPUT_BORDER },
      },
      composition: {
        rootSelectors: {
          "&": {
            styles: {
              "white-space": "nowrap",
              "forced-color-adjust": "none",
              transition: "border-color 200ms ease, color 200ms ease",
            },
          },
        },
        delegation: [
          // RAC 조각: 글자 크기 · 줄 높이는 DateInput 의 것을 상속한다.
          {
            childSelector: ".react-aria-DateSegment",
            bridges: {
              padding: "0 2px",
              border: "none",
              background: "transparent",
              height: "auto",
              "font-variant-numeric": "tabular-nums",
              "text-align": "end",
              color: "var(--fg)",
              "border-radius": "var(--radius-xs)",
              transition: "all 150ms ease",
            },
            states: {
              '[data-type="literal"]': {
                padding: "0",
              },
              "[data-placeholder]": {
                color: "var(--fg-muted)",
                opacity: "0.6",
              },
              ":focus": {
                color: "var(--fg)",
                background: "var(--accent-subtle)",
                outline: "none",
                "border-radius": "var(--radius-xs)",
                "caret-color": "transparent",
              },
              "[data-invalid]": {
                color: "var(--negative)",
              },
              "[data-invalid]:focus": {
                background: "var(--negative)",
                color: "var(--color-white)",
              },
              "[data-disabled]": {
                color: "color-mix(in srgb, var(--fg) 38%, transparent)",
                cursor: "not-allowed",
              },
            },
          },
        ],
      },
    },
  },
  DatePicker: {
    defaultSize: "M",
    // (2026-11-09: the TextField root's color tree — a disabled field's Label takes the disabled color
    //   (Canvas `catalogToggleButtonGlyphOwner` · DOM inherit), not a dim.)
    defaultVariant: "default",
    variants: { default: { paint: { color: TOGGLE_GROUP_LABEL } } },
    // ADR-912 단계5 step4 (2026-06-17): gap 보강 — spec.sizes(DATE_PICKER_SIZES) 의 gap 을 rule 로 이관
    //   (DatePicker.spec 삭제 시 virtual STRUCTURE_META 가 rule.sizes 에서 gap emit). Calendar/Section 동일 패턴.
    // height 키 제거 (2026-06-23): DatePicker 는 컨테이너(Label 행 + gap + 입력 box[Group>DateInput]
    //   + Calendar)라 height 는 자식 합산 auto(md=54) 여야 한다 — CSS preview 동일(.react-aria-DatePicker
    //   height 미지정 → 54). 기존 height(30) 는 입력 box height 인 척하던 잘못된 결합으로, 입력 box height 는
    //   입력 box (field 의 control Group, 옛 SelectTrigger — ADR-256 Phase 6b) 안 부품의 높이로 정해진다. Select/ComboBox/NumberField/SearchField 가 TRACK_HEIGHT_TYPES 로 패널 height 축 제외된 것과 동형.
    // iconSize = 그 크기의 글자 크기 (ADR-295 Phase 3c — S2 DatePicker 달력 아이콘은 글자 상자 `1em`: 12 · 14 · 16 · 18).
    sizes: {
      XS: {
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.xs}",
        iconSize: "{typography.text-2xs}",
        gap: centerPadding("XS"),
      },
      S: {
        fontSize: "{typography.text-xs}",
        borderRadius: 7,
        iconSize: "{typography.text-xs}",
        gap: centerPadding("S"),
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: 8,
        iconSize: "{typography.text-sm}",
        gap: centerPadding("M"),
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: 9,
        iconSize: "{typography.text-base}",
        gap: centerPadding("L"),
      },
      XL: {
        fontSize: "{typography.text-lg}",
        borderRadius: 10,
        iconSize: "{typography.text-lg}",
        gap: centerPadding("XL"),
      },
    },
    // ADR-912 단계5 step4 (2026-06-17): DatePicker.spec.composition.containerVariants 의
    //   label-position:side Skia 복구 — spec 삭제(daaae6b82) 회귀. TagGroup/Checkbox 동형
    //   (flex-direction:row, Group 보정은 datepicker 분기 별도). Skia sideMode 트리거 styles 만.
    // 2026-10-10: side 는 S2 `field()` 의 grid (`auto 1fr`) — structure.composition 의 side 블록 거울.
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            display: "grid",
            "grid-template-columns": "auto minmax(0, 1fr)",
            "align-items": "start",
          },
        },
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: {
        display: "flex",
      },
      stateStyles: {
        // (2026-11-09: no disabled dim — S2 fields paint disabled colors (the box part · Label), as TextField.
        //   No root ring either — S2 rings the box (`FieldGroup`), and RAC DatePicker · DateRangePicker set the
        //   root's `data-focus-visible` with `within: true`, so a root ring outlined the whole field.)
      },
      composition: {
        layout: "flex-column",
        gap: "var(--spacing-xs)",
        containerStyles: {
          // 2026-07-15: field 패밀리 root width catalog 정본 (fieldFamilyWidthContract.test.ts).
          //   패널 Transform width = toStr(inline, specDefault, "auto") 이고 specDefault 가 이 값 →
          //   부재 시 "auto" 로 떨어진다 (DatePicker 적발 지점).
          width: "100%",
          color: "var(--fg)",
        },
        containerVariants: {
          "label-position": {
            side: {
              styles: {
                display: "grid",
                "grid-template-columns": "auto minmax(0, 1fr)",
                "align-items": "start",
              },
              // side 라벨 열 (2026-10-10 사용자 「모든 field · picker 컴퍼넌트 Label Position - Side 의 label width 가
              //   fit content 가 아니다 — slider 와 같은 패턴」): S2 `field()` (`style-utils.ts`) 처럼 grid —
              //   `auto 1fr` 두 열, 라벨은 1열 (글자 폭), 입력칸 · 도움말 · 오류 문구는 2열 (도움말이 입력칸 아래 같은 x).
              //   라벨 세로 위치: S2 는 baseline (입력칸 글자와 같은 줄) — 엔진에 grid baseline 이 없어 입력칸
              //   행의 가운데 (한 줄 입력칸에서 같은 자리). 그룹 (CheckboxGroup · RadioGroup) 은 위 — 첫 항목 줄.
              //   종전엔 라벨이 176px 고정 열이었다. side Form 은 안의 field 에 `--form-label-width` 를 주어
              //   라벨 열을 맞춘다 (S2 subgrid). Form 밖에서는 변수가 없고 top Form 은 auto — 글자 폭.
              //   text-align 은 `--form-label-align`(label-align variant 또는 Form 상속) 소비.
              //   자식 결합자(`>`)로 한정 — DatePicker popover 안 Calendar 라벨까지 매칭 방지.
              nested: [
                {
                  selector: "> .react-aria-Label",
                  styles: {
                    "grid-column": "1",
                    width: "var(--form-label-width)",
                    "align-self": "center",
                    "text-align": "var(--form-label-align, start)",
                    "justify-content": "var(--form-label-align, start)",
                  },
                },
                {
                  selector:
                    '> :not(.react-aria-Label, .react-aria-FieldError, [slot="description"])',
                  styles: {
                    "grid-column": "2",
                    "min-width": "0",
                  },
                },
                {
                  selector: "> .react-aria-FieldError",
                  styles: {
                    "grid-column": "2",
                  },
                },
                {
                  selector: '> [slot="description"]',
                  styles: {
                    "grid-column": "2",
                  },
                },
              ],
            },
          },
          "label-align": {
            end: {
              styles: {
                "--form-label-align": "end",
              },
            },
          },
        },
        externalStyles: [
          {
            selector: '.react-aria-Popover[data-trigger="DatePicker"]',
            styles: {
              width: "fit-content",
              "max-width": "unset",
            },
            nested: [
              {
                // The picker's Popover holds its calendar directly (ADR-256 Phase 6e — no Dialog, as the
                //   reference): the Popover is the frame, the calendar's own box stays off.
                selector: ".react-aria-Calendar",
                styles: {
                  background: "transparent",
                  border: "none",
                  padding: "0",
                },
              },
            ],
          },
          {
            selector: ".react-aria-DatePicker-time-field",
            styles: {
              width: "100%",
            },
          },
        ],
        delegation: [
          // ADR-253: Group 은 배치만 한다. 상자는 DateInput 원본의 instance 가 그리고 (Group 을 채운다 — 끝 쪽
          //   padding 이 버튼 자리), 버튼은 FieldButton 원본의 instance 가 그 끝에 겹친다 (ComboBox 와 같은 배치).
          {
            childSelector: ".react-aria-Group",
            bridges: {
              display: "flex",
              "align-items": "center",
              width: "100%",
            },
          },
          {
            childSelector: ".react-aria-DateInput",
            prefix: "dp-input",
            variables: {
              XS: {
                "--dp-input-pad-end":
                  "{length.size.field-button.XS*1/1+typography.text-2xs*10/14+2}",
              },
              S: {
                "--dp-input-pad-end":
                  "{length.size.field-button.S*1/1+typography.text-xs*10/14+2}",
              },
              M: {
                "--dp-input-pad-end":
                  "{length.size.field-button.M*1/1+typography.text-sm*10/14+4}",
              },
              L: {
                "--dp-input-pad-end":
                  "{length.size.field-button.L*1/1+typography.text-base*10/14+6}",
              },
              XL: {
                "--dp-input-pad-end":
                  "{length.size.field-button.XL*1/1+typography.text-lg*10/14+6}",
              },
            },
            // (폭은 DateInput 자기 것 — 100%. `flex: 1` 을 주면 버튼의 음수 margin 만큼 Group 밖으로 넘친다.)
            bridges: {
              "min-width": "0",
              "padding-right": "var(--dp-input-pad-end)",
            },
          },
          {
            childSelector: ".react-aria-Button",
            prefix: "dp-btn",
            // (offset = −(button + end inset + the DateInput's border) — 2026-11-09 the border is the S2
            //   `FieldGroup` 2px, so one more than before: the S2 end inset stays inside the border.)
            variables: {
              XS: {
                "--dp-btn-size": "var(--catalog-token-size-field-button-XS)",
                "--dp-btn-offset": "{length.size.field-button.XS*-1/1-4}",
              },
              S: {
                "--dp-btn-size": "var(--catalog-token-size-field-button-S)",
                "--dp-btn-offset": "{length.size.field-button.S*-1/1-4}",
              },
              M: {
                "--dp-btn-size": "var(--catalog-token-size-field-button-M)",
                "--dp-btn-offset": "{length.size.field-button.M*-1/1-6}",
              },
              L: {
                "--dp-btn-size": "var(--catalog-token-size-field-button-L)",
                "--dp-btn-offset": "{length.size.field-button.L*-1/1-8}",
              },
              XL: {
                "--dp-btn-size": "var(--catalog-token-size-field-button-XL)",
                "--dp-btn-offset": "{length.size.field-button.XL*-1/1-8}",
              },
            },
            bridges: {
              flex: "0 0 auto",
              width: "var(--dp-btn-size)",
              height: "var(--dp-btn-size)",
              // ADR-295 Phase 3: a field button (S2 — not a Button) does not take the Button's S2
              //   min-height (`{size.height.<S>}`) — its square is this size (placement, as `height`).
              "min-height": "0",
              "min-width": "0",
              "margin-inline-start": "var(--dp-btn-offset)",
            },
          },
        ],
      },
    },
  },
  DateRangePicker: {
    defaultSize: "M",
    // (2026-11-09: the TextField root's color tree — a disabled field's Label takes the disabled color
    //   (Canvas `catalogToggleButtonGlyphOwner` · DOM inherit), not a dim.)
    defaultVariant: "default",
    variants: { default: { paint: { color: TOGGLE_GROUP_LABEL } } },
    // ADR-912 단계5 step4 (2026-06-17): gap 보강 — spec.sizes(DATE_PICKER_SIZES 공유) 의 gap 이관 (DatePicker 동일).
    // height 키 제거 (2026-06-23): DatePicker 동형 — 컨테이너 height 는 자식 합산 auto, 입력 box height 는
    //   control Group 안 부품의 높이. 상세는 DatePicker entry 주석 참조.
    // iconSize = 그 크기의 글자 크기 (ADR-295 Phase 3c — S2 DateRangePicker 달력 아이콘 `1em`, DatePicker 와 같다).
    sizes: {
      XS: {
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.xs}",
        iconSize: "{typography.text-2xs}",
        gap: centerPadding("XS"),
      },
      S: {
        fontSize: "{typography.text-xs}",
        borderRadius: 7,
        iconSize: "{typography.text-xs}",
        gap: centerPadding("S"),
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: 8,
        iconSize: "{typography.text-sm}",
        gap: centerPadding("M"),
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: 9,
        iconSize: "{typography.text-base}",
        gap: centerPadding("L"),
      },
      XL: {
        fontSize: "{typography.text-lg}",
        borderRadius: 10,
        iconSize: "{typography.text-lg}",
        gap: centerPadding("XL"),
      },
    },
    // ADR-913 slice 2 (2026-06-18): label-position:side Skia 복구 — DatePicker 동형
    //   (flex-direction:row). DatePicker entry 는 containerVariants 보유하나 DateRangePicker 누락
    //   (measure gap[9]/gap[10] — 두 컴포넌트 rule 비대칭). generated DateRangePicker.css:370-373
    //   side 블록과 byte-identical. Skia sideMode 트리거 styles 만 — quiet nested(.react-aria-Group)
    //   는 DOM generated CSS 전용 제외.
    // 2026-10-10: side 는 S2 `field()` 의 grid (`auto 1fr`) — structure.composition 의 side 블록 거울.
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            display: "grid",
            "grid-template-columns": "auto minmax(0, 1fr)",
            "align-items": "start",
          },
        },
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: {
        display: "flex",
      },
      stateStyles: {
        // (2026-11-09: no disabled dim — S2 fields paint disabled colors (the box part · Label), as TextField.
        //   No root ring either — S2 rings the box (`FieldGroup`), and RAC DatePicker · DateRangePicker set the
        //   root's `data-focus-visible` with `within: true`, so a root ring outlined the whole field.)
      },
      composition: {
        layout: "flex-column",
        gap: "var(--spacing-xs)",
        containerStyles: {
          // 2026-07-15: field 패밀리 root width catalog 정본 (fieldFamilyWidthContract.test.ts).
          //   패널 Transform width = toStr(inline, specDefault, "auto") 이고 specDefault 가 이 값 →
          //   부재 시 "auto" 로 떨어진다 (DatePicker 적발 지점).
          width: "100%",
          color: "var(--fg)",
        },
        containerVariants: {
          "label-position": {
            side: {
              styles: {
                display: "grid",
                "grid-template-columns": "auto minmax(0, 1fr)",
                "align-items": "start",
              },
              // side 라벨 열 (2026-10-10 사용자 「모든 field · picker 컴퍼넌트 Label Position - Side 의 label width 가
              //   fit content 가 아니다 — slider 와 같은 패턴」): S2 `field()` (`style-utils.ts`) 처럼 grid —
              //   `auto 1fr` 두 열, 라벨은 1열 (글자 폭), 입력칸 · 도움말 · 오류 문구는 2열 (도움말이 입력칸 아래 같은 x).
              //   라벨 세로 위치: S2 는 baseline (입력칸 글자와 같은 줄) — 엔진에 grid baseline 이 없어 입력칸
              //   행의 가운데 (한 줄 입력칸에서 같은 자리). 그룹 (CheckboxGroup · RadioGroup) 은 위 — 첫 항목 줄.
              //   종전엔 라벨이 176px 고정 열이었다. side Form 은 안의 field 에 `--form-label-width` 를 주어
              //   라벨 열을 맞춘다 (S2 subgrid). Form 밖에서는 변수가 없고 top Form 은 auto — 글자 폭.
              //   text-align 은 `--form-label-align`(label-align variant 또는 Form 상속) 소비.
              //   자식 결합자(`>`)로 한정 — DatePicker popover 안 Calendar 라벨까지 매칭 방지.
              nested: [
                {
                  selector: "> .react-aria-Label",
                  styles: {
                    "grid-column": "1",
                    width: "var(--form-label-width)",
                    "align-self": "center",
                    "text-align": "var(--form-label-align, start)",
                    "justify-content": "var(--form-label-align, start)",
                  },
                },
                {
                  selector:
                    '> :not(.react-aria-Label, .react-aria-FieldError, [slot="description"])',
                  styles: {
                    "grid-column": "2",
                    "min-width": "0",
                  },
                },
                {
                  selector: "> .react-aria-FieldError",
                  styles: {
                    "grid-column": "2",
                  },
                },
                {
                  selector: '> [slot="description"]',
                  styles: {
                    "grid-column": "2",
                  },
                },
              ],
            },
          },
          "label-align": {
            end: {
              styles: {
                "--form-label-align": "end",
              },
            },
          },
        },
        externalStyles: [
          {
            selector: '.react-aria-Popover[data-trigger="DateRangePicker"]',
            styles: {
              width: "fit-content",
              "max-width": "unset",
            },
            nested: [
              {
                // The picker's Popover holds its calendar directly (ADR-256 Phase 6e — no Dialog, as the
                //   reference): the Popover is the frame, the calendar's own box stays off.
                selector: ".react-aria-RangeCalendar",
                styles: {
                  background: "transparent",
                  border: "none",
                  padding: "0",
                },
              },
            ],
          },
          {
            selector: ".react-aria-DateRangePicker-start-time",
            styles: {
              width: "100%",
            },
          },
          {
            selector: ".react-aria-DateRangePicker-end-time",
            styles: {
              width: "100%",
            },
          },
        ],
        delegation: [
          {
            childSelector: ".react-aria-Group",
            prefix: "drp-group",
            variables: {
              XS: {
                "--drp-group-radius": "var(--radius-xs)",
                "--drp-group-min-height":
                  "var(--catalog-token-drp-group-min-height, var(--catalog-token-size-height-XS))",
                "--drp-group-pad-y": "1px",
                "--drp-group-pad-start": "{length.size.height.XS*3/8}",
                "--drp-group-pad-end": "4px",
                "--drp-group-font-size": "var(--text-2xs)",
                "--drp-group-line-height": "var(--text-2xs--line-height)",
                "--drp-group-gap": "var(--spacing-2xs)",
              },
              S: {
                "--drp-group-radius": "7px",
                "--drp-group-min-height":
                  "var(--catalog-token-drp-group-min-height, var(--catalog-token-size-height-S))",
                "--drp-group-pad-y": "1px",
                "--drp-group-pad-start": "{length.size.height.S*3/8}",
                "--drp-group-pad-end": "4px",
                "--drp-group-font-size": "var(--text-xs)",
                "--drp-group-line-height": "var(--text-xs--line-height)",
                "--drp-group-gap": "var(--spacing-xs)",
              },
              M: {
                "--drp-group-radius": "8px",
                "--drp-group-min-height":
                  "var(--catalog-token-drp-group-min-height, var(--catalog-token-size-height-M))",
                "--drp-group-pad-y": "3px",
                "--drp-group-pad-start": "{length.size.height.M*3/8}",
                "--drp-group-pad-end": "4px",
                "--drp-group-font-size": "var(--text-sm)",
                "--drp-group-line-height": "var(--text-sm--line-height)",
                "--drp-group-gap": "var(--spacing-xs)",
              },
              L: {
                "--drp-group-radius": "9px",
                "--drp-group-min-height":
                  "var(--catalog-token-drp-group-min-height, var(--catalog-token-size-height-L))",
                "--drp-group-pad-y": "3px",
                "--drp-group-pad-start": "{length.size.height.L*3/8}",
                "--drp-group-pad-end": "4px",
                "--drp-group-font-size": "var(--text-base)",
                "--drp-group-line-height": "var(--text-base--line-height)",
                "--drp-group-gap": "var(--spacing-xs)",
              },
              XL: {
                "--drp-group-radius": "10px",
                "--drp-group-min-height":
                  "var(--catalog-token-drp-group-min-height, var(--catalog-token-size-height-XL))",
                "--drp-group-pad-y": "3px",
                "--drp-group-pad-start": "{length.size.height.XL*3/8}",
                "--drp-group-pad-end": "4px",
                "--drp-group-font-size": "var(--text-lg)",
                "--drp-group-line-height": "var(--text-lg--line-height)",
                "--drp-group-gap": "var(--spacing-sm)",
              },
            },
            bridges: {
              display: "flex",
              "align-items": "center",
              width: "100%",
              gap: "var(--drp-group-gap)",
              // ADR-295 Phase 3c-3b: S2 DateRangePicker — `paddingStart: 'edge-to-text'` (height × 3/8) ·
              //   `paddingEnd: 4` (the vertical inset stays — the range box's own).
              "padding-top": "var(--drp-group-pad-y)",
              "padding-bottom": "var(--drp-group-pad-y)",
              "padding-left": "var(--drp-group-pad-start)",
              "padding-right": "var(--drp-group-pad-end)",
              // ADR-295 Phase 3: the range box is the field's control — the S2 control height (the builder
              //   root turns it off for its own widgets: `--catalog-token-drp-group-min-height: auto`).
              "min-height": "var(--drp-group-min-height)",
              // (2026-11-09: S2 DateRangePicker draws this box with the TextField's `FieldGroup` — the
              //   Input rule's border · fill · states. Was: a 1px `--border` box on `--bg-inset`.)
              border: "var(--border-width-thick) solid var(--neutral-outline)",
              // (모서리는 Input · DateInput 과 같은 크기 단계 — 같은 줄의 입력 상자와 모양이 같다.)
              "border-radius": "var(--drp-group-radius)",
              background: "var(--bg)",
              color: "var(--fg)",
              "white-space": "nowrap",
              "forced-color-adjust": "none",
              "font-size": "var(--drp-group-font-size)",
              "line-height": "var(--drp-group-line-height)",
              transition:
                "border-color 200ms ease, background-color 200ms ease",
            },
            states: {
              "[data-hovered]": {
                "border-color": "var(--neutral-outline-hover)",
              },
              "[data-invalid]": {
                "border-color": "var(--selection-negative)",
              },
              // (S2 `FieldGroup` `shouldTurnOffFocusRing`: while the calendar Button has focus the box is
              //   neither focus-within (dark border) nor focus-visible (ring) — the Button rings itself.)
              "[data-focus-within]:not(:has(.react-aria-Button[data-focused]))":
                {
                  "border-color": "var(--neutral-content-hover)",
                },
              "[data-focus-within][data-invalid]:not(:has(.react-aria-Button[data-focused]))":
                {
                  "border-color": "var(--selection-negative-hover)",
                },
              // (S2 `FieldGroup` `focusRing()`: the keyboard ring is the box's.)
              "[data-focus-visible]:not(:has(.react-aria-Button[data-focused]))":
                {
                  outline: "var(--focus-ring-width) solid var(--focus-ring)",
                  "outline-offset": "var(--focus-ring-offset)",
                },
              // (S2 `FieldGroup` disabled: the border in the disabled color — no dim, no fill change.)
              "[data-disabled]": {
                "border-color": "var(--fg-disabled)",
                cursor: "default",
              },
            },
          },
          // ADR-253: 상자는 Group 이 그린다. 그 안의 start · end 는 DateInput 원본의 instance 이고 template 이
          //   상자를 지운 자리다 — field 는 배치만 한다 (폭 · end 가 남는 폭을 차지). focus 표시는 Group 의
          //   것이라 안쪽 DateInput 의 outline 은 끈다.
          {
            childSelector: ".react-aria-DateInput",
            bridges: {
              width: "auto",
              "min-width": "0",
              // (ADR-295 Phase 3: the Group is the control box — a DateInput inside it is not the S2
              //   control height on its own.)
              "min-height": "0",
            },
            states: {
              "[data-focus-within]": {
                outline: "none",
              },
            },
          },
          {
            childSelector: '.react-aria-DateInput[slot="end"]',
            bridges: {
              flex: "1",
            },
          },
          // start 와 end 사이의 구분자 (Text 노드 — 색은 template 자리가 적는다).
          {
            childSelector: ".react-aria-Group > .react-aria-Text",
            bridges: {
              flex: "0 0 auto",
              width: "auto",
              padding: "0 4px",
              "font-size": "var(--drp-group-font-size)",
            },
          },
          // 버튼은 FieldButton 원본의 instance — Group 의 끝에 놓인다 (크기별 정사각형).
          {
            childSelector: ".react-aria-Button",
            prefix: "drp-btn",
            variables: {
              XS: {
                "--drp-btn-size": "var(--catalog-token-size-field-button-XS)",
                "--drp-btn-start": "{length.typography.text-2xs*10/14-2}",
              },
              S: {
                "--drp-btn-size": "var(--catalog-token-size-field-button-S)",
                "--drp-btn-start": "{length.typography.text-xs*10/14-4}",
              },
              M: {
                "--drp-btn-size": "var(--catalog-token-size-field-button-M)",
                "--drp-btn-start": "{length.typography.text-sm*10/14-4}",
              },
              L: {
                "--drp-btn-size": "var(--catalog-token-size-field-button-L)",
                "--drp-btn-start": "{length.typography.text-base*10/14-4}",
              },
              XL: {
                "--drp-btn-size": "var(--catalog-token-size-field-button-XL)",
                "--drp-btn-start": "{length.typography.text-lg*10/14-8}",
              },
            },
            bridges: {
              flex: "0 0 auto",
              width: "var(--drp-btn-size)",
              height: "var(--drp-btn-size)",
              // ADR-295 Phase 3: a field button (S2 — not a Button) does not take the Button's S2
              //   min-height (`{size.height.<S>}`) — its square is this size (placement, as `height`).
              "min-height": "0",
              "min-width": "0",
              // ADR-295 Phase 3c-3b: S2 `marginStart: 'text-to-control'` (10/14 em) less the group's gap.
              "margin-inline-start": "var(--drp-btn-start)",
            },
          },
        ],
      },
    },
  },
  Description: {
    defaultVariant: "default",
    defaultSize: "M",
    // ADR-151 B22 잔여 (2026-07-16): Text 동형 — generated CSS base `width: 100%` 를
    //   layout 이 미소비 (flex 부모에서 fit-content 80 vs CSS 350 실측). layout
    //   fallback 채널(top-level)로 공급. CSS 는 기존 규칙 그대로 — generated CSS diff 0.
    containerStyles: {
      width: "100%",
    },
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral-subdued}",
            isDisabled: "{color.disabled-content}",
          },
        },

        // ADR-912 위험군 해소 (선행-6 field/form Description catalog 등록, 2026-06-04):
        //   spec render.shapes 기본 fontWeight=400(Description.spec.ts:111-116, fwRaw 미지정 시 400)
        //   → variant.textWeight=400 명시. 누락 시 catalog 가 default weight 로 drift. Label(600) 과 달리
        //   Description 은 보조 설명 텍스트라 normal weight 400 이 정본.
        textWeight: 400,
      },
    },
    sizes: {
      // S2 HelpText uses controlFont: the same text size as its input.
      XS: {
        fontSize: "{typography.text-2xs}",
        lineHeight: "{typography.text-2xs--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      S: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      M: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      L: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      XL: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    structure: {
      archetype: "text",
      element: "span",
      containerStyles: {
        display: "block",
        width: "100%",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
      },
    },
  },
  // ADR-256 G5: RAC DialogTrigger has no element — `display: contents` (MenuTrigger 의 주석).
  PreviewTrigger: {
    defaultSize: "M",
    variants: {},
    sizes: {
      M: {
        height: 0,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
      },
    },
    structure: {
      archetype: "container",
      element: "div",
      skipCSSGeneration: true,
      containerStyles: {
        display: "contents",
      },
    },
  },
  SheetOverlay: {
    defaultSize: "M",
    variants: {},
    sizes: {
      M: {
        height: 0,
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.none}",
      },
    },
    structure: {
      archetype: "container",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "column",
      },
      skipCSSGeneration: true,
    },
  },
  SheetBackdrop: {
    defaultSize: "M",
    variants: {
      default: {
        paint: { backgroundColor: { default: "{color.overlay-backdrop}" } },
      },
    },
    defaultVariant: "default",
    sizes: {
      M: {
        height: 0,
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.none}",
      },
    },
    structure: {
      archetype: "container",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "column",
      },
    },
  },
  Sheet: {
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            // ADR-303: S2 에 Sheet 가 없다 — 같은 계열 Modal (`Modal.tsx:145` layer-2 · 그림자 없음).
            default: "{color.layer-2}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
    },
    sizes: {
      M: {
        height: 0,
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: 16,
      },
    },
    structure: {
      archetype: "container",
      element: "div",
      composition: {
        rootSelectors: SHEET_HANDLE_SELECTORS,
        delegation: [],
      },
      containerStyles: {
        // Sheet 본체가 Dialog의 Modal과 같은 elevation을 소유한다.
        display: "flex",
        flexDirection: "column",
        width: "360px",
        maxWidth: "100%",
        maxHeight: "90%",
        overflow: "hidden",
      },
    },
    defaultVariant: "default",
  },
  SheetContent: {
    defaultSize: "M",
    variants: {},
    sizes: {
      M: {
        height: 0,
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.none}",
        paddingX: 24,
        paddingY: 24,
        gap: 16,
      },
    },
    structure: {
      archetype: "container",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "column",
        overflow: "auto",
        outline: "none",
      },
    },
  },
  SheetTrigger: {
    defaultSize: "M",
    variants: {},
    sizes: {
      M: {
        height: 0,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
      },
    },
    structure: {
      archetype: "container",
      element: "div",
      skipCSSGeneration: true,
      containerStyles: {
        display: "contents",
      },
    },
  },
  DialogTrigger: {
    defaultSize: "M",
    variants: {},
    sizes: {
      M: {
        height: 0,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
      },
    },
    structure: {
      archetype: "container",
      element: "div",
      skipCSSGeneration: true,
      containerStyles: {
        display: "contents",
      },
    },
  },
  // ADR-259 Phase 3: S2 ContextualHelp is RAC DialogTrigger — no element (`display: contents`, as
  //   DialogTrigger). Its Button's quiet icon-only box is the part rule `contextualHelpPartRules`
  //   (S2 ActionButton XS · S, `isQuiet`) per its size.
  ContextualHelp: {
    defaultSize: "XS",
    variants: {},
    sizes: {
      XS: {
        height: 0,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
      },
      S: {
        height: 0,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
      },
    },
    structure: {
      archetype: "container",
      element: "div",
      skipCSSGeneration: true,
      containerStyles: {
        display: "contents",
      },
    },
  },
  Dialog: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            // ADR-303: S2 Dialog 는 자기 배경이 없고 Modal · Popover 의 layer-2 위에 놓인다 — 같은 층.
            default: "{color.layer-2}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
    },
    // 모서리 16px — size 무관 (2026-10-30 사용자 「dialog · popover 의 border-radius: size 상관없이 16px」).
    sizes: {
      // ADR-912 단계5 step4 (2026-06-16): paddingY/gap 보강 — generated CSS 의 `padding: {Y}px {X}px`
      //   + `gap: {gap}px` 가 rule 에서 emit 되도록(DialogSpec.sizes 미러, paddingX==paddingY).
      //   spec 삭제 후 STRUCTURE_META virtual override 가 동일 padding/gap 재생성 → diff 0.
      // 2026-06-22 reference 정합(ADR-914 Tier1): reference Dialog.css:8 `padding: var(--spacing-10)`
      //   = 40px(단일). composition size variant 체계는 보존하되 md(default)를 reference 40px 에 정합,
      //   xs~xl 을 비례 재설정(16/24/40/48/56). 기존 2~16px 은 dialog content inset 이 5배 부족했음.
      XS: {
        paddingX: 16,
        paddingY: 16,
        gap: 4,
        fontSize: "{typography.text-sm}",
        borderRadius: 16,
        height: 0,
      },
      S: {
        paddingX: 24,
        paddingY: 24,
        gap: 8,
        fontSize: "{typography.text-base}",
        borderRadius: 16,
        height: 0,
      },
      M: {
        paddingX: 40,
        paddingY: 40,
        gap: 12,
        fontSize: "{typography.text-base}",
        borderRadius: 16,
        height: 0,
      },
      L: {
        paddingX: 48,
        paddingY: 48,
        gap: 16,
        fontSize: "{typography.text-lg}",
        borderRadius: 16,
        height: 0,
      },
      XL: {
        paddingX: 56,
        paddingY: 56,
        gap: 20,
        fontSize: "{typography.text-xl}",
        borderRadius: 16,
        height: 0,
      },
    },
    structure: {
      archetype: "container",
      element: "div",
      // ADR-171 Phase 1 (2026-07-29): 수동 `overlays.css` 의 실효값을 catalog 로 이관.
      //   generated CSS root 는 overflow 미선언이었고 실효는 `auto` 였다 — 값 자체는 불변.
      // 기본 폭 400 · 상한 100% (2026-09-27 사용자 판정 "400px 로 복원"). `45bf29ae3` 가 `width: 100%` 로 바꿨으나
      //   Canvas 의 부모 DialogTrigger 는 `width: fit-content` 라 100% 가 풀리지 않아 본문이 min-content (156) 로
      //   찌그러졌고, DOM 은 Modal (폭 없음 · max-width min(500px, 90vw)) shrink-to-fit 이라 두 렌더러 폭이 갈렸다.
      //   고정 폭이면 두 부모 모두에서 400 — `maxWidth` 는 좁은 Modal (90vw) 에서 넘치지 않게.
      // 2026-10-25 사용자 요청 「Dialog 의 width 를 400 → 310」: Library page 를 잠금 해제한 mobile 에서
      //   Dialog 원본 복사본 (400) 이 카드 안쪽 폭 (310) 을 넘었다.
      containerStyles: {
        display: "flex",
        flexDirection: "column",
        width: "310px",
        maxWidth: "100%",
        overflow: "auto",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
      },
    },
  },
  DialogFooter: {
    defaultSize: "M",
    variants: {},
    sizes: {
      XS: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      S: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      M: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      L: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      XL: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    structure: {
      archetype: "simple",
      element: "div",
      containerStyles: undefined,
    },
  },
  Disclosure: {
    defaultSize: "M",
    variants: {},
    // 테두리 (S2 1.8.0 Disclosure, 2026-10-10 사용자 결정 「S2 처럼 기본 Disclosure 에 위아래 테두리」): 위 · 아래
    //   1px (`composition.containerStyles` 의 `border-top` · `border-bottom`, S2 `gray-200`), quiet 와
    //   Accordion 안의 마지막이 아닌 항목의 아래는 없다 (`rootSelectors`). sizes 에 borderWidth 를 두지
    //   않는다 — `[data-size]` 의 `border-width` 가 위아래 테두리를 덮는다. Canvas 는 같은 선언을
    //   `catalogDisclosureBorders` 로 읽어 레이아웃 (변별 border) 과 칠 (`strokeWidths`) 에 쓴다.
    //   루트 모서리는 없다 (S2 — 둥근 모서리면 위아래 선 양 끝이 휜다).
    sizes: {
      S: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      M: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      L: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      XL: {
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    // ADR-912 후속 (2026-06-25): Disclosure generated CSS 는 spec 삭제(4a703828c) 후 virtual emit
    //   대상에서 빠져(structure 부재) stale 고아 파일로 방치 → DOM(stale leaf CSS) ↔ Skia(rule shell)
    //   ↔ 레퍼런스(starter) 3경로 발산. structure 추가로 generate-css buildVirtualSpecs 의 virtual
    //   spec 재생성 대상에 편입 → catalog rule SSOT 단일 소스로 3경로 동시 구동.
    //   레퍼런스 정합(RAC starter upstream `Disclosure.css`):
    //   루트=블록 컨테이너(padding 0), 헤더 버튼=flex+font-weight 600+hover bg, chevron rotate,
    //   패널 콘텐츠 div padding. composition.containerStyles 보유 → compositionOwnsContainerBox=true
    //   로 sizes.padding/height 의 컨테이너 leaf emit skip(이전 inline-flex+center+padding 발산 해소).
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: {
        display: "block",
        width: "100%",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
        ...DISABLED_STATE,
        // ADR-297 Phase 3c — quiet: no top · bottom border; in a group only the last keeps its bottom border
        //   (S2 `isInGroup` · `:last-child`). The Canvas reads the same tree (`catalogDisclosureBorders`).
        borderTopWidth: { isQuiet: "0" },
        borderBottomWidth: { isQuiet: "0", inGroup: "0" },
      },
      composition: {
        containerStyles: {
          display: "block",
          "border-top": "1px solid var(--border)",
          "border-bottom": "1px solid var(--border)",
        },
        // S2 `isQuiet` 는 위아래 테두리를 없애고, Accordion 안에서는 마지막 항목만 아래 테두리를
        //   남긴다 (S2 `isInGroup` · `:last-child`). `data-in-group` 은 Accordion 안의 Disclosure 에
        //   DOM 이 붙인다 (RAC 그룹 context 가 닿는 깊이 — `catalogAccordionOf`).
        rootSelectors: {},
        // S2 density · quiet (2026-10-10): trigger 높이 = S2 `minHeight` (size × density — S 18/24/32 ·
        //   M 24/32/40 · L 32/40/48) — `min-height` 와, 한 줄 내용 (S chevron 18 · M 줄 20 · L 줄 22.857)
        //   을 그 높이 안 가운데에 두는 세로 padding (S2 `centerPadding` — 내림, 남는 몫은 min-height).
        //   regular 는 static trigger 의 `--disclosure-trigger-*`, compact · spacious 는 아래 블록이
        //   바꾼다. quiet trigger 는 둥글다 (S2 `borderRadius.isQuiet`).
        containerVariants: {
          size: {
            S: {
              styles: {
                "--disclosure-trigger-h": "24px",
                "--disclosure-trigger-py": "3px",
                "--disclosure-trigger-h-compact": "18px",
                "--disclosure-trigger-py-compact": "0px",
                "--disclosure-trigger-h-spacious": "32px",
                "--disclosure-trigger-py-spacious": "7px",
              },
            },
            M: {
              styles: {
                "--disclosure-trigger-h": "32px",
                "--disclosure-trigger-py": "6px",
                "--disclosure-trigger-h-compact": "24px",
                "--disclosure-trigger-py-compact": "2px",
                "--disclosure-trigger-h-spacious": "40px",
                "--disclosure-trigger-py-spacious": "10px",
              },
            },
            L: {
              styles: {
                "--disclosure-trigger-h": "40px",
                "--disclosure-trigger-py": "8px",
                "--disclosure-trigger-h-compact": "32px",
                "--disclosure-trigger-py-compact": "4px",
                "--disclosure-trigger-h-spacious": "48px",
                "--disclosure-trigger-py-spacious": "12px",
              },
            },
            XL: {
              styles: {
                "--disclosure-trigger-px": "17px",
                "--disclosure-trigger-px-compact": "14px",
                "--disclosure-trigger-px-spacious": "20px",
                "--disclosure-trigger-h": "48px",
                "--disclosure-trigger-py": "12px",
                "--disclosure-trigger-h-compact": "40px",
                "--disclosure-trigger-py-compact": "8px",
                "--disclosure-trigger-h-spacious": "56px",
                "--disclosure-trigger-py-spacious": "16px",
              },
            },
          },
          density: {
            compact: {
              nested: [
                {
                  selector: ".react-aria-Button[slot='trigger']",
                  styles: {
                    "min-height": "var(--disclosure-trigger-h-compact)",
                    "padding-left":
                      "var(--disclosure-trigger-px-compact, var(--spacing-md))",
                    "padding-right":
                      "var(--disclosure-trigger-px-compact, var(--spacing-md))",
                    gap: "var(--disclosure-trigger-px-compact, var(--spacing-xs))",
                    "padding-top": "var(--disclosure-trigger-py-compact)",
                    "padding-bottom": "var(--disclosure-trigger-py-compact)",
                  },
                },
              ],
            },
            spacious: {
              nested: [
                {
                  selector: ".react-aria-Button[slot='trigger']",
                  styles: {
                    "min-height": "var(--disclosure-trigger-h-spacious)",
                    "padding-left":
                      "var(--disclosure-trigger-px-spacious, var(--spacing-md))",
                    "padding-right":
                      "var(--disclosure-trigger-px-spacious, var(--spacing-md))",
                    gap: "var(--disclosure-trigger-px-spacious, var(--spacing-xs))",
                    "padding-top": "var(--disclosure-trigger-py-spacious)",
                    "padding-bottom": "var(--disclosure-trigger-py-spacious)",
                  },
                },
              ],
            },
          },
          quiet: {
            true: {
              nested: [
                {
                  selector: ".react-aria-Button[slot='trigger']",
                  styles: {
                    "border-radius": "var(--radius-md)",
                  },
                },
              ],
            },
          },
        },
        sizeSelectors: {
          XL: {
            ".react-aria-Button[slot='trigger']": {
              "font-size": "20px",
              "font-weight": "700",
              "line-height": "24px",
            },
            ".react-aria-DisclosurePanel > div": {
              "padding-left": "15px",
              "padding-right": "15px",
            },
            // (2026-11-09 사용자: the chevron stays the trigger's lucide Icon box at XL too — no S2
            //   ui-icon 14px override; the Canvas drew a 18 glyph in that 14 box.)
          },
        },
        staticSelectors: {
          ".react-aria-Heading": {
            margin: "0",
            // `<Heading>` 은 `<h3>` 로 렌더돼 **브라우저 기본 h3 font-size(16px)** 를 갖는다 →
            //   `.react-aria-Disclosure[data-size]` 의 font-size 상속 체인을 여기서 끊는다.
            //   아래 trigger 버튼의 `font-size: inherit` 는 **직계 부모**(= 이 Heading)를 따르므로,
            //   Heading 이 먼저 inherit 하지 않으면 버튼이 h3 기본 16px 을 물려받는다
            //   (sm 실측: Disclosure 12px → Heading 16px → Button 16px, 기대 12px).
            "font-size": "inherit",
          },
          // 헤더 trigger 버튼 — starter `.disclosure-button` 정합 (flex + font-weight 600 + hover bg).
          //   composition <Disclosure> 는 <Heading><Button slot="trigger"> 구조라 RAC 기본 .react-aria-Button.
          ".react-aria-Button[slot='trigger']": {
            background: "none",
            border: "none",
            "box-shadow": "none",
            width: "100%",
            color: "var(--fg)",
            "font-weight": "600",
            display: "flex",
            "align-items": "center",
            "text-align": "start",
            // RAC .react-aria-Button 기본 CSS 가 justify-content:center 를 주므로(Button.css:13/25)
            //   명시 flex-start 로 override — starter .disclosure-button(text-align:start, 기본
            //   justify normal=flex-start) 정합. 누락 시 헤더 chevron+title 이 중앙 정렬로 발산.
            "justify-content": "flex-start",
            // RAC `.react-aria-Button` base 가 `font-size: var(--text-sm)`(14) 를 **자기 값으로
            //   선언**해(Button.css:35) 부모 `.react-aria-Disclosure[data-size]` 의 font-size
            //   상속을 차단한다 → trigger 헤더가 전 size 14px 고정(사용자 적발 2026-07-15:
            //   "Disclosure size 변경 시 DisclosureHeader 변경 안 됨(css, skia)").
            //   Skia 는 `DisclosureHeader.sizes.fontSize`(sm 12 / md 14 / lg 16)를 그리므로
            //   sm/lg 에서 DOM↔Skia 비대칭. `inherit` 로 부모 size 폰트를 받는다 — 위
            //   justify-content 와 **동일한 "Button base 가 부모를 덮는다"** 함정.
            //   대칭 근거: `Disclosure.sizes.fontSize` = `DisclosureHeader.sizes.fontSize`
            //   (둘 다 text-xs/text-sm/text-base) → inherit 값이 Skia 가 읽는 값과 일치.
            "font-size": "inherit",
            gap: "var(--disclosure-trigger-px, var(--spacing-xs))",
            // 높이 = size · density 별 S2 trigger 높이 (`containerVariants` 의 변수).
            "min-height": "var(--disclosure-trigger-h)",
            padding:
              "var(--disclosure-trigger-py) var(--disclosure-trigger-px, var(--spacing-md))",
            // S2: 모서리는 quiet 와 keyboard focus 에서만 둥글다.
            "border-radius": "0",
            transition: "all 200ms",
            outline: "none",
          },
          // 제목 Text 노드 (2026-10-07 — 레퍼런스 `<span>{children}</span>`): `.react-aria-Text` 의 자기
          //   font-size · line-height · color 선언을 풀어 trigger 의 글꼴 · 색 (hover 포함) 을 잇는다.
          //   weight 는 Text 가 선언하지 않아 trigger 의 600 을 상속한다. 폭은 Text 의 100% 그대로 — flex
          //   행에서 chevron 뒤 남은 폭으로 줄어든다 (Canvas 도 같은 값).
          ".react-aria-Button[slot='trigger'] > .react-aria-Text": {
            "font-size": "inherit",
            "line-height": "inherit",
            color: "inherit",
          },
          ".react-aria-Button[slot='trigger'][data-hovered]": {
            background: "var(--bg-muted)",
            color: "var(--fg-emphasis)",
          },
          ".react-aria-Button[slot='trigger'][data-pressed]": {
            background: "var(--bg-muted)",
          },
          ".react-aria-Button[slot='trigger'][data-focus-visible]": {
            outline: "var(--focus-ring-width) solid var(--focus-ring)",
            "border-radius": "var(--radius-md)",
          },
          // chevron — ADR-256 Phase 8c: the trigger's Icon node (the reference `<ChevronRight />`):
          //   a fixed box in the flex row; its glyph turns with the expansion (below).
          ".react-aria-Button[slot='trigger'] > .react-aria-Icon": {
            "flex-shrink": "0",
          },
          ".react-aria-Button[slot='trigger'] .react-aria-Icon svg": {
            rotate: "0deg",
            transition: "rotate 200ms",
          },
          // The expanded trigger (RAC's `aria-expanded` on the trigger itself — any depth below the
          //   Disclosure, a nested Disclosure keeps its own) turns the chevron glyph; the Canvas
          //   draws the turned glyph (`chevron-down`), so only `chevron-right` turns (Phase 8 판독 M1 · M3).
          ".react-aria-Button[slot='trigger'][aria-expanded='true'] .react-aria-Icon[data-icon='chevron-right'] svg":
            {
              rotate: "90deg",
            },
          // 패널 콘텐츠 div — starter `.react-aria-DisclosurePanel div { padding }` 정합.
          //   starter 8px 16px = composition --spacing-sm --spacing-lg.
          ".react-aria-DisclosurePanel > div": {
            padding: "var(--spacing-sm) var(--spacing-lg)",
            color: "var(--fg)",
          },
          // ADR-256 Phase 8c: the panel's content Text takes the Disclosure's size font and the
          //   panel color, as the old content div did (`.react-aria-Text` declares its own).
          ".react-aria-DisclosurePanel > div > .react-aria-Text": {
            "font-size": "inherit",
            "line-height": "inherit",
            color: "inherit",
          },
        },
        // generateCompositionCSS 가 comp.delegation 을 무조건 iterate (CSSGenerator:1218) —
        //   composition 보유 시 delegation 필수(빈 배열 허용). 삭제된 spec 도 delegation:[] 였음.
        delegation: [],
      },
    },
  },
  Accordion: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        // ADR-297 Phase 3 닫힘 — 묶음 컨테이너는 상자를 칠하지 않는다 (S2 그대로). 생성 CSS 는 composition 이
        //   상자를 가진 rule 의 variant 칠을 내지 않아 DOM 은 투명이었고, Canvas 만 트리의 바탕 · 테두리를 그렸다.
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
    },
    // 테두리 없음 (starter Accordion.css 정합 · Disclosure 2026-09-18 동형). sizes 에 borderWidth 가
    //   없으면 Skia generic shell 이 기본 thin (1px) 로 variant border 색을 그렸고, 생성 CSS 는
    //   border-style 이 없어 DOM 은 `0px none` — Skia 에만 테두리가 보였다 (2026-09-24 Compare Mode 실측).
    sizes: {
      S: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        borderWidth: "{border.width.none}",
        height: 0,
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        borderWidth: "{border.width.none}",
        height: 0,
      },
      L: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.lg}",
        borderWidth: "{border.width.none}",
        height: 0,
      },
      XL: {
        borderRadius: "{radius.lg}",
        borderWidth: "{border.width.none}",
        height: 0,
      },
    },
    // ADR-912 후속 (2026-06-25): Accordion generated CSS 도 spec 삭제 후 virtual emit 제외 →
    //   stale 고아. structure 추가로 catalog rule SSOT 파생 복원 (삭제된 Accordion.spec.ts
    //   composition.layout="flex-column" + containerStyles 그대로 이전 — flex column 컨테이너,
    //   border-radius/overflow:hidden. variant border 는 Skia render.shapes 전용이라 DOM CSS 미emit
    //   유지 = spec 시절 동작 보존, byte-diff 0 목표).
    structure: {
      archetype: "default",
      element: "div",
      stateStyles: {
        ...FOCUS_RING_STATE,
        ...DISABLED_STATE,
      },
      composition: {
        layout: "flex-column",
        containerStyles: {
          width: "100%",
          "font-size": "var(--text-base)",
          "border-radius": "var(--radius-md)",
          // overflow 는 두지 않는다 (사용자 결정 2026-11-13): `hidden` 이면 flex item 의 자동 최소
          //   크기가 0 이라, 높이가 정해진 세로 flex 부모 (Height 100% page body) 가 넘칠 때 Accordion 을
          //   0 까지 눌렀다 (Chrome 과 Canvas 엔진 같은 규칙). S2 Accordion 도 내용을 자르지 않는다.
        },
        delegation: [],
      },
    },
  },
  DropZone: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            // ADR-303 (결정 4 a): S2 DropZone 은 휴지 배경이 없다 — 컨테이너 층을 따른다.
            default: "{color.container}",
            isHovered: "{color.layer-2}",
          },
          color: {
            default: "{color.neutral-subdued}",
            isHovered: "{color.accent-content}",
          },
          borderColor: {
            default: "{color.border}",
            isHovered: "{color.accent-content}",
          },
        },

        borderStyle: "dashed",

        textWeight: 400,
      },
    },
    // ADR-912 단계5 step4 Phase 1 batch 2 (2026-06-16): paddingY + gap 보강 (Nav 선례 정렬).
    //   DropZone 은 _hasChildren 컨테이너 — DOM(generated CSS)이 padding 세로축 + gap 을 emit 해야
    //   size 변경 시 자동 추종. paddingY/gap 미보유면 virtual CSS 가 `padding: X 0` + gap 소실 →
    //   diff 발생. spec.sizes 미러(sm 16/8, md 24/12, lg 32/16). Skia/Taffy 컨테이너 배치는 factory
    //   props.style 이 SSOT(ADR-907 Layer B — layout 엔진 rule import 0건), rule 의 paddingY/gap 은
    //   generated CSS emit 전용(Nav 동형).
    sizes: {
      S: {
        paddingX: 16,
        paddingY: 16,
        gap: 8,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        borderWidth: "{border.width.thick}",
        height: 0,
        iconSize: 24,
      },
      M: {
        paddingX: 24,
        paddingY: 24,
        gap: 12,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.lg}",
        borderWidth: "{border.width.thick}",
        height: 0,
        iconSize: 32,
      },
      L: {
        paddingX: 32,
        paddingY: 32,
        gap: 16,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        borderWidth: "{border.width.thick}",
        height: 0,
        iconSize: 40,
      },
    },
    structure: {
      archetype: "simple",
      element: "div",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
        ...DISABLED_STATE,
        // ADR-297 Phase 3c — a drag over it (was `rootSelectors["&[data-drop-target]"]`)
        background: { isDropTarget: "var(--bg-inset)" },
        color: { isDropTarget: "var(--accent-content)" },
      },
      composition: {
        rootSelectors: {
          "&": {
            // S2 isFilled 배너의 absolute 기준 (끄는 중에만 보이는 DOM 전용 상태 — Canvas 비소비).
            styles: {
              position: "relative",
            },
          },
          // S2 1.8.0 isFilled · replaceMessage (2026-10-10): 채워진 영역 위로 끌 때의 교체 배너.
          //   배너 요소는 DropZone.tsx 가 isFilled 일 때 상주시키고, 여기서 drag 상태에만 보인다.
          "& .dropzone-replace": {
            styles: {
              display: "none",
            },
          },
          "&[data-drop-target] .dropzone-replace": {
            styles: {
              display: "flex",
              position: "absolute",
              inset: "0",
              "align-items": "center",
              "justify-content": "center",
              background: "var(--bg-overlay)",
              color: "var(--accent-content)",
              "font-weight": "700",
              "border-radius": "inherit",
            },
          },
        },
        // ADR-248 4e-10 (사용자 결정 A 2026-10-02): the composed content (DropZone.tsx — upload
        //   icon, label and description) are the DropZone column's own flex items. The Canvas reads
        //   the same entries (`catalogDropZoneContentStyle`): icon = `sizes.iconSize`, label = the
        //   DropZone font, description = text-xs, both centered at line-height 1.5 in the variant
        //   text color (the generic `.react-aria-Text` rule otherwise paints them 16 px dark).
        delegation: [
          {
            childSelector: ".dropzone-icon",
            bridges: {
              width: "var(--icon-size)",
              height: "var(--icon-size)",
              "flex-shrink": "0",
            },
          },
          {
            childSelector: '[slot="label"]',
            bridges: {
              "font-size": "inherit",
              "font-weight": "inherit",
              "line-height": "1.5",
              color: "inherit",
              "text-align": "center",
            },
          },
          {
            childSelector: '[slot="description"]',
            bridges: {
              "font-size": "var(--text-xs)",
              "font-weight": "inherit",
              "line-height": "1.5",
              color: "inherit",
              "text-align": "center",
            },
          },
        ],
      },
    },
  },
  Field: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
    },
    sizes: {
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 32,
      },
    },
  },
  // ADR-259 Phase 3: a field's label row (S2 `FieldLabel` — `Field.tsx:96-184`): the Label and its
  //   ContextualHelp on one line, centered (S2 `CenterBaseline`), apart by S2's `&nbsp;` (a quarter
  //   em of the label font — 4px at its sizes). It stands in the Label's place in the field
  //   (`catalogFieldLabelSelector`): the field rule's Label placement reaches it.
  FieldLabel: {
    defaultSize: "M",
    variants: {},
    sizes: {
      M: {
        height: 0,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
      },
    },
    structure: {
      archetype: "container",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: "4px",
        width: "fit-content",
        // (Not stretched to its grid · flex line — as the Label, whose sheet is `height:
        //   fit-content`: a Slider's label row beside its output. A side field's rule centers it.)
        alignSelf: "flex-start",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
      },
    },
  },
  FieldError: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        // 에러 메시지 — negative(빨강) 텍스트. Description(neutral-subdued)/Label(neutral) 과 색만 다름.
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.selection-negative}",
            isDisabled: "{color.disabled-content}",
          },
        },

        textWeight: 400,
      },
    },
    sizes: {
      // S2 HelpText uses controlFont: the same text size as its input.
      XS: {
        fontSize: "{typography.text-2xs}",
        lineHeight: "{typography.text-2xs--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      S: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      M: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      L: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      XL: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    structure: {
      archetype: "simple",
      element: "span",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
    },
  },
  // ADR-201 Phase 3 (2026-09-17) — 대용량 파일 업로드 compound 의 컨테이너 shell. D1 은 internal
  //   source (RAC 에 없음 — 자식 DropZone/FileTrigger 가 RAC), D3 는 여기 rule 이 정본이다.
  //   투명 fill · column flex · gap 만 갖고 자식 시각은 DropZone/FileTrigger/ProgressBar/frame
  //   기존 rule 이 그린다 — 신규 시각 채널 0 (generate-css 확장 없음). Skia/레이아웃 엔진 컨테이너
  //   배치는 factory props.style 이 SSOT (ADR-907 Layer B — DropZone 동형), rule 의 gap 은
  //   generated CSS emit 전용.
  FileUpload: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
        alpha: 0,
      },
    },
    sizes: {
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: 12,
      },
    },
    structure: {
      // "text" archetype = block + width 100% + border-box. "default" 는 DEFAULT_BASE_STYLES 의
      //   cursor:pointer 가 딸려와 컨테이너에 손가락 커서가 붙는다 (Chart 선례 2026-09-08).
      archetype: "text",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
        ...DISABLED_STATE,
      },
    },
  },
  FileTrigger: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.layer-1}",
            isHovered: "{color.neutral-subtle}",
            isPressed: "{color.neutral-subtle}",
          },
          color: {
            default: "{color.neutral}",
          },
          borderColor: {
            default: "{color.border}",
          },
        },
      },
    },
    // iconSize = 그 크기 글자의 행간 (ADR-295 Phase 3c — S2 에서 이 자리는 Button: 아이콘 `size: '1lh'`).
    sizes: {
      // 2026-10-25 사용자 요청 「FILETRIGGER 의 size(s,m,l) 모두 button 컴퍼넌트 size(s,m,l) 의 정보와
      //   동일하게」 — Button rule 의 S · M · L 과 같은 값 (height 0 = 내용 + paddingY). 전에는 고정
      //   height 32 · 40 · 48 · paddingX 12 · 24 · 32 였다.
      S: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        fontWeight: 500,
        borderRadius: "{radius.sm}",
        borderWidth: "{border.width.thin}",
        height: 0,
        iconSize: "{typography.text-xs--line-height}",
        paddingX: 8,
        paddingY: 2,
        gap: 6,
        iconGap: 6,
      },
      M: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        fontWeight: 500,
        borderRadius: "{radius.md}",
        borderWidth: "{border.width.thin}",
        height: 0,
        iconSize: "{typography.text-sm--line-height}",
        paddingX: 12,
        paddingY: 4,
        gap: 8,
        iconGap: 8,
      },
      L: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        fontWeight: 500,
        borderRadius: "{radius.lg}",
        borderWidth: "{border.width.thin}",
        height: 0,
        iconSize: "{typography.text-base--line-height}",
        paddingX: 16,
        paddingY: 8,
        gap: 10,
        iconGap: 10,
      },
    },
    structure: {
      archetype: "button",
      element: "button",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "fit-content",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
        boxShadow: { isPressed: "inset 0 1px 2px rgba(0,0,0,0.1)" },
        ...DISABLED_STATE,
      },
      // ADR-248 4e-10 (2026-10-02): no `composition.containerStyles` — the root is the
      //   self-composed `.react-aria-FileTrigger` button (renderFileTrigger, 2026-09-10), not a
      //   wrapper around one, so the size box (height · paddingX) and the variant paint belong to it
      //   in both consumers (an owned container box drops them from generated CSS and the Canvas).
      composition: {
        staticSelectors: {
          "input[type='file']": {
            position: "absolute",
            width: "1px",
            height: "1px",
            padding: "0",
            margin: "-1px",
            overflow: "hidden",
            clip: "rect(0, 0, 0, 0)",
            "white-space": "nowrap",
            border: "0",
          },
        },
        delegation: [],
      },
    },
  },
  Form: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        // ADR-297 Phase 3 닫힘 — 묶음 컨테이너는 상자를 칠하지 않는다 (S2 그대로). 생성 CSS 는 composition 이
        //   상자를 가진 rule 의 variant 칠을 내지 않아 DOM 은 투명이었고, Canvas 만 트리의 바탕 · 테두리를 그렸다.
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
    },
    sizes: {
      // ADR-912 단계5 step4 small-B (2026-06-16): gap 보강 — spec 삭제 후 generated CSS `gap: Npx`
      //   재생성용 (Form.spec.sizes 미러). padding 은 composition.layout=flex-column + containerStyles
      //   ownsContainerBox → 미emit 이라 보강 불요(gap 만).
      S: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 0,
        gap: 12,
      },
      M: {
        paddingX: 20,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 0,
        gap: 16,
      },
      L: {
        paddingX: 28,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 0,
        gap: 20,
      },
      XL: {
        paddingX: 36,
        fontSize: "{typography.text-xl}",
        borderRadius: "{radius.2xl}",
        height: 0,
        gap: 24,
      },
    },
    structure: {
      archetype: "default",
      element: "form",
      containerStyles: undefined,
      // (No disabled state — S2 Form draws none: its `isDisabled` is the Form context its fields
      //   take, each dimming itself — 2026-10-09. Before, nothing set it.)
      stateStyles: {
        ...FOCUS_RING_STATE,
      },
      composition: {
        layout: "flex-column",
        gap: "16px",
        containerStyles: {
          "align-items": "start",
          "--form-label-width": "auto",
          "--form-label-align": "start",
          "--form-field-gap": "var(--spacing-md)",
        },
        containerVariants: {
          "label-position": {
            // side: 안의 field 들이 한 라벨 열을 쓴다 (S2 Form 의 subgrid 와 같은 정렬 — 2026-10-10). 변수는
            //   상속이라 깊이와 무관하게 가장 가까운 Form 의 값 (S2 Form context 와 같은 범위). Canvas 는
            //   `formFieldLabelPartRules` 가 같은 값을 가장 가까운 Form 에서 읽는다.
            side: {
              styles: {
                "--form-label-width": "11rem",
              },
            },
          },
          "label-align": {
            end: {
              styles: {
                "--form-label-align": "end",
              },
            },
          },
        },
        delegation: [],
      },
    },
  },
  frame: {
    defaultSize: "M",
    variants: {},
    sizes: {
      M: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    structure: {
      archetype: "container",
      element: "div",
      skipCSSGeneration: true,
    },
  },
  GridList: {
    // ADR-297 Phase 3g — the list's focus · drop target (옛 수동 `GridList.css` — 생성 sheet 가 없는 rule 이라 상태
    //   블록만 담은 `generated/GridList.css`).
    partStateStyles: {
      "&%": {
        background: { isDropTarget: "var(--accent-subtle)" },
        outline: {
          isFocusVisible: "2px solid var(--focus-ring)",
          isDropTarget: "2px solid var(--accent)",
        },
        outlineOffset: { isDropTarget: "-1px" },
      },
    },
    // 2026-07-29 사용자 보고("components page 에서 Container Align 을 주면 GridList 자식이
    //   전부 깨진다. home page 에서는 멀쩡하다") 의 근본 원인 — GridList 는 **catalog 에
    //   containerStyles 가 아예 없었다**. 수동 CSS `.react-aria-GridList` 는 `width:100%` 를
    //   갖는데(실효 DOM 정본) 캔버스는 그 값을 factory 인라인(`createGridListDefinition` 의
    //   `style.width:"100%"`)으로만 받고 있었다. origin(`component-gridlist`)은 factory 를
    //   거치지 않으므로 아무것도 못 받는다 — 그게 페이지 비대칭의 정체다(origin↔instance
    //   차이지 페이지 차이가 아니다. 인스턴스에서 width 를 지우면 똑같이 깨진다).
    //
    //   왜 width 가 없으면 깨지는가: 부모에 Container Align(비-stretch `align-items`)이
    //   걸리면 자식은 shrink-to-fit 이 된다. 투영 행(`projection:gridlist-row:*`)은 레이아웃
    //   자식이 없어(내용은 렌더 층이 그린다) 미결정 available 에서 폭을 만들지 못하고 0 으로
    //   접힌다 — layout-engine.md §"늘어날 available 이 없으면 기여는 content 다" 의 잔존 1건.
    //   실측: rows-group 390→**12**, row 189→**0**. `alignSelf:"stretch"` 로는 안 고쳐진다
    //   (owner 상자만 390 이 되고 subtree 는 여전히 12/0) — stretch 는 자식 측정이 끝난 뒤
    //   상자를 정하기 때문이다. 확정 width 만이 측정 시점에 available 을 준다.
    //
    //   display/gap 은 여기 넣지 않는다 — `implicitStyles` 의 gridlist 분기가 rows-group 에
    //   열 구성을 위임하려고 owner 를 의도적으로 flex-column 으로 두고 있다(그 분기 주석 참조).
    //   catalog 가 `display:grid` 를 주면 그 의도와 충돌한다. 빠진 것은 box-model 채널 하나다.
    containerStyles: {
      width: "100%",
    },
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
    },
    sizes: {
      M: {
        fontSize: "{typography.text-sm}",
        // The S2 ListView box's corner (`radius: default` — 8; `GridList.css` · `manualBoxRules`),
        //   2026-10-25 — 0 before (the reference image cards' list had no box).
        borderRadius: "{radius.lg}",
        height: 0,
      },
    },
  },
  /* ADR-913 slice 4 (2026-06-19): selected 카드 accent border — GridListItem rule colors 에
     selectedBorder 공급 → gridListCard(skiaPrimitives) 가 isSelected 시 visual.selectedBorder
     소비. DOM(builder GridList.css [data-selected] accent 2px)과 대칭. schema 기존 보유. */
  GridListItem: {
    // ADR-297 Phase 3g — the row's drag handle focus (옛 수동 `GridList.css`).
    partStateStyles: {
      '& .react-aria-Button[slot="drag"]%': {
        borderRadius: { isFocusVisible: "4px" },
        outline: { isFocusVisible: "2px solid var(--focus-ring)" },
      },
    },
    defaultVariant: "default",
    defaultSize: "M",
    // ADR-257 후속 — the GridList's S2 `overflowMode` (ListView — carried here by the resolver):
    //   S2 `label` · `description` (DragPreview.tsx) truncate — one line, clipped with an ellipsis —
    //   or wrap (`normal`, the card grows). The item's label · description are its Text children,
    //   so the block gives them the text box (part rules → their records — Canvas text leaf and DOM
    //   inline read the same values).
    containerVariants: {
      "overflow-mode": {
        truncate: {
          nested: [
            {
              selector: "> .react-aria-Text",
              styles: {
                overflow: "hidden",
                "white-space": "nowrap",
                "text-overflow": "ellipsis",
              },
            },
          ],
        },
        wrap: {
          nested: [
            {
              selector: "> .react-aria-Text",
              styles: { "white-space": "normal" },
            },
          ],
        },
      },
    },
    // ADR-912 Phase 3-A-3b (2026-06-20): collection-item base-axis 를 catalog SSOT 로 도달.
    //   카드 컨테이너 flex-column layout(권위 source = starter GridList.css:112
    //   `.react-aria-GridListItem { display:flex; flex-direction:column; min-width:0 }`).
    //   gap 은 sizes.M.gap(2) 경유라 containerStyles 에 중복 미선언. implicitStyles
    //   gridlistitem 분기 인라인(display/flexDirection/minWidth)을 본 source 로 대체.
    structure: {
      archetype: "default",
      element: "div",
      // 2026-10-13 (사용자 「gridlist 를 RAC 레퍼런스 테마 기준으로」 · 「이미지 카드로」): the reference
      //   `.react-aria-GridListItem` — a flex column card (its photo, then its texts) on the overlay
      //   surface with the reference's one-layer shadow (the Canvas draws it too —
      //   `resolveEffectiveBoxShadow`), no border, its children from the top (no centring).
      //   (No `minWidth: 0` — user 2026-10-25 「gridlistitem(origin) - minWidth: auto」.)
      //   2026-10-25 (사용자 「GridList 를 S2 ListView 처럼 목록 행으로」): the S2 ListView row — no card
      //   shadow; its grid (leading visual · label over description) is `manualBoxRules` GridListItem's
      //   and `GridList.css`'s.
      containerStyles: {
        display: "grid",
        position: "relative",
      },
      // ADR-248 4e-11: `GridList.css` `[data-disabled]` (opacity 0.38) — the same disabled state as
      //   ListBoxItem, read by both consumers.
      stateStyles: {
        // (ADR-297 Phase 3g: the row's keyboard ring sits inside it — was the manual `GridList.css`)
        outline: { isFocusVisible: "2px solid var(--focus-ring)" },
        outlineOffset: { isFocusVisible: "-2px" },
        ...DISABLED_STATE,
        // (ADR-297 Phase 3b: the row's resting cursor — was the manual `GridList.css` root, which a `:where` state
        //   block no longer outranks)
        cursor: { default: "default", isDisabled: "not-allowed" },
      },
    },
    // ADR-912 collection sub-part cutover (2026-06-14, TreeItem escape 선례 동형):
    //   GridListItem.spec.render.shapes(카드 box layer-1 + border + label fw600 +
    //   description neutral-subdued)를 rule + buildCatalogShapes(box+label) +
    //   card_description skiaPrimitive(append, 2번째 줄)로 이전. 카드 box border 는
    //   colors.border(TableRow 와 달리 GridListItem 은 카드 테두리 의도됨).
    variants: {
      default: {
        // The S2 ListView row (`listRowBackground`): transparent at rest, a light neutral wash on
        //   hover · press, the selection tint (S2 `highlight` — a blue wash; here the accent's).
        // The row's separator color (its 1px bottom line — `manualBoxRules` · `GridList.css`; the
        //   rule's own border width is none), clear while selected (S2 `isSelected: transparent`).
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.neutral-subtle}",
            isPressed: "{color.neutral-subtle}",
            isSelected: {
              default: "{color.accent-subtle}",
            },
          },
          color: {
            default: "{color.neutral}",
            isSelected: {
              default: null,
            },
          },
          borderColor: {
            default: "{color.border}",
            isSelected: {
              default: "{color.transparent}",
            },
          },
        },
      },
      /* quiet (2026-08-22, 감사 §1-2 축② 잔여) — 컬렉션 quiet 은 **컨테이너가 아니라 카드**
         에서 성립한다. GridList 컨테이너는 catalog·CSS 양쪽 다 이미 transparent/border none
         이라 거기에 quiet 를 두면 시각 변화가 0인 dead prop 이 된다. 실제 chrome(배경 layer-1
         + 1px border + radius)은 카드가 들고 있다.
         fill 축(`fill.quiet` preset)이 아니라 **variant** 인 이유: quiet 이 배경과 **테두리를
         함께** 지워야 하는데 fill preset 은 배경만 다룬다(ToggleButton 은 border 가 이미
         transparent 라 fill 만으로 충분했다). variant 는 fill+colors 를 한 벌로 갖고, 생성 CSS
         `[data-variant="quiet"]` 와 Skia 의 variant 해석이 추가 배선 없이 그대로 작동한다.
         selectedBorder 는 accent 를 유지한다 — 선택 표시까지 지우면 어떤 카드가 선택됐는지
         알 수 없다(ToggleButton quiet 이 selected 를 그대로 둔 것과 같은 판단). */
      quiet: {
        // 쉬는 상태만 비우고 hover/pressed 에서는 배경이 돌아온다 — Spectrum quiet 의
        //   정의이자 "누를 수 있는 것" 이라는 신호를 남기는 최소한이다. 테두리는
        //   hover 에서도 돌아오지 않는다(그러면 quiet 이 아니다).
        // The row's separator color (its 1px bottom line — `manualBoxRules` · `GridList.css`; the
        //   rule's own border width is none), clear while selected (S2 `isSelected: transparent`).
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.neutral-subtle}",
            isPressed: "{color.neutral-hover}",
            isSelected: {
              default: null,
            },
          },
          color: {
            default: "{color.neutral}",
            isSelected: {
              default: null,
            },
          },
          borderColor: {
            default: "{color.border}",
            isSelected: {
              default: "{color.transparent}",
            },
          },
        },
      },
    },
    sizes: {
      M: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.none}",
        // height 0 = content-fit (a row at least 40 — `manualBoxRules` GridListItem `minHeight`).
        height: 0,
        // The S2 ListView row padding (8 · 12); its label over its description 2 apart.
        paddingX: 12,
        paddingY: 8,
        gap: 2,
        borderWidth: "{border.width.none}",
      },
    },
  },
  Group: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            // ADR-303: RAC Group 은 배경을 칠하지 않는다 (DOM 투명 · Canvas 상자 없음 — 실측). `base` 로
            //   두면 컨테이너 판정이 base 층 컨테이너로 읽어 안의 reader 가 바깥 층 대신 base 를 받는다.
            default: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
      accent: {
        paint: {
          backgroundColor: {
            // ADR-303: RAC Group 은 배경을 칠하지 않는다 (DOM 투명 · Canvas 상자 없음 — 실측). `base` 로
            //   두면 컨테이너 판정이 base 층 컨테이너로 읽어 안의 reader 가 바깥 층 대신 base 를 받는다.
            default: "{color.transparent}",
          },
          color: {
            default: "{color.accent-content}",
          },
        },
      },
    },
    sizes: {
      S: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      M: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      L: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    structure: {
      archetype: "container",
      element: "div",
      skipCSSGeneration: true,
    },
  },
  // ADR-912 단계5 step4 (2026-06-16): Header.spec.ts 삭제 — Section Header 시각 SSOT.
  //   paddingX/paddingY/fontWeight 보강(구 HeaderSpec.sizes 미러). 현재 CSS source 는 ListBox.spec
  //   inline child spec(childSpecs emit); 본 rule 은 SSOT 정합용(향후 rule 직접 source 전환 대비).
  // ADR-238 Phase 2 — ListBoxSection: 목록 묶음 층 (투명 — 상자 시각 없음). display 는 archetype container 기본 (block) —
  //   DOM `<section>` 과 같은 block flow 에 Header (inline-flex) · 항목 (block) 이 쌓인다.
  ListBoxSection: {
    defaultSize: "M",
    variants: {},
    sizes: {
      M: {
        height: 0,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
      },
    },
    structure: {
      archetype: "container",
      element: "section",
    },
  },
  // ADR-238 Phase 2 — MenuSection: 목록 묶음 층 (투명 — 상자 시각 없음). display 는 archetype container 기본 (block) —
  //   DOM `<section>` 과 같은 block flow 에 Header (inline-flex) · 항목 (block) 이 쌓인다.
  MenuSection: {
    defaultSize: "M",
    variants: {},
    sizes: {
      M: {
        height: 0,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
      },
    },
    structure: {
      archetype: "container",
      element: "section",
    },
  },
  // ADR-238 Phase 2 — GridListSection: 목록 묶음 층 (투명 — 상자 시각 없음). display 는 archetype container 기본 (block) —
  //   DOM `<section>` 과 같은 block flow 에 Header (inline-flex) · 항목 (block) 이 쌓인다.
  GridListSection: {
    defaultSize: "M",
    variants: {},
    sizes: {
      M: {
        height: 0,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
      },
    },
    structure: {
      archetype: "container",
      element: "section",
    },
  },
  Header: {
    defaultSize: "M",
    variants: {},
    // S2 Menu `sectionHeader` (`Menu.tsx`, ADR-295 Phase 3c-3c): 최소 높이 control · 위아래 centerPadding (생성기가 식과
    //   대조 — (높이 − 18) / 2) · 글자 `ui` bold (크기 무관) · 좌우 `edgeToText` 9 · 12 · 15 (rem — 터치에서 그대로).
    sizes: {
      S: {
        minHeight: "{size.height.S}",
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderWidth: "{border.width.none}",
        borderRadius: "{radius.none}",
        height: 0,
        paddingX: 9,
        paddingY: 3,
        fontWeight: 700,
      },
      M: {
        minHeight: "{size.height.M}",
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderWidth: "{border.width.none}",
        borderRadius: "{radius.none}",
        height: 0,
        paddingX: 12,
        paddingY: 7,
        fontWeight: 700,
      },
      L: {
        minHeight: "{size.height.L}",
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderWidth: "{border.width.none}",
        borderRadius: "{radius.none}",
        height: 0,
        paddingX: 15,
        paddingY: 11,
        fontWeight: 700,
      },
    },
    structure: {
      archetype: "simple",
      element: "div",
      containerStyles: {
        position: "sticky",
        background: "{color.layer-2}",
        text: "{color.neutral-subdued}",
        // ADR-171 Phase 3 (2026-07-29): archetype base 가 생성 CSS 에만 emit 하던 값이라
        //   catalog 를 읽는 Skia 에는 안 갔다 (G2 잔존). 실효 DOM 값 그대로 이관 — 값 불변.
        display: "inline-flex",
        alignItems: "center",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
      },
    },
  },
  Heading: {
    defaultVariant: "default",
    defaultSize: "M",
    // ADR-151 B22 잔여 (2026-07-16): Text 동형 — generated CSS base `width: 100%` 를
    //   layout 이 미소비 (flex 부모에서 Skia 80 vs CSS 350 실측). layout fallback
    //   채널(top-level)로 공급. CSS 는 기존 규칙 그대로 — generated CSS diff 0.
    containerStyles: {
      width: "100%",
    },
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
        },

        // 2026-06-24: textWeight 700 → 600 (Heading 시각 정본 정합). standalone/Toast/Card/Dialog
        //   Heading factory inline 이 fontWeight 600 으로 일관(4곳) — Skia(style.fontWeight 600 우선)
        //   ·CSS(inline 600) 둘 다 600 렌더라 catalog 700 은 dead 였고, dirty baseline 만 700 으로
        //   잡혀 false dirty. 600 흡수로 baseline=시각 정본. InlineAlert Heading 은 InlineAlert.sizes
        //   .headingFontWeight=700 별도 경로(당시 StoreRenderBridge/fullTreeLayout — 삭제됨)라 무영향.
        //   (이전: buildCatalogShapes fallback 500 drift 차단용 700 명시 — 정본 재판정으로 600)
        textWeight: 600,
      },
    },
    sizes: {
      XS: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      S: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      M: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      L: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      XL: {
        fontSize: "{typography.text-xl}",
        lineHeight: "{typography.text-xl--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      XXL: {
        fontSize: "{typography.text-2xl}",
        lineHeight: "{typography.text-2xl--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      XXXL: {
        fontSize: "{typography.text-3xl}",
        lineHeight: "{typography.text-3xl--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    structure: {
      archetype: "text",
      element: "p",
      containerStyles: {
        display: "block",
        width: "100%",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
      },
    },
  },
  Icon: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
            isSearchFieldPart: SEARCH_FIELD_CONTENT,
          },
        },
      },
    },
    sizes: {
      XS: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 14,
        iconSize: "{size.icon.XS}",
      },
      S: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 16,
        iconSize: "{size.icon.S}",
      },
      M: {
        fontSize: "{typography.text-2xl}",
        borderRadius: "{radius.none}",
        height: 18,
        iconSize: "{size.icon.M}",
      },
      L: {
        fontSize: "{typography.text-4xl}",
        borderRadius: "{radius.none}",
        height: 20,
        iconSize: "{size.icon.L}",
      },
      XL: {
        fontSize: "{typography.text-5xl}",
        borderRadius: "{radius.none}",
        height: 22,
        iconSize: "{size.icon.XL}",
      },
    },
    structure: {
      archetype: "simple",
      element: "span",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
        ...DISABLED_STATE,
      },
    },
  },
  IllustratedMessage: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
    },
    // 2026-10-09 (사용자 「IllustratedMessage 제목 · 설명 노드 전환」 → 「레퍼런스에 맞게」 → 「(a) 로
    //   진행해, orientation 도 같이 넣어」): S2 `@react-spectrum/s2/src/IllustratedMessage.tsx` — no
    //   padding, no box; the picture · heading · content are child nodes (Illustration · Heading ·
    //   Description), their sizes from this size (`CATALOG_SIZE_STEP`). The parts' places are the
    //   `orientation` blocks below (`rulePartRules.ts` reads them for the Canvas, the generated sheet
    //   for the Preview).
    sizes: {
      S: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: "auto",
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: "auto",
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: "auto",
      },
    },
    structure: {
      archetype: "container",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
      },
      composition: {
        // S2 vertical rows: picture → heading 12 (L 8), heading → content 4.
        containerStyles: {
          "--im-illustration-gap": scaledLengthRef(12),
        },
        containerVariants: {
          size: {
            L: {
              styles: {
                "--im-illustration-gap": scaledLengthRef(8),
              },
            },
          },
          orientation: {
            // S2 vertical: centred column, `textAlign: center` (on the text parts — the Canvas
            //   paints a text leaf's alignment, not a container's), max width 380.
            vertical: {
              styles: {
                display: "flex",
                "flex-direction": "column",
                "align-items": "center",
                "max-width": scaledLengthRef(380),
              },
              nested: [
                {
                  selector: "> .react-aria-Illustration",
                  styles: {
                    "margin-bottom": "var(--im-illustration-gap)",
                  },
                },
                {
                  selector: "> .react-aria-Heading",
                  styles: {
                    "margin-bottom": scaledLengthRef(4),
                    "text-align": "center",
                  },
                },
                {
                  selector: '> [slot="description"]',
                  styles: {
                    "text-align": "center",
                  },
                },
              ],
            },
            // S2 horizontal: the picture spans the rows left of the heading (row end) and the
            //   content (row start), 12 apart, 4 between them; max width 528, start-aligned text.
            horizontal: {
              styles: {
                display: "grid",
                "grid-template-columns": "auto 1fr",
                "grid-template-rows": "1fr 1fr",
                "column-gap": scaledLengthRef(12),
                "row-gap": scaledLengthRef(4),
                "max-width": scaledLengthRef(528),
              },
              nested: [
                {
                  selector: "> .react-aria-Illustration",
                  styles: {
                    "grid-column": "1",
                    "grid-row": "1 / 3",
                    "align-self": "center",
                  },
                },
                {
                  selector: "> .react-aria-Heading",
                  styles: {
                    "grid-column": "2",
                    "grid-row": "1",
                    "align-self": "end",
                    "text-align": "start",
                  },
                },
                {
                  selector: '> [slot="description"]',
                  styles: {
                    "grid-column": "2",
                    "grid-row": "2",
                    "align-self": "start",
                    "text-align": "start",
                  },
                },
              ],
            },
          },
        },
        delegation: [],
      },
    },
  },
  // 2026-10-09 — the S2 IllustratedMessage's svg picture (`@react-spectrum/s2/src/Icon.tsx`
  //   `illustrationStyles` size S 48 · M 96 · L 160, `--iconPrimary` neutral). `height === iconSize`:
  //   the glyph is its box (Icon 동형).
  Illustration: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
    },
    sizes: {
      S: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: scaled(48),
        iconSize: scaled(48),
      },
      M: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: scaled(96),
        iconSize: scaled(96),
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: scaled(160),
        iconSize: scaled(160),
      },
    },
    structure: {
      archetype: "simple",
      element: "span",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
    },
  },
  Image: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.neutral-subtle}",
            isHovered: "{color.neutral-subtle}",
            isPressed: "{color.neutral-subtle}",
          },
          color: {
            default: "{color.neutral-subdued}",
          },
        },
      },
    },
    sizes: {
      S: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 120,
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 200,
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 320,
      },
    },
  },
  InlineAlert: {
    defaultVariant: "informative",
    defaultSize: "M",
    // S2 1.8.0 fillStyle — 값 이름은 S2 그대로 `border` · `subtleFill` · `boldFill` (2026-10-13 —
    //   2026-10-10 에는 house 이름 outline · subtle · bold 였다, 옛 문서는 로드 시 1회 전환).
    //   `fillStyleValues` 가 값 → fill 을 잇는다 (Canvas paint · 생성 CSS `[data-fill-style]` 이
    //   같이 읽음): border = fill.outline — 바탕 배경 + variant 색 테두리 (S2 기본), subtleFill =
    //   fill.subtle — variant-subtle 배경 (생성 CSS 가 테두리 transparent — S2), boldFill = 기본
    //   fill — variant 본색 배경 + 흰 글자 (notice 는 검정, neutral 의 본색은 neutral-subdued —
    //   S2 InlineAlert.tsx). colors.text 는 boldFill 의 글자색이고 subtleText · outlineText 가
    //   나머지를 준다. 제목 · 설명 자식의 boldFill 글자색은 파생 color (`presence.ts`
    //   catalogInlineAlertBoldText).
    fillStyleValues: { outline: "border", subtle: "subtleFill" },
    variants: {
      neutral: {
        paint: {
          backgroundColor: {
            default: "{color.neutral-subdued}",
            isHovered: "{color.neutral-subdued}",
            isPressed: "{color.neutral-subdued}",
            fillStyle: {
              border: "{color.base}",
              subtleFill: "{color.neutral-subtle}",
            },
          },
          color: {
            default: "{color.white}",
            fillStyle: {
              border: "{color.neutral}",
              subtleFill: "{color.neutral}",
            },
          },
          borderColor: {
            default: "{color.neutral-subdued}",
            // S2 `InlineAlert.tsx` — subtleFill 은 테두리 transparent (ADR-297 3h #11)
            fillStyle: {
              subtleFill: "{color.transparent}",
            },
          },
        },
      },
      // S2 1.8.0 값 정렬 (2026-10-10): info → informative.
      informative: {
        paint: {
          backgroundColor: {
            default: "{color.informative-background}",
            isHovered: "{color.informative-background}",
            isPressed: "{color.informative-background}",
            fillStyle: {
              border: "{color.base}",
              subtleFill: "{color.informative-subtle}",
            },
          },
          color: {
            default: "{color.white}",
            fillStyle: {
              border: "{color.neutral}",
              subtleFill: "{color.neutral}",
            },
          },
          borderColor: {
            default: "{color.informative}",
            // S2 `InlineAlert.tsx` — subtleFill 은 테두리 transparent (ADR-297 3h #11)
            fillStyle: {
              subtleFill: "{color.transparent}",
            },
          },
        },
      },
      positive: {
        paint: {
          backgroundColor: {
            default: "{color.positive-background}",
            isHovered: "{color.positive-background}",
            isPressed: "{color.positive-background}",
            fillStyle: {
              border: "{color.base}",
              subtleFill: "{color.positive-subtle}",
            },
          },
          color: {
            default: "{color.white}",
            fillStyle: {
              border: "{color.neutral}",
              subtleFill: "{color.neutral}",
            },
          },
          borderColor: {
            default: "{color.positive}",
            // S2 `InlineAlert.tsx` — subtleFill 은 테두리 transparent (ADR-297 3h #11)
            fillStyle: {
              subtleFill: "{color.transparent}",
            },
          },
        },
      },
      notice: {
        paint: {
          backgroundColor: {
            default: "{color.notice-background}",
            isHovered: "{color.notice-background}",
            isPressed: "{color.notice-background}",
            fillStyle: {
              border: "{color.base}",
              subtleFill: "{color.notice-subtle}",
            },
          },
          color: {
            default: "{color.black}",
            fillStyle: {
              border: "{color.neutral}",
              subtleFill: "{color.neutral}",
            },
          },
          borderColor: {
            default: "{color.notice}",
            // S2 `InlineAlert.tsx` — subtleFill 은 테두리 transparent (ADR-297 3h #11)
            fillStyle: {
              subtleFill: "{color.transparent}",
            },
          },
        },
      },
      negative: {
        paint: {
          backgroundColor: {
            default: "{color.negative-background}",
            isHovered: "{color.negative-background}",
            isPressed: "{color.negative-background}",
            fillStyle: {
              border: "{color.base}",
              subtleFill: "{color.negative-subtle}",
            },
          },
          color: {
            default: "{color.white}",
            fillStyle: {
              border: "{color.neutral}",
              subtleFill: "{color.neutral}",
            },
          },
          borderColor: {
            default: "{color.negative}",
            // S2 `InlineAlert.tsx` — subtleFill 은 테두리 transparent (ADR-297 3h #11)
            fillStyle: {
              subtleFill: "{color.transparent}",
            },
          },
        },
      },
    },
    // ADR-912 단계5 step4 (2026-06-17): InlineAlert spec 삭제 대비 containerStyles 보충.
    //   factory createDefaultInlineAlertProps()={} 라 InlineAlert 컨테이너 base layout 이 100%
    //   spec.containerStyles 의존 → spec 삭제 시 resolveContainerStylesFallback("inlinealert")가
    //   {} 반환 → Skia/Taffy flexDirection:column 소실(자식 Heading/Description 가로 배치 회귀,
    //   DOM generated CSS 는 flex/column emit → D3 대칭 위반). builder LOWERCASE_COMPONENT_RULE_CONTAINER
    //   fallback 이 본 필드를 읽어 복구(ListBox/Menu/TagGroup 동형). STRUCTURE_META.containerStyles(CSS emit)와
    //   별개 역할 — 둘 다 동일 4필드 보유 필수.
    containerStyles: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      width: "100%",
    },
    sizes: {
      // ADR-912 단계5 step4 (2026-06-17): InlineAlert spec 삭제 대비 sizes 보충.
      //   paddingY/gap = generated CSS base block(`padding`/`gap`) emit + Canvas 의 catalog 해석이
      //   같이 읽는다 (당시 consumer implicitStyles/StoreRenderBridge/fullTreeLayout 는 삭제됨).
      //   accentWidth(3/4/4)는 generated CSS/Skia 미emit dead 필드 → 미이관.
      //   ADR-254: 제목 · 설명의 글자 (종전 headingFontSize/Weight · descFontSize/Weight) 는
      //   Heading · Description 원본의 instance 가 자기 rule 로 그린다 — InlineAlert 의 size 를
      //   받아서 (`CATALOG_SIZE_PROPAGATION` · `CATALOG_SIZE_STEP`, 설명은 한 단계 위).
      S: {
        paddingX: 8,
        paddingY: 8,
        gap: 8,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.lg}",
        height: "auto",
      },
      M: {
        paddingX: 16,
        paddingY: 16,
        gap: 12,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: "auto",
      },
      L: {
        paddingX: 24,
        paddingY: 24,
        gap: 16,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.lg}",
        height: "auto",
      },
    },
    structure: {
      archetype: "alert",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        width: "100%",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
      },
      // S2 InlineAlert icon (2026-10-13 — `inlineAlertIcon.ts`): the alert draws its variant's icon
      //   at the padding box's top end (S2 floats it inline-end; the engine has no float). The
      //   title keeps clear of it: placed (ADR-253 — a parent rule places its parts, their shape is
      //   their own) stretched to the content width less the icon's size
      //   (`CATALOG_INLINE_ALERT_ICON_SIZE`) as its end margin. Neutral has no icon.
      composition: {
        containerVariants: {
          variant: {
            informative: {
              nested: [
                {
                  selector: "> .react-aria-Heading",
                  styles: {
                    width: "auto",
                    "align-self": "stretch",
                    "margin-right": "20px",
                  },
                },
              ],
            },
            positive: {
              nested: [
                {
                  selector: "> .react-aria-Heading",
                  styles: {
                    width: "auto",
                    "align-self": "stretch",
                    "margin-right": "20px",
                  },
                },
              ],
            },
            notice: {
              nested: [
                {
                  selector: "> .react-aria-Heading",
                  styles: {
                    width: "auto",
                    "align-self": "stretch",
                    "margin-right": "20px",
                  },
                },
              ],
            },
            negative: {
              nested: [
                {
                  selector: "> .react-aria-Heading",
                  styles: {
                    width: "auto",
                    "align-self": "stretch",
                    "margin-right": "20px",
                  },
                },
              ],
            },
          },
        },
        delegation: [],
      },
    },
  },
  Input: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: "{color.base}",
          color: FIELD_INPUT_CONTENT,
          borderColor: FIELD_INPUT_BORDER,
        },
      },
      accent: {
        paint: {
          backgroundColor: "{color.base}",
          color: FIELD_INPUT_CONTENT,
          borderColor: {
            ...FIELD_INPUT_BORDER,
            default: "{color.accent-content}",
          },
        },
      },
      negative: {
        paint: {
          backgroundColor: "{color.base}",
          color: FIELD_INPUT_CONTENT,
          borderColor: {
            ...FIELD_INPUT_BORDER,
            default: "{color.selection-negative}",
          },
        },
      },
    },
    sizes: {
      // ADR-253 Phase 3: the Input rule is the one definition of a field's input box (the fields'
      //   rules declare none). Its height is its content — line height + paddingY×2 + border×2 —
      //   so the same block sizes the `<textarea>` of a TextArea, whose height is its `rows`.
      //   ADR-295 Phase 3: paddingY makes the one-line box the S2 control height on desktop (M 18 +
      //   5×2 + 4 = 32 — S2 line-height formula), and `minHeight` is that height token — the touch set
      //   (× 1.25) raises it in the Preview · Publish DOM (the text box is centred by `<input>`).
      XS: {
        fontSize: "{typography.text-2xs}",
        lineHeight: "{typography.text-2xs--line-height}",
        fontWeight: 400,
        borderRadius: "{radius.xs}",
        borderWidth: "{border.width.thick}",
        height: 0,
        minHeight: "{size.height.XS}",
        paddingX: ofHeight(3, 8),
        paddingY: 1,
      },
      S: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        fontWeight: 400,
        borderRadius: 7,
        borderWidth: "{border.width.thick}",
        height: 0,
        minHeight: "{size.height.S}",
        paddingX: ofHeight(3, 8),
        paddingY: 2,
      },
      M: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        fontWeight: 400,
        borderRadius: 8,
        borderWidth: "{border.width.thick}",
        height: 0,
        minHeight: "{size.height.M}",
        paddingX: ofHeight(3, 8),
        paddingY: 5,
      },
      L: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        fontWeight: 400,
        borderRadius: 9,
        borderWidth: "{border.width.thick}",
        height: 0,
        minHeight: "{size.height.L}",
        paddingX: ofHeight(3, 8),
        paddingY: 8,
      },
      XL: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        fontWeight: 400,
        borderRadius: 10,
        borderWidth: "{border.width.thick}",
        height: 0,
        minHeight: "{size.height.XL}",
        paddingX: ofHeight(3, 8),
        paddingY: 11,
      },
    },
    // ADR-253 Phase 3: the generated sheet of the field input — `.react-aria-Input` and the
    //   `<textarea>` RAC classes `.react-aria-TextArea` (`classAliases`). It replaces the manual
    //   `base.css` block and the TextField · ColorField delegations (size variables + states).
    structure: {
      archetype: "input-base",
      element: "input",
      // ADR-259 Phase 2: a prefix field's box Group (`FieldBox` — S2 `FieldGroup`) draws this box too.
      classAliases: ["TextArea", "FieldBox"],
      containerStyles: {
        display: "block",
        width: "100%",
      },
      stateStyles: {
        ...CONTROL_FOCUS,
        cursor: { default: "text", isDisabled: "default" },
        color: FIELD_INPUT_CONTENT,
        background: { isQuiet: "transparent" },
        borderColor: { ...FIELD_INPUT_BORDER_STATES, isQuiet: "transparent" },
        boxShadow: { isQuiet: "none" },
        borderRadius: { isQuiet: "0" },
        borderBottom: { isQuiet: "1px solid var(--neutral-outline)" },
        borderBottomColor: { isQuiet: FIELD_INPUT_BORDER },
        // (the browser's autofill paint — kept to the field colors)
        WebkitTextFillColor: { isAutofilled: "var(--fg) !important" },
        WebkitBoxShadow: {
          isAutofilled: "0 0 0 1000px var(--bg-inset) inset !important",
        },
        caretColor: { isAutofilled: "var(--fg)" },
      },
      composition: {
        delegation: [],
        rootSelectors: {
          "&::placeholder": {
            styles: {
              color: "var(--field-placeholder)",
              opacity: "1",
            },
          },
          "&[data-authored-color]::placeholder": {
            styles: { color: "inherit" },
          },
          "&": {
            styles: {
              margin: "0",
              "font-family": "inherit",
              transition: "border-color 200ms ease, color 200ms ease",
            },
          },
        },
      },
    },
  },
  Kbd: {
    defaultVariant: "default",
    defaultSize: "S",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.layer-2}",
            isHovered: "{color.layer-2}",
            isPressed: "{color.neutral-pressed}",
          },
          color: {
            default: "{color.neutral}",
          },
          borderColor: {
            default: "{color.border}",
          },
        },

        // ADR-912 위험군 해소(2026-06-04): Kbd catalog 측정/렌더 drift 차단. spec render.shapes
        //   fontFamily.mono + fontWeight 500(키 표시 약간 굵게, Kbd.spec L153) ↔ buildCatalogShapes
        //   fallback sans/500. fontFamily(mono) 명시 + textWeight 500(spec 일치).
        fontFamily: "JetBrains Mono, Consolas, monospace",

        textWeight: 500,
      },
    },
    sizes: {
      XS: {
        paddingX: 4,
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.xs}",
        borderWidth: "{border.width.thin}",
        height: 18,
      },
      S: {
        paddingX: 6,
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.sm}",
        borderWidth: "{border.width.thin}",
        height: 22,
      },
      M: {
        paddingX: 8,
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.sm}",
        borderWidth: "{border.width.thin}",
        height: 26,
      },
      L: {
        paddingX: 10,
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.md}",
        borderWidth: "{border.width.thin}",
        height: 32,
      },
    },
    structure: {
      archetype: "simple",
      element: "kbd",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
      },
    },
  },
  // ADR-256 Phase 5g: a keyboard shortcut (RAC Keyboard — a MenuItem's shortcut). The reference
  //   `Menu.css` `kbd`: a small key chip — one step smaller text (`--font-size-sm`), 0 4px padding,
  //   small radius, a subtle fill and border, the item's font (not mono — unlike Kbd).
  Keyboard: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.neutral-subtle}",
            isHovered: "{color.neutral-subtle}",
            isPressed: "{color.neutral-subtle}",
          },
          color: {
            default: "{color.neutral}",
          },
          borderColor: {
            default: "{color.border}",
          },
        },

        textWeight: 400,
      },
    },
    sizes: {
      M: {
        paddingX: 4,
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.sm}",
        borderWidth: "{border.width.thin}",
        height: 18,
      },
    },
    structure: {
      archetype: "simple",
      element: "kbd",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
      // The item's font (the reference sets `font-family: system-ui`, not the `<kbd>` default
      //   monospace) — the Canvas draws the theme sans, the DOM inherits it.
      composition: {
        rootSelectors: {
          "&": {
            styles: {
              "font-family": "inherit",
            },
          },
        },
        delegation: [],
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
      },
    },
  },
  Label: {
    defaultVariant: "default",
    defaultSize: "M",
    // S2 1.8.2 controlFont: CJK는 크기와 관계없이 단위 없는 1.5.
    localeTypography: {
      ja: { lineHeight: 1.5 },
      ko: { lineHeight: 1.5 },
      zh: { lineHeight: 1.5 },
    },
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
            staticColor: {
              black: {
                default: "{color.transparent}",
                isHovered: "{color.transparent}",
                isPressed: "{color.transparent}",
              },
              white: {
                default: "{color.transparent}",
                isHovered: "{color.transparent}",
                isPressed: "{color.transparent}",
              },
            },
          },
          color: {
            default: "{color.neutral}",
            isDisabled: "{color.disabled-content}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
        },

        // S2 1.8.2 fieldLabel uses controlFont (regular). Keep this on the editable
        // Label origin so a Library edit propagates to every field consumer.
        textWeight: 400,
      },
    },
    sizes: {
      XS: {
        fontSize: "{typography.text-2xs}",
        lineHeight: "{typography.text-2xs--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      S: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      M: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      L: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      XL: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    // S2 Field의 Label은 실제 inline Text/NBSP/Icon 자식으로 조립된다.
    // Label.css의 크기 변수 상속은 유지하며, typed part layout은 DOM과 Rust에 함께 전달한다.
    structure: {
      archetype: "simple",
      element: "label",
      skipCSSGeneration: true,
      // 실제 자식의 inline display와 Icon baseline을 양쪽 renderer가 함께 읽는다.
      composition: {
        staticSelectors: {
          '.react-aria-Text[slot="label-content"]': {
            display: "inline",
            width: "fit-content",
            color: "{color.neutral-subdued}",
          },
          '.react-aria-Text[slot="necessity-label"]': {
            display: "inline",
            width: "fit-content",
            "white-space": "nowrap",
            "flex-shrink": "0",
            color: "{color.neutral-subdued}",
          },
          '.react-aria-Text[slot="necessity-space"]': {
            display: "inline",
            width: "fit-content",
            "flex-shrink": "0",
            color: "{color.neutral-subdued}",
          },
          '.react-aria-Icon[slot="necessity-icon"]': {
            display: "inline-flex",
            "vertical-align": "baseline",
            color: "{color.neutral-subdued}",
          },
        },
      },

      containerStyles: {
        display: "inline",
        width: "fit-content",
        height: "fit-content",
      },
    },
  },
  Link: {
    defaultVariant: "primary",
    defaultSize: "M",
    // S2 1.8.0 Link `isStandalone` (2026-10-10): 문단 밖 단독 링크 = medium weight (S2 Link.tsx
    //   `fontWeight: { isStandalone: 'medium' }`). Canvas 가 읽는 top-level 변형
    //   (`rulePaint.ts` catalogContainerVariantPaint — 작성한 weight 가 이김) 이고, DOM 은 수동
    //   `Link.css` 의 `[data-standalone]` 블록이 같은 값. 밑줄 축은 우리 Link 가 이미 rest 에서
    //   없음 (hover 에만) 이라 바뀌는 것이 weight 뿐이다.
    containerVariants: {
      standalone: {
        true: { styles: { "font-weight": "500" } },
      },
    },
    variants: {
      primary: {
        paint: {
          backgroundColor: {
            default: "{color.base}",
            isHovered: "{color.base}",
            isPressed: "{color.base}",
            staticColor: {
              black: {
                default: "{color.base}",
                isHovered: "{color.base}",
                isPressed: "{color.base}",
              },
              white: {
                default: "{color.base}",
                isHovered: "{color.base}",
                isPressed: "{color.base}",
              },
            },
          },
          color: {
            default: "{color.accent-content}",
            isHovered: "{color.accent-content-hover}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
        },
        alpha: 0,

        // 링크 400 (사용자 결정 2026-09-29): Canvas 는 textWeight 를, 생성 CSS 는 sizes.fontWeight 를 읽는다.
        textWeight: 400,
      },
      secondary: {
        paint: {
          backgroundColor: {
            default: "{color.base}",
            isHovered: "{color.base}",
            isPressed: "{color.base}",
            staticColor: {
              black: {
                default: "{color.base}",
                isHovered: "{color.base}",
                isPressed: "{color.base}",
              },
              white: {
                default: "{color.base}",
                isHovered: "{color.base}",
                isPressed: "{color.base}",
              },
            },
          },
          color: {
            default: "{color.neutral}",
            isHovered: "{color.accent-content}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
        },
        alpha: 0,

        textWeight: 400,
      },
    },
    sizes: {
      // ADR-151 B4 (2026-07-16): lineHeight 토큰 pair 명시 — 미정의 시 DOM 은 상속 1.5(md 21px),
      //   Skia layout 은 estimateTextHeight fallback(md 16px) 으로 3자 발산. Description/Button 동형.
      XS: {
        fontSize: "{typography.text-2xs}",
        lineHeight: "{typography.text-2xs--line-height}",
        fontWeight: 400,
        borderRadius: "{radius.none}",
        height: 0,
      },
      S: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        fontWeight: 400,
        borderRadius: "{radius.none}",
        height: 0,
      },
      M: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        fontWeight: 400,
        borderRadius: "{radius.none}",
        height: 0,
      },
      L: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        fontWeight: 400,
        borderRadius: "{radius.none}",
        height: 0,
      },
      XL: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        fontWeight: 400,
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    textDecoration: "underline",
    structure: {
      archetype: "button",
      element: "a",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "fit-content",
      },
      composition: {
        rootSelectors: {
          "&": {
            styles: {
              "text-decoration": "underline",
            },
          },
        },
        delegation: [],
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
        ...DISABLED_STATE,
        // ADR-297 Phase 3c — quiet: no underline until hovered; hover thins it (was `rootSelectors`)
        textDecoration: {
          isQuiet: { default: "none", isHovered: "underline" },
        },
        textDecorationThickness: { isHovered: "1.5px" },
      },
    },
  },
  ListBox: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            // ADR-303 (결정 4 a): S2 Menu · ListBox 는 자기 배경이 없고 컨테이너 (`--s2-container-bg`)
            //   를 따른다 — Popover 안이면 layer-2, Autocomplete · 카드 안이면 그 층.
            default: "{color.container}",
          },
          color: {
            default: "{color.neutral}",
          },
          borderColor: {
            default: "{color.border}",
          },
        },
      },
    },
    // ADR-912 단계5 step4 (2026-06-17): ListBox.spec.containerStyles 의 layout primitive 8필드 이관
    //   (Menu/TagGroup 선례). spec 삭제 후 builder resolveContainerStylesFallback 의 catalog 합성이
    //   본 필드를 읽어 Skia/Taffy layout(column-flex/gap/padding/maxHeight)을 보강 — 누락 시
    //   resolveContainerStylesFallback("listbox") 가 {} 반환 → column-flex 붕괴(DOM 정상=비대칭 회귀).
    //   색상(background/border)은 fallback KEYS 비대상 → Skia render shell variant 가 담당. gap 은
    //   spec `{spacing.2xs}`(=2), padding 은 `{spacing.xs}`(=4) 동일.
    // ADR-171 Phase 3-b (2026-07-29): `borderWidth: 1` 추가. top-level 은 structure 에서
    //   **시각 키(background/text/border/borderRadius)만** 뺀 layout subset 인데 borderWidth 를
    //   같이 뺐다 — borderWidth 는 시각이 아니라 box-model 키다(fallback allowlist 에 있는 이유가
    //   ADR-151 B1/B2 의 "generated CSS `border: 1px solid` 를 layout 이 미반영하는 border-box 2px
    //   발산 보정 채널"). 같은 슬립을 Calendar/RangeCalendar 는 B1/B2 때 이미 고쳤고 ListBox 만
    //   남아 있었다 — 실측 DOM h=52 / 캔버스 50 (Δ2, `catalogComponentBox.browser.test.ts`).
    //   생성기는 top-level 을 읽지 않고(`buildVirtualSpecs`) `resolveCatalogContainerBase` 는
    //   structure 에서 이미 같은 값을 받으므로, 변화는 캔버스 대체 경로 하나뿐이다.
    // 2026-07-29 사용자 결정: `maxHeight: "300px"` 고정값 제거. 컨테이너 높이는 내용이
    //   정하고, 잘라야 하면 요소별로 저작한다 — catalog 가 전 인스턴스에 300 을 강제할
    //   근거가 없다. `overflow:auto` 는 남긴다(높이를 저작하면 그때 스크롤이 살아난다).
    // 2026-10-13 (사용자 「listbox 를 RAC 레퍼런스 테마 기준으로」): the reference
    //   `ListBox.css` — no gap, a 0.5px border and the radius + spacing (12) corners. The 4 between
    //   the border and the items is the list's padding, not the items' margins (사용자 2026-10-13
    //   「margin은 없애고 react-aria-ListBox 에 padding으로」 — the reference puts it on the items).
    //   Its fixed sizes (250 wide · 100–300 high) stay out — 2026-07-29 사용자 결정: the author
    //   sizes the container.
    containerStyles: {
      display: "flex",
      flexDirection: "column",
      gap: "0px",
      padding: "{spacing.xs}",
      width: "100%",
      // overflow 는 두지 않는다 (사용자 결정 2026-11-13) — 아래 structure 주석.
      outline: "none",
      borderWidth: "{border.width.hairline}",
    },
    // ADR-295 후속: S2 picker `listbox({size})` (`ComboBox.tsx`) — the list's font is the picker size's control
    //   font, and its size is its items' (`CATALOG_SIZE_PROPAGATION` Select · ComboBox → ListBox → ListBoxItem).
    sizes: {
      XS: {
        paddingX: 4,
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.xl}",
        height: 0,
      },
      S: {
        paddingX: 4,
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.xl}",
        height: 0,
      },
      M: {
        paddingX: 4,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.xl}",
        height: 0,
      },
      L: {
        paddingX: 4,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.xl}",
        height: 0,
      },
      XL: {
        paddingX: 4,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 0,
      },
    },
    structure: {
      archetype: "collection",
      element: "div",
      containerStyles: {
        background: "{color.container}",
        text: "{color.neutral}",
        border: "{color.border}",
        borderWidth: "{border.width.hairline}",
        borderRadius: "{radius.xl}",
        padding: "{spacing.xs}",
        gap: "0px",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        // maxHeight 제거 — 위 top-level 주석 참조 (2026-07-29). 두 층을 같이 지워야
        //   생성 CSS(`.react-aria-ListBox { max-height }`)와 캔버스가 함께 풀린다.
        // overflow 도 두지 않는다 (사용자 결정 2026-11-13): `auto` 면 flex item 의 자동 최소 크기가 0 이라,
        //   높이가 정해진 세로 flex 부모 (Height 100% page body) 가 넘칠 때 목록을 눌렀다 (Chrome 과 Canvas
        //   엔진 같은 규칙). 스크롤은 picker 팝오버 안 목록만 — 아래 `overflow.inPopover` (S2 Picker ·
        //   ComboBox `listbox` 의 `overflow: auto`).
        outline: "none",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
        ...DISABLED_STATE,
        // ADR-297 Phase 3c — a picker's list in its Popover (the RAC reference `.dropdown-listbox` — was
        //   `rootSelectors["&:is(.react-aria-Popover *)"]`): no box of its own; an empty one keeps a row.
        display: { inPopover: "block" },
        overflow: { inPopover: "auto" },
        border: { inPopover: "none" },
        // S2 Picker · ComboBox: Popover `padding="none"` + 목록 `padding: 8` — 두 picker 의 한 값.
        padding: { inPopover: "var(--spacing-sm)" },
        background: { inPopover: "transparent" },
        borderRadius: { inPopover: "inherit" },
        minHeight: { inPopover: { isEmpty: "var(--spacing-2xl)" } },
        // (a document node's option row height — the Builder's own pickers have their own copy, ADR-305 `styles/widgets/ListBox.css`)
        "--lb-control-h": {
          inPopover: {
            isCatalogNode: {
              default: "var(--catalog-token-size-height-M)",
              size: {
                XS: "var(--catalog-token-size-height-XS)",
                S: "var(--catalog-token-size-height-S)",
                L: "var(--catalog-token-size-height-L)",
                XL: "var(--catalog-token-size-height-XL)",
              },
            },
          },
        },
      },
      // 2026-10-13 (사용자 「listbox 를 RAC 레퍼런스 테마 기준으로」) — the reference
      //   `ListBox.css` (stack · vertical) for a list standing on its own (a picker's list — in a
      //   Popover — is the reference's `.dropdown-listbox`, its own sheet). Over the manual
      //   `ListBox.css` (the Builder's own lists read their ADR-305 copy, `styles/widgets/ListBox.css` — not this
      //   generated sheet), hence the more specific selectors:
      //   - no item margins — the list's padding (4) holds the items off its border (사용자
      //     2026-10-13); the items do not shrink (`catalogListItemFlexShrink`);
      //   - a 0.5px line under each item but the last, inset 12 a side (`::after` — the Canvas
      //     draws it, `listBoxItem` `_lastItem`), hidden on a selected item, light between two;
      //   - adjacent selected items join: the touching corners square (multiple selection —
      //     사용자 2026-10-13 「인접한 두개를 선택시 border radius 가 인접한부분은 제외」);
      //   - the label 500, the description 12 in the item's color, the section header.
      //   (No margin between sections — the reference has none; G5 example 1's `--spacing-md` was
      //   the old starter's.)
      composition: {
        delegation: [],
        rootSelectors: {
          "&:not(.react-aria-Popover *)": {
            nested: {
              // (`flex-shrink: 0`: with the reference's min-height — 32, the item's
              //   `sizes.M.minHeight` — a column list of a fixed height would squeeze a
              //   two-line item to 32, the 2026-07-22 note; it scrolls instead.)
              ".react-aria-ListBoxItem": {
                "flex-shrink": "0",
                "--listbox-separator": "var(--border)",
              },
              ".react-aria-ListBoxItem:not(:last-child)::after": {
                content: "''",
                display: "block",
                position: "absolute",
                bottom: "0",
                width: "calc(100% - var(--spacing-xl))",
                "border-bottom":
                  "var(--border-width-hairline) solid var(--listbox-separator)",
              },
              ".react-aria-ListBoxItem[data-selected]": {
                "--listbox-separator": "transparent",
              },
              ".react-aria-ListBoxItem[data-selected]:has(+ [data-selected])": {
                "--listbox-separator":
                  "color-mix(in srgb, var(--fg-on-accent) 30%, transparent)",
                "border-end-start-radius": "0",
                "border-end-end-radius": "0",
              },
              ".react-aria-ListBoxItem[data-selected] + [data-selected]": {
                "border-start-start-radius": "0",
                "border-start-end-radius": "0",
              },
              ".react-aria-ListBoxItem[data-focus-visible]": {
                outline: "2px solid var(--focus-ring)",
                "outline-offset": "-2px",
                "z-index": "2",
              },
              ".react-aria-ListBoxItem[data-selected][data-focus-visible]": {
                "outline-color": "var(--fg-on-accent)",
                "outline-offset": "-4px",
              },
              ".react-aria-ListBoxItem[data-selected][data-pressed]": {
                background: "var(--accent-pressed)",
              },
              // (The label is the item's text — `.react-aria-Text` declares its own size and
              //   color, the reference's label inherits them: 14, the selected white.)
              '.react-aria-ListBoxItem [slot="label"]': {
                "font-size": "inherit",
                "line-height": "inherit",
                "font-weight": "500",
                color: "inherit",
              },
              '.react-aria-ListBoxItem [slot="description"]': {
                "font-size": "var(--text-xs)",
                "line-height": "var(--text-xs--line-height)",
                color: "inherit",
              },
              ".react-aria-ListBoxSection .react-aria-Header": {
                display: "block",
                position: "sticky",
                top: "calc(-1 * var(--border-width-hairline))",
                "z-index": "2",
                margin: "0",
                "font-size": "var(--text-xs)",
                "font-weight": "600",
                color: "var(--fg)",
                padding: "var(--spacing-xs) var(--spacing-lg)",
                background: "var(--bg-overlay)",
                "border-block":
                  "var(--border-width-hairline) solid var(--border)",
              },
            },
          },
          // Popover 목록의 실제 selection 부품은 item Layout이 배치한다. 옛 pseudo-check의
          // 24px gutter는 실제 부품이 없는 항목에만 적용한다. 양쪽 renderer의 기본 바깥
          // 여백은 ListBoxItem size rule의 edge-to-text가 소유한다.
          // ADR-295 후속 (사용자 결정 2026-10-31 「팝오버 안만 S2」): a picker's section header in a
          //   user component (`[data-catalog-id]` — the Builder's own pickers keep the block below,
          //   Decision 8) is S2 `listboxHeader` (`ComboBox.tsx` — Picker · ComboBox): minimum height
          //   the picker size's control height (the list's `data-size`), `centerPadding()` above and
          //   below, `edgeToText` (height × 3/8) at the sides, S2 `sectionHeading` text (ui bold),
          //   no surface or lines.
          "&[data-catalog-id]:is(.react-aria-Popover *)": {
            nested: {
              // ADR-295 후속: S2 `listboxItem` — the item's minimum height is the picker size's control
              //   height, its label centred in it (`(height − line) / 2`; the item's own line from its
              //   size block). Actual selection parts use the item's own size-based side padding.
              ".react-aria-ListBoxItem": {
                "min-height": "var(--lb-control-h)",
                "padding-top": "calc((var(--lb-control-h) - 1lh) / 2)",
                "padding-bottom": "calc((var(--lb-control-h) - 1lh) / 2)",
              },
              ".react-aria-Header": {
                "box-sizing": "border-box",
                "min-height": "var(--lb-control-h)",
                padding:
                  "calc((var(--lb-control-h) - var(--catalog-token-text-sm) * var(--catalog-token-text-sm--line-height)) / 2) calc(var(--lb-control-h) * 3 / 8)",
                "font-size": "var(--catalog-token-text-sm)",
                "line-height": "var(--catalog-token-text-sm--line-height)",
                "font-weight": "700",
                background: "transparent",
                "border-block": "0",
              },
            },
          },
          "&:is(.react-aria-Popover *)": {
            nested: {
              ".react-aria-ListBoxItem": { "font-weight": "500" },
              ".react-aria-ListBoxItem:not([data-selection-mark])": {
                padding:
                  "calc((var(--spacing-2xl) - 1lh) / 2) var(--spacing-md) calc((var(--spacing-2xl) - 1lh) / 2) var(--spacing-xl)",
              },
              ".react-aria-ListBoxItem[data-selected]:not([data-selection-mark])::before":
                {
                  content: "''",
                  position: "absolute",
                  top: "50%",
                  left: "var(--spacing-xs)",
                  translate: "0 -50%",
                  width: "var(--spacing-lg)",
                  height: "var(--spacing-lg)",
                  background: "currentColor",
                  mask: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6 9 17l-5-5'/%3E%3C/svg%3E\") center / contain no-repeat",
                },
              ".react-aria-ListBoxItem[data-selection-mark] > .react-aria-Icon:not([slot])":
                {
                  position: "absolute",
                  top: "50%",
                  left: "var(--spacing-xs)",
                  translate: "0 -50%",
                  width: "var(--spacing-lg)",
                  height: "var(--spacing-lg)",
                },
              '.react-aria-ListBoxItem [slot="label"]': {
                "font-size": "inherit",
                "line-height": "inherit",
                "font-weight": "500",
                color: "inherit",
              },
              '.react-aria-ListBoxItem [slot="description"]': {
                "font-size": "var(--text-xs)",
                "line-height": "var(--text-xs--line-height)",
                color: "inherit",
              },
              // (The item's icon after the check's 24 — the sheet's general icon is 12 in.)
              '.react-aria-ListBoxItem:not([data-selection-mark]) [slot="icon"]':
                {
                  left: "var(--spacing-xl)",
                },
              '.react-aria-ListBoxItem:not([data-selection-mark]):has([slot="icon"])':
                {
                  "padding-left":
                    "calc(var(--spacing-xl) + var(--lb-icon-size, 16px) + 6px)",
                },
              ".react-aria-Header": {
                display: "block",
                margin: "0",
                "font-size": "var(--text-xs)",
                "font-weight": "600",
                color: "var(--fg)",
                padding:
                  "var(--spacing-xs) var(--spacing-lg) var(--spacing-xs) calc(var(--spacing-xl) + var(--spacing-xs))",
                background: "var(--bg-overlay)",
                "border-block":
                  "var(--border-width-hairline) solid var(--border)",
              },
            },
          },
        },
      },
    },
  },
  ListBoxItem: {
    defaultVariant: "default",
    defaultSize: "M",
    // ADR-912 collection sub-part cutover (2026-06-14, gridlist_card escape 선례 동형):
    //   ListBoxItem.spec.render.shapes(selection/hover row-bg + icon + label fw600 +
    //   description neutral-subdued + check)를 rule + listbox_item skiaPrimitive(replace)로
    //   이전. 기본 행은 배경 없음(transparent) — selection(accent-subtle)/hover(layer-1)만
    //   row-bg 그림(escape 가 props.isSelected/state 보편 축으로 판정).
    // 2026-10-13 (사용자 「listbox 를 RAC 레퍼런스 테마 기준으로」): the reference
    //   `.react-aria-ListBoxItem` — no hover fill, the pressed highlight (`--highlight-hover` →
    //   the neutral-subtle wash), selected = the highlight pair (accent · on-accent; the item's
    //   Text children inherit it — `MANUAL_ITEM_LABEL_COLORS`). The DOM item carries
    //   `data-variant="default"` so this block reaches the sheet.
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.neutral-subtle}",
            isSelected: {
              default: "{color.accent}",
            },
            inPopover: COLLECTION_ITEM_BACKGROUND,
          },
          color: {
            default: "{color.neutral}",
            isSelected: {
              default: "{color.on-accent}",
            },
            inPopover: "{color.neutral}",
          },
          borderColor: {
            isSelected: {
              default: null,
            },
          },
        },

        // The item's own weight (`font: var(--font-size) system-ui`); its label is 500
        //   (`[slot='label']` — the ListBox part rule).
        textWeight: 400,
      },
    },
    // ADR-295 후속: S2 `listboxItem({size})` (`ComboBox.tsx` — Picker · ComboBox items) = `control({wrap, icon})`
    //   at the list's size (its picker's — `CATALOG_SIZE_PROPAGATION`): the control height as its minimum, the
    //   centring padding `(height − line) / 2`, `edge-to-text` at the sides, the control font. M keeps its
    //   notes below; the other sizes are the same form (MenuItem — S2 `menuitem` — has the same values).
    sizes: {
      XS: {
        fontSize: "{typography.text-2xs}",
        lineHeight: "{typography.text-2xs--line-height}",
        borderRadius: "{radius.lg}",
        height: 0,
        minHeight: "{size.height.XS}",
        borderWidth: "{border.width.none}",
        fontWeight: 400,
        paddingX: ofHeight(3, 8),
        paddingY: 3,
        gap: 2,
        iconSize: 16,
      },
      S: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.lg}",
        height: 0,
        minHeight: "{size.height.S}",
        borderWidth: "{border.width.none}",
        fontWeight: 400,
        paddingX: ofHeight(3, 8),
        paddingY: 4,
        gap: 2,
        iconSize: 16,
      },
      M: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        // The reference's `--radius` (8).
        borderRadius: "{radius.lg}",
        // height 0 = content-fit (행 시각 = label(+description) + padding).
        height: 0,
        // S2 `menuitem` (`control({wrap, icon})` — Picker · ComboBox · Menu items): the control height M
        //   with no border, the label centred in it — paddingY = (32 − 18) / 2 = 7 (ADR-295 Phase 3c-2; the
        //   generated CSS writes the formula over the device variables). (2026-07-22: an explicit
        //   min-height drops a flex column item's automatic minimum — a fixed-height list squeezed its
        //   items; the ListBox rule's item selector gives `flex-shrink: 0`, so they stay whole and the
        //   list scrolls.)
        minHeight: "{size.height.M}",
        borderWidth: "{border.width.none}",
        // The item's weight (normal — the reference's `font` shorthand); the label slot's 500 is
        //   the ListBox rule's item selector (the Canvas's ListBox part rule).
        fontWeight: 400,
        // paddingX = S2 `edge-to-text` (height × 3/8 — desktop 12) · paddingY = the S2 centring above
        //   (desktop result).
        paddingX: ofHeight(3, 8),
        paddingY: 7,
        // label↔description 수직 간격 (S2 menuitem description 2).
        gap: 2,
        // selection indicator / icon glyph 크기 (spec iconSize 16).
        iconSize: 16,
      },
      L: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.lg}",
        height: 0,
        minHeight: "{size.height.L}",
        borderWidth: "{border.width.none}",
        fontWeight: 400,
        paddingX: ofHeight(3, 8),
        paddingY: 10,
        gap: 2,
        iconSize: 16,
      },
      XL: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.lg}",
        height: 0,
        minHeight: "{size.height.XL}",
        borderWidth: "{border.width.none}",
        fontWeight: 400,
        paddingX: ofHeight(3, 8),
        paddingY: 13,
        gap: 2,
        iconSize: 16,
      },
    },
    structure: {
      archetype: "simple",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        // ADR-171 Phase 1 (2026-07-29): 수동 `ListBox.css` 의 실효값 이관 (값 불변).
        position: "relative",
      },
      stateStyles: {
        borderRadius: { inPopover: { size: FIELD_BUTTON_CORNERS } },
        // (ADR-297 Phase 3g: the option's keyboard ring sits inside it, a selected one's deeper — was the manual
        //   `ListBox.css`)
        outline: {
          default: "none",
          isFocusVisible: "2px solid var(--accent)",
        },
        outlineOffset: {
          isFocusVisible: {
            default: "-2px",
            isSelected: "-4px",
            inPopover: "2px",
          },
        },
        ...DISABLED_STATE,
        // (ADR-297 Phase 3b: the option's resting cursor — was the manual `ListBox.css` root)
        cursor: { default: "pointer", isDisabled: "not-allowed" },
        // S2 presses a picker's option (`Picker.tsx:783` · `ComboBox.tsx:467`) — not a standalone
        //   ListBox's (S2 `ListBox.tsx` has no `pressScale`).
        willChange: { inPopover: CATALOG_PRESS_WILL_CHANGE },
        transform: { isPressed: { inPopover: catalogPressTransform() } },
        transition: { inPopover: CATALOG_PRESS_TRANSITION },
      },
    },
  },
  Menu: {
    defaultVariant: "default",
    defaultSize: "M",
    // ADR-256 후속 4 (2026-10-09): a Menu node is RAC's `Menu` — the list — wherever it stands (in
    //   its MenuTrigger's Popover, open in an Autocomplete). The trigger is the MenuTrigger's
    //   Button node (its look the Button's): the top level is the list panel, the same values as
    //   `structure` (ListBox 동형). 종전 (ADR-151 B7 · 2026-10-06) top level 은 trigger 버튼
    //   (variant 색 · Button padding) 이었다 — Menu 노드가 trigger 와 목록을 같이 맡던 때.
    variants: {
      default: {
        paint: {
          backgroundColor: {
            // ADR-303 (결정 4 a): S2 Menu · ListBox 는 자기 배경이 없고 컨테이너 (`--s2-container-bg`)
            //   를 따른다 — Popover 안이면 layer-2, Autocomplete · 카드 안이면 그 층.
            default: "{color.container}",
          },
          color: {
            default: "{color.neutral}",
          },
          borderColor: {
            default: "{color.border}",
          },
        },
      },
    },
    containerStyles: {
      display: "flex",
      flexDirection: "column",
      gap: "{spacing.2xs}",
      padding: "{spacing.xs}",
      width: "100%",
      maxHeight: "300px",
      overflow: "auto",
      outline: "none",
      borderWidth: "{border.width.thin}",
    },
    sizes: {
      S: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.md}",
        height: 0,
      },
      M: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.md}",
        height: 0,
      },
      L: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.md}",
        height: 0,
      },
      XL: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.md}",
        height: 0,
      },
    },
    structure: {
      archetype: "collection",
      element: "div",
      containerStyles: {
        background: "{color.container}",
        text: "{color.neutral}",
        border: "{color.border}",
        borderWidth: "{border.width.thin}",
        borderRadius: "{radius.md}",
        padding: "{spacing.xs}",
        gap: "{spacing.2xs}",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxHeight: "300px",
        overflow: "auto",
        outline: "none",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
        ...DISABLED_STATE,
      },
      // S2 Menu는 Popover의 표면을 쓰고 목록은 8px inset만 갖는다.
      // standalone Menu의 표면은 유지하고 portal 안에서만 부모가 표면을 소유한다.
      composition: {
        delegation: [],
        externalStyles: [
          {
            selector:
              '.react-aria-Popover[data-trigger="MenuTrigger"][data-size]',
            styles: {
              padding: "0",
              width: "fit-content",
              "max-width": "320px",
            },
            nested: [
              {
                selector: "> .react-aria-Menu",
                styles: {
                  background: "transparent",
                  border: "none",
                  "border-radius": "0",
                  "box-shadow": "none",
                  outline: "none",
                  padding: "8px",
                  gap: "0",
                },
              },
            ],
          },
          {
            selector:
              '.react-aria-Popover[data-trigger="SubmenuTrigger"][data-size]',
            styles: {
              padding: "0",
              width: "fit-content",
              "max-width": "320px",
            },
            nested: [
              {
                selector: "> .react-aria-Menu",
                styles: {
                  background: "transparent",
                  border: "none",
                  "border-radius": "0",
                  "box-shadow": "none",
                  outline: "none",
                  padding: "8px",
                  gap: "0",
                },
              },
            ],
          },
        ],
      },
    },
  },
  MenuItem: {
    // ADR-297 Phase 3g — the selection glyph of a selectable menu's item (옛 수동 `Menu.css` — 열은 수동 sheet).
    partStateStyles: {
      '&[data-selection-mode="multiple"]%::before': {
        content: { isSelected: '"✓" / ""' },
      },
      '&[data-selection-mode="single"]%::before': {
        content: { isSelected: '"●" / ""' },
      },
    },
    defaultSize: "M",
    defaultVariant: "default",
    variants: {
      default: {
        paint: {
          backgroundColor: COLLECTION_ITEM_BACKGROUND,
        },
      },
    },
    // ADR-295 Phase 3c-3c ③: S2 `menuitem` = `control({ shape: 'default', icon: true })` — the control height as its
    //   minimum, the centring padding (`(height − line) / 2`), `edge-to-text` (height × 3/8) at both ends, an icon
    //   `text-to-visual` before its label; its size is its Menu's (`CATALOG_SIZE_PROPAGATION.Menu`).
    sizes: {
      S: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.sm}",
        borderWidth: "{border.width.none}",
        height: 0,
        minHeight: "{size.height.S}",
        paddingX: ofHeight(3, 8),
        paddingY: 4,
        gap: TEXT_TO_VISUAL,
      },
      M: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.md}",
        borderWidth: "{border.width.none}",
        height: 0,
        minHeight: "{size.height.M}",
        paddingX: ofHeight(3, 8),
        paddingY: 7,
        gap: TEXT_TO_VISUAL,
      },
      L: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.lg}",
        borderWidth: "{border.width.none}",
        height: 0,
        minHeight: "{size.height.L}",
        paddingX: ofHeight(3, 8),
        paddingY: 10,
        gap: TEXT_TO_VISUAL,
      },
      XL: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.xl}",
        borderWidth: "{border.width.none}",
        height: 0,
        minHeight: "{size.height.XL}",
        paddingX: ofHeight(3, 8),
        paddingY: 13,
        gap: TEXT_TO_VISUAL,
      },
    },
    structure: {
      archetype: "simple",
      element: "div",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
      stateStyles: {
        // RAC MenuItem은 public variant 축이 없다. CSS는 같은 칠 트리를 클래스에 적용한다.
        background: COLLECTION_ITEM_BACKGROUND,
        outline: { default: "none" },
        ...FOCUS_RING_STATE,
        ...DISABLED_STATE,
        // S2 `Menu.tsx:844` — every menu item presses (`transition: 'transform'`, `Menu.tsx:307`).
        ...PRESS_STATE,
        transition: CATALOG_PRESS_TRANSITION,
        // ADR-297 Phase 3c — a link item (RAC's `<a>`) keeps the item's text look (was `rootSelectors["&[href]"]`)
        textDecoration: { isLink: "none" },
        color: { isLink: "inherit" },
      },
      // ADR-259 Phase 1 (R4): a link MenuItem is RAC's `<a>` — no browser link underline or link
      //   color (the reference's `&[href]`): it keeps its Menu's text color like any item.
      composition: {
        // ADR-295 Phase 3c-3c ③: S2 menu `label` = the control font, medium; `description` one step down
        //   (`ui-xs` · `ui-sm` · `ui` · `ui-lg`) — the item's Text slots (a Text's own rule is the body font).
        sizeSelectors: {
          S: {
            '.react-aria-Text[slot="label"]': {
              "font-size": "var(--text-xs)",
              "line-height": "var(--text-xs--line-height)",
              "font-weight": "500",
            },
            '.react-aria-Text[slot="description"]': {
              "font-size": "var(--text-2xs)",
              "line-height": "var(--text-2xs--line-height)",
            },
          },
          M: {
            '.react-aria-Text[slot="label"]': {
              "font-size": "var(--text-sm)",
              "line-height": "var(--text-sm--line-height)",
              "font-weight": "500",
            },
            '.react-aria-Text[slot="description"]': {
              "font-size": "var(--text-xs)",
              "line-height": "var(--text-xs--line-height)",
            },
          },
          L: {
            '.react-aria-Text[slot="label"]': {
              "font-size": "var(--text-base)",
              "line-height": "var(--text-base--line-height)",
              "font-weight": "500",
            },
            '.react-aria-Text[slot="description"]': {
              "font-size": "var(--text-sm)",
              "line-height": "var(--text-sm--line-height)",
            },
          },
          XL: {
            '.react-aria-Text[slot="label"]': {
              "font-size": "var(--text-lg)",
              "line-height": "var(--text-lg--line-height)",
              "font-weight": "500",
            },
            '.react-aria-Text[slot="description"]': {
              "font-size": "var(--text-base)",
              "line-height": "var(--text-base--line-height)",
            },
          },
        },
        rootSelectors: {},
        delegation: [],
      },
    },
  },
  Meter: {
    defaultVariant: "informative",
    defaultSize: "M",
    // ADR-913 동형: label-position:side (Skia resolveActiveContainerVariants 소비 — 부모 flex-row).
    //   CSS 대칭 = structure.composition.containerVariants["label-position"], 자식 order 는 implicitStyles.
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            display: "flex",
            "flex-direction": "row",
            "align-items": "center",
          },
        },
      },
    },
    variants: {
      informative: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
            staticColor: {
              black: {
                default: "{color.transparent}",
                isHovered: "{color.transparent}",
                isPressed: "{color.transparent}",
              },
              white: {
                default: "{color.transparent}",
                isHovered: "{color.transparent}",
                isPressed: "{color.transparent}",
              },
            },
          },
          color: {
            default: "{color.neutral}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
        },
      },
      positive: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
            staticColor: {
              black: {
                default: "{color.transparent}",
                isHovered: "{color.transparent}",
                isPressed: "{color.transparent}",
              },
              white: {
                default: "{color.transparent}",
                isHovered: "{color.transparent}",
                isPressed: "{color.transparent}",
              },
            },
          },
          color: {
            default: "{color.neutral}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
        },
      },
      // S2 1.8.0 값 정렬 (2026-10-10): warning → notice.
      notice: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
            staticColor: {
              black: {
                default: "{color.transparent}",
                isHovered: "{color.transparent}",
                isPressed: "{color.transparent}",
              },
              white: {
                default: "{color.transparent}",
                isHovered: "{color.transparent}",
                isPressed: "{color.transparent}",
              },
            },
          },
          color: {
            default: "{color.neutral}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
        },
      },
      // S2 1.8.0 값 정렬 (2026-10-10): critical → negative.
      negative: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
            staticColor: {
              black: {
                default: "{color.transparent}",
                isHovered: "{color.transparent}",
                isPressed: "{color.transparent}",
              },
              white: {
                default: "{color.transparent}",
                isHovered: "{color.transparent}",
                isPressed: "{color.transparent}",
              },
            },
          },
          color: {
            default: "{color.neutral}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
        },
      },
    },
    sizes: {
      S: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.sm}",
        height: scaled(4),
        minWidth: "{size.bar.min-width}", // S2 `bar-utils.ts` `bar()` — Meter 도 ProgressBar 와 같은 최소 · 최대 폭 (ADR-295 Phase 3c-2b)
        maxWidth: scaled(768),
        gap: 4,
      },
      M: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.sm}",
        height: scaled(6),
        minWidth: "{size.bar.min-width}",
        maxWidth: scaled(768),
        gap: 4,
      },
      L: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.md}",
        height: scaled(8),
        minWidth: "{size.bar.min-width}",
        maxWidth: scaled(768),
        gap: 4,
      },
      XL: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.lg}",
        height: scaled(10),
        minWidth: "{size.bar.min-width}",
        maxWidth: scaled(768),
        gap: 4,
      },
    },
    structure: {
      archetype: "progress",
      element: "div",
      containerStyles: {
        display: "grid",
        gridTemplateAreas: '"label value" "bar bar"',
        gridTemplateColumns: "1fr auto",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
        ...DISABLED_STATE,
      },
      composition: {
        layout: "grid",
        containerStyles: {
          "box-sizing": "border-box",
          "row-gap": "var(--spacing-xs)",
          "column-gap": "var(--spacing-md)",
          width: "100%",
          color: "var(--fg)",
          "font-size": "var(--text-sm)",
          "--fill-color": "var(--informative)",
        },
        staticSelectors: {
          ".react-aria-Label": {
            "grid-area": "label",
            "white-space": "nowrap",
          },
          ".value": {
            "grid-area": "value",
            "font-size": "var(--text-sm)",
            color: "var(--fg-muted)",
            "white-space": "nowrap",
          },
          ".bar": {
            "grid-area": "bar",
            "box-shadow": "var(--inset-shadow-xs)",
            "forced-color-adjust": "none",
            height: scaledLengthRef(6),
            "border-radius": "var(--radius-sm)",
            overflow: "hidden",
            // (사용자 판정 2026-10-09: Meter track 은 회색 — MeterTrack rule 의 neutral-subtle 과 같은 값.)
            background: "var(--bg-muted)",
          },
          ".fill": {
            background: "var(--fill-color)",
            height: "100%",
            transition: "width 200ms ease-out",
            "forced-color-adjust": "auto",
          },
        },
        containerVariants: {
          // ADR-913 동형: label-position:side — progress 3요소(label/track/value) grid→flex-row.
          //   부모 flex-row + 자식 order(track 중간, value 끝) + track flex:1. Skia 자식 order 는
          //   implicitStyles ProgressBar/Meter 분기가 동일 값 주입 (D3 대칭).
          "label-position": {
            side: {
              styles: {
                display: "flex",
                "flex-direction": "row",
                "align-items": "center",
              },
              nested: [
                { selector: ".bar", styles: { order: "1", flex: "1" } },
                { selector: ".value", styles: { order: "2" } },
              ],
            },
          },
          variant: {
            informative: {
              styles: {
                "--fill-color": "var(--informative)",
              },
            },
            positive: {
              styles: {
                "--fill-color": "var(--positive)",
              },
            },
            // S2 1.8.0 값 정렬 (2026-10-10): warning → notice, critical → negative.
            notice: {
              styles: {
                "--fill-color": "var(--notice)",
              },
            },
            negative: {
              styles: {
                "--fill-color": "var(--negative)",
              },
            },
          },
          disabled: {
            true: {
              styles: {
                opacity: "0.38",
                cursor: "not-allowed",
                "pointer-events": "none",
              },
            },
          },
        },
        // 막대 두께 = S2 `progress-bar-thickness-*` 4 · 6 · 8 · 10 (기본 6 — `Meter.tsx` · `ProgressBar.tsx` trackStyles,
        //   ADR-295 Phase 3c-3c). S2 는 터치에서 × 1.25 (sizing) — 여기는 desktop 값.
        sizeSelectors: {
          S: {
            ".bar": {
              height: scaledLengthRef(4),
              "border-radius": "var(--radius-sm)",
            },
            ".value": {
              "font-size": "var(--text-xs)",
            },
          },
          M: {
            ".bar": {
              height: scaledLengthRef(6),
              "border-radius": "var(--radius-sm)",
            },
            ".value": {
              "font-size": "var(--text-sm)",
            },
          },
          L: {
            ".bar": {
              height: scaledLengthRef(8),
              "border-radius": "var(--radius-lg)",
            },
            ".value": {
              "font-size": "var(--text-base)",
            },
          },
          XL: {
            ".bar": {
              height: scaledLengthRef(10),
              "border-radius": "var(--radius-lg)",
            },
            ".value": {
              "font-size": "var(--text-lg)",
            },
          },
        },
        delegation: [],
      },
    },
  },
  // ADR-256 Phase 7b: the filled part of a Meter's track (`div.fill`). It takes its owner's variant
  //   (`catalogDerivedProps`); its color is the owner's DOM `--fill-color` (Meter `composition`
  //   variant block — informative · positive · notice · negative).
  MeterFill: {
    defaultVariant: "informative",
    defaultSize: "M",
    variants: {
      informative: {
        paint: {
          backgroundColor: {
            default: "{color.informative-visual}",
            isHovered: "{color.informative-visual}",
            isPressed: "{color.informative-visual}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
          color: {
            default: "{color.neutral}",
            staticColor: {
              black: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
              white: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
            },
          },
        },

        // (A static color fills at S2 `transparent-overlay-900` — 0.94.)
        staticAlpha: 0.94,
      },
      positive: {
        paint: {
          backgroundColor: {
            default: "{color.positive-visual}",
            isHovered: "{color.positive-visual}",
            isPressed: "{color.positive-visual}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
          color: {
            default: "{color.neutral}",
            staticColor: {
              black: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
              white: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
            },
          },
        },

        // (A static color fills at S2 `transparent-overlay-900` — 0.94.)
        staticAlpha: 0.94,
      },
      // S2 1.8.0 값 정렬 (2026-10-10): warning → notice.
      notice: {
        paint: {
          backgroundColor: {
            default: "{color.notice-visual}",
            isHovered: "{color.notice-visual}",
            isPressed: "{color.notice-visual}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
          color: {
            default: "{color.neutral}",
            staticColor: {
              black: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
              white: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
            },
          },
        },

        // (A static color fills at S2 `transparent-overlay-900` — 0.94.)
        staticAlpha: 0.94,
      },
      // S2 1.8.0 값 정렬 (2026-10-10): critical → negative.
      negative: {
        paint: {
          backgroundColor: {
            default: "{color.negative-visual}",
            isHovered: "{color.negative-visual}",
            isPressed: "{color.negative-visual}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
          color: {
            default: "{color.neutral}",
            staticColor: {
              black: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
              white: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
            },
          },
        },

        // (A static color fills at S2 `transparent-overlay-900` — 0.94.)
        staticAlpha: 0.94,
      },
    },
    // ADR-256 후속 11: the track's corners (the DOM fill is clipped by the rounded `.bar`; the Canvas
    //   clips to a rectangle, so the fill takes the track radius — a partial fill's end is rounded).
    sizes: {
      S: { borderRadius: "{radius.sm}" },
      M: { borderRadius: "{radius.sm}" },
      L: { borderRadius: "{radius.lg}" },
      XL: { borderRadius: "{radius.lg}" },
    },
    structure: {
      archetype: "progress",
      element: "div",
      containerStyles: {
        display: "block",
      },
    },
  },
  MeterTrack: {
    defaultVariant: "informative",
    defaultSize: "M",
    variants: {
      // The track's own box (neutral-subtle — the Meter sheet's `.bar` --bg-muted); its fill is the
      //   MeterFill node (ADR-256 Phase 7b).
      informative: {
        paint: {
          backgroundColor: {
            default: "{color.neutral-subtle}",
            isHovered: "{color.neutral-subtle}",
            isPressed: "{color.neutral-subtle}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
          color: {
            default: "{color.neutral}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
        },

        // (A value-fill track: a static color paints it at S2 `transparent-overlay-300` — 0.17.)
        fillBar: "{color.informative}",

        staticAlpha: 0.17,
      },
      positive: {
        paint: {
          backgroundColor: {
            default: "{color.neutral-subtle}",
            isHovered: "{color.neutral-subtle}",
            isPressed: "{color.neutral-subtle}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
          color: {
            default: "{color.neutral}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
        },

        // (A value-fill track: a static color paints it at S2 `transparent-overlay-300` — 0.17.)
        fillBar: "{color.positive}",

        staticAlpha: 0.17,
      },
      // S2 1.8.0 값 정렬 (2026-10-10): warning → notice.
      notice: {
        paint: {
          backgroundColor: {
            default: "{color.neutral-subtle}",
            isHovered: "{color.neutral-subtle}",
            isPressed: "{color.neutral-subtle}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
          color: {
            default: "{color.neutral}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
        },

        // (A value-fill track: a static color paints it at S2 `transparent-overlay-300` — 0.17.)
        fillBar: "{color.notice}",

        staticAlpha: 0.17,
      },
      // S2 1.8.0 값 정렬 (2026-10-10): critical → negative.
      negative: {
        paint: {
          backgroundColor: {
            default: "{color.neutral-subtle}",
            isHovered: "{color.neutral-subtle}",
            isPressed: "{color.neutral-subtle}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
          color: {
            default: "{color.neutral}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
        },

        // (A value-fill track: a static color paints it at S2 `transparent-overlay-300` — 0.17.)
        fillBar: "{color.negative}",

        staticAlpha: 0.17,
      },
    },
    // ADR-256 후속 11: the corners of the ProgressBar · Meter sheet's `.bar` · `.fill` (per size).
    sizes: {
      S: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: scaled(4),
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.sm}",
        height: scaled(6),
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: scaled(8),
      },
      XL: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.lg}",
        height: scaled(10),
      },
    },
    structure: {
      archetype: "progress",
      element: "div",
      containerStyles: {
        display: "grid",
      },
      stateStyles: {
        opacity: { isDisabled: 0.38 },
        pointerEvents: { isDisabled: "none" },
      },
    },
  },
  MeterValue: {
    defaultVariant: "informative",
    defaultSize: "M",
    variants: {
      informative: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
            staticColor: {
              black: {
                default: "{color.transparent}",
                isHovered: "{color.transparent}",
                isPressed: "{color.transparent}",
              },
              white: {
                default: "{color.transparent}",
                isHovered: "{color.transparent}",
                isPressed: "{color.transparent}",
              },
            },
          },
          color: {
            default: "{color.neutral}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
        },
      },
      positive: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
            staticColor: {
              black: {
                default: "{color.transparent}",
                isHovered: "{color.transparent}",
                isPressed: "{color.transparent}",
              },
              white: {
                default: "{color.transparent}",
                isHovered: "{color.transparent}",
                isPressed: "{color.transparent}",
              },
            },
          },
          color: {
            default: "{color.neutral}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
        },
      },
      // S2 1.8.0 값 정렬 (2026-10-10): warning → notice.
      notice: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
            staticColor: {
              black: {
                default: "{color.transparent}",
                isHovered: "{color.transparent}",
                isPressed: "{color.transparent}",
              },
              white: {
                default: "{color.transparent}",
                isHovered: "{color.transparent}",
                isPressed: "{color.transparent}",
              },
            },
          },
          color: {
            default: "{color.neutral}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
        },
      },
      // S2 1.8.0 값 정렬 (2026-10-10): critical → negative.
      negative: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
            staticColor: {
              black: {
                default: "{color.transparent}",
                isHovered: "{color.transparent}",
                isPressed: "{color.transparent}",
              },
              white: {
                default: "{color.transparent}",
                isHovered: "{color.transparent}",
                isPressed: "{color.transparent}",
              },
            },
          },
          color: {
            default: "{color.neutral}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
        },
      },
    },
    sizes: {
      S: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.none}",
        height: 16,
      },
      M: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.none}",
        height: 18,
      },
      L: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.none}",
        height: 20,
      },
      XL: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.none}",
        height: 22,
      },
    },
    structure: {
      archetype: "progress",
      element: "output",
      containerStyles: {
        display: "grid",
      },
    },
  },
  Modal: {
    defaultVariant: "default",
    defaultSize: "M",
    // S2 1.8.1 `Modal.tsx` `modalOverlayStyles.bg: transparent-black-500` — the scrim under an open
    // modal (a Dialog that opens its own modal reads it too). Canvas backdrop · DOM `ModalOverlay`.
    underlay: "{color.overlay-backdrop}",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            // ADR-303: S2 `Modal.tsx:145` `--s2-container-bg: layer-2` (the box under the Dialog).
            default: "{color.layer-2}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
    },
    sizes: {
      M: {
        // 사용자 2026-10-22 「`.react-aria-Modal { padding: 24px 24px }` 은 제거되는 게 맞다」: RAC
        //   starter `.react-aria-Modal` 은 padding 이 없다 — 본체 여백은 안의 Dialog 가 준다
        //   (Dialog rule paddingX/Y 24). 옛 24 는 spec 시대 값의 잔재 (ADR-912 단계5 step4, 2026-06-16)
        //   라 Modal 24 + Dialog 24 로 두 번 들어갔다 — Local page 카드가 본체를 열자 (ADR-279 후속)
        //   Canvas 에서도 드러났다. Calendar 선례 (`3f68a06b2`) 처럼 0 으로 명시.
        paddingX: 0,
        paddingY: 0,
        gap: 8,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.xl}",
        height: 0,
      },
    },
    structure: {
      archetype: "overlay",
      element: "div",
      // ADR-303 (사용자 결정 2 a, 2026-11-08): S2 `Modal.tsx` 는 boxShadow 가 없다 — 열린 Modal 은
      //   underlay (`overlay-backdrop`) 가 바탕과 분리한다 (Hub drop-shadow 「오버레이가 있으면 추가
      //   그림자는 필요 없다」). ADR-166 의 `{shadow.lg}` (= dragged) 상시 그림자 · 서열 주석은 대체됐다.
      composition: {
        rootSelectors: {},
        delegation: [],
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
        // ADR-297 Phase 3c — a DialogTrigger's Modal (was `rootSelectors["&[data-dialog-trigger]"]`)
        position: { isDialogTrigger: "relative" },
        maxHeight: { isDialogTrigger: "90vh" },
      },
    },
  },
  Nav: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.container}",
            isHovered: "{color.container}",
            isPressed: "{color.container}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
    },
    sizes: {
      S: {
        paddingX: 12,
        paddingY: 8,
        gap: 8,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 48,
      },
      M: {
        paddingX: 16,
        paddingY: 12,
        gap: 12,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.md}",
        height: 56,
      },
      L: {
        paddingX: 20,
        paddingY: 16,
        gap: 16,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.lg}",
        height: 64,
      },
    },
    structure: {
      archetype: "container",
      element: "nav",
      containerStyles: undefined,
      stateStyles: {
        ...FOCUS_RING_STATE,
        ...DISABLED_STATE,
      },
    },
  },
  NumberField: {
    defaultSize: "M",
    defaultVariant: "default",
    variants: { default: { paint: { color: TOGGLE_GROUP_LABEL } } },
    sizes: {
      // ADR-912 단계5 step4 small-B (2026-06-16): gap 보강 — spec 삭제 후 generated CSS `gap: Npx`
      //   재생성용 (NumberField.spec.sizes 미러). padding 은 composition.layout=flex-column root
      //   ownsContainerBox → 미emit 이라 보강 불요(gap 만).
      XS: {
        paddingX: 4,
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.xs}",
        height: 0,
        gap: centerPadding("XS"),
        iconSize: "{size.icon.XS}",
      },
      S: {
        paddingX: 8,
        fontSize: "{typography.text-xs}",
        borderRadius: 7,
        height: 0,
        gap: centerPadding("S"),
        iconSize: "{size.icon.S}",
      },
      M: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        borderRadius: 8,
        height: 0,
        gap: centerPadding("M"),
        iconSize: "{size.icon.M}",
      },
      L: {
        paddingX: 16,
        fontSize: "{typography.text-base}",
        borderRadius: 9,
        height: 0,
        gap: centerPadding("L"),
        iconSize: "{size.icon.L}",
      },
      XL: {
        paddingX: 24,
        fontSize: "{typography.text-lg}",
        borderRadius: 10,
        height: 0,
        gap: centerPadding("XL"),
        iconSize: "{size.icon.XL}",
      },
    },
    // ADR-913 후속 fix (2026-06-19): label-position:side 를 grid → flex-row 로 통일 (DateField/
    //   TimeField 동형). 기존 grid 정의는 CSS 만 grid 였고 Skia getSideLabelParentStyle 은 flex-row
    //   시뮬레이션이라 CSS↔Skia 비대칭이었다(+ factory inline flexDirection:column 이 CSS specificity
    //   로 grid selector 를 이겨 실제로는 양쪽 다 column 으로 무력화). flex-row 로 통일하면 generated
    //   CSS = Skia(getSideLabelParentStyle) 대칭 + Label fit-content 옆 정렬. Skia 는 styles 만 사용
    //   (nested DOM selector 는 generated CSS 전용 제외).
    // 2026-10-10: side 는 S2 `field()` 의 grid (`auto 1fr`) — structure.composition 의 side 블록 거울.
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            display: "grid",
            "grid-template-columns": "auto minmax(0, 1fr)",
            "align-items": "start",
          },
        },
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: {
        display: "flex",
      },
      stateStyles: {
        color: TOGGLE_GROUP_LABEL,
        cursor: { isDisabled: "default" },
      },
      composition: {
        // ADR-259 Phase 2: the S2 prefix in the control Group (`FIELD_PREFIX_*`).
        staticSelectors: { ...FIELD_PREFIX_STATIC },
        sizeSelectors: { ...FIELD_PREFIX_SIZES },
        layout: "flex-column",
        gap: "var(--spacing-xs)",
        containerStyles: {
          // 2026-07-15: field 패밀리 root width catalog 정본 (fieldFamilyWidthContract.test.ts).
          //   패널 Transform width = toStr(inline, specDefault, "auto") 이고 specDefault 가 이 값 →
          //   부재 시 "auto" 로 떨어진다 (DatePicker 적발 지점).
          width: "100%",
          color: "var(--fg)",
        },
        containerVariants: {
          "label-position": {
            side: {
              styles: {
                display: "grid",
                "grid-template-columns": "auto minmax(0, 1fr)",
                "align-items": "start",
              },
              // side 라벨 열 (2026-10-10 사용자 「모든 field · picker 컴퍼넌트 Label Position - Side 의 label width 가
              //   fit content 가 아니다 — slider 와 같은 패턴」): S2 `field()` (`style-utils.ts`) 처럼 grid —
              //   `auto 1fr` 두 열, 라벨은 1열 (글자 폭), 입력칸 · 도움말 · 오류 문구는 2열 (도움말이 입력칸 아래 같은 x).
              //   라벨 세로 위치: S2 는 baseline (입력칸 글자와 같은 줄) — 엔진에 grid baseline 이 없어 입력칸
              //   행의 가운데 (한 줄 입력칸에서 같은 자리). 그룹 (CheckboxGroup · RadioGroup) 은 위 — 첫 항목 줄.
              //   종전엔 라벨이 176px 고정 열이었다. side Form 은 안의 field 에 `--form-label-width` 를 주어
              //   라벨 열을 맞춘다 (S2 subgrid). Form 밖에서는 변수가 없고 top Form 은 auto — 글자 폭.
              //   text-align 은 `--form-label-align`(label-align variant 또는 Form 상속) 소비.
              //   자식 결합자(`>`)로 한정 — DatePicker popover 안 Calendar 라벨까지 매칭 방지.
              nested: [
                {
                  selector: "> .react-aria-Label",
                  styles: {
                    "grid-column": "1",
                    width: "var(--form-label-width)",
                    "align-self": "center",
                    "text-align": "var(--form-label-align, start)",
                    "justify-content": "var(--form-label-align, start)",
                  },
                },
                {
                  selector:
                    '> :not(.react-aria-Label, .react-aria-FieldError, [slot="description"])',
                  styles: {
                    "grid-column": "2",
                    "min-width": "0",
                  },
                },
                {
                  selector: "> .react-aria-FieldError",
                  styles: {
                    "grid-column": "2",
                  },
                },
                {
                  selector: '> [slot="description"]',
                  styles: {
                    "grid-column": "2",
                  },
                },
              ],
            },
          },
          "label-align": {
            end: {
              styles: {
                "--form-label-align": "end",
              },
            },
          },
        },
        // ADR-253: the Group only places its parts. The value is an instance of the Input origin (it
        //   draws the box) and the steppers are instances of the Button origin (secondary); what
        //   differs here in shape (square corners on the touching sides, no stepper padding) is
        //   written on the template positions.
        delegation: [
          {
            childSelector: ".react-aria-Group",
            bridges: {
              display: "flex",
              width: "100%",
            },
          },
          {
            childSelector: ".react-aria-Input",
            bridges: {
              flex: "1 1 0%",
              "min-width": "0",
            },
          },
          {
            // A stepper is a square of the control's height (the Input / Button box at each size —
            //   ADR-295 Phase 3: the S2 control height token, the same one the Input's min-height reads).
            childSelector: ".react-aria-Button",
            prefix: "nf-btn",
            variables: {
              XS: { "--nf-btn-size": "var(--catalog-token-size-height-XS)" },
              S: { "--nf-btn-size": "var(--catalog-token-size-height-S)" },
              M: { "--nf-btn-size": "var(--catalog-token-size-height-M)" },
              L: { "--nf-btn-size": "var(--catalog-token-size-height-L)" },
              XL: { "--nf-btn-size": "var(--catalog-token-size-height-XL)" },
            },
            bridges: {
              flex: "0 0 auto",
              width: "var(--nf-btn-size)",
              height: "var(--nf-btn-size)",
              // ADR-295 Phase 3: a field button (S2 — not a Button) does not take the Button's S2
              //   min-height (`{size.height.<S>}`) — its square is this size (placement, as `height`).
              "min-height": "0",
              "min-width": "0",
              "margin-inline-start": "-1px",
            },
          },
        ],
      },
    },
  },
  Pagination: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        // ADR-297 Phase 3 닫힘 — 묶음 컨테이너는 상자를 칠하지 않는다 (S2 그대로). 생성 CSS 는 composition 이
        //   상자를 가진 rule 의 variant 칠을 내지 않아 DOM 은 투명이었고, Canvas 만 트리의 바탕 · 테두리를 그렸다.
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
    },
    sizes: {
      S: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.sm}",
        height: 0,
      },
      M: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.md}",
        height: 0,
      },
      L: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.md}",
        height: 0,
      },
    },
    structure: {
      archetype: "default",
      element: "nav",
      // ADR-171 Phase 1 (2026-07-29): 수동 `Table.css` 의 Pagination 규칙 실효값 이관.
      //   archetype "default" base 가 emit 하던 inline-flex / center 는 실효가 아니었다 (값 불변).
      containerStyles: {
        display: "flex",
        justifyContent: "space-between",
        gap: "var(--spacing-sm)",
        // ADR-223 (2026-09-18): 미지정 archetype base 가 DOM 에만 주던 align-items:center 를 geometry
        //   채널로 이관 — row 의도와 일치하고 Skia 도 같은 값을 읽는다.
        alignItems: "center",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
        ...DISABLED_STATE,
      },
      composition: {
        containerStyles: {
          "--btn-radius": "var(--radius-md)",
          "--btn-font-size": "var(--text-base)",
          "--btn-transition": "background-color 200ms, opacity 200ms",
        },
        staticSelectors: {
          ".pagination-controls": {
            display: "flex",
            "align-items": "center",
            gap: "6px",
          },
          ".pagination-info": {
            "font-size": "var(--text-base)",
            color: "var(--fg-muted)",
            "text-align": "center",
          },
          ".pagination-ellipsis": {
            color: "var(--fg-muted)",
          },
          // (ADR-297 후속 ④: the page buttons are Button instances — their paint is the Button rule's tree per
          //  instance variant (the current page `accent`, the rest `secondary` outline — the template), on both
          //  consumers. The `[data-current]` blocks of the pre-node-tree renderer painted every button
          //  `--bg-overlay` in the DOM only — no node carries `data-current`.)
        },
        delegation: [],
      },
    },
  },
  Paragraph: {
    defaultVariant: "default",
    defaultSize: "M",
    // ADR-151 B22 잔여 (2026-07-16): Text 동형 — generated CSS base `width: 100%` 를
    //   layout 이 미소비 (flex 부모에서 fit-content 80 vs CSS 350 실측). layout
    //   fallback 채널(top-level)로 공급. CSS 는 기존 규칙 그대로 — generated CSS diff 0.
    containerStyles: {
      width: "100%",
    },
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
        },

        // ADR-912 위험군 해소(2026-06-04): Paragraph spec render.shapes fontWeight 400 ↔
        //   buildCatalogShapes fallback 500 drift 차단. variant.textWeight=400 명시.
        textWeight: 400,
      },
    },
    sizes: {
      XS: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      S: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      M: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      L: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      XL: {
        fontSize: "{typography.text-xl}",
        lineHeight: "{typography.text-xl--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      XXL: {
        fontSize: "{typography.text-2xl}",
        lineHeight: "{typography.text-2xl--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      XXXL: {
        fontSize: "{typography.text-3xl}",
        lineHeight: "{typography.text-3xl--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    structure: {
      archetype: "text",
      element: "p",
      containerStyles: {
        display: "block",
        width: "100%",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
      },
    },
  },
  Popover: {
    defaultVariant: "surface",
    defaultSize: "M",
    variants: {
      accent: {
        paint: {
          backgroundColor: {
            // ADR-303: S2 `Popover.tsx:83` `--s2-container-bg: layer-2` — every variant's surface.
            default: "{color.layer-2}",
          },
          color: {
            default: "{color.neutral}",
          },
          borderColor: {
            default: "{color.accent-content}",
          },
        },
      },
      neutral: {
        paint: {
          backgroundColor: {
            // ADR-303: S2 `Popover.tsx:83` `--s2-container-bg: layer-2` — every variant's surface.
            default: "{color.layer-2}",
          },
          color: {
            default: "{color.neutral}",
          },
          borderColor: {
            default: "{color.neutral-subtle}",
          },
        },
      },
      surface: {
        paint: {
          backgroundColor: {
            // ADR-303: S2 `Popover.tsx:83` `--s2-container-bg: layer-2` — every variant's surface.
            default: "{color.layer-2}",
          },
          color: {
            default: "{color.neutral}",
          },
          borderColor: {
            default: "{color.transparent}",
          },
        },
      },
    },
    // S2 Popover.tsx: 고정 size 폭, 8px 기본 content inset, size 무관 10px 모서리.
    sizes: {
      S: {
        width: 336,
        paddingX: 8,
        paddingY: 8,
        gap: 0,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.lg}",
        borderWidth: 0,
        height: 0,
      },
      M: {
        width: 416,
        paddingX: 8,
        paddingY: 8,
        gap: 0,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.lg}",
        borderWidth: 0,
        height: 0,
      },
      L: {
        width: 576,
        paddingX: 8,
        paddingY: 8,
        gap: 0,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.lg}",
        borderWidth: 0,
        height: 0,
      },
    },
    structure: {
      archetype: "overlay",
      element: "div",
      // 2026-07-25: overlay elevation 정본 이관. 값은 수동 `Popover.css` 의 실효값
      //   (index.css 로드 순서상 마지막이라 승리하던 선언) 그대로 — 시각 불변.
      //   **Why**: 그림자 정본이 수동 CSS 에만 있어 catalog 를 읽는 Style Panel 이
      //   Appearance → Box Shadow 를 "none" 으로 표시했다(D3 위반 — 수동 CSS 독립 정의).
      //   ADR-166 Phase 2: `{shadow.md}` = SP2 `elevated`. 구 값의 기하(0 4px 12px)가 SP2
      //   `elevated` 최상위 레이어와 정확히 일치하므로 근사가 아니라 **출처 복귀**다(ADR §9-4).
      //   ADR-166 Phase 4: 구 `popover_shadow` primitive(테마 무관 상수, 실측 결과 캔버스 출력
      //   0)를 은퇴시켜, 이 값이 DOM·Skia 양쪽의 유일한 그림자 소스가 됐다.
      containerStyles: {
        boxShadow: "{shadow.md}",
        maxWidth: "100%",
        outline: "1px solid var(--popover-outline)",
        // ADR-171 Phase 1 (2026-07-29): 수동 `Popover.css` 의 실효값 이관 (값 불변).
        display: "flex",
        flexDirection: "column",
      },
      composition: {
        delegation: [],
        rootSelectors: {
          "&": { styles: { "max-width": "calc(100vw - 24px)" } },
        },
      },
    },
  },
  ProgressBar: {
    defaultVariant: "default",
    defaultSize: "M",
    // ADR-913 동형: label-position:side (Skia resolveActiveContainerVariants 소비 — 부모 flex-row).
    //   CSS 대칭 = structure.composition.containerVariants["label-position"], 자식 order 는 implicitStyles.
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            display: "flex",
            "flex-direction": "row",
            "align-items": "center",
          },
        },
      },
    },
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
            staticColor: {
              black: {
                default: "{color.transparent}",
                isHovered: "{color.transparent}",
                isPressed: "{color.transparent}",
              },
              white: {
                default: "{color.transparent}",
                isHovered: "{color.transparent}",
                isPressed: "{color.transparent}",
              },
            },
          },
          color: {
            default: "{color.neutral}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
        },
      },
    },
    sizes: {
      S: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.sm}",
        height: scaled(4),
        minWidth: "{size.bar.min-width}", // S2 `bar-utils.ts` `minWidth: 48` (`size()` — 터치 60, ADR-295 Phase 3c-2)
        maxWidth: scaled(768),
        gap: 4,
      },
      M: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.sm}",
        height: scaled(6),
        minWidth: "{size.bar.min-width}",
        maxWidth: scaled(768),
        gap: 4,
      },
      L: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.md}",
        height: scaled(8),
        minWidth: "{size.bar.min-width}",
        maxWidth: scaled(768),
        gap: 4,
      },
      XL: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.md}",
        height: scaled(10),
        minWidth: "{size.bar.min-width}",
        maxWidth: scaled(768),
        gap: 4,
      },
    },
    structure: {
      archetype: "progress",
      element: "div",
      containerStyles: {
        display: "grid",
        gridTemplateAreas: '"label value" "bar bar"',
        gridTemplateColumns: "1fr auto",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
        ...DISABLED_STATE,
      },
      composition: {
        layout: "grid",
        containerStyles: {
          "box-sizing": "border-box",
          "row-gap": "var(--spacing-xs)",
          "column-gap": "var(--spacing-md)",
          width: "100%",
          color: "var(--fg)",
          "font-size": "var(--text-sm)",
          "--fill-color": "var(--accent-content)",
          "--track-color": "var(--accent-subtle)",
        },
        staticSelectors: {
          ".react-aria-Label": {
            "grid-area": "label",
            "white-space": "nowrap",
          },
          ".value": {
            "grid-area": "value",
            "font-size": "var(--text-sm)",
            color: "var(--fg-muted)",
            "white-space": "nowrap",
          },
          ".bar": {
            "grid-area": "bar",
            "box-shadow": "var(--inset-shadow-xs)",
            "forced-color-adjust": "none",
            height: scaledLengthRef(6),
            "border-radius": "var(--radius-sm)",
            overflow: "hidden",
            "will-change": "transform",
            background: "var(--track-color)",
          },
          ".fill": {
            "border-radius": "var(--radius-sm)",
            background: "var(--fill-color)",
            height: "100%",
            transition: "width 200ms ease-out",
          },
        },
        containerVariants: {
          // ADR-913 동형: label-position:side — progress 3요소(label/track/value) grid→flex-row.
          //   부모 flex-row + 자식 order(track 중간, value 끝) + track flex:1. Skia 자식 order 는
          //   implicitStyles ProgressBar/Meter 분기가 동일 값 주입 (D3 대칭).
          "label-position": {
            side: {
              styles: {
                display: "flex",
                "flex-direction": "row",
                "align-items": "center",
              },
              nested: [
                { selector: ".bar", styles: { order: "1", flex: "1" } },
                { selector: ".value", styles: { order: "2" } },
              ],
            },
          },
          indeterminate: {
            true: {
              nested: [
                {
                  // ADR-256 G5 (example 14): the reference's indeterminate fill keeps its box (the
                  //   whole track) and moves only its paint — the Canvas lays out the same box
                  //   (`catalogProgressFillLayout`) and draws it still.
                  selector: ".fill",
                  styles: {
                    width: "100%",
                    "border-radius": "inherit",
                    animation:
                      "ProgressBar-indeterminate 1.5s infinite ease-in-out",
                    "will-change": "opacity",
                  },
                },
              ],
            },
          },
          disabled: {
            true: {
              styles: {
                opacity: "0.38",
                cursor: "not-allowed",
                "pointer-events": "none",
              },
            },
          },
        },
        // 막대 두께 = S2 `progress-bar-thickness-*` 4 · 6 · 8 · 10 (기본 6 — `Meter.tsx` · `ProgressBar.tsx` trackStyles,
        //   ADR-295 Phase 3c-3c). S2 는 터치에서 × 1.25 (sizing) — 여기는 desktop 값.
        sizeSelectors: {
          S: {
            ".bar": {
              height: scaledLengthRef(4),
              "border-radius": "var(--radius-sm)",
            },
            ".fill": {
              "border-radius": "var(--radius-sm)",
            },
            ".value": {
              "font-size": "var(--text-xs)",
            },
          },
          M: {
            ".bar": {
              height: scaledLengthRef(6),
              "border-radius": "var(--radius-sm)",
            },
            ".fill": {
              "border-radius": "var(--radius-sm)",
            },
            ".value": {
              "font-size": "var(--text-sm)",
            },
          },
          L: {
            ".bar": {
              height: scaledLengthRef(8),
              "border-radius": "var(--radius-lg)",
            },
            ".fill": {
              "border-radius": "var(--radius-md)",
            },
            ".value": {
              "font-size": "var(--text-base)",
            },
          },
          XL: {
            ".bar": {
              height: scaledLengthRef(10),
              "border-radius": "var(--radius-lg)",
            },
            ".fill": {
              "border-radius": "var(--radius-lg)",
            },
            ".value": {
              "font-size": "var(--text-lg)",
            },
          },
        },
        animations: {
          indeterminate: {
            keyframes: {
              "0%, 100%": {
                opacity: "1",
              },
              "50%": {
                opacity: "0.4",
              },
            },
            reducedMotion: {
              "transition-duration": "0s",
            },
          },
        },
        delegation: [],
      },
    },
  },
  ProgressBarTrack: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.accent-subtle}",
            isHovered: "{color.accent-subtle}",
            isPressed: "{color.accent-subtle}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
          color: {
            default: "{color.neutral}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
        },

        // (A value-fill track: a static color paints it at S2 `transparent-overlay-300` — 0.17.)
        fillBar: "{color.accent-content}",

        staticAlpha: 0.17,
      },
    },
    // ADR-256 후속 11: the corners of the ProgressBar · Meter sheet's `.bar` · `.fill` (per size).
    sizes: {
      S: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: scaled(4),
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.sm}",
        height: scaled(6),
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: scaled(8),
      },
      XL: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.lg}",
        height: scaled(10),
      },
    },
    structure: {
      archetype: "progress",
      element: "div",
      containerStyles: {
        display: "grid",
      },
      stateStyles: {
        opacity: { isDisabled: 0.38 },
        pointerEvents: { isDisabled: "none" },
      },
    },
  },
  // ADR-256 Phase 7a: the filled part of a ProgressBar's track (reference `div.fill`). It takes its
  //   owner's variant (`catalogDerivedProps`); its color is the owner's DOM `--fill-color` (ProgressBar
  //   `composition` variant block) — default · accent: accent, neutral: neutral-subdued. Its box
  //   (radius · height) is the ProgressBar sheet's `.fill` (part rule), its width `{percentage}%`.
  ProgressBarFill: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.accent-content}",
            isHovered: "{color.accent-content}",
            isPressed: "{color.accent-content}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
          color: {
            default: "{color.neutral}",
            staticColor: {
              black: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
              white: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
            },
          },
        },

        // (A static color fills at S2 `transparent-overlay-900` — 0.94.)
        staticAlpha: 0.94,
      },
    },
    // ADR-256 후속 11: the corners of the ProgressBar · Meter sheet's `.bar` · `.fill` (per size).
    sizes: {
      S: { borderRadius: "{radius.sm}" },
      M: { borderRadius: "{radius.sm}" },
      L: { borderRadius: "{radius.md}" },
      XL: { borderRadius: "{radius.lg}" },
    },
    structure: {
      archetype: "progress",
      element: "div",
      containerStyles: {
        display: "block",
      },
    },
  },
  ProgressBarValue: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
            staticColor: {
              black: {
                default: "{color.transparent}",
                isHovered: "{color.transparent}",
                isPressed: "{color.transparent}",
              },
              white: {
                default: "{color.transparent}",
                isHovered: "{color.transparent}",
                isPressed: "{color.transparent}",
              },
            },
          },
          color: {
            default: "{color.neutral}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
        },
      },
    },
    sizes: {
      S: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.none}",
        height: 16,
      },
      M: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.none}",
        height: 18,
      },
      L: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.none}",
        height: 20,
      },
      XL: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.none}",
        height: 22,
      },
    },
    structure: {
      archetype: "progress",
      element: "output",
      containerStyles: {
        display: "grid",
      },
    },
  },
  ProgressCircle: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.neutral-subtle}",
            isHovered: "{color.neutral-subtle}",
            isPressed: "{color.neutral-subtle}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
          color: {
            default: "{color.neutral}",
            staticColor: {
              black: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
              white: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
            },
          },
        },
      },
    },
    // ADR-295 후속: 지름 = S2 `ProgressCircle.tsx` wrapper `size` (rem × `--s2-scale` — 터치 × 1.25) → `scaled`.
    //   선 굵기 = S2 `strokeWidth` S 2 · M 3 · L 4 (`pxToRem` — 터치에서도 그대로).
    sizes: {
      S: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.full}",
        height: scaled(16),
        indicator: { strokeWidth: 2 },
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.full}",
        height: scaled(32),
        indicator: { strokeWidth: 3 },
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.full}",
        height: scaled(64),
        indicator: { strokeWidth: 4 },
      },
    },
    structure: {
      archetype: "progress",
      element: "div",
      containerStyles: {
        display: "grid",
        // 지름은 줄어들지 않는다 — DOM 어댑터 (`ProgressCircle.tsx`) 가 늘 `flex-shrink: 0` 이었고
        //   Canvas 는 그 값을 몰라 높이가 정해진 세로 flex 부모에서 원을 눌렀다 (사용자 보고 2026-11-13
        //   「ProgressCircle 높이 0」). 두 consumer 가 이 값을 같이 읽는다.
        flexShrink: "0",
      },
    },
  },
  Radio: {
    // ADR-297 Phase 3g — the ring's states (옛 수동 `Radio.css`); 선택 고리 두께는 위 size 선택자.
    partStateStyles: {
      "& .react-aria-RadioButton%": { color: TOGGLE_LABEL },
      "& .react-aria-RadioButton% .indicator": RADIO_RING_STATE,
    },
    defaultVariant: "default",
    defaultSize: "M",
    // ADR-912 단계 5 step 2: replace-primitive measurement generic 전환 — variant.textWeight=400
    //   (Radio.spec label fontWeight 미emit → 측정 fallback 400 정합). [[Checkbox 참조]]
    variants: {
      default: {
        paint: {
          backgroundColor: RADIO_RING_STATE.background,
          borderColor: RADIO_RING_STATE.borderColor,
          color: TOGGLE_LABEL,
        },
        textWeight: 400,
      },
      emphasized: {
        paint: {
          backgroundColor: RADIO_RING_STATE.background,
          borderColor: RADIO_RING_STATE.borderColor,
          color: TOGGLE_LABEL,
        },
        textWeight: 400,
      },
    },
    sizes: {
      // ADR-912 단계5 step4 toggle-indicator 그룹 (2026-06-16): Radio.spec 삭제 대비 gap/paddingX/
      //   paddingY 보강 (Radio.css size 별 gap 6/8/10/12 + padding 0px 0px 정합). indicator(boxSize/
      //   dotSize)는 generated CSS 미emit(수동/React) → rule 불요.
      // indicator 채널 배선 (2026-08-21, design-data 감사 §1-3): Skia `radio` primitive 는
      //   size.indicator.{boxSize,dotSize} 를 읽으나 catalog 부재로 전 size 20/8 고정이었다.
      // ADR-295 Phase 3c-2b: 고리 = S2 `controlSize('sm')` (토큰 — 터치 × 1.25), 선택 고리 두께 = (높이 − 4) / 2
      //   라 가운데 흰 점은 늘 4 (`RADIO_DOT` — DOM 은 `RADIO_INDICATOR_SELECTORS`).
      S: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 0,
        paddingX: 0,
        paddingY: 0,
        gap: TEXT_TO_CONTROL,
        indicator: { boxSize: "{size.height-sm.S}", dotSize: RADIO_DOT },
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
        paddingX: 0,
        paddingY: 0,
        gap: TEXT_TO_CONTROL,
        indicator: { boxSize: "{size.height-sm.M}", dotSize: RADIO_DOT },
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
        paddingX: 0,
        paddingY: 0,
        gap: TEXT_TO_CONTROL,
        indicator: { boxSize: "{size.height-sm.L}", dotSize: RADIO_DOT },
      },
      XL: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
        paddingX: 0,
        paddingY: 0,
        gap: TEXT_TO_CONTROL,
        indicator: { boxSize: "{size.height-sm.XL}", dotSize: RADIO_DOT },
      },
    },
    // ADR-256 Phase 3 (2026-10-08): 레퍼런스 `RadioField > RadioButton (div.indicator + 글자) + Description`.
    //   이 rule 의 요소는 RAC `RadioField` (`div`) — 누르는 자리 · 도움말을 세로로. indicator · 글자의 행 (종전
    //   이 요소의 inline-flex 행 · size 별 gap) 은 `.react-aria-RadioButton` 블록 (`--radio-button-gap`, sizes
    //   파생). focus 표시는 RadioButton 의 것.
    structure: {
      archetype: "toggle-indicator",
      element: "div",
      containerStyles: {
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
      },
      stateStyles: {
        cursor: { isDisabled: "not-allowed" },
      },
      composition: {
        staticSelectors: {
          ".react-aria-RadioButton": {
            display: "inline-flex",
            "align-items": "center",
            gap: "var(--radio-button-gap)",
          },
        },
        rootSelectors: RADIO_INDICATOR_SELECTORS,
        delegation: [
          {
            // 행 gap — 크기별 gap 을 root 에 `--radio-button-gap` 으로 (sizes 파생, `variables: "auto"`).
            childSelector: ".react-aria-RadioButton",
            prefix: "radio-button",
            variables: "auto",
            autoKeys: ["gap"],
          },
        ],
      },
    },
  },
  RadioGroup: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        // ADR-297 Phase 3 닫힘 — 묶음 컨테이너는 상자를 칠하지 않는다 (S2 그대로). 생성 CSS 는 composition 이
        //   상자를 가진 rule 의 variant 칠을 내지 않아 DOM 은 투명이었고, Canvas 만 트리의 바탕 · 테두리를 그렸다.
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: TOGGLE_GROUP_LABEL,
        },
      },
    },
    sizes: {
      // ADR-912 단계5 step4 small-B (2026-06-16): gap 보강 — spec 삭제 후 generated CSS root `gap: Npx`
      //   재생성용 (RadioGroup.spec.sizes 미러). 자식 .radio-items gap 은 composition
      //   containerVariants.size 의 --radio-items-gap 별도 경로. padding 미emit(ownsContainerBox).
      S: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: 8,
      },
      M: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: 12,
      },
      L: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: 16,
      },
      XL: {
        fontSize: "{typography.text-xl}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: 20,
      },
    },
    // ADR-912 단계5 step4 (2026-06-17): RadioGroup.spec.composition.containerVariants 의
    //   label-position:side Skia 복구 — CheckboxGroup 동형(spec 삭제 91c2be0dd 로 side variant 회귀).
    //   catalog fallback 메커니즘 + 본 필드. CSS 변수/orientation nested 는 DOM generated CSS 전용.
    // 2026-10-10: side 는 S2 `field()` 의 grid (`auto 1fr`) — structure.composition 의 side 블록 거울.
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            display: "grid",
            "grid-template-columns": "auto minmax(0, 1fr)",
            "align-items": "start",
          },
        },
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: {
        display: "flex",
      },
      // S2는 그룹 전체를 흐리게 하지 않는다. 상태 색상은 각 부품이 소비한다.
      stateStyles: {
        color: TOGGLE_GROUP_LABEL,
        cursor: { isDisabled: "default" },
      },
      composition: {
        layout: "flex-column",
        gap: "var(--spacing-xs)",
        containerStyles: {
          color: "var(--fg)",
          "--radio-items-gap": "12px",
        },
        containerVariants: {
          size: {
            S: {
              styles: {
                "--radio-items-gap": "8px",
              },
            },
            L: {
              styles: {
                "--radio-items-gap": "16px",
              },
            },
          },
          "label-position": {
            side: {
              styles: {
                display: "grid",
                "grid-template-columns": "auto minmax(0, 1fr)",
                "align-items": "start",
              },
              // side 라벨 열 (2026-10-10 사용자 「모든 field · picker 컴퍼넌트 Label Position - Side 의 label width 가
              //   fit content 가 아니다 — slider 와 같은 패턴」): S2 `field()` (`style-utils.ts`) 처럼 grid —
              //   `auto 1fr` 두 열, 라벨은 1열 (글자 폭), 입력칸 · 도움말 · 오류 문구는 2열 (도움말이 입력칸 아래 같은 x).
              //   라벨 세로 위치: S2 는 baseline (입력칸 글자와 같은 줄) — 엔진에 grid baseline 이 없어 입력칸
              //   행의 가운데 (한 줄 입력칸에서 같은 자리). 그룹 (CheckboxGroup · RadioGroup) 은 위 — 첫 항목 줄.
              //   종전엔 라벨이 176px 고정 열이었다. side Form 은 안의 field 에 `--form-label-width` 를 주어
              //   라벨 열을 맞춘다 (S2 subgrid). Form 밖에서는 변수가 없고 top Form 은 auto — 글자 폭.
              //   text-align 은 `--form-label-align`(label-align variant 또는 Form 상속) 소비.
              //   자식 결합자(`>`)로 한정 — DatePicker popover 안 Calendar 라벨까지 매칭 방지.
              nested: [
                {
                  selector: "> .react-aria-Label",
                  styles: {
                    "grid-column": "1",
                    width: "var(--form-label-width)",
                    "text-align": "var(--form-label-align, start)",
                    "justify-content": "var(--form-label-align, start)",
                  },
                },
                {
                  selector:
                    '> :not(.react-aria-Label, .react-aria-FieldError, [slot="description"])',
                  styles: {
                    "grid-column": "2",
                    "min-width": "0",
                  },
                },
                {
                  selector: "> .react-aria-FieldError",
                  styles: {
                    "grid-column": "2",
                  },
                },
                {
                  selector: '> [slot="description"]',
                  styles: {
                    "grid-column": "2",
                  },
                },
              ],
            },
          },
          // S2 labelAlign (2026-10-09): the side label column's text alignment — the label's
          //   `text-align: var(--form-label-align, start)` above reads it (as the fields' block).
          "label-align": {
            end: {
              styles: {
                "--form-label-align": "end",
              },
            },
          },
          orientation: {
            vertical: {
              nested: [
                {
                  selector: ".radio-items",
                  styles: {
                    display: "flex",
                    "flex-direction": "column",
                    gap: "var(--radio-items-gap, var(--spacing-md))",
                  },
                },
              ],
            },
            horizontal: {
              nested: [
                {
                  selector: ".radio-items",
                  styles: {
                    display: "flex",
                    "flex-direction": "row",
                    "align-items": "center",
                    gap: "var(--radio-items-gap, var(--spacing-md))",
                  },
                },
              ],
            },
          },
        },
        delegation: [],
      },
    },
  },
  RangeCalendar: {
    // ADR-297 Phase 3g — the day cells' selected · focus (옛 수동 `RangeCalendar.css` · `CalendarCommon.css` —
    //   기간 시작 · 끝의 원과 띠는 수동 sheet 에 남는다).
    partStateStyles: {
      [RANGE_BAND]: { position: { isSelected: "relative" } },
      [`${RANGE_BAND}::before`]: RANGE_BAND_STATE,
      [`${RANGE_BAND}:has(> [data-selection-start])::before`]: RANGE_BAND_START,
      [`${RANGE_BAND}:first-child::before`]: RANGE_BAND_START,
      [`& .react-aria-CalendarGridBody td:has(> [data-outside-month]) + td:has(> .react-aria-CalendarCell%):not(:has(> [data-selection-start][data-selection-end]))::before`]:
        RANGE_BAND_START,
      [`${RANGE_BAND}:has(> [data-selection-end])::before`]: RANGE_BAND_END,
      [`${RANGE_BAND}:last-child::before`]: RANGE_BAND_END,
      [`${RANGE_BAND}:has(+ td > [data-outside-month])::before`]:
        RANGE_BAND_END,
      "& .react-aria-CalendarCell%": RANGE_CALENDAR_CELL_STATE,
      "& .react-aria-CalendarCell%::after": {
        background: {
          isToday: {
            isSelected: {
              default: "var(--accent)",
              isSelectionStart: "var(--fg-on-accent)",
              isSelectionEnd: "var(--fg-on-accent)",
            },
          },
        },
      },
    },
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        // (No background, hovered or pressed either — the references paint none, 사용자 2026-10-13
        //   「같이 지워」.)
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
    },
    // 2026-07-07 전수조사 fix: top-level containerStyles 추가 — Calendar 동형(spec 삭제 +
    //   structure.composition 부재). structure.containerStyles(width:fit-content)가 layout
    //   fallback 경로 A·B 둘 다 미도달 → 부모 flex-column stretch 발산. top-level 승격으로 경로 A
    //   도달. 상세는 Calendar rule 주석 참조.
    containerStyles: {
      display: "flex",
      flexDirection: "column",
      width: "fit-content",
      maxWidth: "100%",
    },
    // 사용자 2026-10-13 「RAC, RSC 레퍼런스 모두 border 가 존재하지 않고 padding 도 없다」: RAC
    //   starter `.react-aria-Calendar` · S2 `calendarStyles` 둘 다 border · padding · 배경이 없다 —
    //   picker 안 달력의 여백은 Popover 의 padding (S2 `CalendarPopover` · Popover rule).
    sizes: {
      // ADR-912 단계5 step4 date-color (2026-06-16): paddingX/paddingY/gap 보강 —
      //   RangeCalendar.spec(=...CalendarSpec spread) 삭제 대비 generated RangeCalendar.css
      //   (padding NNpx NNpx / gap NNpx) diff-0 유지. 값은 (구) CalendarSpec.sizes 와 동일
      //   (RangeCalendar 는 시각 = Calendar — selector 이름만 차이).
      M: {
        paddingX: 0,
        paddingY: 0,
        gap: 24,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.lg}",
        height: 0,
        iconSize: 26,
      },
    },
    structure: {
      archetype: "calendar",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "column",
        width: "fit-content",
        maxWidth: "100%",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
        ...DISABLED_STATE,
      },
    },
  },
  SearchField: {
    defaultSize: "M",
    defaultVariant: "default",
    variants: { default: { paint: { color: TOGGLE_GROUP_LABEL } } },
    // minWidth 없음 (ADR-295 Phase 3c-2): S2 TextField · SearchField 에는 min-width 가 없다 (2026-08-21 의 1.5 × · 3 ×
    //   높이는 Spectrum 1). 빌더 위젯은 이 시트를 싣지 않는다 — 295 전 하한은 빌더 사본 (ADR-305 `styles/widgets/`) 이 가진다.
    sizes: {
      // ADR-912 단계5 step4 small-B (2026-06-16): gap 보강 — spec 삭제 후 generated CSS `gap: Npx`
      //   재생성용 (SearchField.spec.sizes 미러). paddingY 는 composition.layout=flex-column root 가
      //   ownsContainerBox → padding 미emit 이라 보강 불요(gap 만).
      // iconSize = 그 크기 글자의 행간 (S2 control 안 아이콘 `size: '1lh'` — 터치 15 · 17 · 19 · 22 글자의 행간).
      S: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 0,
        gap: centerPadding("S"),
        columnGap: 0,
        iconSize: "{typography.text-xs--line-height}",
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 0,
        gap: centerPadding("M"),
        columnGap: 0,
        iconSize: "{typography.text-sm--line-height}",
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 0,
        gap: centerPadding("L"),
        columnGap: 0,
        iconSize: "{typography.text-base--line-height}",
      },
      XL: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 0,
        gap: centerPadding("XL"),
        columnGap: 0,
        iconSize: "{typography.text-lg--line-height}",
      },
    },
    // ADR-913 후속 fix (2026-06-19): label-position:side 를 grid → flex-row 로 통일 (DateField/
    //   TimeField/NumberField 동형). 기존 grid 는 CSS 전용이고 Skia getSideLabelParentStyle 은 flex-row
    //   라 비대칭 + factory inline flexDirection:column 이 grid selector 를 specificity 로 이겨 무력화.
    //   flex-row 통일로 generated CSS = Skia 대칭 복원. Skia sideMode 트리거 styles 만.
    // 2026-10-10: side 는 S2 `field()` 의 grid (`auto 1fr`) — structure.composition 의 side 블록 거울.
    // ADR-256 G5 (example 5): the reference's SearchField grid — no control Group. Columns `0px 1fr
    //   auto`: the search glyph overflows its empty column over the Input's start, the clear button
    //   sits over the Input's end. Rows are auto-placed (column numbers, not the reference's named
    //   areas), so an absent Label · description takes no row and no gap.
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            display: "grid",
            "grid-template-columns": "auto 0px minmax(0, 1fr) auto",
            "align-items": "center",
          },
        },
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: {
        display: "grid",
        gridTemplateColumns: "0px minmax(0, 1fr) auto",
        alignItems: "center",
      },
      stateStyles: {
        color: TOGGLE_GROUP_LABEL,
        cursor: { isDisabled: "default" },
      },
      composition: {
        layout: "grid",
        gap: "var(--spacing-xs)",
        containerStyles: {
          // 2026-06-24: width fit-content → 100% (field 패밀리 정본, TextField 와 동형 정정).
          //   factory inline(width:100%, FormComponents) ↔ CSS Preview(fit-content) 시각 비대칭 +
          //   Style Panel false dirty 해소. CSS 재생성 시 .react-aria-SearchField width:100%.
          width: "100%",
        },
        // The parts' columns (top label): the Label · description · error across, the glyph · the
        // Input · the clear button in one row.
        staticSelectors: {
          // (The Label · error keep their own width, as in the field's column — not stretched.)
          "> .react-aria-Label": {
            "grid-column": "1 / 4",
            "justify-self": "flex-start",
          },
          "> .react-aria-Icon": { "grid-column": "1" },
          "> .react-aria-Input": { "grid-column": "2" },
          "> .react-aria-Button": { "grid-column": "3" },
          '> [slot="description"]': { "grid-column": "1 / 4" },
          "> .react-aria-FieldError": {
            "grid-column": "1 / 4",
            "justify-self": "flex-start",
          },
        },
        containerVariants: {
          "label-position": {
            side: {
              styles: {
                display: "grid",
                "grid-template-columns": "auto 0px minmax(0, 1fr) auto",
                "align-items": "center",
              },
              // side 라벨 열 (2026-10-10 사용자 「모든 field · picker 컴퍼넌트 Label Position - Side 의 label width 가
              //   fit content 가 아니다 — slider 와 같은 패턴」): S2 `field()` (`style-utils.ts`) 처럼 grid —
              //   `auto 1fr` 두 열, 라벨은 1열 (글자 폭), 입력칸 · 도움말 · 오류 문구는 2열 (도움말이 입력칸 아래 같은 x).
              //   라벨 세로 위치: S2 는 baseline (입력칸 글자와 같은 줄) — 엔진에 grid baseline 이 없어 입력칸
              //   행의 가운데 (한 줄 입력칸에서 같은 자리). 그룹 (CheckboxGroup · RadioGroup) 은 위 — 첫 항목 줄.
              //   종전엔 라벨이 176px 고정 열이었다. side Form 은 안의 field 에 `--form-label-width` 를 주어
              //   라벨 열을 맞춘다 (S2 subgrid). Form 밖에서는 변수가 없고 top Form 은 auto — 글자 폭.
              //   text-align 은 `--form-label-align`(label-align variant 또는 Form 상속) 소비.
              //   자식 결합자(`>`)로 한정 — DatePicker popover 안 Calendar 라벨까지 매칭 방지.
              nested: [
                {
                  selector: "> .react-aria-Label",
                  styles: {
                    // (Both lines — the top layout's `1 / 4` must not reach the side one.)
                    "grid-column": "1 / 2",
                    // (No column gap — the glyph's column starts at the Input; the label keeps its gap.)
                    "margin-inline-end": "var(--sf-field-gap)",
                    width: "var(--form-label-width)",
                    "align-self": "center",
                    "text-align": "var(--form-label-align, start)",
                    "justify-content": "var(--form-label-align, start)",
                  },
                },
                {
                  selector: "> .react-aria-Icon",
                  styles: { "grid-column": "2 / 3" },
                },
                {
                  selector: "> .react-aria-Input",
                  styles: { "grid-column": "3 / 4", "min-width": "0" },
                },
                {
                  selector: "> .react-aria-Button",
                  styles: { "grid-column": "4 / 5" },
                },
                {
                  selector: "> .react-aria-FieldError",
                  styles: {
                    "grid-column": "2 / 5",
                  },
                },
                {
                  selector: '> [slot="description"]',
                  styles: {
                    "grid-column": "2 / 5",
                  },
                },
              ],
            },
          },
          "label-align": {
            end: {
              styles: {
                "--form-label-align": "end",
              },
            },
          },
          empty: {
            true: {
              nested: [
                {
                  selector: ".react-aria-Input",
                  styles: { "padding-inline-end": "0" },
                },
                {
                  selector: ".react-aria-Button",
                  styles: {
                    display: "none",
                  },
                },
              ],
            },
          },
          readonly: {
            true: {
              nested: [
                {
                  selector: ".react-aria-Input",
                  styles: { "padding-inline-end": "0" },
                },
                {
                  selector: ".react-aria-Button",
                  styles: { display: "none" },
                },
              ],
            },
          },
        },
        // ADR-253: the container only places its parts. The value is an instance of the Input origin (it
        //   draws the box — rounded here, with room for the glyph at its start and the clear button at
        //   its end); the search glyph is an Icon laid over the start, the clear button an instance of
        //   the Button origin laid over the end.
        delegation: [
          {
            // The side label's gap (no column gap — sizes `columnGap: 0`): `--sf-field-gap`.
            childSelector: "> .react-aria-Label",
            prefix: "sf-field",
            variables: "auto",
            autoKeys: ["gap"],
          },
          {
            // The search glyph: in the empty first column, over the Input's start.
            childSelector: "> .react-aria-Icon",
            prefix: "sf-icon",
            variables: {
              XS: {
                "--sf-icon-size":
                  "{length.typography.text-2xs--line-height*1/1}",
                "--sf-icon-inset":
                  "{length.size.height.XS*1/2+typography.text-2xs*-2/14+2}",
              },
              S: {
                "--sf-icon-size":
                  "{length.typography.text-xs--line-height*1/1}",
                "--sf-icon-inset":
                  "{length.size.height.S*1/2+typography.text-xs*-2/14+2}",
              },
              M: {
                "--sf-icon-size":
                  "{length.typography.text-sm--line-height*1/1}",
                "--sf-icon-inset":
                  "{length.size.height.M*1/2+typography.text-sm*-2/14+2}",
              },
              L: {
                "--sf-icon-size":
                  "{length.typography.text-base--line-height*1/1}",
                "--sf-icon-inset":
                  "{length.size.height.L*1/2+typography.text-base*-2/14+2}",
              },
              XL: {
                "--sf-icon-size":
                  "{length.typography.text-lg--line-height*1/1}",
                "--sf-icon-inset":
                  "{length.size.height.XL*1/2+typography.text-lg*-2/14+2}",
              },
            },
            bridges: {
              height: "auto",
              "margin-inline-start": "var(--sf-icon-inset)",
            },
          },
          {
            childSelector: "> .react-aria-Icon svg",
            bridges: {
              width: "var(--sf-icon-size)",
              height: "var(--sf-icon-size)",
            },
          },
          {
            // Room at both ends: the glyph and the clear button, each with its inset and a gap.
            // (The text-to-visual gap less the glyph's `fontRelative(-2)` start margin — 2/14 em on both
            //  device sets: touch 8/17 − 2/14 = 39/119, not 6/17. 2026-11-09.)
            childSelector: ".react-aria-Input",
            prefix: "sf-input",
            variables: {
              XS: {
                "--sf-input-pad":
                  "{length.size.height.XS*1/2+typography.text-2xs--line-height*1/1+typography.text-2xs*4/14~39/119}",
                "--sf-input-pad-end": "{length.size.height.XS*1/1}",
              },
              S: {
                "--sf-input-pad":
                  "{length.size.height.S*1/2+typography.text-xs--line-height*1/1+typography.text-xs*4/14~39/119}",
                "--sf-input-pad-end": "{length.size.height.S*1/1}",
              },
              M: {
                "--sf-input-pad":
                  "{length.size.height.M*1/2+typography.text-sm--line-height*1/1+typography.text-sm*4/14~39/119}",
                "--sf-input-pad-end": "{length.size.height.M*1/1}",
              },
              L: {
                "--sf-input-pad":
                  "{length.size.height.L*1/2+typography.text-base--line-height*1/1+typography.text-base*4/14~39/119}",
                "--sf-input-pad-end": "{length.size.height.L*1/1}",
              },
              XL: {
                "--sf-input-pad":
                  "{length.size.height.XL*1/2+typography.text-lg--line-height*1/1+typography.text-lg*4/14~39/119}",
                "--sf-input-pad-end": "{length.size.height.XL*1/1}",
              },
            },
            bridges: {
              "min-width": "0",
              // ADR-295 Phase 3c-3b: S2 SearchField — `paddingStart: 'pill'` (height / 2) + the glyph (`1lh`) +
              //   `text-to-visual`; the end is the clear button's place (S2 `ClearButton` — the control height).
              "padding-left": "var(--sf-input-pad)",
              "padding-right": "var(--sf-input-pad-end)",
            },
          },
          {
            childSelector: ".react-aria-Button .react-aria-Icon svg",
            prefix: "sf-cross",
            variables: {
              XS: { "--sf-cross-size": "{length.size.height.XS*2/5}" },
              S: { "--sf-cross-size": "{length.size.height.S*1/3}" },
              M: { "--sf-cross-size": "{length.size.height.M*1/4}" },
              L: { "--sf-cross-size": "{length.size.height.L*1/4}" },
              XL: { "--sf-cross-size": "{length.size.height.XL*1/4}" },
            },
            bridges: {
              width: "var(--sf-cross-size)",
              height: "var(--sf-cross-size)",
              "font-size": "var(--sf-cross-size)",
            },
          },
          {
            // S2 ClearButton: control-width hit area, inside the Input border.
            childSelector: ".react-aria-Button",
            prefix: "sf-btn",
            variables: {
              XS: {
                "--sf-btn-size": "{length.size.height.XS*1/1}",
                "--sf-btn-height": "{length.size.height.XS*1/1-4}",
                "--sf-btn-offset": "{length.size.height.XS*-1/1-2}",
              },
              S: {
                "--sf-btn-size": "{length.size.height.S*1/1}",
                "--sf-btn-height": "{length.size.height.S*1/1-4}",
                "--sf-btn-offset": "{length.size.height.S*-1/1-2}",
              },
              M: {
                "--sf-btn-size": "{length.size.height.M*1/1}",
                "--sf-btn-height": "{length.size.height.M*1/1-4}",
                "--sf-btn-offset": "{length.size.height.M*-1/1-2}",
              },
              L: {
                "--sf-btn-size": "{length.size.height.L*1/1}",
                "--sf-btn-height": "{length.size.height.L*1/1-4}",
                "--sf-btn-offset": "{length.size.height.L*-1/1-2}",
              },
              XL: {
                "--sf-btn-size": "{length.size.height.XL*1/1}",
                "--sf-btn-height": "{length.size.height.XL*1/1-4}",
                "--sf-btn-offset": "{length.size.height.XL*-1/1-2}",
              },
            },
            bridges: {
              width: "var(--sf-btn-size)",
              height: "var(--sf-btn-height)",
              // ADR-295 Phase 3: a field button (S2 — not a Button) does not take the Button's S2
              //   min-height (`{size.height.<S>}`) — its square is this size (placement, as `height`).
              "min-height": "0",
              "min-width": "0",
              "margin-inline-start": "var(--sf-btn-offset)",
            },
          },
        ],
      },
    },
  },
  Section: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      // (2026-10-12 — the variant axis is gone, so the DOM writes no `data-variant`: transparent is
      //   the base color itself, not `alpha: 0` over `base` — the generated base block then
      //   carries it.)
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
    },
    sizes: {
      // ADR-912 단계5 step4 small-B (2026-06-16): paddingY/gap 보강 — spec 삭제 후 generated CSS
      //   `padding: Ypx Xpx` + `gap: Npx` 재생성용 (Section.spec.sizes 미러, Nav/DropZone 선례).
      S: {
        paddingX: 12,
        paddingY: 12,
        gap: 8,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.sm}",
        height: 0,
      },
      M: {
        paddingX: 16,
        paddingY: 16,
        gap: 12,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.md}",
        height: 0,
      },
      L: {
        paddingX: 24,
        paddingY: 24,
        gap: 16,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.lg}",
        height: 0,
      },
    },
    structure: {
      archetype: "container",
      element: "section",
      containerStyles: undefined,
      stateStyles: {
        ...FOCUS_RING_STATE,
        ...DISABLED_STATE,
      },
    },
  },
  Select: {
    defaultSize: "M",
    variants: {},
    // ADR-912 단계5 step4 (2026-06-17): SelectSpec.spec 삭제 대비 — generate-css virtual emit 이
    //   base/size block 의 `gap: Npx` 를 byte-identical 재현하려면 gap 필수(CSSGenerator.ts:983 size.gap
    //   → emit, composition.containerStyles.gap 미정의라 skipGap=false). paddingY 는 미보충(컨테이너
    //   box 가 ownsContainerBox=true → skipPadding, padding 은 composition.delegation --select-btn-padding
    //   가 담당, base block 미emit). Input 과 달리 padding 은 delegation 위임이라 paddingY 불요.
    sizes: {
      XS: {
        paddingX: 4,
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.xs}",
        height: 0,
        iconSize: "{size.icon.XS}",
        gap: centerPadding("XS"),
      },
      S: {
        paddingX: 8,
        fontSize: "{typography.text-xs}",
        borderRadius: 7,
        height: 0,
        iconSize: "{size.icon.S}",
        gap: centerPadding("S"),
      },
      M: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        borderRadius: 8,
        height: 0,
        iconSize: "{size.icon.M}",
        gap: centerPadding("M"),
      },
      L: {
        paddingX: 16,
        fontSize: "{typography.text-base}",
        borderRadius: 9,
        height: 0,
        iconSize: "{size.icon.L}",
        gap: centerPadding("L"),
      },
      XL: {
        paddingX: 24,
        fontSize: "{typography.text-lg}",
        borderRadius: 10,
        height: 0,
        iconSize: "{size.icon.XL}",
        gap: centerPadding("XL"),
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      stateStyles: {
        color: { isDisabled: "{color.picker-content-disabled}" },
      },
      composition: {
        layout: "flex-column",
        gap: "var(--spacing-xs)",
        containerStyles: {
          // 2026-07-15: field 패밀리 root width catalog 정본 (fieldFamilyWidthContract.test.ts).
          //   패널 Transform width = toStr(inline, specDefault, "auto") 이고 specDefault 가 이 값 →
          //   부재 시 "auto" 로 떨어진다 (DatePicker 적발 지점).
          width: "100%",
          color: "var(--fg)",
        },
        containerVariants: {
          "label-position": {
            side: {
              styles: {
                display: "grid",
                "grid-template-columns": "auto minmax(0, 1fr)",
                "align-items": "start",
              },
              // side 라벨 열 (2026-10-10 사용자 「모든 field · picker 컴퍼넌트 Label Position - Side 의 label width 가
              //   fit content 가 아니다 — slider 와 같은 패턴」): S2 `field()` (`style-utils.ts`) 처럼 grid —
              //   `auto 1fr` 두 열, 라벨은 1열 (글자 폭), 입력칸 · 도움말 · 오류 문구는 2열 (도움말이 입력칸 아래 같은 x).
              //   라벨 세로 위치: S2 는 baseline (입력칸 글자와 같은 줄) — 엔진에 grid baseline 이 없어 입력칸
              //   행의 가운데 (한 줄 입력칸에서 같은 자리). 그룹 (CheckboxGroup · RadioGroup) 은 위 — 첫 항목 줄.
              //   종전엔 라벨이 176px 고정 열이었다. side Form 은 안의 field 에 `--form-label-width` 를 주어
              //   라벨 열을 맞춘다 (S2 subgrid). Form 밖에서는 변수가 없고 top Form 은 auto — 글자 폭.
              //   text-align 은 `--form-label-align`(label-align variant 또는 Form 상속) 소비.
              //   자식 결합자(`>`)로 한정 — DatePicker popover 안 Calendar 라벨까지 매칭 방지.
              nested: [
                {
                  selector: "> .react-aria-Label",
                  styles: {
                    "grid-column": "1",
                    width: "var(--form-label-width)",
                    "align-self": "center",
                    "text-align": "var(--form-label-align, start)",
                    "justify-content": "var(--form-label-align, start)",
                  },
                },
                {
                  selector:
                    '> :not(.react-aria-Label, .react-aria-FieldError, [slot="description"])',
                  styles: {
                    "grid-column": "2",
                    "min-width": "0",
                  },
                },
                {
                  selector: "> .react-aria-FieldError",
                  styles: {
                    "grid-column": "2",
                  },
                },
                {
                  selector: '> [slot="description"]',
                  styles: {
                    "grid-column": "2",
                  },
                },
              ],
            },
          },
          "label-align": {
            end: {
              styles: {
                "--form-label-align": "end",
              },
            },
          },
        },
        externalStyles: [
          {
            // The reference's picker popover has no padding of its own (RAC `.select-popover`
            //   `padding: 0` · S2 `<Popover padding="none">`): the list's padding is the inset. It
            //   beats the Popover size's padding (`[data-size]`); (The Builder document no longer
            //   loads this sheet — ADR-305; `[data-catalog-id]` scopes it to document nodes.)
            selector:
              '.react-aria-Popover[data-trigger="Select"][data-catalog-id]',
            styles: { padding: "0" },
          },
          {
            selector: '.react-aria-Popover[data-trigger="Select"]',
            styles: {
              width: "var(--trigger-width)",
              "min-width": "var(--trigger-width)",
              "max-height": "300px",
              overflow: "auto",
              contain: "layout style",
            },
            nested: [
              {
                selector: ".react-aria-ListBox",
                styles: {
                  border: "none",
                  background: "transparent",
                  "max-height": "none",
                  "min-height": "24px",
                },
              },
            ],
          },
        ],
        delegation: [
          // ADR-253: the trigger is an instance of the Button origin (secondary) — its paint, font
          //   and states are the Button rule's. The field only places it: full width, and a
          //   smaller end padding beside the glyph.
          {
            childSelector: ".react-aria-Button",
            prefix: "select-btn",
            // ADR-295 Phase 3c-3: the start padding is S2 Picker's `edge-to-text` (the field height × 3/8 —
            //   7.5 · 9 · 12 · 15 · 18), not the Button's `pill` (height / 2): S2's picker trigger is a field
            //   button, not a Button. The height variable carries the touch set (3c-3b).
            variables: {
              XS: {
                "--select-btn-pad-start":
                  "calc(var(--catalog-token-size-height-XS) * 3 / 8)",
                "--select-btn-pad-end": "2px",
              },
              // 사용자 2026-10-13 「M 8 → 4」 · 「S · L 도 같은 식으로」: the end padding is the
              //   Button's size paddingY (S 2 · M 4 · L 8).
              S: {
                "--select-btn-pad-start":
                  "calc(var(--catalog-token-size-height-S) * 3 / 8)",
                "--select-btn-pad-end": "2px",
              },
              M: {
                "--select-btn-pad-start":
                  "calc(var(--catalog-token-size-height-M) * 3 / 8)",
                "--select-btn-pad-end": "4px",
              },
              L: {
                "--select-btn-pad-start":
                  "calc(var(--catalog-token-size-height-L) * 3 / 8)",
                "--select-btn-pad-end": "8px",
              },
              XL: {
                "--select-btn-pad-start":
                  "calc(var(--catalog-token-size-height-XL) * 3 / 8)",
                "--select-btn-pad-end": "16px",
              },
            },
            bridges: {
              "text-align": "left",
              width: "100%",
              "min-width": "0",
              "padding-left": "var(--select-btn-pad-start)",
              "padding-right": "var(--select-btn-pad-end)",
              // 값 ↔ chevron 간격 4 (사용자 결정 2026-09-29). 없으면 Button rule 의 크기별 gap
              //   (md 8) 을 받는다.
              gap: "var(--spacing-xs)",
            },
          },
          // The value (RAC `SelectValue` — the field's own sub-part) fills the trigger and clips.
          {
            childSelector: ".react-aria-SelectValue",
            prefix: "select-value",
            variables: {
              XS: {
                "--select-value-font-size": "var(--text-2xs)",
              },
              S: {
                "--select-value-font-size": "var(--text-xs)",
              },
              M: {
                "--select-value-font-size": "var(--text-sm)",
              },
              L: {
                "--select-value-font-size": "var(--text-base)",
              },
              XL: {
                "--select-value-font-size": "var(--text-lg)",
              },
            },
            bridges: {
              "font-size": "var(--select-value-font-size)",
              // (The value's own weight — it does not take the trigger Button's 500.)
              "font-weight": "400",
              flex: "1",
              display: "flex",
              "text-align": "left",
              "justify-content": "flex-start",
              "white-space": "nowrap",
              "text-overflow": "ellipsis",
              overflow: "hidden",
            },
            states: {
              "[data-placeholder]": {
                "font-style": "normal",
                color: "inherit",
                opacity: "1",
              },
            },
          },
          {
            childSelector: '.react-aria-SelectValue [slot="description"]',
            bridges: {
              display: "none",
            },
          },
        ],
      },
    },
  },
  SelectValue: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        textAlign: "left",
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: PICKER_CONTENT,
        },
      },
    },
    sizes: {
      XS: {
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.none}",
        height: 14,
      },
      S: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 16,
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 18,
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 20,
      },
      XL: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 22,
      },
    },
  },
  Separator: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.base}",
            isHovered: "{color.base}",
            isPressed: "{color.base}",
            staticColor: {
              black: {
                default: "{color.base}",
                isHovered: "{color.base}",
                isPressed: "{color.base}",
              },
              white: {
                default: "{color.base}",
                isHovered: "{color.base}",
                isPressed: "{color.base}",
              },
            },
          },
          color: {
            default: "{color.border}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
          borderColor: {
            default: "{color.border}",
            staticColor: {
              black: {
                default: "#000000",
              },
              white: {
                default: "#ffffff",
              },
            },
          },
        },
        alpha: 0,
      },
    },
    sizes: {
      // paddingY 4/8/16 → 0 (2026-07-14): 간격은 margin(수동 Separator.css + Skia
      //   implicitStyles sep_margin) 소관 — padding 으로 emit 되면 border-box 하한이
      //   높이(1px)를 이겨 DOM 이 18px box 로 렌더 (Skia 390x1 과 발산 근본).
      S: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 1, // Spectrum divider S=1px
        paddingX: 0,
        paddingY: 0,
      },
      M: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 2, // Spectrum divider M=2px (두께 축, 2026-08-21)
        paddingX: 0,
        paddingY: 0,
      },
      L: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 4, // Spectrum divider L=4px
        paddingX: 0,
        paddingY: 0,
      },
    },
    structure: {
      archetype: "simple",
      element: "hr",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
      },
    },
  },
  Skeleton: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.layer-2}",
            isHovered: "{color.layer-2}",
            isPressed: "{color.layer-2}",
          },
          color: {
            default: "{color.neutral-subdued}",
          },
        },
      },
    },
    sizes: {
      S: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.sm}",
        height: 16,
      },
      M: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.md}",
        height: 20,
      },
      L: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.md}",
        height: 24,
      },
    },
    structure: {
      archetype: "simple",
      element: "div",
      containerStyles: {
        // ADR-923 Phase 5 후속 HC2 전환 (2026-09-03): inline-flex → block. DOM 실효값은 수동
        //   `styles/Skeleton.css:65` (.react-aria-Skeleton display block, Skeleton.tsx import) 이고
        //   generated/Skeleton.css 는 로드되지 않는다 — Canvas (resolveDefaultDisplay) 가 같은 outer 를 읽도록
        //   catalog 를 DOM 에 맞춘다. evidence/923-phase5-followup-hc2-conversion.md.
        display: "block",
        alignItems: "center",
      },
    },
  },
  // ADR-912 단계5 step4 (2026-06-17): Slider.spec.ts 삭제 대비 시각/layout 값 SSOT 보강.
  //   containerStyles(grid) → resolveContainerStylesFallback 경유 Skia/Taffy grid 배치 fallback
  //   (spec.containerStyles 끊김 대체). sizes 의 gap/columnGap/indicator → generated CSS column-gap +
  //   track/thumb metric 재생성 (ruleSizeToSizeSpec passthrough) + implicitStyles specSizeField rule
  //   fallback (columnGap/indicator.thumbSize). Slider.spec.ts:100-160 SSOT 1:1 미러.
  Slider: {
    // S2 `Slider.tsx:493` · `RangeSlider.tsx:111/136` — the thumb presses while dragged (S2 passes
    //   `isPressed: isDragging`) on top of its own `translate(-50%, -50%)` — RAC writes that inline
    //   (`useSliderThumb` style), so the pressed value repeats it and wins with `!important`.
    partStateStyles: {
      "& .react-aria-SliderThumb%": {
        willChange: CATALOG_PRESS_WILL_CHANGE,
        transform: {
          isDragging: `${catalogPressTransform(SLIDER_THUMB_RAC_TRANSFORM)} !important`,
        },
      },
    },
    defaultSize: "M",
    variants: {},
    containerStyles: {
      display: "grid",
      gridTemplateAreas: '"label output" "track track"',
      gridTemplateColumns: "1fr auto",
    },
    // 2026-07-16: labelPosition="side" (Skia resolveActiveContainerVariants 소비 — 부모 grid→flex-row).
    //   CSS 대칭 = structure.composition.containerVariants["label-position"], 자식 재정렬(label→track→value)은
    //   implicitStyles Slider 분기 (ProgressBar/Meter side 선례 동형).
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            display: "flex",
            "flex-direction": "row",
            "align-items": "center",
          },
        },
      },
    },
    // ADR-295 Phase 3c-3c ②c: `height` · `indicator.trackHeight` = the S2 thin bar 4 (no reader — the
    //   bar is the SliderTrack rule's, the row its margins below).
    sizes: {
      S: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.full}",
        height: scaled(4),
        gap: 4,
        columnGap: 16,
        indicator: { trackHeight: scaled(4), thumbSize: scaled(18) },
      },
      M: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.full}",
        height: scaled(4),
        gap: 4,
        columnGap: 16,
        indicator: { trackHeight: scaled(4), thumbSize: scaled(20) },
      },
      L: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.full}",
        height: scaled(4),
        gap: 4,
        columnGap: 20,
        indicator: { trackHeight: scaled(4), thumbSize: scaled(22) },
      },
      XL: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.full}",
        height: scaled(4),
        gap: 4,
        columnGap: 20,
        indicator: { trackHeight: scaled(4), thumbSize: scaled(24) },
      },
    },
    structure: {
      archetype: "slider",
      element: "div",
      containerStyles: {
        display: "grid",
        gridTemplateAreas: '"label output" "track track"',
        gridTemplateColumns: "1fr auto",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
        ...DISABLED_STATE,
      },
      composition: {
        // ADR-295 Phase 3c-3c ②c: the track row = S2 `track` height 24 · 32 · 40 · 48 — the 4px bar
        //   with (row − 4) / 2 above and below (a thick 16px bar: `CATALOG_SLIDER_THICK_TRACK`).
        sizeSelectors: {
          S: {
            ".react-aria-SliderTrack": {
              "margin-top": scaledLengthRef(10),
              "margin-bottom": scaledLengthRef(10),
            },
            ".react-aria-Label": {
              "font-size": "var(--text-xs)",
            },
            ".react-aria-SliderOutput": {
              "font-size": "var(--text-xs)",
            },
          },
          M: {
            ".react-aria-SliderTrack": {
              "margin-top": scaledLengthRef(14),
              "margin-bottom": scaledLengthRef(14),
            },
            ".react-aria-Label": {
              "font-size": "var(--text-sm)",
            },
            ".react-aria-SliderOutput": {
              "font-size": "var(--text-sm)",
            },
          },
          L: {
            ".react-aria-SliderTrack": {
              "margin-top": scaledLengthRef(18),
              "margin-bottom": scaledLengthRef(18),
            },
            ".react-aria-Label": {
              "font-size": "var(--text-base)",
            },
            ".react-aria-SliderOutput": {
              "font-size": "var(--text-base)",
            },
          },
          XL: {
            ".react-aria-SliderTrack": {
              "margin-top": scaledLengthRef(22),
              "margin-bottom": scaledLengthRef(22),
            },
            ".react-aria-Label": {
              "font-size": "var(--text-lg)",
            },
            ".react-aria-SliderOutput": {
              "font-size": "var(--text-lg)",
            },
          },
        },
        containerVariants: {
          // 2026-07-16: labelPosition="side" — Slider 3요소(label/track/value) grid→flex-row.
          //   부모 flex-row + 자식 order(track 중간 flex:1, value 끝) → Label · Track · Value 가로 배치.
          //   Skia 자식 재정렬은 implicitStyles Slider 분기가 동일 시각 결과 주입 (D3 대칭).
          "label-position": {
            side: {
              styles: {
                display: "flex",
                "flex-direction": "row",
                "align-items": "center",
              },
              nested: [
                {
                  // S2 labelAlign (2026-10-10): the side label's text at `--form-label-align` (the
                  //   fields' block). Its width is its text (S2 side label column `auto`, as Meter ·
                  //   ProgressBar) — the track / list takes the rest.
                  selector: "> .react-aria-Label",
                  styles: {
                    "text-align": "var(--form-label-align, start)",
                    "justify-content": "var(--form-label-align, start)",
                  },
                },
                {
                  selector: ".react-aria-SliderTrack",
                  styles: { order: "1", flex: "1" },
                },
                {
                  selector: ".react-aria-SliderOutput",
                  styles: { order: "2" },
                },
              ],
            },
          },
          // S2 labelAlign (2026-10-10): the side label's text alignment in its column.
          "label-align": {
            end: {
              styles: {
                "--form-label-align": "end",
              },
            },
          },
        },
        delegation: [],
      },
    },
  },
  // ADR-256 Phase 7c: RAC's SliderFill (the reference `SliderTrack > SliderFill`) — the filled part
  //   of the track, placed by RAC (`insetInlineStart` · width — the thumbs' range); accent, full
  //   radius (as the old track primitive's fill).
  SliderFill: {
    defaultVariant: "default",
    defaultSize: "M",
    // S2 Slider `isEmphasized` (2026-10-10): neutral, accent when the Slider is emphasized (the
    //   variant is derived from the Slider — `presence.ts`).
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.neutral}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
      emphasized: {
        paint: {
          backgroundColor: {
            default: "{color.accent-content}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
    },
    sizes: {
      S: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.full}",
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.full}",
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.full}",
      },
      XL: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.full}",
      },
    },
    structure: {
      archetype: "container",
      element: "div",
      stateStyles: {
        ...FOCUS_RING_STATE,
        ...DISABLED_STATE,
      },
    },
  },
  SliderOutput: {
    defaultSize: "M",
    variants: {},
    sizes: {
      S: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.none}",
        height: 16,
      },
      M: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.none}",
        height: 18,
      },
      L: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.none}",
        height: 20,
      },
      XL: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.none}",
        height: 22,
      },
    },
    structure: {
      archetype: "simple",
      element: "output",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
        ...DISABLED_STATE,
      },
    },
  },
  // ADR-912 SliderThumb catalog cutover (2026-06-16): circle 핸들 leaf. slider_thumb escape 가
  //   circle fill = variant default fill.default.base({color.accent}) 를 읽는다. height = thumb 지름
  //   (Slider.spec.sizes.*.indicator.thumbSize SSOT 미러 14/18/22/26). 기존 16/20/24 는 stale 값으로
  //   spec(SliderThumb.spec.sizes 14/18/22/26)과 불일치였음 → SSOT 정합 + xl 추가.
  SliderThumb: {
    defaultVariant: "default",
    defaultSize: "M",
    // S2 Slider `isEmphasized` (2026-10-10): neutral, accent when the Slider is emphasized (the
    //   variant is derived from the Slider — `presence.ts`).
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.neutral}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
      emphasized: {
        paint: {
          backgroundColor: {
            default: "{color.accent-content}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
    },
    sizes: {
      S: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.full}",
        height: scaled(18),
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.full}",
        height: scaled(20),
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.full}",
        height: scaled(22),
      },
      XL: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.full}",
        height: scaled(24),
      },
    },
  },
  // ADR-256 Phase 7c: the track's bar is the SliderTrack itself (background · full radius — both
  //   consumers); its fill is the SliderFill node, its thumbs the SliderThumb nodes.
  SliderTrack: {
    defaultVariant: "default",
    defaultSize: "M",
    // S2 1.8.0 Slider trackStyle thick (2026-10-10): 트랙 radius 는 S2 sm (4px — thin 은 full).
    //   Canvas rule 집행기가 파생 trackStyle 로 읽는다 (`rulePaint.ts` containerVariantPaint);
    //   높이 16px 는 `CATALOG_SLIDER_THICK_TRACK` (presence.ts — styleOf · DOM inline 동일 값).
    containerVariants: {
      "track-style": {
        thick: { styles: { "border-radius": "4px" } },
      },
    },
    variants: {
      // The bar (neutral-subtle — the generated `--bg-muted`).
      default: {
        paint: {
          backgroundColor: {
            default: "{color.neutral-subtle}",
            isHovered: "{color.neutral-subtle}",
            isPressed: "{color.neutral-subtle}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
    },
    // ADR-295 Phase 3c-3c ②c: the bar is S2 thin 4 at every size (`Slider.tsx` `trackStyling`); the
    //   track row (S2 `track` height 24 · 32 · 40 · 48) is the bar plus the Slider's per-size margins
    //   (`sizeSelectors` `.react-aria-SliderTrack`). thumbSize = the handle diameter.
    sizes: {
      S: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.full}",
        height: scaled(4),
        thumbSize: scaled(18),
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.full}",
        height: scaled(4),
        thumbSize: scaled(20),
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.full}",
        height: scaled(4),
        thumbSize: scaled(22),
      },
      XL: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.full}",
        height: scaled(4),
        thumbSize: scaled(24),
      },
    },
    structure: {
      archetype: "slider",
      element: "div",
      containerStyles: {
        display: "grid",
        position: "relative",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
        ...DISABLED_STATE,
      },
      // ADR-295 Phase 3c-3c ②c: the S2 track row (24 · 32 · 40 · 48) is where a press moves the thumb
      //   (S2 `track` — the 4px bar sits in it). The row's margins are space, so the DOM gives the bar
      //   a hit box of the row's height (an interaction-only box the Canvas does not draw — ADR-223).
      //   `::before` paints below the fill and thumbs (tree order), so they keep their presses.
      composition: {
        rootSelectors: {
          "&:is(.react-aria-Slider *)::before": {
            styles: {
              content: "''",
              position: "absolute",
              "inset-inline": "0",
              top: "50%",
              transform: "translateY(-50%)",
            },
          },
          '&:is(.react-aria-Slider *)[data-size="S"]::before': {
            styles: { height: scaledLengthRef(24) },
          },
          '&:is(.react-aria-Slider *)[data-size="M"]::before': {
            styles: { height: scaledLengthRef(32) },
          },
          '&:is(.react-aria-Slider *)[data-size="L"]::before': {
            styles: { height: scaledLengthRef(40) },
          },
          '&:is(.react-aria-Slider *)[data-size="XL"]::before': {
            styles: { height: scaledLengthRef(48) },
          },
        },
        delegation: [],
      },
    },
  },
  // Slot 은 고유 높이가 없다 — 프레임 안에서 flex/grid 가 크기를 정하는 배치 자리다.
  //   그래서 `height: 0` (= 고유 높이 없음) 으로 둔다. 같은 composition-native 레이아웃
  //   컨테이너인 `body`/`frame` 과 동일한 표기다.
  //   **Why (2026-07-27 실측)**: 구 값 40/60/80 은 렌더·레이아웃 소비자가 **0건**인데
  //   (Skia box 는 layout 결과를, 레이아웃 분기는 type 별 명시 분기만 읽는다) Style 패널의
  //   Transform Height 가 inline 부재 시 catalog 로 fallback 하면서 **실제 1024px 인 슬롯을
  //   60px 로 표시**했다. 빈 슬롯이 보이게 하는 하한은 프리셋의 `minHeight` 가 담당한다.
  Slot: {
    defaultSize: "M",
    variants: {},
    sizes: {
      S: {
        minHeight: 40,
        paddingX: 8,
        paddingY: 8,
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.md}",
        gap: 4,
      },
      M: {
        minHeight: 60,
        paddingX: 12,
        paddingY: 12,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        gap: 8,
      },
      L: {
        minHeight: 80,
        paddingX: 16,
        paddingY: 16,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        gap: 12,
      },
    },
    structure: {
      archetype: "container",
      element: "div",
      containerStyles: {
        display: "block",
      },
      composition: {
        delegation: [],
        externalStyles: [
          {
            selector: ".react-aria-Slot > .react-aria-Slot-placeholder",
            styles: {
              display: "flex",
              "align-items": "center",
              gap: "8px",
              "min-width": "0",
            },
          },
          {
            selector: ".react-aria-Slot .react-aria-Slot-icon",
            styles: {
              display: "flex",
              flex: "none",
              "align-items": "center",
            },
          },
          {
            selector: ".react-aria-Slot .react-aria-Slot-info",
            styles: {
              display: "flex",
              "flex-direction": "column",
              "min-width": "0",
            },
          },
        ],
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
      },
    },
  },
  StatusLight: {
    defaultVariant: "neutral",
    defaultSize: "M",
    variants: {
      neutral: {
        paint: {
          backgroundColor: {
            default: "{color.neutral-subdued}",
            isHovered: "{color.neutral-subdued}",
            isPressed: "{color.neutral-subdued}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
      informative: {
        paint: {
          backgroundColor: {
            default: "{color.informative-visual}",
            isHovered: "{color.informative-visual}",
            isPressed: "{color.informative-visual}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
      positive: {
        paint: {
          backgroundColor: {
            default: "{color.positive-visual}",
            isHovered: "{color.positive-visual}",
            isPressed: "{color.positive-visual}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
      notice: {
        paint: {
          backgroundColor: {
            default: "{color.notice-visual}",
            isHovered: "{color.notice-visual}",
            isPressed: "{color.notice-visual}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
      negative: {
        paint: {
          backgroundColor: {
            default: "{color.negative-visual}",
            isHovered: "{color.negative-visual}",
            isPressed: "{color.negative-visual}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
      celery: {
        paint: {
          backgroundColor: {
            default: "{color.celery}",
            isHovered: "{color.celery}",
            isPressed: "{color.celery}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
      chartreuse: {
        paint: {
          backgroundColor: {
            default: "{color.chartreuse}",
            isHovered: "{color.chartreuse}",
            isPressed: "{color.chartreuse}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
      cyan: {
        paint: {
          backgroundColor: {
            default: "{color.cyan}",
            isHovered: "{color.cyan}",
            isPressed: "{color.cyan}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
      fuchsia: {
        paint: {
          backgroundColor: {
            default: "{color.fuchsia}",
            isHovered: "{color.fuchsia}",
            isPressed: "{color.fuchsia}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
      indigo: {
        paint: {
          backgroundColor: {
            default: "{color.indigo}",
            isHovered: "{color.indigo}",
            isPressed: "{color.indigo}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
      magenta: {
        paint: {
          backgroundColor: {
            default: "{color.magenta}",
            isHovered: "{color.magenta}",
            isPressed: "{color.magenta}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
      purple: {
        paint: {
          backgroundColor: {
            default: "{color.purple}",
            isHovered: "{color.purple}",
            isPressed: "{color.purple}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
      yellow: {
        paint: {
          backgroundColor: {
            default: "{color.yellow}",
            isHovered: "{color.yellow}",
            isPressed: "{color.yellow}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
      seafoam: {
        paint: {
          backgroundColor: {
            default: "{color.seafoam}",
            isHovered: "{color.seafoam}",
            isPressed: "{color.seafoam}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
      pink: {
        paint: {
          backgroundColor: {
            default: "{color.pink}",
            isHovered: "{color.pink}",
            isPressed: "{color.pink}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
      turquoise: {
        paint: {
          backgroundColor: {
            default: "{color.turquoise}",
            isHovered: "{color.turquoise}",
            isPressed: "{color.turquoise}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
      cinnamon: {
        paint: {
          backgroundColor: {
            default: "{color.cinnamon}",
            isHovered: "{color.cinnamon}",
            isPressed: "{color.cinnamon}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
      brown: {
        paint: {
          backgroundColor: {
            default: "{color.brown}",
            isHovered: "{color.brown}",
            isPressed: "{color.brown}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
      silver: {
        paint: {
          backgroundColor: {
            default: "{color.silver}",
            isHovered: "{color.silver}",
            isPressed: "{color.silver}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
    },
    // `indicator.dotSize`: the dot diameter (DOM inline style · Skia `status_light` · the Canvas
    //   content width) — not emitted to CSS.
    // S2 StatusLight (`StatusLight.tsx`, ADR-295 Phase 3c-3c): 행 = controlFont 한 줄 — 높이 지정 없음 (height 0 =
    //   글자 줄이 정한다 — 터치 행간도 따라간다, ADR-295 후속 B3. 전에는 desktop 행간 16 · 18 · 20 · 22 리터럴) · 점 8 · 10 · 12 · 14 · 점 ↔ 글자 = S2 wrapper `gap: 'text-to-visual'` (6/14 em, 터치 8/17 em — ADR-295 후속).
    sizes: {
      S: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: em(6, 14, [8, 17]),
        indicator: { dotSize: scaled(8) },
      },
      M: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: em(6, 14, [8, 17]),
        indicator: { dotSize: scaled(10) },
      },
      L: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: em(6, 14, [8, 17]),
        indicator: { dotSize: scaled(12) },
      },
      XL: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: em(6, 14, [8, 17]),
        indicator: { dotSize: scaled(14) },
      },
    },
    structure: {
      archetype: "simple",
      element: "div",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
    },
  },
  Switch: {
    // ADR-297 Phase 3g — the track's and thumb's states (옛 수동 `Switch.css`); 선택 thumb 자리는 위 size 선택자.
    partStateStyles: {
      "& .react-aria-SwitchButton%": { color: TOGGLE_LABEL },
      "& .react-aria-SwitchButton% .indicator": SWITCH_TRACK_STATE,
      "& .react-aria-SwitchButton% .indicator::before": SWITCH_THUMB_STATE,
    },
    defaultVariant: "default",
    defaultSize: "M",
    // ADR-912 단계 5 step 2: replace-primitive measurement generic 전환 — variant.textWeight=400
    //   (Switch.spec label fontWeight 미emit → 측정 fallback 400 정합). [[Checkbox 참조]]
    variants: {
      default: {
        paint: {
          backgroundColor: SWITCH_TRACK_STATE.background,
          borderColor: SWITCH_TRACK_STATE.borderColor,
          color: TOGGLE_LABEL,
        },
        textWeight: 400,
      },
      emphasized: {
        paint: {
          backgroundColor: SWITCH_TRACK_STATE.background,
          borderColor: SWITCH_TRACK_STATE.borderColor,
          color: TOGGLE_LABEL,
        },
        textWeight: 400,
      },
    },
    sizes: {
      // ADR-912 단계5 step4 toggle-indicator 그룹 (2026-06-16): Switch.spec 삭제 대비 gap/paddingX/
      //   paddingY 보강. generate-css virtual 이 size 별 `gap`/`padding: 0px 0px` 를 emit (Switch.css
      //   정합). indicator(trackWidth/thumbSize)는 generated CSS 미emit(수동/React) → rule 불요.
      // ADR-171 Phase 1 (2026-07-29): paddingY 0 → 4. 수동 `Switch.css` 의
      //   `padding: var(--spacing) 0` 실효값 이관 — size 무관 상수 (값 불변).
      // indicator 채널 배선 (2026-08-21, design-data 감사 §1-3): Skia `switch_toggle` 은
      //   size.indicator.{trackWidth,trackHeight,thumbSize,thumbOffset} 를 읽으나 catalog
      //   부재로 전 size 36/20/16/2(md) 고정이었다.
      // ADR-295 Phase 3c-2b: track = S2 — 높이 `controlSize('sm')` (토큰), 폭 글자 × 26 / 14 (`fontRelative(26)`),
      //   thumb 은 track 안쪽 4 (선택 3). DOM 은 `SWITCH_INDICATOR_SELECTORS`.
      S: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.full}",
        height: 0,
        paddingX: 0,
        paddingY: 4,
        gap: TEXT_TO_CONTROL,
        indicator: {
          trackHeight: "{size.height-sm.S}",
          trackWidthEm: SWITCH_TRACK_EM,
          thumbInset: SWITCH_THUMB_INSET,
          thumbInsetSelected: SWITCH_THUMB_INSET_SELECTED,
        },
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.full}",
        height: 0,
        paddingX: 0,
        paddingY: 4,
        gap: TEXT_TO_CONTROL,
        indicator: {
          trackHeight: "{size.height-sm.M}",
          trackWidthEm: SWITCH_TRACK_EM,
          thumbInset: SWITCH_THUMB_INSET,
          thumbInsetSelected: SWITCH_THUMB_INSET_SELECTED,
        },
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.full}",
        height: 0,
        paddingX: 0,
        paddingY: 4,
        gap: TEXT_TO_CONTROL,
        indicator: {
          trackHeight: "{size.height-sm.L}",
          trackWidthEm: SWITCH_TRACK_EM,
          thumbInset: SWITCH_THUMB_INSET,
          thumbInsetSelected: SWITCH_THUMB_INSET_SELECTED,
        },
      },
      XL: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.full}",
        height: 0,
        paddingX: 0,
        paddingY: 4,
        gap: TEXT_TO_CONTROL,
        indicator: {
          trackHeight: "{size.height-sm.XL}",
          trackWidthEm: SWITCH_TRACK_EM,
          thumbInset: SWITCH_THUMB_INSET,
          thumbInsetSelected: SWITCH_THUMB_INSET_SELECTED,
        },
      },
    },
    // ADR-256 Phase 3 (2026-10-08): 레퍼런스 `SwitchField > SwitchButton (indicator + 글자) + Description +
    //   FieldError`. 이 rule 의 요소는 RAC `SwitchField` (`div`) — 누르는 자리 · 도움말 · 오류를 세로로 (size 의
    //   paddingY 는 그대로 이 요소). indicator · 글자의 행 (종전 이 요소의 inline-flex 행 · size 별 gap) 은
    //   `.react-aria-SwitchButton` 블록 (`--sw-button-gap`, sizes 파생). focus 표시는 SwitchButton 의 것.
    structure: {
      archetype: "toggle-indicator",
      element: "div",
      containerStyles: {
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        // ADR-171 Phase 1 (2026-07-29): 수동 `Switch.css` 의 실효값 이관 (값 불변).
        position: "relative",
      },
      stateStyles: {
        cursor: { isDisabled: "not-allowed" },
      },
      composition: {
        staticSelectors: {
          ".react-aria-SwitchButton": {
            display: "inline-flex",
            "align-items": "center",
            gap: "var(--sw-button-gap)",
          },
        },
        rootSelectors: SWITCH_INDICATOR_SELECTORS,
        delegation: [
          {
            // 행 gap — 크기별 gap 을 root 에 `--sw-button-gap` 으로 (sizes 파생, `variables: "auto"`).
            childSelector: ".react-aria-SwitchButton",
            prefix: "sw-button",
            variables: "auto",
            autoKeys: ["gap"],
          },
        ],
      },
    },
  },
  // ADR-912 Switcher cleanup — Switcher rule 제거 (RAC ToggleButtonGroup 으로 대체, 노드 type
  // 자체가 hydration 으로 ToggleButtonGroup 변환되어 Switcher rule 소비 0).
  Tab: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
            isSelected: {
              default: null,
            },
          },
          // S2 `tab` color: neutral-subdued · selected neutral (stated — `null` inherited the Tabs root's,
          //   ADR-297 후속 ⑤).
          color: {
            default: "{color.neutral-subdued}",
            isHovered: "{color.neutral}",
            isSelected: {
              default: "{color.neutral}",
            },
          },
          borderColor: {
            isSelected: {
              default: null,
            },
          },
        },
      },
    },
    // ADR-295 Phase 3c-3c ②c: S2 Tabs has no size axis — a tab's height is its density's
    //   (`Tabs.tsx` `tab` height: compact 32 · regular 48), paddingX 0 (the spacing between tabs
    //   is the TabList's gap). The height is `containerVariants.density` below. The font is S2
    //   Tabs' root `font: 'ui'` at every size (ADR-295 후속 — it was a step per size).
    sizes: {
      S: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
        paddingX: 0,
        paddingY: 0,
        fontWeight: 500,
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
        paddingX: 0,
        paddingY: 0,
        fontWeight: 500,
      },
      L: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
        paddingX: 0,
        paddingY: 0,
        fontWeight: 500,
      },
    },
    structure: {
      archetype: "default",
      element: "button",
      // ADR-171 Phase 1 (2026-07-29): 수동 `TabsIndicator.css` 의 실효값 이관 (값 불변).
      //   ::before / SelectionIndicator 앵커라 relative 가 필수다.
      containerStyles: {
        position: "relative",
        // ADR-171 Phase 3 (2026-07-29): archetype base 가 생성 CSS 에만 emit 하던 값이라
        //   catalog 를 읽는 Skia 에는 안 갔다 (G2 잔존). 실효 DOM 값 그대로 이관 — 값 불변.
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
        ...DISABLED_STATE,
        // (ADR-297 Phase 3b: the interactive pointer — was `rootSelectors["&"]`, after the state blocks)
        cursor: { default: "pointer", isDisabled: "not-allowed" },
        // ADR-259 Phase 1 (R4) · ADR-297 Phase 3c: a link Tab is RAC's `<a>` — no browser link underline
        textDecoration: { isLink: "none" },
      },
      // ADR-223 (2026-09-18): 미지정 archetype base 가 DOM 에만 주던 interaction 세 선언을 generator 전용
      //   rootSelectors 채널에 명시. `archetype: "button"` 은 width:fit-content 가 딸려와 TabList 안 폭이 바뀐다.
      composition: {
        // ADR-295 Phase 3c-3c ②c: S2 tab height per density (the Tabs' value, carried by the
        //   resolver — `CATALOG_DENSITY_PROPAGATION_OWNER.Tab`).
        containerVariants: {
          density: {
            compact: { styles: { height: "32px" } },
            regular: { styles: { height: "48px" } },
          },
        },
        rootSelectors: {
          "&": {
            styles: {
              "user-select": "none",
              transition:
                "background 0.15s ease, border-color 0.15s ease, transform 0.15s ease",
            },
          },
        },
        delegation: [],
      },
    },
  },
  TabList: {
    defaultSize: "M",
    variants: {},
    // density (2026-08-21) — Spectrum 규칙 채택: 폰트(size 축)는 유지하고 **탭 항목 사이
    //   간격만** 바꾼다 (design-data tabs tokenBindings `tab-item-to-tab-item-compact-
    //   horizontal-medium` = "Spacing (between tab items, horizontal)").
    //   기본은 Spectrum 스키마 default 인 regular (design-data `tabs.options.items.density.default`
    //   = "regular", ActionGroup 도 동일). 2026-08-21 사용자 결정으로 구 compact 기본에서
    //   전환 — 탭 사이 간격이 0 에서 8 로 벌어진다.
    defaultDensity: "regular",
    // ADR-295 Phase 3c-3c ②c: S2 `tablist` gap — compact 24 · regular 32 (the tabs have no
    //   paddingX of their own).
    densities: {
      compact: { gap: 24 },
      regular: { gap: 32 },
    },
    sizes: {
      S: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "row",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
        ...DISABLED_STATE,
      },
      composition: {
        layout: "flex-row",
        delegation: [],
      },
    },
  },
  TabPanel: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
    },
    // 2026-07-02 전수조사 fix: top-level containerStyles 추가 — TabPanel 은 spec 삭제(ADR-912
    //   cutover) + structure.composition 부재(archetype "collection") 라, layout 이
    //   structure.containerStyles 에만 있으면 resolveContainerStylesFallback("tabpanel") 이
    //   경로 A(top-level rule.containerStyles)·경로 B(structure.composition) 둘 다 미도달 → {}
    //   반환 → getElementDisplay 가 block 라우팅 → 패널 안 사용자 자식이 Skia 에서 block(flex
    //   gap/align/flexGrow 유실), DOM 은 generated CSS flex-column → Skia↔CSS 비대칭.
    //   ListBox/Menu/Tree 선례처럼 top-level containerStyles 로 승격해 경로 A 가 Skia 에 공급.
    //   structure.containerStyles(아래)는 dirty baseline(resolveCatalogContainerBase)용 유지 —
    //   display/flexDirection 동일값이라 baseline drift 0. padding 은 implicitStyles tabs/tabpanels
    //   분기가 size 별 주입하므로 top-level 미포함(surface-minimization).
    containerStyles: {
      display: "flex",
      flexDirection: "column",
    },
    sizes: {
      S: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 0,
        paddingX: 8,
        paddingY: 8,
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 0,
        paddingX: 12,
        paddingY: 12,
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 0,
        paddingX: 16,
        paddingY: 16,
      },
    },
    structure: {
      archetype: "collection",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "column",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
        ...DISABLED_STATE,
      },
    },
  },
  TabPanels: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
    },
    // padding 0 (2026-09-18): Preview 는 이 래퍼 상자를 그리지 않는다 (`renderTabs` 가 RAC Tabs 안에 TabPanel
    //   직계 — `.react-aria-TabPanels` 는 어느 DOM 에도 없다). 종전 12 는 Skia 만 읽어 TabPanel 이 (12,12) 에
    //   놓이고 Tabs 가 DOM 보다 24 컸다. 패널 padding 은 TabPanel 자기 sizes 가 정본.
    sizes: {
      S: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
        paddingX: 0,
        paddingY: 0,
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
        paddingX: 0,
        paddingY: 0,
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
        paddingX: 0,
        paddingY: 0,
      },
    },
    structure: {
      archetype: "collection",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "column",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
        ...DISABLED_STATE,
      },
    },
  },
  TableHeader: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
        // ADR-297 후속 ②: no `alpha: 0` — the Table's header row paints the Table part rule's
        //   `--bg-inset` (ADR-302 결정 3 — `raised` → layer-2; S2 TableView `tableHeader` gray-75 은 ADR-303) on both consumers.
      },
    },
    sizes: {
      M: {},
    },
    containerStyles: {
      display: "flex",
      flexDirection: "row",
    },
  },
  TableBody: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
        alpha: 0,
      },
    },
    sizes: {
      M: {},
    },
    containerStyles: {
      display: "flex",
      flexDirection: "column",
    },
  },
  Row: {
    defaultVariant: "default",
    defaultSize: "M",
    // A selected row (2026-10-13 — a Row set Selected starts its Table's selection): the DOM's
    // `Table.css` `.react-aria-Row[data-selected]` accent fill and on-accent text.
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
            isSelected: {
              default: "{color.accent}",
            },
          },
          color: {
            default: "{color.neutral}",
            isSelected: {
              default: "{color.on-accent}",
            },
          },
          borderColor: {
            isSelected: {
              default: null,
            },
          },
        },
      },
    },
    sizes: {
      M: {},
    },
    containerStyles: {
      display: "flex",
      flexDirection: "row",
    },
    // A disabled row (S2 Row `isDisabled`) — the DOM's is `Table.css` `.react-aria-Row[data-disabled]`
    // (the sheet owns the row, so no generated CSS — ADR-223: a new entry names its archetype).
    structure: {
      archetype: "container",
      element: "div",
      skipCSSGeneration: true,
      stateStyles: {
        opacity: { isDisabled: 0.38 },
      },
    },
  },
  Column: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
            isSelected: {
              default: null,
            },
          },
          color: {
            default: "{color.neutral}",
            isSelected: {
              default: null,
            },
          },
          borderColor: {
            isSelected: {
              default: null,
            },
          },
        },
        alpha: 0,

        // textAlign left: react-aria-starter Table.css `.react-aria-Cell,.react-aria-Column
        //   { text-align: left }`(line 162) 정본. buildCatalogShapes 는 transparent-fill +
        //   size.height>0 인 Column/Cell 을 box 로 판정해 기본 center 로 그렸다(Skia=center,
        //   CSS Preview=left 발산). rule.textAlign 이 visual.textAlign(resolveSkiaVisualRule:56)로
        //   전달돼 box 기본 center 를 override → Skia 도 left. catalog SSOT 단일 결과.
        textAlign: "left",
      },
    },
    sizes: {
      M: {
        fontWeight: 600,
        // fontSize/lineHeight: CSS Preview(옛 표 subtree generic div)는 fontSize 미명시 →
        //   부모 body 상속 16px + line-height normal 24px. Skia 셀 height(calculateContentHeight)와
        //   텍스트 크기를 CSS 와 일치시키려면 catalog 가 동일 값을 명시해야 한다(미명시 시 Skia
        //   기본 14 + estimateTextHeight≈16 → 행 height 32 vs CSS 40 발산). 양쪽 모두 catalog 파생
        //   으로 SSOT 통일(CSS=상속 → catalog 명시 미러).
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        // paddingX/Y 8: buildCatalogShapes 의 textX = paddingX(= size.paddingX ?? 0)로 텍스트를
        //   셀 안쪽으로 민다. containerStyles.padding(8px)은 Taffy box / Preview CSS 용이고 leaf
        //   Column/Cell 의 Skia 텍스트 x offset 에는 도달 안 함(resolveMergedStyle base=sizes 만,
        //   containerStyles 미포함) → Skia paddingX=0 으로 텍스트가 좌측 가장자리 붙음(Skia=0,
        //   CSS=8px 발산). Button(sizes.paddingX:4) 동형 — box leaf 텍스트 padding 정본 채널=sizes.
        //   값 8 = {spacing.sm}(containerStyles.padding)과 동일 → 시각 일치.
        //   세로 정합: calculateContentHeight(utils.ts §1.56)가 estimateTextHeight(16,24)=24 +
        //   paddingY*2(16) = 40 = CSS border-box height. baseline middle 이 텍스트를 셀 세로 중앙 배치.
        // ADR-295 후속 C7: 좌우 = S2 `columnStyles` `paddingX: 16` (table-edge-to-content, rem — 터치 그대로).
        paddingX: 16,
        // ADR-295 후속 B2: 머리글 = S2 `DEFAULT_HEADER_HEIGHT` (32 · 터치 40 — `TableView.tsx` component-height-100,
        //   density 무관) → 최소 높이 `scaled(32)`. 여백 = (32 − 줄 18 − 아래 선 1) / 2.
        paddingY: 6.5,
        minHeight: scaled(32),
      },
    },
    // (머리글은 density 를 따르지 않는다 — S2 `headingHeight: DEFAULT_HEADER_HEIGHT[scale]`. 칸 (Cell) 만 density 축.)
    // ADR-257: no flex share — the column's width is its track in the row grid (`tableTracks.ts`).
    // (머리글 위아래 여백 = S2 32 의 6.5 — 아래 size 블록 주석. 좌우 = S2 16 (ADR-295 후속 C7) — 선택
    //  checkbox 열은 끝 8 (`catalogBoxModel` 의 `_tableSelectionPart`).)
    containerStyles: {
      paddingTop: "6.5px",
      paddingRight: "{spacing.lg}",
      paddingBottom: "6.5px",
      paddingLeft: "{spacing.lg}",
    },
    // ADR-257 Phase 3: the header cell's own alignment (S2 Column `align` — not its Cells').
    containerVariants: {
      // ADR-257 Phase 3 — S2 `align` (start · center · end — S2 `cellContent` textAlign; start is
      //   the variant's left).
      align: {
        center: { styles: { "text-align": "center" } },
        end: { styles: { "text-align": "right" } },
      },
      // G5 example 11 (2026-10-12) — a sortable column is the reference's `.column-header`
      //   (react-aria.adobe.com Table.md): its name Group and the sort indicator after it in one
      //   row, the name taking the rest (`.column-name` `flex: 1`). The indicator is RAC render
      //   output (`tableOperationsDom.tsx`) — the Canvas keeps its box beside the name
      //   (`catalogColumnSortNameGroup`).
      "allows-sorting": {
        true: {
          styles: { display: "flex", "align-items": "center" },
          nested: [
            {
              selector: "> .react-aria-Group",
              styles: { flex: "1", "min-width": "0" },
            },
          ],
        },
      },
      // ADR-257 Phase 3 — the Table's S2 `overflowMode` (carried here by the resolver): S2
      //   `cellContent` truncates (one line, ellipsis) or wraps (the row grows with the text).
      "overflow-mode": {
        truncate: {
          styles: {
            overflow: "hidden",
            "white-space": "nowrap",
            "text-overflow": "ellipsis",
          },
        },
        wrap: {
          styles: {
            overflow: "hidden",
            "white-space": "normal",
            "text-overflow": "ellipsis",
          },
        },
      },
    },
  },
  Cell: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
        alpha: 0,

        // textAlign left: starter Table.css 정본(Column 과 동일 규칙). box 기본 center override.
        textAlign: "left",
      },
    },
    sizes: {
      M: {
        // fontSize/lineHeight text-sm 토큰 (ADR-295 후속 — S2 cell controlFont 14/18): Column 과 동형 — CSS Preview 와 Skia 텍스트·
        //   셀 height 정합(calculateContentHeight estimateTextHeight(16,24)=24 + paddingY*2=40).
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        // paddingX: Column 과 동형 — containerStyles.padding 은 Skia 텍스트 x 에 미도달이라
        //   sizes.paddingX 가 텍스트 padding 정본 채널(buildCatalogShapes textX). ADR-295 후속 C7: S2
        //   `commonCellStyles` `paddingX: 16` (table-edge-to-content — `cellContent` 의 padding 4 · margin −4 는
        //   focus 링 몫이라 글자는 16 에서 시작).
        paddingX: 16,
        paddingY: 11,
      },
    },
    // density (2026-08-21): Spectrum `table.item.padding` × density 모델 — 폰트는 그대로, 여백만 바꾼다.
    //   행 높이 = 줄 18 (S2 cell `controlFont()` 14) + paddingY × 2 → compact 32 · regular 40 · spacious 48.
    //   머리글 (Column) 은 density 를 따르지 않는다 (S2 32 고정, ADR-295 후속 B2). 최소 높이 = S2 cell `minHeight` (compact 32 · regular 40 ·
    //   spacious 48 — rem × `--s2-scale`, 터치 × 1.25 → `scaled`, ADR-295 후속): desktop 은 여백 + 행간과 같은 값,
    //   터치는 행간 22 + 여백보다 큰 40 · 50 · 60.
    defaultDensity: "regular",
    densities: {
      compact: { paddingY: 7, minHeight: scaled(32) },
      regular: { paddingY: 11, minHeight: scaled(40) },
      spacious: { paddingY: 15, minHeight: scaled(48) },
    },
    // ADR-257: no flex share — the column's width is its track in the row grid (`tableTracks.ts`).
    // (좌우 = S2 16, ADR-295 후속 C7 — 선택 checkbox 칸은 끝 8, `catalogBoxModel` 의 `_tableSelectionPart`.)
    containerStyles: {
      paddingTop: "{spacing.sm}",
      paddingRight: "{spacing.lg}",
      paddingBottom: "{spacing.sm}",
      paddingLeft: "{spacing.lg}",
    },
    // ADR-257 Phase 3: the cell's own S2 `align` · `showDivider` (S2 Cell reads neither from its
    //   Column — 사용자 결정 7) and the Table's `overflowMode`.
    containerVariants: {
      // ADR-257 Phase 3 — S2 `align` (start · center · end — S2 `cellContent` textAlign; start is
      //   the variant's left).
      align: {
        center: { styles: { "text-align": "center" } },
        end: { styles: { "text-align": "right" } },
      },
      // S2 `showDivider`: a 1px line at the cell's end, the border color (S2 `--borderColorGray`).
      "show-divider": {
        true: {
          styles: {
            "border-right-width": "1px",
            "border-style": "solid",
            "border-color": "var(--border)",
          },
        },
      },
      // ADR-257 Phase 3 — the Table's S2 `overflowMode` (carried here by the resolver): S2
      //   `cellContent` truncates (one line, ellipsis) or wraps (the row grows with the text).
      "overflow-mode": {
        truncate: {
          styles: {
            overflow: "hidden",
            "white-space": "nowrap",
            "text-overflow": "ellipsis",
          },
        },
        wrap: {
          styles: {
            overflow: "hidden",
            "white-space": "normal",
            "text-overflow": "ellipsis",
          },
        },
      },
    },
  },
  Table: {
    // ADR-297 Phase 3g — the table's, rows' and cells' states (옛 수동 `Table.css` — 생성 sheet 가 없는 rule 이라
    //   상태 블록만 담은 `generated/Table.css`). 행의 hover · pressed · selected · drop target 은 같은 바탕에서 옛 순서
    //   그대로, S2 `selectionStyle="highlight"` 는 그 위 층 (연한 accent + 이어진 선택마다 테두리 하나).
    partStateStyles: {
      "&%": {
        background: {
          isDropTarget: "color-mix(in srgb, var(--accent) 8%, transparent)",
        },
        outline: {
          isFocusVisible: "2px solid var(--accent)",
          isDropTarget: "2px solid var(--accent)",
        },
        outlineOffset: { isFocusVisible: "-1px", isDropTarget: "-1px" },
      },
      "& .react-aria-Row%": {
        background: {
          isHovered: "var(--bg-muted)",
          isPressed: "var(--bg-overlay)",
          isSelected: "var(--tbl-selected-bg)",
          isDropTarget: "color-mix(in srgb, var(--accent) 12%, transparent)",
        },
        color: { isSelected: "var(--tbl-selected-color)" },
        outline: {
          isFocusVisible: "2px solid var(--accent)",
          isDropTarget: "2px solid var(--accent)",
        },
        outlineOffset: {
          isFocusVisible: { default: "-2px", isSelected: "-4px" },
        },
      },
      "& .react-aria-Row[data-selected] .react-aria-Cell%": {
        outlineColor: { isFocusVisible: "var(--accent)" },
        outlineOffset: { isFocusVisible: "-4px" },
      },
      "& .react-aria-Row%:has(+ [data-selected])": {
        "--radius-bottom": { isSelected: "0px" },
      },
      "& .react-aria-Row%:has(+ .react-aria-DropIndicator + [data-selected])": {
        "--radius-bottom": { isSelected: "0px" },
      },
      "& .react-aria-Row[data-selected] + .react-aria-Row%": {
        "--radius-top": { isSelected: "0px" },
      },
      "& .react-aria-Row[data-selected] + .react-aria-DropIndicator + .react-aria-Row%":
        {
          "--radius-top": { isSelected: "0px" },
        },
      "& .react-aria-Row% .react-aria-Checkbox": {
        "--selected-color": { isSelected: "var(--tbl-cb-selected-on)" },
        "--checkmark-color": { isSelected: "var(--tbl-cb-checkmark-on)" },
      },
      "& .react-aria-Cell%": {
        outline: { isFocusVisible: "2px solid var(--accent)" },
        outlineOffset: { isFocusVisible: "-2px" },
      },
      "& .react-aria-Column%": {
        outline: { isFocusVisible: "2px solid var(--accent)" },
        outlineOffset: { isFocusVisible: "-2px" },
      },
      '& .react-aria-Row [slot="drag"]%': {
        borderRadius: { isFocusVisible: "4px" },
        outline: { isFocusVisible: "2px solid var(--accent)" },
      },
      "&[data-node-table] .react-aria-Cell[data-drag-cell] > .catalog-drag-handle%":
        {
          outline: { isFocusVisible: "2px solid var(--focus-ring)" },
        },
      "& .react-aria-ColumnResizer%": {
        display: { isFocusVisible: "block" },
      },
      "& .react-aria-ColumnResizer%::before": {
        width: { isFocusVisible: "2px" },
        background: { isFocusVisible: "var(--informative)" },
      },
      '&[data-selection-style="highlight"] .react-aria-Row%': {
        "--row-highlight-top": { isSelected: "inset 0 1px var(--accent)" },
        "--row-highlight-bottom": { isSelected: "inset 0 -1px var(--accent)" },
        background: {
          isSelected: {
            default: "color-mix(in srgb, var(--accent) 10%, var(--bg))",
            isHovered: "color-mix(in srgb, var(--accent) 15%, var(--bg))",
            isPressed: "color-mix(in srgb, var(--accent) 15%, var(--bg))",
          },
        },
        color: { isSelected: "var(--fg)" },
        boxShadow: {
          isSelected:
            "inset 1px 0 var(--accent), inset -1px 0 var(--accent), var(--row-highlight-top), var(--row-highlight-bottom)",
        },
      },
      '&[data-selection-style="highlight"] .react-aria-Row%:has(+ [data-selected])':
        {
          "--row-highlight-bottom": { isSelected: "0 0 transparent" },
        },
      '&[data-selection-style="highlight"] .react-aria-Row[data-selected] + .react-aria-Row%':
        {
          "--row-highlight-top": { isSelected: "0 0 transparent" },
        },
    },
    defaultVariant: "default",
    defaultSize: "M",
    // S2 1.8.0 Table `density` (2026-10-10): 값은 Table 의 prop 하나 — 그 안의 Column · Cell 로
    //   전파돼 (resolver `CATALOG_DENSITY_PROPAGATION`) 각자의 densities 채널 (paddingY 4 · 8 ·
    //   12 → 행 높이 32 · 40 · 48) 이 적용된다. Table 자체 여백 채널은 없어 densities 를 두지
    //   않는다.
    // ADR-151 B22 (2026-07-16): generated/수동 CSS 의 base `width: 100%` 를 layout 이
    //   미소비 — flex 부모에서 fit-content 붕괴 (block 부모는 IFC 주입이 가림). layout
    //   fallback 채널(top-level)로 공급. CSS 는 기존 규칙 그대로 — generated CSS diff 0.
    // ADR-923 r21m1 (2026-09-02): 수동 Table.css `min-height: 40px` 도 같은 채널 — heightMode
    //   "auto" 의 빈 Table 이 DOM 40 vs layout 0 이었다 (fixed 는 implicitStyles 가 height 를 덮는다).
    containerStyles: {
      width: "100%",
      minHeight: "40px",
    },
    // S2 1.8.0 Table `isQuiet` (2026-10-10): 바깥 틀이 없다 — 배경 transparent (fill.quiet) ·
    //   테두리 transparent · radius 0 (아래 containerVariants.quiet — Canvas 는 rule 집행기의
    //   containerVariantPaint, DOM 은 수동 Table.css 의 `[data-quiet]` 블록이 같은 값). 테두리는
    //   폭을 지우지 않고 색만 지운다 — 양 consumer 의 기하 (border-box 높이) 가 그대로다
    //   (S2 는 width 0 이지만 우리 catalogTableHeight 가 1px 테두리를 기하에 더한다).
    containerVariants: {
      quiet: {
        true: {
          styles: {
            "border-color": "transparent",
            "border-radius": "0",
          },
        },
      },
    },
    variants: {
      default: {
        paint: {
          backgroundColor: {
            // ADR-303: S2 `TableView.tsx:251` `table` — `gray-25` (= base) · quiet transparent, 상태 없음
            //   (행 hover · pressed 는 Row 의 몫). 테두리 1px `gray-300` = `{color.border}` 는 그대로.
            default: "{color.base}",
            isQuiet: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
          borderColor: {
            default: "{color.border}",
          },
        },
      },
    },
    // ADR-295 후속 C1 (2026-10-31, 사용자 「Table S/M/L 크기 축 제거」): S2 TableView 에 size 축이 없다 —
    //   한 벌. 모서리 = S2 `table` style `borderRadius: '[6px]'` (임의 px — scale 무관). 글자는 팔레트
    //   Table 이 쓰던 S 의 단 (칸 · 머리글은 각자 controlFont — Column · Cell rule). 여백 · 높이는
    //   Table 상자가 읽지 않아 (행 높이 = Column · Cell density, 상자 높이 = catalogTableHeight) 뺐다.
    sizes: {
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: 6,
      },
    },
  },
  // ADR-194 — 차트. D1 은 internal source(RAC 에 chart primitive 없음)라 role="img" 를
  //   binding.staticAttrs 가 부여하고, D3 는 여기 rule 이 정본이다. `chart` 채널의 시리즈
  //   순서는 RSC categorical 팔레트 순서를 참조했다 — Spectrum design-data 에 chart 토큰이
  //   0건이라(2026-08-27 실측) 어느 대안을 골랐어도 팔레트는 자체 정의였다.
  Chart: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.layer-1}",
            isHovered: "{color.layer-1}",
            isPressed: "{color.layer-1}",
          },
          color: {
            default: "{color.neutral}",
          },
          borderColor: {
            default: "{color.border}",
          },
        },
      },
    },
    sizes: {
      S: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.md}",
        paddingX: 8,
        paddingY: 8,
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        paddingX: 12,
        paddingY: 12,
      },
      L: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        paddingX: 16,
        paddingY: 16,
      },
    },
    // 2026-11-13 사용자 결정 — 단계별 높이 (160/240/320) 대신 16:9 비율 상자. 높이 px 는 flex 의
    //   기본 shrink 를 받아 세로 flex body (Height 100%, 넘침) 에서 테두리 · 여백만 남기고 눌렸다
    //   (안쪽 차트가 height 100% 라 자동 최소 높이가 0 에 가깝다). 비율 상자는 자동 최소 높이가
    //   비율 높이라 눌리지 않는다 — overflow 를 숨기면 이 최소 높이가 0 이 되므로 두지 않는다.
    containerStyles: {
      display: "block",
      width: "100%",
      minWidth: "320px",
      aspectRatio: "16 / 9",
      borderWidth: "{border.width.thin}",
    },
    chart: {
      // ADR-215 — 기본 팔레트 = Spectrum categorical 1~8 (chartPaletteMap.ts 리터럴, 테마 공용).
      //   순서 = 인접 대비 최대 (teal · indigo · orange · pink · periwinkle · green · blue · purple).
      series: [
        "{color.chart-categorical-1}",
        "{color.chart-categorical-2}",
        "{color.chart-categorical-3}",
        "{color.chart-categorical-4}",
        "{color.chart-categorical-5}",
        "{color.chart-categorical-6}",
        "{color.chart-categorical-7}",
        "{color.chart-categorical-8}",
      ],
      // ADR-215 — 대안 팔레트. mono = accent 사다리 단 4 (ADR-302) + neutral 4 (단일 시리즈 ·
      //   대시보드 단색 어법 — Pinterest `primary` / Apple tint 관행). 길이는 series 와 같다 (G3).
      palettes: {
        mono: [
          "{color.chart-accent-1}",
          "{color.chart-accent-2}",
          "{color.chart-accent-3}",
          "{color.chart-accent-4}",
          "{color.neutral-subdued}",
          "{color.gray}",
          "{color.silver}",
          "{color.border}",
        ],
      },
      axis: "{color.neutral-subdued}",
      grid: "{color.border}",
      strokeWidth: 2,
      // 툴팁 표면 — Tooltip 컴포넌트 rule 과 같은 계열 토큰 (neutral-subtle 면).
      tooltipBackground: "{color.neutral-subtle}",
      tooltipBorder: "{color.border}",
      tooltipText: "{color.neutral}",
      // ADR-211 others ("기타") 범주 — 시리즈 팔레트 밖의 중립 면 (light/dark 는 토큰이 푼다).
      others: "{color.neutral-subdued}",
      // ADR-217 기준선 — 강한 중립 (RSC gray-800 상당), 라벨도 같은 토큰.
      reference: "{color.neutral}",
      // 기하가 쓰는 px — sizes[*].fontSize 의 TokenRef 와 별개 채널이다. 두 consumer 가
      //   같은 숫자로 축 여백·레이블 솎아내기를 판정해야 좌표가 갈리지 않는다.
      metrics: {
        S: { padding: 8, fontSize: 10 },
        M: { padding: 12, fontSize: 11 },
        L: { padding: 16, fontSize: 12 },
      },
      // ADR-211 표시 예산 — P0 실측 확정값 (docs/adr/evidence/211-p0-spike.md). light/dark 동일.
      budget: {
        minSlot: 8,
        minPointGap: 3,
        minArc: 5,
        minAxisGap: 12,
        minRing: 5,
        markBudget: 800,
        pointBudget: 5000,
        rowCap: 20000,
        windowTrackHeight: 24,
      },
    },
    structure: {
      // "text" archetype = block + width 100% + border-box. "default" 를 쓰면
      //   DEFAULT_BASE_STYLES 의 cursor:pointer / user-select:none 이 딸려와
      //   클릭 대상이 아닌 차트에 손가락 커서가 붙는다 (생성 CSS 실측 2026-09-08).
      archetype: "text",
      element: "div",
      containerStyles: {
        display: "block",
        width: "100%",
        minWidth: "320px",
        aspectRatio: "16 / 9",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
      },
    },
  },
  Tabs: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        // ADR-912 단계 4 C2 (rule fill 정렬, 2026-06-03): 컨테이너 `colors.border` 제거.
        //   `.react-aria-Tabs` 는 배경/박스 border 없음 — tab indicator `::before` 선만 있다(컨테이너
        //   border 아님). buildCatalogShapes 가 `visual.border`(=colors.border)를 컨테이너 박스 border 로
        //   그리면 legacy render.shapes `[]` 와 불일치(kill: "Tabs border 추가"). text/textHover 는 유지.
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          // (The tabs' own colors are the Tab rule's — S2 `tabs` states none; the container keeps the body text.)
          color: {
            default: "{color.neutral}",
          },
        },
      },
    },
    // 글자 = S2 Tabs 루트 `font: 'ui'` (크기 무관 — ADR-295 후속).
    sizes: {
      S: {
        paddingX: 8,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      M: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      L: {
        paddingX: 16,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "column",
      },
      stateStyles: {
        focusRing: { isFocusVisible: "{focus.ring.inset}" },
        ...DISABLED_STATE,
      },
      composition: {
        layout: "flex-column",
        delegation: [
          {
            childSelector: ".react-aria-Tab",
            variables: {
              S: {
                "--tab-padding": "var(--spacing-2xs) var(--spacing-sm)",
                "--tab-font-size": "var(--text-xs)",
              },
              M: {
                "--tab-padding": "var(--spacing-xs) var(--spacing-md)",
                "--tab-font-size": "var(--text-sm)",
              },
              L: {
                "--tab-padding": "var(--spacing-sm) var(--spacing-lg)",
                "--tab-font-size": "var(--text-base)",
              },
            },
          },
        ],
      },
    },
  },
  Tag: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        // ADR-297 Phase 3d — a selected Tag (S2 TagGroup: neutral, accent in an emphasized group) is its own
        //   `isSelected` branch (was the `selected` · `selectedEmphasized` variants the Canvas swapped in).
        paint: {
          backgroundColor: {
            default: "{color.layer-1}",
            isHovered: "{color.layer-1}",
            isPressed: "{color.layer-1}",
            isSelected: {
              default: "{color.neutral}",
              isEmphasized: "{color.accent}",
            },
          },
          color: {
            default: "{color.neutral}",
            isSelected: {
              default: "{color.base}",
              isEmphasized: "{color.on-accent}",
            },
          },
          borderColor: {
            default: "{color.border}",
            isSelected: {
              default: "{color.neutral}",
              isEmphasized: "{color.accent}",
            },
          },
        },

        // DOM `.react-aria-Tag` 는 font-weight 미선언 (상속 400) — generic 폴백 500 이면 캔버스 chip 글자만
        //   굵고 폭이 DOM 보다 넓다 (2026-09-21, Checkbox/Radio/Switch 와 같은 명시).
        textWeight: 400,

        // ADR-912 영역 B (A) Tag cutover (2026-06-12): allowsRemoving remove X 를
        //   trailing_icon(Lucide "x" glyph)으로 그린다 — buildCatalogShapes 가 showProp(allowsRemoving)
        //   true 일 때만 text 우측에 덧그림(SearchField clear / DOM Button slot=remove 와 동일 icon).
        //   color 는 variant text 와 동일(default=neutral). showProp = generic 렌더러가 Tag 전용
        //   prop 이름을 모르도록 데이터로 가시성 조건 격리(ADR-142 §3 컴포넌트 식별 분기 금지).
        // leading icon (2026-08-21, design-data 감사 §2-? Tag avatar/icon 슬롯):
        //   chip 아이콘은 **항목별 데이터**라 rule 에 정적 이름을 둘 수 없다 → `nameProp` 으로
        //   `props.icon`(itemSchema 의 icon 필드)을 읽는다. 값이 없는 chip 은 아이콘도, 텍스트
        //   shift 도 없다(폭 = 라벨 + padding 그대로). trailingIcon 의 `showProp` 과 같은
        //   데이터-게이팅 idiom — 컴포넌트 식별 분기 아님(ADR-142 §3).
        //   크기는 `sizes[*].iconSize`(전 size 14 — DOM 고정 14px glyph 컨벤션과 대칭).
        leadingIcon: {
          nameProp: "icon",
          gap: 4,
          // (no color — the glyph is the chip's text color in every state, the primitive's paint fallback;
          //   the DOM `.tag-leading-icon { color: inherit }`)
        },

        // leading avatar (2026-08-21, design-data 감사 §2-C Tag avatar 슬롯):
        //   icon 과 **같은 좌측 슬롯**의 이미지 표현 — 항목이 둘 다 가지면 avatar 가 이긴다
        //   (resolveLeadingSlot 단일 판정). `srcProp` 으로 `props.avatar`(itemSchema)를 읽고,
        //   비면 이미지도 text shift 도 없다(leadingIcon nameProp 과 동형 게이팅).
        //   지름은 chip size 무관 고정 16 — DOM `.tag-leading-avatar` 와 같은 값.
        leadingAvatar: {
          srcProp: "avatar",
          size: 16,
          gap: 4,
          fallbackFill: "{color.neutral-subtle}",
        },

        trailingIcon: {
          name: "x",
          gap: 2,
          showProp: "allowsRemoving",
          // remove X 우측 여백 = paddingY + insetRight. CSS 실측(md chip): icon 우측 → chip 경계 7px =
          //   paddingY(4) + .tag-remove-btn padding(2) + chip border(1). insetRight=3 으로 대칭.
          insetRight: 3,
        },
      },
    },
    sizes: {
      // ADR-295 Phase 3: a chip is an S2 control box — `minHeight` is the S2 control height token and
      //   paddingY centres the line in it ((height − line − border × 2) / 2, the generated
      //   `controlPaddingBlock` · Canvas `s2ControlPaddingY`); `height: 0` = content-fit (both legs).
      //   (Before: height 는 DOM chip 의 border-box 실측 (TagGroup.css: height 없음 = lineHeight + paddingY×2 + border 1×2).)
      //   종전 28 (md) 은 border 미포함 값이라 implicitStyles height 미러가 캔버스 chip 을 2px 낮게 잡았고,
      //   borderWidth 미선언으로 엔진 폭에도 border 가 빠져 DOM 보다 2px 좁았다 (2026-09-21, Badge r22m1 동형).
      // ADR-912 영역 B (A) Tag cutover (2026-06-12): paddingX 보강 — buildCatalogShapes 가
      //   text x = paddingX 로 좌측 정렬. Tag.spec sizes.paddingX(xs4/sm8/md12/lg16/xl24) 이전.
      //   미보강 시 `?? 0` fallback 으로 text 가 box 좌측 끝(padding 없음)에 붙음(chip 시각 깨짐).
      // iconSize: remove X(trailing_icon) glyph 크기 = **전 size 14 고정** (2026-07-02). CSS(DOM)는
      //   TagGroup.tsx `<Button slot="remove"><X size={14} /></Button>` 로 모든 size 14px 고정 —
      //   Skia trailingIcon 도 동일 14 로 맞춰 CSS↔Skia 시각 대칭(D3). 구 `round(fontSize×0.75)`
      //   (xs8/sm9/md11/lg12/xl14)는 md 11 vs CSS 14 로 Skia X 가 작았다(사용자 관찰). Tag 는 leading
      //   icon 이 없어 iconSize=remove X 전용 → 14 통일 부작용 없음. layout chip width(resolveTagChipMetric)
      //   는 fontSize 로 remove 예약 폭을 잡아 iconSize 무관. Tag 는 generated CSS 없음(부모 self-compose).
      // ADR-912 단계5 step4 (2026-06-17): paddingY 보강 — layout TAG_SIZE_CONFIG 가 spec.sizes 대신
      //   ruleSizesToSizeSpecMap("Tag") 파생으로 이관(deriveSizeConfig 가 paddingY 소비 — allowsRemoving
      //   우측 패딩 축소 계산). Tag.spec paddingY(xs1/sm2/md4/lg8/xl12 = (height-lineHeight)/2 동일값) 이전.
      XS: {
        fontSize: "{typography.text-2xs}",
        lineHeight: "{typography.text-2xs--line-height}",
        borderRadius: "{radius.sm}",
        height: 0,
        minHeight: "{size.height.XS}",
        borderWidth: "{border.width.thin}",
        paddingX: ofHeight(3, 8),
        paddingY: 2,
        iconSize: 14,
      },
      S: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.sm}",
        height: 0,
        minHeight: "{size.height.S}",
        borderWidth: "{border.width.thin}",
        paddingX: ofHeight(3, 8),
        paddingY: 3,
        iconSize: 14,
      },
      M: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.md}",
        height: 0,
        minHeight: "{size.height.M}",
        borderWidth: "{border.width.thin}",
        paddingX: ofHeight(3, 8),
        paddingY: 6,
        iconSize: 14,
      },
      L: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.lg}",
        height: 0,
        minHeight: "{size.height.L}",
        borderWidth: "{border.width.thin}",
        paddingX: ofHeight(3, 8),
        paddingY: 9,
        iconSize: 14,
      },
      XL: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.lg}",
        height: 0,
        minHeight: "{size.height.XL}",
        borderWidth: "{border.width.thin}",
        paddingX: ofHeight(3, 8),
        paddingY: 12,
        iconSize: 14,
      },
    },
  },
  TagGroup: {
    // ADR-297 Phase 3g — the Tags' selected · focus (옛 수동 `TagGroup.css` — 생성 sheet 가 없는 rule 이라
    //   상태 블록만 담은 `generated/TagGroup.css`). 선택 Tag 는 neutral 쌍, 강조 그룹은 accent 쌍 (S2) — Tag 의 칠은
    //   `--tag-*` 변수로 (수동 sheet 의 바탕 · 글자 · 테두리가 읽는다).
    partStateStyles: {
      "& .react-aria-Tag%": {
        "--tag-color": { isSelected: "var(--fg)" },
        "--tag-text": { isSelected: "var(--bg)" },
        "--tag-border": { isSelected: "var(--fg)" },
        outline: { isFocusVisible: "2px solid var(--accent)" },
        outlineOffset: { isFocusVisible: "2px" },
        // S2 `TagGroup.tsx:599` — the tag presses (the manual sheet's `scale: 0.96` was the Builder
        //   widgets' — ADR-305 moved it to the Builder copy; a catalog tag turns it off).
        scale: { isPressed: "none" },
        ...PRESS_STATE,
      },
      "& .react-aria-Tag% .tag-remove-btn": {
        color: { isSelected: "inherit" },
      },
      "& .react-aria-Tag .tag-remove-btn%": {
        outline: { isFocusVisible: "2px solid var(--focus-ring)" },
        outlineOffset: { isFocusVisible: "-1px" },
        // S2 ClearButton (`ClearButton.tsx:73`) — likewise for the manual `scale: 0.9`.
        scale: { isPressed: "none" },
        ...PRESS_STATE,
        transition: `color 200ms, ${CATALOG_PRESS_TRANSITION}`,
      },
      "&[data-emphasized] .react-aria-Tag%": {
        "--tag-color": { isSelected: "var(--accent)" },
        "--tag-text": { isSelected: "var(--fg-on-accent)" },
        "--tag-border": { isSelected: "var(--accent)" },
      },
      "& .tag-show-all-btn:focus-visible": {
        outline: "2px solid var(--accent)",
        outlineOffset: "2px",
      },
    },
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        // ADR-912 단계 4 C2 (rule fill 정렬, 2026-06-03): 컨테이너 fill base→transparent + `colors.border`
        //   제거. `.react-aria-TagGroup` 컨테이너는 transparent — 배경/border 는 Tag 자식 칩(별도 `Tag`
        //   entry: fill `{color.layer-1}` + border)이 담당한다. 발효 시 buildCatalogShapes 가 default
        //   variant 의 불투명 `{color.layer-2}` + border 를 컨테이너 박스로 그리면 legacy `[]` 와 불일치
        //   (kill: "TagGroup 배경+border 추가"). accent/neutral/negative variant(사용자 명시 강조)는 유지.
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
      accent: {
        paint: {
          backgroundColor: {
            default: "{color.accent-subtle}",
            isHovered: "{color.accent-subtle}",
            isPressed: "{color.accent-subtle}",
          },
          color: {
            default: "{color.neutral}",
          },
          borderColor: {
            default: "{color.accent-content}",
          },
        },
      },
      neutral: {
        paint: {
          backgroundColor: {
            default: "{color.neutral-subtle}",
            isHovered: "{color.neutral-subtle}",
            isPressed: "{color.neutral-subtle}",
          },
          color: {
            default: "{color.neutral}",
          },
          borderColor: {
            default: "{color.neutral-subtle}",
          },
        },
      },
      negative: {
        paint: {
          backgroundColor: {
            default: "{color.negative-subtle}",
            isHovered: "{color.negative-subtle}",
            isPressed: "{color.negative-subtle}",
          },
          color: {
            default: "{color.neutral}",
          },
          borderColor: {
            default: "{color.negative}",
          },
        },
      },
    },
    sizes: {
      S: {
        paddingX: 8,
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 24,
      },
      M: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 32,
      },
      L: {
        paddingX: 16,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.md}",
        height: 40,
      },
    },
    // ADR-912 단계5 step4 (2026-06-17): TagGroup.spec.containerStyles 이관 — self-render 컨테이너
    //   base layout(Label↔TagList 세로 배치). spec 삭제 후 resolveContainerStylesFallback(builder
    //   catalog 합성)이 본 필드를 읽는다. gap 은 spec `{spacing.xs}` 동일.
    containerStyles: {
      display: "flex",
      flexDirection: "column",
      gap: "{spacing.xs}",
    },
    // ADR-912 단계5 step4 (2026-06-17): TagGroup.spec.composition.containerVariants 이관 —
    //   RSP TagGroup `labelPosition="side"` 정본(label 옆 가로 배치). spec 삭제 후
    //   resolveActiveContainerVariants(builder catalog fallback)이 Skia layout 에 적용.
    //   DOM 은 수동 TagGroup.css `[data-label-position="side"]` selector 가 담당(별도 축).
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            "flex-direction": "row",
            "align-items": "flex-start",
          },
          nested: [
            {
              // S2 labelAlign (2026-10-10): the side label's text at `--form-label-align` (the
              //   fields' block). Its width is its text (S2 side label column `auto`, as Meter ·
              //   ProgressBar) — the track / list takes the rest.
              selector: "> .react-aria-Label",
              styles: {
                "text-align": "var(--form-label-align, start)",
                "justify-content": "var(--form-label-align, start)",
              },
            },
            {
              // (S2 side field: the input area is the rest of the row — `1fr`.)
              selector: "> .react-aria-TagList",
              styles: {
                flex: "1 1 0%",
                "min-width": "0",
              },
            },
          ],
        },
      },
      // S2 labelAlign (2026-10-10): the side label's text alignment in its column.
      "label-align": {
        end: {
          styles: {
            "--form-label-align": "end",
          },
        },
      },
    },
  },
  // TagList — chip 컨테이너 shell (ADR-912 collection sub-part cutover, 2026-06-15). 시각 없음:
  //   chip 시각은 cutover 된 Tag(appendTagRowProjection → Tag SceneNode)가 단독 담당. TagList
  //   SceneNode 는 transparent box shell(rowsGroup projection owner). 기존 accent/neutral/negative
  //   variant 는 Tag chip semantic 이라 컨테이너 rule 에 dead → 단일 transparent default 로 정리.
  TagList: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
          borderColor: {
            default: "{color.transparent}",
          },
        },
      },
    },
    // 기본 크기 (사용자 지시 2026-09-24): height 100% · minHeight = TagGroup size 의 chip 높이 (아래 sizes) —
    //   Tag 가 하나도 없어도 목록 틀이 기본 높이를 가진다 (Slot "+" 로 채울 자리). top-level containerStyles =
    //   Canvas layout fallback (resolveContainerStylesFallback 경로 A). DOM 은 TagList 가 display: contents 라
    //   실제 상자 `.tag-list-wrapper` (TagGroup.css) 가 같은 값을 쓴다.
    containerStyles: {
      height: "100%",
    },
    // gap = chip 간(inter-chip) 간격 — TagList(컨테이너) 소관 layout gap (ADR-912 cutover
    //   2026-06-15: TAG_CHIP_SIZES.gap 이관). chip 자체 치수(lineHeight/paddingX/fontSize/
    //   borderRadius/height)는 Tag rule 에 존재 — utils.ts calculateContentHeight 가 chip 치수=
    //   Tag rule, gap=본 TagList rule 로 분리 read. 값 보존: sm/md=4, lg=6.
    sizes: {
      S: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
        // minHeight = Tag 의 S2 control 높이 (chip border-box, ADR-295 Phase 3b) — 빈 목록 틀의 기본 높이.
        minHeight: "{size.height.S}",
        gap: 8,
      },
      M: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
        // minHeight = Tag 의 S2 control 높이 (chip border-box, ADR-295 Phase 3b) — 빈 목록 틀의 기본 높이.
        minHeight: "{size.height.M}",
        gap: 8,
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
        // minHeight = Tag 의 S2 control 높이 (chip border-box, ADR-295 Phase 3b) — 빈 목록 틀의 기본 높이.
        minHeight: "{size.height.L}",
        gap: 8,
      },
    },
  },
  Text: {
    defaultVariant: "default",
    defaultSize: "M",
    // ADR-151 B22 (2026-07-16): generated/수동 CSS 의 base `width: 100%` 를 layout 이
    //   미소비 — flex 부모에서 fit-content 붕괴 (block 부모는 IFC 주입이 가림). layout
    //   fallback 채널(top-level)로 공급. CSS 는 기존 규칙 그대로 — generated CSS diff 0.
    containerStyles: {
      width: "100%",
    },
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
        },

        // ADR-912 위험군 해소(2026-06-04): TEXT_LEAF catalog 측정/렌더 fontWeight drift 차단.
        //   buildCatalogShapes fallback 500 ↔ Text spec render.shapes 400 → variant.textWeight=400
        //   명시(Checkbox/Radio step 2 선례 동형). 누락 시 catalog 전환으로 Text 가 400→500 굵어짐.
        textWeight: 400,
      },
    },
    sizes: {
      XS: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      S: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      M: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      L: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      XL: {
        fontSize: "{typography.text-xl}",
        lineHeight: "{typography.text-xl--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      XXL: {
        fontSize: "{typography.text-2xl}",
        lineHeight: "{typography.text-2xl--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      XXXL: {
        fontSize: "{typography.text-3xl}",
        lineHeight: "{typography.text-3xl--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    structure: {
      archetype: "text",
      element: "p",
      containerStyles: {
        display: "block",
        width: "100%",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
      },
    },
  },
  TextArea: {
    defaultSize: "M",
    defaultVariant: "default",
    variants: { default: { paint: { color: TOGGLE_GROUP_LABEL } } },
    sizes: {
      // ADR-912 단계5 step4 small-B (2026-06-16): gap 보강 — spec 삭제 후 generated CSS `gap: Npx`
      //   재생성용 (TextArea.spec.sizes 미러). padding 은 input-base archetype + composition
      //   ownsContainerBox → 미emit 이라 paddingX/paddingY 보강 불요(gap 만).
      //
      // 2026-08-21 — fontSize / paddingX / borderRadius 를 **field 패밀리 스케일(TextField)** 로
      //   정렬했다. 이 rule 은 DOM 에 도달하지 않는다(컨테이너 클래스가 `.react-aria-TextField` —
      //   generate-css.ts 의 binding 파생 게이트 참조). 즉 CSS 는 TextField 값을, Skia 는 이 값을
      //   읽고 있었고 **한 단계 어긋나 있었다**. 라이브 실측(preview computed style):
      //     paddingX  DOM 8/12/16/24  ↔ 구 rule 10/14/16/24  (md 2px 어긋남)
      //     radius    DOM 4/6/8/12    ↔ 구 rule sm/md/md/lg = 4/6/6/8  (lg·xl 어긋남)
      //     fontSize  DOM xs/sm/base/lg ↔ 구 rule sm/base/lg/xl  (전 구간 한 단계 큼)
      //   Spectrum 도 text-area 를 "text field 가 지원하는 표준 옵션 전부"로 규정하므로 타입
      //   스케일 공유가 정본이다 — 어긋난 쪽은 Skia. gap 은 원래 동일.
      //
      // 2026-09-04 (ADR-923 Phase 5 후속 착수 7) — `height`(64/80/120/160) **삭제**. TextArea 본체
      //   높이의 정본은 `rows × Input 줄 높이 + padding + border` 계약이다 (착수 2, DOM `<textarea
      //   rows>` 와 같은 식): Canvas 는 implicitStyles 가 그 식으로 계산하고 DOM 은 브라우저가 rows 로
      //   계산한다 — **이 값은 어느 쪽도 읽지 않았다**. 전 표면 변이 대조로 확인 (64/80/120/160 →
      //   641/801/1201/1601: parity 1090 · builder 5246 · shared 972 중 반응한 것은 이 값을 고정하던
      //   테스트 하나뿐). 남겨두면 "여러 줄 상자 높이의 SSOT" 로 잘못 읽힌다.
      S: {
        paddingX: 8,
        fontSize: "{typography.text-xs}",
        borderRadius: 7,
        gap: centerPadding("S"),
      },
      M: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        borderRadius: 8,
        gap: centerPadding("M"),
      },
      L: {
        paddingX: 16,
        fontSize: "{typography.text-base}",
        borderRadius: 9,
        gap: centerPadding("L"),
      },
      XL: {
        paddingX: 24,
        fontSize: "{typography.text-lg}",
        borderRadius: 10,
        gap: centerPadding("XL"),
      },
    },
    // ADR-913 후속 fix (2026-06-19): label-position:side 를 grid → flex-row 로 통일 (DateField/
    //   TimeField/TextField/NumberField/SearchField/ColorField 동형). field family side SSOT
    //   일원화 (generate-css.ts STRUCTURE_META 도 동시 flex-row). Skia sideMode 트리거 styles 만.
    // 2026-10-10: side 는 S2 `field()` 의 grid (`auto 1fr`) — structure.composition 의 side 블록 거울.
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            display: "grid",
            "grid-template-columns": "auto minmax(0, 1fr)",
            "align-items": "start",
          },
        },
      },
    },
    structure: {
      archetype: "input-base",
      element: "div",
      containerStyles: {
        display: "flex",
      },
      stateStyles: {
        color: TOGGLE_GROUP_LABEL,
        cursor: { isDisabled: "default" },
      },
      composition: {
        // ADR-259 Phase 2: the S2 prefix in the control Group (`FIELD_PREFIX_*`).
        staticSelectors: { ...FIELD_PREFIX_STATIC },
        sizeSelectors: { ...FIELD_PREFIX_SIZES },
        layout: "flex-column",
        containerStyles: {
          // 2026-06-24: width fit-content → 100% (field 패밀리 정본, TextField/SearchField 동형 정정).
          //   factory inline(width:100%, FormComponents createDefaultTextAreaProps) ↔ CSS Preview
          //   (fit-content) 시각 비대칭 + Style Panel false dirty 해소. CSS 재생성 시 width:100%.
          width: "100%",
        },
        containerVariants: {
          "label-position": {
            side: {
              styles: {
                display: "grid",
                "grid-template-columns": "auto minmax(0, 1fr)",
                "align-items": "start",
              },
              // side 라벨 열 (2026-10-10 사용자 「모든 field · picker 컴퍼넌트 Label Position - Side 의 label width 가
              //   fit content 가 아니다 — slider 와 같은 패턴」): S2 `field()` (`style-utils.ts`) 처럼 grid —
              //   `auto 1fr` 두 열, 라벨은 1열 (글자 폭), 입력칸 · 도움말 · 오류 문구는 2열 (도움말이 입력칸 아래 같은 x).
              //   라벨 세로 위치: S2 는 baseline (입력칸 글자와 같은 줄) — 엔진에 grid baseline 이 없어 입력칸
              //   행의 가운데 (한 줄 입력칸에서 같은 자리). 그룹 (CheckboxGroup · RadioGroup) 은 위 — 첫 항목 줄.
              //   종전엔 라벨이 176px 고정 열이었다. side Form 은 안의 field 에 `--form-label-width` 를 주어
              //   라벨 열을 맞춘다 (S2 subgrid). Form 밖에서는 변수가 없고 top Form 은 auto — 글자 폭.
              //   text-align 은 `--form-label-align`(label-align variant 또는 Form 상속) 소비.
              //   자식 결합자(`>`)로 한정 — DatePicker popover 안 Calendar 라벨까지 매칭 방지.
              nested: [
                {
                  selector: "> .react-aria-Label",
                  styles: {
                    "grid-column": "1",
                    width: "var(--form-label-width)",
                    "align-self": "center",
                    "text-align": "var(--form-label-align, start)",
                    "justify-content": "var(--form-label-align, start)",
                  },
                },
              ],
            },
          },
          "label-align": {
            end: {
              styles: {
                "--form-label-align": "end",
              },
            },
          },
          // quiet: **여기 두지 않는다** (2026-08-21 라이브 실측). TextArea 는 DOM 에서
          //   `.react-aria-TextArea` 가 아니라 **`.react-aria-TextField` 클래스로 렌더된다** —
          //   binding 의 `source.component` 가 `TextField` 라(RAC 에 TextArea **컨테이너**
          //   primitive 가 없다) renderCatalogDom 의 cutover 경로가 `RAC.TextField` 를
          //   그대로 렌더하고 RAC 가 자기 이름으로 클래스를 붙이기 때문이다. 실제 시각은
          //   TextField 의 generated CSS 가 담당한다. (ADR-253: quiet 는 입력칸 — Input rule 의
          //   `&[data-quiet]` — 이 그린다. `<textarea>` 도 같은 rule 의 요소다.)
          //   그래서 이 rule 은 **CSS 를 아예 생성하지 않는다** — generate-css.ts 가 binding 에서
          //   파생한 게이트로 skip 한다(2026-08-21). 여기에 컨테이너 규칙을 더해도 emit 되지 않고,
          //   `.react-aria-TextArea` 라는 이름은 RAC 에서 **안쪽 `<textarea>`** 의 클래스라
          //   되살리면 엉뚱한 요소에 걸린다.
        },
        // Label 은 Label 원본의 instance 다 (ADR-253) — 글자 크기 · 굵기는 Label rule 이 field 의
        //   size 로 정한다. 이 rule 은 부품의 모양을 선언하지 않는다.
      },
    },
  },
  TokenField: {
    defaultSize: "M",
    variants: {},
    sizes: {
      M: {
        height: 0,
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: 0,
        gap: 6,
      },
    },
    structure: {
      archetype: "container",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
      },
    },
  },
  TokenInput: {
    defaultSize: "M",
    defaultVariant: "default",
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.layer-1}",
          },
          color: {
            default: "{color.neutral}",
          },
          borderColor: {
            default: "{color.border}",
          },
        },
      },
    },
    sizes: {
      M: {
        height: 0,
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: 8,
        paddingX: 12,
        paddingY: 8,
        borderWidth: "{border.width.thin}", // (theme axis — ADR-227)
      },
    },
    structure: {
      archetype: "text",
      element: "div",
      containerStyles: {
        display: "block",
        width: "100%",
        minHeight: "36px",
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
      },
      stateStyles: { ...FOCUS_RING_STATE, ...DISABLED_STATE },
      composition: {
        delegation: [],
        rootSelectors: {
          "&:empty::before": {
            content: "attr(data-placeholder)",
            opacity: "0.5",
          },
          "& .react-aria-Token[data-selected]": {
            "text-decoration": "underline",
          },
        },
      },
    },
  },
  Token: {
    defaultSize: "M",
    variants: {},
    sizes: {
      M: {
        height: 0,
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        fontWeight: 600,
        borderRadius: 0,
      },
    },
    structure: {
      archetype: "text",
      element: "span",
      containerStyles: {
        display: "inline-block",
        width: "fit-content",
        whiteSpace: "nowrap",
      },
    },
  },
  TextField: {
    defaultSize: "M",
    defaultVariant: "default",
    variants: { default: { paint: { color: TOGGLE_GROUP_LABEL } } },
    // minWidth 없음 (ADR-295 Phase 3c-2): S2 TextField · SearchField 에는 min-width 가 없다 (2026-08-21 의 1.5 × · 3 ×
    //   높이는 Spectrum 1). 빌더 위젯은 이 시트를 싣지 않는다 — 295 전 하한은 빌더 사본 (ADR-305 `styles/widgets/`) 이 가진다.
    sizes: {
      // ADR-912 단계5 step4 small-B (2026-06-16): gap 보강 — spec 삭제 후 generated CSS `gap: Npx`
      //   재생성용 (TextField.spec.sizes 미러). padding 은 composition.layout=flex-column root
      //   ownsContainerBox → 미emit 이라 보강 불요(gap 만).
      XS: {
        paddingX: 4,
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.sm}",
        height: 0,
        gap: centerPadding("XS"),
      },
      S: {
        paddingX: 8,
        fontSize: "{typography.text-xs}",
        borderRadius: 7,
        height: 0,
        gap: centerPadding("S"),
      },
      M: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        borderRadius: 8,
        height: 0,
        gap: centerPadding("M"),
      },
      L: {
        paddingX: 16,
        fontSize: "{typography.text-base}",
        borderRadius: 9,
        height: 0,
        gap: centerPadding("L"),
      },
      XL: {
        paddingX: 24,
        fontSize: "{typography.text-lg}",
        borderRadius: 10,
        height: 0,
        gap: centerPadding("XL"),
      },
    },
    // ADR-913 후속 fix (2026-06-19): label-position:side 를 grid → flex-row 로 통일 (DateField/
    //   TimeField/NumberField/SearchField 동형). TextField 는 별도 결함(DELEGATING 미등록 → generic
    //   경로 → data-label-position DOM 미emit → side selector 영원히 미매칭)도 함께 수정됨
    //   (domRegistry DELEGATING_RAC_RENDERERS 등록). flex-row 통일로 emit 복원 후 generated
    //   CSS = Skia(getSideLabelParentStyle) 대칭. Skia sideMode 트리거 styles 만(nested DOM 제외).
    // 2026-10-10: side 는 S2 `field()` 의 grid (`auto 1fr`) — structure.composition 의 side 블록 거울.
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            display: "grid",
            "grid-template-columns": "auto minmax(0, 1fr)",
            "align-items": "start",
          },
        },
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: {
        display: "flex",
      },
      stateStyles: {
        color: TOGGLE_GROUP_LABEL,
        cursor: { isDisabled: "default" },
      },
      composition: {
        // ADR-259 Phase 2: the S2 prefix in the control Group (`FIELD_PREFIX_*`).
        staticSelectors: { ...FIELD_PREFIX_STATIC },
        sizeSelectors: { ...FIELD_PREFIX_SIZES },
        layout: "flex-column",
        gap: "var(--spacing-xs)",
        containerStyles: {
          // 2026-06-24: width fit-content → 100% (field 패밀리 정본). TextField/SearchField 만
          //   stale fit-content 가 남아 factory inline(width:100%, FormComponents) ↔ CSS Preview
          //   (fit-content) 시각 비대칭 + Style Panel false dirty 였다. NumberField/DateField/TimeField
          //   는 catalog 가 width 를 안 채워(factory 100% 가 baseline) 정합 — 같은 패밀리 outlier 정정.
          //   ColorField 가 이미 width:100% 정본(2026-06-23). CSS 재생성 시 .react-aria-TextField
          //   width:100% 로 Skia(factory) 대칭.
          width: "100%",
        },
        containerVariants: {
          // A TextArea's side label offset (2026-10-10 사용자 「Text Area 는 세로 가운데 정렬이 되면 안된다
          //   side 일때 상단 위치해야하지만 여백은 가져야 한다」): S2 aligns the label with the control's
          //   first text line (`alignItems: 'baseline'`) — the textarea's border + top padding (Input
          //   rule per size — ADR-295 Phase 3, the S2 centring padding: S 3 · M 6 · L 9 · XL 12, border 1).
          //   A one-line control's middle is the same line. The value is a per-size `--catalog-token-*`
          //   with its desktop px as the fallback (ADR-295 Decision 9): the Builder document no longer loads
          //   this sheet (ADR-305 — its widgets' copy holds the 295-before offset); the Preview · Publish read the fallback.
          size: {
            S: {
              styles: {
                "--tf-side-label-offset":
                  "var(--catalog-token-field-side-label-offset-S, 4px)",
              },
            },
            M: {
              styles: {
                "--tf-side-label-offset":
                  "var(--catalog-token-field-side-label-offset-M, 7px)",
              },
            },
            L: {
              styles: {
                "--tf-side-label-offset":
                  "var(--catalog-token-field-side-label-offset-L, 10px)",
              },
            },
            XL: {
              styles: {
                "--tf-side-label-offset":
                  "var(--catalog-token-field-side-label-offset-XL, 13px)",
              },
            },
          },
          "label-position": {
            side: {
              styles: {
                display: "grid",
                "grid-template-columns": "auto minmax(0, 1fr)",
                "align-items": "start",
              },
              // side 라벨 열 (2026-10-10 사용자 「모든 field · picker 컴퍼넌트 Label Position - Side 의 label width 가
              //   fit content 가 아니다 — slider 와 같은 패턴」): S2 `field()` (`style-utils.ts`) 처럼 grid —
              //   `auto 1fr` 두 열, 라벨은 1열 (글자 폭), 입력칸 · 도움말 · 오류 문구는 2열 (도움말이 입력칸 아래 같은 x).
              //   라벨 세로 위치: S2 는 baseline (입력칸 글자와 같은 줄) — 엔진에 grid baseline 이 없어 입력칸
              //   행의 가운데 (한 줄 입력칸에서 같은 자리). 그룹 (CheckboxGroup · RadioGroup) 은 위 — 첫 항목 줄.
              //   종전엔 라벨이 176px 고정 열이었다. side Form 은 안의 field 에 `--form-label-width` 를 주어
              //   라벨 열을 맞춘다 (S2 subgrid). Form 밖에서는 변수가 없고 top Form 은 auto — 글자 폭.
              //   text-align 은 `--form-label-align`(label-align variant 또는 Form 상속) 소비.
              //   자식 결합자(`>`)로 한정 — DatePicker popover 안 Calendar 라벨까지 매칭 방지.
              nested: [
                {
                  selector: "> .react-aria-Label",
                  styles: {
                    "grid-column": "1",
                    width: "var(--form-label-width)",
                    "align-self": "center",
                    "text-align": "var(--form-label-align, start)",
                    "justify-content": "var(--form-label-align, start)",
                  },
                },
                {
                  // (a TextArea: the label at the textarea's first line, not its middle)
                  selector:
                    "> .react-aria-Label:has(~ .react-aria-TextArea, ~ .react-aria-FieldBox > .react-aria-TextArea)",
                  styles: {
                    "align-self": "start",
                    "margin-top": "var(--tf-side-label-offset)",
                  },
                },
                {
                  selector:
                    '> :not(.react-aria-Label, .react-aria-FieldError, [slot="description"])',
                  styles: {
                    "grid-column": "2",
                    "min-width": "0",
                  },
                },
                {
                  selector: "> .react-aria-FieldError",
                  styles: {
                    "grid-column": "2",
                  },
                },
                {
                  selector: '> [slot="description"]',
                  styles: {
                    "grid-column": "2",
                  },
                },
              ],
            },
          },
          "label-align": {
            end: {
              styles: {
                "--form-label-align": "end",
              },
            },
          },
        },
        delegation: [],
      },
    },
  },
  TimeField: {
    defaultSize: "M",
    // (2026-11-09: the TextField root's color tree — a disabled field's Label takes the disabled color
    //   (Canvas `catalogToggleButtonGlyphOwner` · DOM inherit), not a dim.)
    defaultVariant: "default",
    variants: { default: { paint: { color: TOGGLE_GROUP_LABEL } } },
    // gap = S2 `--field-gap` (높이 − 행간) / 2 · fontSize = S2 field 글자 (S xs … XL lg — ADR-295 Phase 3c-3b
    //   ③ 까지 한 단 위였다, 3c-3c 에서 S2 로).
    sizes: {
      // ADR-912 단계5 step4 small-B (2026-06-16): gap 보강 — spec 삭제 후 generated CSS `gap: Npx`
      //   재생성용 (TimeField.spec.sizes 미러). padding 은 composition.layout=flex-column root
      //   ownsContainerBox → 미emit 이라 보강 불요(gap 만). borderRadius:0 은 spec 일치.
      S: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: centerPadding("S"),
      },
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: centerPadding("M"),
      },
      L: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: centerPadding("L"),
      },
      XL: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: centerPadding("XL"),
      },
    },
    // ADR-913 slice 2 (2026-06-18): label-position:side Skia 복구 — DateField/ComboBox 동형
    //   (flex-direction:row). ADR-912 단계5 step4 누락분(measure gap[7], breakdown §5 lock-in).
    //   generated TimeField.css:237-240 side 블록과 byte-identical. Skia sideMode 트리거 styles 만.
    // 2026-10-10: side 는 S2 `field()` 의 grid (`auto 1fr`) — structure.composition 의 side 블록 거울.
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            display: "grid",
            "grid-template-columns": "auto minmax(0, 1fr)",
            "align-items": "start",
          },
        },
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: {
        display: "flex",
      },
      stateStyles: {
        // (2026-11-09: no disabled dim — S2 fields paint disabled colors (the box part · Label), as TextField.
        //   No root ring either — S2 rings the box (`FieldGroup`), and RAC DatePicker · DateRangePicker set the
        //   root's `data-focus-visible` with `within: true`, so a root ring outlined the whole field.)
      },
      composition: {
        layout: "flex-column",
        gap: "var(--spacing-xs)",
        containerStyles: {
          // 2026-07-15: field 패밀리 root width catalog 정본 (fieldFamilyWidthContract.test.ts).
          //   패널 Transform width = toStr(inline, specDefault, "auto") 이고 specDefault 가 이 값 →
          //   부재 시 "auto" 로 떨어진다 (DatePicker 적발 지점).
          width: "100%",
        },
        containerVariants: {
          "label-position": {
            side: {
              styles: {
                display: "grid",
                "grid-template-columns": "auto minmax(0, 1fr)",
                "align-items": "start",
              },
              // side 라벨 열 (2026-10-10 사용자 「모든 field · picker 컴퍼넌트 Label Position - Side 의 label width 가
              //   fit content 가 아니다 — slider 와 같은 패턴」): S2 `field()` (`style-utils.ts`) 처럼 grid —
              //   `auto 1fr` 두 열, 라벨은 1열 (글자 폭), 입력칸 · 도움말 · 오류 문구는 2열 (도움말이 입력칸 아래 같은 x).
              //   라벨 세로 위치: S2 는 baseline (입력칸 글자와 같은 줄) — 엔진에 grid baseline 이 없어 입력칸
              //   행의 가운데 (한 줄 입력칸에서 같은 자리). 그룹 (CheckboxGroup · RadioGroup) 은 위 — 첫 항목 줄.
              //   종전엔 라벨이 176px 고정 열이었다. side Form 은 안의 field 에 `--form-label-width` 를 주어
              //   라벨 열을 맞춘다 (S2 subgrid). Form 밖에서는 변수가 없고 top Form 은 auto — 글자 폭.
              //   text-align 은 `--form-label-align`(label-align variant 또는 Form 상속) 소비.
              //   자식 결합자(`>`)로 한정 — DatePicker popover 안 Calendar 라벨까지 매칭 방지.
              nested: [
                {
                  selector: "> .react-aria-Label",
                  styles: {
                    "grid-column": "1",
                    width: "var(--form-label-width)",
                    "align-self": "center",
                    "text-align": "var(--form-label-align, start)",
                    "justify-content": "var(--form-label-align, start)",
                  },
                },
                {
                  selector:
                    '> :not(.react-aria-Label, .react-aria-FieldError, [slot="description"])',
                  styles: {
                    "grid-column": "2",
                    "min-width": "0",
                  },
                },
                {
                  selector: "> .react-aria-FieldError",
                  styles: {
                    "grid-column": "2",
                  },
                },
                {
                  selector: '> [slot="description"]',
                  styles: {
                    "grid-column": "2",
                  },
                },
              ],
            },
          },
          "label-align": {
            end: {
              styles: {
                "--form-label-align": "end",
              },
            },
          },
        },
        delegation: [
          // ADR-253: 입력 상자는 DateInput 원본의 instance 다 — 상자 · 크기 단계 · 상태 · 조각은 DateInput
          //   rule 의 것이고, field 는 배치만 한다 (폭 · 크기별 최소 폭).
          {
            childSelector: ".react-aria-DateInput",
            prefix: "time-field-input",
            variables: {
              XS: {
                "--time-field-input-min-width": "100px",
              },
              S: {
                "--time-field-input-min-width": "120px",
              },
              M: {
                "--time-field-input-min-width": "150px",
              },
              L: {
                "--time-field-input-min-width": "180px",
              },
              XL: {
                "--time-field-input-min-width": "220px",
              },
            },
            bridges: {
              width: "100%",
              "min-width": "var(--time-field-input-min-width)",
            },
          },
        ],
      },
    },
  },
  // 295 후속 C9 (사용자 「Toast 컴포넌트가 컴포넌트 패널에 없다 · S2 원본대로」): S2 1.8.1 `Toast.tsx`
  //   `toastStyle` — variant 진한 색 (neutral = neutral-subdued) · 흰 글자 · 테두리 없음 · `borderRadius: 'lg'` ·
  //   최소 높이 56 · 최대 폭 336 (`size()` — 터치 × 1.25) · `paddingStart: 16` · `paddingEnd: 8` ·
  //   `paddingY: 12` · `boxShadow: 'elevated'` (= `{shadow.md}`) · `font: 'ui'`. S2 처럼 크기 축이 없다.
  //   variant 아이콘 (CenterBaseline · Icon M) 과 닫기 (CloseButton staticColor white · control M) 는 S2 가 늘
  //   그리는 것이라 Toast 가 자기 여백 안에 그린다 — 시작 여백 = 16 + 아이콘 + 8 (neutral 은 아이콘 없이 16),
  //   끝 여백 = 8 + 닫기 + 16 (`{size.toast.*}` 기기 두 벌 — `device.ts` `S2_TOAST_EDGE`). Canvas =
  //   `ruleShapes.ts` `catalogToastChromeShapes`, DOM = `delegatedDom` `toast` 의 `toast-variant-icon` · `toast-close-button`.
  //   글자 · action 버튼은 자식 노드 (원본 `component-toast` — Text + S2 action Button), 사이 간격 = S2
  //   `toastBody` `columnGap: 24`. 안의 글자는 흰색 (파생 `color` — `presence.ts` `catalogToastText`).
  Toast: {
    defaultVariant: "info",
    defaultSize: "M",
    variants: {
      neutral: {
        paint: {
          backgroundColor: {
            default: "{color.neutral-subdued}",
            isHovered: "{color.neutral-subdued}",
            isPressed: "{color.neutral-subdued}",
          },
          color: {
            default: "{color.white}",
          },
          borderColor: {
            default: "{color.neutral-subdued}",
          },
        },
      },
      info: {
        paint: {
          backgroundColor: {
            default: "{color.informative-background}",
            isHovered: "{color.informative-background}",
            isPressed: "{color.informative-background}",
          },
          color: {
            default: "{color.white}",
          },
          borderColor: {
            default: "{color.informative}",
          },
        },
      },
      positive: {
        paint: {
          backgroundColor: {
            default: "{color.positive-background}",
            isHovered: "{color.positive-background}",
            isPressed: "{color.positive-background}",
          },
          color: {
            default: "{color.white}",
          },
          borderColor: {
            default: "{color.positive}",
          },
        },
      },
      negative: {
        paint: {
          backgroundColor: {
            default: "{color.negative-background}",
            isHovered: "{color.negative-background}",
            isPressed: "{color.negative-background}",
          },
          color: {
            default: "{color.white}",
          },
          borderColor: {
            default: "{color.negative}",
          },
        },
      },
    },
    containerStyles: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      position: "relative",
      width: "fit-content",
      boxSizing: "border-box",
      paddingTop: "12px",
      paddingRight: "{size.toast.padding-end}",
      paddingBottom: "12px",
      paddingLeft: "{size.toast.padding-start-icon}",
      boxShadow: "{shadow.md}",
    },
    // (neutral 은 아이콘이 없다 — S2 `ICONS[variant]` 에 neutral 없음 — 시작 여백 16.)
    containerVariants: {
      variant: {
        neutral: { styles: { "padding-left": "16px" } },
      },
    },
    sizes: {
      M: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.lg}",
        height: 0,
        minHeight: scaled(56),
        maxWidth: scaled(336),
        gap: 24,
        borderWidth: "{border.width.none}",
        iconSize: "{size.icon.M}",
      },
    },
    structure: {
      archetype: "alert",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        position: "relative",
        width: "fit-content",
        boxSizing: "border-box",
        paddingTop: "12px",
        paddingRight: "{size.toast.padding-end}",
        paddingBottom: "12px",
        paddingLeft: "{size.toast.padding-start-icon}",
        boxShadow: "{shadow.md}",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
        ...DISABLED_STATE,
        // ADR-297 Phase 3c — every variant's padding (was `rootSelectors["&[data-variant]"]` — a Toast always
        //   carries one), the neutral one with no icon starts closer (was `&[data-variant="neutral"]`).
        padding: {
          variant: {
            neutral:
              "12px var(--catalog-token-size-toast-padding-end) 12px var(--catalog-token-size-toast-padding-start-icon)",
            info: "12px var(--catalog-token-size-toast-padding-end) 12px var(--catalog-token-size-toast-padding-start-icon)",
            positive:
              "12px var(--catalog-token-size-toast-padding-end) 12px var(--catalog-token-size-toast-padding-start-icon)",
            negative:
              "12px var(--catalog-token-size-toast-padding-end) 12px var(--catalog-token-size-toast-padding-start-icon)",
          },
        },
        paddingLeft: { variant: { neutral: "16px" } },
      },
      composition: {
        delegation: [],
        rootSelectors: {
          // S2 CenterBaseline 아이콘 — 시작 여백 16 안, 세로 가운데 (`toast-variant-icon`, aria-hidden).
          "& > .toast-variant-icon": {
            styles: {
              position: "absolute",
              left: "16px",
              top: "50%",
              transform: "translateY(-50%)",
              display: "flex",
              color: "inherit",
              "pointer-events": "none",
            },
          },
          "& > .toast-variant-icon svg": {
            styles: {
              width: "var(--catalog-token-size-icon-M)",
              height: "var(--catalog-token-size-icon-M)",
            },
          },
          // S2 CloseButton staticColor="white" — control M, 끝 여백 8 안, 투명 · hover 흰 10%.
          "& > .toast-close-button": {
            styles: {
              position: "absolute",
              right: "8px",
              top: "50%",
              transform: "translateY(-50%)",
              display: "inline-flex",
              "align-items": "center",
              "justify-content": "center",
              width: "var(--catalog-token-size-height-M)",
              height: "var(--catalog-token-size-height-M)",
              padding: "0",
              border: "none",
              "border-radius": "9999px",
              background: "transparent",
              color: "inherit",
              outline: "none",
              transition: `background-color 130ms ease-in-out, ${CATALOG_PRESS_TRANSITION}`,
              // S2 CloseButton (`CloseButton.tsx:122`) presses — on top of its centring translate.
              "will-change": CATALOG_PRESS_WILL_CHANGE,
            },
          },
          "& > .toast-close-button[data-pressed]": {
            styles: { transform: catalogPressTransform("translateY(-50%)") },
          },
          "& > .toast-close-button svg": {
            styles: { width: "12px", height: "12px" },
          },
          "& > .toast-close-button:is([data-hovered], [data-pressed])": {
            styles: { background: "rgb(255 255 255 / 0.1)" },
          },
          "& > .toast-close-button[data-focus-visible]": {
            styles: { outline: "2px solid white", "outline-offset": "2px" },
          },
        },
      },
    },
  },
  ActionButton: {
    defaultVariant: "default",
    defaultSize: "M",
    containerStyles: { ...BUTTON_ROOT_BOX, position: "relative" },
    variants: { default: { paint: ACTION_BUTTON_PAINT } },
    sizes: ACTION_BUTTON_SIZES,
    structure: {
      archetype: "button",
      element: "button",
      containerStyles: {
        ...BUTTON_ROOT_BOX,
        position: "relative",
        borderStyle: "none",
      },
      stateStyles: {
        ...ACTION_FOCUS_RING_STATE,
        willChange: CATALOG_PRESS_WILL_CHANGE,
        transform: { isPressed: catalogPressTransform() },
        cursor: { isDisabled: "default" },
      },
      composition: ACTION_GROUP_BUTTON_COMPOSITION,
    },
  },
  ActionButtonGroup: {
    defaultVariant: "default",
    defaultSize: "M",
    containerStyles: {
      display: "flex",
      alignItems: "center",
      width: "fit-content",
      height: "fit-content",
    },
    variants: {
      default: {
        paint: {
          backgroundColor: { default: "{color.transparent}" },
          color: { default: "{color.neutral}" },
        },
      },
    },
    sizes: ACTION_GROUP_SIZES,
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: {
        display: "flex",
        alignItems: "center",
        width: "fit-content",
        height: "fit-content",
      },
      composition: {
        delegation: [],
        containerVariants: {
          orientation: {
            horizontal: { styles: { "flex-direction": "row" } },
            vertical: { styles: { "flex-direction": "column" } },
          },
          density: { compact: { styles: { gap: "2px" } } },
        },
      },
    },
  },
  ToggleButton: {
    defaultVariant: "default",
    defaultSize: "M",
    containerStyles: BUTTON_ROOT_BOX,
    variants: { default: { paint: ACTION_BUTTON_PAINT } },
    sizes: ACTION_BUTTON_SIZES,
    structure: {
      archetype: "button",
      element: "button",
      containerStyles: { ...BUTTON_ROOT_BOX, borderStyle: "none" },
      stateStyles: {
        ...ACTION_FOCUS_RING_STATE,
        // S2 `ToggleButton.tsx:101` `pressScale` (`rule/pressScale.ts`).
        willChange: CATALOG_PRESS_WILL_CHANGE,
        transform: { isPressed: catalogPressTransform() },
        ...BUTTON_DISABLED_STATE,
      },
      composition: ACTION_GROUP_BUTTON_COMPOSITION,
      // ADR-297 Phase 3: paint = the variant trees (generated `:where` blocks) — the class stays for
      //   the Skia child-color gate (the Builder chrome ramp is the Builder's own copy — ADR-305 `styles/widgets/utilities.css`).
      buttonBase: true,
    },
  },
  ToggleButtonGroup: {
    defaultVariant: "default",
    defaultSize: "M",
    // ADR-913 slice 1 (2026-06-18): Skia layout fallback (resolveContainerStylesFallback →
    //   LOWERCASE_COMPONENT_RULE_CONTAINER) 이 본 필드를 읽어 display:flex 주입. ADR-912 cutover 가
    //   STRUCTURE_META(generate-css 전용) 에만 containerStyles 를 넣고 rule entry 에는 누락시켜,
    //   spec 삭제 후 Skia 가 display 미주입 → 자식 세로 배치 회귀(starter ToggleButtonGroup.css line 4
    //   `display:flex` 정본 미반영). flexDirection 은 orientation(row/column)이 따로 정한다
    //   (당시 implicitStyles 분기 — 2026-10-05 삭제) → base 는 display/alignItems 만(STRUCTURE_META 와 동일).
    containerStyles: {
      display: "flex",
      alignItems: "center",
      width: "fit-content",
      height: "fit-content",
    },
    variants: {
      default: {
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
            staticColor: {
              black: {
                default: "{color.transparent}",
                isHovered: "{color.transparent}",
                isPressed: "{color.transparent}",
              },
              white: {
                default: "{color.transparent}",
                isHovered: "{color.transparent}",
                isPressed: "{color.transparent}",
              },
            },
          },
          color: {
            default: "{color.neutral}",
            staticColor: {
              black: {
                default: "#000000",
                isHovered: "#000000",
                isPressed: "#000000",
              },
              white: {
                default: "#ffffff",
                isHovered: "#ffffff",
                isPressed: "#ffffff",
              },
            },
          },
          borderColor: {
            default: "{color.transparent}",
            staticColor: {
              black: {
                default: "{color.transparent}",
              },
              white: {
                default: "{color.transparent}",
              },
            },
          },
        },
      },
    },
    sizes: ACTION_GROUP_SIZES,
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: {
        display: "flex",
        alignItems: "center",
        height: "fit-content",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
        opacity: { isDisabled: 1 },
        cursor: { isDisabled: "not-allowed" },
        pointerEvents: { isDisabled: "none" },
      },
      composition: {
        containerStyles: {
          width: "fit-content",
        },
        delegation: [
          {
            childSelector: ".react-aria-ToggleButton",
            // --btn-border-radius: SelectionIndicator pill + segmented 코너 radius 공용.
            //   값은 ToggleButton.css 의 size별 border-radius 와 일치(xs→sm, S 7 · M 8 · L 9 ·
            //   XL 10px — 2026-10-30 사용자 결정) — segmented containerVariants 의 first/last-child 코너가 이 변수를
            //   참조하여 size 분기 없이 size별 radius 정합(2026-06-22 segmented 추가).
            variables: {
              XS: {
                "--btn-border-radius": "var(--radius-sm)",
              },
              S: {
                "--btn-border-radius": "7px",
              },
              M: {
                "--btn-border-radius": "8px",
              },
              L: {
                "--btn-border-radius": "9px",
              },
              XL: {
                "--btn-border-radius": "10px",
              },
            },
          },
        ],
        containerVariants: {
          orientation: {
            horizontal: {
              styles: {
                "flex-direction": "row",
              },
            },
            vertical: {
              styles: {
                "flex-direction": "column",
                width: "fit-content",
              },
            },
          },
          density: { compact: { styles: { gap: "2px" } } },
        },
        // S2 ToggleButtonGroup은 버튼 전체가 눌린다. 내부 press는 custom indicator만 사용한다.
        staticSelectors: {
          '&[data-indicator="true"] .react-aria-ToggleButton': {
            "will-change": "auto",
          },
          '&[data-indicator="true"] .react-aria-ToggleButton[data-pressed]': {
            transform: "none",
          },
          ".react-aria-ToggleButton > span": {
            display: "inherit",
            "min-width": "0px",
            "align-items": "center",
            "justify-content": "center",
            gap: "inherit",
            transition: CATALOG_PRESS_TRANSITION,
            "will-change": CATALOG_PRESS_WILL_CHANGE,
          },
          '&[data-indicator="true"] .react-aria-ToggleButton[data-pressed] > span':
            {
              transform: catalogPressTransform(),
            },
        },
      },
      // button-base utility 착용 (usesButtonBaseUtility 소비) — 칠은 variant 트리 (ADR-297).
      //   DOM shared 컴포넌트(ToggleButtonGroup.tsx)가 wrapper 에
      //   `.button-base` 를 붙이고 Skia 자식(Text/Icon/Label) color 상속 게이트가 같은
      //   membership 을 공유한다. 구 3벌 손 미러(preview BUTTON_BASE_TYPES / Skia
      //   BUTTON_BASE_PARENT_TAGS) 를 본 선언으로 단일화 (2026-08-14).
      buttonBase: true,
      indicatorMode: {
        fill: {
          base: "{color.layer-1}",
        },
        selectedText: "{color.on-accent}",
        borderRadius: "{radius.sm}",
        boxShadow: "{shadow.sm}",
        transitionMs: 200,
      },
    },
  },
  Toolbar: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        // ADR-297 Phase 3 닫힘 — 묶음 컨테이너는 상자를 칠하지 않는다 (S2 그대로). 생성 CSS 는 composition 이
        //   상자를 가진 rule 의 variant 칠을 내지 않아 DOM 은 투명이었고, Canvas 만 트리의 바탕 · 테두리를 그렸다.
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isHovered: "{color.transparent}",
            isPressed: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
    },
    sizes: {
      // ADR-912 단계5 step4 small-B (2026-06-16): gap 보강 — spec 삭제 후 generated CSS [data-size]
      //   `gap: Npx` 재생성용 (Toolbar.spec.sizes 미러). base gap:8px 는 composition.containerStyles
      //   별도 경로. padding 미emit(ownsContainerBox).
      S: {
        paddingX: 8,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 0,
        gap: 4,
      },
      M: {
        paddingX: 12,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.md}",
        height: 0,
        gap: 8,
      },
      L: {
        paddingX: 16,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.lg}",
        height: 0,
        gap: 10,
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: {
        display: "flex",
        alignItems: "center",
        width: "fit-content",
        height: "fit-content",
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
        ...DISABLED_STATE,
      },
      composition: {
        containerStyles: {
          display: "flex",
          "flex-wrap": "wrap",
          gap: "8px",
          width: "fit-content",
        },
        containerVariants: {
          orientation: {
            horizontal: {
              styles: {
                "flex-direction": "row",
              },
            },
            vertical: {
              styles: {
                "flex-direction": "column",
                "align-items": "start",
              },
            },
          },
        },
        staticSelectors: {
          ".react-aria-Group": {
            display: "contents",
          },
          ".react-aria-ToggleButton": {
            width: "32px",
          },
          ".react-aria-Separator": {
            "align-self": "stretch",
            // (The Separator rule's line color — `{color.border}`, the Canvas line's; ADR-297 후속 ⑤,
            //  `--bg-muted` before: a lighter line in the Preview only.)
            "background-color": "var(--border)",
          },
          '.react-aria-Separator[aria-orientation="vertical"]': {
            width: "1px",
            margin: "0px 10px",
          },
          '.react-aria-Separator:not([aria-orientation="vertical"])': {
            border: "none",
            height: "1px",
            width: "100%",
            margin: "10px 0",
          },
        },
        delegation: [],
      },
    },
  },
  Tooltip: {
    defaultVariant: "neutral",
    defaultSize: "M",
    variants: {
      neutral: {
        paint: {
          backgroundColor: {
            default: "{color.neutral-subtle}",
            isHovered: "{color.neutral-subtle}",
            isPressed: "{color.neutral-subtle}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
      // S2 값 정렬 (2026-10-10 — design-data Tooltip): info → informative, positive 삭제.
      informative: {
        paint: {
          backgroundColor: {
            default: "{color.informative-subtle}",
            isHovered: "{color.informative-subtle}",
            isPressed: "{color.informative-subtle}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
      negative: {
        paint: {
          backgroundColor: {
            default: "{color.negative-subtle}",
            isHovered: "{color.negative-subtle}",
            isPressed: "{color.negative-subtle}",
          },
          color: {
            default: "{color.neutral}",
          },
        },
      },
    },
    // S2 Tooltip (`Tooltip.tsx` — size 축 없음, 모든 크기에 같은 값, ADR-295 Phase 3c-3c): 최소 높이 24 (control S —
    //   터치 30 도 S2 와 같다) · 글자 `ui-sm` · 좌우 `edge-to-text` (높이 × 3/8 = 9) · 위아래 centerPadding (생성기가 식과
    //   대조 — (24 − 16) / 2 = 4) · 테두리 없음. 모서리는 크기 그대로 (토큰 · 별도).
    sizes: {
      S: {
        minHeight: "{size.height.S}",
        paddingX: ofHeight(3, 8),
        paddingY: 4,
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderWidth: "{border.width.none}",
        borderRadius: "{radius.sm}",
        height: 0,
        maxWidth: 160, // Spectrum 스키마 maxWidth (2026-08-21)
      },
      M: {
        minHeight: "{size.height.S}",
        paddingX: ofHeight(3, 8),
        paddingY: 4,
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderWidth: "{border.width.none}",
        borderRadius: "{radius.sm}",
        height: 0,
        maxWidth: 160, // Spectrum 스키마 maxWidth (2026-08-21)
      },
      L: {
        minHeight: "{size.height.S}",
        paddingX: ofHeight(3, 8),
        paddingY: 4,
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderWidth: "{border.width.none}",
        borderRadius: "{radius.md}",
        height: 0,
        maxWidth: 160, // Spectrum 스키마 maxWidth (2026-08-21)
      },
    },
    structure: {
      archetype: "simple",
      element: "div",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
        // ADR-303 (사용자 결정 5 a): S2 `Tooltip.tsx:80` 에 boxShadow 가 없다 — 그림자 없음.
      },
      stateStyles: {
        ...FOCUS_RING_STATE,
        ...DISABLED_STATE,
      },
    },
  },
  // ADR-256 G5 (examples 2 · 9): RAC DialogTrigger · MenuTrigger · TooltipTrigger have no element —
  //   the reference's trigger is the Button itself. The Canvas lays them out as `display: contents`
  //   (Autocomplete 동형 — their children are their parent's items, their box is the union, for
  //   selection only). The closed overlay takes no box on either side.
  MenuTrigger: {
    defaultSize: "M",
    variants: {},
    sizes: {
      M: {
        height: 0,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
      },
    },
    structure: {
      archetype: "container",
      element: "div",
      skipCSSGeneration: true,
      containerStyles: {
        display: "contents",
      },
    },
  },
  TooltipTrigger: {
    defaultSize: "M",
    variants: {},
    sizes: {
      M: {
        height: 0,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
      },
    },
    structure: {
      archetype: "container",
      element: "div",
      skipCSSGeneration: true,
      containerStyles: {
        display: "contents",
      },
    },
  },
  Tree: {
    // ADR-297 Phase 3g — the tree's and its items' states (옛 수동 `Tree.css` — 생성 sheet 가 없는 rule 이라
    //   상태 블록만 담은 `generated/Tree.css`). 항목의 hover · pressed · selected · disabled · drop target 은 같은 바탕 ·
    //   글자에서 옛 순서 그대로 (forced-colors 의 선택 · focus 가 마지막).
    partStateStyles: {
      "&%": {
        outline: { isFocusVisible: "2px solid var(--accent)" },
        outlineOffset: { isFocusVisible: "-1px" },
      },
      "& .react-aria-TreeItem%": {
        background: {
          isHovered: "color-mix(in srgb, var(--fg) 8%, transparent)",
          isPressed: "color-mix(in srgb, var(--fg) 12%, transparent)",
          isSelected: "var(--accent-subtle)",
          isDropTarget: "color-mix(in srgb, var(--accent) 8%, transparent)",
          forcedColors: { isSelected: "Highlight" },
        },
        color: {
          isSelected: "var(--fg-on-accent)",
          isDisabled: "color-mix(in srgb, var(--fg) 38%, transparent)",
          forcedColors: { isSelected: "HighlightText" },
        },
        cursor: { isDisabled: "not-allowed" },
        pointerEvents: { isDisabled: "none" },
        outline: {
          isFocusVisible: "2px solid var(--accent)",
          isDropTarget: "2px solid var(--accent)",
        },
        outlineOffset: {
          isFocusVisible: { default: "-2px", isSelected: "-4px" },
        },
        outlineColor: { forcedColors: { isFocusVisible: "Highlight" } },
      },
      "& .react-aria-TreeItem% .react-aria-Button": {
        color: { isSelected: "var(--fg-on-accent)" },
      },
      '& .react-aria-TreeItem [slot="drag"]%': {
        borderRadius: { isFocusVisible: "var(--radius-xs)" },
        outline: { isFocusVisible: "2px solid var(--accent)" },
      },
      // (선택이 이어진 항목끼리 모서리를 붙인다)
      "& .react-aria-TreeItem%:has(+ [data-selected])": {
        borderEndStartRadius: { isSelected: "0" },
        borderEndEndRadius: { isSelected: "0" },
      },
      "& .react-aria-TreeItem[data-selected] + .react-aria-TreeItem%": {
        borderStartStartRadius: { isSelected: "0" },
        borderStartEndRadius: { isSelected: "0" },
      },
    },
    defaultVariant: "default",
    defaultSize: "M",
    // ADR-913 slice 4 (2026-06-19): ListBox/Menu/TagGroup 동형 collection cutover 멤버인데
    //   ADR-912 단계5 step4 배치에서 containerStyles 이관 누락 → spec 삭제 후 Skia layout
    //   fallback(resolveContainerStylesFallback → LOWERCASE_COMPONENT_RULE_CONTAINER)이 빈
    //   객체 반환 → display 미주입 → Taffy block 처리 → TreeItem 세로 배치 안 됨. DOM 은
    //   starter Tree.css(flex column) 적용 → CSS↔Skia 비대칭(D3 G3 위반). ToggleButtonGroup
    //   slice 0 / ListBox 선례 동형 수정. 값 = starter Tree.css(:3-15) + Menu/ListBox 정합.
    containerStyles: {
      display: "flex",
      flexDirection: "column",
      // 실효 gap 0 — starter Tree.css `@supports selector(:has(.foo))` 블록이 gap:0 재선언
      //   (selected 행 이어붙임 디자인, 모던 브라우저 전부 매치). 2xs(2px)는 dead 값 (2026-07-14).
      gap: "0px",
      padding: "{spacing.xs}",
      width: "100%",
      // 2026-08-20: `maxHeight: "300px"` 제거 — ListBox 가 2026-07-29 사용자 결정으로
      //   같은 값을 뺀 것의 누락 적용분이다 ("컨테이너 높이는 내용이 정하고, 잘라야 하면
      //   요소별로 저작한다 — catalog 가 전 인스턴스에 300 을 강제할 근거가 없다").
      //   Tree 는 발산까지 있었다: 수동 `Tree.css` 는 `max-height: 100%`(부모 기준)인데
      //   catalog 만 300 고정이라 DOM↔Skia 가 서로 다른 상한을 썼다.
      // overflow 도 두지 않는다 (사용자 결정 2026-11-13, ListBox 와 같이): `auto` 면 flex item 의 자동
      //   최소 크기가 0 이라 높이가 정해진 세로 flex 부모에서 Tree 를 눌렀다. 스크롤은 저작한 overflow 로.
      outline: "none",
      // ADR-151 B5 (2026-07-16): 수동 Tree.css `border: 1px solid` 를 layout 이 미반영해
      //   세로 2px 발산 (Skia 72 vs CSS 74) — Calendar/RangeCalendar 동형 layout 채널 보정.
      borderWidth: "{border.width.thin}",
    },
    variants: {
      default: {
        paint: {
          backgroundColor: {
            // S2 TreeView `tree` paints no background (only its drop target) — ADR-297 후속 ②.
            default: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
          borderColor: {
            default: "{color.border}",
          },
        },
      },
      // S2 강조 축 (2026-10-10): accent → emphasized — 공개 prop 은 isEmphasized.
      emphasized: {
        paint: {
          backgroundColor: {
            // S2 TreeView `tree` paints no background (only its drop target) — ADR-297 후속 ②.
            default: "{color.transparent}",
          },
          color: {
            default: "{color.neutral}",
          },
          borderColor: {
            default: "{color.border}",
          },
        },
      },
    },
    sizes: {
      S: {
        paddingX: 8,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.sm}",
        height: scaled(40),
        iconSize: 14,
      },
      M: {
        paddingX: 12,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.md}",
        height: scaled(40),
        iconSize: 16,
      },
      L: {
        paddingX: 16,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.md}",
        height: scaled(40),
        iconSize: 20,
      },
    },
  },
  TreeItem: {
    defaultVariant: "default",
    defaultSize: "M",
    // ADR-239 Phase 1 (2026-09-25): 행 안 역할 자식 (Label Text · Icon · Description) 의 가로 배치 — layout fallback
    //   채널 (CSS 는 수동 `Tree.css` `.react-aria-TreeItem { display:flex; align-items:center; gap: var(--spacing-2xs) }`
    //   그대로). 왼쪽 여백 (chevron 앞까지 · 들여쓰기) · 최소 높이는 깊이에 따라 implicitStyles 가 채운다.
    containerStyles: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: "{spacing.2xs}",
    },
    variants: {
      default: {
        // A selected item (2026-10-13 — a TreeItem set Selected starts its Tree's selection): the
        //   DOM's `Tree.css` `.react-aria-TreeItem[data-selected]` accent-subtle fill. Its chevron
        //   glyph and label Text keep their color there (the Icon · Text own one).
        paint: {
          backgroundColor: {
            default: "{color.transparent}",
            isSelected: {
              default: "{color.accent-subtle}",
            },
          },
          color: {
            default: "{color.neutral}",
            isSelected: {
              default: null,
            },
          },
          borderColor: {
            isSelected: {
              default: null,
            },
          },
        },

        // ADR-912 R1 후속 (2026-06-12): expand/collapse chevron (TreeItem.spec render.shapes 의
        //   chevron-right 이전, DisclosureHeader (B+icon) 동형). color 는 spec 의
        //   {color.neutral-subdued} 보존. leading_icon skiaPrimitive(append) 가 좌측에 그리고
        //   buildCatalogShapes 가 text 를 icon 폭 + gap 만큼 우측 shift. depth indent 는
        //   _treeLevel × indentPerLevel 로 icon/text 공통 base x 에 가산(buildCatalogShapes).
        leadingIcon: {
          name: "chevron-right",
          gap: 6,
          color: "{color.neutral-subdued}",
        },
      },
    },
    sizes: {
      S: {
        fontSize: "{typography.text-xs}",
        // height 24 = spec rowHeight(fontSize 12 + paddingY 6*2). box(height>0) → text
        //   baseline:middle + leading icon y=height/2 (DisclosureHeader parity). 이전 height:0
        //   (inline)은 leading icon 동반 시 baseline drift.
        height: scaled(40),
        paddingX: 8,
        // iconSize = round(fontSize * 1.1) (spec chevronSize 공식).
        iconSize: 13,
        // indentPerLevel 16 = react-aria-starter Tree.css --spacing-4 + drop indicator 16px 정합.
        indentPerLevel: 16,
        borderRadius: "{radius.none}",
      },
      M: {
        // DOM(starter Tree.css)은 size 변형 없는 고정 메트릭: min-height 32(= paddingY 4*2 +
        //   line box 24) + font-size text-base(16) + chevron svg 16. 구 28/text-sm/15 는
        //   spec rowHeight 산술 잔존으로 CSS 실측 대비 -4~-8 drift (2026-07-14 sweep).
        fontSize: "{typography.text-base}",
        height: scaled(40),
        paddingX: 8,
        iconSize: 16,
        indentPerLevel: 16,
        borderRadius: "{radius.none}",
      },
      L: {
        fontSize: "{typography.text-base}",
        height: scaled(40),
        paddingX: 12,
        iconSize: 18,
        indentPerLevel: 16,
        borderRadius: "{radius.none}",
      },
    },
  },
  // ADR-300 — S2 SideNav family (`@react-spectrum/s2` 1.8.1 `SideNav.tsx` · `SideNavPanel.tsx` — breakdown §3).
  //   DOM = RAC `NavigationTree*` · `Link` · `Button`, Canvas = the same node tree. A collapsed panel is S2's
  //   icon rail: its width is `--collapsedWidth` 42 and its rows show their icon only — the panel's
  //   `isCollapsed` reaches its descendants as the `isCollapsed` condition (DOM `[data-side-panel-collapsed]`
  //   ancestor — S2 `SideNav.tsx:642`; Canvas `presence.ts` `catalogSideNavCollapsed`).
  SideNavPanel: {
    partStateStyles: {
      // S2 `treeContent` · `expandButton` · `SideNavHeader`: `display: none` in a collapsed panel.
      "& .react-aria-SideNavItem .react-aria-Text%": {
        display: { isCollapsed: "none" },
      },
      '& .react-aria-SideNavItem .react-aria-Button[slot="chevron"]%': {
        display: { isCollapsed: "none" },
      },
      "& .react-aria-SideNavHeader%": {
        display: { isCollapsed: "none" },
      },
      // S2 `treeCellGrid` `paddingEnd: { default: 4, isCollapsed: 0 }` (the DOM row is the cell — RAC's
      //   gridcell is `display: contents`) · `treeIcon` `marginEnd: { isCollapsed: 0 }`.
      "& .react-aria-SideNavItem%": {
        paddingInlineEnd: { isCollapsed: "0px" },
      },
      "& .react-aria-SideNavItem .react-aria-Icon%": {
        marginInlineEnd: { isCollapsed: "0px" },
      },
    },
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: { default: "{color.transparent}" },
          color: { default: "{color.neutral}" },
        },
      },
    },
    sizes: {
      M: {
        height: 0,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
      },
    },
    structure: {
      archetype: "container",
      element: "div",
      // S2 `--collapsedWidth` 42 — the DOM binding and the Canvas both read this value
      //   (`catalogSideNavPartLayout`): it beats an authored width as S2's inline style does.
      stateStyles: { width: { isCollapsed: "42px" } },
      // S2 `sideNavPanelStyle`: a column — the nav fills it, the collapse button stays below.
      containerStyles: {
        display: "flex",
        flexDirection: "column",
        minHeight: "0px",
        overflow: "hidden",
      },
      composition: {
        delegation: [],
        rootSelectors: {
          // S2 `transition: width 200ms` (none with reduced motion) — a DOM interaction.
          "&": { styles: { transition: "width 200ms" } },
        },
        staticSelectors: {
          // S2 panel: the nav grows, its 160 minimum is unset inside a panel (`isInSideNavPanel`).
          "> .react-aria-SideNav": {
            "flex-grow": "1",
            "flex-shrink": "1",
            "min-width": "0px",
          },
          // S2 expand-button row: `margin: 4` (top · bottom · start).
          '> .react-aria-Button[slot="collapse"]': {
            margin: "4px",
            "align-self": "flex-start",
            "flex-shrink": "0",
          },
        },
      },
    },
  },
  SideNav: {
    partStateStyles: {
      // S2 `tree` focus ring (`outlineOffset: -2`).
      "&%": {
        outline: { isFocusVisible: "2px solid var(--focus-ring)" },
        outlineOffset: { isFocusVisible: "-2px" },
      },
    },
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        paint: {
          backgroundColor: { default: "{color.transparent}" },
          color: { default: "{color.neutral-subdued}" },
        },
      },
    },
    sizes: {
      // S2 rows `marginTop: space(6)` (the first 0) — the Canvas column gap · the DOM row margin.
      M: { height: 0, borderRadius: "{radius.none}" },
    },
    structure: {
      archetype: "container",
      element: "div",
      // S2 `sideNavWrapper` + `tree`: `minWidth: 160` (unset inside a panel), `overflowY: auto`,
      //   `--indent` 16.
      containerStyles: {
        display: "flex",
        flexDirection: "column",
        minWidth: "160px",
        minHeight: "0px",
        overflow: "auto",
        gap: "6px",
        "--indent": "16px",
      },
      composition: {
        delegation: [],
        rootSelectors: {
          // RAC draws every row as a sibling (`role=row`) — the row margins below are the spacing,
          //   so the column gap (the Canvas's nested items) stays off in the DOM.
          "&": { styles: { "user-select": "none", outline: "none", gap: "0" } },
        },
        // S2 `SideNav.module.css` — the rows' · headers' view transitions (user decision 2: the DOM
        //   runs S2's motion; `sideNav.components.tsx` names the transition types and classes).
        externalStyles: [
          {
            selector:
              "::view-transition-group(.side-nav-item), ::view-transition-group(.side-nav-header)",
            styles: {
              "animation-duration": "200ms",
              "animation-timing-function": "cubic-bezier(0.45, 0, 0.4, 1)",
            },
          },
          {
            selector:
              "::view-transition-old(.side-nav-item), ::view-transition-new(.side-nav-item), ::view-transition-old(.side-nav-header), ::view-transition-new(.side-nav-header)",
            styles: { width: "100%", height: "100%" },
          },
          {
            selector:
              ":root:active-view-transition-type(side-panel-expand, side-nav-item-collapse, side-nav-item-expand)::view-transition-old(root)",
            styles: { animation: "none", opacity: "0" },
          },
          {
            selector:
              ":root:active-view-transition-type(side-panel-expand, side-nav-item-collapse, side-nav-item-expand)::view-transition-new(root)",
            styles: { animation: "none", "mix-blend-mode": "normal" },
          },
          {
            // (A header comes back from `display: none` on expand — its fade waits for the rows.)
            selector:
              ":root:active-view-transition-type(side-panel-expand)::view-transition-new(.side-nav-header)",
            styles: {
              "animation-duration": "100ms",
              "animation-delay": "100ms",
            },
          },
        ],
        staticSelectors: {
          // RAC draws every row as a sibling (`role=row`): S2 `marginTop: space(6)`, the first 0.
          ".react-aria-SideNavItem:not(:first-child)": { "margin-top": "6px" },
          // S2 `SideNavSection`: `marginTop: 24` from the second on.
          ".react-aria-SideNavSection:not(:first-child)": {
            "margin-top": "24px",
          },
        },
      },
    },
  },
  SideNavItem: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        // S2 `treeCellGrid` color: `neutral-subdued`, the current row (and a closed current ancestor)
        //   `neutral` bold, disabled `gray-400`. The current-route bar (S2 `indicator`): 2 × 18,
        //   `gray-400` hovered, `gray-800` current — `currentIndicator` below.
        paint: {
          backgroundColor: { default: "{color.transparent}" },
          color: {
            default: "{color.neutral-subdued}",
            isCurrent: "{color.neutral}",
            isDisabled: "{color.border-hover}",
          },
        },
      },
    },
    sizes: {
      // S2 `treeRow`: `minHeight: 32` · `borderRadius: sm` · `font: ui`; `--indent` 16 per level.
      M: {
        height: 0,
        minHeight: scaled(32),
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.sm}",
        indentPerLevel: 16,
      },
    },
    // S2 `indicator`: shown hovered (`gray-400`) and current (`gray-800`).
    partStateStyles: {
      // (S2 `isLinkPressed`: the row's link is pressed — the runtime measures the row.)
      "&:has(.react-aria-SideNavItemLink%)": {
        transform: { isPressed: catalogPressTransform() },
      },
      "&%::before": {
        display: { isHovered: "block", isCurrent: "block" },
        background: {
          isHovered: "var(--border-hover)",
          isCurrent: "var(--fg)",
        },
      },
    },
    structure: {
      archetype: "container",
      element: "div",
      // S2 `treeCellGrid` bold current row · `treeRowFocusRing` (2, offset −2).
      stateStyles: {
        fontWeight: { isCurrent: "700" },
        outline: { isFocusVisible: "2px solid var(--focus-ring)" },
        outlineOffset: { isFocusVisible: "-2px" },
        // S2 `SideNav.tsx:365` — the row presses, its link's press too (`partStateStyles`).
        ...PRESS_STATE,
        transition: CATALOG_PRESS_TRANSITION,
      },
      // The item is a column on the Canvas — its row (SideNavItemContent) then its child items (RAC
      //   draws them as the next rows, the Tree's way).
      containerStyles: {
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      },
      composition: {
        delegation: [],
        rootSelectors: {
          // S2 `treeRow`: the DOM row is RAC's `role=row` (a flat sibling of every other row).
          "&": {
            styles: {
              position: "relative",
              display: "flex",
              // (RAC's gridcell is `display: contents` — the row is S2's `treeCellGrid` line: 12 + level
              //   indent before, 4 after, items centered.)
              "flex-direction": "row",
              "align-items": "center",
              // (The column gap is the Canvas's item column — the DOM row's parts are S2's grid line.)
              gap: "0",
              "padding-inline-start":
                "calc(12px + (var(--tree-item-level, 1) - 1) * 16px)",
              "padding-inline-end": "4px",
              "min-height": "32px",
              width: "100%",
              "box-sizing": "border-box",
              // (Its color · font size are the paint tree's and the size's — a resting color here
              //   came after the tree in the sheet and beat the current row's.)
              outline: "none",
              cursor: "default",
            },
          },
          // S2 `indicator` — the current-route bar: 2 × 18 at `(level − 1) × indent + 4`, centered.
          "&::before": {
            styles: {
              content: '""',
              position: "absolute",
              display: "none",
              width: "2px",
              height: "18px",
              top: "50%",
              transform: "translateY(-50%)",
              "inset-inline-start":
                "calc((var(--tree-item-level, 1) - 1) * 16px + 4px)",
              "border-radius": "9999px",
            },
          },
          // The row's nodes (S2 `treeIcon` · `treeContent` · `expandButton`) — RAC's gridcell is
          //   `display: contents`, so they are the row's flex items (the Canvas's SideNavItemContent row).
          "& > [role=gridcell] > .react-aria-Icon": {
            styles: { "flex-shrink": "0", "margin-inline-end": "8px" },
          },
          // (Its label takes the row's type and color — S2 `treeCellGrid` · `font: ui`; the Text sheet's
          //   own color · size would win over the inheritance.)
          "& .react-aria-Text": {
            styles: {
              color: "inherit",
              "font-size": "inherit",
              "font-weight": "inherit",
              "line-height": "inherit",
            },
          },
          "& > [role=gridcell] > .react-aria-SideNavItemLink": {
            styles: { "flex-grow": "1", "min-width": "0px" },
          },
          "& > [role=gridcell] > .react-aria-Text": {
            styles: { "flex-grow": "1", "min-width": "0px" },
          },
          // S2 `expandButton`: 32 × 32, no button paint (the Tree chevron's `all: unset`), the glyph in
          //   the row's color; hidden on an item without child items (its box stays — S2
          //   `visibility: hidden`), turned 90° on an expanded item.
          '& > [role=gridcell] > .react-aria-Button[slot="chevron"]': {
            styles: {
              all: "unset",
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              width: "32px",
              height: "32px",
              "flex-shrink": "0",
              color: "inherit",
              cursor: "default",
            },
          },
          '&:not([data-has-child-items]) > [role=gridcell] > .react-aria-Button[slot="chevron"]':
            { styles: { visibility: "hidden" } },
          '&[data-expanded] > [role=gridcell] > .react-aria-Button[slot="chevron"] .react-aria-Icon':
            { styles: { transform: "rotate(90deg)" } },
        },
      },
    },
  },
  SideNavItemContent: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: { default: { paint: {} } },
    sizes: { M: { height: 0 } },
    structure: {
      archetype: "container",
      element: "div",
      skipCSSGeneration: true,
      // The Canvas row (the DOM's gridcell — `SideNavItem` rule): S2 `treeCellGrid` as a flex line —
      //   `paddingStart` 12 + level indent, `paddingEnd` 4 — collapsed, the SideNavPanel rule's 0
      //   (`catalogSideNavPartLayout` reads both).
      containerStyles: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        minHeight: "32px",
        paddingLeft: "12px",
        paddingRight: "4px",
      },
      // (Its DOM is RAC's gridcell — the row's nodes are placed by the `SideNavItem` rule.)
      composition: { delegation: [] },
    },
  },
  SideNavItemLink: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: { default: { paint: {} } },
    sizes: { M: { height: 0 } },
    structure: {
      archetype: "container",
      element: "a",
      stateStyles: { cursor: { isDisabled: "default" } },
      // S2 `treeRowLink`: `icon content badge` in a row, `textDecoration: none`, `color: inherit`.
      containerStyles: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        minWidth: "0px",
      },
      composition: {
        delegation: [],
        rootSelectors: {
          "&": {
            styles: {
              "text-decoration": "none",
              color: "inherit",
              outline: "none",
              cursor: "pointer",
            },
          },
        },
        staticSelectors: {
          "> .react-aria-Icon": {
            "flex-shrink": "0",
            "margin-inline-end": "8px",
          },
          "> .react-aria-Text": { "flex-grow": "1", "min-width": "0px" },
        },
      },
    },
  },
  SideNavSection: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: { default: { paint: {} } },
    sizes: { M: { height: 0 } },
    structure: {
      archetype: "container",
      element: "div",
      containerStyles: { display: "flex", flexDirection: "column", gap: "6px" },
      composition: {
        delegation: [],
        // RAC's rowgroup holds the header and the rows as siblings — the rows' margins (the SideNav
        //   rule) are the DOM spacing, the column gap the Canvas's.
        rootSelectors: { "&": { styles: { gap: "0" } } },
      },
    },
  },
  SideNavHeader: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        // S2 `SideNavHeader`: `gray-600` (our `neutral-subdued`).
        paint: { color: { default: "{color.neutral-subdued}" } },
      },
    },
    sizes: {
      // S2: `font: ui-sm` · `fontWeight: medium` · `height: 16` · `marginBottom: 8` (the first row's
      //   own 6 follows — S2 rows `marginTop: space(6)` but the first child; the header is first).
      M: {
        height: scaled(16),
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        fontWeight: 500,
      },
    },
    structure: {
      archetype: "container",
      element: "div",
      containerStyles: {
        display: "flex",
        alignItems: "center",
        paddingLeft: "12px",
        marginBottom: "8px",
      },
      composition: {
        delegation: [],
        rootSelectors: {
          "&": { styles: { position: "relative" } },
          // (Its text is its Text child — S2's header type and color.)
          "& .react-aria-Text": {
            styles: {
              color: "inherit",
              "font-size": "inherit",
              "font-weight": "inherit",
              "line-height": "inherit",
            },
          },
        },
      },
    },
  },
};

// S2 LabeledValue uses field() grid and field label typography.
COMPONENT_RULES_TABLE.LabeledValue = {
  ...COMPONENT_RULES_TABLE.TextField,
  sizes: Object.fromEntries(
    Object.entries(COMPONENT_RULES_TABLE.TextField.sizes)
      .filter(([size]) => size !== "XS")
      .map(([size, values]) => [
        size,
        {
          fontSize: values.fontSize,
          lineHeight: COMPONENT_RULES_TABLE.Label.sizes[size].lineHeight,
          gap: 0,
          height: 0,
        },
      ]),
  ),
  structure: {
    archetype: "container",
    element: "div",
    containerStyles: {
      display: "grid",
      gridTemplateColumns: "1fr",
      alignItems: "baseline",
      height: "fit-content",
    },
    composition: {
      delegation: [],
      rootSelectors: {
        "& > .react-aria-Text": {
          styles: { "font-size": "inherit", "line-height": "inherit" },
        },
      },
      containerVariants: {
        "label-position": {
          side: {
            styles: {
              "grid-template-columns": "auto 1fr",
              "column-gap": "12px",
            },
          },
          top: { styles: { "grid-template-columns": "1fr" } },
        },
      },
    },
  },
};

// LinkButton uses the same editable Button visual contract, rendered as a RAC Link.
// Preserve every shared Button selector when resetting the native anchor decoration.
const linkButtonSelectors =
  COMPONENT_RULES_TABLE.Button.structure?.composition?.rootSelectors;
const sharedButtonSelectors =
  linkButtonSelectors && typeof linkButtonSelectors === "object"
    ? Object.fromEntries(Object.entries(linkButtonSelectors))
    : {};
const sharedButtonRoot = sharedButtonSelectors["&"];
const sharedButtonRootBlock =
  sharedButtonRoot && typeof sharedButtonRoot === "object"
    ? Object.fromEntries(Object.entries(sharedButtonRoot))
    : {};
const sharedButtonRootStyles = sharedButtonRootBlock.styles;
const sharedButtonStyleBlock =
  sharedButtonRootStyles && typeof sharedButtonRootStyles === "object"
    ? Object.fromEntries(Object.entries(sharedButtonRootStyles))
    : {};
COMPONENT_RULES_TABLE.LinkButton = {
  ...COMPONENT_RULES_TABLE.Button,
  structure: {
    ...COMPONENT_RULES_TABLE.Button.structure!,
    element: "a",
    composition: {
      ...COMPONENT_RULES_TABLE.Button.structure?.composition,
      rootSelectors: {
        ...sharedButtonSelectors,
        "&": {
          ...sharedButtonRootBlock,
          styles: { ...sharedButtonStyleBlock, "text-decoration": "none" },
        },
      },
    },
  },
};

// S2 RangeSlider shares all Slider visual axes; only its two-thumb state differs.
COMPONENT_RULES_TABLE.RangeSlider = { ...COMPONENT_RULES_TABLE.Slider };
COMPONENT_RULES_TABLE.SegmentedControl = {
  defaultSize: "M",
  defaultVariant: "default",
  containerStyles: SEGMENTED_GROUP_CONTAINER,
  variants: {
    default: {
      paint: { backgroundColor: { default: "{color.neutral-surface}" } },
    },
  },
  sizes: {
    M: {
      borderRadius: "{radius.md}",
      fontSize: "{typography.text-sm}",
      lineHeight: "{typography.text-sm--line-height}",
      gap: 4,
    },
  },
  structure: {
    archetype: "container",
    element: "div",
    containerStyles: SEGMENTED_GROUP_CONTAINER,
    composition: {
      rootPaint: "variant",
      delegation: [],
      rootSelectors: {
        "&[data-justified] > .react-aria-SegmentedControlItem": {
          styles: { "flex-grow": 1, "flex-basis": 0 },
        },
      },
      containerVariants: {
        orientation: {
          horizontal: { styles: { "flex-direction": "row" } },
          vertical: { styles: { "flex-direction": "column" } },
        },
      },
    },
  },
};
COMPONENT_RULES_TABLE.SegmentedControlItem = {
  defaultSize: "M",
  defaultVariant: "default",
  localeTypography: COMPONENT_RULES_TABLE.Label.localeTypography,
  containerStyles: SEGMENTED_ITEM_CONTAINER,
  partStateStyles: {
    "&% .react-aria-SelectionIndicator": {
      "border-color": SEGMENTED_INDICATOR_BORDER,
    },
  },
  variants: {
    default: {
      paint: {
        backgroundColor: { default: "{color.transparent}" },
        color: {
          default: "{color.neutral-subdued}",
          isSelected: "{color.neutral-content}",
          isDisabled: "{color.disabled-content}",
        },
      },
    },
  },
  sizes: {
    M: {
      ...COMPONENT_RULES_TABLE.ActionButton.sizes.M,
      minHeight: undefined,
      height: scaled(32),
      minWidth: "{size.height.M}",
      paddingX: scaled((32 * 3) / 8),
      paddingY: 0,
      fontWeight: 400,
      borderWidth: 0,
    },
  },
  structure: {
    archetype: "button",
    element: "button",
    containerStyles: SEGMENTED_ITEM_CONTAINER,
    stateStyles: {
      ...ACTION_FOCUS_RING_STATE,
      outline: { default: "none", ...ACTION_FOCUS_RING_STATE.outline },
    },
    composition: {
      delegation: [],
      staticSelectors: {
        ".react-aria-Text": {
          "min-width": "0px",
          "white-space": "nowrap",
          "text-overflow": "ellipsis",
          overflow: "hidden",
        },
      },
      rootSelectors: {
        "&": { styles: { "z-index": "1" } },
        "&[data-selected]": { styles: { "z-index": "0" } },
        "& > div:not(.react-aria-SelectionIndicator)": {
          styles: {
            "will-change": CATALOG_PRESS_WILL_CHANGE,
            transition: CATALOG_PRESS_TRANSITION,
          },
          reducedMotion: { transition: "none" },
        },
        "&[data-pressed] > div:not(.react-aria-SelectionIndicator)": {
          styles: { transform: catalogPressTransform() },
        },
        "& .react-aria-Text": {
          styles: {
            position: "relative",
            "z-index": 1,
            "font-size": "inherit",
            "font-weight": "inherit",
            "line-height": "inherit",
            color: "inherit",
          },
        },
        "& .react-aria-SelectionIndicator": {
          styles: {
            ...SEGMENTED_INDICATOR_MOTION,
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            background: "var(--bg)",
            "border-width": "2px",
            "border-style": "solid",
            "border-radius": "10px",
          },
          reducedMotion: { transition: "none" },
        },
      },
    },
  },
};

// ADR-295 Phase 3c-3: the size blocks' relative forms (`ofHeight` · `em`) → numbers in the installed maps.
defineRuleLengthForms(COMPONENT_RULES_TABLE, (ref) => resolveToken(ref));
