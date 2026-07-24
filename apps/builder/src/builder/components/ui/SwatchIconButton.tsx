import {
  Button as RACButton,
  type ButtonProps as RACButtonProps,
  ToggleButton as RACToggleButton,
  type ToggleButtonProps as RACToggleButtonProps,
} from "react-aria-components";
import "./SwatchIconButton.css";

export interface SwatchIconButtonProps extends Omit<
  RACButtonProps,
  "className"
> {
  /** Additional CSS class */
  className?: string;
}

export function SwatchIconButton({
  className,
  children,
  ...props
}: SwatchIconButtonProps) {
  return (
    <RACButton
      {...props}
      className={
        className ? `swatch-icon-button ${className}` : "swatch-icon-button"
      }
    >
      <span className="swatch-icon-inner">{children as React.ReactNode}</span>
    </RACButton>
  );
}

export interface SwatchIconToggleButtonProps extends Omit<
  RACToggleButtonProps,
  "className"
> {
  /** Additional CSS class */
  className?: string;
}

/** SwatchIconButton 과 동일 시각 패턴의 toggle 변형 (ActionIconButton/ActionIconToggleButton 쌍과 동일 구조) */
export function SwatchIconToggleButton({
  className,
  children,
  ...props
}: SwatchIconToggleButtonProps) {
  return (
    <RACToggleButton
      {...props}
      className={
        className ? `swatch-icon-button ${className}` : "swatch-icon-button"
      }
    >
      <span className="swatch-icon-inner">{children as React.ReactNode}</span>
    </RACToggleButton>
  );
}
