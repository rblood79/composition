import type { ReactElement } from "react";
import { Menu, MenuItem, SubmenuTrigger } from "react-aria-components/Menu";
import { Popover } from "react-aria-components/Popover";
import { Icon } from "../../components/Icon";
import type { CascaderEntry, CascaderTable } from "./cascader";

/**
 * ADR-322 Phase 2 — a Cascader's open content in the `columns` mode (사용자 결정 1): RAC `Popover` >
 * `Menu`, an item with child items is a RAC `SubmenuTrigger` (its `MenuItem` + `Popover` > `Menu` of
 * the next level — → · ← move between levels, RAC's). The field's `MenuTrigger` contexts reach the
 * first level (`cascader.components.tsx`). Items are known by their path id (RAC ids are unique —
 * breakdown §4.2); an item whose key another item carries cannot be picked (`disabledKeys`,
 * Decision 4). The picked item's level shows it as RAC's single selection (`menuitemradio` checked).
 * Loaded with the first open — the closed field does not carry it.
 */
export default function CatalogCascaderMenu({
  table,
  value,
  label,
  onPick,
}: {
  readonly table: CascaderTable;
  readonly value: string | null;
  readonly label: string;
  readonly onPick: (key: string) => void;
}): ReactElement {
  const picked =
    value === null
      ? undefined
      : (table.byKey.get(value) ?? []).length === 1
        ? table.byKey.get(value)![0]
        : undefined;
  const disabled = table.entries
    .filter((entry) => entry.duplicate || entry.isDisabled)
    .map((entry) => entry.pathId);
  const childrenOf = (parent: string | null) =>
    table.entries.filter((entry) => entry.parentPathId === parent);
  const level = (parent: CascaderEntry | null): ReactElement => (
    <Menu
      aria-label={parent ? parent.name : label}
      selectionMode="single"
      selectedKeys={
        picked && picked.parentPathId === (parent?.pathId ?? null)
          ? [picked.pathId]
          : []
      }
      disabledKeys={disabled}
      onAction={(key) => {
        const entry = table.byPathId.get(String(key));
        if (entry && !entry.hasChildren) onPick(entry.key);
      }}
    >
      {childrenOf(parent?.pathId ?? null).map((entry) =>
        entry.hasChildren ? (
          <SubmenuTrigger key={entry.pathId}>
            <MenuItem id={entry.pathId} textValue={entry.name}>
              {entry.name}
              {/* (S2 MenuItem's submenu chevron — the catalog MenuItem origin's `descriptor` Icon.) */}
              <Icon iconName="chevron-right" slot="descriptor" />
            </MenuItem>
            <Popover placement="end top">{level(entry)}</Popover>
          </SubmenuTrigger>
        ) : (
          <MenuItem key={entry.pathId} id={entry.pathId} textValue={entry.name}>
            {entry.name}
          </MenuItem>
        ),
      )}
    </Menu>
  );
  return <Popover>{level(null)}</Popover>;
}
