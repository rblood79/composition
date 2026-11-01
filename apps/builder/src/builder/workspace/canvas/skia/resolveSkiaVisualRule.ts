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
  type ComponentRuleVariant,
} from "@composition/shared";
import type { ComponentVisualRule } from "@composition/rendering";

/**
 * shared ComponentRuleVariant(string) → specs ComponentVisualRule(TokenRef) — 비-칠 시각 값만. 칠 (배경 ·
 * 글자 · 테두리와 그 상태) 은 variant 의 조건 트리를 `resolveCatalogPaint` 가 평가해 primitive 에 `paint` 로
 * 준다 (ADR-297) — 여기서 옮기지 않는다.
 */
export function ruleVariantToVisual(
  v: ComponentRuleVariant,
): ComponentVisualRule {
  return {
    textWeight: v.textWeight,
    currentTextWeight: v.currentTextWeight,
    // fontFamily 는 ComponentRuleVariant 본문 정식 필드(Code/Kbd mono 등 보편 D3).
    fontFamily: v.fontFamily,
    borderStyle: v.borderStyle,
    // value 채움 색 (ADR-912 선행-2) — ComponentRuleVariant.fillBar 정식 필드.
    fillBar: v.fillBar as ComponentVisualRule["fillBar"],
    // leading icon (ADR-912 (B+icon)) — name/gap/color 동형 캐스팅(color 만 string→TokenRef 런타임 동형).
    leadingIcon: v.leadingIcon as ComponentVisualRule["leadingIcon"],
    // leading avatar (2026-08-21 Tag chip 아바타) — leadingIcon 과 같은 좌측 슬롯,
    //   둘 다 있으면 avatar 우선(resolveLeadingSlot 단일 판정). 동형 캐스팅.
    leadingAvatar: v.leadingAvatar as ComponentVisualRule["leadingAvatar"],
    // trailing icon + textAlign (ADR-912 (B+icon) CalendarHeader) — 동형 캐스팅.
    trailingIcon: v.trailingIcon as ComponentVisualRule["trailingIcon"],
    textAlign: v.textAlign,
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
