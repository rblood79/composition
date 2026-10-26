/**
 * ADR-284 Phase 3 — 「검색 추가」 · 「이 컨트롤로 거르기」: one user action that makes the four parts
 * of a filter a bound list reads (Decision 7 — 기능 이름 하나 = 동작 하나):
 *
 * 1. a control (SearchField · Select · RadioGroup · TagGroup · Checkbox · DatePicker ·
 *    DateRangePicker) — placed before the list, or the one the author picked,
 * 2. a page variable it writes (`stateVariable`, owned by the list's page),
 * 3. its rule — When the control's value changes → Do `setState` the variable to the event value,
 * 4. a condition in the list's view (the built-in `binding.view`, or the shared view it reads)
 *    comparing the field with the variable — the comparison and the value that skips it from the
 *    defaults table (Decision B-7: a picker = 같음 / 그 중 하나, typed text = 포함).
 *
 * Both entry points run the same planner (`catalogFilterCommand`); only the control part differs
 * (insert vs. the existing node), so the variable · rule · condition are the same document. A
 * picker's items come from the field's values, and a single picker gets 「전체」 (`all`) — the
 * value that skips the condition. Everything is one transaction (one Undo).
 *
 * Connections are read back from the document (`catalogFilterConnections`): a condition whose value
 * or `enabled` reads a variable, and the controls whose rules set that variable. Re-entering edits
 * that condition; it never makes a second variable or rule.
 */
import {
  insertCollectionItem,
  insertGroupItem,
} from "../../../../../packages/shared/src/catalog/commands/collections";
import {
  stageOver,
  type CatalogCommand,
  type CatalogCommandPlan,
} from "../../../../../packages/shared/src/catalog/commands/compose";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import { addRecord } from "../../../../../packages/shared/src/catalog/commands/project";
import {
  insertNodes,
  removeTargets,
} from "../../../../../packages/shared/src/catalog/commands/structure";
import {
  addView,
  catalogViewUsers,
  promoteBindingView,
  updateView,
} from "../../../../../packages/shared/src/catalog/commands/views";
import { nodePosition } from "../../../../../packages/shared/src/catalog/resolution/positions";
import { setFields } from "../../../../../packages/shared/src/catalog/commands/fields";
import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import type {
  DataBindingRef,
  EntryId,
  LibraryDefinitionId,
  NodeEntry,
  NodeId,
  NodeParent,
  StateVariableEntry,
  ViewComparison,
  ViewCondition,
  ViewConditionGroup,
  ViewEntry,
  ViewQuery,
} from "../../../../../packages/shared/src/catalog/document/types";
import type { CatalogReader } from "../../../../../packages/shared/src/catalog/transactions/transaction";
import {
  VIEW_COMPARISONS_BY_KIND,
  viewFieldKind,
} from "../../../../../packages/shared/src/collections/view/comparison";
import {
  VIEW_PATH_JOIN,
  viewFieldOf,
  viewRunReferences,
  viewRunSchema,
} from "../../../../../packages/shared/src/collections/view/evaluate";
import { parseRuleValueRef } from "../../../../../packages/shared/src/interactions/valueRef";
import { catalogBindingCommand } from "./dataBindingCommand";
import { catalogParentOfNode } from "./insertParent";
import {
  catalogInteractionsCommand,
  catalogInteractionsOf,
  catalogNewInteraction,
} from "./interactions";
import { catalogItemRowFill } from "./itemInsert";
import {
  catalogCreationProps,
  catalogCreationStyle,
  catalogPaletteDefinitionId,
} from "./paletteInsert";
import {
  catalogCardFieldCommand,
  catalogCardFields,
  catalogRowTemplateId,
} from "./rowTemplate";
import {
  catalogNodePage,
  catalogVariableNameConflict,
  catalogVariableOwner,
} from "./stateVariables";

/** The control shapes 「검색 추가」 offers (breakdown §4 — 입력 · 선택 · 다중 선택 · 체크 · 날짜 · 범위). */
export type CatalogFilterControlKind =
  "text" | "select" | "radio" | "tags" | "check" | "date" | "range";

interface FilterControlSpec {
  /** The palette type placed. */
  readonly type: string;
  /** The When its rule listens to, and the event argument it writes (`!event.<arg>`). */
  readonly trigger: string;
  readonly arg: "value" | "keys";
  /** The variable's type and default (a picker starts on 「전체」). */
  readonly valueType: StateVariableEntry["valueType"];
  readonly defaultValue: StateVariableEntry["defaultValue"];
  /** Its items come from the field's values — the item type, and whether 「전체」 leads. */
  readonly items?: { readonly type: string; readonly all: boolean };
}

/** The picker's 「전체」 item key — the value that skips the condition. */
export const CATALOG_FILTER_ALL = "all";
/** At most this many field values become items (the rest are reachable by typing a filter). */
const ITEM_LIMIT = 20;

export const CATALOG_FILTER_CONTROLS: Readonly<
  Record<CatalogFilterControlKind, FilterControlSpec>
> = {
  text: {
    type: "SearchField",
    trigger: "onChange",
    arg: "value",
    valueType: "string",
    defaultValue: "",
  },
  select: {
    type: "Select",
    trigger: "onChange",
    arg: "value",
    valueType: "string",
    defaultValue: CATALOG_FILTER_ALL,
    items: { type: "ListBoxItem", all: true },
  },
  radio: {
    type: "RadioGroup",
    trigger: "onChange",
    arg: "value",
    valueType: "string",
    defaultValue: CATALOG_FILTER_ALL,
    items: { type: "Radio", all: true },
  },
  tags: {
    type: "TagGroup",
    trigger: "onSelectionChange",
    arg: "keys",
    valueType: "array",
    // (A structured variable's default is `""` — nothing chosen yet, read as `null`.)
    defaultValue: "",
    items: { type: "Tag", all: false },
  },
  check: {
    type: "Checkbox",
    trigger: "onChange",
    arg: "value",
    valueType: "boolean",
    defaultValue: false,
  },
  date: {
    type: "DatePicker",
    trigger: "onChange",
    arg: "value",
    valueType: "object",
    defaultValue: "",
  },
  range: {
    type: "DateRangePicker",
    trigger: "onChange",
    arg: "value",
    valueType: "object",
    defaultValue: "",
  },
};

/** A control type's filter kind (the control entry point); undefined = not a filter control. */
export function catalogFilterKindOfType(
  type: string,
): CatalogFilterControlKind | undefined {
  return (
    Object.keys(CATALOG_FILTER_CONTROLS) as CatalogFilterControlKind[]
  ).find((kind) => CATALOG_FILTER_CONTROLS[kind].type === type);
}

/** A schema field as the planner reads it. */
export interface CatalogFilterField {
  readonly id: string;
  readonly key: string;
  readonly type?: string;
  /** A path through a reference field (`[teamId, name]` — 「team.name」); absent = `[id]`. */
  readonly path?: readonly string[];
  /** A path's value of a row (the target row's field — `viewFieldOf`'s reader). */
  readonly read?: (row: unknown) => unknown;
}

/** A grouped view's field of a group by `field` (a path's result field id joins its steps). */
const groupField = (field: CatalogFilterField) =>
  `data:field:${(field.path ?? [field.id]).join(VIEW_PATH_JOIN)}` as const;

/** A field's stored path (`data:field:` ids — a reference path's steps). */
export const catalogFieldPath = (
  field: CatalogFilterField,
): readonly `data:field:${string}`[] =>
  (field.path ?? [field.id]).map((id) => `data:field:${id}` as const);

/**
 * The fields a list's view can read (ADR-284 Decision 4): its collection's own fields and, for
 * each reference field, the target's fields through it (「teamId.name」 — a condition · a sort ·
 * a grouping on the Teams row a Users row points at).
 */
export function catalogViewFields(
  table:
    | {
        schema?: readonly {
          id?: string;
          key: string;
          type?: string;
          reference?: { collectionId: string; keyField: string };
        }[];
      }
    | undefined,
  collections: readonly {
    id: string;
    schema?: readonly { id?: string; key: string; type?: string }[];
    mockData?: readonly unknown[];
    runtimeData?: readonly unknown[];
    useMockData?: boolean;
  }[],
): CatalogFilterField[] {
  const schema = viewRunSchema(table?.schema);
  const references = viewRunReferences(collections as never);
  const out: CatalogFilterField[] = schema.map(({ id, key, type }) => ({
    id,
    key,
    ...(type ? { type } : {}),
  }));
  for (const field of schema) {
    const target = field.reference && references(field.reference.collectionId);
    for (const step of target?.schema ?? []) {
      // (Not the key it matches — the row holds that value already — nor a further reference.)
      if (step.reference || step.id === field.reference!.keyField) continue;
      const path = [field.id, step.id];
      const read = viewFieldOf(
        path.map((id) => `data:field:${id}` as const),
        schema,
        references,
      )?.read;
      out.push({
        id: path.join("."),
        key: `${field.key}.${step.key}`,
        ...(step.type ? { type: step.type } : {}),
        path,
        ...(read ? { read } : {}),
      });
    }
  }
  return out;
}

/**
 * Decision B-7 — the condition a control kind makes on a field: the comparison (narrowed to what
 * the field's kind takes), the value, the value that skips it, the switch that turns it on.
 */
export function catalogFilterCondition(
  kind: CatalogFilterControlKind,
  field: CatalogFilterField,
  variableRef: string,
  checkValue?: string,
): Omit<ViewCondition, "id" | "fields"> {
  const fieldKind = viewFieldKind(field.type);
  const allowed = VIEW_COMPARISONS_BY_KIND[fieldKind];
  const pick = (op: ViewComparison): ViewComparison =>
    allowed.includes(op) ? op : "equals";
  switch (kind) {
    case "text":
      // (Typed text: 「포함」 on a text field — on a number or date the typed value is matched whole.)
      return {
        op: pick(fieldKind === "text" ? "contains" : "equals"),
        value: variableRef,
      };
    case "select":
    case "radio":
      return { op: "equals", value: variableRef, skip: CATALOG_FILTER_ALL };
    case "tags":
      return { op: pick("oneOf"), value: variableRef };
    case "check":
      // (A checkbox turns a condition on: a yes/no field is 「예」; another field 「= 고른 값」.)
      return {
        op: "equals",
        value: fieldKind === "boolean" ? true : (checkValue ?? ""),
        enabled: variableRef,
      };
    case "date":
      return { op: "equals", value: variableRef };
    case "range":
      return {
        op: pick("between"),
        value: [`${variableRef}.start`, `${variableRef}.end`],
      };
  }
}

/** A field's distinct values in row order (the picker's items), at most `ITEM_LIMIT`. */
export function catalogFieldValues(
  rows: readonly unknown[],
  field: CatalogFilterField,
): string[] {
  const out: string[] = [];
  for (const row of rows) {
    const cell = field.read
      ? field.read(row)
      : row !== null && typeof row === "object"
        ? (row as Record<string, unknown>)[field.key]
        : undefined;
    const values = Array.isArray(cell) ? cell : [cell];
    for (const value of values) {
      if (value === undefined || value === null || value === "") continue;
      const text = String(value);
      if (!out.includes(text)) out.push(text);
      if (out.length >= ITEM_LIMIT) return out;
    }
  }
  return out;
}

export interface CatalogFilterPlan {
  /** The bound list the condition goes in. */
  readonly listId: NodeId;
  readonly field: CatalogFilterField;
  readonly kind: CatalogFilterControlKind;
  /** The control: a new one of `kind` before the list, or an existing node (the control entry). */
  readonly control: { readonly insert: true } | { readonly nodeId: NodeId };
  /** The field's values (a picker's items · a checkbox's value). */
  readonly values: readonly string[];
  /** The 「전체」 item's label (the host's language). */
  readonly allLabel: string;
  /**
   * §9.3-9 — the variable an existing control's rule already sets (the 「변수 + 규칙만」 habit): the
   * condition reads it; no new variable or rule.
   */
  readonly reuseVariableId?:
    EntryId<"stateVariable"> | `data:variable:${string}`;
  readonly label?: string;
}

/** What one 「검색 추가」 made (the confirmation screen reads them). */
export interface CatalogFilterCreated {
  readonly controlId: NodeId;
  readonly variableId: EntryId<"stateVariable">;
  readonly ruleId: EntryId<"interaction">;
  readonly conditionId: string;
}

/** Several commands as one, each planning against the earlier ones' records. */
function sequence(
  label: string,
  steps: readonly ((stage: CatalogReader) => CatalogCommand | undefined)[],
  selectAfter?: readonly NodeId[],
): CatalogCommand {
  return (reader) => {
    const stage = stageOver(reader);
    const ops: CatalogCommandPlan["ops"][number][] = [];
    for (const step of steps) {
      const command = step(stage);
      if (!command) continue;
      const plan = command(stage);
      stage.apply(plan.ops);
      ops.push(...plan.ops);
    }
    return { label, ops, ...(selectAfter ? { selectAfter } : {}) };
  };
}

const typeOf = (reader: CatalogReader, definitionId: string): string => {
  try {
    return definitionTypeName(reader, definitionId as never);
  } catch {
    return "";
  }
};

/** A node parent's child list (to place the control before the list). */
function childIdsOf(
  reader: CatalogReader,
  parent: NodeParent,
): readonly NodeId[] {
  if (parent.kind === "page") {
    const page = reader.getEntry(parent.id);
    return page?.kind === "page" ? page.children : [];
  }
  const owner = reader.getEntry(
    parent.kind === "node" ? parent.id : parent.ownerId,
  );
  if (owner?.kind !== "node") return [];
  if (parent.kind === "node") return owner.children;
  const key = JSON.stringify(parent.address);
  for (const override of owner.descendantOverrides)
    if (
      override.kind === "fillSlot" &&
      JSON.stringify(override.address) === key
    )
      return override.childIds;
  return [];
}

/**
 * A picker's items replaced by the field's values (+ 「전체」 first for a single picker): the item
 * list the placed instance owns (`ownSlotContents`) gets new items of its items' own definition,
 * then its template items go.
 */
function replaceItems(
  controlId: NodeId,
  spec: FilterControlSpec,
  values: readonly string[],
  allLabel: string,
  newId: NewId,
): CatalogCommand | undefined {
  const items = spec.items;
  if (!items) return undefined;
  return (reader) => {
    const stage = stageOver(reader);
    const ops: CatalogCommandPlan["ops"][number][] = [];
    const run = (command: CatalogCommand) => {
      const plan = command(stage);
      stage.apply(plan.ops);
      ops.push(...plan.ops);
    };
    const control = stage.getEntry(controlId);
    if (control?.kind !== "node") return { label: "Items", ops };
    for (const override of control.descendantOverrides) {
      if (override.kind !== "fillSlot") continue;
      const old = override.childIds.filter((id) => {
        const node = stage.getEntry(id);
        return (
          node?.kind === "node" &&
          typeOf(stage, node.definitionId) === items.type
        );
      });
      if (!old.length) continue;
      const shape = (stage.getEntry(old[0]!) as NodeEntry).definitionId;
      // (「전체」 is the chosen one — the variable's default; a picker's selection is its item's
      // `isSelected`, as the Design panel's Value writes it.)
      const entries: { key: string; label: string; selected?: true }[] = [
        ...(items.all
          ? [
              {
                key: CATALOG_FILTER_ALL,
                label: allLabel,
                selected: true as const,
              },
            ]
          : []),
        ...values.map((value) => ({ key: value, label: value })),
      ];
      for (const { key, label, selected } of entries) {
        const id = newId("node") as NodeId;
        const lib = shape.startsWith("lib:");
        const props = (initial: Record<string, unknown>) =>
          lib
            ? catalogCreationProps(
                stage.library,
                shape as LibraryDefinitionId,
                items.type,
                initial,
              )
            : Object.fromEntries(
                Object.entries(initial).map(([name, value]) => [
                  name,
                  { kind: "set" as const, value: value as never },
                ]),
              );
        if (items.type === "Radio") {
          const entry: NodeEntry = {
            kind: "node",
            id,
            definitionId: shape,
            children: [],
            props: props({
              value: key,
              children: label,
              ...(selected ? { isSelected: true } : {}),
            }),
            visual: {},
            sizing: {},
            descendantOverrides: [],
          };
          run(
            insertGroupItem({
              hostId: controlId,
              entries: [entry],
              rootId: id,
              newId,
            }),
          );
          continue;
        }
        const fill = catalogItemRowFill(stage.library, shape, label);
        const entry: NodeEntry = {
          kind: "node",
          id,
          definitionId: shape,
          children: [],
          props: props({
            id: key,
            ...fill.props,
            ...(selected ? { isSelected: true } : {}),
          }),
          visual: {},
          sizing: {},
          descendantOverrides: fill.patches(id),
        };
        run(
          insertCollectionItem({
            host: {
              kind: "descendant",
              ownerId: controlId,
              address: override.address,
            },
            entries: [entry],
            rootId: id,
            key,
            newId,
          }),
        );
      }
      run(
        removeTargets({
          targets: old.map((id) => ({ kind: "node" as const, id })),
        }),
      );
    }
    return { label: "Items", ops };
  };
}

/** The view a list's binding reads: its built-in one, or the shared one it points at. */
function viewOf(
  reader: CatalogReader,
  binding: DataBindingRef,
): { shared?: ViewEntry; query: ViewQuery } {
  if (binding.viewId) {
    const shared = reader.getEntry(binding.viewId);
    if (shared?.kind === "view") return { shared, query: shared };
  }
  return {
    query: binding.view ?? { where: { id: "where", op: "and", items: [] } },
  };
}

/** A view query with its root group's items changed (`and` root kept). */
const withItems = (
  query: ViewQuery,
  items: ViewConditionGroup["items"],
): ViewQuery => ({ ...query, where: { ...query.where, items } });

/** Write a list's view — its built-in one in the binding, or the shared view entry. */
function writeView(
  reader: CatalogReader,
  listId: NodeId,
  change: (query: ViewQuery) => ViewQuery,
): CatalogCommand {
  const list = reader.getEntry(listId);
  const binding = list?.kind === "node" ? list.binding : undefined;
  if (!binding) throw new Error(`NOT_BOUND: ${listId}`);
  const { shared, query } = viewOf(reader, binding);
  if (shared) {
    const next = change(query);
    return updateView({
      entry: {
        ...shared,
        where: next.where,
        ...(next.sort ? { sort: next.sort } : {}),
      },
    });
  }
  return catalogBindingCommand([{ kind: "node", id: listId }], {
    ...binding,
    view: change(query),
  });
}

/** A unique variable name on the owner's chain (`<field>Filter`, `<field>Filter2`, …). */
function variableName(
  reader: CatalogReader,
  ownerId: Parameters<typeof catalogVariableNameConflict>[1],
  field: CatalogFilterField,
): string {
  const base = `${field.key.replace(/[^A-Za-z0-9_]/g, "") || "field"}Filter`;
  for (let n = 1; ; n++) {
    const name = n === 1 ? base : `${base}${n}`;
    if (!catalogVariableNameConflict(reader as never, ownerId, name))
      return name;
  }
}

/**
 * 「검색 추가」 (a new control) · 「이 컨트롤로 거르기」 (an existing one) as one command. `created`
 * holds the ids it makes (the confirmation screen opens on them).
 */
export function catalogFilterCommand(
  graph: Pick<CatalogGraph, "library"> & CatalogReader,
  plan: CatalogFilterPlan,
  newId: NewId,
): { command: CatalogCommand; created: CatalogFilterCreated } {
  const spec = CATALOG_FILTER_CONTROLS[plan.kind];
  const controlId =
    "nodeId" in plan.control ? plan.control.nodeId : (newId("node") as NodeId);
  const reuse = plan.reuseVariableId;
  const variableId = (reuse ??
    newId("stateVariable")) as EntryId<"stateVariable">;
  const conditionId = `filter-${(reuse ? newId("stateVariable") : variableId).slice(-8)}`;
  const variableRef = `!var.${variableId}`;
  const steps: ((stage: CatalogReader) => CatalogCommand | undefined)[] = [];
  if ("insert" in plan.control) {
    steps.push((stage) => {
      const parent = catalogParentOfNode(stage, plan.listId);
      if (!parent) throw new Error(`NO_PARENT: ${plan.listId}`);
      const definitionId = catalogPaletteDefinitionId(stage.library, spec.type);
      const accepts =
        (
          stage.library.definitions.get(definitionId as LibraryDefinitionId) as
            { accepts?: Record<string, unknown> } | undefined
        )?.accepts ?? {};
      const initial: Record<string, unknown> = {};
      // (The field's name labels it; a checkbox says what it turns on.)
      if ("label" in accepts) initial.label = plan.field.key;
      if (plan.kind === "check")
        initial.children =
          viewFieldKind(plan.field.type) === "boolean"
            ? plan.field.key
            : `${plan.field.key} = ${plan.values[0] ?? ""}`;
      const entry: NodeEntry = {
        kind: "node",
        id: controlId,
        definitionId,
        children: [],
        props: definitionId.startsWith("lib:")
          ? catalogCreationProps(
              stage.library,
              definitionId as LibraryDefinitionId,
              spec.type,
              initial,
            )
          : {},
        visual: {},
        sizing: {},
        descendantOverrides: [],
      };
      return insertNodes({
        parent,
        index: childIdsOf(stage, parent).indexOf(plan.listId),
        entries: [entry],
        rootIds: [controlId],
        newId,
      });
    });
    steps.push(() =>
      replaceItems(controlId, spec, plan.values, plan.allLabel, newId),
    );
  }
  steps.push((stage) => {
    if (reuse) return undefined;
    const ownerId =
      catalogNodePage(stage as never, plan.listId) ??
      catalogVariableOwner(stage as never, plan.listId);
    return addRecord({
      entry: {
        kind: "stateVariable",
        id: variableId,
        ownerId,
        name: variableName(stage, ownerId, plan.field),
        valueType: spec.valueType,
        defaultValue: spec.defaultValue,
      } satisfies StateVariableEntry,
    });
  });
  // (The rule entry is made here: its id is the confirmation's, whatever the planning reads.)
  const owner = { ownerId: controlId };
  const rule = catalogNewInteraction(
    owner,
    spec.trigger,
    {
      opcode: "setState",
      variableId,
      op: "set",
      value: `!event.${spec.arg}`,
    },
    newId,
  );
  steps.push((stage) =>
    reuse
      ? undefined
      : catalogInteractionsCommand(
          owner,
          [...catalogInteractionsOf(stage as never, owner), rule],
          "Rules",
        ),
  );
  steps.push((stage) =>
    writeView(stage, plan.listId, (query) =>
      withItems(query, [
        ...query.where.items,
        {
          id: conditionId,
          fields: [catalogFieldPath(plan.field)],
          ...catalogFilterCondition(
            plan.kind,
            plan.field,
            variableRef,
            plan.values[0],
          ),
        } as ViewCondition,
      ]),
    ),
  );
  // (No selection change: the list — or the control — stays selected, its confirmation in view.)
  const command = sequence(plan.label ?? "Add filter", steps);
  return {
    command,
    created: {
      controlId,
      variableId,
      // (A reused variable keeps the control's own rule.)
      ruleId: reuse
        ? ((catalogFilterRuleOf(graph, controlId, reuse) ??
            rule.id) as EntryId<"interaction">)
        : rule.id,
      conditionId,
    },
  };
}

/** One filter connection: a condition, the variable it reads, the controls that set the variable. */
export interface CatalogFilterConnection {
  readonly listId: NodeId;
  readonly condition: ViewCondition;
  /** The shared view the condition is in (absent = the list's built-in view). */
  readonly viewId?: EntryId<"view">;
  readonly variable?: StateVariableEntry;
  readonly controls: readonly {
    readonly nodeId: NodeId;
    readonly ruleId: EntryId<"interaction">;
  }[];
}

/** The `!var` ids a condition reads (its value(s) and `enabled`). */
function conditionVariables(condition: ViewCondition): string[] {
  const out: string[] = [];
  const add = (value: unknown) => {
    const ref = parseRuleValueRef(value);
    if (ref?.from === "var" && !out.includes(ref.variableId))
      out.push(ref.variableId);
  };
  if (Array.isArray(condition.value)) condition.value.forEach(add);
  else add(condition.value);
  add(condition.enabled);
  return out;
}

/** A list's filter connections, in condition order (nested `or` groups too). */
export function catalogFilterConnections(
  reader: CatalogReader,
  listId: NodeId,
): CatalogFilterConnection[] {
  const list = reader.getEntry(listId);
  const binding = list?.kind === "node" ? list.binding : undefined;
  if (!binding) return [];
  const { shared, query } = viewOf(reader, binding);
  const out: CatalogFilterConnection[] = [];
  let pageRules: string[] | undefined;
  const visit = (item: ViewCondition | ViewConditionGroup) => {
    if ("items" in item) {
      item.items.forEach(visit);
      return;
    }
    let variable: StateVariableEntry | undefined;
    const controls: { nodeId: NodeId; ruleId: EntryId<"interaction"> }[] = [];
    for (const variableId of conditionVariables(item)) {
      const entry = reader.getEntry(variableId);
      if (entry?.kind === "stateVariable") variable ??= entry;
      // (A project variable (`data:variable:`) is outside the reference index — Phase 0 probe 3:
      // its writers are found among the page's rules.)
      const writers = variableId.startsWith("data:variable:")
        ? (pageRules ??= rulesOnPage(reader, listId))
        : [...reader.referrersOf(variableId)];
      for (const id of writers) {
        const rule = reader.getEntry(id);
        if (
          rule?.kind === "interaction" &&
          rule.actions.some(
            (action) =>
              action.opcode === "setState" && action.variableId === variableId,
          ) &&
          !controls.some((control) => control.ruleId === rule.id)
        )
          controls.push({ nodeId: rule.ownerId, ruleId: rule.id });
      }
    }
    out.push({
      listId,
      condition: item,
      ...(shared ? { viewId: shared.id } : {}),
      ...(variable ? { variable } : {}),
      controls,
    });
  };
  visit(query.where);
  return out;
}

/** The nodes on a node's page, in document order (owned nodes and slot contents). */
function nodesOnPage(reader: CatalogReader, nodeId: NodeId): NodeId[] {
  const pageId = catalogNodePage(reader as never, nodeId);
  const page = pageId ? reader.getEntry(pageId) : undefined;
  if (page?.kind !== "page") return [];
  const out: NodeId[] = [];
  const visit = (id: NodeId) => {
    const node = reader.getEntry(id);
    if (node?.kind !== "node") return;
    out.push(id);
    node.children.forEach(visit);
    for (const override of node.descendantOverrides)
      if (override.kind === "fillSlot") override.childIds.forEach(visit);
  };
  page.children.forEach(visit);
  return out;
}

/** The rules owned by the nodes on a node's page. */
function rulesOnPage(reader: CatalogReader, nodeId: NodeId): string[] {
  return nodesOnPage(reader, nodeId).flatMap((id) =>
    [...reader.referrersOf(id)].filter((ref) => {
      const entry = reader.getEntry(ref);
      return entry?.kind === "interaction" && entry.ownerId === id;
    }),
  );
}

/** The bound lists on a page (the control entry point's targets), in document order. */
export function catalogFilterTargets(
  reader: CatalogReader,
  pageId: EntryId<"page">,
): NodeId[] {
  const page = reader.getEntry(pageId);
  if (page?.kind !== "page") return [];
  const out: NodeId[] = [];
  const visit = (id: NodeId) => {
    const node = reader.getEntry(id);
    if (node?.kind !== "node") return;
    if (node.binding) out.push(id);
    node.children.forEach(visit);
    for (const override of node.descendantOverrides)
      if (override.kind === "fillSlot") override.childIds.forEach(visit);
  };
  page.children.forEach(visit);
  return out;
}

/** A control's connections: the conditions (on the page's lists) its rules feed. */
export function catalogControlFilterConnections(
  reader: CatalogReader,
  controlId: NodeId,
): CatalogFilterConnection[] {
  const pageId = catalogNodePage(reader as never, controlId);
  if (!pageId) return [];
  return catalogFilterTargets(reader, pageId).flatMap((listId) =>
    catalogFilterConnections(reader, listId).filter((connection) =>
      connection.controls.some((control) => control.nodeId === controlId),
    ),
  );
}

/** A condition changed in place (its comparison · skip value) — the confirmation's 「고치기」. */
export function catalogEditFilterCondition(
  reader: CatalogReader,
  listId: NodeId,
  conditionId: string,
  patch: Partial<Pick<ViewCondition, "op" | "skip" | "value" | "sensitivity">>,
): CatalogCommand {
  const edit = (item: ViewCondition | ViewConditionGroup): typeof item =>
    "items" in item
      ? { ...item, items: item.items.map(edit) }
      : item.id === conditionId
        ? (() => {
            const next: ViewCondition = { ...item, ...patch };
            // (No skip value: the condition skips on an empty value — the default.)
            if (patch.skip === undefined && "skip" in patch)
              delete (next as { skip?: unknown }).skip;
            return next;
          })()
        : item;
  return sequence("Edit filter", [
    (stage) =>
      writeView(stage, listId, (query) => ({
        ...query,
        where: edit(query.where) as ViewConditionGroup,
      })),
  ]);
}

/**
 * 「연결 해제」 — the condition leaves the list's view. The variable, the rule and the control stay
 * (they may feed another list; deleting them is their own action with its usage check).
 */
export function catalogRemoveFilterCondition(
  reader: CatalogReader,
  listId: NodeId,
  conditionId: string,
): CatalogCommand {
  const drop = (group: ViewConditionGroup): ViewConditionGroup => ({
    ...group,
    items: group.items
      .filter((item) => "items" in item || item.id !== conditionId)
      .map((item) => ("items" in item ? drop(item) : item))
      // (An `or` left empty goes too — the document refuses an empty `or`.)
      .filter((item) => !("items" in item) || item.items.length > 0),
  });
  return sequence("Remove filter", [
    (stage) =>
      writeView(stage, listId, (query) => ({
        ...query,
        where: drop(query.where),
      })),
  ]);
}

/**
 * 「또는 조건 추가」 (§9.4-4) — the condition is wrapped in an `or` group with a copy the author
 * edits next (another field · comparison); the root stays `and`.
 */
export function catalogOrFilterCondition(
  reader: CatalogReader,
  listId: NodeId,
  conditionId: string,
  newConditionId: string,
): CatalogCommand {
  const wrap = (item: ViewCondition | ViewConditionGroup): typeof item => {
    if ("items" in item) return { ...item, items: item.items.map(wrap) };
    if (item.id !== conditionId) return item;
    return {
      id: `or-${newConditionId}`,
      op: "or",
      items: [item, { ...item, id: newConditionId }],
    };
  };
  return sequence("Add or filter", [
    (stage) =>
      writeView(stage, listId, (query) => ({
        ...query,
        where: wrap(query.where) as ViewConditionGroup,
      })),
  ]);
}

/** The Columns a Table owns (its header's own nodes — Quick Connect's or the palette's). */
function ownedColumns(reader: CatalogReader, tableId: NodeId): NodeId[] {
  const out: NodeId[] = [];
  const visit = (id: NodeId, depth: number) => {
    const node = reader.getEntry(id);
    if (node?.kind !== "node" || depth > 3) return;
    if (typeOf(reader, node.definitionId) === "Column") {
      out.push(id);
      return;
    }
    node.children.forEach((child) => visit(child, depth + 1));
    for (const override of node.descendantOverrides)
      if (override.kind === "fillSlot")
        override.childIds.forEach((child) => visit(child, depth + 1));
  };
  visit(tableId, 0);
  return out;
}

/**
 * ADR-284 「정렬 따라가기」 (Decision 5 · §9.4-6) — one action: a page variable holds the sort, the
 * Table's header press writes it (its `onSortChange` rule — the RAC `SortDescriptor`), and the
 * Table's view and each follower's view sort by it. The Table's own Columns become sortable. A Table
 * sorted so is the variable's: its arrow is the variable's, no runtime sort of its own (사용자
 * 결정 2 — a Table without a sort variable keeps ADR-257's).
 */
export function catalogSortFollowCommand(
  graph: Pick<CatalogGraph, "library"> & CatalogReader,
  plan: {
    readonly tableId: NodeId;
    readonly followerIds: readonly NodeId[];
    readonly label?: string;
  },
  newId: NewId,
): {
  command: CatalogCommand;
  created: {
    variableId: EntryId<"stateVariable">;
    ruleId: EntryId<"interaction">;
  };
} {
  const variableId = newId("stateVariable") as EntryId<"stateVariable">;
  const owner = { ownerId: plan.tableId };
  const rule = catalogNewInteraction(
    owner,
    "onSortChange",
    { opcode: "setState", variableId, op: "set", value: "!event.descriptor" },
    newId,
  );
  const sortBy = (query: ViewQuery): ViewQuery => ({
    ...query,
    sort: { variableId },
  });
  const steps: ((stage: CatalogReader) => CatalogCommand | undefined)[] = [
    (stage) => {
      const ownerId =
        catalogNodePage(stage as never, plan.tableId) ??
        catalogVariableOwner(stage as never, plan.tableId);
      let name = "tableSort";
      for (
        let n = 2;
        catalogVariableNameConflict(stage as never, ownerId, name);
        n++
      )
        name = `tableSort${n}`;
      return addRecord({
        entry: {
          kind: "stateVariable",
          id: variableId,
          ownerId,
          name,
          valueType: "object",
          defaultValue: "",
        } satisfies StateVariableEntry,
      });
    },
    (stage) =>
      catalogInteractionsCommand(
        owner,
        [...catalogInteractionsOf(stage as never, owner), rule],
        "Rules",
      ),
    (stage) => {
      const columns = ownedColumns(stage, plan.tableId);
      return columns.length
        ? setFields({
            targets: columns.map((id) => ({ kind: "node" as const, id })),
            props: { allowsSorting: { kind: "set", value: true } },
          })
        : undefined;
    },
    ...[plan.tableId, ...plan.followerIds].map(
      (id) => (stage: CatalogReader) => writeView(stage, id, sortBy),
    ),
  ];
  return {
    command: sequence(plan.label ?? "Follow sort", steps),
    created: { variableId, ruleId: rule.id },
  };
}

/** The rule of a control that sets a variable (the connection's control side). */
function catalogFilterRuleOf(
  reader: CatalogReader,
  controlId: NodeId,
  variableId: string,
): string | undefined {
  for (const id of reader.referrersOf(controlId)) {
    const rule = reader.getEntry(id);
    if (
      rule?.kind === "interaction" &&
      rule.ownerId === controlId &&
      rule.actions.some(
        (action) =>
          action.opcode === "setState" && action.variableId === variableId,
      )
    )
      return rule.id;
  }
  return undefined;
}

/** Every variable a view reads (its conditions and its sort variable). */
function viewVariables(query: ViewQuery): string[] {
  const out: string[] = [];
  const visit = (item: ViewCondition | ViewConditionGroup) => {
    if ("items" in item) item.items.forEach(visit);
    else out.push(...conditionVariables(item));
  };
  visit(query.where);
  if (query.sort && "variableId" in query.sort) out.push(query.sort.variableId);
  return out;
}

/**
 * §9.3-9 (B 습관) — the controls on a list's page whose rule sets a variable no list on the page
 * reads: the author made the variable and the rule by hand and nothing narrows. The list's section
 * names them and offers 「이 목록의 조건으로 연결」 (`reuseVariableId`).
 */
export function catalogUnreadFilterVariables(
  reader: CatalogReader,
  listId: NodeId,
): { variableId: string; name: string; controlId: NodeId; ruleId: string }[] {
  const pageId = catalogNodePage(reader as never, listId);
  if (!pageId) return [];
  const read = new Set<string>();
  for (const id of catalogFilterTargets(reader, pageId)) {
    const node = reader.getEntry(id);
    const binding = node?.kind === "node" ? node.binding : undefined;
    if (binding)
      viewVariables(viewOf(reader, binding).query).forEach((v) => read.add(v));
  }
  const out: {
    variableId: string;
    name: string;
    controlId: NodeId;
    ruleId: string;
  }[] = [];
  for (const ruleId of rulesOnPage(reader, listId)) {
    const rule = reader.getEntry(ruleId);
    if (rule?.kind !== "interaction") continue;
    const owner = reader.getEntry(rule.ownerId);
    let filterControl = false;
    if (owner?.kind === "node")
      filterControl = !!catalogFilterKindOfType(
        typeOf(reader, owner.definitionId),
      );
    if (!filterControl) continue;
    for (const action of rule.actions) {
      if (action.opcode !== "setState" || read.has(action.variableId)) continue;
      if (out.some((item) => item.variableId === action.variableId)) continue;
      const variable = reader.getEntry(action.variableId);
      out.push({
        variableId: action.variableId,
        name:
          variable?.kind === "stateVariable"
            ? variable.name
            : action.variableId.replace(/^data:variable:/, ""),
        controlId: rule.ownerId,
        ruleId: rule.id,
      });
    }
  }
  return out;
}

/**
 * 「이 목록에서만」 (Decision 7) — the list leaves its shared view: its built-in view becomes a copy
 * of the shared view's conditions and sort; the shared view and its other users stay as they are.
 * A shared view derived from another view (or with grouping) cannot be copied into a built-in one
 * (Decision 1 · 3) — refused.
 */
export function catalogSplitSharedView(
  reader: CatalogReader,
  listId: NodeId,
): CatalogCommand {
  const list = reader.getEntry(listId);
  const binding = list?.kind === "node" ? list.binding : undefined;
  const shared = binding ? viewOf(reader, binding).shared : undefined;
  if (!binding || !shared) throw new Error(`NOT_SHARED: ${listId}`);
  if ("viewId" in shared.source || shared.groupBy || shared.aggregates?.length)
    throw new Error(`VIEW_NOT_SPLITTABLE: ${shared.id}`);
  const { viewId: _shared, ...rest } = binding;
  return catalogBindingCommand([{ kind: "node", id: listId }], {
    ...rest,
    view: {
      where: shared.where,
      ...(shared.sort ? { sort: shared.sort } : {}),
    },
  });
}

/**
 * 「이름 붙여 공유」 — the list's built-in view becomes a named shared view (`promoteBindingView`),
 * and the other lists (bound to the same collection) read it instead of their own.
 */
export function catalogShareView(
  reader: CatalogReader,
  plan: {
    readonly listId: NodeId;
    readonly name: string;
    readonly otherIds: readonly NodeId[];
  },
  newId: NewId,
): CatalogCommand {
  const viewId = newId("view") as EntryId<"view">;
  return sequence("Share view", [
    () =>
      promoteBindingView({ nodeId: plan.listId, id: viewId, name: plan.name }),
    ...plan.otherIds.map((otherId) => (stage: CatalogReader) => {
      const other = stage.getEntry(otherId);
      const binding = other?.kind === "node" ? other.binding : undefined;
      if (!binding) throw new Error(`NOT_BOUND: ${otherId}`);
      const { view: _own, ...rest } = binding;
      return catalogBindingCommand([{ kind: "node", id: otherId }], {
        ...rest,
        viewId,
      });
    }),
  ]);
}

/** A list's shared view and the nodes · views that read it (「이 보기를 N 개가 봅니다」). */
export function catalogSharedViewOf(
  reader: CatalogReader,
  listId: NodeId,
): { view: ViewEntry; users: string[] } | undefined {
  const list = reader.getEntry(listId);
  const binding = list?.kind === "node" ? list.binding : undefined;
  const shared = binding ? viewOf(reader, binding).shared : undefined;
  return shared
    ? { view: shared, users: catalogViewUsers(reader as never, shared.id) }
    : undefined;
}

// ── Phase 4 — derived views: 「결과 수 표시」 · 「묶기로 목록 만들기」 · 「묶기로 열 만들기」 ──

/** The count aggregate's name in a derived view's rows (`{count}` in a text). */
export const CATALOG_COUNT_FIELD = "count";
const EMPTY_WHERE: ViewConditionGroup = { id: "where", op: "and", items: [] };
const COUNT = [{ fn: "count" as const, as: CATALOG_COUNT_FIELD }];
/** The one row of a count without grouping (`getItemKey` — a row without an id is `row-N`). */
const COUNT_ROW_KEY = "row-1";

export interface CatalogDerivedPlan {
  /** The bound list the derived view reads. */
  readonly listId: NodeId;
  /** The shared view's name when the list's built-in view is promoted (「<목록> 보기」). */
  readonly viewName: string;
  readonly label?: string;
}

/**
 * The view a derived view reads: the list's shared view, or its built-in view promoted to one
 * (review round 3 M2 — never a copy of its conditions: a condition added to the list later reaches
 * the count). The promotion is a step of the same command (one Undo).
 */
function derivedSource(
  reader: CatalogReader,
  plan: CatalogDerivedPlan,
  newId: NewId,
): {
  binding: DataBindingRef;
  sourceId: EntryId<"view">;
  step?: () => CatalogCommand;
} {
  const list = reader.getEntry(plan.listId);
  const binding = list?.kind === "node" ? list.binding : undefined;
  if (!binding) throw new Error(`NOT_BOUND: ${plan.listId}`);
  if (binding.viewId) return { binding, sourceId: binding.viewId };
  const sourceId = newId("view") as EntryId<"view">;
  return {
    binding,
    sourceId,
    step: () =>
      promoteBindingView({
        nodeId: plan.listId,
        id: sourceId,
        name: plan.viewName,
      }),
  };
}

/** A palette node (`type`) with creation props · style and an optional binding. */
function paletteNode(
  reader: CatalogReader,
  id: NodeId,
  type: string,
  initial: Record<string, unknown>,
  extra: Partial<NodeEntry> = {},
): NodeEntry {
  const definitionId = catalogPaletteDefinitionId(reader.library, type);
  const { style, ...props } = initial;
  return {
    kind: "node",
    id,
    definitionId,
    children: [],
    props: definitionId.startsWith("lib:")
      ? catalogCreationProps(
          reader.library,
          definitionId as LibraryDefinitionId,
          type,
          props,
        )
      : {},
    ...catalogCreationStyle(style ? { style } : undefined),
    descendantOverrides: [],
    ...extra,
  };
}

/** Insert entries next to the list (`after`: right after it, else right before it). */
function insertNextTo(
  listId: NodeId,
  entries: readonly NodeEntry[],
  rootId: NodeId,
  after: boolean,
  newId: NewId,
) {
  return (stage: CatalogReader) => {
    const parent = catalogParentOfNode(stage, listId);
    if (!parent) throw new Error(`NO_PARENT: ${listId}`);
    return insertNodes({
      parent,
      index: childIdsOf(stage, parent).indexOf(listId) + (after ? 1 : 0),
      entries: [...entries],
      rootIds: [rootId],
      newId,
    });
  };
}

/** A derived view entry over `sourceId`. */
const derivedView = (
  id: EntryId<"view">,
  name: string,
  sourceId: EntryId<"view">,
  query: ViewQuery,
): ViewEntry => ({
  kind: "view",
  id,
  name,
  source: { viewId: sourceId },
  ...query,
});

/**
 * 「결과 수 표시」 (Decision 7 · G4) — a Text before the list showing how many rows its view gives:
 * a derived view (`count` over the list's view) and the Text reading its one row (`binding.key`).
 * `text` holds `{count}` (the host's language — 「{count}개」).
 */
export function catalogResultCountCommand(
  reader: CatalogReader,
  plan: CatalogDerivedPlan & { readonly text: string },
  newId: NewId,
): {
  command: CatalogCommand;
  created: { textId: NodeId; viewId: EntryId<"view"> };
} {
  const source = derivedSource(reader, plan, newId);
  const viewId = newId("view") as EntryId<"view">;
  const textId = newId("node") as NodeId;
  const steps: ((stage: CatalogReader) => CatalogCommand | undefined)[] = [];
  if (source.step) steps.push(source.step);
  steps.push(() =>
    addView({
      entry: derivedView(viewId, `${plan.viewName} · count`, source.sourceId, {
        where: EMPTY_WHERE,
        aggregates: COUNT,
      }),
    }),
  );
  steps.push((stage) =>
    insertNextTo(
      plan.listId,
      [
        paletteNode(
          stage,
          textId,
          "Text",
          { children: plan.text },
          {
            binding: {
              collectionId: source.binding.collectionId,
              fieldMap: {},
              viewId,
              key: COUNT_ROW_KEY,
            },
          },
        ),
      ],
      textId,
      false,
      newId,
    )(stage),
  );
  return {
    command: sequence(plan.label ?? "Show result count", steps),
    created: { textId, viewId },
  };
}

/**
 * 「묶기로 목록 만들기」 — a ListBox after the list with one item per value of `field` and its count:
 * a derived view grouping the list's view by the field (`count`), the ListBox reading it (its item
 * key = the group value) with the row's description = `{count}`.
 */
export function catalogGroupListCommand(
  reader: CatalogReader,
  plan: CatalogDerivedPlan & {
    readonly field: CatalogFilterField;
    /** 「모든 값」 — every value the field has in the data, a group with no rows says 0. */
    readonly emptyGroups?: boolean;
  },
  newId: NewId,
): {
  command: CatalogCommand;
  created: { listId: NodeId; viewId: EntryId<"view"> };
} {
  const source = derivedSource(reader, plan, newId);
  const viewId = newId("view") as EntryId<"view">;
  const groupListId = newId("node") as NodeId;
  const field = catalogFieldPath(plan.field);
  const steps: ((stage: CatalogReader) => CatalogCommand | undefined)[] = [];
  if (source.step) steps.push(source.step);
  steps.push(() =>
    addView({
      entry: derivedView(
        viewId,
        `${plan.viewName} · ${plan.field.key}`,
        source.sourceId,
        {
          where: EMPTY_WHERE,
          groupBy: [field],
          ...(plan.emptyGroups ? { emptyGroups: "all" as const } : {}),
          aggregates: COUNT,
        },
      ),
    }),
  );
  steps.push((stage) =>
    insertNextTo(
      plan.listId,
      [
        paletteNode(
          stage,
          groupListId,
          "ListBox",
          {},
          {
            binding: {
              collectionId: source.binding.collectionId,
              fieldMap: { value: groupField(plan.field) },
              viewId,
            },
          },
        ),
      ],
      groupListId,
      true,
      newId,
    )(stage),
  );
  steps.push((stage) => countDescription(stage, groupListId));
  return {
    command: sequence(plan.label ?? "Group into a list", steps),
    created: { listId: groupListId, viewId },
  };
}

/** A bound list's row description = `{count}` (the row template's `{description}` field). */
function countDescription(
  stage: CatalogReader,
  listId: NodeId,
): CatalogCommand | undefined {
  const cards = catalogCardFields(stage, nodePosition(stage, listId));
  const description = cards?.fields.find(
    (field) => field.value === "{description}",
  );
  return description
    ? catalogCardFieldCommand(description, `{${CATALOG_COUNT_FIELD}}`)
    : undefined;
}

/**
 * 「묶기로 열 만들기」 (kanban — 연구 §2.4) — a row of columns after the list, one per value of
 * `field`: each column is a heading (the value and its count) over a GridList reading a column
 * view (the list's view where field = value). The counts are one grouped view with every value
 * (`emptyGroups: "all"` — an empty column says 0), each heading its row by key. The columns'
 * drop rules are Phase 5's.
 */
export function catalogGroupColumnsCommand(
  reader: CatalogReader,
  plan: CatalogDerivedPlan & {
    readonly field: CatalogFilterField;
    readonly values: readonly string[];
  },
  newId: NewId,
): {
  command: CatalogCommand;
  created: {
    rowId: NodeId;
    countViewId: EntryId<"view">;
    columns: readonly {
      value: string;
      frameId: NodeId;
      headingId: NodeId;
      listId: NodeId;
      viewId: EntryId<"view">;
    }[];
  };
} {
  if (!plan.values.length) throw new Error(`NO_VALUES: ${plan.field.key}`);
  const source = derivedSource(reader, plan, newId);
  const field = catalogFieldPath(plan.field);
  const countViewId = newId("view") as EntryId<"view">;
  const rowId = newId("node") as NodeId;
  const columns = plan.values.map((value) => ({
    value,
    frameId: newId("node") as NodeId,
    headingId: newId("node") as NodeId,
    listId: newId("node") as NodeId,
    viewId: newId("view") as EntryId<"view">,
  }));
  const steps: ((stage: CatalogReader) => CatalogCommand | undefined)[] = [];
  if (source.step) steps.push(source.step);
  steps.push(() =>
    addView({
      entry: derivedView(
        countViewId,
        `${plan.viewName} · ${plan.field.key} count`,
        source.sourceId,
        {
          where: EMPTY_WHERE,
          groupBy: [field],
          emptyGroups: "all",
          aggregates: COUNT,
        },
      ),
    }),
  );
  for (const column of columns)
    steps.push(() =>
      addView({
        entry: derivedView(
          column.viewId,
          `${plan.viewName} · ${column.value}`,
          source.sourceId,
          {
            where: {
              ...EMPTY_WHERE,
              items: [
                {
                  id: `column-${plan.field.id}`,
                  fields: [field],
                  op: "equals",
                  value: column.value,
                },
              ],
            },
          },
        ),
      }),
    );
  // (The row and its column frames with their headings first; each GridList goes in its column
  // after — a placed instance owns its slot contents as it lands.)
  steps.push((stage) => {
    const frame = (id: NodeId, children: NodeId[], style: object) =>
      paletteNode(
        stage,
        id,
        "frame",
        { style: { display: "flex", ...style } },
        {
          children,
        },
      );
    return insertNextTo(
      plan.listId,
      [
        frame(
          rowId,
          columns.map((column) => column.frameId),
          { flexDirection: "row", columnGap: "16px", width: "100%" },
        ),
        ...columns.flatMap((column) => [
          frame(column.frameId, [column.headingId], {
            flexDirection: "column",
            rowGap: "8px",
            flexGrow: 1,
            flexBasis: 0,
          }),
          paletteNode(
            stage,
            column.headingId,
            "Text",
            { children: `${column.value} · {${CATALOG_COUNT_FIELD}}` },
            {
              binding: {
                collectionId: source.binding.collectionId,
                fieldMap: { value: groupField(plan.field) },
                viewId: countViewId,
                key: column.value,
              },
            },
          ),
        ]),
      ],
      rowId,
      true,
      newId,
    )(stage);
  });
  for (const column of columns)
    steps.push((stage) =>
      insertNodes({
        parent: { kind: "node", id: column.frameId },
        index: 1,
        entries: [
          paletteNode(
            stage,
            column.listId,
            "GridList",
            {},
            {
              binding: {
                collectionId: source.binding.collectionId,
                fieldMap: source.binding.fieldMap,
                viewId: column.viewId,
              },
            },
          ),
        ],
        rootIds: [column.listId],
        newId,
      }),
    );
  return {
    command: sequence(plan.label ?? "Group into columns", steps),
    created: { rowId, countViewId, columns },
  };
}

// ── Phase 4c — references in a row: the target's value · the rows pointing at it ──

/**
 * The row's own fields kept as row fields before a first node goes into the row template: that
 * edit makes the template's content owned copies, which take the item's values for `{label}` ·
 * `{description}` — sample text the data rows then drop. Written as the position's own values,
 * the copies keep reading the row.
 */
function keepRowFields(
  stage: CatalogReader,
  listId: NodeId,
): CatalogCommand | undefined {
  const cards = catalogCardFields(stage, nodePosition(stage, listId));
  const placeholders = (cards?.fields ?? []).filter(
    (field) => field.target.kind !== "node" && /^\{[^{}]+\}$/.test(field.value),
  );
  if (!placeholders.length) return undefined;
  return (reader) => {
    const inner = stageOver(reader);
    const ops: CatalogCommandPlan["ops"][number][] = [];
    for (const field of placeholders) {
      const plan = catalogCardFieldCommand(field, field.value)(inner);
      inner.apply(plan.ops);
      ops.push(...plan.ops);
    }
    return { label: "Row fields", ops };
  };
}

/** Insert a Text at the end of a bound list's row template (every data row shows it). */
function rowTemplateText(
  stage: CatalogReader,
  listId: NodeId,
  textId: NodeId,
  children: string,
  binding: DataBindingRef,
  newId: NewId,
): CatalogCommand {
  const itemId = catalogRowTemplateId(stage, listId);
  if (!itemId || !itemId.startsWith("project:node:"))
    throw new Error(`NO_ROW_TEMPLATE: ${listId}`);
  const item = stage.getEntry(itemId as NodeId);
  if (item?.kind !== "node") throw new Error(`NO_ROW_TEMPLATE: ${listId}`);
  // (No index: the end of the item's content — its template root's fill, made by this insert when
  // it is the first — after the label and the description the row's grid places first.)
  return insertNodes({
    parent: { kind: "node", id: itemId as NodeId },
    entries: [paletteNode(stage, textId, "Text", { children }, { binding })],
    rootIds: [textId],
    newId,
  });
}

/**
 * 「참조 값 표시」 (Decision 4 — `find`): a Text in each row of the list showing a field of the row
 * its reference field points at — the Text reads the target collection by key = the row's
 * reference value (`binding.key: "{teamId}"`, `useListData.getItem`).
 */
export function catalogReferenceValueCommand(
  reader: CatalogReader,
  plan: {
    readonly listId: NodeId;
    /** The list's reference field (its key — the row field the key template reads). */
    readonly field: CatalogFilterField;
    readonly target: { readonly collectionId: string; readonly key: string };
    readonly label?: string;
  },
  newId: NewId,
): { command: CatalogCommand; created: { textId: NodeId } } {
  const textId = newId("node") as NodeId;
  return {
    command: sequence(plan.label ?? "Show referenced value", [
      (stage) => keepRowFields(stage, plan.listId),
      (stage) =>
        rowTemplateText(
          stage,
          plan.listId,
          textId,
          `{${plan.target.key}}`,
          {
            collectionId: `data:collection:${plan.target.collectionId}`,
            fieldMap: {},
            key: `{${plan.field.key}}`,
          },
          newId,
        ),
    ]),
    created: { textId },
  };
}

/**
 * 「참조하는 행 수」 (Decision 4 — 역방향 집계): a Text in each row of the list counting the rows of
 * another collection whose reference field points at it (a user's orders). One shared view groups
 * that collection by the reference field (`count`); each row's Text reads its group by key = the
 * row's key field value. A row nothing points at shows nothing.
 */
export function catalogReferenceCountCommand(
  reader: CatalogReader,
  plan: {
    readonly listId: NodeId;
    /** The referencing collection and its reference field (whose target is the list's data). */
    readonly from: {
      readonly collectionId: string;
      readonly collectionName: string;
      readonly field: CatalogFilterField;
    };
    /** The list's field the reference matches (the reference's `keyField`). */
    readonly keyField: CatalogFilterField;
    readonly text: string;
    readonly label?: string;
  },
  newId: NewId,
): {
  command: CatalogCommand;
  created: { textId: NodeId; viewId: EntryId<"view"> };
} {
  const viewId = newId("view") as EntryId<"view">;
  const textId = newId("node") as NodeId;
  const field = catalogFieldPath(plan.from.field);
  const collectionId = `data:collection:${plan.from.collectionId}` as const;
  return {
    command: sequence(plan.label ?? "Count referencing rows", [
      () =>
        addView({
          entry: {
            kind: "view",
            id: viewId,
            name: `${plan.from.collectionName} · ${plan.from.field.key} count`,
            source: { collectionId },
            where: EMPTY_WHERE,
            groupBy: [field],
            aggregates: COUNT,
          },
        }),
      (stage) => keepRowFields(stage, plan.listId),
      (stage) =>
        rowTemplateText(
          stage,
          plan.listId,
          textId,
          plan.text,
          {
            collectionId,
            fieldMap: { value: groupField(plan.from.field) },
            viewId,
            key: `{${plan.keyField.key}}`,
          },
          newId,
        ),
    ]),
    created: { textId, viewId },
  };
}
