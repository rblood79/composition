import { forwardRef } from "react";
import type { LinkProps } from "react-aria-components/Link";
import { LinkPrimitive as Link } from "./LinkPrimitive";

export interface LinkButtonProps extends LinkProps {
  variant?: "primary" | "secondary" | "negative" | "genai" | "premium";
  size?: "S" | "M" | "L" | "XL";
  fillStyle?: "fill" | "outline";
  staticColor?: "auto" | "black" | "white";
}

/** Navigation remains RAC's; the catalog Button rule owns every visual value. */
export const LinkButton = forwardRef<HTMLAnchorElement, LinkButtonProps>(
  function LinkButton(
    {
      variant = "primary",
      size = "M",
      fillStyle = "fill",
      staticColor,
      className,
      ...props
    },
    ref,
  ) {
    return (
      <Link
        {...props}
        ref={ref}
        data-size={size}
        data-variant={variant}
        data-fill-style={fillStyle}
        data-static-color={staticColor}
        className={(state) =>
          `react-aria-LinkButton button-base ${typeof className === "function" ? className(state) : (className ?? "")}`
        }
      />
    );
  },
);
