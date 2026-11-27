/**
 * ADR-320 Phase 4 — the condition builder (breakdown §5.6 · Decision 3): the scope's tree as a RAC
 * `Tree` — a row a condition (its drag button, field · comparison · value buttons and row menu), a
 * row with children a group (its 「and · or」 switch and group menu). Order and membership change by
 * the Tree's drag and drop (pointer and keyboard — `useDragAndDrop`) and by the menus' 「Move up」 ·
 * 「Move down」. Groups nest three levels at most: a deeper drop is cancelled, 「Add group」 ·
 * 「Group」 are not offered where they would nest deeper. A scope that takes no group (§5.3 — a paged
 * `suffix` scope) offers no group feature (G4). Every edit is the scope's one write.
 *
 * Loads when the builder first opens (its own chunk — the Tree and drag and drop with it). D1: RAC
 * parts only — no role · aria literal (the names are RAC props: the Tree's · the Menus' `aria-label`).
 */
import {
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import type { Key } from "react-aria-components";
import { Button } from "react-aria-components/Button";
import { Collection } from "react-aria-components/Collection";
import {
  Menu,
  MenuItem,
  MenuTrigger,
  SubmenuTrigger,
} from "react-aria-components/Menu";
import { Popover } from "react-aria-components/Popover";
import { Tree, TreeItem, TreeItemContent } from "react-aria-components/Tree";
import { useDragAndDrop } from "react-aria-components/useDragAndDrop";
import type { ViewCondition, ViewConditionGroup } from "../document/types";
import {
  ComparisonMenu,
  FieldMenu,
  FieldSearch,
  ValueEditor,
} from "./filterBar.components";
import {
  afterKeyRelease,
  BarRunContext,
  fieldAt,
  FilterPlaceContext,
  newCondition,
  newId,
  renewed,
  useScopeTree,
  valueFor,
  type BarRun,
  type Item,
} from "./filterBarRun";
import type { CatalogFilterBarField } from "./filterBarAccess";
import {
  CATALOG_FILTER_GROUP_DEPTH,
  catalogFilterAdded,
  catalogFilterGroupsTaken,
  catalogFilterLevelOf,
  catalogFilterMoved,
  catalogFilterShifted,
  catalogFilterSwitched,
  catalogFilterTreeWith,
  catalogFilterUngrouped,
  catalogFilterWrapped,
  type CatalogFilterDropPosition,
} from "./filterTreeEdit";
import { catalogFilterValueText, catalogFilterWords } from "./filterWording";
import { catalogLucideGlyph } from "./lucideGlyph";

const ROW_STYLE = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  minHeight: 32,
} as const;
const GLYPH = { width: 16, height: 16 } as const;
/**
 * The builder's buttons are drawn as the bar's own buttons are: the catalog's quiet ActionButton
 * (its generated rule — `.react-aria-ActionButton[data-quiet]`, size S), not the Button's fill.
 */
const QUIET = {
  className: "react-aria-ActionButton",
  "data-variant": "default",
  "data-quiet": "",
  "data-size": "S",
} as const;
/** A row's indent per level (the root's items are level 1). */
const INDENT = 20;

const isGroup = (item: Item): item is ViewConditionGroup => "items" in item;
const groupIds = (items: readonly Item[]): string[] =>
  items.flatMap((item) =>
    isGroup(item) ? [item.id, ...groupIds(item.items)] : [],
  );

export default function CatalogFilterBuilder(): ReactNode {
  const run = useContext(BarRunContext)!;
  const tree = useScopeTree(run.access);
  const items = useMemo(() => tree?.items ?? [], [tree]);
  // (The scope's judgment of groups is the tree's — §5.3.)
  const groups = useMemo(
    () => catalogFilterGroupsTaken(run.access.fields(), tree, run.access.takes),
    [run.access, tree],
  );
  const fields = useMemo(() => run.access.fields(), [run.access, tree]); // eslint-disable-line react-hooks/exhaustive-deps
  const [collapsed, setCollapsed] = useState<ReadonlySet<Key>>(new Set());
  const expanded = useMemo(
    () => groupIds(items).filter((id) => !collapsed.has(id)),
    [items, collapsed],
  );
  const [dragged, setDragged] = useState<readonly string[]>([]);
  const write = (next: ViewConditionGroup | null | undefined) => {
    if (next !== undefined) run.access.write(next);
  };
  const moved = (target: Key, position: CatalogFilterDropPosition) =>
    catalogFilterMoved(run.access.tree(), dragged, String(target), position);
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => [...keys].map((key) => ({ "text/plain": String(key) })),
    onDragStart: (event) => setDragged([...event.keys].map(String)),
    onDragEnd: () => setDragged([]),
    // (「Into」 a group only — a condition row takes no drop on it.)
    shouldAcceptItemDrop: (target) =>
      groups &&
      groupIds(run.access.tree()?.items ?? []).includes(String(target.key)),
    // (A drop that would nest deeper than three levels — or into a moved group — is cancelled.)
    getDropOperation: (target) =>
      target.type === "item" &&
      moved(target.key, target.dropPosition) !== undefined
        ? "move"
        : "cancel",
    onMove: (event) =>
      write(
        catalogFilterMoved(
          run.access.tree(),
          [...event.keys].map(String),
          String(event.target.key),
          event.target.dropPosition,
        ),
      ),
  });
  const added =
    (into: string | undefined, group: boolean) =>
    (condition: ViewCondition) => {
      const next = catalogFilterAdded(
        run.access.tree(),
        into,
        condition,
        group ? newId() : undefined,
      );
      write(next);
      return next !== undefined;
    };
  const context = { run, fields, groups, tree, write };
  return (
    <FilterPlaceContext.Provider value="builder">
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.length ? (
          <Tree
            aria-label={run.strings.conditions}
            items={items}
            expandedKeys={expanded}
            onExpandedChange={(keys) =>
              setCollapsed(
                new Set(groupIds(items).filter((id) => !keys.has(id))),
              )
            }
            dragAndDropHooks={dragAndDropHooks}
            // (A row's menus read the tree · the group judgment · the fields: rows whose item did
            //  not change draw again when these do.)
            dependencies={[tree, groups, fields]}
          >
            {function row(item: Item): ReactElement {
              return (
                <BuilderRow key={item.id} item={item} {...context}>
                  {isGroup(item) ? (
                    <Collection items={item.items}>{row}</Collection>
                  ) : null}
                </BuilderRow>
              );
            }}
          </Tree>
        ) : null}
        <div style={{ display: "flex", gap: 8 }}>
          <FieldMenu
            trigger={<Button {...QUIET}>{run.strings.addCondition}</Button>}
            add={added(undefined, false)}
          />
          {groups ? (
            <FieldMenu
              trigger={<Button {...QUIET}>{run.strings.addGroup}</Button>}
              add={added(undefined, true)}
            />
          ) : null}
        </div>
      </div>
    </FilterPlaceContext.Provider>
  );
}

interface RowContext {
  readonly run: BarRun;
  readonly fields: readonly CatalogFilterBarField[];
  readonly groups: boolean;
  readonly tree: ViewConditionGroup | undefined;
  readonly write: (next: ViewConditionGroup | null | undefined) => void;
}

/** A row: a condition's buttons and menu, or a group's switch and menu. */
function BuilderRow({
  item,
  children,
  run,
  fields,
  groups,
  tree,
  write,
}: RowContext & { item: Item; children: ReactNode }): ReactNode {
  const words = catalogFilterWords(run.locale);
  const at = (next: (item: Item) => readonly Item[]) =>
    write(catalogFilterTreeWith(run.access.tree(), item.id, next));
  const condition = isGroup(item) ? undefined : item;
  const field = condition && fieldAt(fields, condition.fields[0] ?? []);
  const off = condition?.enabled === false;
  const label = condition
    ? [
        field?.label ?? "",
        words.ops[condition.op],
        catalogFilterValueText(condition, words),
        off ? words.off : "",
      ]
        .filter(Boolean)
        .join(" ")
    : `${run.strings.conditions} ${item.op === "and" ? run.strings.and : run.strings.or}`;
  return (
    <TreeItem
      id={item.id}
      textValue={label}
      style={({ level }) => ({
        paddingInlineStart: (level - 1) * INDENT,
        opacity: off ? 0.55 : undefined,
      })}
    >
      <TreeItemContent>
        {({ isExpanded }) => (
          <div style={ROW_STYLE}>
            <Button slot="drag" {...QUIET}>
              {catalogLucideGlyph("grip-vertical", GLYPH)}
            </Button>
            {isGroup(item) ? (
              <>
                <Button slot="chevron" {...QUIET}>
                  {catalogLucideGlyph(
                    isExpanded ? "chevron-down" : "chevron-right",
                    GLYPH,
                  )}
                </Button>
                {groups ? (
                  <Button
                    {...QUIET}
                    onPress={() =>
                      write(catalogFilterSwitched(run.access.tree(), item.id))
                    }
                  >
                    {item.op === "and" ? run.strings.and : run.strings.or}
                  </Button>
                ) : null}
                <GroupMenu
                  group={item}
                  run={run}
                  fields={fields}
                  groups={groups}
                  tree={tree}
                  write={write}
                  at={at}
                />
              </>
            ) : (
              <>
                <FieldMenu
                  trigger={<Button {...QUIET}>{field?.label ?? ""}</Button>}
                  add={(next) => {
                    // (Another field: its start comparison, the value kept only while it means
                    //  the same — §5.5.)
                    at(() => [
                      {
                        ...next,
                        id: item.id,
                        ...(off ? { enabled: false } : {}),
                        ...valueFor(condition!, next.op),
                      },
                    ]);
                    return false;
                  }}
                />
                <ComparisonMenu
                  condition={condition!}
                  trigger={
                    <Button {...QUIET}>{words.ops[condition!.op]}</Button>
                  }
                  write={at}
                />
                {condition!.op === "exists" ||
                condition!.op === "notExists" ? null : (
                  <ValueEditor
                    condition={condition!}
                    trigger={
                      <Button {...QUIET}>
                        {catalogFilterValueText(condition!, words) ||
                          words.unset}
                      </Button>
                    }
                    write={at}
                  />
                )}
                <RowMenu
                  item={item}
                  run={run}
                  groups={groups}
                  tree={tree}
                  write={write}
                  at={at}
                />
              </>
            )}
          </div>
        )}
      </TreeItemContent>
      {children}
    </TreeItem>
  );
}

function MenuButton({ name }: { name: string }): ReactElement {
  return (
    <Button aria-label={name} {...QUIET}>
      {catalogLucideGlyph("ellipsis", GLYPH)}
    </Button>
  );
}

/** The moves of a row's menu (the items its group's order allows). */
function moveItems(
  tree: ViewConditionGroup | undefined,
  id: string,
  run: BarRun,
): ReactNode[] {
  return [
    catalogFilterShifted(tree, id, -1) !== undefined ? (
      <MenuItem key="up" id="up">
        {run.strings.moveUp}
      </MenuItem>
    ) : null,
    catalogFilterShifted(tree, id, 1) !== undefined ? (
      <MenuItem key="down" id="down">
        {run.strings.moveDown}
      </MenuItem>
    ) : null,
  ].filter(Boolean);
}

function RowMenu({
  item,
  run,
  groups,
  tree,
  write,
  at,
}: {
  item: ViewCondition;
  run: BarRun;
  groups: boolean;
  tree: ViewConditionGroup | undefined;
  write: RowContext["write"];
  at: (next: (item: Item) => readonly Item[]) => void;
}): ReactNode {
  const off = item.enabled === false;
  const wrap =
    groups && catalogFilterWrapped(tree, item.id, "probe") !== undefined;
  return (
    <MenuTrigger>
      <MenuButton name={run.strings.actions} />
      <Popover placement="bottom end">
        <Menu
          aria-label={run.strings.actions}
          onAction={(key) => {
            const now = run.access.tree();
            if (key === "duplicate") at((self) => [self, renewed(self)]);
            else if (key === "toggle")
              at(() => {
                const { enabled: _e, ...rest } = item;
                return [off ? rest : { ...rest, enabled: false }];
              });
            else if (key === "wrap")
              write(catalogFilterWrapped(now, item.id, newId()));
            else if (key === "up")
              write(catalogFilterShifted(now, item.id, -1));
            else if (key === "down")
              write(catalogFilterShifted(now, item.id, 1));
            else if (key === "delete") at(() => []);
          }}
        >
          <MenuItem id="duplicate">{run.strings.duplicate}</MenuItem>
          <MenuItem id="toggle">
            {off ? run.strings.turnOn : run.strings.turnOff}
          </MenuItem>
          {wrap ? <MenuItem id="wrap">{run.strings.group}</MenuItem> : null}
          {moveItems(tree, item.id, run)}
          <MenuItem id="delete">{run.strings.remove}</MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

/** A group's menu: add a condition · a group (submenus of the fields), ungroup, move, delete. */
function GroupMenu({
  group,
  run,
  fields,
  groups,
  tree,
  write,
  at,
}: {
  group: ViewConditionGroup;
  run: BarRun;
  fields: readonly CatalogFilterBarField[];
  groups: boolean;
  tree: ViewConditionGroup | undefined;
  write: RowContext["write"];
  at: (next: (item: Item) => readonly Item[]) => void;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const deeper =
    groups && catalogFilterLevelOf(tree, group.id) < CATALOG_FILTER_GROUP_DEPTH;
  const add = (asGroup: boolean) => (field: CatalogFilterBarField) => {
    const condition = newCondition(field);
    setOpen(false);
    if (!condition) return;
    const next = catalogFilterAdded(
      run.access.tree(),
      group.id,
      condition,
      asGroup ? newId() : undefined,
    );
    if (next === undefined) return;
    write(next);
    afterKeyRelease(() =>
      run.setPending({
        id: condition.id,
        step: "comparison",
        place: "builder",
      }),
    );
  };
  return (
    <MenuTrigger isOpen={open} onOpenChange={setOpen}>
      <MenuButton name={run.strings.groupActions} />
      <Popover placement="bottom end">
        <Menu
          aria-label={run.strings.groupActions}
          onAction={(key) => {
            const now = run.access.tree();
            if (key === "ungroup") write(catalogFilterUngrouped(now, group.id));
            else if (key === "duplicate") at((self) => [self, renewed(self)]);
            else if (key === "up")
              write(catalogFilterShifted(now, group.id, -1));
            else if (key === "down")
              write(catalogFilterShifted(now, group.id, 1));
            else if (key === "delete") at(() => []);
          }}
        >
          <SubmenuTrigger>
            <MenuItem id="add">{run.strings.addCondition}</MenuItem>
            <Popover placement="end top">
              <FieldSearch fields={fields} pick={add(false)} />
            </Popover>
          </SubmenuTrigger>
          {deeper ? (
            <SubmenuTrigger>
              <MenuItem id="addGroup">{run.strings.addGroup}</MenuItem>
              <Popover placement="end top">
                <FieldSearch fields={fields} pick={add(true)} />
              </Popover>
            </SubmenuTrigger>
          ) : null}
          <MenuItem id="ungroup">{run.strings.ungroup}</MenuItem>
          <MenuItem id="duplicate">{run.strings.duplicate}</MenuItem>
          {moveItems(tree, group.id, run)}
          <MenuItem id="delete">{run.strings.remove}</MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
