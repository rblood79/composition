/**
 * 가이드 강조 상태 — ADR-181 후속 (Figma 어법).
 *
 * 강조는 **문서가 아니라 UI 상태**라 여기서 확인할 것은 셋이다: 선택이 한 번에
 * 하나만 서는가, 값이 실제로 바뀐 때만 재렌더 신호를 내는가(프레임마다 불리는
 * 오버레이 + pointermove 마다 불리는 hover 양쪽의 계약), 그리고 **선택이 hover 를
 * 이기는가**. 마지막 것이 이 모듈을 하나로 둔 이유다.
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  clearGuideSelection,
  getHoveredGuide,
  getSelectedGuide,
  resetGuideEmphasisForTest,
  resolveGuideEmphasis,
  resolveGuideEmphasisIdsForPage,
  setHoveredGuide,
  setSelectedGuide,
} from "./guideEmphasis";
import {
  getPageGuideRevision,
  resetPageGuideRevisionForTest,
} from "./pageGuideRevision";

const A = { pageId: "page-1", guideId: "g1" };
const B = { pageId: "page-2", guideId: "g2" };

beforeEach(() => {
  resetGuideEmphasisForTest();
  resetPageGuideRevisionForTest();
});

describe("setSelectedGuide", () => {
  it("선택하면 값이 서고 개정이 오른다", () => {
    setSelectedGuide(A);
    expect(getSelectedGuide()).toEqual(A);
    expect(getPageGuideRevision()).toBe(1);
  });

  it("입력 객체를 그대로 들지 않는다 (외부 변형 차단)", () => {
    const input = { ...A };
    setSelectedGuide(input);
    expect(getSelectedGuide()).not.toBe(input);
  });

  it("같은 가이드 재선택은 no-op (프레임마다 불려도 무효화 안 함)", () => {
    setSelectedGuide(A);
    setSelectedGuide({ ...A });
    expect(getPageGuideRevision()).toBe(1);
  });

  it("한 번에 하나만 — 다른 가이드를 고르면 앞의 것이 풀린다", () => {
    setSelectedGuide(A);
    setSelectedGuide(B);
    expect(getSelectedGuide()).toEqual(B);
    expect(getPageGuideRevision()).toBe(2);
  });

  it("같은 guideId 라도 페이지가 다르면 다른 선택이다", () => {
    setSelectedGuide({ pageId: "page-1", guideId: "same" });
    expect(resolveGuideEmphasisIdsForPage("page-2").selectedGuideId).toBeNull();
  });

  it("null 을 넘기면 해제와 같다", () => {
    setSelectedGuide(A);
    setSelectedGuide(null);
    expect(getSelectedGuide()).toBeNull();
  });
});

describe("clearGuideSelection", () => {
  it("해제는 1회만 신호를 낸다", () => {
    setSelectedGuide(A);
    clearGuideSelection();
    expect(getSelectedGuide()).toBeNull();
    expect(getPageGuideRevision()).toBe(2);

    clearGuideSelection();
    expect(getPageGuideRevision()).toBe(2);
  });

  it("선택이 없을 때 해제해도 신호가 없다", () => {
    clearGuideSelection();
    expect(getPageGuideRevision()).toBe(0);
  });

  it("hover 는 건드리지 않는다 (Escape 로 선택만 푼다)", () => {
    setHoveredGuide(A);
    setSelectedGuide(A);
    clearGuideSelection();
    expect(getHoveredGuide()).toEqual(A);
  });
});

describe("setHoveredGuide", () => {
  it("같은 가이드 위에서 움직이는 동안은 신호가 없다", () => {
    setHoveredGuide(A);
    expect(getPageGuideRevision()).toBe(1);
    // pointermove 는 RAF 마다 불린다 — 같은 값이면 무효화가 없어야 한다
    setHoveredGuide({ ...A });
    setHoveredGuide({ ...A });
    expect(getPageGuideRevision()).toBe(1);
  });

  it("가이드를 벗어나면 1회만 신호를 낸다", () => {
    setHoveredGuide(A);
    setHoveredGuide(null);
    expect(getHoveredGuide()).toBeNull();
    expect(getPageGuideRevision()).toBe(2);

    setHoveredGuide(null);
    expect(getPageGuideRevision()).toBe(2);
  });

  it("hover 는 선택을 건드리지 않는다 (두 축이 독립)", () => {
    setSelectedGuide(A);
    setHoveredGuide(B);
    expect(getSelectedGuide()).toEqual(A);
    expect(getHoveredGuide()).toEqual(B);
  });
});

describe("resolveGuideEmphasisIdsForPage", () => {
  it("아무것도 없으면 둘 다 null", () => {
    expect(resolveGuideEmphasisIdsForPage("page-1")).toEqual({
      selectedGuideId: null,
      hoveredGuideId: null,
    });
  });

  it("각 상태의 페이지를 따로 대조한다", () => {
    setSelectedGuide(A);
    setHoveredGuide(B);
    expect(resolveGuideEmphasisIdsForPage("page-1")).toEqual({
      selectedGuideId: "g1",
      hoveredGuideId: null,
    });
    expect(resolveGuideEmphasisIdsForPage("page-2")).toEqual({
      selectedGuideId: null,
      hoveredGuideId: "g2",
    });
  });
});

describe("resolveGuideEmphasis", () => {
  const ids = (
    selectedGuideId: string | null,
    hoveredGuideId: string | null,
  ) => ({ selectedGuideId, hoveredGuideId });

  it("아무 대상도 아니면 default", () => {
    expect(resolveGuideEmphasis("g1", ids(null, null))).toBe("default");
  });

  it("hover 만이면 hover", () => {
    expect(resolveGuideEmphasis("g1", ids(null, "g1"))).toBe("hover");
  });

  it("선택만이면 selected", () => {
    expect(resolveGuideEmphasis("g1", ids("g1", null))).toBe("selected");
  });

  it("**선택이 hover 를 이긴다** — 선택 표식이 포인터 따라 깜빡이면 안 된다", () => {
    expect(resolveGuideEmphasis("g1", ids("g1", "g1"))).toBe("selected");
  });

  it("다른 가이드의 강조가 옮아붙지 않는다", () => {
    expect(resolveGuideEmphasis("g3", ids("g1", "g2"))).toBe("default");
  });
});
