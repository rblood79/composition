import { describe, expect, it } from "vitest";

import { computeScrollExtent } from "../fullTreeLayout";

/**
 * 스크롤 가능 영역은 **자손 전체**의 넘침이다 (CSS-OVERFLOW-3 §3).
 *
 * Why: 직계 자식만 세면 `overflow: visible` 인 중간 노드가 자손의 넘침을 삼킨다. 프레임을
 * 적용한 페이지가 정확히 그 형태다 — body(overflow:auto) > Slot(visible) > 실제 콘텐츠.
 * 슬롯은 페이지 높이에 딱 맞으므로 body 가 "넘치는 게 없다" 고 판정해 스크롤이 아예 안 켜졌다.
 *
 * 실측(2026-07-27, 사용자 보고 재현): `basic 2-Row` 프레임을 Home 에 적용하고 content 슬롯에
 * Card 5개(각 322px) 를 넣으면 —
 *   - 같은 문서의 **프레임 없는** 페이지: `maxScrollTop = 579` (정상)
 *   - **프레임 적용** Home: `maxScrollTop = 0` → 스크롤바 없음
 *   - Chrome ground truth(동일 트리): `scrollHeight 1698 − clientHeight 844 = 854`
 */

/** 사용자가 보고한 트리 그대로 — 390×844 페이지 body > (header/content 슬롯) > Card ×5. */
const PAGE_H = 844;
const CARD_H = 322;
const CARDS = 5;

type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
  margin?: { right?: number; bottom?: number };
};

function framedPageFixture() {
  const layout = new Map<string, Box>([
    ["header-slot", { x: 20, y: 20, width: 350, height: 48 }],
    ["content-slot", { x: 20, y: 88, width: 350, height: 736 }],
  ]);
  const cardIds: string[] = [];
  for (let i = 0; i < CARDS; i++) {
    const id = `card-${i}`;
    cardIds.push(id);
    // 슬롯 **상대** 좌표 — 실제 layout map 과 동일한 계약.
    layout.set(id, { x: 0, y: i * CARD_H, width: 350, height: CARD_H });
  }
  const children = new Map<string, string[]>([
    ["header-slot", []],
    ["content-slot", cardIds],
  ]);
  return {
    directChildren: ["header-slot", "content-slot"],
    layoutOf: (id: string) => layout.get(id),
    childrenOf: (id: string) => children.get(id) ?? [],
  };
}

describe("computeScrollExtent — 자손 넘침", () => {
  it("overflow:visible 슬롯을 뚫고 자손의 넘침을 센다", () => {
    const f = framedPageFixture();
    const { maxBottom } = computeScrollExtent(
      f.directChildren,
      f.layoutOf,
      f.childrenOf,
      () => false, // 슬롯은 overflow:visible
    );
    // 슬롯 상단 88 + 카드 총합 1610 = 1698 (Chrome scrollHeight 와 동일)
    expect(maxBottom).toBe(88 + CARD_H * CARDS);
    expect(Math.max(0, maxBottom - PAGE_H)).toBe(854);
  });

  it("직계만 세던 종전 동작이면 스크롤이 안 켜진다 (회귀 기준선)", () => {
    // 자손 하강을 막으면 = 종전 구현. 이 단언이 위 테스트의 의미를 고정한다.
    const f = framedPageFixture();
    const { maxBottom } = computeScrollExtent(
      f.directChildren,
      f.layoutOf,
      () => [], // 하강 없음
      () => false,
    );
    expect(maxBottom).toBe(824);
    expect(Math.max(0, maxBottom - PAGE_H)).toBe(0);
  });

  it("자손이 자기 스크롤 컨테이너면 그 안쪽은 세지 않는다", () => {
    // 그쪽이 자기 스크롤로 넘침을 흡수하므로 바깥 영역에 기여하면 안 된다.
    const f = framedPageFixture();
    const { maxBottom } = computeScrollExtent(
      f.directChildren,
      f.layoutOf,
      f.childrenOf,
      (id) => id === "content-slot",
    );
    expect(maxBottom).toBe(88 + 736); // 슬롯 자기 박스까지만
  });

  it("가로 축도 같은 규칙", () => {
    const layout = new Map<string, Box>([
      ["wrap", { x: 0, y: 0, width: 100, height: 100 }],
      ["wide", { x: 10, y: 0, width: 500, height: 20 }],
    ]);
    const { maxRight } = computeScrollExtent(
      ["wrap"],
      (id) => layout.get(id),
      (id) => (id === "wrap" ? ["wide"] : []),
      () => false,
    );
    expect(maxRight).toBe(510);
  });

  it("margin 을 넘침에 포함한다", () => {
    const layout = new Map<string, Box>([
      ["only", { x: 0, y: 0, width: 10, height: 10, margin: { bottom: 7 } }],
    ]);
    const { maxBottom } = computeScrollExtent(
      ["only"],
      (id) => layout.get(id),
      () => [],
      () => false,
    );
    expect(maxBottom).toBe(17);
  });

  it("순환 참조에서 멈춘다", () => {
    const layout = new Map<string, Box>([
      ["a", { x: 0, y: 0, width: 10, height: 10 }],
      ["b", { x: 0, y: 10, width: 10, height: 10 }],
    ]);
    expect(() =>
      computeScrollExtent(
        ["a"],
        (id) => layout.get(id),
        (id) => (id === "a" ? ["b"] : ["a"]),
        () => false,
      ),
    ).not.toThrow();
  });
});
