import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from "react";
import { DEFAULT_SLOT, Provider } from "react-aria-components";
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
import type {
  CascaderViewValue,
  CascaderOpenValue,
  CascaderRowDraw,
} from "./cascader.components";
import { cascaderOpeningView, cascaderTrail } from "./cascader";
import {
  CascaderInView,
  CascaderDrillBody,
  CascaderTreeBody,
  isolate,
  plainRow,
} from "./cascaderPanel.components";
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
 * ADR-326 — a Cascader's open content, drawn from its nodes (breakdown §4.3): the field gives RAC
 * `MenuTrigger`'s (`columns`) · `DialogTrigger`'s (`tree` · `drill` — and the RAC `Dialog`) contexts
 * always (`cascader.components.tsx`), the `Popover` node opens with them (`trigger: "Cascader"`), and
 * this chunk — loaded with the first open — gives two parts:
 *
 * - `CascaderOpenScope` wraps the Popover node's children: RAC `Autocomplete` over the SearchField
 *   node and the list box node (the input keeps focus, the list takes virtual focus — Phase 0 P2).
 *   The query lives here (the Popover draws its children only while open — a reopened field starts
 *   with an empty search, Phase 0 m1), and a `drill` field's level (its trail · 「Back」 nodes and its
 *   list read it — Phase 3). The field's contexts for its own parts (the trigger's Button, its
 *   Label · help text · error) stop here.
 * - `CascaderListBody` is the `CascaderList` node: `tree` · `drill` — RAC `Tree` · `GridList`
 *   (`cascaderPanel.components.tsx`); `columns` — RAC `Menu` (the node's element — its catalog id,
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

export interface CascaderListBodyProps {
  /** The field's open values (`cascader.components.tsx` — given as a prop, see its note). */
  readonly open: CascaderOpenValue;
  /** The list box node's element props (its catalog id · class · `data-size` · style). */
  readonly base: Record<string, unknown>;
  /** An item record drawn by the catalog renderer (`cascaderitem` — a `CatalogCascaderRow`). */
  readonly renderRow: (recordId: string) => ReactElement;
  /** The scope a row reads its RAC item from (the first screen's context — given as a prop too). */
  readonly Row: ComponentType<{
    readonly value: CascaderRowDraw;
    readonly children: ReactNode;
  }>;
  /** A `tree` · `drill` field's view (the search scope's — `CascaderViewContext`, given as a prop too). */
  readonly view: CascaderViewValue | null;
}

type LevelProps = CascaderListBodyProps;

/**
 * An item's row. With a record: the record drawn by the catalog renderer — its props (catalog id ·
 * written style · state marks · size) and parts — as this list's RAC item. Without: its name.
 */
function itemRow(
  { Row, renderRow, base }: Pick<LevelProps, "Row" | "renderRow" | "base">,
  entry: CascaderEntry,
  chevron: boolean,
  extra?: ReactElement,
): ReactElement {
  if (!entry.recordId)
    return (
      <MenuItem
        {...plainRow(base)}
        key={entry.pathId}
        id={entry.pathId}
        textValue={entry.name}
      >
        <Text slot="label">{entry.name}</Text>
        {chevron ? <Icon iconName="chevron-right" slot="descriptor" /> : null}
        {extra}
      </MenuItem>
    );
  return (
    <Row
      key={entry.pathId}
      value={(row) => (
        <MenuItem {...row.props} id={entry.pathId} textValue={entry.name}>
          {row.frame([
            ...(chevron
              ? row.parts
              : row.parts.filter((part) => !row.chevron.includes(part))),
            extra,
          ])}
        </MenuItem>
      )}
    >
      {renderRow(entry.recordId)}
    </Row>
  );
}

/** The search query of an open field (its search scope's — both parts are this chunk's). */
const CascaderQueryContext = createContext("");

const BACK: Readonly<Record<string, string>> = { en: "Back", ko: "뒤로" };

/** The Popover node's children inside the search scope (see the file note). */
export function CascaderOpenScope({
  open,
  View,
  children,
}: {
  readonly open: CascaderOpenValue;
  /** The first screen's view context (given as a prop — see `cascader.components.tsx`). */
  readonly View: ComponentType<{
    readonly value: CascaderViewValue;
    readonly children: ReactNode;
  }>;
  readonly children: ReactNode;
}): ReactElement {
  const [query, setQuery] = useState("");
  const { locale } = useLocale();
  const strings = catalogLocalized(CASCADER_SEARCH_STRINGS, locale);
  // (ADR-326 Phase 3 — a `drill` field's level: the just-opened level (`cascaderOpeningView`), moved
  //  by a branch row, a trail crumb and 「Back」; a level whose items are not here yet asks them.)
  const { table, label, levels } = open;
  const [opening] = useState(() => cascaderOpeningView(table, open.keys));
  const [level, setLevel] = useState(opening.level);
  // (`tree` — the expanded branches, kept over a search: the results take the list box's place.)
  const [expanded, setExpanded] = useState(opening.expanded);
  const [moved, setMoved] = useState(false);
  const enter = (next: string | null) => {
    const entry = next === null ? undefined : table.byPathId.get(next);
    if (
      entry &&
      levels &&
      entry.hasChildren &&
      !(table.byParent.get(entry.pathId) ?? []).length
    )
      levels.load(entry.levelKey);
    setMoved(true);
    setLevel(next);
  };
  const parent = level === null ? undefined : table.byPathId.get(level);
  const drill = open.mode === "drill";
  const scope = (
    <Autocomplete inputValue={query} onInputChange={setQuery}>
      {children}
    </Autocomplete>
  );
  return (
    <Provider
      values={[
        // (The field's own Button props stop here; a `drill` field's 「Back」 node is the `back`
        //  slot — one level up, RAC's Button context.)
        [
          ButtonContext,
          drill
            ? {
                slots: {
                  [DEFAULT_SLOT]: {},
                  back: {
                    "aria-label": catalogLocalized(BACK, locale),
                    isDisabled: !parent,
                    onPress: () => enter(parent?.parentPathId ?? null),
                  },
                },
              }
            : null,
        ],
        [LabelContext, null],
        [TextContext, null],
        [FieldErrorContext, null],
        // (The SearchField node has no visible label: its name is the i18n 「검색」 — ADR-322 Phase 5.)
        [SearchFieldContext, { "aria-label": strings.search, autoFocus: true }],
        [CascaderQueryContext, query],
      ]}
    >
      {open.mode === "columns" ? (
        scope
      ) : (
        <View
          value={{
            level,
            moved,
            enter,
            trail: cascaderTrail(table, level, label),
            expanded,
            setExpanded,
            isolate,
          }}
        >
          {scope}
        </View>
      )}
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
  base: Record<string, unknown>,
  id: string,
  text: string,
  extra: Record<string, unknown> = {},
): ReactElement {
  return (
    <MenuItem {...plainRow(base)} {...extra} key={id} id={id} textValue={text}>
      <Text slot="label">{text}</Text>
    </MenuItem>
  );
}

function Levels(props: LevelProps) {
  const { open, base } = props;
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
    // (A long level draws the rows in view — ADR-326 Phase 3 HC5.)
    return (
      <CascaderInView rows={childrenOf(here).length}>
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
            if (
              entry &&
              (id.endsWith(CASCADER_LEVEL_ITEM) || !entry.hasChildren)
            )
              onPick(entry.key);
          }}
        >
          {[
            ...(own && parent
              ? [addedRow(base, own, levelName(parent.name))]
              : []),
            ...(parent && waits(parent)
              ? [
                  addedRow(
                    base,
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
                  {itemRow(props, entry, true)}
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
                itemRow(props, entry, false)
              ),
            ),
          ]}
        </Menu>
      </CascaderInView>
    );
  };
  return level(null);
}

/** With a query: the pickable items whose name holds it, each with its path (ADR-322 Phase 5). */
function Results({ query, ...props }: LevelProps & { readonly query: string }) {
  const { open, base } = props;
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
        {shown.map((entry) =>
          itemRow(
            props,
            entry,
            false,
            <Text key="path" slot="description">
              {entry.names.join(separator)}
            </Text>,
          ),
        )}
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
export function CascaderListBody(
  props: CascaderListBodyProps,
): ReactElement | null {
  const query = useContext(CascaderQueryContext);
  if (query) return <Results {...props} query={query} />;
  const { mode } = props.open;
  return mode === "tree" ? (
    <CascaderTreeBody {...props} />
  ) : mode === "drill" ? (
    <CascaderDrillBody {...props} />
  ) : (
    <Levels {...props} />
  );
}
