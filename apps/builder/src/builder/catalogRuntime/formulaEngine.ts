/**
 * ADR-291 Phase 2 — the Builder's read of the lazy formula engine (`collections/formula/engine`):
 * a panel that shows or edits a computed column subscribes here, starts the load when the
 * document has one (`wanted` — a document without a formula never requests json-formula, G3)
 * and renders again once it is loaded.
 */
import { useLazyModule } from "../../../../../packages/shared/src/hooks/useLazyModule";
import {
  formulaRuntimeLoader,
  type FormulaEngine,
} from "../../../../../packages/shared/src/collections/formula/engine";
import { hasFormula } from "../../../../../packages/shared/src/collections/formula/compute";

/** The engine when loaded; `wanted` starts the load (once) and the hook re-renders on it. */
export function useFormulaEngine(wanted = true): FormulaEngine | undefined {
  return useLazyModule(formulaRuntimeLoader, wanted)?.engine;
}

/** Whether a schema has a computed column (what makes the engine wanted). */
export function schemaHasFormula(
  schema: readonly { formula?: string }[] | undefined,
): boolean {
  return !!schema?.some(hasFormula);
}
