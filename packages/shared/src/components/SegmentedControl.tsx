import {
  createContext,
  forwardRef,
  useContext,
  useLayoutEffect,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { useObjectRef } from "react-aria/useObjectRef";
import { registerCatalogPressScale } from "../catalog/runtime/pressScale.runtime";
import {
  ToggleButton,
  type ToggleButtonProps,
} from "react-aria-components/ToggleButton";
import {
  ToggleButtonGroup,
  ToggleButtonGroupContext,
  ToggleGroupStateContext,
  type ToggleButtonGroupProps,
} from "react-aria-components/ToggleButtonGroup";
import type { Key } from "react-aria-components";
import { useSlottedContext } from "react-aria-components";
import { composeRenderProps } from "react-aria-components/composeRenderProps";
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
  | "selectionMode"
  | "disallowEmptySelection"
> {
  selectedKey?: Key | null;
  defaultSelectedKey?: Key;
  onSelectionChange?: (key: Key) => void;
  isJustified?: boolean;
}

const AutoSelect = createContext<{ current: boolean } | null>(null);

function DefaultSelection({ children }: { children: ReactNode }) {
  const state = useContext(ToggleGroupStateContext);
  // RAC has already resolved own and slotted controlled/default selection here.
  const registered = useRef((state?.selectedKeys.size ?? 0) > 0);
  return (
    <AutoSelect.Provider value={registered}>{children}</AutoSelect.Provider>
  );
}

/** S2's single-key contract over RAC's single-selection toggle group. */
export const SegmentedControl = forwardRef<
  HTMLDivElement,
  SegmentedControlProps
>(function SegmentedControl(
  {
    selectedKey,
    defaultSelectedKey,
    onSelectionChange,
    isJustified,
    orientation: ownOrientation,
    ...props
  },
  ref,
) {
  const slotProps = useSlottedContext(ToggleButtonGroupContext, props.slot);
  const orientation = ownOrientation ?? slotProps?.orientation ?? "horizontal";
  const domRef = useObjectRef(ref);
  useEffect(() => {
    const doc = domRef.current?.ownerDocument;
    return doc ? registerCatalogPressScale(doc) : undefined;
  }, [domRef]);
  return (
    <ToggleButtonGroup
      {...props}
      ref={domRef}
      orientation={orientation}
      selectionMode="single"
      disallowEmptySelection
      className={props.className ?? "react-aria-SegmentedControl"}
      data-justified={isJustified || undefined}
      data-orientation={orientation}
      aria-label={
        props["aria-label"] ??
        slotProps?.["aria-label"] ??
        ((props["aria-labelledby"] ?? slotProps?.["aria-labelledby"])
          ? undefined
          : "View")
      }
      selectedKeys={selectedKey != null ? [selectedKey] : undefined}
      defaultSelectedKeys={
        defaultSelectedKey != null ? [defaultSelectedKey] : undefined
      }
      onSelectionChange={(keys) => {
        const first = keys.values().next().value;
        if (first != null) onSelectionChange?.(first);
      }}
    >
      {composeRenderProps(
        props.children ??
          rangeSegmentsDefaultChildren("SegmentedControl", {
            SegmentedControlItem,
            SelectionIndicator,
            Text,
            Icon: SegmentIcon,
            frame: "div",
          }),
        (children) => (
          <DefaultSelection>{children}</DefaultSelection>
        ),
      )}
    </ToggleButtonGroup>
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
          { Text, Icon: SegmentIcon, SelectionIndicator, frame: "div" },
          {
            ...(label === undefined ? {} : { label }),
            ...(icon === undefined ? {} : { icon }),
          },
        )}
    </ToggleButton>
  );
});
