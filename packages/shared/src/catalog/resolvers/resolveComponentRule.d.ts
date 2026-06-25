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
import type { ComponentRule, ComponentRulesTable, CompositionDocument } from "../../types/composition-document.types";
/**
 * 컴포넌트 type → 시각 규칙. 문서 override(doc.componentRules) 우선, build-time 기본 fallback.
 * 미등록 type 은 undefined.
 */
export declare function resolveComponentRule(type: string, doc?: CompositionDocument | null): ComponentRule | undefined;
/** build-time 생성 테이블 직접 노출 (테스트 / 전수 검증용). */
export declare function getComponentRulesTable(): ComponentRulesTable;
//# sourceMappingURL=resolveComponentRule.d.ts.map