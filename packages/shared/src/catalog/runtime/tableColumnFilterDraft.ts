/**
 * ADR-315 Phase 4 증분 4c — a Column's filter dialog as it is being filled (breakdown §5.2 「열
 * 필터」): the comparison, the value as typed, the candidate values picked, and the condition it
 * gives (`catalogColumnFilterCondition` — the one the session writes, `catalogColumnFilterPatch`).
 * Read only by the dialog's lazy chunk.
 */
import type { Scalar, ViewComparison, ViewCondition } from "../document/types";
import type { ViewFieldKind } from "../../collections/view/comparison";
import type { CatalogColumnFilterView } from "./tableColumnMenu";
import type { CatalogTableColumnFilter } from "./tableState";

export type CatalogFilterUnit = NonNullable<ViewCondition["unit"]>;

export interface CatalogColumnFilterDraft {
  readonly op: ViewComparison;
  /** The value as typed (`between`: its start). */
  readonly text: string;
  /** `between`'s end. */
  readonly to: string;
  /** The candidate values picked (`oneOf` · `containsAny` · `containsAll`). */
  readonly picked: readonly unknown[];
  /** `withinLast`'s unit. */
  readonly unit: CatalogFilterUnit;
}

/** The comparisons with no value. */
export const catalogFilterValueless = (op: ViewComparison) =>
  op === "exists" || op === "notExists";
/** The comparisons whose value is a list of candidate values. */
export const catalogFilterPicksMany = (op: ViewComparison) =>
  op === "oneOf" || op === "containsAny" || op === "containsAll";

/** The comparison a new filter starts with: the kind's usual one, if the Column offers it. */
function firstOp(
  kind: ViewFieldKind,
  ops: readonly ViewComparison[],
): ViewComparison {
  const usual: ViewComparison =
    kind === "text" ? "contains" : kind === "list" ? "containsAny" : "equals";
  return ops.includes(usual) ? usual : ops[0]!;
}

const textOf = (value: unknown): string =>
  value === undefined || value === null ? "" : String(value);

/** The dialog's start: the Column's filter now, else an empty one of its usual comparison. */
export function catalogColumnFilterDraft(
  view: CatalogColumnFilterView,
): CatalogColumnFilterDraft {
  const condition = view.condition;
  const empty: CatalogColumnFilterDraft = {
    op: firstOp(view.kind, view.ops),
    text: "",
    to: "",
    picked: [],
    unit: "day",
  };
  if (!condition || !view.ops.includes(condition.op)) return empty;
  const { op, value } = condition;
  const list = Array.isArray(value) ? value : [];
  return {
    ...empty,
    op,
    ...(catalogFilterPicksMany(op)
      ? { picked: list }
      : op === "between"
        ? { text: textOf(list[0]), to: textOf(list[1]) }
        : { text: textOf(value) }),
    ...(condition.unit ? { unit: condition.unit } : {}),
  };
}

/** A typed value as the field kind holds it (`""` = none — the condition skips). */
function valueOf(kind: ViewFieldKind, text: string): Scalar {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (kind === "number") {
    const number = Number(trimmed);
    return Number.isFinite(number) ? number : "";
  }
  if (kind === "boolean")
    return trimmed === "true" ? true : trimmed === "false" ? false : "";
  return text;
}

/**
 * The condition the dialog's 「Apply」 writes. An empty value is written as it is: the session's
 * write drops a condition that skips (`catalogColumnFilterPatch` — no filter, not a filter of
 * nothing).
 */
export function catalogColumnFilterCondition(
  kind: ViewFieldKind,
  draft: CatalogColumnFilterDraft,
): CatalogTableColumnFilter["condition"] {
  const { op } = draft;
  if (catalogFilterValueless(op)) return { op };
  if (catalogFilterPicksMany(op))
    return { op, value: draft.picked as readonly Scalar[] };
  // (An empty end is open — `viewCompare`'s `between`; both empty skip.)
  if (op === "between")
    return { op, value: [valueOf(kind, draft.text), valueOf(kind, draft.to)] };
  if (op === "withinLast")
    return { op, value: valueOf("number", draft.text), unit: draft.unit };
  return { op, value: valueOf(kind, draft.text) };
}
