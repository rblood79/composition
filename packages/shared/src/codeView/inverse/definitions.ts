/**
 * ADR-296 Phase 3 — a definition file (`data/*.ts` · `api/*.ts` · `state/project.ts`) read back:
 * its imports, its exported names with their value's code, its default export, its type aliases.
 * Nothing is run; the value code is read by `structuredLiteralOf` (a closed literal). Anything else
 * at the top is a problem (`outsideVocabulary`), a syntax error `unparsable`.
 */
import { parser } from "@lezer/javascript";
import type { CodeViewProblem } from "./parse";

const ts = parser.configure({ dialect: "ts" });

export interface CodeViewDefinitionPart {
  readonly from: number;
  readonly to: number;
  /** The whole statement. */
  readonly code: string;
  /** The value's code (after `=` · `export default`), without a trailing `satisfies T`. */
  readonly value: string;
}

export interface CodeViewDefinitionParsed {
  readonly imports: readonly CodeViewDefinitionPart[];
  /** `export const <name> = <value>;` */
  readonly exports: ReadonlyMap<string, CodeViewDefinitionPart>;
  readonly defaultExport?: CodeViewDefinitionPart;
  /** `export type … = …;` (derived — compared, never applied). */
  readonly types: readonly CodeViewDefinitionPart[];
  readonly problems: readonly CodeViewProblem[];
}

export function parseDefinitionFile(code: string): CodeViewDefinitionParsed {
  const tree = ts.parse(code);
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
  const imports: CodeViewDefinitionPart[] = [];
  const exports = new Map<string, CodeViewDefinitionPart>();
  const types: CodeViewDefinitionPart[] = [];
  let defaultExport: CodeViewDefinitionPart | undefined;
  const strip = (value: string) =>
    value
      .trim()
      .replace(/;$/, "")
      .replace(/\s+satisfies\s+[A-Za-z_$][\w$]*(?:\[\])?$/, "")
      .trim();
  for (let node = tree.topNode.firstChild; node; node = node.nextSibling) {
    if (
      node.name === "LineComment" ||
      node.name === "BlockComment" ||
      node.type.isError
    )
      continue;
    const source = code.slice(node.from, node.to);
    const part = (value: string): CodeViewDefinitionPart => ({
      from: node!.from,
      to: node!.to,
      code: source,
      value: strip(value),
    });
    if (node.name === "ImportDeclaration") {
      imports.push(part(""));
      continue;
    }
    const named = /^export const ([A-Za-z_$][\w$]*) = ([\s\S]*)$/.exec(source);
    if (node.name === "ExportDeclaration" && named) {
      exports.set(named[1]!, part(named[2]!));
      continue;
    }
    const fallback = /^export default ([\s\S]*)$/.exec(source);
    if (node.name === "ExportDeclaration" && fallback && !defaultExport) {
      defaultExport = part(fallback[1]!);
      continue;
    }
    if (node.name === "ExportDeclaration" && /^export type /.test(source)) {
      types.push(part(""));
      continue;
    }
    problems.push({
      from: node.from,
      to: node.to,
      reason: "outsideVocabulary",
    });
  }
  return {
    imports,
    exports,
    ...(defaultExport ? { defaultExport } : {}),
    types,
    problems,
  };
}
