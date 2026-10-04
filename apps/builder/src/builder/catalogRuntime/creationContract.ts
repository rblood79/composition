import { getReusableOriginId, resolveComponentRule } from "@composition/shared";
import { catalogTypeDefinition } from "../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { instanceContract } from "../../../../../packages/shared/src/catalog/document/library";
import {
  REUSABLE_ORIGIN_DEFINITIONS,
  REUSABLE_ORIGIN_TEMPLATES,
} from "../../../../../packages/shared/src/catalog/document/generated/reusableOriginLibrary";
import type { LibraryDefinition } from "../../../../../packages/shared/src/catalog/document/types";
import {
  deriveOptions,
  UNIVERSAL_STYLE_CONTRACTS,
  type ResolvedField,
} from "../../../../../packages/shared/src/catalog/outputs/editFields";
import { catalogSemanticContracts } from "./editContract";

const definitions = new Map<string, LibraryDefinition>(
  REUSABLE_ORIGIN_DEFINITIONS.map((definition) => [definition.id, definition]),
);
const templates = new Map(
  REUSABLE_ORIGIN_TEMPLATES.map((node) => [String(node.id), node]),
);

function definitionOf(id: string): LibraryDefinition | undefined {
  const existing = definitions.get(id);
  if (existing) return existing;
  if (!id.startsWith("lib:definition:type-")) return undefined;
  const definition = catalogTypeDefinition(
    id.slice("lib:definition:type-".length),
  );
  definitions.set(id, definition);
  return definition;
}

/** 생성 시점의 편집 계약. 실제 instance validator와 동일한 library 정의·template 계약을 읽는다. */
export function catalogCreationEditFields(type: string): ResolvedField[] {
  const reusableId = getReusableOriginId(type);
  const definition =
    (reusableId && definitions.get(`lib:definition:origin-${reusableId}`)) ||
    catalogTypeDefinition(type);
  const accepted = instanceContract(definition, definitionOf, (id) =>
    templates.get(id),
  );
  const rule = resolveComponentRule(type);
  const contracts = catalogSemanticContracts(definition.id, type);
  const fields: ResolvedField[] = Object.entries(contracts)
    .filter(
      ([key, contract]) =>
        contract.kind === "binding" || key in accepted.accepts,
    )
    .map(([key, contract]) => {
      const value = definition.defaults[key] ?? contract.default;
      const choices = accepted.propChoices?.[key];
      return {
        ...contract,
        key,
        label: contract.label ?? key,
        section: contract.section ?? "content",
        origin: "semantic",
        isOverridden: false,
        baseValue: value,
        currentValue: value,
        options: choices
          ? choices.map((value) => ({
              value: String(value),
              label: String(value),
            }))
          : deriveOptions(contract, rule, { type }, key),
      };
    });
  for (const [key, contract] of Object.entries(UNIVERSAL_STYLE_CONTRACTS)) {
    fields.push({
      ...contract,
      key,
      label: contract.label ?? key,
      section: contract.section ?? "appearance",
      origin: "style",
      isOverridden: false,
      baseValue: undefined,
      currentValue: undefined,
    });
  }
  return fields;
}
