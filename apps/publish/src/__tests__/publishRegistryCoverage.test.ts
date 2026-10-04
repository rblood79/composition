import { getCatalogEntry } from "@composition/shared";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { buildCodeCatalogLibrary } from "../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CATALOG_DOM_BINDING_IDS } from "../../../../packages/shared/src/catalog/runtime/domBinding";
import { CATALOG_DELEGATED_DOM } from "../../../../packages/shared/src/catalog/runtime/delegatedDom";

it("Publish 공용 DOM runtime이 팔레트의 모든 catalog 정의를 해석한다", async () => {
  const source = readFileSync(
    new URL(
      "../../../builder/src/builder/panels/components/paletteItems.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const order = source.slice(source.indexOf("const PALETTE_ORDER"));
  const types = [
    ...order.matchAll(/\{\s*type:\s*"([A-Za-z_]+)"\s*,\s*source:/g),
  ].map((match) => match[1]);
  expect(types.length).toBeGreaterThan(50);
  const library = await buildCodeCatalogLibrary();
  for (const type of types) {
    if (getCatalogEntry(type)?.kind === "native") continue;
    const definition = [...library.definitions.values()].find(
      (def) => def.name.toLowerCase() === type.toLowerCase(),
    );
    expect(definition, type).toBeDefined();
    expect(
      definition!.mode === "composite" ||
        CATALOG_DOM_BINDING_IDS.has(definition!.bindingId ?? "") ||
        !!CATALOG_DELEGATED_DOM[definition!.bindingId ?? ""] ||
        library.rules.has(definition!.ruleId ?? ""),
      type,
    ).toBe(true);
  }
});
