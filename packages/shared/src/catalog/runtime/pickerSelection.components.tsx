import { createContext, useContext, type ReactNode } from "react";
import { useLocale } from "react-aria-components/I18nProvider";
import { tokenToCSSVar } from "@composition/rendering";
import { pickerSelectedCount } from "../../i18n/pickerSelectedCount";
import { Icon } from "../../components/Icon";
import { pickerOptionMetrics } from "./pickerSelection";

const InsidePickerValue = createContext(false);

export function CatalogPickerSelectionSlot({
  children,
}: {
  children?: ReactNode;
}) {
  return useContext(InsidePickerValue) ? null : children;
}

/** RAC의 항목 나열 대신 S2의 기본 다중 선택 요약. 0/1개는 원래 슬롯 내용을 보존한다. */
export function CatalogPickerValueContent({
  count,
  children,
}: {
  count: number;
  children?: ReactNode;
}) {
  const { locale } = useLocale();
  return (
    <InsidePickerValue.Provider value={true}>
      {count > 1 ? (
        <span slot="label" data-picker-selected-count="">
          {pickerSelectedCount(count, locale)}
        </span>
      ) : (
        children
      )}
    </InsidePickerValue.Provider>
  );
}

/** 옵션의 aria-selected가 접근성을 소유한다. 중첩된 interactive checkbox를 만들지 않는다. */
export function CatalogPickerOptionIndicator({
  size,
  multiple,
  selected,
}: {
  size: unknown;
  multiple: boolean;
  selected: boolean;
}) {
  const insideValue = useContext(InsidePickerValue);
  if (insideValue || multiple || !selected) return null;
  const metric = pickerOptionMetrics(size);
  return (
    <span
      aria-hidden="true"
      data-picker-option-indicator="check"
      data-selected={selected || undefined}
      style={{
        position: "absolute",
        left: metric.edge,
        top: "50%",
        transform: "translateY(-50%)",
        width: metric.box,
        height: metric.box,
        pointerEvents: "none",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {selected && (
        <Icon
          iconName="check"
          aria-hidden="true"
          style={{
            width: metric.box,
            height: metric.box,
            fontSize: metric.box,
            color: tokenToCSSVar("{color.accent}"),
          }}
        />
      )}
    </span>
  );
}
