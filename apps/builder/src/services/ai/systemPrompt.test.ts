/**
 * ADR-134 G5 — 시스템 프롬프트가 카탈로그를 SSOT 파생으로 주입하는가 + 예산 안에 드는가 (R3).
 */
import { describe, expect, it } from "vitest";
import { getComponentRulesTable } from "@composition/shared";
import { buildSystemPrompt, buildTurnContext } from "./systemPrompt";
import {
  formatCatalogEntries,
  getAiComponentCatalog,
} from "./catalog/componentCatalog";
import type { BuilderContext } from "../../types/integrations/chat.types";
import { localizedStrings } from "@/i18n/translations";
import type { PromptTranslate } from "./promptTranslate";

const CONTEXT: BuilderContext = {
  currentPageId: "page-1",
  elements: [
    { id: "b1", type: "Button" },
    { id: "t1", type: "Text" },
  ],
} as BuilderContext;

/** ko-KR 카탈로그에 묶은 프롬프트 해소기 (ADR-200 후속). */
const t: PromptTranslate = (key, params) => {
  const message = localizedStrings["ko-KR"][key];
  if (typeof message === "function") return message(params);
  return message ?? key;
};

/** 고정 system + 이번 턴 컨텍스트 — 모델이 실제로 받는 전체. */
function fullPrompt(context: BuilderContext, request: string): string {
  return `${buildSystemPrompt(t)}\n\n${buildTurnContext(context, t, request)}`;
}

describe("시스템 프롬프트 카탈로그 주입", () => {
  it("요청과 관련된 컴포넌트의 허용 값을 턴 컨텍스트에 실어 보낸다 (Tier 2)", () => {
    const turn = buildTurnContext(CONTEXT, t, "버튼을 secondary 로 바꿔줘");
    const variants = Object.keys(
      (getComponentRulesTable() as Record<string, { variants?: object }>).Button
        ?.variants ?? {},
    );
    expect(turn).toContain("### Button");
    for (const value of variants) expect(turn).toContain(value);
  });

  it("전체 type 목록은 고정 system 에 항상 들어간다 (Tier 1)", () => {
    const system = buildSystemPrompt(t);
    for (const type of ["Tooltip", "TagGroup", "Switch", "Calendar"]) {
      expect(system).toContain(type);
    }
  });

  /**
   * Claude 5 계열은 요청 간에 system 이 바뀌면 prompt cache 와 thinking prefix binding 이
   * 깨진다 — system 은 빌더 상태·요청문과 무관하게 같아야 한다.
   */
  it("고정 system 은 빌더 상태·요청문에 따라 달라지지 않는다", () => {
    const system = buildSystemPrompt(t);
    expect(system).not.toContain("page-1");
    expect(system).not.toContain("### Button");
    expect(buildSystemPrompt(t)).toBe(system);
  });

  it("존재하지 않는 컴포넌트를 광고하지 않는다", () => {
    const prompt = fullPrompt(CONTEXT, "레이아웃 만들어줘");
    const known = new Set(getAiComponentCatalog().map((e) => e.type));
    // 구 프롬프트가 하드코딩하던 목록에는 catalog 에 없는 type 이 섞여 있었다
    for (const stale of ["Div"]) {
      expect(known.has(stale)).toBe(false);
      expect(prompt).not.toContain(`, ${stale}`);
      expect(prompt).not.toContain(`### ${stale}`);
    }
  });

  it("선택된 요소가 있으면 그 type 상세가 턴 컨텍스트에 들어간다", () => {
    const turn = buildTurnContext(
      {
        ...CONTEXT,
        selectedElementId: "t1",
        selectedElement: {
          id: "t1",
          type: "Text",
          props: {},
          parent_id: "body",
        },
      },
      t,
      "이거 고쳐줘",
    );
    expect(turn).toContain("### Text");
    expect(turn).toContain("page-1");
  });

  /**
   * 선택 요소의 props 는 프롬프트에 그대로 실린다. 출처가 `elements` 목록이면
   * 구조 전용 캐시라 props 가 낡은 채 모델에 들어간다 — `selectedElement` 만 본다.
   */
  it("선택 요소 props 는 selectedElement 에서만 읽는다", () => {
    const turn = buildTurnContext(
      {
        ...CONTEXT,
        selectedElementId: "t1",
        selectedElement: {
          id: "t1",
          type: "Text",
          props: { children: "최신값" },
          parent_id: "body",
        },
      },
      t,
      "이거 고쳐줘",
    );
    expect(turn).toContain("최신값");
  });

  it("전체 카탈로그 상세를 다 싣지 않는다 (R3 — context 예산)", () => {
    const prompt = fullPrompt(CONTEXT, "버튼을 secondary 로 바꿔줘");
    const full = formatCatalogEntries(getAiComponentCatalog(), t);

    // 대략치 (chars/3.5). 절대값이 아니라 배율이 요점이다.
    const promptTokens = Math.round(prompt.length / 3.5);
    const fullTokens = Math.round(full.length / 3.5);

    expect(fullTokens).toBeGreaterThan(promptTokens * 3);
    expect(promptTokens).toBeLessThan(8000);
  });
});
