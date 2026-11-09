/**
 * CompactSelect — 라벨 fieldset 없는 작은 Select (ADR-212 Phase 4·5).
 *
 * `PropertySelect` 는 자기 `<fieldset>`+`<legend>` 를 그리므로 요청 바·import 행처럼 라벨을
 * 옆에 두거나 격자 칸에 들어가는 자리에는 맞지 않는다. 여기서는 접근 이름을 `aria-label` 로만
 * 주는 인라인 Select 를 둔다. Select · 팝오버 · 목록 틀은 패널 Select 와 같은 `PanelSelect`.
 */
import { SelectValue } from "react-aria-components/Select";
import {
  PanelSelect,
  PanelSelectItem,
} from "../../../components/property/PanelSelect";

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
    <PanelSelect
      className={`datatable-compact-select ${className ?? ""}`.trim()}
      selectedKey={value}
      onSelectionChange={(key) => onChange(String(key))}
      aria-label={ariaLabel}
      trigger={<SelectValue />}
    >
      {options.map((option) => (
        <PanelSelectItem
          key={option.value}
          id={option.value}
          label={option.label}
        />
      ))}
    </PanelSelect>
  );
}
