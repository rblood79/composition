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
  StaticColor,
} from "../types";
import { useCollectionData } from "../hooks";
import {
  ToggleButtonGroupEmphasizedContext,
  ToggleButtonGroupIndicatorContext,
  ToggleButtonGroupMembershipContext,
  ToggleButtonGroupStaticColorContext,
} from "./ToggleButtonGroupContext";
import "./styles/generated/ToggleButtonGroup.css";
// staticColor × indicator 조합 전용 수동 CSS (ToggleButton.css 동형 — 고정 흑백은 catalog
// 토큰으로 표현 불가). 기본(segmented) 모드는 자식 ToggleButton 의 수동 CSS 가 담당한다.
import "./styles/ToggleButtonGroup.css";

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
  /**
   * S2 density — Spectrum ActionGroup 규칙: 폰트·아이콘 크기는 그대로 두고 간격만 바꾸며,
   * `compact` 에서는 버튼이 **연결**된다(양끝만 radius + `-1px` 겹침 = 단일 bar).
   * `regular` 는 버튼이 분리되고 그 사이에 gap 이 생긴다.
   * 시각 규칙은 generated CSS 의 `[data-density]` 가 담당한다 (catalog SSOT).
   * @default 'regular'
   */
  density?: "compact" | "regular";
  /**
   * 유색/이미지 배경 위 고정 흑백 스킴 (RSP S2). 그룹 자신의 시각(배경 transparent)은
   * 바뀌지 않고 **자식 ToggleButton 으로 상속**된다 — RSP S2 ActionButtonGroup 정의 동형.
   * 자식이 자기 `staticColor` 를 `auto` 가 아닌 값으로 지정하면 자식 값이 우선.
   * @default 'auto'
   */
  staticColor?: StaticColor;
  dataBinding?: DataBinding | DataBindingValue;
  columnMapping?: ColumnMapping;
}

export function ToggleButtonGroup({
  indicator = false,
  isEmphasized = false,
  isQuiet = false,
  size = "md",
  density = "regular",
  staticColor = "auto",
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
      data-density={density}
      data-static-color={staticColor}
      className={toggleButtonGroupClassName}
      isDisabled={isDisabled || props.isDisabled}
    >
      <ToggleButtonGroupMembershipContext.Provider value={true}>
        <ToggleButtonGroupEmphasizedContext.Provider value={isEmphasized}>
          <ToggleButtonGroupIndicatorContext.Provider value={indicator}>
            <ToggleButtonGroupStaticColorContext.Provider value={staticColor}>
              {content}
            </ToggleButtonGroupStaticColorContext.Provider>
          </ToggleButtonGroupIndicatorContext.Provider>
        </ToggleButtonGroupEmphasizedContext.Provider>
      </ToggleButtonGroupMembershipContext.Provider>
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
