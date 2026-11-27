/**
 * ADR-320 Phase 3 — the running filter bar's chip line (breakdown §5.5, Decision 7 · 9 · 10 · 14):
 * the bar's authored parts as they render (RAC `Toolbar` · each chip a RAC `Group` — `delegatedDom`)
 * with what they do in a running Preview — 「Add filter」 a field menu (RAC `Autocomplete` over a
 * `Menu`, a reference field's fields in a `SubmenuTrigger`) that adds the condition and opens its
 * comparison menu, a chip's comparison `MenuTrigger`, its value `DialogTrigger` (the Column filter
 * dialog — one editor module, its candidate values the scope's with this condition left out), its
 * condition menu (duplicate · off · on · delete), its remove button and 「Clear」. Every change is
 * the scope's one write (`CatalogFilterBarAccess.write`), announced (react-aria `announce`). The
 * items the scope left out show as a line of text after the bar.
 *
 * D1: RAC parts only — no role · aria literal here (the names are RAC props: `aria-label` of the
 * Menus · the field search). Loads with the first running bar (a lazy chunk — HC5).
 */
import {
  createContext,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from "react";
import { Autocomplete } from "react-aria-components/Autocomplete";
import { ButtonContext } from "react-aria-components/Button";
import { Group } from "react-aria-components/Group";
import { Toolbar } from "react-aria-components/Toolbar";
import { DialogTrigger } from "react-aria-components/Dialog";
import { I18nProvider } from "react-aria-components/I18nProvider";
import { Input } from "react-aria-components/Input";
import {
  Menu,
  MenuItem,
  MenuTrigger,
  SubmenuTrigger,
} from "react-aria-components/Menu";
import { Popover } from "react-aria-components/Popover";
import { SearchField } from "react-aria-components/SearchField";
import { useFilter } from "react-aria/useFilter";
import { PressResponder } from "react-aria/private/interactions/PressResponder";
import { announce } from "react-aria/private/live-announcer/LiveAnnouncer";
import type {
  ViewComparison,
  ViewCondition,
  ViewConditionGroup,
} from "../document/types";
import {
  catalogFilterStartOp,
  type CatalogFilterBarAccess,
  type CatalogFilterBarField,
} from "./filterBarAccess";
import { CATALOG_FILTER_TREE_ID } from "./filterScope";
import { catalogFilterWords } from "./filterWording";

import { catalogFilterPicksMany } from "./tableColumnFilterDraft";
import { catalogLocalized } from "./localizedStrings";

/** What the bar's · a chip's renderer gives its DOM (`delegatedDom` `filterBarDom`). */
interface FilterBarDomProps {
  /** The element's props (its marker · class · style). */
  readonly base: Record<string, unknown>;
  /** The record's props. */
  readonly props: Readonly<Record<string, unknown>>;
  readonly locale: string;
  /** The bar's scope in a running Preview (absent = a static render). */
  readonly access?: () => CatalogFilterBarAccess | undefined;
  /** The children: each one's source (its origin template position) and element. */
  readonly parts: readonly { source: string; element: ReactElement }[];
}

/** Which authored part of the bar · a chip a child is (its origin template position's name). */
const partOf = (source: string): string | undefined =>
  /component-filter(?:bar|chip)__([a-z]+)$/.exec(source)?.[1];
const withParts = (parts: FilterBarDomProps["parts"]) =>
  parts.map(({ source, element }) => ({ part: partOf(source), element }));

/**
 * ADR-320 — a filter bar: RAC `Toolbar` named in the site's language (breakdown §4); in a running
 * Preview its parts run. A disabled bar's buttons are RAC's disabled ones; a disabled · read-only
 * bar runs nothing.
 */
export function CatalogFilterBarDom({
  base,
  props,
  locale,
  access,
  parts,
}: FilterBarDomProps): ReactNode {
  const { isDisabled, isReadOnly } = props;
  const scope = isDisabled || isReadOnly ? undefined : access?.();
  const plain = parts.map((part) => part.element);
  return (
    <Toolbar {...base} aria-label={catalogFilterWords(locale).name}>
      {isDisabled === true ? (
        <ButtonContext.Provider value={{ isDisabled: true }}>
          {plain}
        </ButtonContext.Provider>
      ) : scope ? (
        <CatalogFilterBarRun
          access={scope}
          locale={locale}
          parts={withParts(parts)}
        />
      ) : (
        plain
      )}
    </Toolbar>
  );
}

/** ADR-320 — a chip: RAC `Group` named 「field comparison value」 (its row's — resolver). */
export function CatalogFilterChipDom({
  base,
  props,
  access,
  parts,
}: FilterBarDomProps): ReactNode {
  const conditionId = String(props.conditionId || "");
  return (
    <Group
      {...base}
      aria-label={String(props.label || "")}
      isDisabled={props.isDisabled === true}
    >
      {access && conditionId ? (
        <CatalogFilterChipRun
          conditionId={conditionId}
          parts={withParts(parts)}
        />
      ) : (
        parts.map((part) => part.element)
      )}
    </Group>
  );
}

const CatalogColumnFilterDialog = lazy(
  () => import("./tableColumnFilter.components"),
);

interface BarStrings {
  readonly searchFields: string;
  readonly fields: string;
  readonly comparisons: string;
  readonly actions: string;
  readonly duplicate: string;
  readonly turnOff: string;
  readonly turnOn: string;
  readonly remove: string;
  readonly refused: (count: number) => string;
  readonly applied: (count: number) => string;
}

const BAR_STRINGS: Readonly<Record<string, BarStrings>> = {
  en: {
    searchFields: "Search fields",
    fields: "Fields",
    comparisons: "Comparisons",
    actions: "Condition actions",
    duplicate: "Duplicate",
    turnOff: "Turn off",
    turnOn: "Turn on",
    remove: "Delete",
    refused: (count) =>
      `${count} condition${count === 1 ? "" : "s"} could not be applied`,
    applied: (count) => `${count} condition${count === 1 ? "" : "s"} applied`,
  },
  ko: {
    searchFields: "필드 검색",
    fields: "필드",
    comparisons: "비교",
    actions: "조건 메뉴",
    duplicate: "복제",
    turnOff: "끄기",
    turnOn: "켜기",
    remove: "삭제",
    refused: (count) => `적용하지 못한 조건 ${count}`,
    applied: (count) => `조건 ${count} 개 적용`,
  },
  ja: {
    searchFields: "フィールドを検索",
    fields: "フィールド",
    comparisons: "比較",
    actions: "条件メニュー",
    duplicate: "複製",
    turnOff: "オフ",
    turnOn: "オン",
    remove: "削除",
    refused: (count) => `適用できなかった条件 ${count}`,
    applied: (count) => `条件 ${count} 件を適用`,
  },
  zh: {
    searchFields: "搜索字段",
    fields: "字段",
    comparisons: "比较",
    actions: "条件菜单",
    duplicate: "复制",
    turnOff: "关闭",
    turnOn: "开启",
    remove: "删除",
    refused: (count) => `${count} 个条件未能应用`,
    applied: (count) => `已应用 ${count} 个条件`,
  },
};

type Item = ViewCondition | ViewConditionGroup;
/** The next step a new condition opens (its chip mounts after the write). */
interface Pending {
  readonly id: string;
  readonly step: "comparison" | "value";
}
interface BarRun {
  readonly access: CatalogFilterBarAccess;
  readonly strings: BarStrings;
  readonly locale: string;
  readonly pending: Pending | undefined;
  readonly setPending: (next: Pending | undefined) => void;
}
const BarRunContext = createContext<BarRun | null>(null);

/**
 * A key held down now (document capture). The next step's menu opens after it is released: the
 * Enter that picked a field · a comparison would otherwise press the first item of the menu it
 * opened (RAC menu items act on that key's release).
 */
let keysHeld = 0;
let keyWatch = false;
function afterKeyRelease(open: () => void): void {
  if (!keyWatch && typeof document !== "undefined") {
    keyWatch = true;
    document.addEventListener("keydown", () => (keysHeld = 1), true);
    document.addEventListener("keyup", () => (keysHeld = 0), true);
  }
  if (!keysHeld) return open();
  document.addEventListener("keyup", () => setTimeout(open), {
    once: true,
    capture: true,
  });
}

let newIds = 0;
const newId = () => `filter-bar:${Date.now().toString(36)}-${++newIds}`;

/** An item with fresh ids (a duplicate — a group's items too). */
const renewed = (item: Item): Item =>
  "items" in item
    ? { ...item, id: newId(), items: item.items.map(renewed) }
    : { ...item, id: newId() };

/** The tree with its root item `id` replaced (`undefined` = removed); `null` = no item left. */
function treeWith(
  tree: ViewConditionGroup | undefined,
  id: string,
  next: (item: Item) => readonly Item[],
): ViewConditionGroup | null {
  const items = (tree?.items ?? []).flatMap((item) =>
    item.id === id ? [...next(item)] : [item],
  );
  return items.length
    ? { id: tree?.id ?? CATALOG_FILTER_TREE_ID, op: "and", items }
    : null;
}

/** The scope's tree now, kept in step with its writes. */
function useScopeTree(
  access: CatalogFilterBarAccess,
): ViewConditionGroup | undefined {
  return useSyncExternalStore(access.subscribe, access.tree, access.tree);
}

/** A field of the bar by its path (a reference field's sub field too). */
function fieldAt(
  fields: readonly CatalogFilterBarField[],
  path: readonly string[],
): CatalogFilterBarField | undefined {
  for (const field of fields) {
    if (field.path.join("/") === path.join("/")) return field;
    const sub = field.fields && fieldAt(field.fields, path);
    if (sub) return sub;
  }
  return undefined;
}

/** A value kept across a comparison change only while it means the same (§5.5). */
function valueFor(
  condition: ViewCondition,
  op: ViewComparison,
): Pick<ViewCondition, "value" | "unit"> {
  const { value, unit } = condition;
  if (op === "exists" || op === "notExists" || value === undefined) return {};
  const shape = (at: ViewComparison) =>
    at === "between" || at === "withinLast"
      ? at
      : catalogFilterPicksMany(at)
        ? "many"
        : "one";
  if (shape(op) !== shape(condition.op)) return {};
  return { value, ...(op === "withinLast" && unit ? { unit } : {}) };
}

/**
 * The bar: its parts with the run (`parts` — each rendered child with its authored part), the
 * notice of the items its scope left out after them.
 */
function CatalogFilterBarRun({
  access,
  locale,
  parts,
}: {
  access: CatalogFilterBarAccess;
  locale: string;
  parts: readonly { part: string | undefined; element: ReactElement }[];
}): ReactNode {
  const strings = catalogLocalized(BAR_STRINGS, locale);
  const [pending, setPending] = useState<Pending | undefined>();
  const tree = useScopeTree(access);
  const refused = useSyncExternalStore(
    access.subscribe,
    access.refused,
    access.refused,
  );
  // (Decision 14 — a change of the applied conditions is announced: their count.)
  const applied = (tree?.items ?? []).length;
  const [announced, setAnnounced] = useState(applied);
  useEffect(() => {
    if (applied === announced) return;
    setAnnounced(applied);
    announce(strings.applied(applied), "polite");
  }, [applied, announced, strings]);
  const run = useMemo(
    () => ({ access, strings, locale, pending, setPending }),
    [access, strings, locale, pending],
  );
  return (
    <BarRunContext.Provider value={run}>
      {parts.map(({ part, element }) =>
        part === "add" ? (
          <AddFilter key={element.key} trigger={element} />
        ) : part === "clear" ? (
          <PressResponder key={element.key} onPress={() => access.clear()}>
            {element}
          </PressResponder>
        ) : (
          element
        ),
      )}
      {refused ? (
        <span className="filter-bar-refused">{strings.refused(refused)}</span>
      ) : null}
    </BarRunContext.Provider>
  );
}

/** 「Add filter」 — the field menu: a field adds its condition, and its comparison menu opens. */
function AddFilter({ trigger }: { trigger: ReactElement }): ReactNode {
  const run = useContext(BarRunContext)!;
  const { contains } = useFilter({ sensitivity: "base" });
  const [open, setOpen] = useState(false);
  const fields = open ? run.access.fields() : [];
  const add = (field: CatalogFilterBarField) => {
    const op = catalogFilterStartOp(field.kind, field.ops);
    if (!op) return;
    const id = newId();
    const tree = run.access.tree();
    run.access.write({
      id: tree?.id ?? CATALOG_FILTER_TREE_ID,
      op: "and",
      items: [...(tree?.items ?? []), { id, fields: [[...field.path]], op }],
    });
    setOpen(false);
    afterKeyRelease(() => run.setPending({ id, step: "comparison" }));
  };
  const items = (list: readonly CatalogFilterBarField[]): ReactNode[] =>
    list.map((field) =>
      field.fields ? (
        <SubmenuTrigger key={field.path.join("/")}>
          <MenuItem textValue={field.label}>{field.label}</MenuItem>
          <Popover placement="end top">
            <Menu aria-label={field.label}>
              {[
                ...(field.ops.length
                  ? [
                      <MenuItem
                        key="own"
                        textValue={field.label}
                        onAction={() => add(field)}
                      >
                        {field.label}
                      </MenuItem>,
                    ]
                  : []),
                ...field.fields.map((sub) => (
                  <MenuItem
                    key={sub.path.join("/")}
                    textValue={sub.label}
                    onAction={() => add(sub)}
                  >
                    {sub.label}
                  </MenuItem>
                )),
              ]}
            </Menu>
          </Popover>
        </SubmenuTrigger>
      ) : (
        <MenuItem
          key={field.path.join("/")}
          textValue={field.label}
          onAction={() => add(field)}
        >
          {field.label}
        </MenuItem>
      ),
    );
  return (
    <MenuTrigger isOpen={open} onOpenChange={setOpen}>
      {trigger}
      <Popover placement="bottom start">
        <Autocomplete filter={contains}>
          <SearchField aria-label={run.strings.searchFields} autoFocus>
            <Input placeholder={run.strings.searchFields} />
          </SearchField>
          <Menu aria-label={run.strings.fields}>{items(fields)}</Menu>
        </Autocomplete>
      </Popover>
    </MenuTrigger>
  );
}

/** A chip: its comparison menu, value editor, condition menu and remove button run. */
export function CatalogFilterChipRun({
  conditionId,
  parts,
}: {
  conditionId: string;
  parts: readonly { part: string | undefined; element: ReactElement }[];
}): ReactNode {
  const run = useContext(BarRunContext);
  const tree = useScopeTree(run?.access ?? NO_ACCESS);
  if (!run) return parts.map(({ element }) => element);
  const item = tree?.items.find((entry) => entry.id === conditionId);
  if (!item) return parts.map(({ element }) => element);
  const write = (next: (item: Item) => readonly Item[]) =>
    run.access.write(treeWith(run.access.tree(), conditionId, next));
  return parts.map(({ part, element }) => {
    if (part === "remove")
      return (
        <PressResponder key={element.key} onPress={() => write(() => [])}>
          {element}
        </PressResponder>
      );
    if (part === "menu")
      return (
        <ConditionMenu
          key={element.key}
          item={item}
          trigger={element}
          write={write}
        />
      );
    if ("items" in item) return element;
    if (part === "comparison")
      return (
        <ComparisonMenu
          key={element.key}
          condition={item}
          trigger={element}
          write={write}
        />
      );
    if (part === "value")
      return (
        <ValueEditor
          key={element.key}
          condition={item}
          trigger={element}
          write={write}
        />
      );
    return element;
  });
}

const NO_ACCESS: CatalogFilterBarAccess = {
  fields: () => [],
  tree: () => undefined,
  refused: () => 0,
  write: () => {},
  clear: () => {},
  facet: () => undefined,
  subscribe: () => () => {},
};

/** The chip's pending step (a new condition's comparison menu · a comparison's value editor). */
function usePendingOpen(
  id: string,
  step: Pending["step"],
): [boolean, (open: boolean) => void] {
  const run = useContext(BarRunContext)!;
  const [open, setOpen] = useState(
    () => run.pending?.id === id && run.pending.step === step,
  );
  useEffect(() => {
    if (run.pending?.id === id && run.pending.step === step) {
      setOpen(true);
      run.setPending(undefined);
    }
  }, [run, id, step]);
  return [open, setOpen];
}

function ComparisonMenu({
  condition,
  trigger,
  write,
}: {
  condition: ViewCondition;
  trigger: ReactElement;
  write: (next: (item: Item) => readonly Item[]) => void;
}): ReactNode {
  const run = useContext(BarRunContext)!;
  const [open, setOpen] = usePendingOpen(condition.id, "comparison");
  const words = catalogFilterWords(run.locale);
  const field = open
    ? fieldAt(run.access.fields(), condition.fields[0] ?? [])
    : undefined;
  const ops = field?.ops ?? [condition.op];
  return (
    <MenuTrigger isOpen={open} onOpenChange={setOpen}>
      {trigger}
      <Popover placement="bottom start">
        <Menu
          aria-label={run.strings.comparisons}
          selectionMode="single"
          selectedKeys={[condition.op]}
          onAction={(key) => {
            const op = key as ViewComparison;
            const { value: _v, unit: _u, ...rest } = condition;
            write(() => [{ ...rest, op, ...valueFor(condition, op) }]);
            // (A comparison that takes a value opens its editor next — §5.5.)
            if (op !== "exists" && op !== "notExists")
              afterKeyRelease(() =>
                run.setPending({ id: condition.id, step: "value" }),
              );
          }}
        >
          {ops.map((op) => (
            <MenuItem key={op} id={op} textValue={words.ops[op]}>
              {words.ops[op]}
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

function ValueEditor({
  condition,
  trigger,
  write,
}: {
  condition: ViewCondition;
  trigger: ReactElement;
  write: (next: (item: Item) => readonly Item[]) => void;
}): ReactNode {
  const run = useContext(BarRunContext)!;
  const [open, setOpen] = usePendingOpen(condition.id, "value");
  const access = useMemo(
    () => ({
      read: () => {
        const path = condition.fields[0] ?? [];
        const field = fieldAt(run.access.fields(), path);
        if (!field) return undefined;
        const facet = run.access.facet(condition.id, path);
        return {
          kind: field.kind,
          ops: field.ops.length ? field.ops : [condition.op],
          condition,
          ...(facet ? { facet } : {}),
        };
      },
      // (「Apply」 — the condition's comparison · value; 「Clear」 — the condition goes.)
      write: (
        written:
          | Pick<ViewCondition, "op" | "value" | "sensitivity" | "unit">
          | undefined,
      ) =>
        write(() =>
          written
            ? [
                {
                  id: condition.id,
                  fields: condition.fields,
                  ...(condition.enabled === false ? { enabled: false } : {}),
                  op: written.op,
                  ...(written.value !== undefined
                    ? { value: written.value }
                    : {}),
                  ...(written.sensitivity
                    ? { sensitivity: written.sensitivity }
                    : {}),
                  ...(written.unit ? { unit: written.unit } : {}),
                },
              ]
            : [],
        ),
    }),
    [condition, run, write],
  );
  return (
    <DialogTrigger isOpen={open} onOpenChange={setOpen}>
      {trigger}
      <Popover
        placement="bottom start"
        style={{ padding: 0, width: "auto", minWidth: 0 }}
      >
        {/* (The editor speaks the site's language, as the chips do — not the browser's.) */}
        <I18nProvider locale={run.locale}>
          <Suspense fallback={null}>
            <CatalogColumnFilterDialog
              access={access as never}
              onClose={() => setOpen(false)}
            />
          </Suspense>
        </I18nProvider>
      </Popover>
    </DialogTrigger>
  );
}

function ConditionMenu({
  item,
  trigger,
  write,
}: {
  item: Item;
  trigger: ReactElement;
  write: (next: (item: Item) => readonly Item[]) => void;
}): ReactNode {
  const run = useContext(BarRunContext)!;
  const condition = "items" in item ? undefined : item;
  const off = condition?.enabled === false;
  return (
    <MenuTrigger>
      {trigger}
      <Popover placement="bottom end">
        <Menu
          aria-label={run.strings.actions}
          onAction={(key) => {
            if (key === "duplicate") write((at) => [at, renewed(at)]);
            else if (key === "toggle" && condition)
              write(() => {
                const { enabled: _e, ...rest } = condition;
                return [off ? rest : { ...rest, enabled: false }];
              });
            else if (key === "delete") write(() => []);
          }}
        >
          <MenuItem id="duplicate">{run.strings.duplicate}</MenuItem>
          {condition ? (
            <MenuItem id="toggle">
              {off ? run.strings.turnOn : run.strings.turnOff}
            </MenuItem>
          ) : null}
          <MenuItem id="delete">{run.strings.remove}</MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
