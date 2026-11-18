import type { PrimitiveBinding } from "../types";
import { buttonBinding } from "./Button.binding";

const {
  variant: _variant,
  fillStyle: _fillStyle,
  ...accepts
} = buttonBinding.props.accepts;

export const actionButtonBinding: PrimitiveBinding = {
  ...buttonBinding,
  source: { kind: "internal", renderer: "actionbutton" },
  props: {
    ...buttonBinding.props,
    accepts: {
      ...accepts,
      isQuiet: { kind: "boolean", label: "Quiet", section: "appearance" },
      // (2026-11-14, 사용자 「Type · Auto focus 숨겨」) S2 문서 예제의 조작 칸 (children · size ·
      //   staticColor · isQuiet · isDisabled · isPending) 에 없는 두 prop — 받기만 하고 패널에 내지 않는다.
      type: { ...accepts.type!, editorHidden: true },
      autoFocus: { ...accepts.autoFocus!, editorHidden: true },
    },
  },
};
