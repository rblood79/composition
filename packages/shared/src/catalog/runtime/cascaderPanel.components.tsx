import { useContext, useState, type ReactElement } from "react";
import { Breadcrumb, Breadcrumbs } from "react-aria-components/Breadcrumbs";
import { Button } from "react-aria-components/Button";
import {
  Dialog,
  OverlayTriggerStateContext,
} from "react-aria-components/Dialog";
import { GridList, GridListItem } from "react-aria-components/GridList";
import { Link } from "react-aria-components/Link";
import { Popover } from "react-aria-components/Popover";
import { Tree, TreeItem, TreeItemContent } from "react-aria-components/Tree";
import { ListLayout, Virtualizer } from "react-aria-components/Virtualizer";
import { Icon } from "../../components/Icon";
import type { CascaderEntry } from "./cascader";
import type { CascaderContentProps } from "./cascader.components";
import { CascaderSearch } from "./cascaderSearch.components";
import {
  cascaderPicked,
  CASCADER_LEVEL_ITEM,
  CASCADER_LEVEL_STATUS,
  useCascaderLevelName,
  useCascaderLevelStatus,
  useCascaderLevels,
} from "./cascaderOpen";
import { useCatalogLocalized } from "./localizedStrings";

/**
 * ADR-322 Phase 3 — a Cascader's open content in the `tree` and `drill` modes (breakdown §3): RAC
 * `Popover` > `Dialog` (the field's `DialogTrigger` contexts — named by its trigger) >
 *
 * - `tree`: RAC `Tree` in RAC `Virtualizer` (Phase 0 P4 — 5,000 items drawn whole exceed HC5, the
 *   virtualized tree opens at ×0.07 of the Select baseline) — only expanded branches' items are in
 *   the collection (Phase 5 G5); the picked item's ancestors start expanded; a branch row expands
 *   (RAC's arrows · chevron), a leaf row is picked.
 * - `drill`: RAC `Breadcrumbs` (the way back to any level) + a back `Button` + RAC `GridList` of the
 *   current level — a row's action goes into a branch or picks a leaf; the list keeps focus as the
 *   level changes (`autoFocus`).
 *
 * Both lists take `escapeKeyBehavior: "none"` (Phase 0 finding 1 — with a selection, RAC's default
 * spends Esc on clearing it and the popover does not close). Items are known by path id; an item
 * whose key another item carries cannot be picked (`disabledKeys`, Decision 4). The picked value is
 * RAC's single selection (controlled — a branch's selection is not a value and changes nothing).
 */

/** The stand-in child of a closed tree branch (never drawn — a closed branch's rows are hidden). */
const CASCADER_COLLAPSED_ITEM = "\u001eclosed";

const BACK: Readonly<Record<string, string>> = {
  en: "Back",
  ko: "뒤로",
};

/**
 * The shared part: the picked items, the items that cannot be picked, and a pick (single: the value,
 * then the popover closes; multiple: a toggle — 사용자 결정 3). A selection change (Space · a row press)
 * picks what it added or removed — only pickable items (a leaf, any item while branches are —
 * 사용자 결정 2).
 */
function usePanel({
  table,
  keys,
  multiple,
  onPick,
  levels,
}: CascaderContentProps) {
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
  // (Phase 6 — a branch whose level is not here yet: opening it asks it; its one status row is
  //  「Loading…」 (disabled) or 「Retry」.)
  const waits = (entry: CascaderEntry | undefined) =>
    !!entry && !!levels && entry.hasChildren && !childrenOf(entry.pathId).length;
  const statusOf = (id: string) =>
    id.endsWith(CASCADER_LEVEL_STATUS)
      ? table.byPathId.get(id.slice(0, -CASCADER_LEVEL_STATUS.length))
      : undefined;
  const retry = (id: string) => {
    const branch = statusOf(id);
    if (branch) levels?.load(branch.key);
    return !!branch;
  };
  const onSelectionChange = (selection: unknown) => {
    if (selection === "all") return;
    const next = new Set([...(selection as Iterable<unknown>)].map(String));
    const before = new Set(picked.map((entry) => entry.pathId));
    for (const id of next)
      if (!before.has(id) && !retry(id)) pick(entryOf(id));
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
    close: () => state?.close(),
  };
}

/** The levels under a search field while the field is searchable (Phase 5 — breakdown §4.4). */
const withSearch = (
  props: CascaderContentProps,
  close: () => void,
  levels: ReactElement,
): ReactElement =>
  props.searchable ? (
    <CascaderSearch
      content={props}
      separator={props.separator}
      inside={false}
      onPicked={close}
      levels={levels}
    />
  ) : (
    levels
  );

export function CatalogCascaderTree(props: CascaderContentProps): ReactElement {
  const { table, label, multiple, searchable, levels } = props;
  const { picked, blocked, childrenOf, onSelectionChange, waits, close } =
    usePanel(props);
  const status = useCascaderLevelStatus();
  const statusRow = (entry: CascaderEntry): ReactElement => {
    const text =
      levels?.stateOf(entry.key) === "error" ? status.retry : status.loading;
    return (
      <TreeItem
        key={`${entry.pathId}${CASCADER_LEVEL_STATUS}`}
        id={`${entry.pathId}${CASCADER_LEVEL_STATUS}`}
        textValue={text}
      >
        <TreeItemContent>{text}</TreeItemContent>
      </TreeItem>
    );
  };
  const ancestors = new Set<string>();
  for (const entry of picked)
    for (
      let at = entry.parentPathId;
      at !== null;
      at = table.byPathId.get(at)?.parentPathId ?? null
    )
      ancestors.add(at);
  // (Only an expanded branch's items go into RAC's collection — 5,000 items in four levels open as
  //  the first level's few: G5 HC5. A closed branch holds one stand-in child: RAC 1.22.1's
  //  `useTreeItem` counts child nodes for `aria-expanded` · → (TreeItem's `hasChildItems` only draws
  //  the chevron), and a closed branch's children are never drawn — expanding swaps in the real ones.)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => ancestors,
  );
  const collapsedChild = (entry: CascaderEntry): ReactElement => (
    <TreeItem
      key={`${entry.pathId}${CASCADER_COLLAPSED_ITEM}`}
      id={`${entry.pathId}${CASCADER_COLLAPSED_ITEM}`}
      textValue=""
    >
      <TreeItemContent>{null}</TreeItemContent>
    </TreeItem>
  );
  const items = (parent: CascaderEntry | null): ReactElement[] =>
    childrenOf(parent?.pathId ?? null).map((entry) => (
      <TreeItem
        key={entry.pathId}
        id={entry.pathId}
        textValue={entry.name}
        hasChildItems={entry.hasChildren}
      >
        <TreeItemContent>
          {({ hasChildItems }) => (
            <>
              {hasChildItems ? (
                <Button slot="chevron">
                  <Icon iconName="chevron-right" />
                </Button>
              ) : null}
              {entry.name}
            </>
          )}
        </TreeItemContent>
        {entry.hasChildren
          ? expanded.has(entry.pathId)
            ? waits(entry)
              ? statusRow(entry)
              : items(entry)
            : collapsedChild(entry)
          : null}
      </TreeItem>
    ));
  return (
    <Popover className="react-aria-Popover cascader-panel">
      <Dialog>
        {withSearch(
          props,
          close,
          <Virtualizer
            layout={ListLayout}
            layoutOptions={{ estimatedRowHeight: 32 }}
          >
            <Tree
              aria-label={label}
              // (Focus goes into the list on open — the picked row, else the first: RAC's `autoFocus`;
              //  a search field takes it first — Phase 5.)
              autoFocus={
                searchable ? undefined : picked.length ? true : "first"
              }
              selectionMode={multiple ? "multiple" : "single"}
              selectedKeys={picked.map((entry) => entry.pathId)}
              disabledKeys={[
                ...blocked,
                ...[...expanded].flatMap((id) => {
                  const entry = table.byPathId.get(id);
                  return entry &&
                    waits(entry) &&
                    levels?.stateOf(entry.key) !== "error"
                    ? [`${id}${CASCADER_LEVEL_STATUS}`]
                    : [];
                }),
              ]}
              expandedKeys={expanded}
              onExpandedChange={(keys) => {
                const next = new Set([...keys].map(String));
                // (Phase 6 — an expanded branch whose level is not here asks it.)
                for (const id of next)
                  if (!expanded.has(id)) {
                    const entry = table.byPathId.get(id);
                    if (waits(entry)) levels?.load(entry!.key);
                  }
                setExpanded(next);
              }}
              escapeKeyBehavior="none"
              onSelectionChange={onSelectionChange}
              style={{ maxHeight: 320, overflow: "auto" }}
            >
              {items(null)}
            </Tree>
          </Virtualizer>,
        )}
      </Dialog>
    </Popover>
  );
}

export function CatalogCascaderDrill(
  props: CascaderContentProps,
): ReactElement {
  const { table, label, multiple, searchable } = props;
  const {
    picked,
    blocked,
    childrenOf,
    pick,
    entryOf,
    onSelectionChange,
    waits,
    retry,
    close,
  } = usePanel(props);
  const back = useCatalogLocalized(BACK);
  const status = useCascaderLevelStatus();
  const { levels } = props;
  const levelName = useCascaderLevelName();
  const [level, setLevel] = useState<string | null>(
    picked[0]?.parentPathId ?? null,
  );
  const parent = level === null ? undefined : table.byPathId.get(level);
  // (Phase 6 — a level entered whose items are not here yet asks them.)
  const enter = (entry: CascaderEntry) => {
    if (waits(entry)) levels?.load(entry.key);
    setLevel(entry.pathId);
  };
  const statusId = parent ? `${parent.pathId}${CASCADER_LEVEL_STATUS}` : "";
  const failed = !!parent && levels?.stateOf(parent.key) === "error";
  const trail: CascaderEntry[] = [];
  for (let at = parent; at; at = table.byPathId.get(at.parentPathId ?? ""))
    trail.unshift(at);
  // (사용자 결정 2 — a pickable branch's own row first in its level: 「<branch> 전체」.)
  const own = parent?.pickable
    ? `${parent.pathId}${CASCADER_LEVEL_ITEM}`
    : undefined;
  const selected = [
    ...picked
      .filter((entry) => entry.parentPathId === level && !entry.hasChildren)
      .map((entry) => entry.pathId),
    ...(own && parent && picked.includes(parent) ? [own] : []),
  ];
  return (
    <Popover className="react-aria-Popover cascader-panel">
      <Dialog>
        {withSearch(
          props,
          close,
          <>
            <Breadcrumbs>
              <Breadcrumb id="">
                <Link onPress={() => setLevel(null)}>{label}</Link>
              </Breadcrumb>
              {trail.map((entry) => (
                <Breadcrumb key={entry.pathId} id={entry.pathId}>
                  <Icon iconName="chevron-right" />
                  <Link onPress={() => enter(entry)}>
                    {entry.name}
                  </Link>
                </Breadcrumb>
              ))}
            </Breadcrumbs>
            <Button
              className="react-aria-Button cascader-back"
              aria-label={back}
              isDisabled={!parent}
              onPress={() => setLevel(parent?.parentPathId ?? null)}
            >
              <Icon iconName="chevron-left" />
            </Button>
            <GridList
              key={level ?? ""}
              aria-label={parent ? parent.name : label}
              autoFocus={
                searchable ? undefined : selected.length ? true : "first"
              }
              escapeKeyBehavior="none"
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
              onAction={(key) => {
                if (retry(String(key))) return;
                const entry = entryOf(key);
                if (
                  !String(key).endsWith(CASCADER_LEVEL_ITEM) &&
                  entry?.hasChildren
                )
                  enter(entry);
                else pick(entry);
              }}
            >
              {[
                ...(own && parent
                  ? [
                      <GridListItem
                        key={own}
                        id={own}
                        textValue={levelName(parent.name)}
                      >
                        {levelName(parent.name)}
                      </GridListItem>,
                    ]
                  : []),
                ...(waits(parent)
                  ? [
                      <GridListItem
                        key={statusId}
                        id={statusId}
                        textValue={failed ? status.retry : status.loading}
                      >
                        {failed ? status.retry : status.loading}
                      </GridListItem>,
                    ]
                  : []),
                ...childrenOf(level).map((entry) => (
                  <GridListItem
                    key={entry.pathId}
                    id={entry.pathId}
                    textValue={entry.name}
                  >
                    {entry.name}
                    {entry.hasChildren ? (
                      <Icon iconName="chevron-right" slot="descriptor" />
                    ) : null}
                  </GridListItem>
                )),
              ]}
            </GridList>
          </>,
        )}
      </Dialog>
    </Popover>
  );
}
