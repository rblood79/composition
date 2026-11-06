import type { ReactNode } from "react";
import {
  ToggleButton as RACToggleButton,
  ToggleButtonProps,
} from "react-aria-components/ToggleButton";
import { SelectionIndicator } from "react-aria-components/SelectionIndicator";
import { composeRenderProps } from "react-aria-components/composeRenderProps";
import type { ComponentSize, StaticColor } from "../types";
import {
  useToggleButtonGroupVisual,
  useToggleButtonGroupIndicator,
  useToggleButtonGroupMembership,
} from "./ToggleButtonGroupContext";
// 기본 시각은 catalog 생성 CSS, Builder chrome의 변수는 수동 CSS가 담당한다.

export interface ToggleButtonExtendedProps extends ToggleButtonProps {
  /**
   * Emphasizes the toggle button with accent color when selected (S2)
   * @default false
   */
  isEmphasized?: boolean;
  /**
   * Renders the toggle button with no visible background (S2)
   * @default false
   */
  isQuiet?: boolean;
  /**
   * Size of the toggle button
   * @default 'M'
   */
  size?: ComponentSize;
  /**
   * Fixed black/white scheme for placement over colored or image backgrounds (RSP S2).
   * @default 'auto'
   */
  staticColor?: StaticColor;
}

/**
 * S2 variant 전환: isEmphasized / isQuiet data-* 패턴
 * - data-emphasized: accent color 강조 (선택 시)
 * - data-quiet: 배경 없는 quiet 스타일
 * - data-size: 크기
 */
export function ToggleButton({
  isEmphasized = false,
  isQuiet = false,
  size = "M",
  staticColor = "auto",
  children,
  ...props
}: ToggleButtonExtendedProps) {
  const showIndicator = useToggleButtonGroupIndicator();
  const group = useToggleButtonGroupVisual();
  const isGroupMember = useToggleButtonGroupMembership();
  const effectiveEmphasized = group?.isEmphasized ?? isEmphasized;
  const effectiveStaticColor = group?.staticColor ?? staticColor;

  return (
    <RACToggleButton
      {...props}
      isDisabled={group?.isDisabled ?? props.isDisabled}
      data-variant="default"
      data-emphasized={effectiveEmphasized || undefined}
      data-quiet={(group?.isQuiet ?? isQuiet) || undefined}
      data-size={group?.size ?? size}
      data-in-group={isGroupMember || undefined}
      data-density={group?.density}
      data-orientation={group?.orientation}
      data-justified={group?.isJustified || undefined}
      data-static-color={effectiveStaticColor}
      className={composeRenderProps(props.className, (cls) => {
        const base = showIndicator
          ? "react-aria-ToggleButton"
          : "react-aria-ToggleButton button-base";
        return cls ? `${base} ${cls}` : base;
      })}
    >
      {showIndicator && (
        <SelectionIndicator
          className="react-aria-SelectionIndicator button-base"
          data-selected
        />
      )}
      {/* 그룹 콘텐츠는 indicator 모드와 같은 레이아웃을 공유한다. */}
      {isGroupMember ? (
        <span>{children as ReactNode}</span>
      ) : (
        (children as ReactNode)
      )}
    </RACToggleButton>
  );
}
