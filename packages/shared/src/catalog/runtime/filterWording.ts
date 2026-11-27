/**
 * ADR-320 §5.10 — the words a condition is shown with, in the site's language: the comparison
 * names, `withinLast`'s units and a value's text. The filter bar's chips (the Canvas and the
 * Preview's first screen — resolver rows) and the Column filter dialog read this one table, so a
 * chip says what the dialog picked. No React here (the resolver reads it).
 */
import type {
  ViewComparison,
  ViewCondition,
  ViewConditionGroup,
} from "../document/types";
import type { ViewFieldKind } from "../../collections/view/comparison";

export type CatalogFilterUnit = NonNullable<ViewCondition["unit"]>;

export interface CatalogFilterWords {
  /** The bar's name (RAC `Toolbar` `aria-label`). */
  readonly name: string;
  readonly empty: string;
  readonly yes: string;
  readonly no: string;
  /** A chip of a group of conditions (its count). */
  readonly group: (count: number) => string;
  /** A switched-off condition's name suffix. */
  readonly off: string;
  /** A chip's value before one is entered (its value button opens the editor). */
  readonly unset: string;
  readonly units: Readonly<Record<CatalogFilterUnit, string>>;
  /** Phase 5 — a relative date's name (`@today` … — `filterRelativeDates.ts`); `catalogFilterWords`. */
  readonly dates?: (name: string) => string | undefined;
  /** A number in the locale's digits (`Intl.NumberFormat`); `catalogFilterWords`. */
  readonly number?: (value: number) => string;
  /** A date field's ISO value as the locale writes it (`Intl.DateTimeFormat`); `catalogFilterWords`. */
  readonly dateText?: (iso: string) => string | undefined;
  readonly ops: Readonly<Record<ViewComparison, string>>;
}

export const CATALOG_FILTER_WORDS: Readonly<
  Record<string, CatalogFilterWords>
> = {
  en: {
    name: "Filters",
    empty: "(Empty)",
    yes: "True",
    no: "False",
    group: (count) =>
      `Group (${count} ${count === 1 ? "condition" : "conditions"})`,
    off: "off",
    unset: "Enter value…",
    units: { day: "Days", week: "Weeks", month: "Months", year: "Years" },
    ops: {
      equals: "Equals",
      notEquals: "Does not equal",
      contains: "Contains",
      startsWith: "Starts with",
      endsWith: "Ends with",
      notContains: "Does not contain",
      notStartsWith: "Does not start with",
      notEndsWith: "Does not end with",
      oneOf: "Is one of",
      containsAny: "Contains any of",
      containsAll: "Contains all of",
      gte: "At least",
      gt: "More than",
      lte: "At most",
      lt: "Less than",
      between: "Between",
      before: "Before",
      after: "After",
      withinLast: "Within the last",
      exists: "Has a value",
      notExists: "Has no value",
    },
  },
  ko: {
    name: "필터",
    empty: "(비어 있음)",
    yes: "참",
    no: "거짓",
    group: (count) => `묶음 (조건 ${count})`,
    off: "꺼짐",
    unset: "값 입력…",
    units: { day: "일", week: "주", month: "개월", year: "년" },
    ops: {
      equals: "같음",
      notEquals: "같지 않음",
      contains: "포함",
      startsWith: "다음으로 시작",
      endsWith: "다음으로 끝남",
      notContains: "포함하지 않음",
      notStartsWith: "다음으로 시작하지 않음",
      notEndsWith: "다음으로 끝나지 않음",
      oneOf: "다음 중 하나",
      containsAny: "하나라도 포함",
      containsAll: "전부 포함",
      gte: "이상",
      gt: "초과",
      lte: "이하",
      lt: "미만",
      between: "사이",
      before: "이전",
      after: "이후",
      withinLast: "최근 기간",
      exists: "값 있음",
      notExists: "값 없음",
    },
  },
};

/** The words in `locale`'s language (English otherwise — S2 intl). */
export const catalogFilterWords = (locale: string): CatalogFilterWords => ({
  ...(CATALOG_FILTER_WORDS[locale.split("-")[0] ?? "en"] ??
    CATALOG_FILTER_WORDS.en!),
  dates: (name) => catalogRelativeDateWord(name, locale),
  number: (value) => new Intl.NumberFormat(locale).format(value),
  dateText: (iso) => catalogFilterDateText(iso, locale),
});

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
/**
 * A date field's value in `locale` (「Nov 5, 2026」 · 「2026. 11. 5.」): a day as that day (no time
 * zone shift), a date-time with its time; anything else is no date.
 */
export function catalogFilterDateText(
  iso: string,
  locale: string,
): string | undefined {
  const day = ISO_DATE.exec(iso);
  if (day)
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(+day[1]!, +day[2]! - 1, +day[3]!)));
  if (!/^\d{4}-\d{2}-\d{2}T/.test(iso)) return undefined;
  const at = new Date(iso);
  return Number.isNaN(at.getTime())
    ? undefined
    : new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(at);
}

/** ADR-320 Phase 5 — a relative date's place before today (`Intl.RelativeTimeFormat`'s words). */
const RELATIVE_DATES: Readonly<
  Record<string, readonly [number, Intl.RelativeTimeFormatUnit]>
> = {
  today: [0, "day"],
  yesterday: [-1, "day"],
  thisWeek: [0, "week"],
  lastWeek: [-1, "week"],
  thisMonth: [0, "month"],
  lastMonth: [-1, "month"],
  thisYear: [0, "year"],
};
/** A relative date's name in a locale (「Today」 · 「이번 주」 — the browser's words, capitalized). */
export function catalogRelativeDateWord(
  name: string,
  locale: string,
): string | undefined {
  const at = RELATIVE_DATES[name];
  if (!at) return undefined;
  const text = new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    ...at,
  );
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

const scalarText = (
  value: unknown,
  words: CatalogFilterWords,
  kind?: ViewFieldKind,
): string =>
  value === null || value === undefined || value === ""
    ? words.empty
    : typeof value === "string" &&
        value.startsWith("@") &&
        words.dates?.(value.slice(1))
      ? words.dates(value.slice(1))!
      : value === true
        ? words.yes
        : value === false
          ? words.no
          : typeof value === "number" && words.number
            ? words.number(value)
            : (kind === "date" &&
                typeof value === "string" &&
                words.dateText?.(value)) ||
              String(value);

/** A condition's value as a chip shows it (none for `exists` · `notExists` and an empty value). */
export function catalogFilterValueText(
  condition: Pick<ViewCondition, "op" | "value" | "unit">,
  words: CatalogFilterWords,
  /** The field's kind — a date field's value is written as a date. */
  kind?: ViewFieldKind,
): string {
  const { op, value } = condition;
  if (op === "exists" || op === "notExists") return "";
  if (value === undefined || value === "") return "";
  if (op === "between" && Array.isArray(value)) {
    const [min, max] = value;
    const end = (at: unknown) =>
      at === undefined || at === "" ? "" : scalarText(at, words, kind);
    return `${end(min)} – ${end(max)}`;
  }
  if (op === "withinLast")
    return `${scalarText(value, words)} ${words.units[condition.unit ?? "day"]}`;
  if (Array.isArray(value))
    return value.map((item) => scalarText(item, words, kind)).join(", ");
  return scalarText(value, words, kind);
}

/** A chip of the filter bar: a root condition, or a group (its conditions counted, nested ones too). */
export interface CatalogFilterChipText {
  readonly id: string;
  readonly field: string;
  readonly comparison: string;
  readonly value: string;
  /** The chip's name (RAC `Group` `aria-label` — 「field comparison value」, + off). */
  readonly label: string;
  readonly enabled: boolean;
}

const countConditions = (group: ViewConditionGroup): number =>
  group.items.reduce(
    (sum, item) => sum + ("items" in item ? countConditions(item) : 1),
    0,
  );

/**
 * The chips of a tree (§5.5): one per root item — a condition its field · comparison · value, a
 * group one chip 「Group (N)」. `fieldLabel` names a condition's field path (its last field's label).
 */
export function catalogFilterChips(
  tree: ViewConditionGroup | undefined,
  fieldLabel: (condition: ViewCondition) => string,
  locale: string,
  /** A condition's field kind (a date field's value is written as a date). */
  fieldKind?: (condition: ViewCondition) => ViewFieldKind | undefined,
): CatalogFilterChipText[] {
  if (!tree) return [];
  const words = catalogFilterWords(locale);
  return tree.items.map((item) => {
    if ("items" in item) {
      const field = words.group(countConditions(item));
      return {
        id: item.id,
        field,
        comparison: "",
        value: "",
        label: field,
        enabled: true,
      };
    }
    const field = fieldLabel(item);
    const comparison = words.ops[item.op];
    const value = catalogFilterValueText(item, words, fieldKind?.(item));
    const enabled = item.enabled !== false;
    return {
      id: item.id,
      field,
      comparison,
      // (A condition without its value yet keeps its value button — it opens the editor; the
      //  chip's name says nothing for it — the condition is skipped.)
      value:
        value ||
        (item.op === "exists" || item.op === "notExists" ? "" : words.unset),
      label: [field, comparison, value, enabled ? "" : words.off]
        .filter(Boolean)
        .join(" "),
      enabled,
    };
  });
}
