/**
 * PROMPT_AUDIT_2026-09 D2 — `create_element` 의 type enum 은 카탈로그에서 파생한다.
 *
 * 손으로 적은 28개 목록은 system prompt 가 광고하는 카탈로그 (124) 와 갈라져 있었고, 같은
 * 요청의 골격 힌트가 만들라는 Heading · ProgressBar 가 enum 에 없었다. 실행기는 enum 을
 * 검사하지 않으므로 스키마가 프롬프트와 다른 말을 하는 것이 유일한 효과였다.
 */
import { describe, expect, it } from "vitest";
import { localizedStrings } from "@/i18n/translations";
import type { PromptTranslate } from "../promptTranslate";
import { getAiComponentCatalog } from "../catalog/componentCatalog";
import { getToolDefinitions } from "./definitions";

const tr: PromptTranslate = (key, params) => {
  const message = localizedStrings["ko-KR"][key];
  if (typeof message === "function") return message(params);
  return message ?? key;
};

function createElementTypeEnum(
  definitions: Awaited<ReturnType<typeof getToolDefinitions>>,
): readonly string[] {
  const create = definitions.find((d) => d.name === "create_element");
  const properties = create?.parameters.properties as
    | Record<string, { enum?: readonly string[] }>
    | undefined;
  return properties?.type.enum ?? [];
}

describe("create_element type enum", () => {
  it("카탈로그의 placeable type 전부와 같다 — 골격 힌트의 Heading · ProgressBar · frame 포함", async () => {
    const definitions = await getToolDefinitions(tr);
    const enumValues = createElementTypeEnum(definitions);
    const placeable = getAiComponentCatalog()
      .filter((entry) => entry.placeable)
      .map((entry) => entry.type);

    expect(enumValues).toEqual(placeable);
    expect(enumValues).toContain("Heading");
    expect(enumValues).toContain("ProgressBar");
    expect(enumValues).toContain("frame");
    expect(enumValues.length).toBeGreaterThan(28);
  });
});
