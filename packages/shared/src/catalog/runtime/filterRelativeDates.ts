/**
 * ADR-320 Phase 5 (사용자 결정 7) — relative dates: a closed list of tokens a date condition's value
 * may be (`@today` · `@yesterday` · `@thisWeek` · `@lastWeek` · `@thisMonth` · `@lastMonth` ·
 * `@thisYear`). No new comparison (HC5): the tree keeps the token (a start, a named set, the address
 * and the memory stay 「this week」 as days pass), and the one place a tree becomes the rows' view
 * conditions (`catalogRowSlicesView` — the local run and the request read its result) puts the days
 * in: a token is a range of days (`[from, to]`, a day = `[day, day]`), the comparison reads it —
 * `equals` = within the range (`between`), `notEquals` = outside it (`before` from `or` `after` to),
 * `before` = before its first day, `after` = after its last day, `between` = its low token's first
 * day to its high token's last day. The scope's judgment reads the same result (§5.3 — what is sent
 * is what is judged).
 *
 * The day is the viewer's (the browser's local date — 「today」 at 08:00 in Seoul is that day, not
 * UTC's), and the week starts as the site's locale says (`Intl.Locale` week info — 사용자 결정 7).
 */
import type {
  DataFieldPath,
  ViewCondition,
  ViewConditionGroup,
} from "../document/types";

export const CATALOG_RELATIVE_DATES = [
  "today",
  "yesterday",
  "thisWeek",
  "lastWeek",
  "thisMonth",
  "lastMonth",
  "thisYear",
] as const;
export type CatalogRelativeDate = (typeof CATALOG_RELATIVE_DATES)[number];

/** The comparisons a token stands in (the value editor offers tokens for these). */
export const CATALOG_RELATIVE_DATE_OPS: readonly ViewCondition["op"][] = [
  "equals",
  "notEquals",
  "before",
  "after",
  "between",
];

/** A token's stored value. */
export const catalogRelativeDateToken = (name: CatalogRelativeDate): string =>
  `@${name}`;

/** The token a value is (`undefined` = a literal). */
export function catalogRelativeDateOf(
  value: unknown,
): CatalogRelativeDate | undefined {
  if (typeof value !== "string" || !value.startsWith("@")) return undefined;
  const name = value.slice(1);
  return (CATALOG_RELATIVE_DATES as readonly string[]).includes(name)
    ? (name as CatalogRelativeDate)
    : undefined;
}

/** Whether a condition's value names a token (its value, or an end of `between`). */
export const catalogConditionHasRelativeDate = (condition: ViewCondition) =>
  Array.isArray(condition.value)
    ? condition.value.some((end) => !!catalogRelativeDateOf(end))
    : !!catalogRelativeDateOf(condition.value);

/** The viewer's day now (`YYYY-MM-DD`, the browser's local date). */
export function catalogLocalToday(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Regions whose week starts on Sunday (CLDR `firstDay` = sun) — where `Intl.Locale` has no week info. */
const SUNDAY_REGIONS = new Set([
  "US",
  "CA",
  "MX",
  "BR",
  "JP",
  "KR",
  "TW",
  "HK",
  "IL",
  "IN",
  "PH",
]);
/** Regions a language alone points to (`ko` → KR) when the locale names none. */
const LANGUAGE_REGIONS: Record<string, string> = {
  en: "US",
  ko: "KR",
  ja: "JP",
  pt: "BR",
  he: "IL",
};

/** The first day of the week in a locale (0 = Sunday … 6 = Saturday; default Monday). */
export function catalogWeekStart(locale: string | undefined): number {
  if (!locale) return 1;
  try {
    const intl = new Intl.Locale(locale) as Intl.Locale & {
      weekInfo?: { firstDay: number };
      getWeekInfo?: () => { firstDay: number };
    };
    const info = intl.getWeekInfo?.() ?? intl.weekInfo;
    if (info?.firstDay) return info.firstDay % 7;
    const region = intl.region ?? LANGUAGE_REGIONS[intl.language.toLowerCase()];
    return region && SUNDAY_REGIONS.has(region) ? 0 : 1;
  } catch {
    return 1;
  }
}

const dayOf = (text: string) => new Date(`${text}T00:00:00Z`);
const textOf = (date: Date) => date.toISOString().slice(0, 10);
const plusDays = (text: string, days: number) => {
  const date = dayOf(text);
  date.setUTCDate(date.getUTCDate() + days);
  return textOf(date);
};

/** A token's days `[from, to]` (both included) on `today` (`YYYY-MM-DD`). */
export function catalogRelativeDateRange(
  name: CatalogRelativeDate,
  today: string,
  locale?: string,
): [string, string] {
  const date = dayOf(today);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  switch (name) {
    case "today":
      return [today, today];
    case "yesterday": {
      const day = plusDays(today, -1);
      return [day, day];
    }
    case "thisWeek":
    case "lastWeek": {
      const back = (date.getUTCDay() - catalogWeekStart(locale) + 7) % 7;
      const start = plusDays(today, -back - (name === "lastWeek" ? 7 : 0));
      return [start, plusDays(start, 6)];
    }
    case "thisMonth":
    case "lastMonth": {
      const at = name === "thisMonth" ? month : month - 1;
      return [
        textOf(new Date(Date.UTC(year, at, 1))),
        textOf(new Date(Date.UTC(year, at + 1, 0))),
      ];
    }
    case "thisYear":
      return [`${year}-01-01`, `${year}-12-31`];
  }
}

export interface CatalogRelativeDateClock {
  /** The day the tokens are read on (default: the viewer's today). */
  readonly today?: string;
  /** The site's locale (the week's first day). */
  readonly locale?: string;
  /** Whether a field path reads a date (a token on another kind stays a literal). */
  readonly isDate?: (path: DataFieldPath) => boolean;
}

/** A condition with its tokens as days (the same id; `notEquals` of a range = an `or` of two). */
function resolvedCondition(
  condition: ViewCondition,
  today: string,
  clock: CatalogRelativeDateClock,
): ViewCondition | ViewConditionGroup {
  if (!catalogConditionHasRelativeDate(condition)) return condition;
  if (clock.isDate && !condition.fields.every((path) => clock.isDate!(path)))
    return condition;
  const range = (value: unknown): [string, string] | undefined => {
    const name = catalogRelativeDateOf(value);
    return name
      ? catalogRelativeDateRange(name, today, clock.locale)
      : undefined;
  };
  const { op } = condition;
  if (op === "between" && Array.isArray(condition.value)) {
    const [low, high] = condition.value;
    return {
      ...condition,
      value: [range(low)?.[0] ?? low ?? "", range(high)?.[1] ?? high ?? ""],
    };
  }
  const days = range(condition.value);
  if (!days) return condition;
  const [from, to] = days;
  switch (op) {
    case "equals":
      return { ...condition, op: "between", value: [from, to] };
    case "notEquals":
      return from === to
        ? { ...condition, value: from }
        : {
            id: condition.id,
            op: "or",
            items: [
              {
                ...condition,
                id: `${condition.id}~before`,
                op: "before",
                value: from,
              },
              {
                ...condition,
                id: `${condition.id}~after`,
                op: "after",
                value: to,
              },
            ],
          };
    case "before":
      return { ...condition, value: from };
    case "after":
      return { ...condition, value: to };
    default:
      return condition;
  }
}

/** Root items with their tokens as days (items without a token: the same objects). */
export function catalogFilterItemsResolved(
  items: readonly (ViewCondition | ViewConditionGroup)[],
  clock: CatalogRelativeDateClock = {},
): (ViewCondition | ViewConditionGroup)[] {
  const today = clock.today ?? catalogLocalToday();
  const walk = (
    item: ViewCondition | ViewConditionGroup,
  ): ViewCondition | ViewConditionGroup => {
    if (!("items" in item)) return resolvedCondition(item, today, clock);
    const inner = item.items.map(walk);
    return inner.every((at, i) => at === item.items[i])
      ? item
      : { ...item, items: inner };
  };
  return items.map(walk);
}
