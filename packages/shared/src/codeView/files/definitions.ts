/**
 * ADR-296 Phase 3 (Decision 5) — the data definitions as files, each a closed literal that maps the
 * document entry 1:1 (no field is left out — `fieldCoverage.ts`):
 *
 * - `src/data/<collection>.ts` — the row type (derived), `fields` (the schema, a computed field's
 *   formula over keys — 291), `settings` (description · mock rows on · execution) and the rows
 *   (`export default [...]`, ≤ 1,000);
 * - `src/api/<endpoint>.ts` — `export default endpoint({...})` with the endpoint's fields (a secret by
 *   its name only — 286 사용자 결정 2);
 * - `src/state/project.ts` — the project variables (사용자 결정 5): `<name>: <start>,` with
 *   `// persist` · `// date` · `// validate {…}` notes; a page reads them through
 *   `useProjectState()`.
 *
 * Ids are identity, never text: a field keeps its id by its key (else by its place).
 */
import type {
  CatalogDataField,
  CatalogReader,
  CollectionEntry,
  EndpointEntry,
  ProjectEntry,
  ProjectVariableEntry,
} from "../../catalog/document/types";
import { formulaEngineSync } from "../../collections/formula/engine";
import { formulaShown } from "../../collections/formula/names";
import { CODE_VIEW_HELPERS_MODULE } from "../generate";
import type { CodeViewResult } from "../types";
import { CodeWriter } from "../writer";

type Reader = Pick<CatalogReader, "projectId" | "getEntry">;

/** A JS literal (single quotes, bare keys) — the shape `structuredLiteralOf` reads back. */
export function codeLiteral(value: unknown, indent = 0): string {
  const pad = (depth: number) => "  ".repeat(depth);
  if (typeof value === "string")
    return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n")}'`;
  if (value === null) return "null";
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    const flat = value.every(
      (item) => item === null || typeof item !== "object",
    );
    if (flat) return `[${value.map((item) => codeLiteral(item)).join(", ")}]`;
    return `[\n${value.map((item) => `${pad(indent + 1)}${codeLiteral(item, indent + 1)},`).join("\n")}\n${pad(indent)}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(
      ([, item]) => item !== undefined,
    );
    if (!entries.length) return "{}";
    const key = (name: string) =>
      /^[A-Za-z_$][\w$]*$/.test(name) && name !== "__proto__"
        ? name
        : name === "__proto__"
          ? `['__proto__']`
          : codeLiteral(name);
    const parts = entries.map(
      ([name, item]) => `${key(name)}: ${codeLiteral(item, indent + 1)}`,
    );
    const one = `{${parts.join(", ")}}`;
    if (one.length <= 100 && !one.includes("\n")) return one;
    return `{\n${parts.map((part) => `${pad(indent + 1)}${part},`).join("\n")}\n${pad(indent)}}`;
  }
  return JSON.stringify(value);
}

/** A code name (camelCase identifier) for an entry name. */
export function codeName(raw: string, fallback: string): string {
  const words = raw
    .replace(/[^A-Za-z0-9_$\s-]/g, " ")
    .split(/[\s_-]+/)
    .filter(Boolean);
  let name = words
    .map((word, index) =>
      index === 0
        ? word.charAt(0).toLowerCase() + word.slice(1)
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join("");
  if (!name) name = fallback;
  return /^[0-9]/.test(name) ? `_${name}` : name;
}

const TS_TYPES: Record<string, string> = {
  string: "string",
  number: "number",
  boolean: "boolean",
  date: "string",
  datetime: "string",
  array: "unknown[]",
  object: "Record<string, unknown>",
};

/** A field as the `fields` list writes it (its id is identity, not text; a formula over keys). */
function fieldCode(
  field: CatalogDataField,
  schema: readonly CatalogDataField[],
): Record<string, unknown> {
  const { id: _id, children, formula, ...rest } = field;
  return {
    ...rest,
    ...(formula !== undefined
      ? { formula: formulaShown(formulaEngineSync(), formula, schema) }
      : {}),
    ...(children
      ? { children: children.map((child) => fieldCode(child, children)) }
      : {}),
  };
}

export function generateCollectionFile(input: {
  reader: Reader;
  id: string;
}): CodeViewResult {
  const entry = input.reader.getEntry(input.id) as CollectionEntry;
  const out = new CodeWriter();
  const name = codeName(entry.name, "rows");
  const rowType = `${name.charAt(0).toUpperCase()}${name.slice(1)}Row`;
  out.anchorLine(
    `export type ${rowType} = {${entry.schema
      .map(
        (field) =>
          `${/^[A-Za-z_$][\w$]*$/.test(field.key) ? field.key : codeLiteral(field.key)}${field.required ? "" : "?"}: ${TS_TYPES[field.type ?? "string"] ?? "unknown"}`,
      )
      .join("; ")}};`,
    { kind: "derived", key: "rowType" },
  );
  out.line();
  out.start();
  let from = out.length;
  out.write(
    `export const fields = ${codeLiteral(
      entry.schema.map((field) => fieldCode(field, entry.schema)),
    )};`,
  );
  out.anchor(from, { kind: "fields", collectionId: entry.id }).end();
  out.line();
  const settings = {
    ...(entry.description !== undefined
      ? { description: entry.description }
      : {}),
    useMockData: entry.useMockData,
    ...(entry.executionPolicy
      ? { executionPolicy: entry.executionPolicy }
      : {}),
  };
  out.start();
  from = out.length;
  out.write(`export const settings = ${codeLiteral(settings)};`);
  out.anchor(from, { kind: "derived", key: "settings" }).end();
  out.line();
  out.start();
  from = out.length;
  out.write(
    `export default ${codeLiteral(entry.mockData)} satisfies ${rowType}[];`,
  );
  out.anchor(from, { kind: "derived", key: "rows" }).end();
  return { ...out.done(), symbols: { variables: {}, fields: {} } };
}

/** The endpoint's fields as `endpoint({...})` writes them (kind · id · name are the file's). */
export function endpointFields(entry: EndpointEntry): Record<string, unknown> {
  const { kind: _kind, id: _id, name: _name, ...rest } = entry;
  return rest;
}

export function generateEndpointFile(input: {
  reader: Reader;
  id: string;
}): CodeViewResult {
  const entry = input.reader.getEntry(input.id) as EndpointEntry;
  const out = new CodeWriter();
  out.anchorLine(`import {endpoint} from '${CODE_VIEW_HELPERS_MODULE}';`, {
    kind: "derived",
    key: "import",
  });
  out.line();
  out.start();
  const from = out.length;
  out.write(`export default endpoint(${codeLiteral(endpointFields(entry))});`);
  out.anchor(from, { kind: "derived", key: "endpoint" }).end();
  return { ...out.done(), symbols: { variables: {}, fields: {} } };
}

/** The project variables (`useProjectState()` — 사용자 결정 5). */
export function generateProjectStateFile(input: {
  reader: Reader;
}): CodeViewResult {
  const project = input.reader.getEntry(input.reader.projectId) as ProjectEntry;
  const variables = (project.projectVariableIds ?? [])
    .map((id) => input.reader.getEntry(id) as ProjectVariableEntry | undefined)
    .filter(
      (entry): entry is ProjectVariableEntry =>
        entry?.kind === "projectVariable",
    );
  const out = new CodeWriter();
  out.anchorLine(
    `import {createProjectState} from '${CODE_VIEW_HELPERS_MODULE}';`,
    { kind: "derived", key: "import" },
  );
  out.line();
  out.line("export const projectState = {");
  out.in();
  const names: Record<string, string> = {};
  for (const entry of variables) {
    const name = codeName(entry.name, "variable");
    names[name] = entry.id;
    const notes = [
      entry.persist ? "persist" : "",
      entry.valueType === "date" ? "date" : "",
      entry.validation ? `validate ${codeLiteral(entry.validation)}` : "",
    ].filter(Boolean);
    const start =
      entry.defaultValue === undefined || entry.defaultValue === ""
        ? entry.valueType === "string" || entry.valueType === "date"
          ? "''"
          : "null"
        : codeLiteral(entry.defaultValue);
    const typed =
      start === "null" &&
      (entry.valueType === "object" || entry.valueType === "array")
        ? `null as ${entry.valueType === "array" ? "unknown[]" : "object"} | null`
        : start;
    out.anchorLine(
      `${name}: ${typed},${notes.length ? ` // ${notes.join(" · ")}` : ""}`,
      { kind: "variable", variableId: entry.id },
    );
  }
  out.out();
  out.line("};");
  out.line();
  out.anchorLine(
    "export const useProjectState = createProjectState(projectState);",
    { kind: "derived", key: "useProjectState" },
  );
  return { ...out.done(), symbols: { variables: names, fields: {} } };
}
