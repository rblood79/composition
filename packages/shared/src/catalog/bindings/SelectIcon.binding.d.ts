import type { PrimitiveBinding } from "../types";
/**
 * SelectIcon — field-trigger 계열의 아이콘 sub-part (chevron/stepper/search/clear glyph).
 *
 * **ADR-912 R1 (Select family rebuild, 2026-06-12)**: 기존 ComboBoxTrigger/SearchIcon/
 *   SearchClearButton synthetic alias 를 factory retype 으로 본 type 에 합류. Lucide glyph 는
 *   box+text 가 아닌 비-DOM-trivial primitive → Skia 는 `skiaPrimitive: "icon_font"` draw
 *   module(Icon.binding 동형, replace 모드)이 단일 shape 로 그림. 크기는 rule sizes.iconSize,
 *   색은 rule colors.text({color.neutral-subdued}).
 *
 * **DOM 부모 흡수**: 부모 renderer 가 RAC chevron/stepper 버튼 self-compose — 자식은
 *   iconName data 로만 소비. renderer="selecticon" 은 INTERNAL_RENDERERS 미등록 →
 *   cutover generic skip.
 *
 * D1: composition — DOM 은 부모 RAC self-compose.
 * D2: iconName + size 편집 surface (부모/조부모 iconName 위임은 buildSpecNodeData
 *     resolveIconDelegation 유지).
 * D3: 시각은 rule sizes.iconSize + colors.text — icon_font glyph 단일.
 */
export declare const selectIconBinding: PrimitiveBinding;
//# sourceMappingURL=SelectIcon.binding.d.ts.map