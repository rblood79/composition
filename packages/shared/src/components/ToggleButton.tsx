import type { ReactNode } from "react";
import {
  ToggleButton as RACToggleButton,
  ToggleButtonProps,
  SelectionIndicator,
  composeRenderProps,
} from "react-aria-components";
import type { ComponentSizeSubset, StaticColor } from "../types";
import {
  useToggleButtonGroupEmphasized,
  useToggleButtonGroupIndicator,
  useToggleButtonGroupMembership,
} from "./ToggleButtonGroupContext";
import "./styles/generated/ToggleButton.css";
// staticColor 전용 수동 CSS (catalog 토큰으로 표현 불가한 고정 흑백) — Button.tsx 동형.
import "./styles/ToggleButton.css";

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
   * @default 'md'
   */
  size?: ComponentSizeSubset;
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
  size = "md",
  staticColor = "auto",
  children,
  ...props
}: ToggleButtonExtendedProps) {
  const showIndicator = useToggleButtonGroupIndicator();
  const groupEmphasized = useToggleButtonGroupEmphasized();
  const isGroupMember = useToggleButtonGroupMembership();
  const effectiveEmphasized = isEmphasized || groupEmphasized;

  return (
    <RACToggleButton
      {...props}
      data-variant="default"
      data-emphasized={effectiveEmphasized || undefined}
      data-quiet={isQuiet || undefined}
      data-size={size}
      data-static-color={staticColor}
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
      {/* span wrapper 는 group 안에서만 렌더한다. group pressed micro-interaction(버튼 box 는
          scale 고정, 내부 콘텐츠만 0.9 축소)은 generated ToggleButtonGroup.css 의
          `.react-aria-ToggleButtonGroup .react-aria-ToggleButton[data-pressed] > span` selector
          가 매칭하는데, 이 selector 는 group 하위로 한정된다. standalone(group 밖) ToggleButton 의
          generated CSS 에는 `> span` 규칙이 없어(reference starter 의 flex/svg 규칙 미emit) span 이
          소비처 없는 dead wrapper 였다 → group 멤버십(isGroupMember) 일 때만 래핑.
          SelectionIndicator(showIndicator)는 span 밖(절대 위치 자식) — span 은 시각 콘텐츠만 감쌈.
          빌더 경로의 children 은 string/element 만 들어와 render-prop 미사용. */}
      {isGroupMember ? (
        <span>{children as ReactNode}</span>
      ) : (
        (children as ReactNode)
      )}
    </RACToggleButton>
  );
}
