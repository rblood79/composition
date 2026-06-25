import type { PrimitiveBinding } from "../types";
/**
 * SelectTrigger — field-trigger 계열(Select/ComboBox/NumberField/SearchField)의 공용
 * trigger 컨테이너 sub-part (box, flex row).
 *
 * **ADR-912 R1 (Select family rebuild, 2026-06-12)**: 기존 ComboBoxWrapper/SearchFieldWrapper
 *   synthetic alias 를 factory retype 으로 본 type 에 합류시키고 BUILDER_ALIAS_MAP 을 해체.
 *   field-trigger 컨테이너 시각(bg layer-2 / border / radius / size 별 height·padding)은
 *   rule(COMPONENT_RULES_TABLE.SelectTrigger) + buildCatalogShapes generic box 가 단일 source.
 *
 * **DOM 부모 흡수 (독립 노드 0)**: Select/ComboBox/NumberField/SearchField 의 renderer 가
 *   RAC controller(`<Button>`/`<Group>`)를 self-compose — SelectTrigger 자식은 DOM 독립
 *   렌더 안 됨(자식 props 는 placeholder/label data 로만 소비). renderer="selecttrigger" 는
 *   INTERNAL_RENDERERS 미등록 → cutover generic skip (MeterValue 동형 비대칭).
 *
 * D1: composition — DOM 은 부모 RAC self-compose. RAC D1/ARIA 권위 보존.
 * D2: size 편집 surface (부모 size propagation 이 주 경로).
 * D3: 시각은 rule — variants(default/accent/negative border) + sizes(height/padding/radius).
 *     layout(display flex/row/gap)은 factory props.style SSOT (ADR-907 Layer B).
 */
export declare const selectTriggerBinding: PrimitiveBinding;
//# sourceMappingURL=SelectTrigger.binding.d.ts.map