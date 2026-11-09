import { describe, expect, it } from "vitest";

import {
  REUSABLE_ORIGIN_DEFINITIONS,
  REUSABLE_ORIGIN_TEMPLATES,
} from "../../document/generated/reusableOriginLibrary";
import { CATALOG_FIELD_PART_TYPES } from "../nestingRules";

/**
 * 2026-11-09 — field 가 직계 자식으로 받는 부품 표 (`CATALOG_FIELD_PART_TYPES`) 는 손으로 쓴 사본이다
 * (nestingRules 는 Preview 번들에도 들어가 원본 library 를 import 하지 않는다). 원본 template 루트의
 * 자식 type 과 같아야 한다 — 원본이 바뀌면 여기서 먼저 깨진다.
 */
describe("CATALOG_FIELD_PART_TYPES — 원본 template 루트의 부품과 같다", () => {
  const definitions = REUSABLE_ORIGIN_DEFINITIONS as readonly {
    id: string;
    name: string;
    templateRootId?: string;
  }[];
  const templates = new Map(
    (
      REUSABLE_ORIGIN_TEMPLATES as readonly {
        id: string;
        definitionId: string;
        children?: readonly string[];
      }[]
    ).map((node) => [node.id, node]),
  );
  const typeOf = (definitionId: string): string => {
    const origin = definitions.find((item) => item.id === definitionId);
    if (origin) return origin.name;
    const typed = /type-(\w+)$/.exec(definitionId);
    return typed ? typed[1] : definitionId.replace("lib:definition:", "");
  };

  for (const [host, parts] of Object.entries(CATALOG_FIELD_PART_TYPES))
    it(`${host} 의 부품 = 원본 루트의 직계 자식 type`, () => {
      const origin = definitions.find((item) => item.name === host);
      expect(origin?.templateRootId, `${host} origin`).toBeTruthy();
      const root = templates.get(origin!.templateRootId!);
      expect(root, `${host} root template`).toBeTruthy();
      const childTypes = [
        ...new Set(
          (root!.children ?? []).map((id) =>
            typeOf(templates.get(id)!.definitionId),
          ),
        ),
      ];
      expect([...parts]).toEqual(childTypes);
    });
});
