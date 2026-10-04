import {
  getShadowToken,
  normalizeShadowForTheme,
} from "@composition/rendering";
import type { ShadowTokens } from "@composition/rendering";
import {
  getComponentRulesTable,
  resolveCatalogRuleCanvasBox,
  resolveComponentRule,
} from "@composition/shared";

// ADR-912 Phase 3-A-3c (2026-06-20): builder-local catalog container 조회 map 삭제.
//   2개 소비처(resolveContainerStylesFallback containerStyles 보강 / resolveActiveContainerVariants
//   variant 어댑터)가 각각 resolveComponentRule 직접 조회 / resolveCatalogContainerVariants(catalog
//   단일 resolver, 3-A-3a 전환)로 대체되어 dead → 정의 제거. casing 역매핑은 아래
//   LOWERCASE_TO_PASCAL_RULE_KEY 가 단일 담당.

/**
 * ADR-912 Phase 3-A-3a: lowercase containerTag → catalog table PascalCase key 역매핑.
 *
 * wrapper 는 `containerEl.type.toLowerCase()`("textfield") 를 받지만 `resolveCatalogContainerBase`
 * 는 `COMPONENT_RULES_TABLE[type]` (PascalCase "TextField") 를 조회한다. casing 미스 시 `{}` 반환
 * → catalog base 영구 미도달. table 키로 1회 역인덱스 빌드.
 */
const LOWERCASE_TO_PASCAL_RULE_KEY: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const k of Object.keys(getComponentRulesTable())) {
    m.set(k.toLowerCase(), k);
  }
  return m;
})();

/** Catalog의 기본 레이아웃. 명시한 스타일은 기본값보다 우선한다. */
export function resolveContainerStylesFallback(
  type: string,
  parentStyle: Record<string, unknown>,
  sizeName?: string,
): Record<string, unknown> {
  const key = LOWERCASE_TO_PASCAL_RULE_KEY.get(type);
  return key
    ? resolveCatalogRuleCanvasBox(
        key,
        sizeName,
        (name) => parentStyle[name] !== undefined,
      )
    : {};
}

/**
 * catalog `containerStyles.overflow` 를 포괄한 effective overflow (shorthand).
 *
 * scroll/clip 소비자들(당시 fullTreeLayout GAP4 maxScroll / collectionVirtualization /
 * useScrollWheelInteraction / buildSpecNodeData·buildBoxNodeData clip·scrollbar)이 그동안 raw
 * `props.style.overflow` 만 읽어, overflow 를 catalog `containerStyles` 에만 둔 컴포넌트
 * (ListBox/Menu/Select/Tree/ComboBox 의 auto · Card/DisclosureGroup/Meter/ProgressBar/NumberField/
 * FileTrigger 의 hidden)는 Skia 에서 스크롤/클립이 동작하지 않았다(사용자 보고 2026-07-22).
 * raw 우선(사용자/factory 편집), 없으면 catalog 기본값. ref instance 는 resolved type(componentName).
 *
 * hot path(GAP4/wheel 은 요소별 호출)를 위해 raw overflow 가 있으면 catalog 조회를 skip 하고,
 * type→catalog overflow 는 메모이즈한다(catalog 는 런타임 불변).
 */
const catalogOverflowByType = new Map<string, string | undefined>();

/**
 * catalog rule 에서 **root element** 의 overflow 를 조회. root overflow 는 3 위치 중 하나에
 * 선언된다: top-level `containerStyles`(body/ListBox/Tree) · `structure.containerStyles`(Card 등)
 * · `structure.composition.containerStyles`(DisclosureGroup). staticSelectors(`.bar` 등)의
 * sub-part overflow 는 root clip 이 아니므로 제외한다(spec shapes 렌더가 별도 담당).
 */
function catalogRootOverflow(lowerType: string): string | undefined {
  const pascal = LOWERCASE_TO_PASCAL_RULE_KEY.get(lowerType);
  if (!pascal) return undefined;
  const rule = resolveComponentRule(pascal) as
    | {
        containerStyles?: Record<string, unknown>;
        structure?: {
          containerStyles?: Record<string, unknown>;
          composition?: { containerStyles?: Record<string, unknown> };
        };
      }
    | undefined;
  if (!rule) return undefined;
  return (rule.containerStyles?.overflow ??
    rule.structure?.containerStyles?.overflow ??
    rule.structure?.composition?.containerStyles?.overflow) as
    string | undefined;
}

export function resolveEffectiveOverflow(
  type: string | undefined,
  rawStyle: Record<string, unknown> | undefined,
): string | undefined {
  const style = rawStyle ?? {};
  const raw = (style.overflow ?? style.overflowY ?? style.overflowX) as
    string | undefined;
  if (raw != null) return raw;
  if (!type) return undefined;
  const key = type.toLowerCase();
  if (catalogOverflowByType.has(key)) return catalogOverflowByType.get(key);
  const ov = catalogRootOverflow(key);
  catalogOverflowByType.set(key, ov);
  return ov;
}

/**
 * catalog `containerStyles.boxShadow` 의 **미해석 원문**을 type 별로 메모이즈.
 *
 * 해석 결과가 아니라 원문을 캐시하는 것이 핵심이다 — `{shadow.md}` 는 theme 별로 다른 값으로
 * 풀리므로(ADR-166 Phase 1), 해석 결과를 캐시하면 최초 조회 시점의 theme 이 고착된다.
 */
const catalogBoxShadowByType = new Map<string, string | undefined>();

function catalogRootBoxShadow(lowerType: string): string | undefined {
  const pascal = LOWERCASE_TO_PASCAL_RULE_KEY.get(lowerType);
  if (!pascal) return undefined;
  const rule = resolveComponentRule(pascal) as
    | {
        containerStyles?: Record<string, unknown>;
        structure?: {
          containerStyles?: Record<string, unknown>;
          composition?: { containerStyles?: Record<string, unknown> };
        };
      }
    | undefined;
  if (!rule) return undefined;
  return (rule.containerStyles?.boxShadow ??
    rule.structure?.containerStyles?.boxShadow ??
    rule.structure?.composition?.containerStyles?.boxShadow) as
    string | undefined;
}

/**
 * Skia 가 소비할 box-shadow 를 해석한다 — raw `props.style.boxShadow` 우선, 없으면 catalog
 * `containerStyles.boxShadow` fallback (`resolveEffectiveOverflow` 동형).
 *
 * **Why (ADR-166 Phase 3)**: `buildSkiaEffects` 는 raw `props.style.boxShadow` 만 읽어서,
 * elevation 을 catalog 에만 둔 overlay(Popover/Tooltip/Modal)는 캔버스에서 그림자가 나오지
 * 않았다. `popover_shadow` primitive 가 Popover 를 대신 그린다고 알려져 있었으나 2026-07-25
 * 실측 결과 그 경로는 죽어 있었다(`target:"bg"` shadow 가 bg 추출 시 사본에 push 되어 버려짐)
 * — Popover 도 Tooltip/Modal 과 똑같이 캔버스 그림자가 공백이었다. 해당 primitive 는 Phase 4 에서
 * 은퇴했고, 이제 이 함수가 캔버스 그림자의 **유일한** 공급원이다.
 *
 * TokenRef(`{shadow.md}`)는 여기서 theme 별 rgba 문자열로 전개해 내보낸다 — 기존
 * `parseOneShadow` 가 그대로 통과시킬 수 있는 형태라 **파서 수정이 없다**. 반대로 `var(...)` /
 * `color-mix(...)` 는 그 파서의 색 정규식에 매칭되지 않아 숫자를 못 찾고 null 로 떨어져 그림자가
 * 사라지므로, catalog 에 그런 값이 남아 있으면 여기서도 구제되지 않는다(값 언어를 TokenRef 로
 * 수렴시킨 Phase 2 가 전제).
 *
 * **raw 도 정규화 대상 (ADR-166 후속)**: 스타일 패널은 프리셋을 고른 순간의 **리터럴**을
 * 기록하므로 raw 를 그대로 통과시키면 저장 당시 theme 이 고착된다. 알려진 elevation 프리셋
 * 리터럴이면 현재 theme 값으로 되돌린다 — 저장된 값을 건드리지 않고 읽는 쪽에서만 고치므로
 * 기존 프로젝트도 마이그레이션 없이 함께 회복된다. 프리셋이 아닌 임의 CSS 는 원문 보존.
 * DOM 축은 같은 판정을 `shadowLiteralToCssVar` 로 받아 CSS 변수를 emit 한다(대칭).
 */
export function resolveEffectiveBoxShadow(
  type: string | undefined,
  rawStyle: Record<string, unknown> | undefined,
  theme: "light" | "dark" = "light",
): string | undefined {
  const raw = (rawStyle ?? {}).boxShadow as string | undefined;
  if (raw != null) return normalizeShadowForTheme(raw, theme);
  if (!type) return undefined;
  const key = type.toLowerCase();
  let source: string | undefined;
  if (catalogBoxShadowByType.has(key)) {
    source = catalogBoxShadowByType.get(key);
  } else {
    source = catalogRootBoxShadow(key);
    catalogBoxShadowByType.set(key, source);
  }
  if (source == null) return undefined;
  return source.startsWith("{shadow.")
    ? getShadowToken(source.slice(8, -1) as keyof ShadowTokens, theme)
    : source;
}
