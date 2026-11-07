import {
  Children,
  createContext,
  isValidElement,
  useContext,
  type ElementType,
  type ReactNode,
} from "react";
import {
  ListBox,
  ListBoxItem,
  type ListBoxProps,
  type ListBoxItemProps,
} from "react-aria-components/ListBox";
import { ListBoxContext, useSlottedContext } from "react-aria-components";
import { selectBoxChildrenText } from "../catalog/runtime/selectBoxText";
import { SelectBoxSelectionContext } from "./SelectBoxSelectionContext";
import { selectionCompositesDefaultChildren } from "./selectionCompositesDefaults";
import { selectBoxVisibleChildren } from "./selectBoxVisibleChildren";
import { Checkbox, CheckboxIndicatorBox } from "./Checkbox";
import { Icon } from "./Icon";
import { Text } from "react-aria-components/Text";

function SelectionIndicator() {
  const state = useContext(SelectBoxSelectionContext);
  return (
    <CheckboxIndicatorBox
      isSelected={state?.isSelected === true}
      isIndeterminate={false}
    />
  );
}
const defaultSlots: Readonly<Record<string, ElementType>> = {
  frame: "div",
  Text,
  Icon,
  SelectBox,
  Checkbox,
  CheckboxButton: "div",
  CheckboxIndicator: SelectionIndicator,
  Label: Text,
  description: Text,
  fielderror: Text,
};

const SelectBoxGroupContext = createContext({
  orientation: "vertical" as "vertical" | "horizontal",
  isDisabled: false,
});
export interface SelectBoxGroupProps<T> extends Omit<
  ListBoxProps<T>,
  "orientation" | "selectionMode" | "children"
> {
  orientation?: "vertical" | "horizontal";
  selectionMode?: "single" | "multiple";
  isDisabled?: boolean;
  children?: ReactNode;
}
export function SelectBoxGroup<T extends object>({
  orientation = "vertical",
  selectionMode: ownSelectionMode,
  isDisabled = false,
  className,
  children,
  ...props
}: SelectBoxGroupProps<T>) {
  const slotProps = useSlottedContext(ListBoxContext, props.slot);
  const selectionMode =
    ownSelectionMode ?? slotProps?.selectionMode ?? "single";
  const content =
    children ??
    selectionCompositesDefaultChildren("SelectBoxGroup", defaultSlots);
  const authoredSelected = Children.toArray(content).flatMap((child) =>
    isValidElement<{ id?: string; isSelected?: boolean }>(child) &&
    child.props.isSelected &&
    child.props.id
      ? [child.props.id]
      : [],
  );
  return (
    <SelectBoxGroupContext.Provider value={{ orientation, isDisabled }}>
      <ListBox
        {...props}
        aria-label={
          props["aria-label"] ??
          slotProps?.["aria-label"] ??
          ((props["aria-labelledby"] ?? slotProps?.["aria-labelledby"])
            ? undefined
            : "Options")
        }
        defaultSelectedKeys={
          (props.selectedKeys ?? slotProps?.selectedKeys) === undefined
            ? (props.defaultSelectedKeys ??
              slotProps?.defaultSelectedKeys ??
              authoredSelected)
            : undefined
        }
        layout="grid"
        orientation={orientation}
        selectionMode={selectionMode}
        className={`react-aria-SelectBoxGroup ${typeof className === "string" ? className : ""}`}
        data-size="M"
        data-selection-mode={selectionMode}
      >
        {content}
      </ListBox>
    </SelectBoxGroupContext.Provider>
  );
}
export interface SelectBoxProps extends ListBoxItemProps<object> {
  isSelected?: boolean;
  label?: string;
  description?: string;
  icon?: string;
}
export function SelectBox({
  children,
  isDisabled,
  className,
  textValue,
  isSelected: _authoredSelected,
  label = "Option",
  description = "Description",
  icon = "image",
  ...props
}: SelectBoxProps) {
  const group = useContext(SelectBoxGroupContext);
  const content =
    children ??
    selectionCompositesDefaultChildren("SelectBox", defaultSlots, {
      label,
      description,
      icon,
    });
  return (
    <ListBoxItem
      {...props}
      textValue={
        textValue ??
        selectBoxChildrenText(
          typeof content === "function" ? undefined : content,
        )
      }
      isDisabled={isDisabled || group.isDisabled}
      className={`react-aria-SelectBox ${typeof className === "string" ? className : ""}`}
      data-orientation={group.orientation}
      data-size="M"
      data-variant="default"
    >
      {(state) => (
        <SelectBoxSelectionContext.Provider
          value={{ isSelected: state.isSelected, isDisabled: state.isDisabled }}
        >
          {selectBoxVisibleChildren(
            typeof content === "function" ? content(state) : content,
            group.orientation,
          )}
        </SelectBoxSelectionContext.Provider>
      )}
    </ListBoxItem>
  );
}
