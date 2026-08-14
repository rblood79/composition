/**
 * 가이드 선택 — ADR-181 후속 (Figma 어법).
 *
 * 선택은 **문서가 아니라 UI 상태**라 여기서 확인할 것은 두 가지다: 한 번에
 * 하나만 서는가, 그리고 값이 실제로 바뀐 때만 재렌더 신호를 내는가. 후자는
 * 프레임마다 불리는 오버레이가 매번 무효화되지 않게 하는 계약이다.
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  clearGuideSelection,
  getSelectedGuide,
  isGuideSelected,
  resetGuideSelectionForTest,
  setSelectedGuide,
} from "./guideSelection";
import {
  getPageGuideRevision,
  resetPageGuideRevisionForTest,
} from "./pageGuideRevision";

const A = { pageId: "page-1", guideId: "g1" };
const B = { pageId: "page-2", guideId: "g2" };

beforeEach(() => {
  resetGuideSelectionForTest();
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
    expect(isGuideSelected(A.pageId, A.guideId)).toBe(false);
    expect(getPageGuideRevision()).toBe(2);
  });

  it("같은 guideId 라도 페이지가 다르면 다른 선택이다", () => {
    setSelectedGuide({ pageId: "page-1", guideId: "same" });
    expect(isGuideSelected("page-2", "same")).toBe(false);
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
});
