import { useEffect, type ReactElement } from "react";
import { Menu, MenuItem, SubmenuTrigger } from "react-aria-components/Menu";
import { Popover } from "react-aria-components/Popover";
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

/**
 * ADR-322 Phase 2 — a Cascader's open content in the `columns` mode (사용자 결정 1): RAC `Popover` >
 * `Menu`, an item with child items is a RAC `SubmenuTrigger` (its `MenuItem` + `Popover` > `Menu` of
 * the next level — → · ← move between levels, RAC's). The field's `MenuTrigger` contexts reach the
 * first level (`cascader.components.tsx`). Items are known by their path id (RAC ids are unique —
 * breakdown §4.2); an item that cannot be picked (a repeated key — Decision 4 · disabled) is in
 * `disabledKeys`. The picked items show as RAC's selection (`menuitemradio` · `menuitemcheckbox`
 * while `multiple` — 사용자 결정 3, the menu then stays open). Phase 5 (사용자 결정 2): while a branch
 * is pickable, its submenu starts with 「<branch> 전체」 — that level's own item. Loaded with the
 * first open — the closed field does not carry it.
 */
/**
 * A submenu's level, built when its popover renders — not for every branch at the first open; a
 * level loaded one by one is asked then (Phase 6).
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

export default function CatalogCascaderMenu(
  content: CascaderContentProps,
): ReactElement {
  const { table, keys, multiple, label, onPick, searchable, levels } = content;
  const picked = cascaderPicked(table, keys);
  const levelName = useCascaderLevelName();
  const status = useCascaderLevelStatus();
  useCascaderLevels(levels);
  // (Phase 6 — a branch whose level is not here yet: its submenu asks it and shows one status item.)
  const waits = (entry: CascaderEntry) =>
    !!levels && entry.hasChildren && !childrenOf(entry.pathId).length;
  const blocked = table.entries
    .filter((entry) => entry.duplicate || entry.isDisabled)
    .map((entry) => entry.pathId);
  const childrenOf = (parent: string | null) =>
    table.byParent.get(parent) ?? [];
  const level = (parent: CascaderEntry | null): ReactElement => {
    const here = parent?.pathId ?? null;
    const own = parent?.pickable
      ? `${parent.pathId}${CASCADER_LEVEL_ITEM}`
      : undefined;
    return (
      <Menu
        aria-label={parent ? parent.name : label}
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
          ...(parent && waits(parent) && levels?.stateOf(parent.key) !== "error"
            ? [`${parent.pathId}${CASCADER_LEVEL_STATUS}`]
            : []),
        ]}
        onAction={(key) => {
          const id = String(key);
          if (id.endsWith(CASCADER_LEVEL_STATUS)) {
            if (parent) levels?.load(parent.key);
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
            ? [
                <MenuItem key={own} id={own} textValue={levelName(parent.name)}>
                  {levelName(parent.name)}
                </MenuItem>,
              ]
            : []),
          ...(parent && waits(parent)
            ? [
                <MenuItem
                  key={`${parent.pathId}${CASCADER_LEVEL_STATUS}`}
                  id={`${parent.pathId}${CASCADER_LEVEL_STATUS}`}
                  // (「Retry」 asks again in place — the menu stays open.)
                  shouldCloseOnSelect={false}
                  textValue={
                    levels?.stateOf(parent.key) === "error"
                      ? status.retry
                      : status.loading
                  }
                >
                  {levels?.stateOf(parent.key) === "error"
                    ? status.retry
                    : status.loading}
                </MenuItem>,
              ]
            : []),
          ...childrenOf(here).map((entry) =>
            entry.hasChildren ? (
              <SubmenuTrigger key={entry.pathId}>
                <MenuItem id={entry.pathId} textValue={entry.name}>
                  {entry.name}
                  {/* (S2 MenuItem's submenu chevron — the catalog MenuItem origin's `descriptor` Icon.) */}
                  <Icon iconName="chevron-right" slot="descriptor" />
                </MenuItem>
                <Popover placement="end top">
                  <Deferred
                    render={() => level(entry)}
                    onShow={
                      waits(entry) ? () => levels?.load(entry.key) : undefined
                    }
                  />
                </Popover>
              </SubmenuTrigger>
            ) : (
              <MenuItem
                key={entry.pathId}
                id={entry.pathId}
                textValue={entry.name}
              >
                {entry.name}
              </MenuItem>
            ),
          ),
        ]}
      </Menu>
    );
  };
  // (Phase 5 — a search field above: its results replace the levels while it has a query.)
  return (
    <Popover>
      {searchable ? (
        <CascaderSearch
          content={content}
          separator={content.separator}
          inside
          levels={level(null)}
        />
      ) : (
        level(null)
      )}
    </Popover>
  );
}
