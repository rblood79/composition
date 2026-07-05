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

/** build-time 생성 테이블 직접 노출 (테스트 / 전수 검증용). */
export function getComponentRulesTable(): ComponentRulesTable {
  return COMPONENT_RULES_TABLE;
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
