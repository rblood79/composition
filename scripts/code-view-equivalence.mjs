#!/usr/bin/env node
/**
 * ADR-284 G6 — the code view's acceptance judge (breakdown §7 · §7a).
 *
 * One extractor reads two programs with the TypeScript parser — the reference example (react-spectrum
 * fixture, `packages/shared/src/codeView/__fixtures__/reference/`) and the code the generator made
 * for the example rebuilt in the builder (`__fixtures__/generated/`) — and turns each into the same
 * kind of facts about its data flow:
 *
 * - `state:<name>:<kind>` — a state (`useState` · a list's selection), kind text · boolean · number ·
 *   selection · sort;
 * - `term:<op>:<fields>:<value>:<skips>` — one `filter` term (`&&` splits terms; `x === 'all'` ·
 *   `x.size === 0` · `!flag` before `||` are its skips);
 * - `sort:var:<state>` · `sort:field:<f>` — the sort;
 * - `wire:<Component>.<prop>=<value>` — a prop a state · setter · handler · view feeds;
 * - `share:<Components>` — components reading the same rows; `count` — a count shown;
 * - `dnd:<Component>:<handlers>` · `dndop:<Component>.<handler>:<ops>` — drag and drop;
 * - `hook:collection-state` — the rows are state a handler writes.
 *
 * Styles and markup are not facts. The comparison covers the example's states (the input file's
 * `states`, §7a 비교하는 부분); facts about other states are printed as 「비교 밖」, never dropped
 * silently. `exclude` (with a reason each) removes facts from both sides. Equal fact sets = PASS.
 *
 * Usage: node scripts/code-view-equivalence.mjs [--json] [--generated <example>=<file>]   (exit 1 on a FAIL)
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = join(ROOT, "packages/shared/src/codeView/__fixtures__");
const require = createRequire(join(ROOT, "packages/shared/package.json"));
const ts = require("typescript");

const HOOKS_COLLECTION = new Set(["useListData", "useAsyncList"]);
const LIST_OPS = new Set([
  "update",
  "moveBefore",
  "moveAfter",
  "move",
  "remove",
  "removeSelectedItems",
  "insert",
  "insertBefore",
  "insertAfter",
  "append",
  "prepend",
  "reload",
  "loadMore",
  "setFilterText",
]);
const TEXT_FNS = {
  contains: "contains",
  startsWith: "startsWith",
  endsWith: "endsWith",
};
const TEXT_METHODS = {
  includes: "contains",
  startsWith: "startsWith",
  endsWith: "endsWith",
};
const TAG_ALIASES = { TableBody: "Table" };
const COLLECTIONS = new Set([
  "GridList",
  "ListBox",
  "Table",
  "Tree",
  "TagGroup",
  "Menu",
]);

/* ─── parsing ─────────────────────────────────────────────────────────────────────────────── */

function parse(path) {
  const text = readFileSync(path, "utf8");
  return ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

const unwrap = (node) => {
  let current = node;
  while (
    current &&
    (ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isNonNullExpression(current) ||
      ts.isSatisfiesExpression?.(current) ||
      ts.isTypeAssertionExpression?.(current))
  )
    current = current.expression;
  return current;
};
const textOf = (node) => node.getText().replace(/\s+/g, "");
const calleeName = (call) => {
  const callee = unwrap(call.expression);
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return undefined;
};

/** The function components of a file set (declarations and `const X = (…) =>`). */
function functionsOf(files) {
  const out = new Map();
  for (const file of files)
    file.forEachChild((node) => {
      if (ts.isFunctionDeclaration(node) && node.name)
        out.set(node.name.text, node);
      if (ts.isVariableStatement(node))
        for (const declaration of node.declarationList.declarations)
          if (
            ts.isIdentifier(declaration.name) &&
            declaration.initializer &&
            (ts.isArrowFunction(declaration.initializer) ||
              ts.isFunctionExpression(declaration.initializer))
          )
            out.set(declaration.name.text, declaration.initializer);
    });
  return out;
}

/* ─── extraction ──────────────────────────────────────────────────────────────────────────── */

class Extractor {
  constructor(files, options) {
    this.files = files;
    this.functions = functionsOf(files);
    this.aliases = options.fieldAliases ?? {};
    this.facts = new Set();
    this.states = new Map(); // name → kind
    this.setters = new Map(); // setter → state
    this.lists = new Map(); // list var → { selection?: name }
    this.views = new Map(); // identifier → view id
    this.viewCount = 0;
    this.readers = new Map(); // view id → Set<tag>
    this.module = new Map();
    this.tags = [];
  }

  run(entry) {
    // Module-level views (`const emojis = _emojis.filter(…)`) — the components see them.
    for (const file of this.files)
      file.forEachChild((node) => {
        if (ts.isVariableStatement(node)) this.statement(node, this.module);
      });
    const fn = this.functions.get(entry) ?? this.defaultExport();
    if (!fn) throw new Error(`no component ${entry}`);
    this.component(fn, new Map());
    for (const [, tags] of this.readers)
      if (tags.size > 1) this.facts.add(`share:${[...tags].sort().join("+")}`);
    return this.facts;
  }

  defaultExport() {
    for (const file of this.files)
      for (const node of file.statements)
        if (
          ts.isFunctionDeclaration(node) &&
          node.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
        )
          return node;
    return undefined;
  }

  /** A component's body with `env` (its props from the caller — name → abstract value). */
  component(fn, env) {
    const scope = new Map([...this.module, ...env]);
    const [param] = fn.parameters ?? [];
    if (param && ts.isObjectBindingPattern(param.name))
      for (const element of param.name.elements)
        if (ts.isIdentifier(element.name)) {
          const key = element.propertyName?.getText() ?? element.name.text;
          scope.set(
            element.name.text,
            env.get(`prop:${key}`) ?? { kind: "const" },
          );
        }
    if (param && ts.isIdentifier(param.name))
      scope.set(param.name.text, { kind: "props", env });
    const body = fn.body;
    if (!body) return;
    if (!ts.isBlock(body)) return this.jsx(body, scope);
    for (const statement of body.statements) {
      if (ts.isVariableStatement(statement)) this.statement(statement, scope);
      if (ts.isReturnStatement(statement) && statement.expression)
        this.jsx(statement.expression, scope);
    }
  }

  statement(node, scope) {
    for (const declaration of node.declarationList.declarations) {
      const init = declaration.initializer && unwrap(declaration.initializer);
      if (!init) continue;
      // let [x, setX] = useState(…)
      if (
        ts.isArrayBindingPattern(declaration.name) &&
        ts.isCallExpression(init)
      ) {
        if (calleeName(init) !== "useState") continue;
        const [state, setter] = declaration.name.elements.map((element) =>
          ts.isBindingElement(element) && ts.isIdentifier(element.name)
            ? element.name.text
            : undefined,
        );
        if (!state) continue;
        const kind = this.stateKind(init);
        if (kind === "collection") {
          this.lists.set(state, { setter });
          if (setter) this.setters.set(setter, { collection: state });
          scope.set(state, { kind: "collection", name: state });
          continue;
        }
        this.states.set(state, kind);
        if (setter) this.setters.set(setter, { state });
        scope.set(state, { kind: "state", name: state });
        if (setter) scope.set(setter, { kind: "setter", name: state });
        continue;
      }
      if (ts.isObjectBindingPattern(declaration.name)) {
        // let {dragAndDropHooks: x} = useDragAndDrop({…})
        if (
          ts.isCallExpression(init) &&
          calleeName(init) === "useDragAndDrop"
        ) {
          for (const element of declaration.name.elements)
            if (ts.isIdentifier(element.name))
              scope.set(element.name.text, {
                kind: "dnd",
                options: init.arguments[0],
                scope,
              });
          continue;
        }
        // let {selectedKeys: x, setSelectedKeys: setX} = list
        if (ts.isIdentifier(init) && this.lists.has(init.text)) {
          let state;
          let setter;
          for (const element of declaration.name.elements) {
            const key =
              element.propertyName?.getText() ?? element.name.getText();
            if (key === "selectedKeys") state = element.name.getText();
            if (key === "setSelectedKeys") setter = element.name.getText();
          }
          if (state) {
            this.states.set(state, "selection");
            this.lists.get(init.text).selection = state;
            scope.set(state, { kind: "state", name: state });
            if (setter) {
              this.setters.set(setter, { state });
              scope.set(setter, { kind: "setter", name: state });
            }
          }
          continue;
        }
        // let {a, b} = props
        if (ts.isIdentifier(init) && scope.get(init.text)?.kind === "props") {
          const env = scope.get(init.text).env;
          for (const element of declaration.name.elements) {
            const key =
              element.propertyName?.getText() ?? element.name.getText();
            scope.set(
              element.name.getText(),
              env.get(`prop:${key}`) ?? { kind: "const" },
            );
          }
        }
        continue;
      }
      if (!ts.isIdentifier(declaration.name)) continue;
      const name = declaration.name.text;
      if (ts.isCallExpression(init) && HOOKS_COLLECTION.has(calleeName(init))) {
        this.lists.set(name, {});
        scope.set(name, { kind: "collection", name });
        continue;
      }
      if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
        scope.set(name, { kind: "fn", node: init, scope });
        continue;
      }
      const view = this.view(init, scope);
      if (view) {
        this.views.set(name, view);
        scope.set(name, { kind: "view", id: view });
      } else if (this.readsView(init, scope)) {
        // (Rows derived from a view — a grouping, a count — are a view too.)
        const id = `view${(this.viewCount += 1)}`;
        this.views.set(name, id);
        scope.set(name, { kind: "view", id });
      }
    }
  }

  stateKind(call) {
    const type = call.typeArguments?.[0]?.getText();
    const [init] = call.arguments;
    const value = init && unwrap(init);
    if (
      type === "Selection" ||
      (value &&
        ts.isNewExpression(value) &&
        value.expression.getText() === "Set")
    )
      return "selection";
    if (type === "SortDescriptor") return "sort";
    if (!value) return "other";
    if (
      value.kind === ts.SyntaxKind.TrueKeyword ||
      value.kind === ts.SyntaxKind.FalseKeyword
    )
      return "boolean";
    if (ts.isStringLiteral(value)) return "text";
    if (ts.isNumericLiteral(value)) return "number";
    if (ts.isObjectLiteralExpression(value) && /column/.test(value.getText()))
      return "sort";
    if (value.kind === ts.SyntaxKind.NullKeyword) return "other";
    return "collection";
  }

  /** A derived rows expression → a view id (its terms and sort become facts). */
  view(node, scope, skips = []) {
    let expr = unwrap(node);
    if (ts.isCallExpression(expr) && calleeName(expr) === "useMemo") {
      const [fn] = expr.arguments;
      if (fn && ts.isArrowFunction(fn)) expr = unwrap(fn.body);
    }
    // cond ? rows : rows.filter(…) — the condition is a skip of the terms.
    if (ts.isConditionalExpression(expr)) {
      const skip = this.skipOf(unwrap(expr.condition), scope);
      if (skip) return this.view(expr.whenFalse, scope, [...skips, skip]);
    }
    if (
      !ts.isCallExpression(expr) ||
      !ts.isPropertyAccessExpression(expr.expression)
    ) {
      if (ts.isIdentifier(expr) && scope.get(expr.text)?.kind === "view")
        return scope.get(expr.text).id;
      return undefined;
    }
    const method = expr.expression.name.text;
    const base = unwrap(expr.expression.expression);
    if (!["filter", "sort", "toSorted"].includes(method)) return undefined;
    const known = this.view(base, scope, skips);
    const id = known ?? `view${(this.viewCount += 1)}`;
    const [fn] = expr.arguments;
    if (!fn || !(ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)))
      return id;
    if (method === "filter") this.terms(fn, scope, skips);
    else this.sort(fn, scope);
    return id;
  }

  /** A skip pattern of a state: `x === 'all'` · `x.size === 0` · `x === ''` · `!x` · `x === 'lit'`. */
  skipOf(expr, scope) {
    if (
      ts.isPrefixUnaryExpression(expr) &&
      expr.operator === ts.SyntaxKind.ExclamationToken
    ) {
      const name = this.stateName(unwrap(expr.operand), scope);
      return name ? { state: name, skip: "enabled" } : undefined;
    }
    if (
      !ts.isBinaryExpression(expr) ||
      expr.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken
    )
      return undefined;
    const left = unwrap(expr.left);
    const right = unwrap(expr.right);
    if (
      ts.isPropertyAccessExpression(left) &&
      left.name.text === "size" &&
      right.getText() === "0"
    ) {
      const name = this.stateName(unwrap(left.expression), scope);
      return name ? { state: name, skip: "empty" } : undefined;
    }
    const name = this.stateName(left, scope);
    if (!name || !ts.isStringLiteral(right)) return undefined;
    if (right.text === "") return { state: name, skip: "empty" };
    if (right.text === "all" && this.states.get(name) === "selection")
      return { state: name, skip: "all" };
    return { state: name, skip: `'${right.text}'` };
  }

  stateName(expr, scope) {
    if (!ts.isIdentifier(expr)) return undefined;
    const value = scope.get(expr.text);
    return value?.kind === "state" ? value.name : undefined;
  }

  terms(fn, scope, skips) {
    const param = fn.parameters[0]?.name.getText();
    let body = fn.body;
    if (ts.isBlock(body)) {
      const ret = body.statements.find(ts.isReturnStatement);
      body = ret?.expression;
    }
    if (!body) return;
    const ands = [];
    const split = (expr) => {
      const e = unwrap(expr) === expr ? expr : expr; // keep parens: (a || b) is one term
      if (
        ts.isBinaryExpression(e) &&
        e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
      ) {
        split(e.left);
        split(e.right);
      } else ands.push(e);
    };
    split(body);
    // Global skips (ternary) attach to the terms that read their state.
    for (const term of ands) this.term(term, param, scope, skips);
  }

  term(node, param, scope, outer) {
    const expr = unwrap(node);
    const parts = [];
    const flatten = (e) => {
      const u = unwrap(e);
      if (
        ts.isBinaryExpression(u) &&
        u.operatorToken.kind === ts.SyntaxKind.BarBarToken
      ) {
        flatten(u.left);
        flatten(u.right);
      } else parts.push(u);
    };
    flatten(expr);
    const skips = [];
    const cores = [];
    for (const part of parts) {
      const skip = this.skipOf(part, scope);
      if (skip && !this.readsParam(part, param)) skips.push(skip);
      else cores.push(part);
    }
    if (!cores.length) return;
    const classified = cores
      .map((core) => this.core(core, param, scope))
      .filter(Boolean);
    if (!classified.length)
      return this.facts.add(`term:unknown:${textOf(node)}`);
    const op = classified[0].op;
    const fields = [...new Set(classified.flatMap((c) => c.fields))].sort();
    const value =
      classified.find((c) => c.value !== "const")?.value ?? classified[0].value;
    const valueState = value.startsWith("state:") ? value.slice(6) : undefined;
    const allSkips = [
      ...skips,
      ...outer.filter((skip) => skip.state === valueState),
    ]
      .map((skip) =>
        skip.skip === "enabled" ? `enabled:${skip.state}` : skip.skip,
      )
      .sort();
    this.facts.add(
      `term:${op}:${fields.join(",")}:${value}:${allSkips.join(",")}`,
    );
  }

  readsParam(node, param) {
    let found = false;
    const visit = (n) => {
      if (ts.isIdentifier(n) && n.text === param) found = true;
      if (!found) n.forEachChild(visit);
    };
    visit(node);
    return found;
  }

  /** One comparison: its op, the row fields it reads, its value. */
  core(node, param, scope) {
    const expr = unwrap(node);
    if (
      ts.isPrefixUnaryExpression(expr) &&
      expr.operator === ts.SyntaxKind.ExclamationToken
    ) {
      const inner = this.core(expr.operand, param, scope);
      if (!inner) return undefined;
      const negated = {
        contains: "notContains",
        startsWith: "notStartsWith",
        endsWith: "notEndsWith",
        equals: "notEquals",
        exists: "notExists",
      }[inner.op];
      return negated ? { ...inner, op: negated } : undefined;
    }
    // (x != null && x !== '') — the field has a value
    if (
      ts.isBinaryExpression(expr) &&
      expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
    ) {
      const left = this.field(unwrap(expr.left).left ?? expr.left, param);
      if (
        left &&
        /!=\s*null/.test(expr.left.getText()) &&
        /!==\s*''/.test(expr.right.getText())
      )
        return { op: "exists", fields: [left], value: "const" };
      return undefined;
    }
    if (ts.isCallExpression(expr)) {
      const name = calleeName(expr);
      const callee = unwrap(expr.expression);
      // contains(x, v) — useFilter (an alias `startsWithVariant` too)
      const fn = Object.keys(TEXT_FNS).find(
        (key) => ts.isIdentifier(callee) && callee.text.startsWith(key),
      );
      if (fn && expr.arguments.length === 2) {
        const field = this.field(expr.arguments[0], param);
        if (field)
          return {
            op: TEXT_FNS[fn],
            fields: [field],
            value: this.value(expr.arguments[1], scope),
          };
      }
      if (ts.isPropertyAccessExpression(callee)) {
        const object = unwrap(callee.expression);
        // x.startsWith(v) — the string method
        if (TEXT_METHODS[name] && name !== "includes") {
          const field = this.field(object, param);
          if (field)
            return {
              op: TEXT_METHODS[name],
              fields: [field],
              value: this.value(expr.arguments[0], scope),
            };
        }
        // v.has(x.f) · [..].includes(x.f)
        if (name === "has" || name === "includes") {
          const field = this.field(expr.arguments[0], param);
          if (field)
            return {
              op: "oneOf",
              fields: [field],
              value: this.value(object, scope),
            };
        }
        // x.f.some(e => contains(e, v))
        if (name === "some") {
          const field = this.field(object, param);
          const [inner] = expr.arguments;
          if (field && inner && ts.isArrowFunction(inner)) {
            const nested = this.core(
              inner.body,
              inner.parameters[0].name.getText(),
              scope,
            );
            if (nested)
              return {
                ...nested,
                fields: nested.fields.map((f) =>
                  f === "$element" ? field : f,
                ),
              };
          }
        }
      }
    }
    if (ts.isBinaryExpression(expr)) {
      const kind = expr.operatorToken.kind;
      const left = unwrap(expr.left);
      const right = unwrap(expr.right);
      // typeof x.f === 'string'
      if (ts.isTypeOfExpression(left) && ts.isStringLiteral(right)) {
        const field = this.field(left.expression, param);
        if (field) return { op: "exists", fields: [field], value: "const" };
      }
      const ops = {
        [ts.SyntaxKind.EqualsEqualsEqualsToken]: "equals",
        [ts.SyntaxKind.ExclamationEqualsEqualsToken]: "notEquals",
        [ts.SyntaxKind.GreaterThanEqualsToken]: "gte",
        [ts.SyntaxKind.GreaterThanToken]: "gt",
        [ts.SyntaxKind.LessThanEqualsToken]: "lte",
        [ts.SyntaxKind.LessThanToken]: "lt",
      };
      if (ops[kind]) {
        const lf = this.field(left, param);
        const rf = this.field(right, param);
        if (lf && !rf) {
          const value =
            right.kind === ts.SyntaxKind.TrueKeyword
              ? "const"
              : this.value(right, scope);
          return { op: ops[kind], fields: [lf], value };
        }
        if (rf && !lf)
          return {
            op: ops[kind],
            fields: [rf],
            value: this.value(left, scope),
          };
      }
    }
    // a bare item.f — 「예」
    const field = this.field(expr, param);
    if (field) return { op: "equals", fields: [field], value: "const" };
    return undefined;
  }

  /** A row field read from the filter's parameter (`item.f` · `String(item.f)` · `item.f.join('')`). */
  field(node, param) {
    let expr = unwrap(node);
    if (
      ts.isCallExpression(expr) &&
      calleeName(expr) === "String" &&
      expr.arguments.length === 1
    )
      expr = unwrap(expr.arguments[0]);
    if (ts.isCallExpression(expr) && calleeName(expr) === "join")
      expr = unwrap(expr.expression.expression);
    const text = expr.getText();
    if (this.aliases[text]) return this.aliases[text];
    // (The element itself — `x` in `item.tags.some(x => contains(x, v))`: the caller names the field.)
    if (ts.isIdentifier(expr) && expr.text === param) return "$element";
    if (
      ts.isPropertyAccessExpression(expr) ||
      ts.isElementAccessExpression(expr)
    ) {
      const path = [];
      let current = expr;
      while (
        ts.isPropertyAccessExpression(current) ||
        ts.isElementAccessExpression(current)
      ) {
        path.unshift(
          ts.isPropertyAccessExpression(current)
            ? current.name.text
            : current.argumentExpression.getText().replace(/['"]/g, ""),
        );
        current = unwrap(current.expression);
      }
      if (ts.isIdentifier(current) && current.text === param)
        return path.join(".");
    }
    return undefined;
  }

  /** A value: a state it reads, else a constant (a literal, a prop the caller gives a literal). */
  value(node, scope) {
    const expr = unwrap(node);
    if (ts.isIdentifier(expr)) {
      const value = scope.get(expr.text);
      if (value?.kind === "state") return `state:${value.name}`;
    }
    if (ts.isPropertyAccessExpression(expr))
      return this.value(expr.expression, scope);
    return "const";
  }

  sort(fn, scope) {
    const text = fn.getText();
    for (const [name, kind] of this.states)
      if (kind === "sort" && new RegExp(`\\b${name}\\.column\\b`).test(text)) {
        if (scope.get(name)?.kind === "state")
          return this.facts.add(`sort:var:${name}`);
      }
    const field = /\ba\.([A-Za-z_$][\w$]*)/.exec(text);
    this.facts.add(field ? `sort:field:${field[1]}` : `sort:unknown`);
  }

  /* ── JSX ── */

  jsx(node, scope) {
    const visit = (n) => {
      if (ts.isJsxElement(n)) {
        this.element(n.openingElement, n.children, scope);
        return;
      }
      if (ts.isJsxSelfClosingElement(n)) {
        this.element(n, [], scope);
        return;
      }
      n.forEachChild(visit);
    };
    visit(node);
  }

  element(opening, children, scope) {
    const raw = opening.tagName.getText();
    const custom = this.functions.get(raw);
    if (custom && /^[A-Z]/.test(raw) && !["Button"].includes(raw)) {
      // (A custom component: its props are the caller's values — inlined, N11.)
      const env = new Map();
      for (const attribute of opening.attributes.properties)
        if (ts.isJsxAttribute(attribute) && attribute.initializer) {
          const expr = ts.isJsxExpression(attribute.initializer)
            ? attribute.initializer.expression
            : attribute.initializer;
          env.set(
            `prop:${attribute.name.getText()}`,
            this.abstract(expr, scope),
          );
        }
      this.component(custom, env);
      return;
    }
    const tag = TAG_ALIASES[raw] ?? raw;
    this.tags.push(tag);
    for (const attribute of opening.attributes.properties) {
      if (!ts.isJsxAttribute(attribute) || !attribute.initializer) continue;
      const prop = attribute.name.getText();
      const expr = ts.isJsxExpression(attribute.initializer)
        ? attribute.initializer.expression
        : attribute.initializer;
      if (!expr) continue;
      this.wire(tag, prop, expr, scope);
    }
    for (const child of children) {
      if (ts.isJsxExpression(child) && child.expression) {
        const expr = unwrap(child.expression);
        // {rows.map(item => …)} in a collection — its items
        if (ts.isCallExpression(expr) && calleeName(expr) === "map") {
          const base = unwrap(expr.expression.expression);
          const value = this.abstract(base, scope);
          if (value.kind === "view" || value.kind === "collection")
            // (Inside a wrapper — AnimatePresence — the items are the nearest collection's.)
            this.items(
              [...this.tags].reverse().find((name) => COLLECTIONS.has(name)) ??
                tag,
              value,
            );
          continue;
        }
        if (
          /\.length\b|\.count\b/.test(expr.getText()) &&
          this.readsView(expr, scope)
        ) {
          this.facts.add("count");
          continue;
        }
        this.jsx(child.expression, scope);
      } else this.jsx(child, scope);
    }
    this.tags.pop();
  }

  readsView(expr, scope) {
    let found = false;
    const visit = (n) => {
      if (ts.isIdentifier(n)) {
        const value = scope.get(n.text);
        if (value?.kind === "view" || value?.kind === "collection")
          found = true;
      }
      if (!found) n.forEachChild(visit);
    };
    visit(expr);
    return found;
  }

  items(tag, value) {
    const id = value.kind === "view" ? value.id : `collection:${value.name}`;
    this.facts.add(`wire:${tag}.items=${value.kind}`);
    if (!this.readers.has(id)) this.readers.set(id, new Set());
    this.readers.get(id).add(tag);
  }

  /** An attribute's value as the extractor sees it (state · setter · view · fn · const …). */
  abstract(node, scope) {
    if (!node) return { kind: "const" };
    const expr = unwrap(node);
    if (ts.isIdentifier(expr))
      return scope.get(expr.text) ?? { kind: "const", text: expr.text };
    if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr))
      return { kind: "fn", node: expr, scope };
    if (ts.isArrayLiteralExpression(expr) && expr.elements.length === 1) {
      const inner = this.abstract(expr.elements[0], scope);
      if (inner.kind === "state") return { kind: "state", name: inner.name };
    }
    if (ts.isPropertyAccessExpression(expr) && expr.name.text === "items") {
      const base = this.abstract(expr.expression, scope);
      if (base.kind === "collection") return base;
    }
    const states = new Set();
    const visit = (n) => {
      if (ts.isIdentifier(n) && scope.get(n.text)?.kind === "state")
        states.add(scope.get(n.text).name);
      n.forEachChild(visit);
    };
    visit(expr);
    if (states.size)
      return { kind: "expr", text: textOf(expr), states: [...states] };
    return { kind: "const" };
  }

  wire(tag, prop, expr, scope) {
    const value = this.abstract(expr, scope);
    if (prop === "dragAndDropHooks" && value.kind === "dnd")
      return this.dnd(tag, value);
    if (
      prop === "items" &&
      (value.kind === "view" || value.kind === "collection")
    )
      return this.items(tag, value);
    if (value.kind === "state")
      return this.facts.add(`wire:${tag}.${prop}=state:${value.name}`);
    if (value.kind === "setter")
      return this.facts.add(`wire:${tag}.${prop}=calls:set:${value.name}`);
    if (value.kind === "expr")
      return this.facts.add(`wire:${tag}.${prop}=expr:${value.text}`);
    if (value.kind === "fn") {
      const ops = this.ops(value.node, value.scope);
      if (ops.length)
        this.facts.add(`wire:${tag}.${prop}=calls:${ops.join(",")}`);
    }
  }

  /** What a handler does: setters it calls, list operations (N9 · N10), inlined prop functions. */
  ops(fn, scope, depth = 0) {
    const out = new Set();
    if (depth > 4) return [];
    const visit = (n) => {
      if (ts.isCallExpression(n)) {
        const callee = unwrap(n.expression);
        if (ts.isIdentifier(callee)) {
          const value = scope.get(callee.text);
          if (value?.kind === "setter") {
            const [arg] = n.arguments;
            out.add(`set:${value.name}`);
            void arg;
          } else if (value?.kind === "fn")
            this.ops(value.node, value.scope, depth + 1).forEach((op) =>
              out.add(op),
            );
          else {
            const setter = this.setters.get(callee.text);
            if (setter?.collection) {
              // setRows(rows.filter(… !sel.has(…))) · setRows(rows.map(… {...r, f})) — N9 · N10
              const text = n.arguments[0]?.getText() ?? "";
              if (/\.filter\(/.test(text) && /!\s*\w+\.has\(/.test(text)) {
                out.add("removeSelectedItems");
                const sel = /!\s*(\w+)\.has\(/.exec(text)?.[1];
                if (sel && this.states.has(sel)) out.add(`set:${sel}`);
              } else if (/\.map\(/.test(text) && /\.\.\./.test(text))
                out.add("update");
              else out.add(`set-rows`);
            }
          }
        }
        if (ts.isPropertyAccessExpression(callee)) {
          const base = unwrap(callee.expression);
          const method = callee.name.text;
          if (
            ts.isIdentifier(base) &&
            scope.get(base.text)?.kind === "collection" &&
            LIST_OPS.has(method)
          ) {
            out.add(method);
            // (useListData's removeSelectedItems empties its selection — N9.)
            const list = this.lists.get(scope.get(base.text).name);
            if (method === "removeSelectedItems" && list?.selection)
              out.add(`set:${list.selection}`);
          }
        }
      }
      n.forEachChild(visit);
    };
    visit(fn.body ?? fn);
    return [...out].sort();
  }

  dnd(tag, value) {
    const options = value.options;
    if (!options || !ts.isObjectLiteralExpression(options)) return;
    const handlers = [];
    for (const property of options.properties) {
      const name = property.name?.getText();
      if (!name || !(name.startsWith("on") || name === "getItems")) continue;
      handlers.push(name);
      const fn = ts.isMethodDeclaration(property)
        ? property
        : ts.isPropertyAssignment(property)
          ? unwrap(property.initializer)
          : undefined;
      if (fn && name.startsWith("on")) {
        const ops = this.ops(fn, value.scope);
        this.facts.add(`dndop:${tag}.${name}:${ops.join(",")}`);
      }
    }
    this.facts.add(`dnd:${tag}:${handlers.sort().join(",")}`);
  }
}

/* ─── judge ───────────────────────────────────────────────────────────────────────────────── */

const glob = (pattern) =>
  new RegExp(
    `^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}(?:[:=].*)?$`,
  );

/** A fact's states (the ones it names); empty = a structural fact (views · dnd · count). */
function factStates(fact) {
  const names = new Set();
  for (const match of fact.matchAll(/(?:state|set):([A-Za-z_$][\w$]*)/g))
    names.add(match[1]);
  const enabled = /enabled:([A-Za-z_$][\w$]*)/.exec(fact);
  if (enabled) names.add(enabled[1]);
  if (fact.startsWith("sort:var:")) names.add(fact.slice(9));
  if (fact.startsWith("wire:") && fact.includes("=expr:")) {
    // (an expression's states are its identifiers)
    for (const match of fact.split("=expr:")[1].matchAll(/[A-Za-z_$][\w$]*/g))
      names.add(match[0]);
  }
  return names;
}

/** Keep the facts the example compares: its states' and the structural ones. */
function scoped(facts, states, extractor, example) {
  const inScope = new Set();
  const outside = [];
  const WRITES =
    /\b(update|moveBefore|moveAfter|move|remove|removeSelectedItems|insert|insertBefore|insertAfter|append|prepend|set-rows)\b/;
  for (const fact of facts) {
    if (fact.startsWith("state:")) {
      const name = fact.split(":")[1];
      if (states.has(name)) inScope.add(fact);
      else outside.push(fact);
      continue;
    }
    if (fact.includes("=calls:")) {
      const [head, list] = fact.split("=calls:");
      const ops = list
        .split(",")
        .filter((op) =>
          op.startsWith("set:")
            ? states.has(op.slice(4))
            : example.compareWrites !== false,
        );
      if (ops.length) inScope.add(`${head}=calls:${ops.join(",")}`);
      else outside.push(fact);
      continue;
    }
    if (fact.startsWith("dndop:")) {
      const [head, list] = [
        fact.slice(0, fact.lastIndexOf(":")),
        fact.slice(fact.lastIndexOf(":") + 1),
      ];
      const ops = list
        .split(",")
        .filter(
          (op) => op && (!op.startsWith("set:") || states.has(op.slice(4))),
        );
      inScope.add(`${head}:${ops.join(",")}`);
      continue;
    }
    const named = [...factStates(fact)].filter((name) =>
      extractor.states.has(name),
    );
    if (named.length && !named.some((name) => states.has(name)))
      outside.push(fact);
    else inScope.add(fact);
  }
  // (The rows are state when a compared handler writes them — N1.)
  if (
    [...inScope].some(
      (fact) =>
        /^(wire|dndop):/.test(fact) &&
        WRITES.test(fact.split(/[=:]/).slice(-1)[0] ?? ""),
    )
  )
    inScope.add("hook:collection-state");
  return { inScope, outside };
}

export function judge(options = {}) {
  const input = JSON.parse(
    readFileSync(join(FIXTURES, "equivalence.json"), "utf8"),
  );
  const results = [];
  for (const [name, example] of Object.entries(input.examples)) {
    if (options.only && options.only !== name) continue;
    const states = new Set(example.states);
    const side = (paths, entry, generated) => {
      const files = paths.map((path) =>
        parse(isAbsolute(path) ? path : join(FIXTURES, path)),
      );
      const extractor = new Extractor(files, example);
      const facts = extractor.run(generated ? undefined : entry);
      return { extractor, facts };
    };
    const reference = side(example.reference, example.entry, false);
    // (`--generated <example>=<file>` — another generated code, e.g. one copied from the Builder.)
    const generated = side(
      [options.generated?.[name] ?? example.generated],
      undefined,
      true,
    );
    const excludes = example.exclude.map((rule) => ({
      ...rule,
      test: glob(rule.fact),
      hits: 0,
    }));
    const filter = (facts) =>
      new Set(
        [...facts].filter((fact) => {
          const rule = excludes.find((item) => item.test.test(fact));
          if (rule) rule.hits += 1;
          return !rule;
        }),
      );
    const ref = scoped(
      filter(reference.facts),
      states,
      reference.extractor,
      example,
    );
    const gen = scoped(
      filter(generated.facts),
      states,
      generated.extractor,
      example,
    );
    const missing = [...ref.inScope]
      .filter((fact) => !gen.inScope.has(fact))
      .sort();
    const extra = [...gen.inScope]
      .filter((fact) => !ref.inScope.has(fact))
      .sort();
    results.push({
      name,
      pass: !missing.length && !extra.length,
      compared: [...ref.inScope].sort(),
      missing,
      extra,
      outside: ref.outside.sort(),
      excluded: excludes.map(({ fact, reason, hits }) => ({
        fact,
        reason,
        hits,
      })),
    });
  }
  return { normalizations: input.normalizations, results };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const json = process.argv.includes("--json");
  const generated = Object.fromEntries(
    process.argv
      .flatMap((arg, index) =>
        arg === "--generated" ? [process.argv[index + 1]] : [],
      )
      .map((pair) => {
        const at = pair.indexOf("=");
        return [pair.slice(0, at), resolve(pair.slice(at + 1))];
      }),
  );
  const only = Object.keys(generated).length === 1
    ? Object.keys(generated)[0]
    : undefined;
  const report = judge({ generated, ...(only ? { only } : {}) });
  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    for (const result of report.results) {
      console.log(
        `${result.pass ? "PASS" : "FAIL"} ${result.name} — ${result.compared.length} facts`,
      );
      for (const fact of result.compared) console.log(`    = ${fact}`);
      for (const fact of result.missing)
        console.log(`    - reference only: ${fact}`);
      for (const fact of result.extra)
        console.log(`    + generated only: ${fact}`);
      if (result.outside.length)
        console.log(
          `    비교 밖 (states not in §7a): ${result.outside.join(" · ")}`,
        );
      for (const rule of result.excluded)
        console.log(`    제외 ${rule.fact} ×${rule.hits} — ${rule.reason}`);
    }
  }
  process.exit(report.results.every((result) => result.pass) ? 0 : 1);
}
