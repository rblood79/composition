/**
 * ADR-142 G2(b) B — Skia generic 렌더러의 시각 규칙 주입 어댑터 (builder 경계).
 *
 * **패키지 경계 (RB5)**: `buildCatalogShapes`(specs)는 shared 의 rule 테이블을 import 못 한다
 * (`specs ← shared` 의존 방향). builder(본 모듈, specs·shared 양쪽 import 가능)가
 * `resolveComponentRule(type)`(shared/catalog, build-time 생성 테이블)로 rule 을 얻어
 * specs 의 `ComponentVisualRule` / `SizeSpec` 형태로 변환해 generic 렌더러에 **주입**한다.
 *
 * 이로써 buildCatalogShapes/skiaPrimitive 는 spec 을 전혀 읽지 않는다(ADR-142 #8 — runtime
 * spec 참조 0). TokenRef(`{color.X}`)는 shared 에선 plain string, specs 에선 branded
 * `\`{${string}}\`` 이지만 런타임 동형 → narrow 캐스팅만 한다.
 */

import {
  resolveCatalogPaint,
  resolveComponentRule,
  type ComponentRule,
  type ComponentRuleVariant,
  type ComponentRuleSize,
} from "@composition/shared";
import type {
  CatalogResolvedPaint,
  ComponentState,
  ComponentVisualRule,
  SizeSpec,
} from "@composition/specs";

/** shared ComponentRuleVariant(string) → specs ComponentVisualRule(TokenRef). 런타임 동형 캐스팅. */
export function ruleVariantToVisual(
  v: ComponentRuleVariant,
): ComponentVisualRule {
  const c = v.colors ?? {};
  // fill 은 ComponentRuleFill(string) 과 FillTokenSpec(TokenRef) 가 동형 — 구조 그대로 캐스팅.
  // borderStyle/textWeight 는 ComponentRuleVariant 본문 정식 필드(DropZone dashed/400 등 보편 D3).
  return {
    fill: v.fill as unknown as ComponentVisualRule["fill"],
    text: c.text as ComponentVisualRule["text"],
    textHover: c.textHover as ComponentVisualRule["textHover"],
    textWeight: v.textWeight,
    // fontFamily 는 ComponentRuleVariant 본문 정식 필드(Code/Kbd mono 등 보편 D3).
    fontFamily: v.fontFamily,
    border: c.border as ComponentVisualRule["border"],
    borderHover: c.borderHover as ComponentVisualRule["borderHover"],
    borderStyle: v.borderStyle,
    // value 채움 색 (ADR-912 선행-2) — ComponentRuleVariant.fillBar 정식 필드.
    fillBar: v.fillBar as ComponentVisualRule["fillBar"],
    outlineText: c.outlineText as ComponentVisualRule["outlineText"],
    outlineBorder: c.outlineBorder as ComponentVisualRule["outlineBorder"],
    subtleText: c.subtleText as ComponentVisualRule["subtleText"],
    selectedText: c.selectedText as ComponentVisualRule["selectedText"],
    selectedBorder: c.selectedBorder as ComponentVisualRule["selectedBorder"],
    emphasizedSelectedText:
      c.emphasizedSelectedText as ComponentVisualRule["emphasizedSelectedText"],
    emphasizedSelectedBorder:
      c.emphasizedSelectedBorder as ComponentVisualRule["emphasizedSelectedBorder"],
    // leading icon (ADR-912 (B+icon)) — ComponentRuleVariant.leadingIcon 정식 필드.
    //   name/gap/color 동형 캐스팅(color 만 string→TokenRef 런타임 동형).
    leadingIcon: v.leadingIcon as ComponentVisualRule["leadingIcon"],
    // leading avatar (2026-08-21 Tag chip 아바타) — leadingIcon 과 같은 좌측 슬롯,
    //   둘 다 있으면 avatar 우선(resolveLeadingSlot 단일 판정). 동형 캐스팅.
    leadingAvatar: v.leadingAvatar as ComponentVisualRule["leadingAvatar"],
    // selection checkbox (2026-08-21) — leading 슬롯 **앞**의 별도 슬롯(가산). 동형 캐스팅.
    selectionCheckbox:
      v.selectionCheckbox as ComponentVisualRule["selectionCheckbox"],
    // trailing icon + textAlign (ADR-912 (B+icon) CalendarHeader) — inline_icon_text replace
    //   module 이 leading+center text+trailing 을 함께 그릴 때 사용. 동형 캐스팅.
    trailingIcon: v.trailingIcon as ComponentVisualRule["trailingIcon"],
    textAlign: v.textAlign,
  };
}

/** 선택 상태 — 목록 owner 선택 (`_isSelected`) 또는 상태 변형 origin 의 강제 상태 (`isSelected`). */
function isSelectedProps(props: Readonly<Record<string, unknown>>): boolean {
  return props._isSelected === true || props.isSelected === true;
}

/**
 * 그릴 catalog 변형 이름 — 작성자 `variant` 가 우선이고, 없으면 선택 상태는 rule 의 `selected` 변형 (있을 때 —
 * Tag), 아니면 rule 기본 변형. DOM `.react-aria-Tag[data-selected]` 가 색 변수를 accent 로 바꾸는 것과 같은
 * 결과 (사용자 지적 2026-09-24 — 선택 Tag 가 Canvas 에서 비선택과 같았다).
 */
export function resolveCatalogVariantName(
  rule: ComponentRule | undefined,
  props: Readonly<Record<string, unknown>>,
): string | undefined {
  const explicit = props.variant;
  if (typeof explicit === "string" && explicit) return explicit;
  if (isSelectedProps(props) && rule?.variants.selected) return "selected";
  return rule?.defaultVariant;
}

/**
 * 컴포넌트 type + variant 이름 → ComponentVisualRule. rule/variant 미존재 시 undefined
 * (variant 없는 컨테이너 shell). resolveComponentVisual(spec, name) 의 rule 기반 대체.
 */
export function resolveSkiaVisualRule(
  type: string,
  variantName: string | undefined,
): ComponentVisualRule | undefined {
  const rule = resolveComponentRule(type);
  if (!rule) return undefined;
  const vName = variantName ?? rule.defaultVariant;
  if (!vName) return undefined;
  const variant = rule.variants[vName];
  if (!variant) return undefined;
  return ruleVariantToVisual(variant);
}

/** rule 그대로 노출(size/defaultVariant 등 caller 가 추가로 읽을 때). 미존재 시 undefined. */
export function resolveSkiaRule(type: string): ComponentRule | undefined {
  return resolveComponentRule(type);
}

export interface SkiaCatalogRenderInput {
  rule: ComponentRule | undefined;
  visual: ComponentVisualRule | undefined;
  paint: CatalogResolvedPaint;
}

function readStyle(
  props: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> | undefined {
  const style = props.style;
  return style && typeof style === "object" && !Array.isArray(style)
    ? (style as Readonly<Record<string, unknown>>)
    : undefined;
}

function toCatalogInteractionState(
  state: ComponentState,
): "default" | "hover" | "pressed" {
  return state === "hover" || state === "pressed" ? state : "default";
}

/**
 * Catalog type 1개의 rule/visual/root paint를 한 번에 해소하는 Builder 경계.
 * `resolveCatalogPaint` 호출은 이 함수의 1회가 전부이며 renderer는 결과를 재계산하지 않는다.
 */
export function resolveSkiaCatalogRenderInput(
  type: string,
  props: Readonly<Record<string, unknown>>,
  state: ComponentState,
): SkiaCatalogRenderInput {
  const rule = resolveComponentRule(type);
  const variantName = resolveCatalogVariantName(rule, props);
  const variant = variantName ? rule?.variants[variantName] : undefined;
  // rule 이 선택을 변형으로 표현하면 (Tag) 선택 모양은 그 변형 자체 — 변형 안의 선택 상태
  //   (`fill.default.selected` · `colors.selectedText`) 로 다시 고르면 없는 키라 색이 비어 투명해진다.
  const paintProps =
    variantName === "selected" && props.isSelected === true
      ? { ...props, isSelected: false }
      : props;
  const sizeName = (props.size as string | undefined) ?? rule?.defaultSize;
  const size = sizeName ? rule?.sizes[sizeName] : undefined;

  return {
    rule,
    visual: variant ? ruleVariantToVisual(variant) : undefined,
    paint: resolveCatalogPaint({
      variant,
      size,
      props: paintProps,
      style: readStyle(paintProps),
      interactionState: toCatalogInteractionState(state),
    }),
  };
}

/** ComponentRuleSize(number|string) → SizeSpec 시각 필드 부분 투영. */
export function ruleSizeToSizeSpec(s: ComponentRuleSize): Partial<SizeSpec> {
  return s as unknown as Partial<SizeSpec>;
}
