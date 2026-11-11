import {
  setFields,
  setWholeField,
} from "../../../../../packages/shared/src/catalog/commands";
import {
  stageOver,
  type CatalogCommand,
} from "../../../../../packages/shared/src/catalog/commands/compose";
import type { EditTarget } from "../../../../../packages/shared/src/catalog/commands/context";
import { stable } from "../../../../../packages/shared/src/catalog/commands/originFork";
import type {
  BreakpointName,
  CatalogReader,
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
import { layerOf } from "./styleDirty";

/**
 * A value set back to what shows without it leaves no write (Figma: an instance property changed
 * and changed back is no override). The command's own writes are staged; each key it changed is
 * removed in a trial, and the record is resolved again at the breakpoints that write reaches —
 * when nothing it shows differs (values, their token refs, fills), the removal joins the same
 * step. A token and a literal of the same px differ (the theme reaches only the token); where the
 * shown value comes from (the origin's write or the rule) does not (사용자 결정 2026-11-11
 * 「보이던 값과 같으면 지움」).
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
    const extra: (typeof plan.ops)[number][] = [];
    let current: CatalogReader = stageOver(reader).apply(plan.ops);
    for (const item of items) {
      const removals = removalsOf(reader, current, item.target);
      if (!removals.length) continue;
      const shown = new Shown(root, item.identity, current);
      // (Not drawn at the active breakpoint — nothing to compare with.)
      if (shown.at(root.breakpoint) === null) continue;
      for (const { command: removal, layer } of removals) {
        const ops = removal(current).ops;
        const trial = stageOver(current).apply(ops);
        // (The active breakpoint first — a changed value differs there and stops the rest.)
        if (
          !reachedFrom(layer, root.breakpoint).every((breakpoint) =>
            shown.same(trial, breakpoint),
          )
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

/**
 * One record's shown result per breakpoint with the staged write (the baseline — read once per
 * breakpoint, kept as its compared text), compared with a trial removal's. An accepted removal
 * shows the same, so the baseline stays the baseline.
 */
class Shown {
  private readonly baseline = new Map<BreakpointName, string | null>();
  constructor(
    private readonly root: CatalogCompositionRoot,
    private readonly identity: string,
    private readonly staged: CatalogReader,
  ) {}
  /** The compared text at a breakpoint over `reader` (`null` = not drawn there). */
  private read(reader: CatalogReader, breakpoint: BreakpointName) {
    try {
      const node = this.root.resolveRecordOver(
        reader,
        this.identity,
        breakpoint,
      );
      return node ? shownText(node) : null;
    } catch {
      // (Not on this breakpoint's path — hidden there.)
      return null;
    }
  }
  at(breakpoint: BreakpointName): string | null {
    if (!this.baseline.has(breakpoint))
      this.baseline.set(breakpoint, this.read(this.staged, breakpoint));
    return this.baseline.get(breakpoint)!;
  }
  same(trial: CatalogReader, breakpoint: BreakpointName): boolean {
    return this.read(trial, breakpoint) === this.at(breakpoint);
  }
}

/** The breakpoints a write on a layer reaches (desktop-first cascade), the active one first. */
function reachedFrom(
  layer: BreakpointName,
  active: BreakpointName,
): BreakpointName[] {
  const reached = BREAKPOINTS.slice(BREAKPOINTS.indexOf(layer));
  return reached.includes(active)
    ? [active, ...reached.filter((breakpoint) => breakpoint !== active)]
    : reached;
}

/** The keys a write changed (set, not the same as before). */
function changedKeys(
  before: Readonly<Record<string, unknown>>,
  after: Readonly<Record<string, unknown>>,
): string[] {
  return Object.entries(after)
    .filter(
      ([key, write]) =>
        (write as { kind?: string } | undefined)?.kind === "set" &&
        stable(write) !== stable(before[key]),
    )
    .map(([key]) => key);
}

/** One removal per key (or whole fill) the staged edit changed on `target`, with its layer. */
function removalsOf(
  before: CatalogReader,
  after: CatalogReader,
  target: EditTarget,
): { command: CatalogCommand; layer: BreakpointName }[] {
  let was: OwnFields;
  let now: OwnFields;
  try {
    was = readOwnFields(before, target);
    now = readOwnFields(after, target);
  } catch {
    return [];
  }
  const remove = { kind: "remove" } as const;
  const out = changedKeys(was.props, now.props).map((key) => ({
    command: setFields({ targets: [target], props: { [key]: remove } }),
    layer: "desktop" as BreakpointName,
  }));
  for (const breakpoint of BREAKPOINTS) {
    const from = layerOf(was, breakpoint);
    const to = layerOf(now, breakpoint);
    for (const field of LAYER_FIELDS)
      for (const key of changedKeys(from[field], to[field]))
        out.push({
          command: setFields({
            targets: [target],
            breakpoint,
            [field]: { [key]: remove },
          }),
          layer: breakpoint,
        });
  }
  if (now.fills && stable(now.fills) !== stable(was.fills))
    out.push({
      command: setWholeField({
        targets: [target],
        field: "fills",
        value: undefined,
      }),
      layer: "desktop",
    });
  return out;
}

/**
 * What a resolved node shows, as one comparable text: its values (key order free — a node's own
 * value and its template's land in other orders), the token each visual · layout value came from,
 * and its fills' tokens. Who authored a value (`authoredLayout`, authored token refs) does not count.
 */
function shownText(node: ResolvedCatalogNode): string {
  const {
    children: _children,
    authoredLayout: _authoredLayout,
    ...rest
  } = node;
  const refs = (values: object) =>
    Object.keys(values)
      .sort()
      .map((key) => `${key}=${catalogResolvedTokenRef(values, key) ?? ""}`)
      .join(",");
  return `${stable(rest)}|${refs(node.visual)}|${refs(node.layout)}|${catalogFillTokenRefs(node.fills)}`;
}
