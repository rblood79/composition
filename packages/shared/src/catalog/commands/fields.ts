import type {
  AuthoredValue,
  BreakpointName,
  CatalogFillLayer,
  DataBindingRef,
  DescendantOverride,
  FillSizing,
  LayoutField,
  NodeEntry,
  NodePlacement,
  NodeResponsiveLayer,
  NodeThemeOverride,
  ResponsiveBreakpointName,
  SizingField,
  VisualField,
  WriteValue,
} from "../document/types";
import type {
  CatalogOperation,
  PatchWholeField,
} from "../transactions/transaction";
import type { CatalogCommand } from "./compose";
import {
  CommandDraft,
  fail,
  overrideAt,
  parentAncestorTypes,
  type EditTarget,
} from "./context";
import { requiredPartOwner } from "../nesting/requiredParts";
import { tableHidingTargets } from "./structure";

/**
 * ADR-248 Phase 4b field commands: the Properties, Style and Fill panels' edits on owned nodes
 * and on instance template positions (a path `patch`). Value edits never stage a structural
 * operation: an owned node uses the per-key node ops, a template position `upsertDescendant`
 * with a patch — so the transaction impact stays a value/layout delta.
 */

type Patch = Extract<DescendantOverride, { kind: "patch" }>;
/** Per-key writes; `{ kind: "remove" }` resets the local value (instance override reset). */
type Writes<K extends string, T> = Readonly<Partial<Record<K, WriteValue<T>>>>;

export interface SetFieldsInput {
  targets: readonly EditTarget[];
  /** Absent or `desktop` = the base layer; tablet/mobile write that layer. */
  breakpoint?: BreakpointName;
  props?: Writes<string, AuthoredValue>;
  visual?: Writes<VisualField, AuthoredValue>;
  layout?: Writes<LayoutField, string>;
  sizing?: Writes<SizingField, number | null>;
  label?: string;
}

const entries = <T>(writes: Readonly<Partial<Record<string, T>>> | undefined) =>
  Object.entries(writes ?? {}).filter(
    (entry): entry is [string, T] => entry[1] !== undefined,
  );

/** Merge writes into a layer record: `remove` drops the key. */
function mergeLayer<T>(
  base: Readonly<Record<string, WriteValue<T>>> | undefined,
  writes: ReadonlyArray<[string, WriteValue<T>]>,
): Record<string, WriteValue<T>> | undefined {
  const next: Record<string, WriteValue<T>> = { ...base };
  for (const [key, write] of writes)
    if (write.kind === "remove") delete next[key];
    else next[key] = write;
  return Object.keys(next).length ? next : undefined;
}

/**
 * ADR-256 Decision 4 · 5 — an explicit detach (`slot = false`) on a part RAC needs cuts it from its
 * owner's context (a Select's trigger loses its popup ARIA): refused on every path (Properties,
 * property paste, AI), not only hidden in the panel. The owners of a slot-reading required part
 * (Select · ComboBox · pickers' Button) give a context without names, so only the detach cuts it.
 */
function assertRequiredSlotKept(draft: CommandDraft, target: EditTarget): void {
  const types =
    target.kind === "node"
      ? parentAncestorTypes(draft, { kind: "node", id: target.id })
      : parentAncestorTypes(draft, target);
  const [type, ...above] = types;
  const owner = type ? requiredPartOwner(type, above) : undefined;
  if (owner) fail("REQUIRED_PART_NOT_REMOVABLE", `${owner}>${type}`);
}

export const setFields =
  (input: SetFieldsInput): CatalogCommand =>
  (reader) => {
    const slot = input.props?.slot;
    if (slot?.kind === "set" && slot.value === false) {
      const draft = new CommandDraft(reader);
      for (const target of input.targets) assertRequiredSlotKept(draft, target);
    }
    const breakpoint =
      input.breakpoint && input.breakpoint !== "desktop"
        ? (input.breakpoint as ResponsiveBreakpointName)
        : undefined;
    if (breakpoint && entries(input.props).length)
      fail("PROPS_NOT_RESPONSIVE", breakpoint);
    const ops: CatalogOperation[] = [];
    for (const target of input.targets) {
      if (target.kind === "node") {
        if (reader.getEntry(target.id)?.kind !== "node")
          fail("NODE_REQUIRED", target.id);
        for (const [key, write] of entries(input.props))
          ops.push({ kind: "patchNodeProp", id: target.id, key, write });
        for (const [key, write] of entries(input.visual))
          ops.push({
            kind: "patchNodeVisual",
            id: target.id,
            key: key as VisualField,
            write,
            ...(breakpoint ? { breakpoint } : {}),
          });
        for (const [key, write] of entries(input.layout))
          ops.push({
            kind: "patchNodeLayout",
            id: target.id,
            key: key as LayoutField,
            write,
            ...(breakpoint ? { breakpoint } : {}),
          });
        for (const [key, write] of entries(input.sizing))
          ops.push({
            kind: "patchNodeSizing",
            id: target.id,
            key: key as SizingField,
            write,
            ...(breakpoint ? { breakpoint } : {}),
          });
        continue;
      }
      const owner = reader.getEntry(target.ownerId);
      if (owner?.kind !== "node") return fail("NODE_REQUIRED", target.ownerId);
      if (!breakpoint) {
        ops.push({
          kind: "upsertDescendant",
          id: target.ownerId,
          override: {
            kind: "patch",
            address: target.address,
            ...(entries(input.props).length
              ? { props: Object.fromEntries(entries(input.props)) }
              : {}),
            ...(entries(input.visual).length
              ? { visual: Object.fromEntries(entries(input.visual)) }
              : {}),
            ...(entries(input.layout).length
              ? { layout: Object.fromEntries(entries(input.layout)) }
              : {}),
            ...(entries(input.sizing).length
              ? { sizing: Object.fromEntries(entries(input.sizing)) }
              : {}),
          } as Patch,
        });
        continue;
      }
      // A breakpoint layer of a path patch is part of its whole `responsive` value.
      const current = overrideAt(owner, target.address);
      const responsive = {
        ...(current?.kind === "patch" ? current.responsive : undefined),
      };
      const layer: NodeResponsiveLayer = { ...responsive[breakpoint] };
      const next = {
        visual: mergeLayer(layer.visual, entries(input.visual)),
        layout: mergeLayer(layer.layout, entries(input.layout)),
        sizing: mergeLayer(layer.sizing, entries(input.sizing)),
      };
      const merged = Object.fromEntries(
        Object.entries({ ...layer, ...next }).filter(
          ([, value]) => value !== undefined,
        ),
      ) as NodeResponsiveLayer;
      if (Object.keys(merged).length) responsive[breakpoint] = merged;
      else delete responsive[breakpoint];
      ops.push({
        kind: "upsertDescendant",
        id: target.ownerId,
        override: {
          kind: "patch",
          address: target.address,
          ...(Object.keys(responsive).length ? { responsive } : {}),
        },
        ...(Object.keys(responsive).length ? {} : { clear: ["responsive"] }),
      });
    }
    if (!ops.length) fail("EMPTY_EDIT", "fields");
    return { label: input.label ?? "Edit", ops };
  };

/** Whole-value fields: an owned node takes all; a template position takes its patch fields. */
export type WholeFieldValue = {
  fills: readonly CatalogFillLayer[];
  fillSizing: FillSizing;
  visibility: NodeEntry["visibility"];
  themeOverride: NodeThemeOverride;
  placement: NodePlacement;
  binding: DataBindingRef;
  enabled: boolean;
};
export interface SetWholeFieldInput<F extends keyof WholeFieldValue> {
  targets: readonly EditTarget[];
  field: F;
  /** `undefined` clears the field (the definition's or template's value shows again). */
  value: WholeFieldValue[F] | undefined;
  label?: string;
}
const PATCH_FIELDS: ReadonlySet<string> = new Set<PatchWholeField>([
  "fills",
  "fillSizing",
  "visibility",
  "enabled",
]);
export const setWholeField =
  <F extends keyof WholeFieldValue>(
    input: SetWholeFieldInput<F>,
  ): CatalogCommand =>
  (reader) => {
    const ops: CatalogOperation[] = [];
    // ADR-256 Phase 5 Round 12: hiding in a RAC Table keeps a cell per shown column (G0 ⑨).
    const targets =
      input.field === "enabled" || input.field === "visibility"
        ? tableHidingTargets(
            reader,
            input.targets,
            input.field,
            input.value as NodeEntry["enabled"] | NodeEntry["visibility"],
          )
        : input.targets;
    for (const target of targets) {
      if (target.kind === "node") {
        const node = reader.getEntry(target.id);
        if (node?.kind !== "node") return fail("NODE_REQUIRED", target.id);
        if (input.field === "placement")
          ops.push({
            kind: "setNodePlacement",
            id: target.id,
            placement: input.value as NodePlacement | undefined,
          });
        else if (input.field === "binding")
          ops.push({
            kind: "setNodeBinding",
            id: target.id,
            binding: input.value as DataBindingRef | undefined,
          });
        else if (input.field === "enabled")
          ops.push({
            kind: "put",
            entry:
              input.value === undefined
                ? (({ enabled: _enabled, ...rest }) => rest)(node)
                : { ...node, enabled: input.value as boolean },
          });
        else
          ops.push({
            kind: "setNodeField",
            id: target.id,
            field: input.field as "fills",
            value: input.value as never,
          });
        continue;
      }
      if (!PATCH_FIELDS.has(input.field))
        fail("FIELD_NOT_PATCHABLE", String(input.field));
      ops.push({
        kind: "upsertDescendant",
        id: target.ownerId,
        override: {
          kind: "patch",
          address: target.address,
          ...(input.value !== undefined
            ? { [input.field]: structuredClone(input.value) }
            : {}),
        } as Patch,
        ...(input.value === undefined
          ? { clear: [input.field as PatchWholeField] }
          : {}),
      });
    }
    return { label: input.label ?? "Edit", ops };
  };

export interface SetFillSizingInput {
  targets: readonly EditTarget[];
  /** Absent or `desktop` = the base value; tablet/mobile write that layer's value. */
  breakpoint?: BreakpointName;
  axis: "width" | "height";
  /** A weight, `null` to release an inherited fill, `undefined` to drop the layer's own value. */
  value: { factor: number } | null | undefined;
  label?: string;
}
function withFillAxis(
  current: FillSizing | undefined,
  axis: "width" | "height",
  value: SetFillSizingInput["value"],
): FillSizing | undefined {
  const next: Partial<Record<"width" | "height", { factor: number } | null>> = {
    ...current,
  };
  if (value === undefined) delete next[axis];
  else next[axis] = value;
  return Object.keys(next).length ? next : undefined;
}
/** A breakpoint layer set with its fill intent replaced (empty layers are dropped). */
function withLayerFill(
  responsive: NodeEntry["responsive"],
  breakpoint: ResponsiveBreakpointName,
  axis: "width" | "height",
  value: SetFillSizingInput["value"],
): NodeEntry["responsive"] {
  const next = { ...responsive };
  const { fillSizing, ...layer } = { ...next[breakpoint] };
  const fill = withFillAxis(fillSizing, axis, value);
  const merged: NodeResponsiveLayer = fill
    ? { ...layer, fillSizing: fill }
    : layer;
  if (Object.keys(merged).length) next[breakpoint] = merged;
  else delete next[breakpoint];
  return Object.keys(next).length ? next : undefined;
}

/**
 * One axis of the fill intent (ADR-224 `fillSizing`) at a breakpoint: the Size panel's fill, fixed
 * and reset edits. The base value is a whole-field edit; a tablet/mobile value lives in that
 * responsive layer (`resolver` cascades it over the base).
 */
export const setFillSizing =
  (input: SetFillSizingInput): CatalogCommand =>
  (reader) => {
    const breakpoint =
      input.breakpoint && input.breakpoint !== "desktop"
        ? (input.breakpoint as ResponsiveBreakpointName)
        : undefined;
    const ops: CatalogOperation[] = [];
    for (const target of input.targets) {
      if (target.kind === "node") {
        const node = reader.getEntry(target.id);
        if (node?.kind !== "node") return fail("NODE_REQUIRED", target.id);
        if (!breakpoint) {
          ops.push({
            kind: "setNodeField",
            id: target.id,
            field: "fillSizing",
            value: withFillAxis(node.fillSizing, input.axis, input.value),
          });
          continue;
        }
        const { responsive: _responsive, ...rest } = node;
        const responsive = withLayerFill(
          node.responsive,
          breakpoint,
          input.axis,
          input.value,
        );
        ops.push({
          kind: "put",
          entry: responsive ? { ...rest, responsive } : rest,
        });
        continue;
      }
      const owner = reader.getEntry(target.ownerId);
      if (owner?.kind !== "node") return fail("NODE_REQUIRED", target.ownerId);
      const current = overrideAt(owner, target.address);
      const patch = current?.kind === "patch" ? current : undefined;
      if (!breakpoint) {
        const fill = withFillAxis(patch?.fillSizing, input.axis, input.value);
        ops.push({
          kind: "upsertDescendant",
          id: target.ownerId,
          override: {
            kind: "patch",
            address: target.address,
            ...(fill ? { fillSizing: fill } : {}),
          },
          ...(fill ? {} : { clear: ["fillSizing"] }),
        });
        continue;
      }
      const responsive = withLayerFill(
        patch?.responsive,
        breakpoint,
        input.axis,
        input.value,
      );
      ops.push({
        kind: "upsertDescendant",
        id: target.ownerId,
        override: {
          kind: "patch",
          address: target.address,
          ...(responsive ? { responsive } : {}),
        },
        ...(responsive ? {} : { clear: ["responsive"] }),
      });
    }
    return { label: input.label ?? "Edit size", ops };
  };

/** The author's class names or accessible name (`metadata`); empty clears it. */
export const setNodeAttribute =
  (input: {
    id: NodeEntry["id"];
    field: "className" | "ariaLabel";
    value: string;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const node = reader.getEntry(input.id);
    if (node?.kind !== "node") return fail("NODE_REQUIRED", input.id);
    const metadata = { ...node.metadata };
    const value = input.value.trim();
    if (value) metadata[input.field] = value;
    else delete metadata[input.field];
    return {
      label: input.label ?? "Edit properties",
      ops: [
        {
          kind: "setNodeField",
          id: input.id,
          field: "metadata",
          value: Object.keys(metadata).length ? metadata : undefined,
        },
      ],
    };
  };

/** The author's DOM id (`metadata.htmlId`); empty clears it. */
export const setHtmlId =
  (input: {
    id: NodeEntry["id"];
    htmlId: string;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const node = reader.getEntry(input.id);
    if (node?.kind !== "node") return fail("NODE_REQUIRED", input.id);
    const metadata = { ...node.metadata };
    if (input.htmlId) metadata.htmlId = input.htmlId;
    else delete metadata.htmlId;
    return {
      label: input.label ?? "Edit id",
      ops: [
        {
          kind: "setNodeField",
          id: input.id,
          field: "metadata",
          value: Object.keys(metadata).length ? metadata : undefined,
        },
      ],
    };
  };

/**
 * Instance override reset: drop a template position's local values. Without keys the whole patch
 * goes (the position shows its template and library values again).
 */
export const resetDescendant =
  (input: {
    ownerId: NodeEntry["id"];
    address: DescendantOverride["address"];
    scope?: "props" | "visual" | "layout" | "sizing";
    keys?: readonly string[];
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const owner = reader.getEntry(input.ownerId);
    if (owner?.kind !== "node") return fail("NODE_REQUIRED", input.ownerId);
    const current = overrideAt(owner, input.address);
    if (current?.kind !== "patch")
      return fail("OVERRIDE_NOT_FOUND", input.ownerId);
    if (!input.scope)
      return {
        label: input.label ?? "Reset",
        ops: [
          {
            kind: "removeDescendant",
            id: input.ownerId,
            address: input.address,
          },
        ],
      };
    const keys = input.keys ?? Object.keys(current[input.scope] ?? {});
    return {
      label: input.label ?? "Reset",
      ops: [
        {
          kind: "upsertDescendant",
          id: input.ownerId,
          override: {
            kind: "patch",
            address: input.address,
            [input.scope]: Object.fromEntries(
              keys.map((key) => [key, { kind: "remove" }]),
            ),
          } as Patch,
        },
      ],
    };
  };

/** A node's layer name (display only); empty clears it. */
export const renameNode =
  (input: {
    id: NodeEntry["id"];
    name: string;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    if (reader.getEntry(input.id)?.kind !== "node")
      return fail("NODE_REQUIRED", input.id);
    const name = input.name.trim();
    return {
      label: input.label ?? "Rename",
      ops: [
        {
          kind: "setNodeField",
          id: input.id,
          field: "name",
          value: name || undefined,
        },
      ],
    };
  };

/**
 * A node's slot declaration (a named content position instances fill) or its named regions. A
 * structural edit: instances that fill the slot are re-validated.
 */
export const setSlotDeclaration =
  (input: {
    id: NodeEntry["id"];
    slot?: NodeEntry["slot"];
    regions?: NodeEntry["regions"];
    placeholder?: boolean;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const node = reader.getEntry(input.id);
    if (node?.kind !== "node") return fail("NODE_REQUIRED", input.id);
    const {
      slot: _slot,
      regions: _regions,
      placeholder: _placeholder,
      ...rest
    } = node;
    return {
      label: input.label ?? "Edit slot",
      ops: [
        {
          kind: "put",
          entry: {
            ...rest,
            ...(input.slot ? { slot: input.slot } : {}),
            ...(input.regions?.length ? { regions: input.regions } : {}),
            ...(input.placeholder ? { placeholder: true } : {}),
          },
        },
      ],
    };
  };
