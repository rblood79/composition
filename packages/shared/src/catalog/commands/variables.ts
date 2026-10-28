/**
 * ADR-288 — renaming a variable keeps its references: one command renames the entry (a page ·
 * element `stateVariable` or a project `projectVariable`) and rewrites every `{{ old }}` the
 * runtime would have resolved to it (`variableReferences.ts` — per field, with that field's
 * resolution) in the same step. The panels, the code view and the data sink all go through here.
 *
 * Refusals (the command changes nothing):
 * - `VARIABLE_NAME_EMPTY` — a blank name.
 * - `VARIABLE_NAME_CONFLICT` — the name is taken where this variable is visible (its chain · a
 *   project variable; for a project variable any state variable), ADR-214 HC5.
 * - `VARIABLE_NAME_SHADOWS` — an existing `{{ new }}` that reads another variable (or the route
 *   params) would start reading this one (R8).
 */
import type { CatalogCommand } from "./compose";
import { CommandDraft, fail } from "./context";
import type { CatalogEntry } from "../document/types";
import {
  rewriteVariableReferences,
  variableNameTaken,
  variableReferenceSites,
  variableRenameCaptures,
} from "../runtime/variableReferences";

export const renameVariable =
  (input: {
    variableId: string;
    name: string;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const variable = draft.read(input.variableId);
    if (
      variable?.kind !== "stateVariable" &&
      variable?.kind !== "projectVariable"
    )
      return fail("ENTRY_NOT_FOUND", input.variableId);
    const name = input.name.trim();
    if (!name) return fail("VARIABLE_NAME_EMPTY", input.variableId);
    const label = input.label ?? "Rename variable";
    if (name === variable.name)
      return { label, ops: [{ kind: "put", entry: variable }] };
    // A reader that would change its variable comes first (R8 — the sharper reason); then a
    // name merely taken where this variable is visible.
    const captures = variableRenameCaptures(reader, variable.id, name);
    if (captures.length)
      return fail("VARIABLE_NAME_SHADOWS", `${name}:${captures[0]!.entryId}`);
    const taken = variableNameTaken(
      reader,
      variable.kind === "stateVariable"
        ? { kind: "stateVariable", ownerId: variable.ownerId, id: variable.id }
        : { kind: "projectVariable", id: variable.id },
      name,
    );
    if (taken) return fail("VARIABLE_NAME_CONFLICT", `${name}:${taken.id}`);

    const sites = variableReferenceSites(reader, variable.id);
    const byEntry = new Map<string, typeof sites>();
    for (const site of sites)
      byEntry.set(site.entryId, [...(byEntry.get(site.entryId) ?? []), site]);
    for (const [entryId, entrySites] of byEntry) {
      const entry = draft.read(entryId) as CatalogEntry | undefined;
      if (!entry) continue;
      const next = rewriteVariableReferences(entry, entrySites, name);
      if (next !== entry) draft.write(next);
    }
    draft.write({ ...variable, name });
    return { label, ops: draft.ops() };
  };
