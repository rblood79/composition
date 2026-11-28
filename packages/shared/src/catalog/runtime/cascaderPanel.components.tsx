import { useContext, useState, type ReactElement, type ReactNode } from "react";
import { Provider } from "react-aria-components";
import {
  FieldInputContext,
  SelectableCollectionContext,
} from "react-aria-components/Autocomplete";
import { Button } from "react-aria-components/Button";
import { OverlayTriggerStateContext } from "react-aria-components/Dialog";
import { GridList, GridListItem } from "react-aria-components/GridList";
import { Tree, TreeItem, TreeItemContent } from "react-aria-components/Tree";
import { ListLayout, Virtualizer } from "react-aria-components/Virtualizer";
import { useLocale } from "react-aria-components/I18nProvider";
import type { CascaderEntry } from "./cascader";
import {
  CascaderOwnLabelContext,
  type CascaderRowInput,
} from "./cascader.components";
import {
  cascaderNameMatch,
  CASCADER_SEARCH_STRINGS,
} from "./cascaderSearch.components";
import { catalogLocalized } from "./localizedStrings";
import type { CascaderListBodyProps } from "./cascaderMenu.components";
import {
  cascaderPicked,
  CASCADER_LEVEL_ITEM,
  CASCADER_LEVEL_STATUS,
  useCascaderLevelName,
  useCascaderLevelStatus,
  useCascaderLevels,
} from "./cascaderOpen";

/**
 * ADR-326 Phase 3 — the `CascaderList` node's content in the `tree` and `drill` modes (the field's
 * Popover node > RAC `Dialog` — the search scope's, `cascaderMenu.components.tsx`):
 *
 * - `tree`: RAC `Tree` (the node's element) in RAC `Virtualizer` (ADR-322 Phase 0 P4 — 5,000 items
 *   drawn whole exceed HC5) — only expanded branches' items are in the collection; the picked item's
 *   ancestors start expanded (`cascaderOpeningView`); a branch row expands (RAC's arrows · chevron
 *   button), a leaf row is picked.
 * - `drill`: RAC `GridList` (the node's element) of the current level — the level is the search
 *   scope's (its trail · 「Back」 nodes move it too); a row's action goes into a branch or picks a leaf.
 *
 * A row is its item record drawn by the catalog renderer (§4.3 개정 — the same `cascaderitem` path as
 * the `columns` rows): its props and parts as a RAC `TreeItem` · `GridListItem`. Rows without a record
 * (「<branch> 전체」 · a level's status) take the item's class and size. Both lists take
 * `escapeKeyBehavior: "none"` (ADR-322 Phase 0 — with a selection RAC's default spends Esc on clearing
 * it). Items are known by path id; an item whose key another item carries cannot be picked.
 */

/**
 * ADR-326 Phase 3 HC5 — a level of more rows than this draws the rows in view (RAC `Virtualizer`):
 * each row is its record drawn by the catalog renderer — a level of a thousand drawn whole took ×3 a
 * Select 1,000's open. A shorter one is drawn whole: its height follows its rows, and a measuring
 * virtualizer resizing its own scroll box loops the ResizeObserver (WebKit reports it as an error).
 */
const CASCADER_VIRTUAL_ROWS = 50;

/**
 * A level's list, in a virtualizer when it holds more rows than `CASCADER_VIRTUAL_ROWS` as it mounts
 * — decided once: a virtualizer put in around a mounted list (a level's rows arriving later) remounts
 * it, and the row holding focus goes.
 */
export function CascaderInView({
  rows,
  children,
}: {
  readonly rows: number;
  readonly children: ReactElement;
}): ReactElement {
  const [inView] = useState(() => rows > CASCADER_VIRTUAL_ROWS);
  return inView ? (
    <Virtualizer layout={ListLayout} layoutOptions={{ estimatedRowHeight: 32 }}>
      {children}
    </Virtualizer>
  ) : (
    children
  );
}

/** The stand-in child of a closed tree branch (never drawn — a closed branch's rows are hidden). */
const CASCADER_COLLAPSED_ITEM = "\u001eclosed";

/**
 * A collection off the search's RAC `Autocomplete` (the drill level · the trail's folder Menu): on it
 * the input's virtual focus goes to that collection — the results' Menu lost it, the folder Menu's
 * press did not reach its item.
 */
export const isolate = (node: ReactNode): ReactElement => (
  <Provider
    values={[
      [SelectableCollectionContext, null],
      [FieldInputContext, null],
    ]}
  >
    {node}
  </Provider>
);

type BodyProps = CascaderListBodyProps;

/** A row without a record (「전체」 · a status · an item no node draws): the item's class and size. */
export const plainRow = (base: Record<string, unknown>) => ({
  className: "react-aria-CascaderItem",
  "data-size": base["data-size"],
});

/**
 * A row's parts: a branch draws them all — but its item count while its items are not here (a level
 * loaded one by one: the Canvas hides the count too, `catalogCascaderCount`); a leaf · a level's own
 * row draws no `branchOnly` part.
 */
export const rowParts = (
  row: CascaderRowInput,
  branch: boolean,
  counted: boolean = branch,
): readonly ReactNode[] =>
  row.parts.filter((part) =>
    branch
      ? counted || !row.branchOnly.includes(part) || row.chevron.includes(part)
      : !row.branchOnly.includes(part),
  );

/**
 * The shared part: the picked items, the items that cannot be picked, and a pick (single: the value,
 * then the popover closes; multiple: a toggle — ADR-322 사용자 결정 3). A selection change (Space · a
 * row press) picks what it added or removed — only pickable items.
 */
function usePanel({ open }: BodyProps) {
  const { table, keys, multiple, onPick, levels } = open;
  const state = useContext(OverlayTriggerStateContext);
  useCascaderLevels(levels);
  const picked = cascaderPicked(table, keys);
  const blocked = table.entries
    .filter((entry) => entry.duplicate || entry.isDisabled)
    .map((entry) => entry.pathId);
  const childrenOf = (parent: string | null) =>
    table.byParent.get(parent) ?? [];
  const pick = (entry: CascaderEntry | undefined) => {
    if (!entry || !entry.pickable || entry.duplicate || entry.isDisabled)
      return;
    onPick(entry.key);
    if (!multiple) state?.close();
  };
  const entryOf = (id: unknown) => {
    const key = String(id);
    return table.byPathId.get(
      key.endsWith(CASCADER_LEVEL_ITEM)
        ? key.slice(0, -CASCADER_LEVEL_ITEM.length)
        : key,
    );
  };
  // (ADR-322 Phase 6 — a branch whose level is not here yet: opening it asks it; its one status row
  //  is 「Loading…」 (disabled) or 「Retry」.)
  const waits = (entry: CascaderEntry | undefined) =>
    !!entry &&
    !!levels &&
    entry.hasChildren &&
    !childrenOf(entry.pathId).length;
  const retry = (id: string) => {
    const branch = id.endsWith(CASCADER_LEVEL_STATUS)
      ? table.byPathId.get(id.slice(0, -CASCADER_LEVEL_STATUS.length))
      : undefined;
    if (branch) levels?.load(branch.levelKey);
    return !!branch;
  };
  const onSelectionChange = (selection: unknown) => {
    if (selection === "all") return;
    const next = new Set([...(selection as Iterable<unknown>)].map(String));
    const before = new Set(picked.map((entry) => entry.pathId));
    for (const id of next) if (!before.has(id) && !retry(id)) pick(entryOf(id));
    if (multiple)
      for (const id of before) if (!next.has(id)) pick(table.byPathId.get(id));
  };
  return {
    picked,
    blocked,
    childrenOf,
    pick,
    entryOf,
    onSelectionChange,
    waits,
    retry,
  };
}

export function CascaderTreeBody(props: BodyProps): ReactElement | null {
  const { open, base, Row, renderRow, view } = props;
  const { table, label, multiple, levels } = open;
  const { picked, blocked, childrenOf, onSelectionChange, waits } =
    usePanel(props);
  const status = useCascaderLevelStatus();
  // (Only an expanded branch's items go into RAC's collection — 5,000 items in four levels open as
  //  the first level's few: ADR-322 G5 HC5. A closed branch holds one stand-in child: RAC 1.22.1's
  //  `useTreeItem` counts child nodes for `aria-expanded` · → (TreeItem's `hasChildItems` only draws
  //  the chevron), and a closed branch's children are never drawn — expanding swaps in the real ones.
  //  The expanded set is the search scope's — it outlives a search.)
  if (!view) return null;
  const { expanded, setExpanded } = view;
  const plain = (id: string, text: string): ReactElement => (
    <TreeItem {...plainRow(base)} key={id} id={id} textValue={text}>
      <TreeItemContent>{text}</TreeItemContent>
    </TreeItem>
  );
  const statusRow = (entry: CascaderEntry): ReactElement =>
    plain(
      `${entry.pathId}${CASCADER_LEVEL_STATUS}`,
      levels?.stateOf(entry.levelKey) === "error"
        ? status.retry
        : status.loading,
    );
  const nested = (entry: CascaderEntry): ReactElement | null =>
    entry.hasChildren ? (
      expanded.has(entry.pathId) ? (
        waits(entry) ? (
          statusRow(entry)
        ) : (
          <>{items(entry)}</>
        )
      ) : (
        plain(`${entry.pathId}${CASCADER_COLLAPSED_ITEM}`, "")
      )
    ) : null;
  // (A row's chevron button holds its record's chevron Icon — RAC Tree's expand button; a leaf's
  //  keeps its room undrawn, S2 TreeView's — the Cascader rule's `:not([data-has-child-items])`.)
  const items = (parent: CascaderEntry | null): ReactElement[] =>
    childrenOf(parent?.pathId ?? null).map((entry) =>
      entry.recordId ? (
        <Row
          key={entry.pathId}
          value={(row) => (
            <TreeItem
              {...row.props}
              id={entry.pathId}
              textValue={entry.name}
              hasChildItems={entry.hasChildren}
            >
              <TreeItemContent>
                {row.frame([
                  <Button key="chevron" slot="chevron">
                    {row.chevron}
                  </Button>,
                  // (The chevron is the button's.)
                  ...rowParts(
                    row,
                    entry.hasChildren,
                    !!childrenOf(entry.pathId).length,
                  ).filter((part) => !row.chevron.includes(part)),
                ])}
              </TreeItemContent>
              {nested(entry)}
            </TreeItem>
          )}
        >
          {renderRow(entry.recordId)}
        </Row>
      ) : (
        <TreeItem
          {...plainRow(base)}
          key={entry.pathId}
          id={entry.pathId}
          textValue={entry.name}
          hasChildItems={entry.hasChildren}
        >
          <TreeItemContent>{entry.name}</TreeItemContent>
          {nested(entry)}
        </TreeItem>
      ),
    );
  return (
    <CascaderInView rows={table.entries.length}>
      <Tree
        {...base}
        aria-label={label}
        selectionMode={multiple ? "multiple" : "single"}
        selectedKeys={picked.map((entry) => entry.pathId)}
        disabledKeys={[
          ...blocked,
          ...[...expanded].flatMap((id) => {
            const entry = table.byPathId.get(id);
            return entry &&
              waits(entry) &&
              levels?.stateOf(entry.levelKey) !== "error"
              ? [`${id}${CASCADER_LEVEL_STATUS}`]
              : [];
          }),
        ]}
        expandedKeys={expanded}
        onExpandedChange={(next) => {
          const shown = new Set([...next].map(String));
          // (ADR-322 Phase 6 — an expanded branch whose level is not here asks it.)
          for (const id of shown)
            if (!expanded.has(id)) {
              const entry = table.byPathId.get(id);
              if (waits(entry)) levels?.load(entry!.levelKey);
            }
          setExpanded(shown);
        }}
        escapeKeyBehavior="none"
        onSelectionChange={onSelectionChange}
      >
        {items(null)}
      </Tree>
    </CascaderInView>
  );
}

export function CascaderDrillBody(props: BodyProps): ReactElement | null {
  const { open, base, Row, renderRow, view, query = "" } = props;
  const { table, label, multiple, levels } = open;
  const { locale } = useLocale();
  const strings = catalogLocalized(CASCADER_SEARCH_STRINGS, locale);
  const { picked, blocked, childrenOf, pick, entryOf, waits, retry } =
    usePanel(props);
  const status = useCascaderLevelStatus();
  const levelName = useCascaderLevelName();
  if (!view) return null;
  const { level, moved, enter } = view;
  const parent = level === null ? undefined : table.byPathId.get(level);
  const statusId = parent ? `${parent.pathId}${CASCADER_LEVEL_STATUS}` : "";
  const failed = !!parent && levels?.stateOf(parent.levelKey) === "error";
  // (ADR-322 사용자 결정 2 — a pickable branch's own row first in its level: 「<branch> 전체」.)
  const own = parent?.pickable
    ? `${parent.pathId}${CASCADER_LEVEL_ITEM}`
    : undefined;
  const selected = [
    ...picked
      .filter((entry) => entry.parentPathId === level && !entry.hasChildren)
      .map((entry) => entry.pathId),
    ...(own && parent && picked.includes(parent) ? [own] : []),
  ];
  const plain = (id: string, text: string): ReactElement => (
    <GridListItem {...plainRow(base)} key={id} id={id} textValue={text}>
      {text}
    </GridListItem>
  );
  // (A row's action: 「Retry」 asks again, a branch row goes into its level, the rest is picked.)
  const act = (key: unknown) => {
    if (retry(String(key))) return;
    const entry = entryOf(key);
    if (!String(key).endsWith(CASCADER_LEVEL_ITEM) && entry?.hasChildren)
      enter(entry.pathId);
    else pick(entry);
  };
  // (판독 1 #2 · #3 · 수리 검증 #1 — every press and key (Enter · Space) comes as a selection change
  //  — no `onAction`: with a row picked RAC keeps Enter from an action, and a branch row's press
  //  came here anyway. The list holds this level's picked rows only: a change is read against them
  //  — the picks of other levels stay — and a row added is acted on (a branch is gone into).)
  const onSelectionChange = (selection: unknown) => {
    if (selection === "all") return;
    const next = new Set([...(selection as Iterable<unknown>)].map(String));
    for (const id of next) if (!selected.includes(id)) act(id);
    if (multiple)
      for (const id of selected) if (!next.has(id)) pick(entryOf(id));
  };
  // (The level keeps its own focus — off the search's RAC `Autocomplete`, as before ADR-326: on it the
  //  input's virtual focus went to the grid and stayed off when the results' Menu took its place.
  //  RAC 1.22.1 `GridList` takes the `Autocomplete`'s filter only, not its virtual focus — Tab goes
  //  from the search box to the level; ↓ there would be a key handler of our own, D1.)
  return isolate(
    // (A level changed — the list remounts and, once the user moved, takes focus: the picked row,
    //  else the first, RAC's `autoFocus`; on open the search field has it. The key is on the
    //  virtualizer's choice too — a level decides it for its own rows.)
    <CascaderInView key={level ?? ""} rows={childrenOf(level).length}>
      <GridList
        {...base}
        aria-label={parent ? parent.name : label}
        autoFocus={moved ? (selected.length ? true : "first") : undefined}
        escapeKeyBehavior="none"
        renderEmptyState={() => strings.empty}
        selectionMode={multiple ? "multiple" : "single"}
        selectedKeys={selected}
        disabledKeys={[
          ...blocked,
          ...(own && parent && (parent.duplicate || parent.isDisabled)
            ? [own]
            : []),
          ...(waits(parent) && !failed ? [statusId] : []),
        ]}
        onSelectionChange={onSelectionChange}
      >
        {[
          // (ADR-326 Phase 5 — the own row is the branch's record (its check mark · label Text, the
          //  label the level name, no chevron), as the Canvas draws it; a branch without a record a
          //  plain row.)
          // (`searchScope: "level"` — a query narrows this level's rows by name, its own row's too.)
          ...(own &&
          parent &&
          cascaderNameMatch(levelName(parent.name), query, locale)
            ? [
                parent.recordId ? (
                  <Row
                    key={own}
                    value={(row) => (
                      <GridListItem
                        {...row.props}
                        id={own}
                        textValue={levelName(parent.name)}
                      >
                        {row.frame([
                          <CascaderOwnLabelContext.Provider
                            key="own"
                            value={levelName(parent.name)}
                          >
                            {rowParts(row, false)}
                          </CascaderOwnLabelContext.Provider>,
                        ])}
                      </GridListItem>
                    )}
                  >
                    {renderRow(parent.recordId)}
                  </Row>
                ) : (
                  plain(own, levelName(parent.name))
                ),
              ]
            : []),
          ...(waits(parent)
            ? [plain(statusId, failed ? status.retry : status.loading)]
            : []),
          ...childrenOf(level)
            .filter((entry) => cascaderNameMatch(entry.name, query, locale))
            .map((entry) =>
              entry.recordId ? (
                <Row
                  key={entry.pathId}
                  value={(row) => (
                    <GridListItem
                      {...row.props}
                      id={entry.pathId}
                      textValue={entry.name}
                    >
                      {row.frame(
                        rowParts(
                          row,
                          entry.hasChildren,
                          !!childrenOf(entry.pathId).length,
                        ),
                      )}
                    </GridListItem>
                  )}
                >
                  {renderRow(entry.recordId)}
                </Row>
              ) : (
                plain(entry.pathId, entry.name)
              ),
            ),
        ]}
      </GridList>
    </CascaderInView>,
  );
}
