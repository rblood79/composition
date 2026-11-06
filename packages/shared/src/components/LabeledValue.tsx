import { isValidElement, type HTMLAttributes, type ReactNode } from "react";
import { useLocale } from "react-aria";
import {
  formatLabeledValue,
  type LabeledValue as StoredValue,
  type LabeledFormat,
} from "../catalog/document/labeledValue";

export interface LabeledValueProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> {
  label?: ReactNode;
  value?: StoredValue | ReactNode;
  formatOptions?: LabeledFormat;
  children?: ReactNode;
  size?: "S" | "M" | "L" | "XL";
  labelPosition?: "top" | "side";
  labelAlign?: "start" | "end";
}

/** S2's static display uses the same locale formatter as the Canvas. */
export function LabeledValue({
  label,
  value,
  formatOptions,
  children,
  size = "M",
  labelPosition = "top",
  labelAlign = "start",
  className = "",
  ...props
}: LabeledValueProps) {
  const { locale } = useLocale();
  return (
    <div
      {...props}
      className={`react-aria-LabeledValue ${className}`}
      data-size={size}
      data-label-position={labelPosition}
      data-label-align={labelAlign}
    >
      {children ?? (
        <>
          <span slot="label" className="react-aria-Text">
            {label}
          </span>
          <span slot="value" className="react-aria-Text">
            {isValidElement(value)
              ? value
              : formatLabeledValue(value, locale, formatOptions)}
          </span>
        </>
      )}
    </div>
  );
}
