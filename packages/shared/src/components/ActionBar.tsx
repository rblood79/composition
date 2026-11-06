import type { HTMLAttributes, ReactNode } from "react";
import { CatalogActionBar } from "../catalog/runtime/selectionComposites.components";
import { selectionCompositesDefaultChildren } from "./selectionCompositesDefaults";
import { catalogSelectionCountText } from "../catalog/document/selectionCountValue";
import { useLocale } from "react-aria-components/I18nProvider";
import { Text } from "react-aria-components/Text";
import { ActionButton } from "./ActionButton";
import { ActionButtonGroup } from "./ActionButtonGroup";
import { Icon } from "./Icon";
import { actionBarChildren } from "./actionBarChildren";

export interface ActionBarProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> {
  selectedItemCount?: number | "all";
  isEmphasized?: boolean;
  onClearSelection?: () => void;
  children?: ReactNode;
}
/** Code View's public counterpart uses the same authored children and clear-slot behavior. */
export function ActionBar({
  selectedItemCount = 0,
  isEmphasized,
  onClearSelection,
  children,
  className,
  ...props
}: ActionBarProps) {
  const { locale } = useLocale();
  if (selectedItemCount === 0) return null;
  return (
    <CatalogActionBar
      {...props}
      clear={() => onClearSelection?.()}
      className={`react-aria-ActionBar ${className ?? ""}`}
      data-emphasized={isEmphasized || undefined}
      data-size="M"
      data-variant="default"
    >
      {actionBarChildren(
        children ??
          selectionCompositesDefaultChildren(
            "ActionBar",
            { frame: "div", Text, Icon, ActionButton, ActionButtonGroup },
            {
              selectedCountText: catalogSelectionCountText(
                selectedItemCount,
                locale,
              ),
            },
          ),
        isEmphasized === true,
      )}
    </CatalogActionBar>
  );
}
