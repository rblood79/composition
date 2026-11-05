import { createContext, useContext, type ReactNode } from "react";
import { useLocale } from "react-aria-components/I18nProvider";
import { tokenToCSSVar } from "@composition/rendering";
import { pickerSelectedCount } from "../../i18n/pickerSelectedCount";
import { Icon } from "../../components/Icon";
import { pickerOptionMetrics, pickerOptionPaint } from "./pickerSelection";

const InsidePickerValue = createContext(false);

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
  disabled,
  active,
}: {
  size: unknown;
  multiple: boolean;
  selected: boolean;
  disabled: boolean;
  active: boolean;
}) {
  const insideValue = useContext(InsidePickerValue);
  if (insideValue || (!multiple && !selected)) return null;
  const metric = pickerOptionMetrics(size);
  const paint = pickerOptionPaint(selected, disabled, active);
  return (
    <span
      aria-hidden="true"
      data-picker-option-indicator={multiple ? "checkbox" : "check"}
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
        ...(multiple
          ? {
              border: `2px solid ${tokenToCSSVar(paint.border)}`,
              borderRadius: metric.radius,
              backgroundColor: tokenToCSSVar(paint.background),
            }
          : {}),
      }}
    >
      {selected && (
        <Icon
          iconName="check"
          aria-hidden="true"
          style={{
            width: metric.box - (multiple ? 4 : 0),
            height: metric.box - (multiple ? 4 : 0),
            fontSize: metric.box - (multiple ? 4 : 0),
            color: tokenToCSSVar(multiple ? paint.check : "{color.accent}"),
          }}
        />
      )}
    </span>
  );
}
