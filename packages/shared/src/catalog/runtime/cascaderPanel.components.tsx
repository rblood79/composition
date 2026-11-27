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
import type { CascaderEntry, CascaderTable } from "./cascader";
import { useCatalogLocalized } from "./localizedStrings";

/**
 * ADR-322 Phase 3 — a Cascader's open content in the `tree` and `drill` modes (breakdown §3): RAC
 * `Popover` > `Dialog` (the field's `DialogTrigger` contexts — named by its trigger) >
 *
 * - `tree`: RAC `Tree` in RAC `Virtualizer` (Phase 0 P4 — 5,000 items drawn whole exceed HC5, the
 *   virtualized tree opens at ×0.07 of the Select baseline); the picked item's ancestors start
 *   expanded; a branch row expands (RAC's arrows · chevron), a leaf row is picked.
 * - `drill`: RAC `Breadcrumbs` (the way back to any level) + a back `Button` + RAC `GridList` of the
 *   current level — a row's action goes into a branch or picks a leaf; the list keeps focus as the
 *   level changes (`autoFocus`).
 *
 * Both lists take `escapeKeyBehavior: "none"` (Phase 0 finding 1 — with a selection, RAC's default
 * spends Esc on clearing it and the popover does not close). Items are known by path id; an item
 * whose key another item carries cannot be picked (`disabledKeys`, Decision 4). The picked value is
 * RAC's single selection (controlled — a branch's selection is not a value and changes nothing).
 */

interface PanelProps {
  readonly table: CascaderTable;
  readonly value: string | null;
  readonly label: string;
  readonly onPick: (key: string) => void;
}

const BACK: Readonly<Record<string, string>> = {
  en: "Back",
  ko: "뒤로",
  ja: "戻る",
  zh: "返回",
};

function usePanel({ table, value, onPick }: PanelProps) {
  const state = useContext(OverlayTriggerStateContext);
  const found = value === null ? [] : (table.byKey.get(value) ?? []);
  const picked = found.length === 1 ? found[0] : undefined;
  const disabled = table.entries
    .filter((entry) => entry.duplicate || entry.isDisabled)
    .map((entry) => entry.pathId);
  const childrenOf = (parent: string | null) =>
    table.entries.filter((entry) => entry.parentPathId === parent);
  const pick = (pathId: unknown) => {
    const entry = table.byPathId.get(String(pathId));
    if (!entry || entry.hasChildren || entry.duplicate || entry.isDisabled)
      return false;
    onPick(entry.key);
    state?.close();
    return true;
  };
  const onSelectionChange = (keys: unknown) => {
    if (keys === "all") return;
    const [first] = [...(keys as Iterable<unknown>)];
    if (first !== undefined) pick(first);
  };
  return { picked, disabled, childrenOf, pick, onSelectionChange };
}

export function CatalogCascaderTree(props: PanelProps): ReactElement {
  const { table, label } = props;
  const { picked, disabled, childrenOf, onSelectionChange } = usePanel(props);
  const ancestors: string[] = [];
  for (
    let at = picked?.parentPathId ?? null;
    at !== null;
    at = table.byPathId.get(at)?.parentPathId ?? null
  )
    ancestors.push(at);
  const items = (parent: CascaderEntry | null): ReactElement[] =>
    childrenOf(parent?.pathId ?? null).map((entry) => (
      <TreeItem key={entry.pathId} id={entry.pathId} textValue={entry.name}>
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
        {entry.hasChildren ? items(entry) : null}
      </TreeItem>
    ));
  return (
    <Popover className="react-aria-Popover cascader-panel">
      <Dialog>
        <Virtualizer
          layout={ListLayout}
          layoutOptions={{ estimatedRowHeight: 32 }}
        >
          <Tree
            aria-label={label}
            // (Focus goes into the list on open — the picked row, else the first: RAC's `autoFocus`.)
            autoFocus={picked ? true : "first"}
            selectionMode="single"
            selectedKeys={picked ? [picked.pathId] : []}
            disabledKeys={disabled}
            defaultExpandedKeys={ancestors}
            escapeKeyBehavior="none"
            onSelectionChange={onSelectionChange}
            style={{ maxHeight: 320, overflow: "auto" }}
          >
            {items(null)}
          </Tree>
        </Virtualizer>
      </Dialog>
    </Popover>
  );
}

export function CatalogCascaderDrill(props: PanelProps): ReactElement {
  const { table, label } = props;
  const { picked, disabled, childrenOf, pick, onSelectionChange } =
    usePanel(props);
  const back = useCatalogLocalized(BACK);
  const [level, setLevel] = useState<string | null>(
    picked?.parentPathId ?? null,
  );
  const parent = level === null ? undefined : table.byPathId.get(level);
  const trail: CascaderEntry[] = [];
  for (let at = parent; at; at = table.byPathId.get(at.parentPathId ?? ""))
    trail.unshift(at);
  return (
    <Popover className="react-aria-Popover cascader-panel">
      <Dialog>
        <Breadcrumbs>
          <Breadcrumb id="">
            <Link onPress={() => setLevel(null)}>{label}</Link>
          </Breadcrumb>
          {trail.map((entry) => (
            <Breadcrumb key={entry.pathId} id={entry.pathId}>
              <Icon iconName="chevron-right" />
              <Link onPress={() => setLevel(entry.pathId)}>{entry.name}</Link>
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
          autoFocus={picked && picked.parentPathId === level ? true : "first"}
          escapeKeyBehavior="none"
          selectionMode="single"
          selectedKeys={
            picked && picked.parentPathId === level ? [picked.pathId] : []
          }
          disabledKeys={disabled}
          onSelectionChange={onSelectionChange}
          onAction={(key) => {
            const entry = table.byPathId.get(String(key));
            if (entry?.hasChildren) setLevel(entry.pathId);
            else pick(key);
          }}
        >
          {childrenOf(level).map((entry) => (
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
          ))}
        </GridList>
      </Dialog>
    </Popover>
  );
}
