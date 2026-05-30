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

export const toggleButtonGroupBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "ToggleButtonGroup",
  },
  rac: {
    primitive: "ToggleButtonGroup",
    parts: ["group"],
    slots: [],
    states: ["isDisabled"],
    renderProps: ["isDisabled", "orientation", "state"],
    dataAttributes: ["data-orientation", "data-disabled"],
  },
  props: {
    accepts: {
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      orientation: {
        kind: "enum",
        label: "Orientation",
        section: "appearance",
        default: "horizontal",
        options: [
          { value: "horizontal", label: "Horizontal" },
          { value: "vertical", label: "Vertical" },
        ],
      },
      isEmphasized: {
        kind: "boolean",
        label: "Emphasized",
        section: "appearance",
      },
      isQuiet: { kind: "boolean", label: "Quiet", section: "appearance" },
      density: {
        kind: "enum",
        label: "Density",
        section: "appearance",
        default: "regular",
        options: [
          { value: "compact", label: "Compact" },
          { value: "regular", label: "Regular" },
        ],
      },
      // RAC ToggleButtonGroup selection / state props
      selectionMode: {
        kind: "enum",
        label: "Selection Mode",
        section: "state",
        default: "single",
        options: [
          { value: "single", label: "Single" },
          { value: "multiple", label: "Multiple" },
        ],
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};
