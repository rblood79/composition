import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useLocale } from "react-aria-components/I18nProvider";
import { pickerSelectedCount } from "../../i18n/pickerSelectedCount";
import { overScopeProps } from "./racSlotScope";

const InsidePickerValue = createContext(false);

/**
 * RAC가 재사용한 항목 Text는 목록 대신 현재 SelectValue의 typography를 따른다.
 *
 * DOM pass 가 이 wrapper 에 붙이는 속성 (`withHtmlId` 의 id · className · aria-label, `withRuntime`
 * 의 handler) 은 그린 요소로 넘긴다 — `RacSlotScope` 와 같은 `overScopeProps`. Why (2026-11-09):
 * wrapper 가 `style` · `render` 만 읽어 Text 의 작성 HTML id 가 Preview · Publish DOM 에서 빠졌다.
 */
export function CatalogPickerValueTypography({
  style,
  render,
  ...rest
}: {
  style: CSSProperties | undefined;
  render: (style: CSSProperties | undefined) => ReactNode;
  [key: string]: unknown;
}) {
  const insideValue = useContext(InsidePickerValue);
  const element = render(
    insideValue
      ? {
          ...style,
          fontFamily: "inherit",
          fontSize: "inherit",
          fontWeight: "inherit",
          lineHeight: "inherit",
        }
      : style,
  );
  return isValidElement(element) && Object.keys(rest).length
    ? cloneElement(element, overScopeProps(element, rest))
    : element;
}

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
