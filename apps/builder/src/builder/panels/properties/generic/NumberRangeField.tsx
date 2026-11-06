import { PropertyNumberInput } from "../../../components/property/PropertyNumberInput";
import { catalogNumberRangeFits } from "../../../../../../../packages/shared/src/catalog/document/numberRangeValue";

/** One object write preserves an ordered pair through Undo, bindings and storage. */
export function NumberRangeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const range = catalogNumberRangeFits(value) ? value : { start: 0, end: 100 };
  return (
    <div data-number-range="">
      <PropertyNumberInput
        label={`${label} Start`}
        value={range.start}
        max={range.end}
        allowEmpty={false}
        onChange={(start) => {
          const next = { ...range, start };
          if (catalogNumberRangeFits(next)) onChange(next);
        }}
      />
      <PropertyNumberInput
        label={`${label} End`}
        value={range.end}
        min={range.start}
        allowEmpty={false}
        onChange={(end) => {
          const next = { ...range, end };
          if (catalogNumberRangeFits(next)) onChange(next);
        }}
      />
    </div>
  );
}
