import type { HTMLAttributes, ReactNode, Ref } from "react";
import { ButtonContext } from "react-aria-components/Button";
import { DEFAULT_SLOT } from "react-aria-components";
import { FocusScope } from "react-aria/FocusScope";
import { useLocale } from "react-aria-components/I18nProvider";
import { ToolbarContext } from "react-aria-components/Toolbar";
import { catalogLocalized } from "./localizedStrings";

/**
 * S2 1.8.2 `actionbar.actions` · `actionbar.clearSelection` (`@react-spectrum/s2` intl) — the
 * actions group's and the clear button's names, in the languages the Builder ships; others English.
 */
const ACTION_BAR_STRINGS: Readonly<
  Record<string, { actions: string; clearSelection: string }>
> = {
  en: { actions: "Actions", clearSelection: "Clear selection" },
  ko: { actions: "액션", clearSelection: "선택 항목 지우기" },
};

/**
 * Authored clear Button and actions stay real nodes; context supplies only behavior and the S2
 * names — the clear button's (`slot="clear"`) and the actions group's (RAC `ToolbarContext` — an
 * authored `aria-label` wins).
 */
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
  const { locale } = useLocale();
  const strings = catalogLocalized(ACTION_BAR_STRINGS, locale);
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
              clear: { onPress: clear, "aria-label": strings.clearSelection },
            },
          }}
        >
          <ToolbarContext.Provider value={{ "aria-label": strings.actions }}>
            {children}
          </ToolbarContext.Provider>
        </ButtonContext.Provider>
      </div>
    </FocusScope>
  );
}
