/**
 * ADR-291 Decision 2 — which identifiers of a formula are **root field references**: the ones
 * applied to the collection's row. Judged by value-context tracking (review Round 2 h2): the AST
 * is walked carrying what value each expression is evaluated against — the root row, a sub value
 * (a JSON property · an element), a made value (a literal · an object the formula built) or an
 * unknown one (a function's result, `&&` · `||` — a function may hand the row back). An
 * identifier is a field reference only on the root row; one applied to an unknown value, a pipe
 * of a pipe, or a node shape this walk does not know is refused (`FORMULA_SCOPE_UNSUPPORTED`) —
 * never passed through quietly.
 *
 * The same identifiers are then found in the token stream (positions for the name ↔ id rewrite):
 * the walk's identifier sequence and the tokens' must be equal, else refused.
 */
import type { FormulaAst } from "@adobe/json-formula";
import { compileFormula, type FormulaEngine } from "./engine";

export type FormulaScopeCode =
  | "FORMULA_SYNTAX"
  | "FORMULA_SCOPE_UNSUPPORTED"
  | "FORMULA_GLOBAL"
  | "FORMULA_UNKNOWN_FIELD"
  | "FORMULA_UNKNOWN_FUNCTION"
  | "FORMULA_FUNCTION_HIDDEN"
  | "FORMULA_CYCLE"
  | "FORMULA_RESULT_TYPE";
export class FormulaScopeError extends Error {
  constructor(
    readonly code: FormulaScopeCode,
    message: string,
  ) {
    super(message);
    this.name = "FormulaScopeError";
  }
}

/** A root field reference: the identifier's name and its span in the expression text. */
export interface FormulaRootReference {
  readonly name: string;
  readonly start: number;
  readonly end: number;
}
export interface FormulaScope {
  readonly ast: FormulaAst;
  /** Root references in source order (a field read twice appears twice). */
  readonly roots: readonly FormulaRootReference[];
  /** `$name` globals the expression reads. */
  readonly globals: readonly string[];
  /** Function names called (source order). */
  readonly functions: readonly string[];
}

type Context = "root" | "sub" | "made" | "unknown";
const unsupported = (what: string) =>
  new FormulaScopeError(
    "FORMULA_SCOPE_UNSUPPORTED",
    `the formula's ${what} cannot be classified as a field reference or not`,
  );
/** The context of a value's elements (a projection · a filter · a flatten walks them). */
const elementOf = (context: Context): Context =>
  context === "unknown" ? "unknown" : context === "made" ? "made" : "sub";
const MADE_OPERATORS = new Set([
  "NotExpression",
  "UnaryMinusExpression",
  "AddExpression",
  "SubtractExpression",
  "MultiplyExpression",
  "DivideExpression",
  "ConcatenateExpression",
  "UnionExpression",
  "Comparator",
]);
const LITERALS = new Set([
  "String",
  "Literal",
  "Number",
  "Integer",
  "SignedInt",
  "Index",
  "Slice",
]);

/** Globals as the lexer needs them (`$name` — the lexer only reads a known global as one). */
export function formulaGlobalNames(expression: string): string[] {
  return [...new Set(expression.match(/\$[A-Za-z_][A-Za-z0-9_]*/g) ?? [])];
}

export function formulaScope(
  engine: FormulaEngine,
  expression: string,
): FormulaScope {
  const globals = formulaGlobalNames(expression);
  let ast: FormulaAst;
  try {
    ast = compileFormula(engine, expression);
  } catch (error) {
    throw new FormulaScopeError(
      "FORMULA_SYNTAX",
      error instanceof Error ? error.message : String(error),
    );
  }
  const identifiers: { name: string; root: boolean }[] = [];
  const functions: string[] = [];
  const children = (node: FormulaAst) => node.children ?? [];
  const walk = (node: FormulaAst, context: Context): Context => {
    switch (node.type) {
      case "Identifier":
      case "QuotedIdentifier": {
        if (context === "unknown")
          throw unsupported(`identifier \`${node.name}\``);
        identifiers.push({ name: node.name!, root: context === "root" });
        return "sub";
      }
      case "Global":
        return "made";
      case "Current":
      case "Identity":
        return context;
      case "ChainedExpression": {
        let current = context;
        for (const child of children(node)) current = walk(child, current);
        return current;
      }
      case "BracketExpression": {
        const left = walk(children(node)[0]!, context);
        walk(children(node)[1]!, elementOf(left));
        return elementOf(left);
      }
      case "Flatten":
        return elementOf(walk(children(node)[0]!, context));
      case "Projection":
      case "ValueProjection": {
        const element = elementOf(walk(children(node)[0]!, context));
        walk(children(node)[1]!, element);
        return element;
      }
      case "FilterProjection": {
        // (Source order: the left, the `[?condition]`, then what follows the bracket.)
        const [left, right, condition] = children(node);
        const element = elementOf(walk(left!, context));
        walk(condition!, element);
        walk(right!, element);
        return element;
      }
      case "Pipe": {
        const [left, right] = children(node);
        if (left!.type === "Pipe") throw unsupported("pipe of a pipe");
        return walk(right!, walk(left!, context));
      }
      case "ExpressionReference":
        // (`&expr` runs against what the receiving function hands it — an element.)
        walk(children(node)[0]!, "sub");
        return "made";
      case "Function": {
        functions.push(node.name!);
        for (const child of children(node)) walk(child, context);
        return "unknown";
      }
      case "ObjectExpression": {
        for (const pair of children(node))
          walk(pair.value as FormulaAst, context);
        return "made";
      }
      case "ArrayExpression": {
        for (const child of children(node)) walk(child, context);
        return "made";
      }
      case "AndExpression":
      case "OrExpression": {
        // (`a || b` is one of its operands — it may be the row itself.)
        for (const child of children(node)) walk(child, context);
        return "unknown";
      }
      default: {
        if (LITERALS.has(node.type)) return "made";
        if (MADE_OPERATORS.has(node.type)) {
          for (const child of children(node)) walk(child, context);
          return "made";
        }
        throw unsupported(`\`${node.type}\` node`);
      }
    }
  };
  walk(ast, "root");

  // The same identifiers in the token stream (function names and object keys are not references).
  const tokens = new engine.Lexer(globals, []).tokenize(expression);
  const spans: { name: string; start: number; end: number }[] = [];
  tokens.forEach((token, index) => {
    if (token.type !== "Identifier" && token.type !== "QuotedIdentifier")
      return;
    const next = tokens[index + 1]?.type;
    if (next === "Lparen" || next === "Colon") return;
    const name = String(token.value);
    spans.push({
      name,
      start: token.start,
      end: tokenEnd(expression, token.start, token.type),
    });
  });
  if (
    spans.length !== identifiers.length ||
    spans.some((span, index) => span.name !== identifiers[index]!.name)
  )
    throw unsupported(
      "identifier positions (the token stream and the tree disagree)",
    );
  const roots = spans.filter((_span, index) => identifiers[index]!.root);
  return { ast, roots, globals, functions };
}

/** Where an identifier token ends — a quoted one runs to its closing quote (escapes skipped). */
function tokenEnd(expression: string, start: number, type: string): number {
  if (type === "Identifier") {
    let end = start;
    while (end < expression.length && /[A-Za-z0-9_$]/.test(expression[end]!))
      end += 1;
    return end;
  }
  let at = start + 1;
  while (at < expression.length && expression[at] !== "'") {
    if (expression[at] === "\\") at += 1;
    at += 1;
  }
  return at + 1;
}
