import { describe, expect, it } from "vitest";

import type { CanvasSceneNode } from "../../scene/canvasSceneNode";
import type { BoundingBox } from "../../selection/types";
import {
  buildChildOverflowContextMap,
  buildOverflowInfoMap,
  getCachedOverflowInfoMap,
} from "../skiaFrameHelpers";

/**
 * overflow chrome(hover 반투명 오버레이 / 선택 해칭)은 **자손 전체**의 넘침을 대상으로 한다.
 *
 * Why: 넘침은 `overflow: visible` 중간 노드를 통과해 올라온다 (CSS-OVERFLOW-3 §3). 프레임을
 * 적용한 페이지가 그 형태 — `body(auto) > Slot(visible) > 콘텐츠`. 직계만 세면 슬롯이 페이지
 * 높이에 딱 맞아 "넘침 없음" 이 되어 chrome 이 통째로 안 나왔다. 같은 전제로 스크롤 동작이
 * 죽어 있던 것이 `computeScrollExtent` (fullTreeLayout GAP 4, 2026-07-27 수정).
 */

function node(
  id: string,
  overrides: Partial<CanvasSceneNode> = {},
): CanvasSceneNode {
  return {
    id,
    type: "div",
    props: {},
    parentId: null,
    pageId: null,
    layoutId: null,
    ...overrides,
  } as CanvasSceneNode;
}

/** 사용자 보고 트리 — 390×844 body(auto) > (header/content 슬롯) > Card ×5. */
function framedPageFixture() {
  const bounds = new Map<string, BoundingBox>([
    ["body", { x: 0, y: 0, width: 390, height: 844 }],
    ["header-slot", { x: 20, y: 20, width: 350, height: 48 }],
    ["content-slot", { x: 20, y: 88, width: 350, height: 736 }],
  ]);
  const cardIds: string[] = [];
  for (let i = 0; i < 5; i++) {
    const id = `card-${i}`;
    cardIds.push(id);
    bounds.set(id, { x: 20, y: 88 + i * 322, width: 350, height: 322 });
  }

  const elements = new Map<string, CanvasSceneNode>([
    [
      "body",
      node("body", { type: "body", props: { style: { overflow: "auto" } } }),
    ],
    ["header-slot", node("header-slot", { type: "slot" })],
    ["content-slot", node("content-slot", { type: "slot" })],
    ...cardIds.map(
      (id) => [id, node(id, { type: "Card" })] as [string, CanvasSceneNode],
    ),
  ]);

  const children = new Map<string, CanvasSceneNode[]>([
    ["body", [elements.get("header-slot")!, elements.get("content-slot")!]],
    ["content-slot", cardIds.map((id) => elements.get(id)!)],
  ]);

  return { bounds, elements, children, cardIds };
}

describe("buildOverflowInfoMap — 자손 넘침", () => {
  it("overflow:visible 슬롯을 뚫고 자손의 넘침을 잡는다", () => {
    const f = framedPageFixture();
    const map = buildOverflowInfoMap(f.bounds, f.elements, f.children);

    const info = map.get("body");
    expect(info).toBeDefined();
    expect(info!.overflowType).toBe("auto");
    // 844 아래로 나가는 카드 = y 730(card-2, 하단 1052) 부터 → card-2/3/4
    expect(info!.overflowChildren.map((c) => c.id).sort()).toEqual([
      "card-2",
      "card-3",
      "card-4",
    ]);
  });

  it("선택 해칭 역매핑이 자손 카드를 body 에 귀속시킨다", () => {
    const f = framedPageFixture();
    const ctxMap = buildChildOverflowContextMap(
      buildOverflowInfoMap(f.bounds, f.elements, f.children),
    );

    const ctx = ctxMap.get("card-4");
    expect(ctx).toBeDefined();
    expect(ctx!.overflowType).toBe("auto");
    expect(ctx!.containerBounds.height).toBe(844);
  });

  it("직계만 세던 종전 동작이면 chrome 이 아예 안 나온다 (회귀 기준선)", () => {
    // 하강을 막으면 = 종전 구현. 이 단언이 위 두 테스트의 의미를 고정한다.
    const f = framedPageFixture();
    const directOnly = new Map<string, CanvasSceneNode[]>([
      ["body", f.children.get("body")!],
    ]);
    const map = buildOverflowInfoMap(f.bounds, f.elements, directOnly);
    expect(map.has("body")).toBe(false);
  });

  it("자손이 자기 클립을 가지면 그 안쪽은 세지 않는다", () => {
    const f = framedPageFixture();
    const elements = new Map(f.elements);
    elements.set(
      "content-slot",
      node("content-slot", {
        type: "slot",
        props: { style: { overflow: "hidden" } },
      }),
    );

    const map = buildOverflowInfoMap(f.bounds, elements, f.children);
    // 슬롯이 자기 경계로 흡수 → body 기준 넘침 0
    expect(map.has("body")).toBe(false);
    // 슬롯 자신은 자기 카드들의 넘침을 보고한다
    expect(map.get("content-slot")?.overflowChildren.length).toBe(3);
  });

  it("나간 자손에서 하강을 멈춰 같은 영역이 겹쳐 쌓이지 않는다", () => {
    const bounds = new Map<string, BoundingBox>([
      ["box", { x: 0, y: 0, width: 100, height: 100 }],
      ["outer", { x: 0, y: 50, width: 100, height: 200 }],
      ["inner", { x: 0, y: 60, width: 100, height: 180 }],
    ]);
    const elements = new Map<string, CanvasSceneNode>([
      ["box", node("box", { props: { style: { overflow: "hidden" } } })],
      ["outer", node("outer")],
      ["inner", node("inner")],
    ]);
    const children = new Map<string, CanvasSceneNode[]>([
      ["box", [elements.get("outer")!]],
      ["outer", [elements.get("inner")!]],
    ]);

    const info = buildOverflowInfoMap(bounds, elements, children).get("box");
    expect(info!.overflowChildren.map((c) => c.id)).toEqual(["outer"]);
  });

  it("catalog containerStyles 에만 overflow 가 있는 컨테이너도 대상", () => {
    // ListBox 의 overflow:auto 는 raw props.style 이 아니라 catalog 에 있다.
    const bounds = new Map<string, BoundingBox>([
      ["lb", { x: 0, y: 0, width: 200, height: 100 }],
      ["row", { x: 0, y: 0, width: 200, height: 400 }],
    ]);
    const elements = new Map<string, CanvasSceneNode>([
      ["lb", node("lb", { type: "ListBox" })],
      ["row", node("row", { type: "ListBoxItem" })],
    ]);
    const children = new Map<string, CanvasSceneNode[]>([
      ["lb", [elements.get("row")!]],
    ]);

    const info = buildOverflowInfoMap(bounds, elements, children).get("lb");
    expect(info?.overflowType).toBe("auto");
    expect(info?.overflowChildren.map((c) => c.id)).toEqual(["row"]);
  });

  it("sub-pixel 초과는 넘침으로 치지 않는다", () => {
    // 엔진 f32 잔차. 이걸 넘침으로 치면 hover 마다 1px 파란 선이 따라붙는다.
    const bounds = new Map<string, BoundingBox>([
      ["box", { x: 0, y: 0, width: 100, height: 100 }],
      ["hair", { x: 0, y: 0, width: 100.0001, height: 100 }],
      ["real", { x: 0, y: 0, width: 101, height: 100 }],
    ]);
    const elements = new Map<string, CanvasSceneNode>([
      ["box", node("box", { props: { style: { overflow: "hidden" } } })],
      ["hair", node("hair")],
      ["real", node("real")],
    ]);
    const hairOnly = new Map<string, CanvasSceneNode[]>([
      ["box", [elements.get("hair")!]],
    ]);
    expect(buildOverflowInfoMap(bounds, elements, hairOnly).has("box")).toBe(
      false,
    );

    const realOnly = new Map<string, CanvasSceneNode[]>([
      ["box", [elements.get("real")!]],
    ]);
    expect(buildOverflowInfoMap(bounds, elements, realOnly).has("box")).toBe(
      true,
    );
  });

  it("순환 참조에서 멈춘다", () => {
    const bounds = new Map<string, BoundingBox>([
      ["box", { x: 0, y: 0, width: 10, height: 10 }],
      ["a", { x: 0, y: 0, width: 5, height: 5 }],
      ["b", { x: 0, y: 0, width: 5, height: 5 }],
    ]);
    const elements = new Map<string, CanvasSceneNode>([
      ["box", node("box", { props: { style: { overflow: "hidden" } } })],
      ["a", node("a")],
      ["b", node("b")],
    ]);
    const children = new Map<string, CanvasSceneNode[]>([
      ["box", [elements.get("a")!]],
      ["a", [elements.get("b")!]],
      ["b", [elements.get("a")!]],
    ]);

    expect(() =>
      buildOverflowInfoMap(bounds, elements, children),
    ).not.toThrow();
  });
});

describe("getCachedOverflowInfoMap — 스크롤 후 재계산", () => {
  it("treeBoundsMap 참조가 바뀌면 버전이 같아도 다시 만든다", () => {
    // 스크롤은 registryVersion/pagePosVersion 을 올리지 않는다 — 자식 좌표만 이동한
    // 새 treeBoundsMap 이 나온다. 참조를 안 보면 스크롤 전 좌표가 그대로 재사용된다.
    const f = framedPageFixture();
    const first = getCachedOverflowInfoMap(
      f.bounds,
      f.elements,
      f.children,
      1,
      1,
    );
    expect(
      first
        .get("body")!
        .overflowChildren.map((c) => c.id)
        .sort(),
    ).toEqual(["card-2", "card-3", "card-4"]);

    // 스크롤 = 자식 좌표에서 부모 scrollOffset 을 차감한 새 맵 (buildTreeBoundsMap 계약)
    const scrolled = new Map(f.bounds);
    for (const id of f.cardIds) {
      const b = scrolled.get(id)!;
      scrolled.set(id, { ...b, y: b.y - 300 });
    }

    const second = getCachedOverflowInfoMap(
      scrolled,
      f.elements,
      f.children,
      1,
      1,
    );
    expect(second).not.toBe(first);
    const scrolledIds = second
      .get("body")!
      .overflowChildren.map((c) => c.id)
      .sort();
    // 300 올라가면 card-2 가 안으로 들어오고, card-0 이 위쪽으로 빠져나간다
    expect(scrolledIds).toEqual(["card-0", "card-3", "card-4"]);
  });

  it("같은 맵 + 같은 버전이면 재사용한다", () => {
    const f = framedPageFixture();
    const a = getCachedOverflowInfoMap(f.bounds, f.elements, f.children, 7, 7);
    const b = getCachedOverflowInfoMap(f.bounds, f.elements, f.children, 7, 7);
    expect(b).toBe(a);
  });
});
