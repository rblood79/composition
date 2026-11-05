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
    },
  },
};
