/**
 * ADR-296 Phase 2 — `src/App.tsx` read back (the generator's shape — `files/app.ts`), never run:
 * the imports, the `createBrowserRouter([...])` route tree (a route = `{path?, element, children?}`,
 * an element a component name), the toast region's placement and the theme's name. Anything else is
 * a problem with its span (`outsideVocabulary`), a syntax error `unparsable`.
 */
import type { SyntaxNode } from "@lezer/common";
import { parser } from "@lezer/javascript";
import type { CodeViewProblem } from "./parse";

const tsx = parser.configure({ dialect: "jsx ts" });

export interface CodeViewAppRoute {
  readonly from: number;
  readonly to: number;
  readonly path?: string;
  /** The element's component name (`<About />` → `About`). */
  readonly element: string;
  readonly children: readonly CodeViewAppRoute[];
}

export interface CodeViewAppImport {
  readonly from: number;
  readonly to: number;
  readonly code: string;
  /** A default import (`import About from './pages/About'`): its name and module. */
  readonly name?: string;
  readonly module: string;
}

export interface CodeViewAppParsed {
  readonly imports: readonly CodeViewAppImport[];
  readonly routes?: readonly CodeViewAppRoute[];
  readonly routesFrom: number;
  /** `<ToastContainer placement="…" />` — absent placement = the default. */
  readonly toast?: { readonly from: number; readonly placement?: string };
  /** `<Theme name="…">`. */
  readonly theme?: { readonly from: number; readonly name: string };
  readonly problems: readonly CodeViewProblem[];
}

const unquote = (text: string) => {
  const quote = text.charAt(0);
  if ((quote !== "'" && quote !== '"') || text.at(-1) !== quote)
    return undefined;
  return text.slice(1, -1).replace(/\\(.)/g, "$1");
};

export function parseAppFile(code: string): CodeViewAppParsed {
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
  const outside = (node: { from: number; to: number }) =>
    problems.push({
      from: node.from,
      to: node.to,
      reason: "outsideVocabulary",
    });
  const imports: CodeViewAppImport[] = [];
  let routes: CodeViewAppRoute[] | undefined;
  let routesFrom = 0;
  let toast: CodeViewAppParsed["toast"];
  let theme: CodeViewAppParsed["theme"];

  const route = (node: SyntaxNode): CodeViewAppRoute | undefined => {
    if (node.name !== "ObjectExpression") {
      outside(node);
      return undefined;
    }
    let path: string | undefined;
    let element: string | undefined;
    let children: CodeViewAppRoute[] = [];
    for (let prop = node.firstChild; prop; prop = prop.nextSibling) {
      if (prop.name !== "Property") continue;
      const key = prop.firstChild;
      const value = prop.lastChild;
      const name = key ? text(key) : "";
      if (!value || value === key) {
        outside(prop);
        continue;
      }
      if (name === "path" && value.name === "String")
        path = unquote(text(value));
      else if (name === "element" && value.name === "JSXElement") {
        const tag = value.getChild("JSXSelfClosingTag");
        const id = tag?.getChild("JSXIdentifier");
        if (!tag || !id || tag.getChild("JSXAttribute")) outside(value);
        else element = text(id);
      } else if (name === "children" && value.name === "ArrayExpression")
        children = items(value);
      else outside(prop);
    }
    if (!element) {
      outside(node);
      return undefined;
    }
    return {
      from: node.from,
      to: node.to,
      ...(path !== undefined ? { path } : {}),
      element,
      children,
    };
  };
  const items = (array: SyntaxNode): CodeViewAppRoute[] => {
    const out: CodeViewAppRoute[] = [];
    for (let item = array.firstChild; item; item = item.nextSibling) {
      if (item.name === "[" || item.name === "]" || item.name === ",") continue;
      if (item.name === "LineComment" || item.name === "BlockComment") continue;
      const read = route(item);
      if (read) out.push(read);
    }
    return out;
  };
  const jsx = (node: SyntaxNode) => {
    // `<Theme name="…">` · `<ToastContainer placement="…" />` · `<RouterProvider router={router} />`.
    const open =
      node.getChild("JSXOpenTag") ?? node.getChild("JSXSelfClosingTag");
    const name = open?.getChild("JSXIdentifier");
    const tag = name ? text(name) : "";
    const attributes = new Map<string, string>();
    for (let child = open?.firstChild ?? null; child; child = child.nextSibling)
      if (child.name === "JSXAttribute") {
        const key = child.getChild("JSXIdentifier");
        const value =
          child.getChild("JSXAttributeValue") ?? child.getChild("JSXEscape");
        attributes.set(key ? text(key) : "", value ? text(value) : "");
      }
    if (!open && node.getChild("JSXFragmentTag")) {
      // (`<>…</>` — the app's elements without a theme.)
    } else if (tag === "Theme") {
      const name = unquote(attributes.get("name") ?? "");
      if (name === undefined || attributes.size !== 1) outside(open!);
      else theme = { from: node.from, name };
    } else if (tag === "ToastContainer") {
      const raw = attributes.get("placement");
      const placement = raw === undefined ? undefined : unquote(raw);
      if (
        (raw !== undefined && placement === undefined) ||
        attributes.size > (raw === undefined ? 0 : 1)
      )
        outside(open!);
      else toast = { from: node.from, ...(placement ? { placement } : {}) };
    } else if (tag === "RouterProvider") {
      if (attributes.get("router") !== "{router}" || attributes.size !== 1)
        outside(open!);
    } else outside(node);
    for (let child = node.firstChild; child; child = child.nextSibling)
      if (child.name === "JSXElement") jsx(child);
      else if (child.name === "JSXText" && text(child).trim()) outside(child);
      else if (child.name === "JSXEscape") outside(child);
  };

  for (let node = tree.topNode.firstChild; node; node = node.nextSibling) {
    if (
      node.name === "LineComment" ||
      node.name === "BlockComment" ||
      node.type.isError
    )
      continue;
    const source = text(node);
    if (node.name === "ImportDeclaration") {
      const named = /^import ([A-Za-z_$][\w$]*) from '([^']+)';?$/.exec(source);
      const braces = /^import \{[^}]*\} from '([^']+)';?$/.exec(source);
      if (named)
        imports.push({
          from: node.from,
          to: node.to,
          code: source,
          name: named[1]!,
          module: named[2]!,
        });
      else if (braces)
        imports.push({
          from: node.from,
          to: node.to,
          code: source,
          module: braces[1]!,
        });
      else outside(node);
      continue;
    }
    if (
      node.name === "VariableDeclaration" &&
      /^const router = createBrowserRouter\(\[/.test(source)
    ) {
      const call =
        node.getChild("VariableDefinition")?.nextSibling?.nextSibling;
      const args = call?.getChild("ArgList");
      const array = args?.getChild("ArrayExpression");
      if (!array || routes) outside(node);
      else {
        routes = items(array);
        routesFrom = node.from;
      }
      continue;
    }
    const fn =
      node.name === "ExportDeclaration" &&
      node.getChild("default") &&
      node.getChild("FunctionDeclaration");
    if (fn && /^export default function App\(\) \{/.test(source)) {
      const block = fn.getChild("Block");
      const ret = block?.getChild("ReturnStatement");
      let value = ret?.firstChild?.nextSibling ?? null;
      while (value?.name === "ParenthesizedExpression")
        value = value.firstChild?.nextSibling ?? null;
      if (!block || !ret || value?.name !== "JSXElement") outside(node);
      else {
        for (let child = block.firstChild; child; child = child.nextSibling)
          if (
            child.name !== "{" &&
            child.name !== "}" &&
            child.name !== "ReturnStatement" &&
            child.name !== "LineComment" &&
            child.name !== "BlockComment"
          )
            outside(child);
        jsx(value);
      }
      continue;
    }
    outside(node);
  }
  return {
    imports,
    ...(routes ? { routes } : {}),
    routesFrom,
    ...(toast ? { toast } : {}),
    ...(theme ? { theme } : {}),
    problems,
  };
}
