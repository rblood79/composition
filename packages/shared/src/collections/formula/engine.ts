/// <reference path="./json-formula.d.ts" />
/**
 * ADR-291 Decision 1 · 4 — the formula engine's loader (the only formula module the first screen
 * holds — G3): one json-formula instance (`instance.ts`, 41 KB gz) and the computed cell ·
 * definition modules (`computeCells.ts` · `validate.ts`) load together on the first read of a
 * document with a `formula` field; the sync paths (validation · evaluation) read them through
 * `formulaRuntimeSync` once loaded.
 */
import type JsonFormula from "@adobe/json-formula";
import type Lexer from "@adobe/json-formula/src/Lexer.js";
import type { computeCellsWith } from "./computeCells";
import type { formulaCycleError, formulaDefinitionError } from "./validate";

export interface FormulaEngine {
  readonly formula: JsonFormula;
  readonly Lexer: typeof Lexer;
}
/** The loaded engine with the modules the sync paths call (validation · computed cells). */
export interface FormulaRuntime {
  readonly engine: FormulaEngine;
  readonly computeCells: typeof computeCellsWith;
  readonly definitionError: typeof formulaDefinitionError;
  readonly cycleError: typeof formulaCycleError;
}

let runtime: FormulaRuntime | undefined;
let loading: Promise<FormulaEngine> | undefined;
const listeners = new Set<() => void>();
/**
 * Runs once the engine is loaded (at once when it already is) — the row sources read again: a
 * document read before the load showed its computed cells as `null` (`FORMULA_ENGINE_NOT_READY`).
 */
export function onFormulaEngineLoaded(listener: () => void): () => void {
  if (runtime) listener();
  else listeners.add(listener);
  return () => listeners.delete(listener);
}
/** The engine, loading it on first use (one import of json-formula for the whole runtime). */
export function loadFormulaEngine(): Promise<FormulaEngine> {
  if (runtime) return Promise.resolve(runtime.engine);
  loading ??= Promise.all([
    import("./instance"),
    import("./computeCells"),
    import("./validate"),
  ]).then(async ([instance, cells, validate]) => {
    const engine = await instance.createFormulaEngine();
    runtime = {
      engine,
      computeCells: cells.computeCellsWith,
      definitionError: validate.formulaDefinitionError,
      cycleError: validate.formulaCycleError,
    };
    for (const listener of [...listeners]) listener();
    listeners.clear();
    return engine;
  });
  return loading;
}
/** The engine when it is loaded (the sync paths — validation · evaluation); else undefined. */
export function formulaEngineSync(): FormulaEngine | undefined {
  return runtime?.engine;
}
/** The engine and the modules loaded with it; undefined until the load lands. */
export function formulaRuntimeSync(): FormulaRuntime | undefined {
  return runtime;
}
