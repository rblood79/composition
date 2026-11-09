import type { ReactNode } from "react";
import { ToggleButton } from "./ToggleButton";
import { ToggleButtonGroup as RACToggleButtonGroup } from "react-aria-components/ToggleButtonGroup";
import { composeRenderProps } from "react-aria-components/composeRenderProps";
import type { ToggleButtonGroupProps } from "react-aria-components/ToggleButtonGroup";
import type {
  DataBinding,
  ColumnMapping,
  DataBindingValue,
  ComponentSize,
  StaticColor,
} from "../types";
import { useCollectionData } from "../hooks";
import {
  ToggleButtonGroupVisualContext,
  ToggleButtonGroupIndicatorContext,
  ToggleButtonGroupMembershipContext,
} from "./ToggleButtonGroupContext";
// CSS: styles/generated/ToggleButtonGroup.css + styles/ToggleButtonGroup.css (staticColor × indicator 조합
// 전용 수동 — ToggleButton.css 동형). 기본(segmented) 모드는 자식 ToggleButton 의 수동 CSS 가 담당한다.
// Preview · Publish 번들 (styles/index.css) 이 싣는다 — 빌더 문서는 싣지 않는다 (ADR-305).
import { useComponentStrings } from "../i18n";

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
   * @default 'M'
   */
  size?: ComponentSize;
  /**
   * S2 density — Spectrum ActionGroup 규칙: 폰트·아이콘 크기는 그대로 두고 간격만 바꾸며,
   * `compact` 에서는 버튼 간격이 2px이고 양끝 모서리만 둥글다.
   * `regular` 는 버튼이 분리되고 그 사이에 gap 이 생긴다.
   * 시각 규칙은 generated CSS 의 `[data-density]` 가 담당한다 (catalog SSOT).
   * @default 'regular'
   */
  density?: "compact" | "regular";
  /**
   * 유색/이미지 배경 위 고정 흑백 스킴 (RSP S2). 그룹 자신의 시각(배경 transparent)은
   * 바뀌지 않고 **자식 ToggleButton 으로 상속**된다 — RSP S2 ActionButtonGroup 정의 동형.
   * 그룹에 지정된 값이 자식 값보다 우선한다.
   * @default 'auto'
   */
  staticColor?: StaticColor;
  /**
   * S2 isJustified — 버튼들이 그룹 폭을 같은 몫으로 나눈다 (시트의 `[data-justified]` 가
   * 각 버튼에 flex-grow 1 · flex-basis 0, ToggleButtonGroup.css).
   * @default false
   */
  isJustified?: boolean;
  dataBinding?: DataBinding | DataBindingValue;
  columnMapping?: ColumnMapping;
}

export function ToggleButtonGroup({
  indicator = false,
  isEmphasized,
  isQuiet,
  size,
  density = "regular",
  staticColor,
  isJustified = false,
  dataBinding,
  columnMapping,
  children,
  ...props
}: ToggleButtonGroupExtendedProps) {
  const t = useComponentStrings();
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
      data-size={size ?? "M"}
      data-density={density}
      data-static-color={staticColor ?? "auto"}
      data-justified={isJustified || undefined}
      className={toggleButtonGroupClassName}
      isDisabled={isDisabled || props.isDisabled}
    >
      <ToggleButtonGroupMembershipContext.Provider value={true}>
        <ToggleButtonGroupVisualContext.Provider
          value={{
            size,
            isEmphasized,
            isQuiet,
            isDisabled: isDisabled || props.isDisabled,
            staticColor,
            density,
            orientation: props.orientation ?? "horizontal",
            isJustified,
          }}
        >
          <ToggleButtonGroupIndicatorContext.Provider value={indicator}>
            {content}
          </ToggleButtonGroupIndicatorContext.Provider>
        </ToggleButtonGroupVisualContext.Provider>
      </ToggleButtonGroupMembershipContext.Provider>
    </RACToggleButtonGroup>
  );

  const loadingContent = (
    <ToggleButton className="react-aria-ToggleButton button-base">
      {t("loading")}
    </ToggleButton>
  );
  const errorContent = (
    <ToggleButton className="react-aria-ToggleButton button-base">
      {t("error")}
    </ToggleButton>
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
          <ToggleButton
            key={item.id}
            id={item.id}
            isDisabled={item.isDisabled}
            className="react-aria-ToggleButton button-base"
          >
            {item.label}
          </ToggleButton>
        )),
      );
    }
  }

  return shell(children as ReactNode);
}
