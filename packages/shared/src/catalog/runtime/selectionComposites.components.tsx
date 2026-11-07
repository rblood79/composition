import type { HTMLAttributes, ReactNode, Ref } from "react";
import { ButtonContext } from "react-aria-components/Button";
import { DEFAULT_SLOT } from "react-aria-components";
import { FocusScope } from "react-aria/FocusScope";

/** Authored clear Button and actions stay real nodes; context supplies only behavior. */
export function CatalogActionBar({
  children,
  clear,
  ref,
  onKeyDown,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  "data-size"?: string;
  "data-variant"?: string;
  "data-emphasized"?: boolean;
  children?: ReactNode;
  clear: () => void;
  ref?: Ref<HTMLDivElement>;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <FocusScope restoreFocus>
      <div
        {...props}
        ref={ref}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (!event.defaultPrevented && event.key === "Escape") {
            event.stopPropagation();
            clear();
          }
        }}
      >
        <ButtonContext.Provider
          value={{
            slots: {
              [DEFAULT_SLOT]: {},
              clear: { onPress: clear, "aria-label": "Clear selection" },
            },
          }}
        >
          {children}
        </ButtonContext.Provider>
      </div>
    </FocusScope>
  );
}
