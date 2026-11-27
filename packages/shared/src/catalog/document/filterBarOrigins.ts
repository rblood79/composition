// ADR-320 Phase 2 — the filter bar's origins (breakdown §5.4): the chip (`component-filterchip` — a
// condition's field text, its comparison · value buttons, its menu and its remove button; the texts
// are the chip's `field` · `comparison` · `value`, its row's once the bar is connected) and the
// palette's FilterBar (the chips' frame — slot 「Conditions」 — and 「Add filter」 · 「Edit conditions」
// · 「Saved filters」 (Phase 5 — while the bar has named sets) · 「Clear」; the last is there while
// `showClear` is on).
import { CATALOG_FILTER_WORDS } from "../runtime/filterWording";
import type { LibraryDefinition, LibraryTemplateNode } from "./types";

/** The palette FilterBar's origin (`filtersOf` stands on its instances only — graph). */
export const FILTER_BAR_ORIGIN_ID = "lib:definition:origin-component-filterbar";
export const FILTER_CHIP_ORIGIN_ID =
  "lib:definition:origin-component-filterchip";
const ACTION_BUTTON = "lib:definition:origin-component-actionbutton";

export const FILTER_BAR_DEFINITIONS: readonly LibraryDefinition[] = [
  {
    id: FILTER_CHIP_ORIGIN_ID,
    name: "FilterChip",
    mode: "composite",
    accepts: {
      field: "string",
      comparison: "string",
      value: "string",
      label: "string",
      // (ADR-320 Phase 3 — the root item the chip shows: its row's key, never authored.)
      conditionId: "string",
    },
    defaults: {
      field: "Field",
      comparison: "Contains",
      value: "Value",
      label: "Field Contains Value",
    },
    visual: {},
    stateRules: {},
    templateRootId: "lib:template:component-filterchip",
  },
  {
    id: FILTER_BAR_ORIGIN_ID,
    name: "FilterBar",
    mode: "composite",
    // (Phase 5 — 「Saved filters」 stands while the bar has named sets: `presentWith` reads the list
    //  as text, `""` for none.)
    accepts: { showClear: "boolean", presets: "filterPresets" },
    defaults: { showClear: true },
    visual: {},
    stateRules: {},
    templateRootId: "lib:template:component-filterbar",
    // (「Clear」 stands while `showClear` is on — `presentWith` reads a text.)
    bindingMaps: {
      filterClearShown: {
        from: "showClear",
        values: { false: "" },
        otherwise: "true",
      },
    },
  },
];

/**
 * The bar's · a chip's button texts by language (the origin's `localizedProps` — the resolver shows
 * the site's language; `filterBarRun.tsx` names its builder · menu with the same words).
 */
export const FILTER_BAR_TEXT = {
  en: {
    add: "Add filter",
    edit: "Edit conditions",
    presets: "Saved filters",
    clear: "Clear",
    conditionMenu: "Condition menu",
    removeCondition: "Remove condition",
    sampleField: "Field",
    sampleValue: "Value",
  },
  ko: {
    add: "필터 추가",
    edit: "조건 편집",
    presets: "저장된 필터",
    clear: "지우기",
    conditionMenu: "조건 메뉴",
    removeCondition: "조건 삭제",
    sampleField: "필드",
    sampleValue: "값",
  },
} as const;
type FilterBarWord = keyof (typeof FILTER_BAR_TEXT)["en"];

/** The sample chip's props in `language` (its field · comparison · value and their name). */
function sampleChip(language: string) {
  const words =
    FILTER_BAR_TEXT[language as keyof typeof FILTER_BAR_TEXT] ??
    FILTER_BAR_TEXT.en;
  const comparison = (
    CATALOG_FILTER_WORDS[language] ?? CATALOG_FILTER_WORDS.en!
  ).ops.contains;
  return {
    field: words.sampleField,
    comparison,
    value: words.sampleValue,
    label: `${words.sampleField} ${comparison} ${words.sampleValue}`,
  };
}

/**
 * A new saved filter's name by language (the Builder's 「+」 writes it into the page — the site's
 * language, not the Builder's).
 */
export const FILTER_PRESET_NAME: Readonly<Record<string, (n: number) => string>> =
  {
    en: (n) => `Saved filter ${n}`,
    ko: (n) => `저장된 필터 ${n}`,
  };

/** A prop's text in every language but English (the template's `props` holds the English). */
const localized = (word: FilterBarWord): Record<string, string> =>
  Object.fromEntries(
    Object.entries(FILTER_BAR_TEXT)
      .filter(([language]) => language !== "en")
      .map(([language, words]) => [language, words[word]]),
  );

const button = (
  id: string,
  props: Record<string, string | boolean>,
  extra: Partial<LibraryTemplateNode> = {},
  /** The props whose literal text follows the site's language. */
  words: Readonly<Record<string, FilterBarWord>> = {},
): LibraryTemplateNode => ({
  id: `lib:template:${id}`,
  definitionId: ACTION_BUTTON,
  children: [],
  props: {
    isQuiet: true,
    ...props,
    ...Object.fromEntries(
      Object.entries(words).map(([key, word]) => [
        key,
        FILTER_BAR_TEXT.en[word],
      ]),
    ),
  },
  ...(Object.keys(words).length
    ? {
        localizedProps: Object.fromEntries(
          Object.entries(words).map(([key, word]) => [key, localized(word)]),
        ),
      }
    : {}),
  visual: {},
  ...extra,
});

export const FILTER_BAR_TEMPLATES: readonly LibraryTemplateNode[] = [
  {
    id: "lib:template:component-filterchip",
    definitionId: "lib:definition:type-FilterChip",
    children: [
      "lib:template:component-filterchip__field",
      "lib:template:component-filterchip__comparison",
      "lib:template:component-filterchip__value",
      "lib:template:component-filterchip__menu",
      "lib:template:component-filterchip__remove",
    ],
    props: { label: "{label}", conditionId: "{conditionId}" },
    visual: {},
  },
  {
    id: "lib:template:component-filterchip__field",
    definitionId: "lib:definition:text",
    children: [],
    props: { children: "{field}" },
    // (The field text's room before the quiet buttons — the chip's own padding is the buttons'.)
    visual: { paddingLeft: 6, paddingRight: 2 },
  },
  // (A group's chip has no comparison · value; `exists` · `notExists` no value — §5.5.)
  button(
    "component-filterchip__comparison",
    { label: "{comparison}" },
    { presentWith: "comparison" },
  ),
  button(
    "component-filterchip__value",
    { label: "{value}" },
    { presentWith: "value" },
  ),
  button(
    "component-filterchip__menu",
    { label: "", icon: "ellipsis" },
    {},
    { "aria-label": "conditionMenu" },
  ),
  button(
    "component-filterchip__remove",
    { label: "", icon: "x" },
    {},
    { "aria-label": "removeCondition" },
  ),
  {
    id: "lib:template:component-filterbar",
    definitionId: "lib:definition:type-FilterBar",
    children: [
      "lib:template:component-filterbar__chips",
      "lib:template:component-filterbar__add",
      "lib:template:component-filterbar__edit",
      "lib:template:component-filterbar__presets",
      "lib:template:component-filterbar__clear",
    ],
    props: { size: "M", variant: "chips", showClear: "{showClear}" },
    visual: {},
  },
  {
    id: "lib:template:component-filterbar__chips",
    definitionId: "lib:definition:type-frame",
    slot: { name: "Conditions", required: false },
    children: ["lib:template:component-filterbar__chip"],
    props: {},
    visual: {},
    layout: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      rowGap: "8px",
      columnGap: "8px",
    },
  },
  // (The sample chip a bar shows before it filters a list — its words in the site's language: the
  //  comparison is the chips' own `contains` word.)
  {
    id: "lib:template:component-filterbar__chip",
    definitionId: FILTER_CHIP_ORIGIN_ID,
    children: [],
    props: sampleChip("en"),
    localizedProps: Object.fromEntries(
      (["field", "comparison", "value", "label"] as const).map((key) => [
        key,
        Object.fromEntries(
          Object.keys(FILTER_BAR_TEXT)
            .filter((language) => language !== "en")
            .map((language) => [language, sampleChip(language)[key]]),
        ),
      ]),
    ),
    visual: {},
  },
  button("component-filterbar__add", { icon: "plus" }, {}, { label: "add" }),
  button(
    "component-filterbar__edit",
    { icon: "list-filter" },
    {},
    { label: "edit" },
  ),
  // (ADR-320 Phase 5 — 사용자 결정 6: the author's named sets, picked from a menu.)
  button(
    "component-filterbar__presets",
    { icon: "bookmark" },
    { presentWith: "presets" },
    { label: "presets" },
  ),
  button(
    "component-filterbar__clear",
    {},
    { presentWith: "filterClearShown" },
    { label: "clear" },
  ),
];
