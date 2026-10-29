/// <reference path="./json-formula.d.ts" />
/**
 * ADR-291 Decision 1 · 4 — the one json-formula instance, loaded lazily (41 KB gz — only a document
 * with a `formula` field pays for it; `loadFormulaEngine` before the sync paths run), with the
 * date bridge: a row's `date` text (`2026-10-29` · `2026-10-25T09:00:00Z`) becomes json-formula's
 * day number (UTC days since the epoch, a fraction for the time of day) wherever a string meets
 * arithmetic (`stringToNumber`) or `toDate()`, and `today()` · `now()` read the run's `today`
 * (`ViewRunInput.today`) so a run is deterministic. `daysToDateText` turns a `date` column's
 * result back into the document's text.
 */
import type JsonFormula from "@adobe/json-formula";
import type { FormulaAst } from "@adobe/json-formula";
import type Lexer from "@adobe/json-formula/src/Lexer.js";

export interface FormulaEngine {
  readonly formula: JsonFormula;
  readonly Lexer: typeof Lexer;
}

export const MS_IN_DAY = 86_400_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const ZONED = /(Z|[+-]\d{2}:?\d{2})$/;

/** A date text as json-formula's day number (UTC); undefined when it is not one. */
export function dateTextToDays(text: string): number | undefined {
  const trimmed = text.trim();
  let ms: number;
  if (DATE_ONLY.test(trimmed)) ms = Date.parse(`${trimmed}T00:00:00Z`);
  else if (DATE_TIME.test(trimmed))
    ms = Date.parse(ZONED.test(trimmed) ? trimmed : `${trimmed}Z`);
  else return undefined;
  return Number.isFinite(ms) ? ms / MS_IN_DAY : undefined;
}
/** A day number as the document's date text — a whole day as `YYYY-MM-DD`, else the instant. */
export function daysToDateText(days: number): string | undefined {
  if (!Number.isFinite(days)) return undefined;
  const ms = Math.round(days * MS_IN_DAY);
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return undefined;
  return ms % MS_IN_DAY === 0
    ? date.toISOString().slice(0, 10)
    : date.toISOString();
}

/** The run's today (day number) — set around a run; absent = the clock. */
let currentToday: number | undefined;
export function withToday<T>(today: string | undefined, run: () => T): T {
  const previous = currentToday;
  currentToday = today === undefined ? undefined : dateTextToDays(today);
  try {
    return run();
  } finally {
    currentToday = previous;
  }
}
const todayDays = () => currentToday ?? Math.floor(Date.now() / MS_IN_DAY);
const nowDays = () => currentToday ?? Date.now() / MS_IN_DAY;

/** A string meeting arithmetic: a date text as days, a numeric text as its number. */
function stringToNumber(text: string): number {
  const days = dateTextToDays(text);
  if (days !== undefined) return days;
  if (
    /^\s*[-+]?(\d*)(\.\d+)?(e[-+]?\d+)?\s*$/i.test(text) &&
    text.trim() !== ""
  ) {
    const number = +text;
    if (Number.isFinite(number)) return number;
  }
  throw new TypeError(`Failed to convert "${text}" to number`);
}

let loaded: FormulaEngine | undefined;
let loading: Promise<FormulaEngine> | undefined;
const listeners = new Set<() => void>();
/**
 * Runs once the engine is loaded (at once when it already is) — the row sources read again: a
 * document read before the load showed its computed cells as `null` (`FORMULA_ENGINE_NOT_READY`).
 */
export function onFormulaEngineLoaded(listener: () => void): () => void {
  if (loaded) listener();
  else listeners.add(listener);
  return () => listeners.delete(listener);
}
/** The engine, loading it on first use (one import of json-formula for the whole runtime). */
export function loadFormulaEngine(): Promise<FormulaEngine> {
  if (loaded) return Promise.resolve(loaded);
  loading ??= Promise.all([
    import("@adobe/json-formula"),
    import("@adobe/json-formula/src/Lexer.js"),
  ]).then(([module, lexer]) => {
    const { dataTypes } = module;
    const formula = new module.default(
      {
        today: { _func: () => todayDays(), _signature: [] },
        now: { _func: () => nowDays(), _signature: [] },
        toDate: {
          _func: (args) => {
            const [value] = args;
            if (typeof value === "number") return value;
            if (typeof value !== "string") return null;
            const days = dateTextToDays(value);
            if (days !== undefined) return days;
            const ms = Date.parse(value);
            return Number.isFinite(ms) ? ms / MS_IN_DAY : null;
          },
          _signature: [{ types: [dataTypes.TYPE_ANY!] }],
        },
      },
      stringToNumber,
      [],
    );
    loaded = { formula, Lexer: lexer.default };
    for (const listener of [...listeners]) listener();
    listeners.clear();
    return loaded;
  });
  return loading;
}
/** The engine when it is loaded (the sync paths — validation · evaluation); else undefined. */
export function formulaEngineSync(): FormulaEngine | undefined {
  return loaded;
}

const asts = new Map<string, FormulaAst>();
/** One compile per expression (the cache key carries the globals the lexer must know). */
export function compileFormula(
  engine: FormulaEngine,
  expression: string,
): FormulaAst {
  const globals = [
    ...new Set(expression.match(/\$[A-Za-z_][A-Za-z0-9_]*/g) ?? []),
  ];
  const key = `${globals.join(",")}\n${expression}`;
  let ast = asts.get(key);
  if (!ast) {
    ast = engine.formula.compile(expression, globals);
    if (asts.size >= 512) asts.delete(asts.keys().next().value!);
    asts.set(key, ast);
  }
  return ast;
}
