/**
 * ADR-142 family ①(primitives/actions) — ToggleButton leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * ToggleButton 은 Button 류 box+text leaf 에 selection 축(isSelected/isEmphasized)이 더해진다.
 * Skia 는 buildCatalogShapes 가 selected 축(fill.default.selected/emphasizedSelected 데이터)
 * 으로 재현. icon 합성은 reusable(아이콘 ToggleButton).
 *
 * D1: RAC `ToggleButton` 이 `<button aria-pressed>` 를 emit. isSelected/isDisabled RAC props.
 * D2: size/isSelected/isEmphasized/isQuiet/children 편집 surface.
 * D3: 시각(selected 배경/텍스트)은 theme/tokens data-* (data-selected/data-emphasized) rules.
 */
import type { PrimitiveBinding } from "../types";
export declare const toggleButtonBinding: PrimitiveBinding;
//# sourceMappingURL=ToggleButton.binding.d.ts.map