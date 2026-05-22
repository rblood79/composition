import type { ReactNode } from "react";
import {
  ToggleButton as RACToggleButton,
  ToggleButtonGroup as RACToggleButtonGroup,
  ToggleButtonGroupProps,
  composeRenderProps,
} from "react-aria-components";
import type {
  DataBinding,
  ColumnMapping,
  DataBindingValue,
  ComponentSizeSubset,
} from "../types";
import { useCollectionData } from "../hooks";
import {
  ToggleButtonGroupEmphasizedContext,
  ToggleButtonGroupIndicatorContext,
} from "./ToggleButtonGroupContext";
import "./styles/generated/ToggleButtonGroup.css";

export interface ToggleButtonGroupExtendedProps extends ToggleButtonGroupProps {
  indicator?: boolean;
  /**
   * Emphasize the toggle button group with accent color (S2)
   * @default false
   */
  isEmphasized?: boolean;
  /**
   * Quiet variant (reduced visual weight) (S2)
   * @default false
   */
  isQuiet?: boolean;
  /**
   * Size for child ToggleButton buttons
   * @default 'md'
   */
  size?: ComponentSizeSubset;
  dataBinding?: DataBinding | DataBindingValue;
  columnMapping?: ColumnMapping;
}

export function ToggleButtonGroup({
  indicator = false,
  isEmphasized = false,
  isQuiet = false,
  size = "md",
  dataBinding,
  columnMapping,
  children,
  ...props
}: ToggleButtonGroupExtendedProps) {
  const {
    data: boundData,
    loading,
    error,
  } = useCollectionData({
    dataBinding: dataBinding as DataBinding,
    componentName: "ToggleButtonGroup",
    fallbackData: [
      { id: 1, name: "Button 1", value: "button-1" },
      { id: 2, name: "Button 2", value: "button-2" },
    ],
  });

  const isPropertyBinding =
    dataBinding &&
    "source" in dataBinding &&
    "name" in dataBinding &&
    !("type" in dataBinding);
  const hasDataBinding =
    (!isPropertyBinding &&
      dataBinding &&
      "type" in dataBinding &&
      dataBinding.type === "collection") ||
    isPropertyBinding;

  const toggleButtonGroupClassName = composeRenderProps(
    props.className,
    (cls) => {
      const base = indicator
        ? "react-aria-ToggleButtonGroup button-base"
        : "react-aria-ToggleButtonGroup";
      return cls ? `${base} ${cls}` : base;
    },
  );

  const shell = (content: ReactNode, isDisabled = false) => (
    <RACToggleButtonGroup
      {...props}
      data-indicator={indicator ? "true" : "false"}
      data-emphasized={isEmphasized || undefined}
      data-quiet={isQuiet || undefined}
      data-size={size}
      className={toggleButtonGroupClassName}
      isDisabled={isDisabled || props.isDisabled}
    >
      <ToggleButtonGroupEmphasizedContext.Provider value={isEmphasized}>
        <ToggleButtonGroupIndicatorContext.Provider value={indicator}>
          {content}
        </ToggleButtonGroupIndicatorContext.Provider>
      </ToggleButtonGroupEmphasizedContext.Provider>
    </RACToggleButtonGroup>
  );

  const loadingContent = (
    <RACToggleButton className="react-aria-ToggleButton button-base">
      ⏳ 로딩 중...
    </RACToggleButton>
  );
  const errorContent = (
    <RACToggleButton className="react-aria-ToggleButton button-base">
      ❌ 오류
    </RACToggleButton>
  );

  if (hasDataBinding && columnMapping) {
    if (loading) return shell(loadingContent, true);
    if (error) return shell(errorContent, true);
    return shell(children as ReactNode);
  }

  if (hasDataBinding) {
    if (loading) return shell(loadingContent, true);
    if (error) return shell(errorContent, true);
    if (boundData.length > 0) {
      const buttonItems = boundData.map((item, index) => ({
        id: String(item.id || item.value || index),
        label: String(
          item.name || item.title || item.label || `Button ${index + 1}`,
        ),
        isDisabled: Boolean(item.isDisabled),
      }));
      return shell(
        buttonItems.map((item) => (
          <RACToggleButton
            key={item.id}
            id={item.id}
            isDisabled={item.isDisabled}
            className="react-aria-ToggleButton button-base"
          >
            {item.label}
          </RACToggleButton>
        )),
      );
    }
  }

  return shell(children as ReactNode);
}
