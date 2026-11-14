/**
 * ADR-142 family ①(primitives/actions) — Toolbar leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * Toolbar 는 자식(Button/ToggleButton/Separator 등)을 담는 **컨테이너**(SHELL_ONLY). Skia 는
 * buildCatalogShapes 의 `_hasChildren` 분기로 shell 만 그리고 자식은 canonical children 트리.
 *
 * D1: RAC `Toolbar` 가 `<div role="toolbar" aria-orientation>`. orientation RAC props.
 * D2 (2026-11-14, 사용자 「S2 대응 없음 컴포넌트를 S2 패턴으로」 · 「Toolbar 묶음 prop 5개」): S2 `Toolbar.tsx` 는
 *   스타일 없는 RAC 래퍼이고 스타일 · context 를 얹은 것이 `ActionButtonGroup.tsx` 다 — Toolbar 는 그 표면
 *   (size · orientation · density · isQuiet · isJustified · staticColor · isDisabled) 을 그대로 받는다
 *   (RAC Toolbar 에 없는 5 축은 `d2Provenance.ts` 의 composition 확장). variant 없음.
 * D3: 묶음 값은 rule (`ACTION_GROUP_SIZES`), 버튼 모양은 ActionButton rule.
 */

import type { PrimitiveBinding } from "../types";
import { actionButtonBinding } from "./ActionButton.binding";

export const toolbarBinding: PrimitiveBinding = {
  // (The DOM is the shared action group — RAC `Toolbar` + the group context its ActionButtons read.)
  source: { kind: "internal", renderer: "toolbar" },
  rac: {
    primitive: "Toolbar",
    parts: ["toolbar"],
    slots: [],
    states: [],
    renderProps: ["orientation"],
    dataAttributes: ["data-orientation"],
  },
  props: {
    accepts: {
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
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
      isQuiet: actionButtonBinding.props.accepts.isQuiet,
      staticColor: actionButtonBinding.props.accepts.staticColor,
      isDisabled: actionButtonBinding.props.accepts.isDisabled,
      density: {
        kind: "enum",
        label: "Density",
        section: "appearance",
        default: "regular",
        options: [
          { value: "regular", label: "Regular" },
          { value: "compact", label: "Compact" },
        ],
      },
      isJustified: {
        kind: "boolean",
        label: "Justified",
        section: "appearance",
      },
    },
    toRacProps: "default",
  },
};
