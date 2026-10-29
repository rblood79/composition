/**
 * ADR-291 Decision 2 — a formula is **stored over field ids** (`'f-price' * 'f-qty'` — a rename
 * keeps the id, so the formula) and **shown over field keys** (`price * qty`). One rewrite in
 * each direction, replacing only the root references `scope.ts` found; every other character of
 * the author's text stays (spacing · JSON sub-properties · object keys).
 */
import type { FormulaEngine } from "./engine";
import { FormulaScopeError, formulaScope } from "./scope";

export interface FormulaNameField {
  readonly id?: string;
  readonly key: string;
}
const BARE = /^[A-Za-z_][A-Za-z0-9_]*$/;
/** An identifier as formula text: bare when the grammar allows, else `'quoted'` (escaped). */
export function formulaIdentifier(name: string): string {
  return BARE.test(name)
    ? name
    : `'${name.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function rewrite(
  engine: FormulaEngine,
  expression: string,
  rename: (name: string) => string | undefined,
): string {
  const { roots } = formulaScope(engine, expression);
  let out = expression;
  for (const root of [...roots].reverse()) {
    const next = rename(root.name);
    if (next === undefined)
      throw new FormulaScopeError(
        "FORMULA_UNKNOWN_FIELD",
        `the formula reads \`${root.name}\`, which is not a field of the collection`,
      );
    out =
      out.slice(0, root.start) + formulaIdentifier(next) + out.slice(root.end);
  }
  return out;
}

/** The stored (id) form shown with keys. */
export function formulaToDisplay(
  engine: FormulaEngine,
  stored: string,
  fields: readonly FormulaNameField[],
): string {
  const byId = new Map(
    fields.map((field) => [field.id ?? field.key, field.key]),
  );
  return rewrite(engine, stored, (id) => byId.get(id));
}

/** The formula as the author reads it — the stored form until the engine is loaded or when it
 *  does not read (a panel shows it, never throws). */
export function formulaShown(
  engine: FormulaEngine | undefined,
  stored: string,
  fields: readonly FormulaNameField[],
): string {
  if (!engine) return stored;
  try {
    return formulaToDisplay(engine, stored, fields);
  } catch {
    return stored;
  }
}

/** The author's (key) form stored with ids. */
export function formulaToStored(
  engine: FormulaEngine,
  display: string,
  fields: readonly FormulaNameField[],
): string {
  const byKey = new Map(
    fields.map((field) => [field.key, field.id ?? field.key]),
  );
  return rewrite(engine, display, (key) => byKey.get(key));
}
