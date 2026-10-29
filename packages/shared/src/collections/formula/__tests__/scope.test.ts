import { beforeAll, describe, expect, it } from "vitest";
import { loadFormulaEngine, type FormulaEngine } from "../engine";
import { formulaToDisplay, formulaToStored } from "../names";
import { FormulaScopeError, formulaScope } from "../scope";
import { formulaCycleError, formulaDefinitionError } from "../validate";

/**
 * ADR-291 G1 — root references by value-context tracking (review Round 1 · 2 h2): the installed
 * engine's value of the author's formula = the stored (id) form's = the form after a rename; the
 * dependency set is the root references; what the walk cannot classify is refused.
 */
let engine: FormulaEngine;
beforeAll(async () => {
  engine = await loadFormulaEngine();
});
const FIELDS = [
  { id: "f-price", key: "price" },
  { id: "f-qty", key: "qty" },
  { id: "f-items", key: "items" },
  { id: "f-a", key: "a" },
];
const ROW = {
  price: 10,
  qty: 2,
  items: [{ price: 10 }, { price: 20 }],
  a: { b: 7 },
};
const BY_ID = { "f-price": 10, "f-qty": 2, "f-items": ROW.items, "f-a": ROW.a };
const run = (expression: string, row: unknown) =>
  engine.formula.run(engine.formula.compile(expression), row, "en-US", {});
const roots = (expression: string) =>
  formulaScope(engine, expression).roots.map((root) => root.name);
const code = (fn: () => unknown) => {
  try {
    fn();
    return "ACCEPTED";
  } catch (error) {
    return error instanceof FormulaScopeError ? error.code : "OTHER";
  }
};

describe("ADR-291 G1 — root references · stored form · rename (fixture 8)", () => {
  // [author's text, hand-computed value, root references in source order]
  const FIXTURE: [string, unknown, string[]][] = [
    ["sum(items[*].price)", 30, ["items"]],
    ["@.price * qty", 20, ["price", "qty"]],
    ["(@).price", 10, ["price"]],
    ["@ | price", 10, ["price"]],
    ["a.b", 7, ["a"]],
    ["items[?price > 15]", [{ price: 20 }], ["items"]],
    ["map(items, &price)", [10, 20], ["items"]],
    ["{total: price * qty}.total", 20, ["price", "qty"]],
  ];
  it.each(FIXTURE)(
    "%s — engine value = stored value = renamed value · roots",
    (text, value, expected) => {
      expect(run(text, ROW)).toEqual(value);
      expect(roots(text)).toEqual(expected);
      const stored = formulaToStored(engine, text, FIELDS);
      expect(run(stored, BY_ID)).toEqual(value);
      // (The stored form reads ids only — a rename of `price` → `unitPrice` changes nothing there.)
      const renamed = FIELDS.map((field) =>
        field.id === "f-price" ? { ...field, key: "unitPrice" } : field,
      );
      expect(run(stored, BY_ID)).toEqual(value);
      const shown = formulaToDisplay(engine, stored, renamed);
      expect(roots(shown)).toEqual(
        expected.map((name) => (name === "price" ? "unitPrice" : name)),
      );
      expect(formulaToStored(engine, shown, renamed)).toBe(stored);
    },
  );

  it("the stored form quotes ids and keeps every other character", () => {
    expect(
      formulaToStored(engine, "sum(items[*].price)  +  @.price", FIELDS),
    ).toBe("sum('f-items'[*].price)  +  @.'f-price'");
    expect(formulaToDisplay(engine, "'f-price' * 'f-qty'", FIELDS)).toBe(
      "price * qty",
    );
  });

  it("a key the grammar cannot write bare is shown quoted (and escaped)", () => {
    const fields = [
      { id: "f-x", key: "unit price" },
      { id: "f-y", key: "it's" },
    ];
    const shown = formulaToDisplay(engine, "'f-x' * 'f-y'", fields);
    expect(shown).toBe("'unit price' * 'it\\'s'");
    expect(formulaToStored(engine, shown, fields)).toBe("'f-x' * 'f-y'");
  });

  it("what the walk cannot classify is refused, never passed quietly (unsupported 2 + mismatch)", () => {
    expect(code(() => formulaScope(engine, "sum(values(@)[*].price)"))).toBe(
      "FORMULA_SCOPE_UNSUPPORTED",
    );
    expect(code(() => formulaScope(engine, "a | b | c"))).toBe(
      "FORMULA_SCOPE_UNSUPPORTED",
    );
    expect(code(() => formulaScope(engine, "(price || @).qty"))).toBe(
      "FORMULA_SCOPE_UNSUPPORTED",
    );
    expect(code(() => formulaScope(engine, "price *"))).toBe("FORMULA_SYNTAX");
    // (A field a stored formula names that the collection does not have.)
    expect(code(() => formulaToDisplay(engine, "'f-nope' * 2", FIELDS))).toBe(
      "FORMULA_UNKNOWN_FIELD",
    );
  });

  it("globals · function names: `$var_<id>` is read, not a reference; a function name is not an identifier", () => {
    const scope = formulaScope(
      engine,
      "if(price > $var_min, length(items), 0)",
    );
    expect(scope.roots.map((root) => root.name)).toEqual(["price", "items"]);
    expect(scope.globals).toEqual(["$var_min"]);
    expect(scope.functions).toEqual(["if", "length"]);
  });
});

describe("ADR-291 G1 — the definition check", () => {
  const schema = (formula: string, type = "number") => [
    { id: "f-price", key: "price", type: "number" },
    { id: "f-qty", key: "qty", type: "number" },
    { id: "f-x", key: "x", type, formula },
  ];
  const check = (formula: string, type?: string) =>
    formulaDefinitionError(
      engine,
      schema(formula, type)[2] as never,
      schema(formula, type),
    )?.code;
  it("unknown root id · hidden function · unknown function · bad global · result type", () => {
    expect(check("'f-price' * 'f-qty'")).toBeUndefined();
    expect(check("'f-nope' * 2")).toBe("FORMULA_UNKNOWN_FIELD");
    expect(check("random()")).toBe("FORMULA_FUNCTION_HIDDEN");
    expect(check("foo('f-price')")).toBe("FORMULA_UNKNOWN_FUNCTION");
    expect(check("'f-price' * $rate")).toBe("FORMULA_GLOBAL");
    expect(check("'f-price' * $var_rate")).toBeUndefined();
    expect(check("'f-price'", "array")).toBe("FORMULA_RESULT_TYPE");
    expect(check("sum(values(@)[*].price)")).toBe("FORMULA_SCOPE_UNSUPPORTED");
  });
  it("computed fields reading each other in a loop are refused (a self-reference too)", () => {
    const loop = [
      { id: "f-a", key: "a", type: "number", formula: "'f-b' + 1" },
      { id: "f-b", key: "b", type: "number", formula: "'f-a' + 1" },
    ];
    expect(formulaCycleError(engine, loop)?.code).toBe("FORMULA_CYCLE");
    expect(
      formulaCycleError(engine, [
        { id: "f-a", key: "a", type: "number", formula: "'f-a' + 1" },
      ])?.code,
    ).toBe("FORMULA_CYCLE");
    expect(
      formulaCycleError(engine, [
        { id: "f-a", key: "a", type: "number", formula: "'f-b' + 1" },
        { id: "f-b", key: "b", type: "number", formula: "2" },
      ]),
    ).toBeUndefined();
  });
});
