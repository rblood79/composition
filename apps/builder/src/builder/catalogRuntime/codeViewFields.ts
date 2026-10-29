/**
 * ADR-291 Decision 9 — the code view's computed columns, read back: `let <rows>Fields = {<key>:
 * {type, formula}}` is one document unit (anchor `fields`) whose `formula` texts (shown over
 * field keys) are the columns' formulas. An edited formula is stored over ids (`names.ts`) by
 * one `setDataEntries` of the collection; `type` is read only here (the column editor changes
 * it), a column added or removed in the block is outside the vocabulary.
 */
import { setDataEntries } from "../../../../../packages/shared/src/catalog/commands/data";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type { CollectionEntry } from "../../../../../packages/shared/src/catalog/document/types";
import type { CatalogReader } from "../../../../../packages/shared/src/catalog/transactions/transaction";
import { structuredLiteralOf } from "../../../../../packages/shared/src/codeView/inverse";
import {
  codeViewNormalized,
  type CodeViewParsed,
} from "../../../../../packages/shared/src/codeView/inverse/parse";
import type { CodeViewResult } from "../../../../../packages/shared/src/codeView/types";
import { formulaEngineSync } from "../../../../../packages/shared/src/collections/formula/engine";
import { hasFormula } from "../../../../../packages/shared/src/collections/formula/compute";
import { formulaToStored } from "../../../../../packages/shared/src/collections/formula/names";
import type { CatalogCodeViewReason } from "./codeViewEdit";

export interface CodeViewFieldsInput {
  readonly reader: CatalogReader;
  readonly edited: CodeViewParsed;
  readonly baseline: CodeViewResult;
  readonly strict: boolean;
  readonly reject: (
    from: number,
    reason: CatalogCodeViewReason,
    detail?: string,
  ) => void;
  readonly step: (from: number, command: CatalogCommand) => void;
}

const BLOCK = /^let ([A-Za-z_$][\w$]*) = \{/;

/** Plan the computed-column blocks of an edit (one step per collection whose formula changed). */
export function planCodeViewFields(input: CodeViewFieldsInput): void {
  const { reader, edited, baseline, reject, step } = input;
  const statements = edited.statements.filter((item) => item.kind === "fields");
  const used = new Set<(typeof statements)[number]>();
  const engine = formulaEngineSync();
  for (const anchor of baseline.anchors) {
    if (anchor.target.kind !== "fields") continue;
    const text = baseline.code.slice(anchor.start, anchor.end);
    const name = BLOCK.exec(text)?.[1];
    const statement = statements.find(
      (item) => !used.has(item) && `${item.name}Fields` === name,
    );
    if (!statement) {
      // (The block is the document's — removing it does not remove the columns.)
      reject(edited.component?.from ?? 0, "outsideVocabulary", name);
      continue;
    }
    used.add(statement);
    if (
      !input.strict &&
      codeViewNormalized(statement.code) === codeViewNormalized(text)
    )
      continue;
    const open = statement.code.indexOf("{");
    const close = statement.code.lastIndexOf("}");
    const literal =
      open >= 0 && close > open
        ? structuredLiteralOf(statement.code.slice(open, close + 1))
        : undefined;
    const value = literal?.value;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      reject(statement.from, "unparsable");
      continue;
    }
    const entry = reader.getEntry(anchor.target.collectionId) as
      CollectionEntry | undefined;
    if (entry?.kind !== "collection") {
      reject(statement.from, "unknownReference", anchor.target.collectionId);
      continue;
    }
    const block = value as Record<string, unknown>;
    const computedKeys = new Set(
      entry.schema
        .filter(hasFormula)
        .map((field) => field.key),
    );
    for (const key of Object.keys(block))
      if (!computedKeys.has(key))
        reject(statement.from, "outsideVocabulary", key);
    let changed = false;
    const schema = entry.schema.map((field) => {
      if (!computedKeys.has(field.key)) return field;
      const item = block[field.key];
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        reject(statement.from, "notInCode", field.key);
        return field;
      }
      const { type, formula } = item as { type?: unknown; formula?: unknown };
      if (type !== field.type) {
        reject(statement.from, "outsideVocabulary", `${field.key}.type`);
        return field;
      }
      if (typeof formula !== "string" || formula.trim() === "") {
        reject(statement.from, "unparsable", field.key);
        return field;
      }
      if (!engine) {
        reject(statement.from, "commandRefused", "FORMULA_ENGINE_NOT_READY");
        return field;
      }
      let stored: string;
      try {
        stored = formulaToStored(engine, formula, entry.schema);
      } catch (error) {
        reject(
          statement.from,
          "unknownReference",
          error instanceof Error ? error.message : String(error),
        );
        return field;
      }
      if (stored === field.formula) return field;
      changed = true;
      return { ...field, formula: stored };
    });
    if (changed)
      step(
        statement.from,
        setDataEntries({
          puts: [{ ...entry, schema }],
          label: "Edit formula",
        }),
      );
  }
  for (const statement of statements)
    if (!used.has(statement))
      reject(statement.from, "outsideVocabulary", statement.name);
}
