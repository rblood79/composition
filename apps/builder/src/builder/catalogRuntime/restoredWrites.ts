import {
  setFields,
  setWholeField,
} from "../../../../../packages/shared/src/catalog/commands";
import {
  stageOver,
  type CatalogCommand,
} from "../../../../../packages/shared/src/catalog/commands/compose";
import type { EditTarget } from "../../../../../packages/shared/src/catalog/commands/context";
import type {
  BreakpointName,
  CatalogEntry,
  CatalogReader,
  ResponsiveBreakpointName,
} from "../../../../../packages/shared/src/catalog/document/types";
import {
  readOwnFields,
  type OwnFields,
} from "../../../../../packages/shared/src/catalog/resolution/fieldSource";
import {
  catalogFillTokenRefs,
  catalogResolvedTokenRef,
  type ResolvedCatalogNode,
} from "../../../../../packages/shared/src/catalog/resolution/resolver";
import type { CatalogCompositionRoot } from "./compositionRoot";
import type { CatalogSelectionItem } from "./session";

/**
 * A value set back to what shows without it leaves no write (Figma: an instance property changed
 * and changed back is no override). The command's own writes are staged; each key it changed is
 * removed in a trial, and the record is resolved again at every breakpoint — when nothing it shows
 * differs (values, their token refs, fills), the removal joins the same step. A token and a
 * literal of the same px differ (the theme reaches only the token); where the shown value comes
 * from (the origin's write or the rule) does not (사용자 결정 2026-11-11 「보이던 값과 같으면 지움」).
 *
 * Value edits only: a structural command (insert · move) changes the records' paths, which the
 * pruned resolution reads from the committed scene.
 */
export function catalogDropRestoredWrites(
  root: CatalogCompositionRoot,
  items: readonly CatalogSelectionItem[],
  command: CatalogCommand,
): CatalogCommand {
  return (reader) => {
    const plan = command(reader);
    const staged = stageOver(reader).apply(plan.ops);
    const extra: (typeof plan.ops)[number][] = [];
    let current: CatalogReader = staged;
    for (const item of items) {
      const removals = removalsOf(reader, current, item.target);
      if (!removals.length) continue;
      const shown = shownAt(root, current, item.identity);
      if (!shown) continue;
      for (const removal of removals) {
        let ops: typeof plan.ops;
        try {
          ops = removal(current).ops;
        } catch {
          continue;
        }
        const trial = stageOver(current).apply(ops);
        const next = shownAt(root, trial, item.identity);
        if (
          !next ||
          !next.every((node, index) => sameShown(shown[index], node))
        )
          continue;
        extra.push(...ops);
        current = trial;
      }
    }
    return extra.length ? { ...plan, ops: [...plan.ops, ...extra] } : plan;
  };
}

const BREAKPOINTS: readonly BreakpointName[] = ["desktop", "tablet", "mobile"];
const LAYER_FIELDS = ["visual", "layout", "sizing"] as const;
const LAYERS: readonly ResponsiveBreakpointName[] = ["tablet", "mobile"];

/** The record at each breakpoint over `read` (`null` = hidden there), `undefined` = not drawn. */
function shownAt(
  root: CatalogCompositionRoot,
  read: CatalogReader,
  identity: string,
): (ResolvedCatalogNode | null)[] | undefined {
  const out: (ResolvedCatalogNode | null)[] = [];
  for (const breakpoint of BREAKPOINTS) {
    try {
      const node = root.resolveRecordOver(
        (id): CatalogEntry | undefined => read.getEntry(id),
        identity,
        breakpoint,
      );
      if (!node && breakpoint === root.breakpoint) return undefined;
      out.push(node ?? null);
    } catch {
      // (Not on this breakpoint's path — hidden there, or another tree.)
      if (breakpoint === root.breakpoint) return undefined;
      out.push(null);
    }
  }
  return out;
}

/** The keys a write changed (set, not the same as before). */
function changedKeys(
  before: Readonly<Record<string, unknown>> | undefined,
  after: Readonly<Record<string, unknown>> | undefined,
): string[] {
  return Object.entries(after ?? {})
    .filter(
      ([key, write]) =>
        (write as { kind?: string } | undefined)?.kind === "set" &&
        JSON.stringify(write) !== JSON.stringify(before?.[key]),
    )
    .map(([key]) => key);
}

/** One removal command per key (or whole fill) the staged edit changed on `target`. */
function removalsOf(
  before: CatalogReader,
  after: CatalogReader,
  target: EditTarget,
): CatalogCommand[] {
  let was: OwnFields;
  let now: OwnFields;
  try {
    was = readOwnFields(before, target);
    now = readOwnFields(after, target);
  } catch {
    return [];
  }
  const remove = { kind: "remove" } as const;
  const out: CatalogCommand[] = [];
  for (const key of changedKeys(was.props, now.props))
    out.push(setFields({ targets: [target], props: { [key]: remove } }));
  for (const field of LAYER_FIELDS)
    for (const key of changedKeys(was[field], now[field]))
      out.push(setFields({ targets: [target], [field]: { [key]: remove } }));
  for (const breakpoint of LAYERS)
    for (const field of LAYER_FIELDS)
      for (const key of changedKeys(
        was.responsive?.[breakpoint]?.[field],
        now.responsive?.[breakpoint]?.[field],
      ))
        out.push(
          setFields({
            targets: [target],
            breakpoint,
            [field]: { [key]: remove },
          }),
        );
  if (now.fills && JSON.stringify(now.fills) !== JSON.stringify(was.fills))
    out.push(
      setWholeField({ targets: [target], field: "fills", value: undefined }),
    );
  return out;
}

/** Key-order-free JSON (a value written by the node vs one its template set land in other orders). */
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        )
      : item,
  );
}

/** Same values, from the same tokens; who authored them (`authoredLayout`) does not count. */
function sameShown(
  left: ResolvedCatalogNode | null,
  right: ResolvedCatalogNode | null,
): boolean {
  if (!left || !right) return left === right;
  const strip = ({
    children: _children,
    authoredLayout: _authoredLayout,
    ...rest
  }: ResolvedCatalogNode) => rest;
  if (stable(strip(left)) !== stable(strip(right))) return false;
  for (const field of ["visual", "layout"] as const) {
    const keys = new Set([
      ...Object.keys(left[field]),
      ...Object.keys(right[field]),
    ]);
    for (const key of keys)
      if (
        catalogResolvedTokenRef(left[field], key) !==
        catalogResolvedTokenRef(right[field], key)
      )
        return false;
  }
  return catalogFillTokenRefs(left.fills) === catalogFillTokenRefs(right.fills);
}
