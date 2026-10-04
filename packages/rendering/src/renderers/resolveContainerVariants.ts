/**
 * ADR-108 P1 — `containerVariants` 런타임 소비 helper
 *
 * `CompositionSpec.containerVariants` 데이터를 3 consumer (CSS/Canvas/Panel) 가
 * 동일 규칙으로 소비하도록 추출한 SSOT helper. CSSGenerator (`renderers/CSSGenerator.ts:1147`)
 * 는 여전히 전체 variant 를 emit 하지만, Canvas / Panel 은 현재 props 값에 매칭되는
 * variant 만 필요하다.
 *
 * ## 동작
 *
 * - `spec.composition.containerVariants` 순회 → 각 dataAttr 에 대해 `props[camelCase(dataAttr)]`
 *   값과 매칭되는 variant 를 선택 (multiple dataAttr 동시 매칭 시 모두 머지).
 * - 매칭된 variant 의 `styles` 는 container 자신에 적용.
 * - 매칭된 variant 의 `nested[]` 는 consumer 가 element tree 에 selector 매칭 후 주입.
 * - boolean prop 은 `"true"` / `"false"` 문자열로 비교 (spec 정의 형식과 일치).
 *
 * 머지 순서 (consumer 책임):
 *   static `containerStyles` < `resolveContainerVariants().styles` < user `style`
 *
 * @see docs/adr/108-container-runtime-derived-styles.md Decision #2 / #5
 */

import type { ComponentSpec } from "../types/spec.types";

export interface ResolvedContainerVariants {
  /** 부모 container 에 적용할 CSS 스타일 (kebab-case key, CSSGenerator 와 동일 포맷) */
  styles: Record<string, string>;

  /** 자식 element 주입용 nested rule (consumer 가 selector 매칭 후 머지) */
  nested: Array<{
    selector: string;
    styles: Record<string, string>;
  }>;
}

function emptyResult(): ResolvedContainerVariants {
  return { styles: {}, nested: [] };
}

export function resolveContainerVariants<P>(
  spec: ComponentSpec<P> | undefined | null,
  props: Readonly<Record<string, unknown>> | undefined | null,
): ResolvedContainerVariants {
  const variants = spec?.composition?.containerVariants;
  if (!variants) return emptyResult();

  const styles: Record<string, string> = {};
  const nested: ResolvedContainerVariants["nested"] = [];
  let matched = false;

  for (const [dataAttr, valueMap] of Object.entries(variants)) {
    if (!valueMap) continue;
    const propKey = dataAttrToCamelCase(dataAttr);
    const rawValue = (props ?? {})[propKey];
    if (rawValue == null) continue;
    const propValue =
      typeof rawValue === "boolean" ? String(rawValue) : String(rawValue);
    const variant = valueMap[propValue];
    if (!variant) continue;

    matched = true;
    if (variant.styles) Object.assign(styles, variant.styles);
    if (variant.nested) {
      for (const n of variant.nested) {
        if (!n?.selector) continue;
        nested.push({ selector: n.selector, styles: n.styles ?? {} });
      }
    }
  }

  if (!matched) return emptyResult();
  return { styles, nested };
}

/** `label-position` → `labelPosition` */
function dataAttrToCamelCase(s: string): string {
  return s.replace(/-([a-z])/g, (_m, ch: string) => ch.toUpperCase());
}
