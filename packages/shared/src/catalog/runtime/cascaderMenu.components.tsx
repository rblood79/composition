import {
  createContext,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { Provider } from "react-aria-components";
import { Autocomplete } from "react-aria-components/Autocomplete";
import { ButtonContext } from "react-aria-components/Button";
import { FieldErrorContext } from "react-aria-components/FieldError";
import { useLocale } from "react-aria-components/I18nProvider";
import { LabelContext } from "react-aria-components/Label";
import { Menu, MenuItem, SubmenuTrigger } from "react-aria-components/Menu";
import { Popover } from "react-aria-components/Popover";
import { SearchFieldContext } from "react-aria-components/SearchField";
import { Text, TextContext } from "react-aria-components/Text";
import { Icon } from "../../components/Icon";
import type { CascaderEntry } from "./cascader";
import type { CascaderOpenValue } from "./cascader.components";
import type { CatalogConsumerNode } from "./compositionRoot";
import {
  cascaderSearch,
  CASCADER_SEARCH_LIMIT,
  CASCADER_SEARCH_STRINGS,
} from "./cascaderSearch.components";
import {
  cascaderPicked,
  CASCADER_LEVEL_ITEM,
  CASCADER_LEVEL_STATUS,
  useCascaderLevelName,
  useCascaderLevelStatus,
  useCascaderLevels,
} from "./cascaderOpen";
import { catalogLocalized } from "./localizedStrings";

/**
 * ADR-326 Phase 2 — a Cascader's open content in the `columns` mode, drawn from its nodes (breakdown
 * §4.3): the field gives RAC `MenuTrigger`'s contexts always (`cascader.components.tsx`), the
 * `Popover` node opens with them (`trigger: "Cascader"`), and this chunk — loaded with the first open —
 * gives two parts:
 *
 * - `CascaderOpenScope` wraps the Popover node's children: RAC `Autocomplete` over the SearchField
 *   node and the list box node (the input keeps focus, the list takes virtual focus — Phase 0 P2).
 *   The query lives here (the Popover draws its children only while open — a reopened field starts
 *   with an empty search, Phase 0 m1). The field's contexts for its own parts (the trigger's Button,
 *   its Label · help text · error) stop here.
 * - `CascaderListBody` is the `CascaderList` node: RAC `Menu` (the node's element — its catalog id,
 *   `react-aria-CascaderList`); an item with child items is a RAC `SubmenuTrigger` (its `MenuItem` +
 *   `Popover` > `Menu` of the next level — → · ← move between levels, RAC's). With a query the node
 *   is the results `Menu` instead (ADR-322 Phase 5).
 *
 * A row is a RAC `MenuItem` that takes its item record's DOM input (`row` — the catalog id, the
 * written style, `react-aria-CascaderItem`) and draws the record's own parts (`parts` — the label
 * Text, the chevron Icon of a branch). Items are known by their path id (RAC ids are unique —
 * ADR-322 §4.2); an item that cannot be picked (a repeated key — Decision 4 · disabled) is in
 * `disabledKeys`. Every level Menu takes `escapeKeyBehavior: "none"` (Phase 0 — RAC's default spends
 * Esc on clearing a selection the menu holds: a picked first-level leaf kept the menu open).
 */

/** A row's DOM input, by its item record (none for the rows the field adds — 「전체」 · status). */
export type CascaderRowProps = (
  recordId: string | undefined,
) => Record<string, unknown>;

/** An item record's own parts (its label Text · chevron Icon), drawn by the catalog renderer. */
export type CascaderRowParts = (
  recordId: string,
  options: { readonly chevron: boolean },
) => ReactNode[];

/** The records a row reads (the catalog renderer's lookups — `delegatedDom.runtime.ts`). */
export interface CascaderRowRecords {
  readonly get: (id: string) => CatalogConsumerNode | undefined;
  readonly typeOf: (node: CatalogConsumerNode) => string;
  /** A record drawn by the catalog renderer (an item's own parts). */
  readonly renderChild: (id: string) => ReactElement;
  /** What the document wrote on a record (the row is RAC's — the DOM pass never sees it). */
  readonly writtenStyleOf?: (id: string) => CSSProperties;
  /** A record's state values (hover · pressed …) — the row is RAC's, the DOM pass never marks it. */
  readonly stateStyleOf?: (id: string) =>
    | {
        readonly attributes: Record<string, unknown>;
        readonly variables: Record<string, string>;
      }
    | undefined;
}

export interface CascaderListBodyProps {
  /** The field's open values (`cascader.components.tsx` — given as a prop, see its note). */
  readonly open: CascaderOpenValue;
  /** The list box node's element props (its catalog id · class · `data-size` · style). */
  readonly base: Record<string, unknown>;
  readonly records: CascaderRowRecords;
}

/** A row's DOM input and its record's parts (built here — the first screen carries none of it). */
function rowInputs(
  base: Record<string, unknown>,
  {
    get,
    typeOf,
    renderChild: render,
    writtenStyleOf,
    stateStyleOf,
  }: CascaderRowRecords,
): { readonly row: CascaderRowProps; readonly parts: CascaderRowParts } {
  const size = base["data-size"];
  const rowOf = (recordId: string) => {
    const state = stateStyleOf?.(recordId);
    return {
      ...state?.attributes,
      "data-catalog-id": recordId,
      style: { ...writtenStyleOf?.(recordId), ...state?.variables },
    };
  };
  return {
    row: (recordId) => ({
      className: "react-aria-CascaderItem",
      "data-size": size,
      ...(recordId && rowOf(recordId)),
    }),
    // (Its parts but its next level's items; a leaf's chevron is not drawn.)
    parts: (recordId, { chevron }) =>
      (get(recordId)?.children ?? []).flatMap((id) => {
        const child = get(id);
        if (!child || typeOf(child) === "CascaderItem") return [];
        if (
          !chevron &&
          typeOf(child) === "Icon" &&
          child.props.slot === "descriptor"
        )
          return [];
        return [render(id)];
      }),
  };
}

type LevelProps = Omit<CascaderListBodyProps, "records"> & {
  readonly row: CascaderRowProps;
  readonly parts: CascaderRowParts;
};

/** The search query of an open field (its search scope's — both parts are this chunk's). */
const CascaderQueryContext = createContext("");

/** The Popover node's children inside the search scope (see the file note). */
export function CascaderOpenScope({
  children,
}: {
  readonly children: ReactNode;
}): ReactElement {
  const [query, setQuery] = useState("");
  const { locale } = useLocale();
  const strings = catalogLocalized(CASCADER_SEARCH_STRINGS, locale);
  return (
    <Provider
      values={[
        [ButtonContext, null],
        [LabelContext, null],
        [TextContext, null],
        [FieldErrorContext, null],
        // (The SearchField node has no visible label: its name is the i18n 「검색」 — ADR-322 Phase 5.)
        [SearchFieldContext, { "aria-label": strings.search, autoFocus: true }],
        [CascaderQueryContext, query],
      ]}
    >
      <Autocomplete inputValue={query} onInputChange={setQuery}>
        {children}
      </Autocomplete>
    </Provider>
  );
}

/**
 * A submenu's level, built when its popover renders — not for every branch at the first open; a
 * level loaded one by one is asked then (ADR-322 Phase 6).
 */
function Deferred({
  render,
  onShow,
}: {
  readonly render: () => ReactElement;
  readonly onShow?: () => void;
}) {
  useEffect(() => {
    onShow?.();
    // (Once per shown submenu.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return render();
}

/** A row the field adds (「<branch> 전체」 · a level's status): the item's class, no record. */
function addedRow(
  row: CascaderRowProps,
  id: string,
  text: string,
  extra: Record<string, unknown> = {},
): ReactElement {
  return (
    <MenuItem {...row(undefined)} {...extra} key={id} id={id} textValue={text}>
      <Text slot="label">{text}</Text>
    </MenuItem>
  );
}

/** An item's row: its record's parts, else (no record) its name and a branch's chevron. */
function itemContent(
  entry: CascaderEntry,
  parts: CascaderRowParts,
  chevron: boolean,
): ReactNode {
  if (entry.recordId) return parts(entry.recordId, { chevron });
  return (
    <>
      <Text slot="label">{entry.name}</Text>
      {chevron ? <Icon iconName="chevron-right" slot="descriptor" /> : null}
    </>
  );
}

function Levels({ open, base, row, parts }: LevelProps) {
  const { table, keys, multiple, label, onPick, levels } = open;
  const picked = cascaderPicked(table, keys);
  const levelName = useCascaderLevelName();
  const status = useCascaderLevelStatus();
  useCascaderLevels(levels);
  const childrenOf = (parent: string | null) =>
    table.byParent.get(parent) ?? [];
  // (ADR-322 Phase 6 — a branch whose level is not here yet: its submenu asks it and shows one
  //  status item.)
  const waits = (entry: CascaderEntry) =>
    !!levels && entry.hasChildren && !childrenOf(entry.pathId).length;
  const blocked = table.entries
    .filter((entry) => entry.duplicate || entry.isDisabled)
    .map((entry) => entry.pathId);
  // (A submenu's Menu is RAC's own — the Menu sheet's SubmenuTrigger block gives it the inset and
  //  no edge; its Popover takes the node's size.)
  const level = (parent: CascaderEntry | null): ReactElement => {
    const here = parent?.pathId ?? null;
    const own = parent?.pickable
      ? `${parent.pathId}${CASCADER_LEVEL_ITEM}`
      : undefined;
    const statusId = parent ? `${parent.pathId}${CASCADER_LEVEL_STATUS}` : "";
    const failed = !!parent && levels?.stateOf(parent.levelKey) === "error";
    return (
      <Menu
        {...(parent ? {} : base)}
        aria-label={parent ? parent.name : label}
        escapeKeyBehavior="none"
        selectionMode={multiple ? "multiple" : "single"}
        selectedKeys={[
          ...picked
            .filter(
              (entry) => entry.parentPathId === here && !entry.hasChildren,
            )
            .map((entry) => entry.pathId),
          ...(own && parent && picked.includes(parent) ? [own] : []),
        ]}
        disabledKeys={[
          ...blocked,
          ...(own && parent && (parent.duplicate || parent.isDisabled)
            ? [own]
            : []),
          ...(parent && waits(parent) && !failed ? [statusId] : []),
        ]}
        onAction={(key) => {
          const id = String(key);
          if (id.endsWith(CASCADER_LEVEL_STATUS)) {
            if (parent) levels?.load(parent.levelKey);
            return;
          }
          const entry = table.byPathId.get(
            id.endsWith(CASCADER_LEVEL_ITEM)
              ? id.slice(0, -CASCADER_LEVEL_ITEM.length)
              : id,
          );
          if (entry && (id.endsWith(CASCADER_LEVEL_ITEM) || !entry.hasChildren))
            onPick(entry.key);
        }}
      >
        {[
          ...(own && parent
            ? [addedRow(row, own, levelName(parent.name))]
            : []),
          ...(parent && waits(parent)
            ? [
                addedRow(
                  row,
                  statusId,
                  failed ? status.retry : status.loading,
                  // (「Retry」 asks again in place — the menu stays open.)
                  { shouldCloseOnSelect: false },
                ),
              ]
            : []),
          ...childrenOf(here).map((entry) =>
            entry.hasChildren ? (
              <SubmenuTrigger key={entry.pathId}>
                <MenuItem
                  {...row(entry.recordId)}
                  id={entry.pathId}
                  textValue={entry.name}
                >
                  {itemContent(entry, parts, true)}
                </MenuItem>
                {/* (The Menu sheet's SubmenuTrigger block takes a sized Popover — one edge, its
                    width the level's.) */}
                <Popover
                  placement="end top"
                  data-size={base["data-size"] as string | undefined}
                >
                  <Deferred
                    render={() => level(entry)}
                    onShow={
                      waits(entry)
                        ? () => levels?.load(entry.levelKey)
                        : undefined
                    }
                  />
                </Popover>
              </SubmenuTrigger>
            ) : (
              <MenuItem
                {...row(entry.recordId)}
                key={entry.pathId}
                id={entry.pathId}
                textValue={entry.name}
              >
                {itemContent(entry, parts, false)}
              </MenuItem>
            ),
          ),
        ]}
      </Menu>
    );
  };
  return level(null);
}

/** With a query: the pickable items whose name holds it, each with its path (ADR-322 Phase 5). */
function Results({
  open,
  query,
  base,
  row,
  parts,
}: LevelProps & { readonly query: string }) {
  const { table, keys, multiple, onPick, separator, levels } = open;
  const { locale } = useLocale();
  const strings = catalogLocalized(CASCADER_SEARCH_STRINGS, locale);
  const found = cascaderSearch(table, query, locale);
  const shown = found.slice(0, CASCADER_SEARCH_LIMIT);
  const picked = cascaderPicked(table, keys).map((entry) => entry.pathId);
  return (
    <>
      <Menu
        {...base}
        aria-label={strings.search}
        escapeKeyBehavior="none"
        selectionMode={multiple ? "multiple" : "single"}
        selectedKeys={picked}
        disabledKeys={shown
          .filter((entry) => entry.duplicate || entry.isDisabled)
          .map((entry) => entry.pathId)}
        renderEmptyState={() => strings.empty}
        onAction={(key) => {
          const entry = table.byPathId.get(String(key));
          if (entry) onPick(entry.key);
        }}
      >
        {shown.map((entry) => (
          <MenuItem
            {...row(entry.recordId)}
            key={entry.pathId}
            id={entry.pathId}
            textValue={entry.name}
          >
            {entry.recordId ? (
              parts(entry.recordId, { chevron: false })
            ) : (
              <Text slot="label">{entry.name}</Text>
            )}
            <Text slot="description">{entry.names.join(separator)}</Text>
          </MenuItem>
        ))}
      </Menu>
      {levels ? (
        <Text slot="description" className="cascader-search-more">
          {strings.loadedOnly}
        </Text>
      ) : null}
      {found.length > shown.length ? (
        <Text slot="description" className="cascader-search-more">
          {strings.more(found.length - shown.length)}
        </Text>
      ) : null}
    </>
  );
}

/** The `CascaderList` node's content while its Cascader is open (see the file note). */
export function CascaderListBody({
  records,
  ...props
}: CascaderListBodyProps): ReactElement {
  const query = useContext(CascaderQueryContext);
  const level = { ...props, ...rowInputs(props.base, records) };
  return query ? <Results {...level} query={query} /> : <Levels {...level} />;
}
