/**
 * ADR-296 Phase 5 — an instance's `overrides` value read back (the closed shape
 * `codeViewInstanceOverrides` writes): `{'<path>': {<prop>: <value>, hidden: <bool>,
 * <When>: rules({inherited: {<handler>: 'off' | () => {…}}, own: [() => {…}]})}}`. Nothing is run;
 * a part outside the shape is a problem at its offset (relative to the given text).
 */
import type { SyntaxNode } from "@lezer/common";
import { parser } from "@lezer/javascript";

const ts = parser.configure({ dialect: "ts" });

export interface CodeViewOverrideFunction {
  /** The arrow's body (inside its braces). */
  readonly body: string;
  /** Its parameters (the When's event arguments). */
  readonly params: readonly string[];
  readonly from: number;
}
export interface CodeViewOverrideRules {
  readonly trigger: string;
  readonly from: number;
  /** handler name → `'off'` or the replacing rule's function. */
  readonly inherited: ReadonlyMap<
    string,
    { readonly off: true; readonly from: number } | CodeViewOverrideFunction
  >;
  readonly own: readonly CodeViewOverrideFunction[];
}
export interface CodeViewOverrideEntry {
  readonly key: string;
  readonly from: number;
  /** prop → its value code (a JS expression). */
  readonly props: ReadonlyMap<
    string,
    { readonly code: string; readonly from: number }
  >;
  readonly hidden?: boolean;
  readonly rules: readonly CodeViewOverrideRules[];
}

/** The entries of an `overrides` value (its code without the attribute's braces). */
export function parseCodeViewOverrides(
  code: string,
): { entries: CodeViewOverrideEntry[] } | { error: number } {
  const source = `(${code})`;
  const tree = ts.parse(source);
  const at = (node: SyntaxNode) => node.from - 1;
  const text = (node: SyntaxNode) => source.slice(node.from, node.to);
  let error: number | undefined;
  tree.iterate({
    enter: (node) => {
      if (node.type.isError && error === undefined) error = node.from - 1;
    },
  });
  if (error !== undefined) return { error: Math.max(0, error) };
  const fail = (node: SyntaxNode | null | undefined): never => {
    throw node ? at(node) : 0;
  };
  const top = tree.topNode.firstChild?.firstChild; // ExpressionStatement > ParenthesizedExpression
  const object =
    top?.name === "ParenthesizedExpression"
      ? top.getChild("ObjectExpression")
      : null;
  /** An object's properties: [key text (unquoted), value node, property node]. */
  const properties = (node: SyntaxNode) => {
    const out: [string, SyntaxNode, SyntaxNode][] = [];
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.name !== "Property") continue;
      const key = child.firstChild;
      const value = child.lastChild;
      if (!key || !value || key === value) fail(child);
      const name =
        key!.name === "String"
          ? text(key!).slice(1, -1).replace(/\\(.)/g, "$1")
          : key!.name === "PropertyDefinition"
            ? text(key!)
            : fail(key);
      out.push([name as string, value!, child]);
    }
    return out;
  };
  const fn = (node: SyntaxNode): CodeViewOverrideFunction => {
    if (node.name !== "ArrowFunction") fail(node);
    const list = node.getChild("ParamList");
    const block = node.getChild("Block");
    const params = list
      ? text(list)
          .replace(/^\(|\)$/g, "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
    if (!block || params.some((item) => !/^[A-Za-z_$][\w$]*$/.test(item)))
      fail(node);
    return { body: text(block!).slice(1, -1), params, from: at(node) };
  };
  try {
    if (!object) fail(top);
    const entries: CodeViewOverrideEntry[] = [];
    for (const [key, value, property] of properties(object!)) {
      if (value.name !== "ObjectExpression") fail(value);
      const props = new Map<string, { code: string; from: number }>();
      const rules: CodeViewOverrideRules[] = [];
      let hidden: boolean | undefined;
      for (const [name, field] of properties(value)) {
        if (name === "hidden") {
          if (field.name !== "BooleanLiteral") fail(field);
          hidden = text(field) === "true";
          continue;
        }
        const call = field.name === "CallExpression" ? field : null;
        if (call && /^on[A-Z]|^property:/.test(name)) {
          if (text(call.firstChild!) !== "rules") fail(call);
          const arg = call.getChild("ArgList")?.getChild("ObjectExpression");
          if (!arg) fail(call);
          const inherited = new Map<
            string,
            { off: true; from: number } | CodeViewOverrideFunction
          >();
          const own: CodeViewOverrideFunction[] = [];
          for (const [part, list] of properties(arg!)) {
            if (part === "inherited") {
              if (list.name !== "ObjectExpression") fail(list);
              for (const [handler, item] of properties(list))
                inherited.set(
                  handler,
                  item.name === "String" && text(item).slice(1, -1) === "off"
                    ? { off: true, from: at(item) }
                    : fn(item),
                );
            } else if (part === "own") {
              if (list.name !== "ArrayExpression") fail(list);
              for (let item = list.firstChild; item; item = item.nextSibling)
                if (item.name === "ArrowFunction") own.push(fn(item));
                else if (!["[", "]", ","].includes(item.name)) fail(item);
            } else fail(list);
          }
          rules.push({ trigger: name, from: at(field), inherited, own });
          continue;
        }
        props.set(name, { code: text(field), from: at(field) });
      }
      entries.push({
        key,
        from: at(property),
        props,
        ...(hidden !== undefined ? { hidden } : {}),
        rules,
      });
    }
    return { entries };
  } catch (offset) {
    return { error: typeof offset === "number" ? Math.max(0, offset) : 0 };
  }
}
