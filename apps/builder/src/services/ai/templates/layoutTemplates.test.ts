/**
 * ADR-134 Phase 6 — 템플릿이 실재하는 컴포넌트만 가리키는가.
 *
 * 템플릿에 없는 type 을 적어 두면 계획은 그럴듯한데 실행이 조용히 실패한다.
 * Phase 5 의 별칭 drift 감시와 같은 형태의 검사다.
 */
import { describe, expect, it } from "vitest";
import { getAiCatalogEntry } from "../catalog/componentCatalog";
import {
  formatTemplateHints,
  getLayoutTemplate,
  LAYOUT_TEMPLATES,
} from "./layoutTemplates";
import { localizedStrings } from "@/i18n/translations";
import type { PromptTranslate } from "../promptTranslate";

/** ko-KR 카탈로그에 묶은 해소기 (ADR-200 후속). */
const tr: PromptTranslate = (key, params) => {
  const message = localizedStrings["ko-KR"][key];
  if (typeof message === "function") return message(params);
  return message ?? key;
};

describe("레이아웃 템플릿", () => {
  it("모든 템플릿의 type 이 catalog 에 실재한다", () => {
    const dead = LAYOUT_TEMPLATES.flatMap((t) =>
      t.types
        .filter((type) => !getAiCatalogEntry(type))
        .map((type) => `${t.id}: ${type}`),
    );
    expect(dead).toEqual([]);
  });

  it("검사가 실제로 죽은 type 을 잡는다 (감시의 대조군)", () => {
    expect(getAiCatalogEntry("NoSuchComponent")).toBeUndefined();
  });

  it("id 가 겹치지 않는다", () => {
    const ids = LAYOUT_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("계획 담당 프롬프트에 실릴 요약이 모든 템플릿을 담는다", () => {
    const hints = formatTemplateHints(tr);
    for (const t of LAYOUT_TEMPLATES) expect(hints).toContain(t.id);
  });

  it("id 로 조회된다", () => {
    expect(getLayoutTemplate("dashboard")?.types).toContain("Table");
    expect(getLayoutTemplate("없음")).toBeUndefined();
  });
});
