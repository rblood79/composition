/**
 * ADR-285 Decision 3 — which document unit an element of the edited code is. Not guessed from the
 * text: the editor's edit operations (its changes since the session's baseline, composed) tell what
 * became of each anchor — a span that stays is the same unit even when what is inside changed, a
 * span deleted whole is removed, text typed outside every span is new. Only where a paste covered
 * anchors (a hunk) does the code decide, and there the order is never the evidence:
 *
 * 1. an equal normalized text pairs first (a moved element keeps its id — B · A pasted over A · B
 *    moves them, it does not rewrite their letters); an equal text on both sides in equal numbers
 *    pairs in order (the code cannot tell them apart and the result is the same), unequal numbers
 *    pair only when every candidate of that shape (the kept ones of that parent too) has the same
 *    document state;
 * 2. what is left in a hunk pairs as an edit only one to one by type in the same parent — two
 *    anchors for one element pair in order only when their states are equal, one anchor for two
 *    elements never;
 * 3. what is left is removed or added.
 *
 * A candidate set with different states is `ambiguous` — refused, never picked (the review's
 * round 3 · 4 probe).
 */
import {
  codeViewNormalized,
  type CodeViewElement,
  type CodeViewSpan,
} from "./parse";

/** An edit operation in the baseline's offsets: `[fromA, toA)` became `insert`. */
export interface CodeViewChange {
  readonly fromA: number;
  readonly toA: number;
  readonly insert: string;
}

export type CodeViewAnchorOutcome =
  /** The span stays (its offsets in the edited code). */
  | { readonly kind: "kept"; readonly from: number; readonly to: number }
  /** Deleted whole with nothing in its place. */
  | { readonly kind: "deleted" }
  /** Covered by a change that inserted text — the hunk is that change's index. */
  | {
      readonly kind: "replaced";
      readonly hunk: number;
      /** The change's inserted text in the edited code. */
      readonly from?: number;
      readonly to?: number;
    };

/**
 * A baseline offset in the edited code: changes before it shift it, a deleted range takes it to
 * the range's start (`assoc < 0`) or past its insert (`assoc > 0`), an insert exactly at it goes
 * before it when `assoc > 0`.
 */
export function codeViewMapPos(
  changes: readonly CodeViewChange[],
  pos: number,
  assoc: -1 | 1,
): number {
  let delta = 0;
  for (const change of changes) {
    const before =
      change.toA < pos ||
      (change.toA === pos && (change.fromA < change.toA || assoc > 0));
    if (before) {
      delta += change.insert.length - (change.toA - change.fromA);
      continue;
    }
    if (change.fromA < pos && pos < change.toA)
      return change.fromA + delta + (assoc > 0 ? change.insert.length : 0);
    break;
  }
  return pos + delta;
}

/** What became of each anchor span through the changes. */
export function codeViewAnchorOutcomes(
  anchors: readonly CodeViewSpan[],
  changes: readonly CodeViewChange[],
): CodeViewAnchorOutcome[] {
  return anchors.map((anchor) => {
    const index = changes.findIndex(
      (change) =>
        change.fromA < change.toA &&
        change.fromA <= anchor.from &&
        change.toA >= anchor.to,
    );
    if (index >= 0) {
      const change = changes[index]!;
      if (!change.insert) return { kind: "deleted" };
      // (Where its text went: the changes before it moved it — in any order.)
      let from = change.fromA;
      for (const other of changes)
        if (other !== change && other.toA <= change.fromA)
          from += other.insert.length - (other.toA - other.fromA);
      return {
        kind: "replaced",
        hunk: index,
        from,
        to: from + change.insert.length,
      };
    }
    // (A change that starts before the span and ends inside it — the editor's line change of an
    //  element's opening tag: the line's lead before the tag is the same, so the tag starts at
    //  the same column of the new line. Step 0 checks the tag there; ADR-310 Phase 6 — a bound
    //  Table whose `<Table …>` line a snippet rewrote stays the Table.)
    const opening = changes.find(
      (change) =>
        change.fromA < anchor.from &&
        anchor.from < change.toA &&
        change.toA < anchor.to,
    );
    if (opening) {
      let start = opening.fromA;
      for (const other of changes)
        if (other !== opening && other.toA <= opening.fromA)
          start += other.insert.length - (other.toA - other.fromA);
      const column = anchor.from - opening.fromA;
      if (column <= opening.insert.length)
        return {
          kind: "kept",
          from: start + column,
          to: codeViewMapPos(changes, anchor.to, -1),
        };
    }
    return {
      kind: "kept",
      from: codeViewMapPos(changes, anchor.from, 1),
      to: codeViewMapPos(changes, anchor.to, -1),
    };
  });
}

/** Each change's inserted span in the edited code. */
export function codeViewInsertedSpans(
  changes: readonly CodeViewChange[],
): CodeViewSpan[] {
  let delta = 0;
  return changes.map((change) => {
    const from = change.fromA + delta;
    delta += change.insert.length - (change.toA - change.fromA);
    return { from, to: from + change.insert.length };
  });
}

/** A document element the baseline code showed. */
export interface CodeViewIdentityUnit {
  readonly id: string;
  /** The enclosing element's unit (absent = a root of the page). */
  readonly parentId?: string;
  readonly type: string;
  /** Its baseline code (the anchor's span). */
  readonly code: string;
  /** What is not in the code (styles · rules' targets · overrides …) — equal = indistinguishable. */
  readonly state: string;
  readonly outcome: CodeViewAnchorOutcome;
}

export interface CodeViewIdentity {
  /** Each element of the edited code that is a document unit. */
  readonly matched: ReadonlyMap<CodeViewElement, string>;
  /** Units no element is (their elements left the code). */
  readonly removed: readonly string[];
  /** Elements that are no unit (new). */
  readonly added: readonly CodeViewElement[];
  /** Spans of the edited code whose identity the code does not decide. */
  readonly ambiguous: readonly CodeViewSpan[];
}

/** The RAC key an element's opening tag writes (`key="…"` · `id="…"`), else undefined. */
function tagKey(code: string): string | undefined {
  const open = /^\{?[^<]*<[\w$.]+((?:\s+[\w$-]+(?:=(?:"[^"]*"|'[^']*'|\{[^{}]*\}))?)*)/.exec(code)?.[1];
  return open ? /\s(?:key|id)="([^"]*)"/.exec(open)?.[1] : undefined;
}

/** Match the edited code's elements with the baseline's units (Decision 3). */
export function codeViewMatchElements(
  units: readonly CodeViewIdentityUnit[],
  roots: readonly CodeViewElement[],
  code: string,
): CodeViewIdentity {
  // The edited elements, pre-order, with their parents.
  const elements: CodeViewElement[] = [];
  const parentOf = new Map<CodeViewElement, CodeViewElement | undefined>();
  // (ADR-296 Phase 5 — a `<Slot name>` is an instance's position, not a document unit: its
  // children are the instance's.)
  const kids = (element: CodeViewElement): CodeViewElement[] =>
    element.children.flatMap((child) =>
      child.type === "Slot" ? kids(child) : [child],
    );
  const visit = (element: CodeViewElement, parent?: CodeViewElement) => {
    if (element.type === "Slot") {
      kids(element).forEach((child) => visit(child, parent));
      return;
    }
    elements.push(element);
    parentOf.set(element, parent);
    kids(element).forEach((child) => visit(child, element));
  };
  roots.forEach((root) => visit(root));
  const childrenOf = (id: string) =>
    units.filter((unit) => unit.parentId === id);
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const textOf = (element: CodeViewElement) =>
    codeViewNormalized(code.slice(element.from, element.to));
  const unitText = (unit: CodeViewIdentityUnit) =>
    codeViewNormalized(unit.code);

  const matched = new Map<CodeViewElement, string>();
  const used = new Set<string>();
  const pair = (element: CodeViewElement, unit: CodeViewIdentityUnit) => {
    matched.set(element, unit.id);
    used.add(unit.id);
  };
  /** An equal text: the subtrees pair element by element (same text = same shape). */
  const pairTree = (element: CodeViewElement, unit: CodeViewIdentityUnit) => {
    pair(element, unit);
    const units = childrenOf(unit.id);
    kids(element).forEach((child, index) => {
      const kid = units[index];
      if (kid && !used.has(kid.id)) pairTree(child, kid);
    });
  };

  // 0. Kept spans: the element at the span's place is the unit — of the same tag (a tag typed
  //    over is another element: no command changes a node's type — the editor's minimal change
  //    keeps the span of `<Text>…` typed over as `<ListBox>…`).
  for (const unit of units) {
    if (unit.outcome.kind !== "kept") continue;
    const { from } = unit.outcome;
    const element = elements.find(
      (item) =>
        item.from === from && !matched.has(item) && item.type === unit.type,
    );
    if (element) pair(element, unit);
  }

  const ambiguous: CodeViewSpan[] = [];
  const free = () => units.filter((unit) => !used.has(unit.id));
  /** The unit an edited element's parent is (`""` = a root). */
  const parentUnit = (element: CodeViewElement) => {
    const parent = parentOf.get(element);
    return parent ? matched.get(parent) : "";
  };

  // 1. Equal normalized text pairs first, whatever the place (a move — into a new parent too).
  for (const element of elements) {
    if (matched.has(element)) continue;
    const text = textOf(element);
    const candidates = free().filter((unit) => unitText(unit) === text);
    if (!candidates.length) continue;
    const news = elements.filter(
      (item) => !matched.has(item) && textOf(item) === text,
    );
    if (candidates.length === news.length) {
      news.forEach((item, index) => pairTree(item, candidates[index]!));
      continue;
    }
    // (Unequal numbers: the shape's every candidate — the kept ones of that parent too.)
    const kept = units.filter(
      (unit) =>
        used.has(unit.id) &&
        unitText(unit) === text &&
        (unit.parentId ?? "") === parentUnit(element),
    );
    const states = new Set([...candidates, ...kept].map((unit) => unit.state));
    if (states.size > 1) {
      for (const item of news) {
        ambiguous.push({ from: item.from, to: item.to });
        matched.set(item, "");
      }
      candidates.forEach((unit) => used.add(unit.id));
      continue;
    }
    const count = Math.min(candidates.length, news.length);
    for (let index = 0; index < count; index += 1)
      pairTree(news[index]!, candidates[index]!);
  }

  // 2. What is left in a hunk: an edit, one to one by type under the same parent.
  const hunkOf = (unit: CodeViewIdentityUnit) =>
    unit.outcome.kind === "replaced" ? unit.outcome.hunk : undefined;
  const modify = (
    removals: CodeViewIdentityUnit[],
    news: CodeViewElement[],
  ): void => {
    const types = new Set([
      ...removals.map((unit) => unit.type),
      ...news.map((item) => item.type),
    ]);
    for (const type of types) {
      let r = removals.filter(
        (unit) => unit.type === type && !used.has(unit.id),
      );
      let n = news.filter((item) => item.type === type && !matched.has(item));
      if (!r.length || !n.length) continue;
      // (Several of one type: an element's own RAC key — `key="…"` · `id="…"` as written on its
      //  tag — names its unit when exactly one unit has it: three Columns keep their nodes when
      //  their lines change, ADR-310 Phase 6.)
      if (n.length > 1 || r.length > 1) {
        const unitKeys = new Map<string, CodeViewIdentityUnit[]>();
        for (const unit of r) {
          const key = tagKey(unit.code);
          if (key !== undefined)
            unitKeys.set(key, [...(unitKeys.get(key) ?? []), unit]);
        }
        const elementKeys = new Map<string, CodeViewElement[]>();
        for (const item of n) {
          const key = tagKey(code.slice(item.from, item.to));
          if (key !== undefined)
            elementKeys.set(key, [...(elementKeys.get(key) ?? []), item]);
        }
        for (const [key, items] of elementKeys) {
          const units = unitKeys.get(key);
          if (items.length !== 1 || units?.length !== 1) continue;
          pair(items[0]!, units[0]!);
          modify(
            childrenOf(units[0]!.id).filter((kid) => !used.has(kid.id)),
            kids(items[0]!).filter((kid) => !matched.has(kid)),
          );
        }
        r = r.filter((unit) => !used.has(unit.id));
        n = n.filter((item) => !matched.has(item));
        if (!r.length || !n.length) continue;
      }
      if (
        n.length > 1 ||
        (r.length > 1 && new Set(r.map((u) => u.state)).size > 1)
      ) {
        for (const item of n) {
          ambiguous.push({ from: item.from, to: item.to });
          matched.set(item, "");
        }
        r.forEach((unit) => used.add(unit.id));
        continue;
      }
      const [element] = n;
      const [unit] = r;
      pair(element!, unit!);
      modify(
        childrenOf(unit!.id).filter((kid) => !used.has(kid.id)),
        kids(element!).filter((kid) => !matched.has(kid)),
      );
    }
  };
  const hunks = new Set(
    units.map(hunkOf).filter((hunk): hunk is number => hunk !== undefined),
  );
  for (const hunk of hunks) {
    const removals = free().filter(
      (unit) =>
        hunkOf(unit) === hunk &&
        !(
          unit.parentId &&
          hunkOf(unitById.get(unit.parentId)!) === hunk &&
          !used.has(unit.parentId)
        ),
    );
    // (The new elements of the hunk: unmatched, their parent matched or a root — by parent; in the
    //  hunk's text when it is known — one line's change does not pair with a sibling another line
    //  holds: an edited Column line is that Column, ADR-310 Phase 6.)
    const span = units.find((unit) => hunkOf(unit) === hunk)?.outcome as
      | { from?: number; to?: number }
      | undefined;
    const byParent = new Map<string, CodeViewElement[]>();
    for (const element of elements) {
      if (matched.has(element)) continue;
      if (
        span?.from !== undefined &&
        span.to !== undefined &&
        (element.from < span.from || element.to > span.to)
      )
        continue;
      const parent = parentOf.get(element);
      if (parent && !matched.has(parent)) continue;
      const key = parentUnit(element) ?? "";
      byParent.set(key, [...(byParent.get(key) ?? []), element]);
    }
    for (const [parent, news] of byParent)
      modify(
        removals.filter((unit) => (unit.parentId ?? "") === parent),
        news,
      );
  }

  // 3. The rest: removed units (the top-most — descendants go with them) and new elements.
  const removed = free()
    .filter((unit) => !unit.parentId || used.has(unit.parentId))
    .map((unit) => unit.id);
  const added = elements.filter((element) => !matched.has(element));
  for (const [element, id] of [...matched]) if (!id) matched.delete(element);
  return { matched, removed, added, ambiguous };
}
