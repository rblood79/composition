import type { PrimitiveBinding } from "../types";
import { toolbarBinding } from "./Toolbar.binding";
import { actionButtonBinding } from "./ActionButton.binding";

export const actionButtonGroupBinding: PrimitiveBinding = {
  ...toolbarBinding,
  source: { kind: "internal", renderer: "actionbuttongroup" },
  props: {
    ...toolbarBinding.props,
    accepts: {
      ...toolbarBinding.props.accepts,
      "aria-label": {
        kind: "string",
        label: "Aria Label",
        section: "content",
        editorHidden: true,
        default: "Actions",
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
  },
};
