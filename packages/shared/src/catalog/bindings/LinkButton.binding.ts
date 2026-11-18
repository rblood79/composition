import type { PrimitiveBinding } from "../types";
import { BUTTON_FORM_FOCUS_ACCEPTS, buttonBinding } from "./Button.binding";
import { linkBinding } from "./Link.binding";

const {
  type: _type,
  isPending: _isPending,
  ...buttonAccepts
} = buttonBinding.props.accepts;
const buttonProps = Object.fromEntries(
  Object.entries(buttonAccepts).filter(
    ([key]) => !(key in BUTTON_FORM_FOCUS_ACCEPTS),
  ),
);
const {
  children: _children,
  isQuiet: _isQuiet,
  isStandalone: _isStandalone,
  ...linkProps
} = linkBinding.props.accepts;

/** S2 LinkButton: RAC navigation with the shared Button visual contract. */
export const linkButtonBinding: PrimitiveBinding = {
  ...linkBinding,
  source: { kind: "internal", renderer: "linkbutton" },
  props: {
    ...linkBinding.props,
    accepts: {
      ...linkProps,
      ...buttonProps,
      href: linkBinding.props.accepts.href,
      target: linkBinding.props.accepts.target,
      rel: linkBinding.props.accepts.rel,
    },
  },
};
