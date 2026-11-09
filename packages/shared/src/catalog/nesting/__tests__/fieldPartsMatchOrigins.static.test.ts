import { describe, expect, it } from "vitest";

import { getReusableOriginId } from "../../componentCatalog";
import { buildCodeCatalogLibrary } from "../../document/codeCatalogLibrary";
import type {
  LibraryDefinitionId,
  LibraryTemplateId,
} from "../../document/types";
import { CATALOG_FIELD_PART_TYPES } from "../nestingRules";

/**
 * 2026-11-09 — field 가 직계 자식으로 받는 부품 표 (`CATALOG_FIELD_PART_TYPES`) 는 손으로 쓴 사본이다
 * (nestingRules 는 Preview 번들에도 들어가 원본 library 를 import 하지 않는다). 원본 template 루트의
 * 자식 type 과 같아야 한다 — 원본이 바뀌면 여기서 먼저 깨진다.
 */
describe("CATALOG_FIELD_PART_TYPES — 원본 template 루트의 부품과 같다", () => {
  const library = buildCodeCatalogLibrary();
  const typeOf = async (definitionId: string): Promise<string> =>
    (await library).definitions.get(definitionId as LibraryDefinitionId)
      ?.name ?? definitionId;

  for (const [host, parts] of Object.entries(CATALOG_FIELD_PART_TYPES))
    it(`${host} 의 부품 = 원본 루트의 직계 자식 type`, async () => {
      const { definitions, templates } = await library;
      const origin = definitions.get(
        `lib:definition:origin-${getReusableOriginId(host)}` as LibraryDefinitionId,
      );
      expect(origin?.templateRootId, `${host} origin`).toBeTruthy();
      const root = templates.get(origin!.templateRootId as LibraryTemplateId);
      expect(root, `${host} root template`).toBeTruthy();
      const childTypes = await Promise.all(
        [...new Set(root!.children)].map((id) =>
          typeOf(templates.get(id as LibraryTemplateId)!.definitionId),
        ),
      );
      expect([...parts]).toEqual([...new Set(childTypes)]);
    });
});
