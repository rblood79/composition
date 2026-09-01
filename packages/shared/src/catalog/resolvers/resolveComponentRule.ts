/**
 * ADR-142 G2(b) B — 컴포넌트 시각 규칙 resolver.
 *
 * generic 렌더러(Skia buildCatalogShapes)의 D3 시각 source 단일 진입점. spec.variants 직접 접근을
 * 대체한다(#5/#8 — runtime spec 참조 0). build-time 생성 테이블(`generated/componentRulesTable.ts`,
 * 124 spec 투영)을 기본으로, 문서별 커스텀 규칙(`doc.componentRules`, 향후 Phase 2)이 override.
 *
 * **패키지 경계**: 본 resolver 와 생성 테이블 모두 shared 내부 → specs 직접 import 없음
 * (`specs ← shared` 의존 방향 준수). builder 가 본 resolver 로 rule 을 얻어 generic 렌더러에 주입.
 */

import type {
  ComponentRule,
  ComponentRulesTable,
  CompositionDocument,
} from "../../types/composition-document.types";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

/**
 * 컴포넌트 type → 시각 규칙. 문서 override(doc.componentRules) 우선, build-time 기본 fallback.
 * 미등록 type 은 undefined.
 */
export function resolveComponentRule(
  type: string,
  doc?: CompositionDocument | null,
): ComponentRule | undefined {
  return doc?.componentRules?.[type] ?? COMPONENT_RULES_TABLE[type];
}

/** lowercase type → PascalCase table key 역인덱스. */
const LOWERCASE_RULE_KEY: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const k of Object.keys(COMPONENT_RULES_TABLE)) m.set(k.toLowerCase(), k);
  return m;
})();

/**
 * ADR-923 r22m1 — lowercase 태그(`element.type.toLowerCase()`)도 받는 rule 조회.
 *
 * layout 은 소문자 태그로 동작하는데 테이블 키는 PascalCase 다. 소비처마다 역인덱스를 따로
 * 만들면 "catalog 에 있는데 casing 때문에 못 찾아 자기 리터럴을 쓰는" 자리가 생긴다 — 실제로
 * layout 의 `DEFAULT_SIZE_BY_TAG` 는 catalog `defaultSize` 와 별개 표였고 Badge(catalog sm ·
 * layout md) / Select(catalog md · layout sm) 두 타입에서 값이 갈렸다.
 */
export function resolveComponentRuleByTag(
  typeOrTag: string,
  doc?: CompositionDocument | null,
): ComponentRule | undefined {
  const direct = resolveComponentRule(typeOrTag, doc);
  if (direct !== undefined) return direct;
  const key = LOWERCASE_RULE_KEY.get(typeOrTag.toLowerCase());
  return key === undefined ? undefined : resolveComponentRule(key, doc);
}

/** build-time 생성 테이블 직접 노출 (테스트 / 전수 검증용). */
export function getComponentRulesTable(): ComponentRulesTable {
  return COMPONENT_RULES_TABLE;
}

/**
 * `.button-base` utility 대상 여부 — DOM `button-base` 클래스 부여(preview generic 경로 +
 * shared 컴포넌트)와 Skia 자식(Text/Icon/Label) color 상속 게이트가 공유하는 단일 membership.
 *
 * 파생 규칙: `structure.cssEmitMode === "button-base"` (Button/ToggleButton — CSS emit 도
 * utility color-mix 파생) 또는 `structure.buttonBase` (ToggleButtonGroup — emit 은 direct,
 * utility 착용만). 구 3벌 손 미러(preview `BUTTON_BASE_TYPES` / Skia
 * `BUTTON_BASE_PARENT_TAGS` — "신규 추가 시 동시 갱신" 주석 의존)를 대체한다 (2026-08-14).
 * 신규 button-base 컴포넌트는 테이블 선언 1곳으로 세 소비자에 동시 반영된다.
 */
export function usesButtonBaseUtility(type: string): boolean {
  const structure = COMPONENT_RULES_TABLE[type]?.structure;
  return (
    structure?.cssEmitMode === "button-base" || structure?.buttonBase === true
  );
}

/**
 * ADR-916 P2-CAT ① (조항 4) — doc override 를 소비하지 않는 theme rule base 진입점.
 *
 * catalog 정적 참조 계약(`buildCatalogStaticSnapshot` + 조상 체인 propagation 소비자)은
 * theme rule base **만** 읽어야 한다. `resolveComponentRule(type, doc?)` 은 런타임
 * `doc.componentRules` override 를 병합하므로 정적 스냅샷 source 로 부적합 —
 * doc override 는 Phase 2 선결 Gate(non-empty 감지 → 스냅샷 재빌드+재주입, H3)로
 * 별도 관리한다. 본 함수는 **doc 파라미터가 없어** override 유입이 compile error 다
 * (grep gate 로의 강등 대신 타입 분리로 구조적 봉합).
 */
export function resolveStaticComponentRule(
  type: string,
): ComponentRule | undefined {
  return COMPONENT_RULES_TABLE[type];
}
