import { useState, type ReactElement, type ReactNode } from "react";
import { useLocale } from "react-aria-components/I18nProvider";
import { Autocomplete } from "react-aria-components/Autocomplete";
import { Input } from "react-aria-components/Input";
import { Menu, MenuItem } from "react-aria-components/Menu";
import { SearchField } from "react-aria-components/SearchField";
import { Text } from "react-aria-components/Text";
import { viewCompare } from "../../collections/view/comparison";
import type { CascaderEntry, CascaderTable } from "./cascader";
import type { CascaderContentProps } from "./cascader.components";
import { cascaderPicked } from "./cascaderOpen";
import { catalogLocalized } from "./localizedStrings";

/**
 * ADR-322 Phase 5 — a Cascader's search (breakdown §4.4): with a query, every mode shows one flat
 * list — RAC `Autocomplete` > `SearchField` + `Menu` (Phase 0 P3: the input keeps focus, the list
 * takes virtual focus) of the pickable items whose name holds the query, each with its path. The
 * comparison is the data view's `contains` (one search rule — Hangul read as the collator does).
 * 200 shown, then 「N more — type more」. Without a query the mode's levels show (the caller's).
 */

/** At most this many results (breakdown §4.4). */
export const CASCADER_SEARCH_LIMIT = 200;

const STRINGS: Readonly<
  Record<
    string,
    {
      readonly search: string;
      readonly empty: string;
      readonly more: (count: number) => string;
    }
  >
> = {
  en: {
    search: "Search",
    empty: "No results",
    more: (count) => `${count} more — type more to narrow`,
  },
  ko: {
    search: "검색",
    empty: "결과 없음",
    more: (count) => `${count} 건 더 — 더 입력해 좁히기`,
  },
  ja: {
    search: "検索",
    empty: "結果なし",
    more: (count) => `ほか ${count} 件 — 入力して絞り込む`,
  },
  zh: {
    search: "搜索",
    empty: "无结果",
    more: (count) => `还有 ${count} 项 — 继续输入以缩小范围`,
  },
};

/** The pickable items whose name holds the query, in the table's order. */
export function cascaderSearch(
  table: CascaderTable,
  query: string,
  locale?: string,
): CascaderEntry[] {
  if (!query) return [];
  return table.entries.filter(
    (entry) =>
      entry.pickable &&
      viewCompare("contains", entry.name, query, { kind: "text", locale }),
  );
}

/**
 * The searchable content: the search field, and below it the results (with a query) or `levels`
 * (the mode's own content, given the search's `Autocomplete` — a Menu in it takes virtual focus).
 * `inside` = the levels go in the Autocomplete (`columns`' Menu); else after it (a Tree · GridList
 * keeps its own focus).
 */
export function CascaderSearch({
  content,
  separator,
  inside,
  onPicked,
  levels,
}: {
  readonly content: CascaderContentProps;
  readonly separator: string;
  readonly inside: boolean;
  /** After a pick (single: a Dialog's popover closes — a Menu closes itself). */
  readonly onPicked?: () => void;
  readonly levels: ReactNode;
}): ReactElement {
  const { table, keys, multiple, onPick } = content;
  const { locale } = useLocale();
  const strings = catalogLocalized(STRINGS, locale);
  const [query, setQuery] = useState("");
  const found = cascaderSearch(table, query, locale);
  const shown = found.slice(0, CASCADER_SEARCH_LIMIT);
  const picked = cascaderPicked(table, keys).map((entry) => entry.pathId);
  const results = query ? (
    <Menu
      aria-label={strings.search}
      selectionMode={multiple ? "multiple" : "single"}
      selectedKeys={picked}
      disabledKeys={shown
        .filter((entry) => entry.duplicate || entry.isDisabled)
        .map((entry) => entry.pathId)}
      renderEmptyState={() => strings.empty}
      onAction={(key) => {
        const entry = table.byPathId.get(String(key));
        if (!entry) return;
        onPick(entry.key);
        if (!multiple) onPicked?.();
      }}
    >
      {shown.map((entry) => (
        <MenuItem key={entry.pathId} id={entry.pathId} textValue={entry.name}>
          <Text slot="label">{entry.name}</Text>
          <Text slot="description">{entry.names.join(separator)}</Text>
        </MenuItem>
      ))}
    </Menu>
  ) : null;
  return (
    <>
      <Autocomplete inputValue={query} onInputChange={setQuery}>
        <SearchField aria-label={strings.search} autoFocus>
          <Input placeholder={strings.search} />
        </SearchField>
        {query ? results : inside ? levels : null}
      </Autocomplete>
      {query && found.length > shown.length ? (
        <Text slot="description" className="cascader-search-more">
          {strings.more(found.length - shown.length)}
        </Text>
      ) : null}
      {!query && !inside ? levels : null}
    </>
  );
}
