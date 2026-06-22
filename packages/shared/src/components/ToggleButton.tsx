import type { ReactNode } from "react";
import {
  ToggleButton as RACToggleButton,
  ToggleButtonProps,
  SelectionIndicator,
  composeRenderProps,
} from "react-aria-components";
import type { ComponentSizeSubset } from "../types";
import {
  useToggleButtonGroupEmphasized,
  useToggleButtonGroupIndicator,
} from "./ToggleButtonGroupContext";
import "./styles/generated/ToggleButton.css";

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
  children,
  ...props
}: ToggleButtonExtendedProps) {
  const showIndicator = useToggleButtonGroupIndicator();
  const groupEmphasized = useToggleButtonGroupEmphasized();
  const effectiveEmphasized = isEmphasized || groupEmphasized;

  return (
    <RACToggleButton
      {...props}
      data-variant="default"
      data-emphasized={effectiveEmphasized || undefined}
      data-quiet={isQuiet || undefined}
      data-size={size}
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
      {/* children 을 <span> 으로 래핑 — reference react-aria-starter ToggleButton.tsx:14-22 동형.
          group 안 pressed micro-interaction(버튼 box 는 scale 고정, 내부 콘텐츠만 0.9 축소)을
          위해 generated ToggleButtonGroup.css 의 `.react-aria-ToggleButton[data-pressed] > span`
          selector 가 매칭할 대상이 필요하다. SelectionIndicator(showIndicator)는 span 밖(절대 위치
          자식) — span 은 시각 콘텐츠만 감쌈.
          reference 는 children 을 composeRenderProps 로 감싸지만, composition 은 SelectionIndicator
          를 형제로 동시 렌더해야 해서(children render-prop 함수면 형제와 공존 불가) ReactNode 로
          좁혀 직접 래핑한다. 빌더 경로의 children 은 string/element 만 들어와 render-prop 미사용. */}
      <span>{children as ReactNode}</span>
    </RACToggleButton>
  );
}
