/**
 * ADR-912 catalog SSOT collapse — 컨테이너 base/variant/structure/size-value 단일 진입 resolver.
 *
 * breakdown(`docs/adr/design/912-catalog-ssot-collapse-breakdown.md`) §2-2. CSS generator /
 * Skia·layout(`implicitStyles`) / Style Panel(`specPresetResolver`) 세 consumer 가 컴포넌트
 * 구조·base-layout·size-value 를 `componentRulesTable` 한 entry 에서만 파생하게 하는 단일 진입점.
 *
 * **패키지 경계 (Δ7 — 의존 방향)**: 본 파일은 layout token table 을 `@composition/specs` 의
 * `LAYOUT_TOKEN_STYLES` 단일 source 에서 import 한다 — `shared → specs` **정상 방향**(shared
 * package.json 이 specs 를 workspace 의존으로 선언, specs→shared 역의존은 0). layout token 은
 * CSS vocabulary(D3 시각 어휘)라 framework-free 하위 레이어 specs 에 살고, generator(specs)·
 * Skia/Panel(이 resolver 경유)이 같은 source 를 읽는다. 과거 shared-local 복사본
 * `CATALOG_LAYOUT_STYLES` 는 본 import 로 단일화됨(§5 kill criteria — token table 이 둘로
 * 갈라진 채 유지되지 않게).
 *
 * resolver 는 CSS-style raw data(kebab-case key) 를 반환하고, camelCase 변환은 Builder/Panel 쪽
 * 기존 normalization helper 가 담당한다(breakdown §2-2 — 변환 책임을 resolver 에 넣지 않음).
 */

import { LAYOUT_TOKEN_STYLES } from "@composition/specs";
import type {
  ComponentRule,
  ComponentRuleComposition,
  ComponentRuleContainerVariantStyles,
  ComponentRuleSize,
  ComponentRuleStructure,
  CompositionDocument,
} from "../../types/composition-document.types";
import { resolveComponentRule } from "./resolveComponentRule";

/**
 * 단일 layout token table (Δ7) — specs `LAYOUT_TOKEN_STYLES` 를 re-export 한다. 기존 소비처
 * (`CATALOG_LAYOUT_STYLES` import) 호환을 위해 alias 로 유지. 정본은 specs `layoutTokens.ts`.
 */
export const CATALOG_LAYOUT_STYLES = LAYOUT_TOKEN_STYLES;

/** 매칭된 container variant 의 적용 styles + 자식 주입용 nested rule (specs 버전 출력 shape 동일). */
export interface ResolvedCatalogContainerVariants {
  /** container 자신에 적용할 style (kebab-case key). */
  styles: Record<string, string>;
  /** 자식 element 주입용 nested rule (consumer 가 selector 매칭 후 머지). */
  nested: Array<{ selector: string; styles: Record<string, string> }>;
}

/** camelCase prop key → kebab-case data-attr key (`labelPosition` → `label-position`). */
function camelToKebab(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/** boolean / enum prop 값을 containerVariants attr value 키로 정규화. */
function attrValueKey(value: unknown): string {
  if (value === true) return "true";
  if (value === false) return "false";
  return String(value);
}

/** 컴포넌트 type → `rule.structure` (없으면 undefined). */
export function resolveCatalogStructure(
  type: string,
  doc?: CompositionDocument | null,
): ComponentRuleStructure | undefined {
  return resolveComponentRule(type, doc)?.structure;
}

/**
 * 컴포넌트 base container style (Δ2 merge precedence — 단일 거처).
 *
 * 우선순위 (last-wins):
 *   1. `structure.layout → CATALOG_LAYOUT_STYLES[layout]` (base, 최저)
 *   2. `structure.composition.containerStyles` (layout 파생)
 *   3. top-level `rule.containerStyles` (컴포넌트별 override, 최고)
 *
 * 이 precedence 를 본 함수 안에 inline 으로 못박아 generator / Skia / Panel 이 갈라지지 않게 한다.
 * `containerVariants` 는 top-level 에만 두고 여기서 합성하지 않는다(props 매칭은 별도 resolver).
 */
export function resolveCatalogContainerBase(
  type: string,
  doc?: CompositionDocument | null,
): Record<string, string | number> {
  const rule = resolveComponentRule(type, doc);
  if (!rule) return {};

  const merged: Record<string, string | number> = {};
  const composition: ComponentRuleComposition | undefined =
    rule.structure?.composition;

  // 1. layout token base (STRUCTURE_META 동형 — layout 은 composition 안에 있음, Phase 2)
  const layout = composition?.layout;
  if (layout && CATALOG_LAYOUT_STYLES[layout]) {
    Object.assign(merged, CATALOG_LAYOUT_STYLES[layout]);
  }

  // 2-a. structure.containerStyles (top-level — STRUCTURE_META entry 의 top-level containerStyles)
  if (rule.structure?.containerStyles) {
    Object.assign(merged, rule.structure.containerStyles);
  }

  // 2-b. structure.composition.containerStyles (layout 파생)
  if (composition?.containerStyles) {
    Object.assign(merged, composition.containerStyles);
  }
  // composition.gap 은 root flex gap — gap 키로 흡수(이미 containerStyles 에 gap 있으면 미덮음).
  if (composition?.gap != null && merged.gap == null) {
    merged.gap = composition.gap;
  }

  // 3. top-level rule.containerStyles (override, last-wins)
  if (rule.containerStyles) {
    Object.assign(merged, rule.containerStyles);
  }

  return merged;
}

/**
 * props 에 매칭되는 container variant 합성 (Δ3 — plain-data 재작성, specs `resolveContainerVariants`
 * 의 spec 결합 버전과 별개). 출력 shape 는 `ResolvedCatalogContainerVariants`.
 *
 * `rule.containerVariants[dataAttr][attrValue]` 를 props 의 camelCase key 로 매칭한다.
 *   - `dataAttr`: kebab-case (예: `label-position`) ← props key 는 camelCase (`labelPosition`)
 *   - `attrValue`: boolean → `"true"`/`"false"`, enum → 값 그대로
 *
 * **variant 위치 (ADR-912 Phase 4)**: TagGroup/CheckboxGroup/TextField/ComboBox/DatePicker 류는
 * variant 를 top-level `rule.containerVariants` 에 보유하지만, Select/Form/Toolbar/Meter/ProgressBar
 * 류는 `structure.composition.containerVariants`(NESTED)에만 보유한다(STRUCTURE_META 흡수 시 위치
 * 비대칭으로 land). top-level 부재 시 nested 를 fallback 으로 읽어 두 위치의 variant 가 모두 Style
 * Panel / Skia-layout(implicitStyles) 양 consumer 에 반영되게 한다. nested 의 타입은 composition
 * index signature(`[key: string]: unknown`)라 top-level 과 동일 런타임 구조로 cast (구조 동형 검증됨).
 */
export function resolveCatalogContainerVariants(
  type: string,
  props: Record<string, unknown>,
  doc?: CompositionDocument | null,
): ResolvedCatalogContainerVariants {
  const rule = resolveComponentRule(type, doc);
  const variants =
    rule?.containerVariants ??
    (rule?.structure?.composition?.containerVariants as
      | Record<string, Record<string, ComponentRuleContainerVariantStyles>>
      | undefined);
  if (!variants) return { styles: {}, nested: [] };

  const styles: Record<string, string> = {};
  const nested: ResolvedCatalogContainerVariants["nested"] = [];

  for (const [dataAttr, valueMap] of Object.entries(variants)) {
    // props 에서 dataAttr 에 대응하는 camelCase key 를 찾는다.
    const propEntry = Object.entries(props).find(
      ([propKey]) => camelToKebab(propKey) === dataAttr,
    );
    if (!propEntry) continue;
    const [, propValue] = propEntry;
    if (propValue == null) continue;

    const variant = valueMap[attrValueKey(propValue)];
    if (!variant) continue;

    if (variant.styles) Object.assign(styles, variant.styles);
    if (variant.nested) {
      for (const n of variant.nested) {
        nested.push({ selector: n.selector, styles: n.styles ?? {} });
      }
    }
  }

  return { styles, nested };
}

/**
 * size-value 단일 진입 (Δ4 — implicitStyles 하드코딩 mirror 대체).
 * `componentRulesTable.{type}.sizes.{size}.{field}` 를 직접 읽는다. ProgressBarTrack/MeterTrack
 * `height`, Checkbox/Radio `gap` 등이 대상. 미등록 type/size/field → undefined.
 */
export function resolveCatalogSizeField(
  type: string,
  size: string,
  field: keyof ComponentRuleSize,
  doc?: CompositionDocument | null,
): ComponentRuleSize[keyof ComponentRuleSize] | undefined {
  const rule: ComponentRule | undefined = resolveComponentRule(type, doc);
  return rule?.sizes?.[size]?.[field];
}
