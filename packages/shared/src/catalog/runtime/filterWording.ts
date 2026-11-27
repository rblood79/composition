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
    group: (count) => `Group (${count} conditions)`,
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
      startsWith: "으로 시작",
      endsWith: "으로 끝남",
      notContains: "포함하지 않음",
      notStartsWith: "으로 시작하지 않음",
      notEndsWith: "으로 끝나지 않음",
      oneOf: "그 중 하나",
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
  ja: {
    name: "フィルター",
    empty: "(空)",
    yes: "真",
    no: "偽",
    group: (count) => `グループ (条件 ${count})`,
    off: "オフ",
    unset: "値を入力…",
    units: { day: "日", week: "週", month: "か月", year: "年" },
    ops: {
      equals: "等しい",
      notEquals: "等しくない",
      contains: "含む",
      startsWith: "で始まる",
      endsWith: "で終わる",
      notContains: "含まない",
      notStartsWith: "で始まらない",
      notEndsWith: "で終わらない",
      oneOf: "いずれか",
      containsAny: "いずれかを含む",
      containsAll: "すべてを含む",
      gte: "以上",
      gt: "より大きい",
      lte: "以下",
      lt: "未満",
      between: "範囲内",
      before: "より前",
      after: "より後",
      withinLast: "直近",
      exists: "値あり",
      notExists: "値なし",
    },
  },
  zh: {
    name: "筛选",
    empty: "(空)",
    yes: "真",
    no: "假",
    group: (count) => `分组 (${count} 个条件)`,
    off: "关闭",
    unset: "输入值…",
    units: { day: "天", week: "周", month: "个月", year: "年" },
    ops: {
      equals: "等于",
      notEquals: "不等于",
      contains: "包含",
      startsWith: "开头是",
      endsWith: "结尾是",
      notContains: "不包含",
      notStartsWith: "开头不是",
      notEndsWith: "结尾不是",
      oneOf: "属于其中之一",
      containsAny: "包含任意",
      containsAll: "包含全部",
      gte: "至少",
      gt: "大于",
      lte: "至多",
      lt: "小于",
      between: "介于",
      before: "早于",
      after: "晚于",
      withinLast: "最近",
      exists: "有值",
      notExists: "无值",
    },
  },
};

/** The words in `locale`'s language (English otherwise — S2 intl). */
export const catalogFilterWords = (locale: string): CatalogFilterWords =>
  CATALOG_FILTER_WORDS[locale.split("-")[0] ?? "en"] ??
  CATALOG_FILTER_WORDS.en!;

const scalarText = (value: unknown, words: CatalogFilterWords): string =>
  value === null || value === undefined || value === ""
    ? words.empty
    : value === true
      ? words.yes
      : value === false
        ? words.no
        : String(value);

/** A condition's value as a chip shows it (none for `exists` · `notExists` and an empty value). */
export function catalogFilterValueText(
  condition: Pick<ViewCondition, "op" | "value" | "unit">,
  words: CatalogFilterWords,
): string {
  const { op, value } = condition;
  if (op === "exists" || op === "notExists") return "";
  if (value === undefined || value === "") return "";
  if (op === "between" && Array.isArray(value)) {
    const [min, max] = value;
    return `${min === undefined || min === "" ? "" : String(min)} – ${max === undefined || max === "" ? "" : String(max)}`;
  }
  if (op === "withinLast")
    return `${String(value)} ${words.units[condition.unit ?? "day"]}`;
  if (Array.isArray(value))
    return value.map((item) => scalarText(item, words)).join(", ");
  return scalarText(value, words);
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
    const value = catalogFilterValueText(item, words);
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
