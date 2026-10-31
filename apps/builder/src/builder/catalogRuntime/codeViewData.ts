/**
 * ADR-296 Phase 3 (Decision 5) — an edit of a data definition file as the document's own commands
 * (no new command): `data/<c>.ts` → `updateCollection` (a new file `addCollection`), `api/<e>.ts`
 * → `setEndpoint`, `state/project.ts` → `setProjectVariable` · `renameVariable` ·
 * `removeProjectVariable`. These are definition files: the Apply plans them first, so a page of the
 * same Apply reads what they declare (Decision 1). The check is the regenerated file — it must be
 * what was written.
 */
import {
  renameVariable,
  type CatalogCommand,
} from "../../../../../packages/shared/src/catalog/commands";
import {
  addCollection,
  removeProjectVariable,
  setEndpoint,
  setProjectVariable,
  updateCollection,
} from "../../../../../packages/shared/src/catalog/commands/data";
import type {
  CatalogDataField,
  CollectionEntry,
  DataCollectionId,
  DataEndpointId,
  EndpointEntry,
  ProjectEntry,
  ProjectVariableEntry,
  ProjectVariableId,
} from "../../../../../packages/shared/src/catalog/document/types";
import type { CatalogReader } from "../../../../../packages/shared/src/catalog/transactions/transaction";
import { formulaEngineSync } from "../../../../../packages/shared/src/collections/formula/engine";
import {
  formulaShown,
  formulaToStored,
} from "../../../../../packages/shared/src/collections/formula/names";
import {
  codeName,
  generateCollectionFile,
  generateEndpointFile,
  generateProjectStateFile,
} from "../../../../../packages/shared/src/codeView/files/definitions";
import { parseDefinitionFile } from "../../../../../packages/shared/src/codeView/inverse/definitions";
import { structuredLiteralOf } from "../../../../../packages/shared/src/codeView/inverse";
import { codeViewNormalized } from "../../../../../packages/shared/src/codeView/inverse/parse";

type Reason =
  | "unparsable"
  | "outsideVocabulary"
  | "unknownReference"
  | "notInCode"
  | "commandRefused";
type Reject = (from: number, reason: Reason, detail?: string) => void;

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

/** The value of an `export const <name> = …` (a closed literal) — undefined = refused. */
function literal(
  parsed: ReturnType<typeof parseDefinitionFile>,
  name: string | "default",
  reject: Reject,
): unknown {
  const part =
    name === "default" ? parsed.defaultExport : parsed.exports.get(name);
  if (!part) {
    reject(
      0,
      "outsideVocabulary",
      name === "default" ? "export default" : name,
    );
    return undefined;
  }
  const read = structuredLiteralOf(part.value);
  if (!read) reject(part.from, "outsideVocabulary", name);
  return read?.value;
}

/** `src/data/<c>.ts` → the collection (`id` = the edited file's; absent = a new collection). */
export function planCodeViewCollection(input: {
  reader: CatalogReader;
  id?: string;
  name: string;
  edited: string;
  reject: Reject;
}): CatalogCommand[] {
  const { reader, reject } = input;
  const parsed = parseDefinitionFile(input.edited);
  for (const problem of parsed.problems) reject(problem.from, problem.reason);
  if (parsed.problems.length) return [];
  const before = input.id
    ? (reader.getEntry(input.id) as CollectionEntry | undefined)
    : undefined;
  const fields = literal(parsed, "fields", reject);
  const settings = parsed.exports.has("settings")
    ? literal(parsed, "settings", reject)
    : {};
  const rows = literal(parsed, "default", reject);
  if (!Array.isArray(fields) || !object(settings) || !Array.isArray(rows)) {
    if (fields !== undefined && !Array.isArray(fields))
      reject(
        parsed.exports.get("fields")?.from ?? 0,
        "outsideVocabulary",
        "fields",
      );
    return [];
  }
  // Field ids: by key, else by place among the ones left (a key typed over is a rename).
  const old = before?.schema ?? [];
  const keys = fields.map((field) =>
    object(field) ? String(field.key ?? "") : "",
  );
  const left = old.filter((field) => !keys.includes(field.key));
  const engine = formulaEngineSync();
  const schema: CatalogDataField[] = [];
  fields.forEach((field, index) => {
    if (!object(field) || typeof field.key !== "string") {
      reject(
        parsed.exports.get("fields")!.from,
        "outsideVocabulary",
        `fields[${index}]`,
      );
      return;
    }
    const same =
      old.find((item) => item.key === field.key) ??
      (left.length ? left.shift() : undefined);
    const { formula, ...rest } = field as Record<string, unknown> & {
      formula?: string;
    };
    let stored = formula;
    if (typeof formula === "string") {
      const named = [...schema, ...fields.filter(object)].map((item, at) => ({
        key: String(item.key),
        id:
          (item as { id?: string }).id ??
          old.find((o) => o.key === item.key)?.id ??
          `${at}`,
      }));
      if (engine) stored = formulaToStored(engine, formula, named);
      else if (
        same?.formula &&
        formulaShown(undefined, same.formula, old) === formula
      )
        stored = same.formula;
      else
        reject(
          parsed.exports.get("fields")!.from,
          "commandRefused",
          "formula engine not loaded",
        );
    }
    schema.push({
      ...(same?.id ? { id: same.id } : {}),
      ...(rest as Omit<CatalogDataField, "id">),
      ...(stored !== undefined ? { formula: stored } : {}),
    });
  });
  const entry: CollectionEntry = {
    kind: "collection",
    id: (before?.id ?? `data:collection:${input.name}`) as DataCollectionId,
    name: before?.name ?? input.name,
    ...(typeof settings.description === "string"
      ? { description: settings.description }
      : {}),
    schema,
    mockData: rows as CollectionEntry["mockData"],
    useMockData: settings.useMockData !== false,
    ...(object(settings.executionPolicy)
      ? {
          executionPolicy:
            settings.executionPolicy as CollectionEntry["executionPolicy"],
        }
      : {}),
  };
  if (before && JSON.stringify(before) === JSON.stringify(entry)) return [];
  return [before ? updateCollection({ entry }) : addCollection({ entry })];
}

/** `src/api/<e>.ts` → the endpoint (absent id = a new one). */
export function planCodeViewEndpoint(input: {
  reader: CatalogReader;
  id?: string;
  name: string;
  edited: string;
  reject: Reject;
}): CatalogCommand[] {
  const { reader, reject } = input;
  const parsed = parseDefinitionFile(input.edited);
  for (const problem of parsed.problems) reject(problem.from, problem.reason);
  if (parsed.problems.length) return [];
  const call = parsed.defaultExport;
  const inner = call && /^endpoint\(([\s\S]*)\)$/.exec(call.value);
  const read = inner ? structuredLiteralOf(inner[1]!) : undefined;
  if (!call || !read || !object(read.value)) {
    reject(call?.from ?? 0, "outsideVocabulary", "endpoint({…})");
    return [];
  }
  const before = input.id
    ? (reader.getEntry(input.id) as EndpointEntry | undefined)
    : undefined;
  const entry = {
    kind: "endpoint",
    id: (before?.id ?? `data:endpoint:${input.name}`) as DataEndpointId,
    name: before?.name ?? input.name,
    ...read.value,
  } as EndpointEntry;
  if (before && JSON.stringify(before) === JSON.stringify(entry)) return [];
  return [setEndpoint({ entry })];
}

/** `src/state/project.ts` → the project variables (add · rename · start · notes · remove). */
export function planCodeViewProjectState(input: {
  reader: CatalogReader;
  baselineNames: Readonly<Record<string, string>>;
  edited: string;
  reject: Reject;
}): CatalogCommand[] {
  const { reader, reject, edited } = input;
  const parsed = parseDefinitionFile(edited);
  for (const problem of parsed.problems) reject(problem.from, problem.reason);
  const part = parsed.exports.get("projectState");
  if (parsed.problems.length || !part) {
    if (!part) reject(0, "outsideVocabulary", "projectState");
    return [];
  }
  const project = reader.getEntry(reader.projectId) as ProjectEntry;
  const now = new Map(
    (project.projectVariableIds ?? []).map((id) => [
      id as string,
      reader.getEntry(id) as ProjectVariableEntry,
    ]),
  );
  // Each line: `<name>: <start>[ as T],[ // persist · date · validate {…}]`.
  const lines = part.value
    .replace(/^\{/, "")
    .replace(/\}$/, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  interface Read {
    name: string;
    entry: Omit<ProjectVariableEntry, "id" | "name" | "kind">;
  }
  const reads: Read[] = [];
  for (const line of lines) {
    const m = /^([A-Za-z_$][\w$]*): (.+?),(?:\s*\/\/ (.*))?$/.exec(line);
    if (!m) {
      reject(
        part.from + Math.max(0, edited.slice(part.from).indexOf(line)),
        "outsideVocabulary",
        line,
      );
      continue;
    }
    const [, name, raw, notes = ""] = m;
    const typed = /^null as (unknown\[\]|object) \| null$/.exec(raw!.trim());
    const value = typed ? { value: null } : structuredLiteralOf(raw!.trim());
    if (!value) {
      reject(
        part.from + Math.max(0, edited.slice(part.from).indexOf(line)),
        "outsideVocabulary",
        raw,
      );
      continue;
    }
    const flags = notes.split(" · ").map((note) => note.trim());
    const validation = flags.find((note) => note.startsWith("validate "));
    const valid = validation
      ? structuredLiteralOf(validation.slice(9))?.value
      : undefined;
    const v = value.value;
    const valueType: ProjectVariableEntry["valueType"] = flags.includes("date")
      ? "date"
      : typed
        ? typed[1] === "object"
          ? "object"
          : "array"
        : Array.isArray(v)
          ? "array"
          : object(v)
            ? "object"
            : typeof v === "number"
              ? "number"
              : typeof v === "boolean"
                ? "boolean"
                : "string";
    reads.push({
      name: name!,
      entry: {
        valueType,
        ...(v === null || (v === "" && valueType !== "string")
          ? {}
          : { defaultValue: v }),
        persist: flags.includes("persist"),
        ...(object(valid) ? { validation: valid } : {}),
      },
    });
  }
  // Identity: the code name; a new name where a name went (same place) is that variable renamed.
  const ids = reads.map((read) => input.baselineNames[read.name]);
  const kept = new Set(ids.filter(Boolean));
  const gone = Object.values(input.baselineNames).filter((id) => !kept.has(id));
  ids.forEach((id, index) => {
    if (id) return;
    const at = Object.keys(input.baselineNames)[index];
    const was = at ? input.baselineNames[at] : undefined;
    if (was && gone.includes(was)) {
      ids[index] = was;
      gone.splice(gone.indexOf(was), 1);
    }
  });
  const steps: CatalogCommand[] = [];
  for (const id of gone)
    steps.push(removeProjectVariable({ id: id as ProjectVariableId }));
  reads.forEach((read, index) => {
    const id = ids[index];
    const before = id ? now.get(id) : undefined;
    if (before && codeName(before.name, "variable") !== read.name)
      steps.push(renameVariable({ variableId: before.id, name: read.name }));
    const entry = {
      kind: "projectVariable",
      id: (before?.id ?? `data:variable:${read.name}`) as ProjectVariableId,
      name:
        before && codeName(before.name, "variable") === read.name
          ? before.name
          : read.name,
      ...read.entry,
    } as ProjectVariableEntry;
    const compare = (item: ProjectVariableEntry | undefined) =>
      item &&
      JSON.stringify({ ...item, name: "" }) ===
        JSON.stringify({ ...entry, name: "" });
    if (!compare(before)) steps.push(setProjectVariable({ entry }));
  });
  return steps;
}

/** The check: the definition file the staged document gives is what was written. */
export function compareDefinitionFile(
  reader: CatalogReader,
  file: { kind: "collection" | "endpoint" | "state"; id?: string },
  edited: string,
  reject: Reject,
): void {
  const regenerated =
    file.kind === "collection"
      ? generateCollectionFile({ reader, id: file.id! }).code
      : file.kind === "endpoint"
        ? generateEndpointFile({ reader, id: file.id! }).code
        : generateProjectStateFile({ reader }).code;
  if (codeViewNormalized(regenerated) === codeViewNormalized(edited)) return;
  // (A data · API file is its literals: the same values written another way are the same file.)
  if (file.kind !== "state") {
    const a = parseDefinitionFile(edited);
    const b = parseDefinitionFile(regenerated);
    const value = (code: string | undefined) =>
      code === undefined
        ? undefined
        : JSON.stringify(
            structuredLiteralOf(code.replace(/^endpoint\(([\s\S]*)\)$/, "$1"))
              ?.value,
          );
    const same =
      [...a.exports.keys()].sort().join() ===
        [...b.exports.keys()].sort().join() &&
      [...a.exports].every(
        ([name, part]) =>
          value(part.value) === value(b.exports.get(name)?.value),
      ) &&
      value(a.defaultExport?.value) === value(b.defaultExport?.value) &&
      a.types.map((part) => codeViewNormalized(part.code)).join() ===
        b.types.map((part) => codeViewNormalized(part.code)).join() &&
      a.imports
        .map((part) => codeViewNormalized(part.code))
        .sort()
        .join() ===
        b.imports
          .map((part) => codeViewNormalized(part.code))
          .sort()
          .join();
    if (same) return;
  }
  const a = edited.split("\n");
  const b = regenerated.split("\n");
  const index = a.findIndex(
    (line, i) => codeViewNormalized(line) !== codeViewNormalized(b[i] ?? ""),
  );
  const line = index < 0 ? a.length - 1 : index;
  let offset = 0;
  for (let i = 0; i < line; i += 1) offset += a[i]!.length + 1;
  reject(offset, "notInCode", b[line]?.trim());
}
