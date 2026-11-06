import {
  createContext,
  forwardRef,
  useContext,
  useLayoutEffect,
  useRef,
} from "react";
import {
  ToggleButton,
  type ToggleButtonProps,
} from "react-aria-components/ToggleButton";
import {
  ToggleButtonGroup,
  ToggleGroupStateContext,
  type ToggleButtonGroupProps,
} from "react-aria-components/ToggleButtonGroup";
import type { Key } from "react-aria-components";
import { SelectionIndicator } from "react-aria-components/SelectionIndicator";
import { Text } from "react-aria-components/Text";
import { rangeSegmentsDefaultChildren } from "./rangeSegmentsDefaults";
import { Icon, type IconComponentProps } from "./Icon";

const SegmentIcon = (props: IconComponentProps) => (
  <Icon
    {...props}
    elementType="span"
    style={{ fontSize: "var(--icon-size)", ...props.style }}
  />
);

export interface SegmentedControlProps extends Omit<
  ToggleButtonGroupProps,
  | "selectedKeys"
  | "defaultSelectedKeys"
  | "onSelectionChange"
  | "orientation"
  | "selectionMode"
  | "disallowEmptySelection"
> {
  selectedKey?: Key | null;
  defaultSelectedKey?: Key;
  onSelectionChange?: (key: Key) => void;
  isJustified?: boolean;
}

const AutoSelect = createContext<{ current: boolean } | null>(null);

/** S2's single-key contract over RAC's horizontal single-selection toggle group. */
export const SegmentedControl = forwardRef<
  HTMLDivElement,
  SegmentedControlProps
>(function SegmentedControl(
  { selectedKey, defaultSelectedKey, onSelectionChange, isJustified, ...props },
  ref,
) {
  const registered = useRef(selectedKey != null || defaultSelectedKey != null);
  return (
    <AutoSelect.Provider value={registered}>
      <ToggleButtonGroup
        {...props}
        ref={ref}
        orientation="horizontal"
        selectionMode="single"
        disallowEmptySelection
        className={props.className ?? "react-aria-SegmentedControl"}
        data-justified={isJustified || undefined}
        aria-label={props["aria-label"] ?? "View"}
        selectedKeys={selectedKey != null ? [selectedKey] : undefined}
        defaultSelectedKeys={
          defaultSelectedKey != null ? [defaultSelectedKey] : undefined
        }
        onSelectionChange={(keys) => {
          const first = keys.values().next().value;
          if (first != null) onSelectionChange?.(first);
        }}
      >
        {props.children ??
          rangeSegmentsDefaultChildren("SegmentedControl", {
            SegmentedControlItem,
            SelectionIndicator,
            Text,
            Icon: SegmentIcon,
          })}
      </ToggleButtonGroup>
    </AutoSelect.Provider>
  );
});
export interface SegmentedControlItemProps extends ToggleButtonProps {
  label?: string;
  icon?: string;
}
export const SegmentedControlItem = forwardRef<
  HTMLButtonElement,
  SegmentedControlItemProps
>(function SegmentedControlItem({ label, icon, ...props }, ref) {
  const registered = useContext(AutoSelect);
  const state = useContext(ToggleGroupStateContext);
  useLayoutEffect(() => {
    if (
      registered &&
      !registered.current &&
      !props.isDisabled &&
      props.id != null &&
      state
    ) {
      registered.current = true;
      state.toggleKey(props.id);
    }
  }, [registered, state, props.id, props.isDisabled]);
  return (
    <ToggleButton
      {...props}
      ref={ref}
      className={props.className ?? "react-aria-SegmentedControlItem"}
    >
      {props.children ??
        rangeSegmentsDefaultChildren(
          "SegmentedControlItem",
          { Text, Icon: SegmentIcon, SelectionIndicator },
          {
            ...(label === undefined ? {} : { label }),
            ...(icon === undefined ? {} : { icon }),
          },
        )}
    </ToggleButton>
  );
});
