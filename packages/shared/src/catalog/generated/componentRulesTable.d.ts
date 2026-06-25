/**
 * SSOT (직접 편집 정본) — theme rule base D3 시각 SSOT (ADR-912 ②-6-A).
 *
 * **위상 전환 (ADR-912 1A-(a), 2026-06-03)**: 본 테이블은 더 이상 build-time 자동 생성물이 아니다.
 * `generate-rules.ts`(spec→table) 가 1회 생성한 결과를 **freeze 하여 직접 편집 정본으로 승격**했다
 * (build chain `pnpm generate:rules` step 제거됨 — `packages/specs/package.json`). 이후 컴포넌트 시각
 * 규칙(variants/sizes/fill) 변경은 **본 파일을 직접 편집**한다. 생성기 `generate-rules.ts` +
 * `generate:rules` script 는 ADR-912 단계 5 step 3 에서 물리 삭제됨(본 테이블이 독립 정본). 입력이던
 * 124 spec 은 단계 5 step 4 에서 삭제 예정.
 *
 * **소비자**: DOM(generated CSS — `generate-css` 가 본 테이블의 variant 색상 주입) / Skia(runtime
 * `resolveComponentRule`) / Properties·Style Panel — 모두 본 테이블 단일 source 파생(DOM/Skia 시각 대칭).
 * TokenRef(`{color.X}`)는 string 그대로 — runtime resolveCanonicalToken/resolveToken 이 변환.
 */
import type { ComponentRulesTable } from "../../types/composition-document.types";
export declare const COMPONENT_RULES_TABLE: ComponentRulesTable;
//# sourceMappingURL=componentRulesTable.d.ts.map