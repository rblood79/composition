import type { PrimitiveBinding } from "../types";
import { toolbarBinding } from "./Toolbar.binding";

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
    },
  },
};
