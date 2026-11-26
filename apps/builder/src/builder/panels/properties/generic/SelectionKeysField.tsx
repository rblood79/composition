import { SelectValue } from "react-aria-components/Select";

import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../../i18n";
import {
  PanelSelect,
  PanelSelectItem,
} from "../../../components/property/PanelSelect";
import { PropertyChipGroup } from "../../../components/property/PropertyChipGroup";
import { PropertyInput } from "../../../components/property/PropertyInput";
import { useControlPopoverMetrics } from "../../../components/property/useControlPopoverMetrics";

/**
 * A key list field. With `options` (ADR-308 — a group's items, key · text) it is a select that takes
 * several (사용자 결정 3 — several keys); without, the keys typed as text.
 */
export function SelectionKeysField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: unknown;
  options?: readonly { value: string; label: string }[];
  onChange: (value: unknown) => void;
}) {
  if (options) {
    const keys =
      value === "all"
        ? options.map((option) => option.value)
        : Array.isArray(value)
          ? value.map(String)
          : [];
    return (
      <SelectionKeysSelect
        label={label}
        keys={keys}
        options={options}
        onChange={onChange}
      />
    );
  }
  return (
    <div data-selection-keys="">
      <PropertyChipGroup
        label={label}
        chips={[{ key: "all", label: "All", selected: value === "all" }]}
        onToggle={(_key, selected) => onChange(selected ? "all" : [])}
      />
      {value !== "all" && (
        <PropertyInput
          label={`${label} IDs`}
          value={Array.isArray(value) ? value.join(", ") : ""}
          onChange={(text) =>
            onChange(
              text
                .split(",")
                .map((key) => key.trim())
                .filter(Boolean),
            )
          }
        />
      )}
    </div>
  );
}

/**
 * The items as a select that takes several (RAC `Select` `selectionMode="multiple"` — the trigger
 * lists the picked items' text). Why (2026-11-26 ratchet 조사, 사용자 결정): a check list drew one
 * RAC Checkbox per item — a 300-item list put 300 controls in the panel on every selection
 * (`600:scroll-boxes` attribute mutations 65 → 1,568). A closed `PanelSelect` gives RAC the picked
 * items only; the whole list is drawn while it is open.
 */
function SelectionKeysSelect({
  label,
  keys,
  options,
  onChange,
}: {
  label: string;
  keys: readonly string[];
  options: readonly { value: string; label: string }[];
  onChange: (value: unknown) => void;
}) {
  const i18n = useOptionalI18n();
  const displayLabel = i18n
    ? translateKey(i18n.t, semanticLabelKeys[label] ?? label, label)
    : label;
  const { anchorRef, controlRef, popoverStyle } = useControlPopoverMetrics();
  return (
    <fieldset className="properties-aria" data-selection-keys="">
      <legend className="fieldset-legend">{displayLabel}</legend>
      <div className="react-aria-control react-aria-Group" ref={anchorRef}>
        <PanelSelect
          aria-label={displayLabel}
          selectionMode="multiple"
          selectedKeys={keys}
          onSelectionKeysChange={(next) => onChange(next.map(String))}
          selectRef={controlRef}
          popoverStyle={popoverStyle}
          trigger={
            <SelectValue>
              {({ isPlaceholder, selectedText }) =>
                isPlaceholder ? "—" : selectedText
              }
            </SelectValue>
          }
        >
          {options.map((option) => (
            <PanelSelectItem
              key={option.value}
              id={option.value}
              label={option.label}
            />
          ))}
        </PanelSelect>
      </div>
    </fieldset>
  );
}
