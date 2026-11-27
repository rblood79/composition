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
  lazy,
  Suspense,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from "react";
import { Autocomplete } from "react-aria-components/Autocomplete";
import { ButtonContext } from "react-aria-components/Button";
import { Group } from "react-aria-components/Group";
import { Toolbar } from "react-aria-components/Toolbar";
import { Dialog, DialogTrigger, Heading } from "react-aria-components/Dialog";
import { I18nProvider } from "react-aria-components/I18nProvider";
import { Input } from "react-aria-components/Input";
import { Menu, MenuItem, MenuTrigger } from "react-aria-components/Menu";
import { Popover } from "react-aria-components/Popover";
import { SearchField } from "react-aria-components/SearchField";
import { useFilter } from "react-aria/useFilter";
import { PressResponder } from "react-aria/private/interactions/PressResponder";
import { announce } from "react-aria/private/live-announcer/LiveAnnouncer";
import type { CatalogFilterPreset } from "../document/filterQuery";
import type { ViewComparison, ViewCondition } from "../document/types";
import type {
  CatalogFilterBarAccess,
  CatalogFilterBarField,
} from "./filterBarAccess";
import {
  afterKeyRelease,
  BAR_STRINGS,
  BarRunContext,
  fieldAt,
  fieldItems,
  FilterPlaceContext,
  liveCondition,
  newCondition,
  renewed,
  useScopeTree,
  valueFor,
  type Item,
  type Pending,
} from "./filterBarRun";
import { CATALOG_FILTER_TREE_ID } from "./filterScope";
import { catalogFilterWords } from "./filterWording";
import { catalogFilterTreeWith } from "./filterTreeEdit";
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
          inPlace={props.variant === "builder"}
          presets={
            // (The document holds them checked — `catalogFilterPresetsFit`; a value import would
            //  split that module off the first screen.)
            Array.isArray(props.presets)
              ? (props.presets as CatalogFilterPreset[])
              : []
          }
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
/** The condition builder (Phase 4 — its own chunk: the Tree · drag and drop load when it opens). */
const CatalogFilterBuilder = lazy(() => import("./filterBuilder.components"));

/**
 * The bar: its parts with the run (`parts` — each rendered child with its authored part), the
 * notice of the items its scope left out after them.
 */
function CatalogFilterBarRun({
  access,
  locale,
  inPlace,
  presets,
  parts,
}: {
  access: CatalogFilterBarAccess;
  locale: string;
  /** `variant: "builder"` — the builder in the chips' place (§5.6), no 「Edit conditions」. */
  inPlace: boolean;
  /** Phase 5 (사용자 결정 6) — the author's named sets 「Saved filters」 lists. */
  presets: readonly CatalogFilterPreset[];
  parts: readonly { part: string | undefined; element: ReactElement }[];
}): ReactNode {
  const strings = catalogLocalized(BAR_STRINGS, locale);
  const [pending, setPending] = useState<Pending | undefined>();
  const [builderOpen, setBuilderOpen] = useState(false);
  const tree = useScopeTree(access);
  const refused = useSyncExternalStore(
    access.subscribe,
    access.refused,
    access.refused,
  );
  // (Decision 14 — a change of the applied conditions is announced: their count.)
  const applied = (tree?.items ?? []).length;
  const announced = useRef(applied);
  useEffect(() => {
    if (applied === announced.current) return;
    announced.current = applied;
    announce(strings.applied(applied), "polite");
  }, [applied, strings]);
  const run = useMemo(
    () => ({
      access,
      strings,
      locale,
      pending,
      setPending,
      openBuilder: () => afterKeyRelease(() => setBuilderOpen(true)),
    }),
    [access, strings, locale, pending],
  );
  return (
    <BarRunContext.Provider value={run}>
      {parts.map(({ part, element }) =>
        part === "add" ? (
          <AddFilter key={element.key} trigger={element} />
        ) : part === "edit" ? (
          inPlace ? null : (
            <DialogTrigger
              key={element.key}
              isOpen={builderOpen}
              onOpenChange={setBuilderOpen}
            >
              {element}
              <Popover placement="bottom start">
                <Dialog
                  style={{ padding: 12, minWidth: 360, maxWidth: "90vw" }}
                >
                  <Heading
                    slot="title"
                    style={{ margin: "0 0 8px", fontSize: "1em" }}
                  >
                    {strings.editConditions}
                  </Heading>
                  <FilterBuilderSlot />
                </Dialog>
              </Popover>
            </DialogTrigger>
          )
        ) : part === "chips" && inPlace ? (
          <div key={element.key} style={{ width: "100%" }}>
            <FilterBuilderSlot />
          </div>
        ) : part === "presets" ? (
          <MenuTrigger key={element.key}>
            {element}
            <Popover placement="bottom start">
              <Menu
                aria-label={strings.presets}
                items={presets}
                onAction={(key) => {
                  // (The set as any tree — the scope's one assignment judges it, §5.3.)
                  const preset = presets.find((item) => item.id === key);
                  if (preset) access.write(preset.query);
                }}
              >
                {(preset) => <MenuItem id={preset.id}>{preset.name}</MenuItem>}
              </Menu>
            </Popover>
          </MenuTrigger>
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

/** The builder (lazy), speaking the site's language. */
function FilterBuilderSlot(): ReactNode {
  const run = useContext(BarRunContext)!;
  return (
    <I18nProvider locale={run.locale}>
      <Suspense fallback={null}>
        <CatalogFilterBuilder />
      </Suspense>
    </I18nProvider>
  );
}

/** The fields searched (RAC `Autocomplete` over the field `Menu`) — a menu's popover content. */
export function FieldSearch({
  fields,
  pick,
}: {
  fields: readonly CatalogFilterBarField[];
  pick: (field: CatalogFilterBarField) => void;
}): ReactNode {
  const run = useContext(BarRunContext)!;
  const { contains } = useFilter({ sensitivity: "base" });
  return (
    <Autocomplete filter={contains}>
      <SearchField aria-label={run.strings.searchFields} autoFocus>
        <Input placeholder={run.strings.searchFields} />
      </SearchField>
      <Menu aria-label={run.strings.fields}>{fieldItems(fields, pick)}</Menu>
    </Autocomplete>
  );
}

/**
 * A field menu on `trigger`: the picked field's condition (`newCondition`) goes to `place`'s
 * write, and its comparison menu opens there next.
 */
export function FieldMenu({
  trigger,
  add,
}: {
  trigger: ReactElement;
  /** Writes the new condition (false: not taken — nothing opens next). */
  add: (condition: ViewCondition) => boolean;
}): ReactNode {
  const run = useContext(BarRunContext)!;
  const place = useContext(FilterPlaceContext);
  const [open, setOpen] = useState(false);
  const fields = open ? run.access.fields() : [];
  const pick = (field: CatalogFilterBarField) => {
    const condition = newCondition(field);
    setOpen(false);
    if (!condition || !add(condition)) return;
    afterKeyRelease(() =>
      run.setPending({ id: condition.id, step: "comparison", place }),
    );
  };
  return (
    <MenuTrigger isOpen={open} onOpenChange={setOpen}>
      {trigger}
      <Popover placement="bottom start">
        <FieldSearch fields={fields} pick={pick} />
      </Popover>
    </MenuTrigger>
  );
}

/** 「Add filter」 — the field menu: a field adds its condition, and its comparison menu opens. */
function AddFilter({ trigger }: { trigger: ReactElement }): ReactNode {
  const run = useContext(BarRunContext)!;
  return (
    <FieldMenu
      trigger={trigger}
      add={(condition) => {
        const tree = run.access.tree();
        run.access.write({
          id: tree?.id ?? CATALOG_FILTER_TREE_ID,
          op: "and",
          items: [...(tree?.items ?? []), condition],
        });
        return true;
      }}
    />
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
    run.access.write(
      catalogFilterTreeWith(run.access.tree(), conditionId, next),
    );
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
          onEdit={run.openBuilder}
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
  takes: () => false,
  facet: () => undefined,
  subscribe: () => () => {},
};

/** The chip's pending step (a new condition's comparison menu · a comparison's value editor). */
function usePendingOpen(
  id: string,
  step: Pending["step"],
): [boolean, (open: boolean) => void] {
  const run = useContext(BarRunContext)!;
  const place = useContext(FilterPlaceContext);
  const due = (pending: Pending | undefined) =>
    pending?.id === id && pending.step === step && pending.place === place;
  const isDue = due(run.pending);
  const [open, setOpen] = useState(isDue);
  // (A step due now opens — adjusted while rendering, React's 「state from a change」 pattern.)
  const [seen, setSeen] = useState(run.pending);
  if (run.pending !== seen) {
    setSeen(run.pending);
    if (isDue) setOpen(true);
  }
  useEffect(() => {
    if (isDue) run.setPending(undefined);
  }, [isDue, run]);
  return [open, setOpen];
}

export function ComparisonMenu({
  condition,
  trigger,
  write,
}: {
  condition: ViewCondition;
  trigger: ReactElement;
  write: (next: (item: Item) => readonly Item[]) => void;
}): ReactNode {
  const run = useContext(BarRunContext)!;
  const place = useContext(FilterPlaceContext);
  const [open, setOpen] = usePendingOpen(condition.id, "comparison");
  const words = catalogFilterWords(run.locale);
  // (The scope's condition now — a builder row can hand the one before the last write: a RAC
  //  Tree draws its rows from the collection it built a render before.)
  const now = open ? liveCondition(run.access.tree(), condition) : condition;
  const field = open
    ? fieldAt(run.access.fields(now.id), now.fields[0] ?? [])
    : undefined;
  const ops = field?.ops ?? [now.op];
  return (
    <MenuTrigger isOpen={open} onOpenChange={setOpen}>
      {trigger}
      <Popover placement="bottom start">
        <Menu
          aria-label={run.strings.comparisons}
          selectionMode="single"
          selectedKeys={[now.op]}
          onAction={(key) => {
            const op = key as ViewComparison;
            write((item) => {
              const at = item as ViewCondition;
              const { value: _v, unit: _u, ...rest } = at;
              return [{ ...rest, op, ...valueFor(at, op) }];
            });
            // (A comparison that takes a value opens its editor next — §5.5.)
            if (op !== "exists" && op !== "notExists")
              afterKeyRelease(() =>
                run.setPending({ id: condition.id, step: "value", place }),
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

export function ValueEditor({
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
        // (The scope's condition now — not the one a builder row drew a render before.)
        const now = liveCondition(run.access.tree(), condition);
        const path = now.fields[0] ?? [];
        const field = fieldAt(run.access.fields(now.id), path);
        if (!field) return undefined;
        const facet = run.access.facet(now.id, path);
        return {
          kind: field.kind,
          ops: field.ops.length ? field.ops : [now.op],
          condition: now,
          ...(facet ? { facet } : {}),
        };
      },
      // (「Apply」 — the condition's comparison · value; 「Clear」 — the condition goes.)
      write: (
        written:
          | Pick<ViewCondition, "op" | "value" | "sensitivity" | "unit">
          | undefined,
      ) =>
        write((item) =>
          written
            ? [
                {
                  id: item.id,
                  fields: (item as ViewCondition).fields,
                  ...((item as ViewCondition).enabled === false
                    ? { enabled: false }
                    : {}),
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
  onEdit,
}: {
  item: Item;
  trigger: ReactElement;
  write: (next: (item: Item) => readonly Item[]) => void;
  /** A group chip: 「Edit conditions」 opens the builder (§5.5). */
  onEdit: () => void;
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
            if (key === "edit") onEdit();
            else if (key === "duplicate") write((at) => [at, renewed(at)]);
            else if (key === "toggle" && condition)
              write(() => {
                const { enabled: _e, ...rest } = condition;
                return [off ? rest : { ...rest, enabled: false }];
              });
            else if (key === "delete") write(() => []);
          }}
        >
          {condition ? null : (
            <MenuItem id="edit">{run.strings.editConditions}</MenuItem>
          )}
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
