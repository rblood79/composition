/**
 * ADR-285 Phase 1 — the code view's code read back: the generated shape (Decision 2) parsed with
 * the editor's own parser (`@lezer/javascript`, decision 4 — the tree CodeMirror already holds),
 * as the statements of the page component and its JSX tree. Nothing is run. A part the generator
 * never writes (another kind of statement, a spread attribute, a module function) is a problem with
 * its span; a syntax error is too (lezer marks it, never throws).
 */
import type { SyntaxNode } from "@lezer/common";
import { parser } from "@lezer/javascript";

const tsx = parser.configure({ dialect: "jsx ts" });

export interface CodeViewSpan {
  readonly from: number;
  readonly to: number;
}

/** A statement of the page component (or the module) by the vocabulary it belongs to. */
export type CodeViewStatementKind =
  | "import"
  | "toasts"
  | "state"
  | "listSelection"
  | "collection"
  | "effect"
  | "useFilter"
  | "collator"
  | "navigate"
  | "dnd"
  | "view";

export interface CodeViewStatement extends CodeViewSpan {
  readonly kind: CodeViewStatementKind;
  readonly code: string;
  /** The name it declares (`let [<name>, …]` · `let <name> =`). */
  readonly name?: string;
  /** A state's setter (`let [x, <setter>]`). */
  readonly setter?: string;
}

export interface CodeViewAttribute extends CodeViewSpan {
  readonly name: string;
  /** Absent = a bare attribute (`isDisabled` — `{true}`). */
  readonly value?: CodeViewSpan & {
    readonly kind: "string" | "expression";
    /** A string's text without its quotes; an expression's code without its braces. */
    readonly code: string;
  };
}

export interface CodeViewElement extends CodeViewSpan {
  readonly type: string;
  /** `{<state> && <T …/>}` — a rule's visibility state. */
  readonly visibleState?: string;
  readonly attributes: readonly CodeViewAttribute[];
  /** The text before the children (`Text` · `{`…`}`) as written. */
  readonly text?: CodeViewSpan & { readonly code: string };
  /** A list's row template (`{item => <ListBoxItem …>}`). */
  readonly rows?: CodeViewSpan & { readonly code: string };
  readonly children: readonly CodeViewElement[];
}

export type CodeViewProblemReason = "unparsable" | "outsideVocabulary";

export interface CodeViewProblem extends CodeViewSpan {
  readonly reason: CodeViewProblemReason;
}

export interface CodeViewParsed {
  readonly code: string;
  readonly statements: readonly CodeViewStatement[];
  /** `export default function <name>() { … }`. */
  readonly component?: CodeViewSpan & { readonly name: string };
  /** `return (<> … </>)` — the page's elements. */
  readonly jsx?: CodeViewSpan & { readonly roots: readonly CodeViewElement[] };
  readonly problems: readonly CodeViewProblem[];
}

const STATEMENTS: readonly [RegExp, CodeViewStatementKind][] = [
  [/^let \[([A-Za-z_$][\w$]*), ([A-Za-z_$][\w$]*)\] = useState\b/, "state"],
  [
    /^let \{selectedKeys: ([A-Za-z_$][\w$]*), setSelectedKeys: ([A-Za-z_$][\w$]*)\} = [A-Za-z_$][\w$]*;$/,
    "listSelection",
  ],
  [/^let ([A-Za-z_$][\w$]*) = use(?:List|Async)(?:Data|List)\(/, "collection"],
  [/^useEffect\(/, "effect"],
  [/^let \{[^}]*\} = useFilter\(/, "useFilter"],
  [/^let collator = useCollator\(\);$/, "collator"],
  [/^let navigate = useNavigate\(\);$/, "navigate"],
  [/^let \{dragAndDropHooks: ([A-Za-z_$][\w$]*)\} = useDragAndDrop\(/, "dnd"],
  [/^let ([A-Za-z_$][\w$]*) = /, "view"],
];

/** Parse the code view's code (the generated shape) into its statements and elements. */
export function parseCodeView(code: string): CodeViewParsed {
  const tree = tsx.parse(code);
  const problems: CodeViewProblem[] = [];
  tree.iterate({
    enter(node) {
      if (node.type.isError)
        problems.push({
          from: node.from,
          to: Math.max(node.to, node.from + 1),
          reason: "unparsable",
        });
    },
  });
  const text = (node: { from: number; to: number }) =>
    code.slice(node.from, node.to);
  const outside = (node: CodeViewSpan) =>
    problems.push({
      from: node.from,
      to: node.to,
      reason: "outsideVocabulary",
    });
  const statements: CodeViewStatement[] = [];
  let component: CodeViewParsed["component"];
  let jsx: CodeViewParsed["jsx"];

  const statement = (node: SyntaxNode, kind: CodeViewStatementKind) => {
    const source = text(node);
    const match = STATEMENTS.find(([, item]) => item === kind)?.[0].exec(
      source,
    );
    statements.push({
      from: node.from,
      to: node.to,
      kind,
      code: source,
      ...(match?.[1] ? { name: match[1] } : {}),
      ...(kind === "state" || kind === "listSelection"
        ? { setter: match?.[2] }
        : {}),
    });
  };

  for (let node = tree.topNode.firstChild; node; node = node.nextSibling) {
    if (isComment(node) || node.type.isError) continue;
    if (node.name === "ImportDeclaration") {
      statement(node, "import");
      continue;
    }
    if (
      node.name === "VariableDeclaration" &&
      /^const toasts = new UNSTABLE_ToastQueue\b/.test(text(node))
    ) {
      statement(node, "toasts");
      continue;
    }
    const fn =
      node.name === "ExportDeclaration" &&
      node.getChild("default") &&
      node.getChild("FunctionDeclaration");
    if (!fn || component) {
      outside(node);
      continue;
    }
    const name = fn.getChild("VariableDefinition");
    const params = fn.getChild("ParamList");
    const block = fn.getChild("Block");
    if (!name || !block || (params && text(params) !== "()")) {
      outside(node);
      continue;
    }
    component = { from: node.from, to: node.to, name: text(name) };
    for (let child = block.firstChild; child; child = child.nextSibling) {
      if (child.name === "{" || child.name === "}" || isComment(child))
        continue;
      if (child.type.isError) continue;
      if (child.name === "ReturnStatement") {
        if (jsx) {
          outside(child);
          continue;
        }
        jsx = returned(child);
        continue;
      }
      const source = text(child);
      const kind =
        child.name === "VariableDeclaration" ||
        child.name === "ExpressionStatement"
          ? STATEMENTS.find(([pattern]) => pattern.test(source))?.[1]
          : undefined;
      if (
        !kind ||
        (kind === "effect") !== (child.name === "ExpressionStatement")
      )
        outside(child);
      else statement(child, kind);
    }
  }

  function returned(node: SyntaxNode): CodeViewParsed["jsx"] {
    let value = node.firstChild?.nextSibling ?? null;
    while (value?.name === "ParenthesizedExpression")
      value = value.firstChild?.nextSibling ?? null;
    if (value?.name !== "JSXElement" || !value.getChild("JSXFragmentTag")) {
      outside(node);
      return undefined;
    }
    return { from: value.from, to: value.to, roots: contents(value).children };
  }

  /** The text and the elements inside a JSX element (between its tags). */
  function contents(node: SyntaxNode): {
    text?: CodeViewElement["text"];
    rows?: CodeViewElement["rows"];
    children: CodeViewElement[];
  } {
    const children: CodeViewElement[] = [];
    let textFrom: number | undefined;
    let textTo = 0;
    let rows: CodeViewElement["rows"];
    for (let child = node.firstChild; child; child = child.nextSibling) {
      switch (child.name) {
        case "JSXOpenTag":
        case "JSXCloseTag":
        case "JSXFragmentTag":
        case "JSXSelfClosingTag":
          continue;
        case "JSXText":
          if (!text(child).trim()) continue;
          if (children.length) outside(child);
          else {
            const lead = text(child).length - text(child).trimStart().length;
            const tail = text(child).length - text(child).trimEnd().length;
            textFrom ??= child.from + lead;
            textTo = child.to - tail;
          }
          continue;
        case "JSXElement":
          children.push(element(child, undefined));
          continue;
        case "JSXEscape": {
          const inner = child.firstChild?.nextSibling;
          if (inner?.name === "ArrowFunction") {
            if (rows) outside(child);
            else rows = { from: child.from, to: child.to, code: text(child) };
            continue;
          }
          if (inner?.name === "BinaryExpression") {
            const [left, op, right] = [
              inner.firstChild,
              inner.firstChild?.nextSibling,
              inner.lastChild,
            ];
            if (
              left?.name === "VariableName" &&
              op &&
              text(op) === "&&" &&
              right?.name === "JSXElement"
            ) {
              children.push({
                ...element(right, text(left)),
                from: child.from,
                to: child.to,
              });
              continue;
            }
          }
          if (children.length) outside(child);
          else {
            textFrom ??= child.from;
            textTo = child.to;
          }
          continue;
        }
        default:
          if (!child.type.isError) outside(child);
      }
    }
    return {
      ...(textFrom !== undefined
        ? {
            text: {
              from: textFrom,
              to: textTo,
              code: code.slice(textFrom, textTo),
            },
          }
        : {}),
      ...(rows ? { rows } : {}),
      children,
    };
  }

  function element(
    node: SyntaxNode,
    visibleState: string | undefined,
  ): CodeViewElement {
    const tag =
      node.getChild("JSXOpenTag") ?? node.getChild("JSXSelfClosingTag");
    const name =
      tag?.getChild("JSXIdentifier") ??
      tag?.getChild("JSXBuiltin") ??
      tag?.getChild("JSXMemberExpression");
    const close = node.getChild("JSXCloseTag");
    const closeName =
      close?.getChild("JSXIdentifier") ??
      close?.getChild("JSXBuiltin") ??
      close?.getChild("JSXMemberExpression");
    if (name && closeName && text(name) !== text(closeName))
      problems.push({
        from: closeName.from,
        to: closeName.to,
        reason: "unparsable",
      });
    const attributes: CodeViewAttribute[] = [];
    for (
      let child = tag?.firstChild ?? null;
      child;
      child = child.nextSibling
    ) {
      if (child.name === "JSXSpreadAttribute") {
        outside(child);
        continue;
      }
      if (child.name !== "JSXAttribute") continue;
      const key = child.getChild("JSXIdentifier");
      const string = child.getChild("JSXAttributeValue");
      const escape = child.getChild("JSXEscape");
      const value = string
        ? {
            from: string.from,
            to: string.to,
            kind: "string" as const,
            code: text(string).slice(1, -1),
          }
        : escape
          ? {
              from: escape.from,
              to: escape.to,
              kind: "expression" as const,
              code: code.slice(escape.from + 1, escape.to - 1),
            }
          : undefined;
      attributes.push({
        from: child.from,
        to: child.to,
        name: key ? text(key) : text(child),
        ...(value ? { value } : {}),
      });
    }
    return {
      from: node.from,
      to: node.to,
      type: name ? text(name) : "",
      ...(visibleState ? { visibleState } : {}),
      attributes,
      ...contents(node),
    };
  }

  return {
    code,
    statements,
    ...(component ? { component } : {}),
    ...(jsx ? { jsx } : {}),
    problems,
  };
}

const isComment = (node: SyntaxNode) =>
  node.name === "LineComment" || node.name === "BlockComment";

/** The 1-based line of an offset. */
export function codeViewLineAt(code: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < offset && index < code.length; index += 1)
    if (code.charCodeAt(index) === 10) line += 1;
  return line;
}

/**
 * Code without its comments and the whitespace that does not separate two words — two spans that
 * differ only there read the same. Strings and templates are kept as written.
 */
export function codeViewNormalized(code: string): string {
  let out = "";
  let space = false;
  const word = (char: string | undefined) => !!char && /[\w$]/.test(char);
  for (let index = 0; index < code.length;) {
    const char = code[index]!;
    if (char === "/" && code[index + 1] === "/") {
      while (index < code.length && code[index] !== "\n") index += 1;
      space = true;
      continue;
    }
    if (char === "/" && code[index + 1] === "*") {
      const end = code.indexOf("*/", index + 2);
      index = end < 0 ? code.length : end + 2;
      space = true;
      continue;
    }
    if (/\s/.test(char)) {
      space = true;
      index += 1;
      continue;
    }
    if (space && word(out.at(-1)) && word(char)) out += " ";
    space = false;
    if (char === "'" || char === '"' || char === "`") {
      let end = index + 1;
      while (end < code.length && code[end] !== char)
        end += code[end] === "\\" ? 2 : 1;
      out += code.slice(index, end + 1);
      index = end + 1;
      continue;
    }
    out += char;
    index += 1;
  }
  return out;
}
