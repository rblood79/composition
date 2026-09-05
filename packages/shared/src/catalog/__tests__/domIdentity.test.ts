import { describe, expect, it } from "vitest";

import {
  RAC_KEYED_ITEM_TYPES,
  resolveAuthoredAriaLabel,
  resolveAuthoredDomId,
} from "../outputs/domIdentity";

describe("resolveAuthoredDomId", () => {
  it("사용자가 지정한 customId 를 DOM id 로 돌려준다", () => {
    expect(resolveAuthoredDomId("Button", "button_1")).toBe("button_1");
  });

  it("customId 가 없으면 emit 하지 않는다", () => {
    expect(resolveAuthoredDomId("Button", undefined)).toBeUndefined();
    expect(resolveAuthoredDomId("Button", "")).toBeUndefined();
  });

  it("렌더러가 이미 id 를 산출했으면 덮지 않는다", () => {
    expect(
      resolveAuthoredDomId("Button", "button_1", "rac-id"),
    ).toBeUndefined();
  });

  it("RAC 에서 id 가 collection key 인 타입은 제외한다", () => {
    for (const type of RAC_KEYED_ITEM_TYPES) {
      expect(resolveAuthoredDomId(type, "item_1")).toBeUndefined();
    }
  });
});

describe("resolveAuthoredAriaLabel", () => {
  it("사용자가 지정한 aria-label 을 돌려준다", () => {
    expect(resolveAuthoredAriaLabel({ "aria-label": "업로드 진행률" })).toBe(
      "업로드 진행률",
    );
  });

  it("앞뒤 공백은 다듬는다", () => {
    expect(resolveAuthoredAriaLabel({ "aria-label": "  이름  " })).toBe("이름");
  });

  it("미지정·빈 문자열·공백뿐이면 emit 하지 않는다", () => {
    expect(resolveAuthoredAriaLabel(undefined)).toBeUndefined();
    expect(resolveAuthoredAriaLabel({})).toBeUndefined();
    expect(resolveAuthoredAriaLabel({ "aria-label": "" })).toBeUndefined();
    expect(resolveAuthoredAriaLabel({ "aria-label": "   " })).toBeUndefined();
  });

  it("문자열이 아니면 무시한다", () => {
    expect(resolveAuthoredAriaLabel({ "aria-label": 3 })).toBeUndefined();
  });

  it("컴포넌트가 이미 이름을 냈으면 덮지 않는다", () => {
    // RAC 가 label 자식에서 이름을 파생하는 경우가 사용자 지정보다 우선이다 —
    // 그쪽이 실제 표시 텍스트와 묶여 있어 둘이 갈리면 스크린리더만 다른 말을 한다.
    expect(
      resolveAuthoredAriaLabel({ "aria-label": "내 것" }, "컴포넌트 것"),
    ).toBeUndefined();
  });
});
