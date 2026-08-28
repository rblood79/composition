/**
 * ADR-134 G5 — 시스템 프롬프트가 카탈로그를 SSOT 파생으로 주입하는가 + 예산 안에 드는가 (R3).
 */
import { describe, expect, it } from "vitest";
import { getComponentRulesTable } from "@composition/shared";
import { buildSystemPrompt } from "./systemPrompt";
import {
  formatCatalogEntries,
  getAiComponentCatalog,
} from "./catalog/componentCatalog";
import type { BuilderContext } from "../../types/integrations/chat.types";

const CONTEXT: BuilderContext = {
  currentPageId: "page-1",
  elements: [
    { id: "b1", type: "Button", props: {}, parent_id: "body" },
    { id: "t1", type: "Text", props: {}, parent_id: "body" },
  ],
} as BuilderContext;

describe("시스템 프롬프트 카탈로그 주입", () => {
  it("요청과 관련된 컴포넌트의 허용 값을 실어 보낸다", () => {
    const prompt = buildSystemPrompt(CONTEXT, "버튼을 secondary 로 바꿔줘");
    const variants = Object.keys(
      (getComponentRulesTable() as Record<string, { variants?: object }>).Button
        ?.variants ?? {},
    );
    expect(prompt).toContain("### Button");
    for (const value of variants) expect(prompt).toContain(value);
  });

  it("전체 type 목록은 항상 들어간다 (Tier 1)", () => {
    const prompt = buildSystemPrompt(CONTEXT, "버튼 추가");
    for (const type of ["Tooltip", "TagGroup", "Switch", "Calendar"]) {
      expect(prompt).toContain(type);
    }
  });

  it("존재하지 않는 컴포넌트를 광고하지 않는다", () => {
    const prompt = buildSystemPrompt(CONTEXT, "레이아웃 만들어줘");
    const known = new Set(getAiComponentCatalog().map((e) => e.type));
    // 구 프롬프트가 하드코딩하던 목록에는 catalog 에 없는 type 이 섞여 있었다
    for (const stale of ["Div"]) {
      expect(known.has(stale)).toBe(false);
      expect(prompt).not.toContain(`, ${stale}`);
      expect(prompt).not.toContain(`### ${stale}`);
    }
  });

  it("선택된 요소가 있으면 그 type 상세가 들어간다", () => {
    const prompt = buildSystemPrompt(
      { ...CONTEXT, selectedElementId: "t1" },
      "이거 고쳐줘",
    );
    expect(prompt).toContain("### Text");
  });

  it("전체 카탈로그 상세를 다 싣지 않는다 (R3 — context 예산)", () => {
    const prompt = buildSystemPrompt(CONTEXT, "버튼을 secondary 로 바꿔줘");
    const full = formatCatalogEntries(getAiComponentCatalog());

    // 대략치 (chars/3.5). 절대값이 아니라 배율이 요점이다.
    const promptTokens = Math.round(prompt.length / 3.5);
    const fullTokens = Math.round(full.length / 3.5);

    expect(fullTokens).toBeGreaterThan(promptTokens * 3);
    expect(promptTokens).toBeLessThan(8000);
  });
});
