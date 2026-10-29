/**
 * ADR-291 Phase 2 — the Builder's read of the lazy formula engine (`collections/formula/engine`):
 * a panel that shows or edits a computed column subscribes here, starts the load when the
 * document has one (`wanted` — a document without a formula never requests json-formula, G3)
 * and renders again once it is loaded.
 */
import { useSyncExternalStore } from "react";
import {
  formulaEngineSync,
  loadFormulaEngine,
  onFormulaEngineLoaded,
  type FormulaEngine,
} from "../../../../../packages/shared/src/collections/formula/engine";
import { hasFormula } from "../../../../../packages/shared/src/collections/formula/compute";

const subscribe = (listener: () => void) => onFormulaEngineLoaded(listener);

/** The engine when loaded; `wanted` starts the load (once) and the hook re-renders on it. */
export function useFormulaEngine(wanted = true): FormulaEngine | undefined {
  const engine = useSyncExternalStore(
    subscribe,
    formulaEngineSync,
    formulaEngineSync,
  );
  if (wanted && !engine) void loadFormulaEngine();
  return engine;
}

/** Whether a schema has a computed column (what makes the engine wanted). */
export function schemaHasFormula(
  schema: readonly { formula?: string }[] | undefined,
): boolean {
  return !!schema?.some(hasFormula);
}
