/**
 * CompactSelect — 라벨 fieldset 없는 작은 RAC Select (ADR-212 Phase 4·5).
 *
 * `PropertySelect` 는 자기 `<fieldset>`+`<legend>` 를 그리므로 요청 바·import 행처럼 라벨을
 * 옆에 두거나 격자 칸에 들어가는 자리에는 맞지 않는다. 여기서는 접근 이름을 `aria-label` 로만
 * 주는 인라인 Select 를 제공한다 (RAC — D1 키보드·팝오버 계약 그대로).
 */
import { Button } from "react-aria-components/Button";
import { ListBox, ListBoxItem } from "react-aria-components/ListBox";
import { Popover } from "react-aria-components/Popover";
import { Select, SelectValue } from "react-aria-components/Select";
import { ChevronDown } from "lucide-react";
import { iconProps } from "../../../../utils/ui/uiConstants";

export interface CompactSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  "aria-label": string;
  className?: string;
}

export function CompactSelect({
  value,
  onChange,
  options,
  className,
  "aria-label": ariaLabel,
}: CompactSelectProps) {
  return (
    <Select
      className={`react-aria-Select datatable-compact-select ${className ?? ""}`}
      selectedKey={value}
      onSelectionChange={(key) => onChange(String(key))}
      aria-label={ariaLabel}
    >
      <Button className="react-aria-Button">
        <SelectValue />
        <span aria-hidden="true" className="select-chevron">
          <ChevronDown size={iconProps.size} />
        </span>
      </Button>
      <Popover className="react-aria-Popover property-select-popover">
        <ListBox className="react-aria-ListBox">
          {options.map((option) => (
            <ListBoxItem
              key={option.value}
              id={option.value}
              className="react-aria-ListBoxItem"
              textValue={option.label}
            >
              {option.label}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}
