import type {
  CatalogFillStyleValues,
  ComponentRuleSize,
  ComponentRuleVariant,
} from "../../types/catalog-style.types";
import type { ConditionSet } from "../rule/conditionTree";
import { evaluatePaint, type ComponentRulePaint } from "../rule/rulePaintTree";

export type CatalogInteractionState = "default" | "hover" | "pressed";

export interface ResolveCatalogPaintInput {
  variant: ComponentRuleVariant | undefined;
  size: ComponentRuleSize | undefined;
  props: Readonly<Record<string, unknown>>;
  style: Readonly<Record<string, unknown>> | undefined;
  interactionState: CatalogInteractionState;
  /** The rule's `fillStyle` value names (`ComponentRule.fillStyleValues`). */
  fillStyleValues?: CatalogFillStyleValues;
}

/**
 * The fill a `fillStyle` value picks: `outline` · `subtle`, or the default fill — by the rule's
 * value names (`ComponentRule.fillStyleValues`), else by the fill keys' own names.
 */
export function catalogFillStyleKey(
  value: unknown,
  values: CatalogFillStyleValues | undefined,
): "outline" | "subtle" | "default" {
  if (value === (values?.outline ?? "outline")) return "outline";
  if (value === (values?.subtle ?? "subtle")) return "subtle";
  return "default";
}

export interface ResolvedCatalogPaint {
  backgroundColor?: string;
  color?: string;
  borderColor?: string;
  /** Catalog 고유 opacity 배율. canonical `_fillBgAlpha`는 renderer adapter가 별도로 곱한다. */
  backgroundAlpha: number;
  staticTrackWash: boolean;
  hasVisibleBoxPaint: boolean;
  hasOpaqueCatalogBackground: boolean;
}

const TRANSPARENT_TOKEN = "{color.transparent}";
// "Show all" 글자 — 바탕 위 accent (ADR-290)
const ACCENT_TOKEN = "{color.accent-content}";

/**
 * Catalog variant와 authored semantic props에서 root symbolic paint를 선택한다.
 *
 * DOM/Canvas 객체나 global store를 읽지 않는 O(1) pure resolver다. component type을
 * 입력받지 않고 fill/border/fillBar 같은 data channel 존재 여부만으로 분기한다.
 */
export function resolveCatalogPaint({
  variant,
  size,
  props,
  style,
  interactionState,
  fillStyleValues,
}: ResolveCatalogPaintInput): ResolvedCatalogPaint {

  const fillKey = catalogFillStyleKey(props.fillStyle, fillStyleValues);
  const isOutline = fillKey === "outline";
  const isSubtle = fillKey === "subtle";
  const isSelected = props.isSelected === true;
  const isShowAll = props._isShowAll === true;
  // ADR-297: the state-dependent paint is the variant's condition tree (`paint`) — key order is
  //   the priority. A variant without one paints no state colors. Phase 3: the static color scheme
  //   (`staticColor` black · white) is the tree's `staticColor` branch too — one evaluation.
  const staticColor = props.staticColor;
  const staticTone =
    staticColor === "black" || staticColor === "white" ? staticColor : undefined;
  const conditions: ConditionSet = {
    isHovered: interactionState === "hover",
    isPressed: interactionState === "pressed",
    isSelected,
    isEmphasized: props.isEmphasized === true,
    isQuiet: props.isQuiet === true,
    ...(typeof props.fillStyle === "string"
      ? { fillStyle: props.fillStyle }
      : {}),
  };
  const state = variant?.paint
    ? treeStatePaint(
        variant.paint,
        staticTone ? { ...conditions, staticColor: staticTone } : conditions,
      )
    : NO_STATE_PAINT;
  // (the theme paint of the same state — the static overlay alpha and the track wash ask whether the
  //  static color sits on an opaque background)
  const themeBackground =
    staticTone && variant?.paint
      ? evaluatePaint(variant.paint.backgroundColor, conditions)
      : state.background;

  const catalogAlpha = variant?.alpha ?? 1;
  const staticOnOpaqueBackground =
    staticTone != null &&
    !isOutline &&
    !isSubtle &&
    themeBackground != null &&
    themeBackground !== TRANSPARENT_TOKEN &&
    catalogAlpha !== 0;
  const staticTrackWash = staticOnOpaqueBackground && variant?.fillBar != null;

  const backgroundColor = isShowAll
    ? TRANSPARENT_TOKEN
    : ((style?.backgroundColor as string | undefined) ??
      state.background ??
      (isOutline ? TRANSPARENT_TOKEN : undefined));
  const color = isShowAll
    ? ACCENT_TOKEN
    : ((style?.color as string | undefined) ?? state.color);

  // catalog 이 준 테두리 (variant 트리 · static 가지) — 사용자 인라인 border 는 아래 borderColor 에만.
  const catalogBorderColor = isShowAll ? undefined : state.border;
  const borderColor = isShowAll
    ? undefined
    : ((style?.borderColor as string | undefined) ?? catalogBorderColor);

  const hasVisibleBoxPaint =
    style?.backgroundColor != null ||
    (backgroundColor != null && catalogAlpha !== 0) ||
    !!borderColor;
  // box archetype 신호는 **catalog** 배경·테두리만 — 사용자가 inline text leaf (Text 등) 에 붙인 border 는
  //   DOM 에서 inline flow 를 바꾸지 않으므로 (배경색과 같은 판정, 2026-07-21) 여기서도 세지 않는다.
  //   종전엔 `!!borderColor` 가 사용자 border 를 포함해 Text 에 1px 테두리만 줘도 box 로 판정 → 텍스트가
  //   중앙 배치되고 (padding 0 이면 7줄이 상자 밖) DOM 과 갈렸다 (사용자 live 2026-09-20).
  const hasOpaqueCatalogBackground =
    (state.background != null &&
      state.background !== TRANSPARENT_TOKEN &&
      catalogAlpha !== 0) ||
    !!catalogBorderColor;

  return {
    backgroundColor,
    color,
    borderColor,
    // (a static paint at the rule's S2 overlay opacity — a value-fill track 0.17, its fill 0.94)
    backgroundAlpha:
      catalogAlpha *
      (staticOnOpaqueBackground ? (variant?.staticAlpha ?? 1) : 1),
    staticTrackWash,
    hasVisibleBoxPaint,
    hasOpaqueCatalogBackground,
  };
}

interface StatePaint {
  background: string | undefined;
  color: string | undefined;
  border: string | undefined;
}
const NO_STATE_PAINT: StatePaint = {
  background: undefined,
  color: undefined,
  border: undefined,
};

/** ADR-297 — the condition tree's paint for one condition set (key order = priority). */
function treeStatePaint(
  paint: ComponentRulePaint,
  conditions: ConditionSet,
): StatePaint {
  return {
    background: evaluatePaint(paint.backgroundColor, conditions),
    color: evaluatePaint(paint.color, conditions),
    border: evaluatePaint(paint.borderColor, conditions),
  };
}
