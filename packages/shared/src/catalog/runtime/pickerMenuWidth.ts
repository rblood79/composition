import {
  PICKER_QUIET_MENU_INSET,
  PICKER_QUIET_MENU_MIN_WIDTH,
} from "../document/pickerTrigger";

/** S2 Picker/ComboBox의 메뉴 기본 폭. 사용자 저작값은 소비자에서 이 위에 적용한다. */
export function catalogPickerMenuWidth(
  type: string,
  props: Readonly<Record<string, unknown>>,
  triggerWidth: number,
): { width: number; minWidth: number };
export function catalogPickerMenuWidth(
  type: string,
  props: Readonly<Record<string, unknown>>,
  triggerWidth: string,
): { width: number | string; minWidth: number | string };
export function catalogPickerMenuWidth(
  type: string,
  props: Readonly<Record<string, unknown>>,
  triggerWidth: number | string,
): { width: number | string; minWidth: number | string } {
  if (type === "Select" && props.isQuiet === true)
    return {
      width:
        typeof triggerWidth === "number"
          ? Math.max(0, triggerWidth - PICKER_QUIET_MENU_INSET)
          : `calc(${triggerWidth} - ${PICKER_QUIET_MENU_INSET}px)`,
      minWidth: PICKER_QUIET_MENU_MIN_WIDTH,
    };
  const requested = props.menuWidth;
  const width =
    typeof requested === "number" && requested > 0 ? requested : triggerWidth;
  return { width, minWidth: type === "Select" ? triggerWidth : width };
}
