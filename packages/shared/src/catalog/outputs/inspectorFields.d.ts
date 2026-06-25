/**
 * ADR-142 — generic Inspector field renderer (M1 #8).
 *
 * 선택 노드의 `PropContract` 집합(primitive 의 `accepts` 또는 reusable 의 `propsSchema`)을
 * theme 와 결합해 Inspector 편집 필드를 **generic** 하게 생성한다. 컴포넌트당
 * `spec.properties.sections` / `SpecField` 분기를 대체 — "스타일 패널이 모든 컴포넌트에
 * 균일 적용" 의 실제 메커니즘.
 *
 * - `section` 태그로 그룹핑 (first-appearance 순서 보존 — `PropContract` 삽입 순서).
 * - `kind:"variant"|"size"` → `options` 는 theme 가 제공 (현 spec.variants/sizes keys,
 *   목표 theme data-* rules). `kind:"enum"` → `contract.options` 그대로.
 * - `kind:"binding"` 등 비-옵션 kind → `options` 없음.
 *
 * 설계: docs/adr/design/142-starter-spec-component-system-cutover-breakdown.md §3
 */
import type { InspectorFieldKind, ItemsManagerSchema, PropContract, VisibilityCondition } from "../types";
export interface InspectorFieldOption {
    value: string;
    label: string;
}
export interface InspectorField {
    key: string;
    kind: InspectorFieldKind;
    label: string;
    default?: unknown;
    options?: InspectorFieldOption[];
    min?: number;
    max?: number;
    step?: number;
    /** `kind:"items-manager"` 전용 — 정적 items 배열 편집 schema (PropContract 에서 그대로 전달). */
    itemsManager?: ItemsManagerSchema;
    visibleWhen?: VisibilityCondition;
}
export interface InspectorFieldGroup {
    section: string;
    fields: InspectorField[];
}
/** 시각 차원(variant/size) 의 선택 가능 값 조회 — theme/tokens(또는 전환기 spec keys) 어댑터. */
export interface InspectorFieldTheme {
    resolveDimensionOptions(componentType: string, propKey: string, kind: "variant" | "size"): InspectorFieldOption[];
}
export declare function buildInspectorFields(componentType: string, contracts: Record<string, PropContract>, theme: InspectorFieldTheme): InspectorFieldGroup[];
//# sourceMappingURL=inspectorFields.d.ts.map