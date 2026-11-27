import type { ReactElement } from "react";
import { Menu, MenuItem, SubmenuTrigger } from "react-aria-components/Menu";
import { Popover } from "react-aria-components/Popover";
import { Icon } from "../../components/Icon";
import type { CascaderEntry } from "./cascader";
import type { CascaderContentProps } from "./cascader.components";
import { CascaderSearch } from "./cascaderSearch.components";
import {
  cascaderPicked,
  CASCADER_LEVEL_ITEM,
  useCascaderLevelName,
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
/** A submenu's level, built when its popover renders — not for every branch at the first open. */
function Deferred({ render }: { readonly render: () => ReactElement }) {
  return render();
}

export default function CatalogCascaderMenu(
  content: CascaderContentProps,
): ReactElement {
  const { table, keys, multiple, label, onPick, searchable } = content;
  const picked = cascaderPicked(table, keys);
  const levelName = useCascaderLevelName();
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
        ]}
        onAction={(key) => {
          const id = String(key);
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
          ...childrenOf(here).map((entry) =>
            entry.hasChildren ? (
              <SubmenuTrigger key={entry.pathId}>
                <MenuItem id={entry.pathId} textValue={entry.name}>
                  {entry.name}
                  {/* (S2 MenuItem's submenu chevron — the catalog MenuItem origin's `descriptor` Icon.) */}
                  <Icon iconName="chevron-right" slot="descriptor" />
                </MenuItem>
                <Popover placement="end top">
                  <Deferred render={() => level(entry)} />
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
