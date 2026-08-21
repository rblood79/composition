import { getItemLabel } from "./resolveCollectionItems";

/**
 * Select/ComboBox 계열이 **닫힌 상태에서 보여줄 텍스트** 를 owner props 로부터 결정한다
 * (2026-08-22, design-data 감사 §1-1 Select/ComboBox 행).
 *
 * **왜 필요한가**: 선택 결과는 owner element props 에 `selectedKey`(item id) + `selectedValue`
 * (item 의 value) 로 저장된다(`renderSelect` 의 onSelectionChange). DOM 은 RAC `SelectValue` 가
 * 내부 selection state 에서 라벨을 직접 그리므로 문제가 없었지만, Skia 는 SelectValue 자식에
 * **placeholder 만** 전파하고 있어서(`implicitStyles` SelectValue 분기) 옵션을 골라도 캔버스는
 * 계속 placeholder 를 그렸다 — 같은 문서를 두 consumer 가 다르게 그리는 D3 비대칭.
 *
 * 표시 우선순위는 DOM(RAC)이 하는 것과 같다: **선택된 항목의 라벨** > 저장된 value >
 * key > placeholder. 라벨을 items 에서 찾는 이유 = value 는 "us-west-2" 같은 코드값일 수
 * 있고 사용자가 화면에서 보는 것은 라벨이기 때문.
 *
 * items 를 못 찾는 경우(dataBinding 으로 원격에서 채우는 문서)는 저장된 value/key 로 떨어진다
 * — Skia 는 async 데이터를 기다리지 않으므로, 라벨 대신 값이라도 보여주는 쪽이 placeholder
 * 를 계속 보여주는 것보다 실제 상태에 가깝다.
 */
export function resolveSelectDisplayValue(input: {
  /** owner(Select/ComboBox/NumberField/SearchField) 의 props. */
  ownerProps: Record<string, unknown> | undefined;
  /** 미선택 시 표시할 텍스트. */
  placeholder?: unknown;
}): string | null {
  const props = input.ownerProps;
  const placeholder =
    typeof input.placeholder === "string" && input.placeholder.length > 0
      ? input.placeholder
      : null;
  if (!props) return placeholder;

  // ComboBox 는 자유 입력이라 inputValue 가 선택보다 우선한다 (사용자가 마지막에 친 값).
  const inputValue = props.inputValue;
  if (typeof inputValue === "string" && inputValue.length > 0) {
    return inputValue;
  }

  const selectedKey =
    typeof props.selectedKey === "string" && props.selectedKey.length > 0
      ? props.selectedKey
      : null;
  const selectedValue =
    typeof props.selectedValue === "string" && props.selectedValue.length > 0
      ? props.selectedValue
      : null;

  if (!selectedKey && !selectedValue) return placeholder;

  const items = Array.isArray(props.items) ? props.items : null;
  if (items) {
    const matched = items.find((item) => {
      if (typeof item !== "object" || item === null) return false;
      const record = item as Record<string, unknown>;
      if (selectedKey !== null && String(record.id ?? "") === selectedKey) {
        return true;
      }
      // id 를 못 맞추면 value 로도 찾는다 — legacy 문서는 selectedKey 가 RAC 내부 id
      // ("react-aria-3") 로 남아 있을 수 있고 그때 실제 짝은 value 쪽이다.
      return (
        selectedValue !== null && String(record.value ?? "") === selectedValue
      );
    });
    if (matched) {
      return getItemLabel(matched, selectedKey ?? selectedValue ?? "", 0);
    }
  }

  return selectedValue ?? selectedKey ?? placeholder;
}
