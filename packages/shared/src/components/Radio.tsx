import {
  Radio as AriaRadio,
  RadioProps as AriaRadioProps,
  composeRenderProps,
} from "react-aria-components";
import { useFocusRing } from "@react-aria/focus";
import { mergeProps } from "@react-aria/utils";
import {
  toRadioRacProps,
  type RadioCanonicalProps,
} from "../catalog/outputs/toRacProps";

import "./styles/Radio.css";

export interface RadioProps extends Omit<AriaRadioProps, "children" | "value"> {
  children?: React.ReactNode;
  value?: string;
  variant?: "default" | "accent" | "neutral" | "negative";
  size?: "sm" | "md" | "lg" | "xl";
  isSelected?: boolean;
  defaultSelected?: boolean;
  isEmphasized?: boolean;
  isReadOnly?: boolean;
}

export function Radio(props: RadioProps) {
  const {
    children,
    className,
    defaultSelected,
    isDisabled,
    isEmphasized,
    isReadOnly,
    isSelected,
    size,
    style,
    value,
    variant,
    ...restProps
  } = props;
  const { focusProps, isFocusVisible } = useFocusRing();
  const projectedProps = toRadioRacProps({
    ...restProps,
    children,
    className,
    defaultSelected,
    isDisabled,
    isEmphasized,
    isReadOnly,
    isSelected,
    size,
    style,
    value,
    variant,
  } as RadioCanonicalProps);

  const radioChildren = children ?? projectedProps.children;
  const radioVariant = variant ?? projectedProps.variant;
  const radioSize = size ?? projectedProps.size;
  const radioIsEmphasized = isEmphasized ?? projectedProps.isEmphasized;

  return (
    <AriaRadio
      {...mergeProps(restProps, focusProps)}
      value={projectedProps.value ?? "radio"}
      isDisabled={isDisabled ?? projectedProps.isDisabled}
      autoFocus={projectedProps.autoFocus}
      style={style}
      data-focus-visible={isFocusVisible || undefined}
      data-variant={radioVariant}
      data-size={radioSize}
      data-emphasized={radioIsEmphasized || undefined}
      data-selected={
        (isSelected ?? projectedProps.isSelected) ? true : undefined
      }
      data-readonly={
        (isReadOnly ?? projectedProps.isReadOnly) ? true : undefined
      }
      className={composeRenderProps(className, (className) =>
        className ? `react-aria-Radio ${className}` : "react-aria-Radio",
      )}
    >
      {radioChildren}
    </AriaRadio>
  );
}
