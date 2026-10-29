/**
 * ADR-291 — `@adobe/json-formula` 2.1.0 ships no types (ESM `src/`, no `exports` map). What the
 * formula module reads of it (a hand-written ambient declaration — `packages/shared` includes it with
 * `src`, a consumer compiling shared's source lists it in its tsconfig `include` like
 * `css-modules.d.ts`: `apps/builder/tsconfig.app.json` · `tsconfig.tests.json`).
 */
declare module "@adobe/json-formula" {
  /** A compiled expression (a plain object tree — `Identifier` · `Function` · … nodes). */
  export interface FormulaAst {
    readonly type: string;
    readonly name?: string;
    readonly value?: unknown;
    readonly children?: readonly FormulaAst[];
  }
  export interface FormulaFunctionDefinition {
    _func: (args: unknown[]) => unknown;
    _signature: readonly { types: readonly number[]; optional?: boolean }[];
  }
  export const dataTypes: Readonly<Record<string, number>>;
  export default class JsonFormula {
    constructor(
      customFunctions?: Record<string, FormulaFunctionDefinition>,
      stringToNumber?: ((value: string) => number) | null,
      debug?: unknown[],
    );
    compile(
      expression: string,
      allowedGlobalNames?: readonly string[],
    ): FormulaAst;
    run(
      ast: FormulaAst,
      json: unknown,
      language?: string,
      globals?: Record<string, unknown>,
    ): unknown;
    search(
      expression: string,
      json: unknown,
      globals?: Record<string, unknown>,
      language?: string,
    ): unknown;
  }
}
declare module "@adobe/json-formula/src/Lexer.js" {
  export interface FormulaToken {
    readonly type: string;
    readonly value?: string | number;
    readonly name?: string;
    readonly start: number;
  }
  export default class Lexer {
    constructor(allowedGlobalNames?: readonly string[], debug?: unknown[]);
    tokenize(expression: string): FormulaToken[];
  }
}
