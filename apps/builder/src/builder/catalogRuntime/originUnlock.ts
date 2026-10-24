import { projectInstancesOf } from "../../../../../packages/shared/src/catalog/document/componentPages";
import {
  originResetLoss,
  resetOrigin,
  resetOrigins,
} from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type {
  CatalogReader,
  LibraryDefinitionId,
} from "../../../../../packages/shared/src/catalog/document/types";
import {
  requestEditingSemanticsResetConfirmation,
  type EditingSemanticsResetConfirmationRequest,
} from "../utils/editingSemanticsImpactConfirmation";
import { catalogOriginOverride } from "./originView";

/**
 * ADR-282 — the Library page's lock: an origin is locked (its library template, the default) or
 * unlocked (its override owns a copy — the card's ◆ is that copy's root, edited as a Local page
 * card's). The Navigator row's lock unlocks the whole Library (`CatalogWorkspace.setLibraryUnlocked`
 * — user 2026-10-24, replacing 결정 1-a); its reset takes every overridden origin back to the
 * library default (결정 2-a).
 */

/** Whether a library origin is unlocked (its override owns a template copy). */
export function catalogOriginUnlocked(
  reader: CatalogReader,
  definitionId: LibraryDefinitionId,
): boolean {
  return !!catalogOriginOverride(reader, definitionId)?.templateRootId;
}

/** The library origins the project overrides (what the row's reset takes back). */
export function catalogOverriddenOrigins(
  reader: CatalogReader,
): LibraryDefinitionId[] {
  const project = reader.getEntry(reader.projectId);
  if (project?.kind !== "project") return [];
  return project.overrideIds.flatMap((id) => {
    const entry = reader.getEntry(id);
    return entry?.kind === "definitionOverride" ? [entry.targetId] : [];
  });
}

/** What the reset dialog says (Decision 6 · 10): origins, instances, contents that go. */
export function catalogOriginResetRequest(
  reader: CatalogReader,
  definitionIds: readonly LibraryDefinitionId[],
): Omit<EditingSemanticsResetConfirmationRequest, "kind"> {
  const instances = new Set<string>();
  for (const id of definitionIds)
    for (const instance of projectInstancesOf(reader, id)) instances.add(instance);
  const loss = originResetLoss(reader, definitionIds);
  return {
    originCount: definitionIds.length,
    instanceCount: instances.size,
    lostInstanceCount: loss.instances,
    lostNodeCount: loss.nodes,
  };
}

/**
 * Reset one origin, or every overridden origin (the default), after the user confirms. Returns
 * whether the command ran.
 */
export async function confirmCatalogOriginReset(
  reader: CatalogReader,
  run: (command: CatalogCommand) => unknown,
  definitionIds: readonly LibraryDefinitionId[] = catalogOverriddenOrigins(
    reader,
  ),
  confirm: (
    request: Omit<EditingSemanticsResetConfirmationRequest, "kind">,
  ) => Promise<boolean> = requestEditingSemanticsResetConfirmation,
): Promise<boolean> {
  if (!definitionIds.length) return false;
  if (!(await confirm(catalogOriginResetRequest(reader, definitionIds))))
    return false;
  run(
    definitionIds.length === 1
      ? resetOrigin({ definitionId: definitionIds[0]! })
      : resetOrigins(),
  );
  return true;
}
