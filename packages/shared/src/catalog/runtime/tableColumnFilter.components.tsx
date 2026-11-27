/**
 * ADR-315 Phase 4 증분 4c — a Column's filter dialog (breakdown §5.2 「열 필터」, TanStack column
 * filter + faceting): the comparisons of the Column's field kind the Table takes, the value, and
 * the candidate values of the rows its other slices keep (`session.tables.tableFacet` — the count each
 * would give). 「Apply」 writes the Column's filter, 「Clear」 drops it — both the session's one
 * write (`catalogColumnFilterPatch`). Loads with the first dialog opened (a lazy chunk — HC5).
 *
 * RAC parts as they are (D1): `Dialog` · `Form` · `Select` · `TextField` · `ListBox`; their look is
 * the catalog's generated sheet for those classes (D3).
 */
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { Button } from "react-aria-components/Button";
import { Dialog, Heading } from "react-aria-components/Dialog";
import { Form } from "react-aria-components/Form";
import { useLocale } from "react-aria-components/I18nProvider";
import { Input } from "react-aria-components/Input";
import { Label } from "react-aria-components/Label";
import { ListBox, ListBoxItem } from "react-aria-components/ListBox";
import { Popover } from "react-aria-components/Popover";
import { Select, SelectValue } from "react-aria-components/Select";
import { Text } from "react-aria-components/Text";
import { TextField } from "react-aria-components/TextField";
import type { ViewComparison } from "../document/types";
import type { CatalogColumnFilterAccess } from "./tableOperationsDom.runtime";
import {
  catalogColumnFilterCondition,
  catalogColumnFilterDraft,
  catalogFilterPicksMany,
  catalogFilterValueless,
  type CatalogColumnFilterDraft,
  type CatalogFilterUnit,
} from "./tableColumnFilterDraft";
import { catalogLocalized } from "./localizedStrings";
import { CATALOG_FILTER_WORDS, type CatalogFilterWords } from "./filterWording";
import { catalogLucideGlyph } from "./lucideGlyph";

interface FilterStrings extends CatalogFilterWords {
  readonly title: string;
  readonly condition: string;
  readonly value: string;
  readonly from: string;
  readonly to: string;
  readonly unit: string;
  readonly values: string;
  readonly searchValues: string;
  readonly apply: string;
  readonly clear: string;
  readonly loaded: (rows: number) => string;
  readonly more: (rows: number) => string;
  readonly range: (min: string, max: string) => string;
}

const FILTER_STRINGS: Readonly<Record<string, FilterStrings>> = {
  en: {
    ...CATALOG_FILTER_WORDS.en!,
    title: "Filter",
    condition: "Condition",
    value: "Value",
    from: "From",
    to: "To",
    unit: "Unit",
    values: "Values",
    searchValues: "Search values",
    apply: "Apply",
    clear: "Clear",
    loaded: (rows) => `Values of the ${rows} loaded rows`,
    more: (rows) => `${rows} more — search to narrow`,
    range: (min, max) => `${min} – ${max}`,
  },
  ko: {
    ...CATALOG_FILTER_WORDS.ko!,
    title: "필터",
    condition: "조건",
    value: "값",
    from: "시작",
    to: "끝",
    unit: "단위",
    values: "값 목록",
    searchValues: "값 검색",
    apply: "적용",
    clear: "지우기",
    loaded: (rows) => `불러온 ${rows} 행 기준`,
    more: (rows) => `${rows} 개 더 — 검색으로 좁히기`,
    range: (min, max) => `${min} – ${max}`,
  },
  ja: {
    ...CATALOG_FILTER_WORDS.ja!,
    title: "フィルター",
    condition: "条件",
    value: "値",
    from: "開始",
    to: "終了",
    unit: "単位",
    values: "値の一覧",
    searchValues: "値を検索",
    apply: "適用",
    clear: "クリア",
    loaded: (rows) => `読み込んだ ${rows} 行の値`,
    more: (rows) => `ほか ${rows} 件 — 検索で絞り込み`,
    range: (min, max) => `${min} – ${max}`,
  },
  zh: {
    ...CATALOG_FILTER_WORDS.zh!,
    title: "筛选",
    condition: "条件",
    value: "值",
    from: "从",
    to: "到",
    unit: "单位",
    values: "值列表",
    searchValues: "搜索值",
    apply: "应用",
    clear: "清除",
    loaded: (rows) => `基于已加载的 ${rows} 行`,
    more: (rows) => `还有 ${rows} 个 — 搜索以缩小范围`,
    range: (min, max) => `${min} – ${max}`,
  },
};

/** The candidate values shown at once (a list past it is narrowed by the value search). */
export const CATALOG_FILTER_SHOWN_VALUES = 200;
/** Past this many candidates the list has a search field. */
const SEARCHED_VALUES = 20;

const FIELD_STYLE: CSSProperties = { width: "100%" };
const ROW_STYLE: CSSProperties = { display: "flex", gap: 8, width: "100%" };

const CHEVRON_STYLE: CSSProperties = {
  flexShrink: 0,
  marginInlineStart: "auto",
};

/** The picker's chevron (S2 `Picker` — the catalog Select's glyph). */
function Chevron(): ReactNode {
  return catalogLucideGlyph("chevron-down", {
    className: "react-aria-Icon",
    width: 16,
    height: 16,
    style: CHEVRON_STYLE,
  });
}

/**
 * S2 `Picker` — a Select of the dialog: the catalog Select's trigger look (the generated sheet's
 * `secondary` picker Button — `data-picker`, size M) and list.
 */
function FilterSelect<K extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: K;
  options: readonly { readonly id: K; readonly label: string }[];
  onChange: (value: K) => void;
}): ReactNode {
  return (
    <Select
      selectedKey={value}
      onSelectionChange={(key) => key !== null && onChange(key as K)}
      data-size="M"
      style={FIELD_STYLE}
    >
      <Label>{label}</Label>
      <Button
        data-variant="secondary"
        data-picker="true"
        data-size="M"
        style={{ ...FIELD_STYLE, display: "flex", alignItems: "center" }}
      >
        <SelectValue />
        <Chevron />
      </Button>
      <Popover>
        <ListBox items={options}>
          {(option) => <ListBoxItem id={option.id}>{option.label}</ListBoxItem>}
        </ListBox>
      </Popover>
    </Select>
  );
}

function ValueField({
  label,
  type,
  value,
  onChange,
  autoFocus,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}): ReactNode {
  return (
    <TextField
      value={value}
      onChange={onChange}
      type={type}
      style={FIELD_STYLE}
      {...(autoFocus ? { autoFocus } : {})}
    >
      <Label>{label}</Label>
      <Input style={FIELD_STYLE} />
    </TextField>
  );
}

/** A candidate value with nothing in it (no value · `""`). */
const isEmptyValue = (value: unknown) =>
  value === null || value === undefined || value === "";

/** A candidate's text (the empty one named). */
const candidateText = (value: unknown, strings: FilterStrings): string =>
  isEmptyValue(value) ? strings.empty : String(value);

export default function CatalogColumnFilterDialog({
  access,
  onClose,
}: {
  access: CatalogColumnFilterAccess;
  onClose: () => void;
}): ReactNode {
  const { locale } = useLocale();
  const strings = catalogLocalized(FILTER_STRINGS, locale);
  // (Read once when it opens — the Table's state then.)
  const [view] = useState(() => access.read());
  const [draft, setDraft] = useState<CatalogColumnFilterDraft | undefined>(
    () => view && catalogColumnFilterDraft(view),
  );
  const [search, setSearch] = useState("");
  const facet = view?.facet;
  // (In the values' order — numbers by value, the rest by the locale's; the empty one last.)
  const sorted = useMemo(() => {
    const values =
      view?.kind === "boolean"
        ? [
            { value: true, count: NaN },
            { value: false, count: NaN },
          ]
        : (facet?.values ?? []);
    const collator = new Intl.Collator(locale, { numeric: true });
    return values
      .map((item, index) => ({ ...item, id: String(index) }))
      .sort((a, b) =>
        isEmptyValue(a.value) || isEmptyValue(b.value)
          ? Number(isEmptyValue(a.value)) - Number(isEmptyValue(b.value))
          : typeof a.value === "number" && typeof b.value === "number"
            ? a.value - b.value
            : collator.compare(String(a.value), String(b.value)),
      );
  }, [view?.kind, facet, locale]);
  const candidates = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase(locale);
    return needle
      ? sorted.filter((item) =>
          candidateText(item.value, strings)
            .toLocaleLowerCase(locale)
            .includes(needle),
        )
      : sorted;
  }, [sorted, search, locale, strings]);
  if (!view || !draft) return null;
  const set = (patch: Partial<CatalogColumnFilterDraft>) =>
    setDraft({ ...draft, ...patch });
  const { op } = draft;
  const many = catalogFilterPicksMany(op);
  const inputType =
    view.kind === "number" || op === "withinLast"
      ? "number"
      : view.kind === "date"
        ? "date"
        : "text";
  // (A list of candidates: the many-value comparisons pick from it; `equals` · `notEquals` fill the
  //  value from it — a boolean's two values are the list.)
  const listed =
    many || ((op === "equals" || op === "notEquals") && candidates.length > 0);
  const shown = candidates.slice(0, CATALOG_FILTER_SHOWN_VALUES);
  const selectedKeys = shown
    .filter((item) =>
      many
        ? draft.picked.some((picked) => Object.is(picked, item.value))
        : draft.text !== "" && String(item.value) === draft.text,
    )
    .map((item) => item.id);
  const range =
    facet && facet.min !== undefined && facet.max !== undefined
      ? strings.range(String(facet.min), String(facet.max))
      : undefined;
  return (
    <Dialog
      aria-label={strings.title}
      style={{ padding: 16, width: 280, maxWidth: "100%" }}
    >
      <Form
        onSubmit={(event) => {
          event.preventDefault();
          access.write(catalogColumnFilterCondition(view.kind, draft));
          onClose();
        }}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <Heading slot="title" style={{ margin: 0, fontSize: "1em" }}>
          {strings.title}
        </Heading>
        <FilterSelect
          label={strings.condition}
          value={op}
          options={view.ops.map((id) => ({ id, label: strings.ops[id] }))}
          onChange={(next) => set({ op: next })}
        />
        {catalogFilterValueless(op) ||
        many ||
        view.kind === "boolean" ? null : op === "between" ? (
          <div style={ROW_STYLE}>
            <ValueField
              label={strings.from}
              type={inputType}
              value={draft.text}
              onChange={(text) => set({ text })}
              autoFocus
            />
            <ValueField
              label={strings.to}
              type={inputType}
              value={draft.to}
              onChange={(to) => set({ to })}
            />
          </div>
        ) : op === "withinLast" ? (
          <div style={ROW_STYLE}>
            <ValueField
              label={strings.value}
              type="number"
              value={draft.text}
              onChange={(text) => set({ text })}
              autoFocus
            />
            <FilterSelect
              label={strings.unit}
              value={draft.unit}
              options={(["day", "week", "month", "year"] as const).map(
                (id) => ({ id, label: strings.units[id] }),
              )}
              onChange={(unit) => set({ unit })}
            />
          </div>
        ) : (
          <ValueField
            label={strings.value}
            type={inputType}
            value={draft.text}
            onChange={(text) => set({ text })}
            autoFocus
          />
        )}
        {range && (view.kind === "number" || view.kind === "date") ? (
          <Text slot="description" style={{ fontSize: "0.85em" }}>
            {range}
          </Text>
        ) : null}
        {listed ? (
          <>
            {(facet?.values.length ?? 0) > SEARCHED_VALUES ? (
              <ValueField
                label={strings.searchValues}
                type="search"
                value={search}
                onChange={setSearch}
              />
            ) : null}
            <ListBox
              aria-label={strings.values}
              items={shown}
              selectionMode={many ? "multiple" : "single"}
              selectedKeys={selectedKeys}
              onSelectionChange={(keys) => {
                const ids =
                  keys === "all" ? shown.map((item) => item.id) : [...keys];
                const values = shown
                  .filter((item) => ids.includes(item.id))
                  .map((item) => item.value);
                if (many) {
                  // (Picks outside the shown candidates — narrowed by the search — stay.)
                  const hidden = draft.picked.filter(
                    (picked) =>
                      !shown.some((item) => Object.is(item.value, picked)),
                  );
                  set({ picked: [...hidden, ...values] });
                } else set({ text: values.length ? String(values[0]) : "" });
              }}
              style={{ maxHeight: 200, overflow: "auto", width: "100%" }}
            >
              {(item) => (
                <ListBoxItem
                  id={item.id}
                  textValue={candidateText(item.value, strings)}
                >
                  {/* (RAC's label · description slots: the value names the option, its row
                       count describes it — not one run-together name.) */}
                  <Text slot="label">
                    {view.kind === "boolean"
                      ? item.value
                        ? strings.yes
                        : strings.no
                      : candidateText(item.value, strings)}
                  </Text>
                  {Number.isFinite(item.count) ? (
                    <Text slot="description">{item.count}</Text>
                  ) : null}
                </ListBoxItem>
              )}
            </ListBox>
            {candidates.length > shown.length ? (
              <Text slot="description" style={{ fontSize: "0.85em" }}>
                {strings.more(candidates.length - shown.length)}
              </Text>
            ) : null}
            {facet?.partial ? (
              <Text slot="description" style={{ fontSize: "0.85em" }}>
                {strings.loaded(facet.loaded)}
              </Text>
            ) : null}
          </>
        ) : null}
        <div style={{ ...ROW_STYLE, justifyContent: "flex-end" }}>
          <Button
            data-variant="secondary"
            data-fill-style="outline"
            onPress={() => {
              access.write(undefined);
              onClose();
            }}
          >
            {strings.clear}
          </Button>
          <Button type="submit" data-variant="accent">
            {strings.apply}
          </Button>
        </div>
      </Form>
    </Dialog>
  );
}
