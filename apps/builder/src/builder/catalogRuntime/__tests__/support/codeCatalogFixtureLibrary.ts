import { buildCodeCatalogLibrary } from "../../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { createPencilFixtureLibrary } from "../../../../../../../packages/shared/src/catalog/document/pencilFixtureLibrary";
import { buildCatalogLibrary } from "../../../../../../../packages/shared/src/catalog/document/library";

/** Test entry only: combine source-derived leaves with existing native fixture inputs. */
export async function createCodeCatalogScenarioLibrary(
  theme: "light" | "dark" = "light",
) {
  const source = await buildCodeCatalogLibrary(theme);
  const native = createPencilFixtureLibrary();
  const definitions = [
    ...source.definitions.values(),
    ...[...native.definitions.values()].filter(
      (definition) => !source.definitions.has(definition.id),
    ),
  ];
  const bindingIds = [
    ...new Set([
      ...source.execution.bindingIds,
      ...native.execution.bindingIds,
    ]),
  ];
  const tokens = [...source.tokens.values()];
  const rules = Object.fromEntries(source.rules);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      JSON.stringify({
        contractVersion: 3,
        definitions,
        bindingIds,
        tokens,
        rules,
      }),
    ),
  );
  const revision = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return buildCatalogLibrary({
    contractVersion: 3,
    revision,
    definitions,
    templates: [...source.templates.values()],
    tokens,
    bindingIds,
    rules,
    actionOpCodes: [...native.execution.actionOpCodes],
  });
}
