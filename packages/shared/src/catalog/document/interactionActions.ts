/**
 * ADR-295 후속 C8 — a rule's Dos with the ones nested in them: S2 `ToastOptions.onAction` makes a
 * toast Do hold its own Do list (the action button's). Every reader that walks a rule's Dos — the
 * reference index, validation, copies, detach · swap · create component address rewrites, variable
 * moves, usage counts — walks them through these two, so a nested Do's page · variable · target is
 * never left dangling.
 */
import type { InteractionAction } from "./types";

/** Every Do of the list, each followed by the Dos nested in it (depth first). */
export function catalogActionsDeep(
  actions: readonly InteractionAction[],
): InteractionAction[] {
  const out: InteractionAction[] = [];
  const visit = (list: readonly InteractionAction[]) => {
    for (const action of list) {
      out.push(action);
      if (action.opcode === "toast" && action.onAction) visit(action.onAction);
    }
  };
  visit(actions);
  return out;
}

/**
 * The list with `map` applied to every Do, nested ones too (inner first — `map` sees a toast whose
 * `onAction` is already mapped). A Do `map` returns unchanged (and with unchanged nested Dos) keeps
 * its identity, so `next.some((a, i) => a !== list[i])` still tells whether anything changed.
 */
export function mapCatalogActionsDeep(
  actions: readonly InteractionAction[],
  map: (action: InteractionAction) => InteractionAction,
): InteractionAction[] {
  return actions.map((action) => {
    let current = action;
    if (action.opcode === "toast" && action.onAction) {
      const inner = action.onAction;
      const nested = mapCatalogActionsDeep(inner, map);
      if (nested.some((item, index) => item !== inner[index]))
        current = { ...action, onAction: nested };
    }
    return map(current);
  });
}

/** Whether any Do of the list (nested ones too) passes `test`. */
export function catalogSomeActionDeep(
  actions: readonly InteractionAction[],
  test: (action: InteractionAction) => boolean,
): boolean {
  return catalogActionsDeep(actions).some(test);
}

/**
 * The list without the Dos `drop` names, nested ones too; a toast keeps its `onAction` only while
 * it holds a Do. Unchanged → the same array.
 */
export function filterCatalogActionsDeep(
  actions: readonly InteractionAction[],
  keep: (action: InteractionAction) => boolean,
): readonly InteractionAction[] {
  let changed = false;
  const out: InteractionAction[] = [];
  for (const action of actions) {
    if (!keep(action)) {
      changed = true;
      continue;
    }
    if (action.opcode === "toast" && action.onAction) {
      const nested = filterCatalogActionsDeep(action.onAction, keep);
      if (nested !== action.onAction) {
        changed = true;
        const { onAction: _old, ...rest } = action;
        out.push(nested.length ? { ...rest, onAction: nested } : rest);
        continue;
      }
    }
    out.push(action);
  }
  return changed ? out : actions;
}
