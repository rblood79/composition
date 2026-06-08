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
  resolveComponentRule,
  type ComponentRule,
  type ComponentRuleVariant,
  type ComponentRuleSize,
} from "@composition/shared";
import type { ComponentVisualRule, SizeSpec } from "@composition/specs";

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
  };
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

/** ComponentRuleSize(number|string) → SizeSpec 시각 필드 부분 투영. */
export function ruleSizeToSizeSpec(s: ComponentRuleSize): Partial<SizeSpec> {
  return s as unknown as Partial<SizeSpec>;
}
