import { createContext, useContext, type ReactNode } from "react";
import { useLocale } from "react-aria-components/I18nProvider";
import { pickerSelectedCount } from "../../i18n/pickerSelectedCount";

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
