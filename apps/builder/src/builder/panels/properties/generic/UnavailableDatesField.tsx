import { useMemo } from "react";
import { Button } from "react-aria-components/Button";
import { useI18n } from "@/i18n";
import {
  catalogUnavailableDatesFit,
  type CatalogUnavailableDate,
  type CatalogUnavailableDates,
} from "../../../../../../../packages/shared/src/catalog/document/unavailableDates";
import { ACTION_ICONS } from "../../../config/actionIcons";
import {
  PanelDatePicker,
  PanelDateRangePicker,
} from "../../../components/property/PanelDatePicker";
import { PropertyChipGroup } from "../../../components/property/PropertyChipGroup";
import { PropertyFieldset } from "../../../components/property/PropertyFieldset";
import { PropertyRowMenu } from "../../../components/property/PropertyRowMenu";
import "./UnavailableDatesField.css";

const AddIcon = ACTION_ICONS.add;
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/**
 * S2 `isDateUnavailable` as data (S2 체크리스트 부록 D.3 2단계, 2026-11-23 — 사용자 결정: 요일 · 날짜 목록
 * · 데이터 표): the weekdays (chips, Sunday first — the stored numbering) and the days · periods no one
 * may pick. The data table's dates are the 「Data source」 row's (the binding's 「Unavailable date」
 * field and its conditions). An empty value removes the prop.
 */
export function UnavailableDatesField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (next: CatalogUnavailableDates | undefined) => void;
}) {
  const { t, locale } = useI18n();
  const current: CatalogUnavailableDates = catalogUnavailableDatesFit(value)
    ? value
    : {};
  const weekdays = current.weekdays ?? [];
  const dates = current.dates ?? [];
  // (The UI language's short weekday names — 2026-11-01 was a Sunday.)
  const names = useMemo(() => {
    const format = new Intl.DateTimeFormat(locale, {
      weekday: "short",
      timeZone: "UTC",
    });
    return WEEKDAYS.map((day) =>
      format.format(new Date(Date.UTC(2026, 10, 1 + day))),
    );
  }, [locale]);
  const write = (next: CatalogUnavailableDates) => {
    const out: CatalogUnavailableDates = {
      ...(next.weekdays?.length
        ? { weekdays: [...next.weekdays].sort((a, b) => a - b) }
        : {}),
      ...(next.dates?.length ? { dates: next.dates } : {}),
    };
    onChange(Object.keys(out).length ? out : undefined);
  };
  const setDates = (next: readonly CatalogUnavailableDate[]) =>
    write({ weekdays, dates: next });
  const today = () => new Date().toISOString().slice(0, 10);
  return (
    <PropertyFieldset legend={label} className="unavailable-dates-field">
      <div className="unavailable-dates">
        <PropertyChipGroup
          ariaLabel={t("unavailableDates.weekdays")}
          chips={WEEKDAYS.map((day) => ({
            key: String(day),
            label: names[day]!,
            selected: weekdays.includes(day),
          }))}
          onToggle={(key, selected) => {
            const day = Number(key);
            write({
              weekdays: selected
                ? [...weekdays.filter((item) => item !== day), day]
                : weekdays.filter((item) => item !== day),
              dates,
            });
          }}
        />
        {dates.map((entry, index) => {
          const period = typeof entry !== "string";
          const name = t(
            period ? "unavailableDates.period" : "unavailableDates.date",
          );
          return (
            <div
              key={`${index}:${period ? "period" : "date"}`}
              className="unavailable-date-row"
            >
              {period ? (
                <PanelDateRangePicker
                  aria-label={name}
                  value={entry}
                  onValueChange={(range) =>
                    range?.start && range.end
                      ? setDates(
                          dates.map((item, at) =>
                            at === index
                              ? range.start <= range.end
                                ? { start: range.start, end: range.end }
                                : { start: range.end, end: range.start }
                              : item,
                          ),
                        )
                      : setDates(dates.filter((_, at) => at !== index))
                  }
                />
              ) : (
                <PanelDatePicker
                  aria-label={name}
                  value={entry}
                  onValueChange={(text) => {
                    const day = text.slice(0, 10);
                    setDates(
                      day
                        ? dates.map((item, at) => (at === index ? day : item))
                        : dates.filter((_, at) => at !== index),
                    );
                  }}
                />
              )}
              <PropertyRowMenu
                label={t("unavailableDates.actions", { name })}
                items={[{ id: "remove", label: t("unavailableDates.remove") }]}
                onAction={() => setDates(dates.filter((_, at) => at !== index))}
              />
            </div>
          );
        })}
        <div className="unavailable-dates-add">
          <Button
            className="control-button"
            data-variant="add"
            onPress={() => setDates([...dates, today()])}
          >
            <AddIcon size={14} aria-hidden="true" />
            {t("unavailableDates.addDate")}
          </Button>
          <Button
            className="control-button"
            data-variant="add"
            onPress={() =>
              setDates([...dates, { start: today(), end: today() }])
            }
          >
            <AddIcon size={14} aria-hidden="true" />
            {t("unavailableDates.addPeriod")}
          </Button>
        </div>
      </div>
    </PropertyFieldset>
  );
}
