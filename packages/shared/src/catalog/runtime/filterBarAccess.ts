/**
 * ADR-320 Phase 3 — what a running filter bar reads and writes of its scope (the Preview
 * session's — `CatalogTableController.filterBarAccess`): the fields it offers with the comparisons
 * its scope takes (§5.3 — a comparison the lists' requests cannot carry is not offered: nothing is
 * added and then dropped, HC4), the tree now, its one write, 「Clear」 and a condition's candidate
 * values (Decision 9 — that condition alone left out). No React here.
 */
import { catalogFilterMapItems } from "./filterScope";
import {
  VIEW_COMPARISONS_BY_KIND,
  type ViewFieldKind,
} from "../../collections/view/comparison";
import type {
  DataFieldId,
  ViewComparison,
  ViewCondition,
  ViewConditionGroup,
} from "../document/types";
import type { CatalogTableFacet } from "./tableColumnMenu";

/** A field the bar offers (a reference field's: the fields of the collection it points at). */
export interface CatalogFilterBarField {
  /** The field's path (a reference field's sub field: two steps). */
  readonly path: readonly DataFieldId[];
  readonly label: string;
  readonly kind: ViewFieldKind;
  /** The comparisons the scope takes on it (none: the field is not offered). */
  readonly ops: readonly ViewComparison[];
  /** A reference field: the referenced collection's fields (a submenu). */
  readonly fields?: readonly CatalogFilterBarField[];
}

export interface CatalogFilterBarAccess {
  readonly fields: (editingId?: string) => readonly CatalogFilterBarField[];
  readonly tree: () => ViewConditionGroup | undefined;
  /** The root items the last assigned tree left out (「적용하지 못한 조건 N」). */
  readonly refused: () => number;
  /** The scope's one write (`null` = no condition). */
  readonly write: (tree: ViewConditionGroup | null) => void;
  /** 「Clear」 — the authored start again (judged as any tree). */
  readonly clear: () => void;
  /** A condition's candidate values (that condition left out — Decision 9). */
  readonly facet: (
    conditionId: string,
    path: readonly DataFieldId[],
  ) => CatalogTableFacet | undefined;
  /**
   * Whether the scope takes a tree whole (its one judgment — §5.3). The builder asks it whether
   * groups are taken (`catalogFilterGroupsTaken` — a paged `suffix` scope takes none: no group
   * feature, G4).
   */
  readonly takes: (tree: ViewConditionGroup) => boolean;
  /** The scope's changes (its tree · its notice). */
  readonly subscribe: (listener: () => void) => () => void;
}

/** A value a probe condition carries for `op` on a `kind` field (what a serializer looks at). */
export function catalogFilterProbeValue(
  op: ViewComparison,
  kind: ViewFieldKind,
): ViewCondition["value"] | undefined {
  if (op === "exists" || op === "notExists") return undefined;
  const one =
    kind === "number"
      ? 1
      : kind === "boolean"
        ? true
        : kind === "date"
          ? "2026-01-01"
          : "a";
  if (op === "between") return [one, one] as never;
  if (op === "withinLast") return 1;
  if (op === "oneOf" || op === "containsAny" || op === "containsAll")
    return [one] as never;
  return one;
}

/**
 * A field's available comparisons: probe a replacement in place when editing, or append when adding
 * (`takes` — the scope's judgment, which reads the requests the lists send).
 */
export function catalogFilterBarFieldOps(
  path: readonly DataFieldId[],
  kind: ViewFieldKind,
  tree: ViewConditionGroup | undefined,
  takes: (tree: ViewConditionGroup) => boolean,
  editingId?: string,
): ViewComparison[] {
  return VIEW_COMPARISONS_BY_KIND[kind].filter((op) => {
    const value = catalogFilterProbeValue(op, kind);
    const probe: ViewCondition = {
      id: editingId ?? "filter-bar:probe",
      fields: [[...path]],
      op,
      ...(value !== undefined ? { value } : {}),
      ...(op === "withinLast" ? { unit: "day" as const } : {}),
    };
    return takes({
      id: tree?.id ?? "filter-scope",
      op: "and",
      items:
        editingId && tree
          ? catalogFilterMapItems(tree.items, (item) =>
              item.id === editingId ? [probe] : undefined,
            )
          : [...(tree?.items ?? []), probe],
    });
  });
}

/** The comparison a new condition on a `kind` field starts with (§5.5 — the Column dialog's rule). */
export function catalogFilterStartOp(
  kind: ViewFieldKind,
  ops: readonly ViewComparison[],
): ViewComparison | undefined {
  const first: ViewComparison =
    kind === "text" ? "contains" : kind === "list" ? "containsAny" : "equals";
  return ops.includes(first) ? first : ops[0];
}
