import { createElement, forwardRef } from "react";
import { Link, LinkContext, type LinkProps } from "react-aria-components/Link";
import { useSlottedContext } from "react-aria-components";

/** RAC 1.22 filters hrefLang from its anchor props; keep it on the native render path. */
export const LinkPrimitive = forwardRef<HTMLAnchorElement, LinkProps>(
  function LinkPrimitive(props, ref) {
    const inherited = useSlottedContext(LinkContext, props.slot);
    return (
      <Link
        {...props}
        ref={ref}
        render={(domProps, state) => {
          const isAnchor =
            !!(props.href ?? inherited?.href) && !state.isDisabled;
          const attributes = isAnchor
            ? { ...domProps, hrefLang: props.hrefLang ?? inherited?.hrefLang }
            : domProps;
          return props.render
            ? props.render(attributes, state)
            : createElement(isAnchor ? "a" : "span", attributes);
        }}
      />
    );
  },
);
