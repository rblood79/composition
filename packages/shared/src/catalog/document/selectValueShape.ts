import type { CatalogEntry, DefinitionId, NodeId } from "./types";

/**
 * S2 체크리스트 §9.3 (S2 Picker `renderValue`, 사용자 결정 2026-11-23) — a node in a Select's SelectValue
 * is its value's shape and may repeat (`repeat`) per item of the Select whatever its type: the
 * nearest SelectValue owns it (an authored Select), or the Select whose SelectValue position it
 * fills (an origin's — `fillSlot`).
 */
export function catalogInSelectValue(
  id: string,
  get: (id: string) => CatalogEntry | undefined,
  ownerOf: (id: string) => string | undefined,
  typeName: (definitionId: DefinitionId) => string,
  templateDefinition: (templateId: string) => DefinitionId | undefined,
): boolean {
  let child = id;
  for (let owner = ownerOf(id); owner; owner = ownerOf(owner)) {
    const entry = get(owner);
    if (entry?.kind !== "node") return false;
    const type = typeName(entry.definitionId);
    if (type === "SelectValue") return true;
    if (type === "Select") {
      const fill = entry.descendantOverrides.find(
        (override) =>
          override.kind === "fillSlot" &&
          override.childIds.includes(child as NodeId),
      );
      if (fill?.kind !== "fillSlot") return false;
      const path = fill.address.templatePath;
      const at = path[path.length - 1];
      const definition = at ? templateDefinition(at) : undefined;
      return !!definition && typeName(definition) === "SelectValue";
    }
    child = owner;
  }
  return false;
}
