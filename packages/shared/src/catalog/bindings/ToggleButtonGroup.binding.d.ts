/**
 * ADR-142 family ①(primitives/actions) — ToggleButtonGroup leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * ToggleButtonGroup 은 자식 ToggleButton 을 담는 **컨테이너**(SHELL_ONLY). Skia 는
 * buildCatalogShapes 의 `_hasChildren` 분기로 shell(bg+border)만 그리고, 자식은 canonical
 * children 트리가 담당. children-manager(legacy ItemsManagerField 류)는 별도 PropContract 가
 * 아니라 **canonical children 트리로 흡수**(inventory §6) — accepts 에 두지 않는다.
 *
 * D1: RAC `ToggleButtonGroup` 이 `<div role="group" aria-orientation>`. orientation/selectionMode
 *     /isDisabled RAC props.
 * D2: size/orientation/selectionMode/isEmphasized/isQuiet/density 편집 surface (자식 제외).
 * D3: 시각(container 배경/테두리)은 theme/tokens data-* rules.
 */
import type { PrimitiveBinding } from "../types";
export declare const toggleButtonGroupBinding: PrimitiveBinding;
//# sourceMappingURL=ToggleButtonGroup.binding.d.ts.map