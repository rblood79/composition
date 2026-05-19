import type { PrimitiveBinding } from "../types";
import {
  toButtonRacProps,
  type ButtonCanonicalProps,
  type ButtonRacProps,
} from "../outputs/toRacProps";

export const buttonPrimitiveBinding: PrimitiveBinding<
  ButtonCanonicalProps,
  ButtonRacProps
> = {
  tag: "Button",
  family: "primitives/actions",
  runtime: {
    source: "react-aria-components",
    exportName: "Button",
  },
  defaultProps: {
    children: "Button",
    variant: "primary",
    fillStyle: "fill",
    size: "md",
    type: "button",
  },
  accepts: [
    "children",
    "text",
    "label",
    "variant",
    "fillStyle",
    "size",
    "type",
    "isDisabled",
    "isLoading",
    "className",
    "style",
  ],
  toRacProps: toButtonRacProps,
  skiaPrimitive: { kind: "button" },
};
