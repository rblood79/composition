/**
 * ADR-134 G5 — Tier 2 선택기.
 *
 * 전체를 펼치지 않는다는 것이 요점이므로, 확인할 것은 두 방향이다:
 * 무엇을 골랐는가 (근거) 와 무엇을 안 골랐는가 (예산).
 */
import { describe, expect, it } from "vitest";
import {
  buildCatalogSection,
  DEFAULT_DETAIL_BUDGET,
  selectCatalogEntries,
} from "./dynamicInjection";
import { getAiComponentCatalog } from "./componentCatalog";
import { localizedStrings } from "@/i18n/translations";
import type { PromptTranslate } from "../promptTranslate";

/** ko-KR 카탈로그에 묶은 해소기 (ADR-200 후속). */
const tr: PromptTranslate = (key, params) => {
  const message = localizedStrings["ko-KR"][key];
  if (typeof message === "function") return message(params);
  return message ?? key;
};

describe("Tier 2 선택", () => {
  it("요청문이 부른 type 을 고른다 (영문)", () => {
    const { reasons } = selectCatalogEntries(tr, {
      request: "Add a ProgressBar to the page",
    });
    expect(reasons.get("ProgressBar")).toBe("request");
  });

  it("요청문이 부른 type 을 고른다 (한국어 별칭)", () => {
    const { reasons } = selectCatalogEntries(tr, {
      request: "버튼 하나 넣어줘",
    });
    expect(reasons.get("Button")).toBe("request");
  });

  it("짧은 type 이름이 긴 이름 안에서 잡히지 않는다", () => {
    const { reasons } = selectCatalogEntries(tr, {
      request: "TextField 하나만 추가해줘",
    });
    expect(reasons.get("TextField")).toBe("request");
    // "Text" 가 "TextField" 안에서 매칭되면 예산을 낭비한다
    expect(reasons.get("Text")).toBeUndefined();
  });

  it("카테고리 요청은 그 카테고리를 펼친다", () => {
    const { reasons, selected } = selectCatalogEntries(tr, {
      request: "날짜 관련 컴포넌트 뭐가 있어?",
    });
    const dateTime = selected.filter((e) => e.category === "dateTime");
    expect(dateTime.length).toBeGreaterThan(0);
    expect(reasons.get(dateTime[0]!.type)).toMatch(/request|category/);
  });

  it("선택된 요소의 type 을 고른다 (수정 요청)", () => {
    const { reasons } = selectCatalogEntries(tr, {
      request: "이거 색 바꿔줘",
      selectedType: "Slider",
    });
    expect(reasons.get("Slider")).toBe("selection");
  });

  it("문맥이 없으면 core set 으로 떨어진다", () => {
    const { reasons, selected } = selectCatalogEntries(tr, { request: "" });
    expect(selected.length).toBeGreaterThan(0);
    expect([...reasons.values()].every((r) => r === "core")).toBe(true);
  });

  it("예산을 넘지 않는다", () => {
    const { selected } = selectCatalogEntries(tr, {
      request: "폼 컬렉션 레이아웃 오버레이 버튼 전부 보여줘",
    });
    expect(selected.length).toBeLessThanOrEqual(DEFAULT_DETAIL_BUDGET);

    const small = selectCatalogEntries(tr, {
      request: "폼 컬렉션 버튼",
      budget: 3,
    });
    expect(small.selected).toHaveLength(3);
  });

  it("전체 카탈로그를 상세까지 펼치지 않는다 (R3 — context 예산)", () => {
    const section = buildCatalogSection({ request: "버튼 추가" });
    const detailed = getAiComponentCatalog().filter((e) =>
      section.includes(`### ${e.type}`),
    );
    expect(detailed.length).toBeLessThanOrEqual(DEFAULT_DETAIL_BUDGET);
    expect(detailed.length).toBeLessThan(getAiComponentCatalog().length / 4);
  });
});

describe("주입 블록", () => {
  it("Tier 1 목록은 항상 전체를 담는다", () => {
    const section = buildCatalogSection({ request: "버튼 추가" });
    // 상세는 못 받아도 이름은 안다 — 모델이 목록에서 고를 수 있어야 한다
    for (const type of ["Tooltip", "TagGroup", "Tree", "Switch"]) {
      expect(section).toContain(type);
    }
  });

  it("상세 절이 선택 결과를 그대로 싣는다", () => {
    const context = { request: "슬라이더 최대값 바꿔줘" };
    const { selected } = selectCatalogEntries(tr, context);
    const section = buildCatalogSection(context, tr);
    for (const entry of selected)
      expect(section).toContain(`### ${entry.type}`);
  });
});
