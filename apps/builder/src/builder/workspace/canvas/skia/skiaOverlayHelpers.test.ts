import { describe, expect, it } from "vitest";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import type { PagePositionPresentationSnapshot } from "../interaction/pagePositionPresentation";
import {
  buildCollectionRemainderTargets,
  buildFrameTitleRenderItems,
  buildHoverHighlightTargets,
  buildPageGuideTargets,
  buildSlotMarkerTargets,
} from "./skiaOverlayHelpers";

function makeElement(
  id: string,
  overrides: Partial<CanvasSceneNode> = {},
): CanvasSceneNode {
  return {
    id,
    type: "Button",
    page_id: "page-1",
    parent_id: "body-1",
    order_num: 1,
    props: {},
    ...overrides,
  } as CanvasSceneNode;
}

describe("buildHoverHighlightTargets clip-aware leaf guidelines", () => {
  /**
   * 스크롤 컨테이너의 자식 가이드라인은 **프레임마다** hit bounds 로 걸러야 한다.
   * hover state 의 hoveredLeafIds 는 구조적(불변) 리스트라 스크롤로 갱신되지 않으므로,
   * 가시성 필터를 hover state 에 캐시하면 스크롤 후에도 이전 가시 집합이 남는다.
   */
  const treeBoundsMap = new Map([
    ["listbox", { x: 0, y: 0, width: 200, height: 100 }],
    ["row-visible", { x: 0, y: 0, width: 200, height: 50 }],
    ["row-clipped", { x: 0, y: 120, width: 200, height: 50 }],
  ]);
  const elementsMap = new Map([
    ["listbox", makeElement("listbox", { type: "ListBox" })],
    ["row-visible", makeElement("row-visible", { parent_id: "listbox" })],
    ["row-clipped", makeElement("row-clipped", { parent_id: "listbox" })],
  ]);

  it("skips leaves that the clip removed and draws visible ones at hit bounds", () => {
    const hitBoundsMap = new Map([
      ["listbox", { x: 0, y: 0, width: 200, height: 100 }],
      // row-visible 은 절반만 보임 / row-clipped 은 전부 잘려 키 자체가 없음
      ["row-visible", { x: 0, y: 0, width: 200, height: 30 }],
    ]);

    const targets = buildHoverHighlightTargets(
      treeBoundsMap,
      "listbox",
      ["row-visible", "row-clipped"],
      true,
      elementsMap,
      [],
      hitBoundsMap,
    );

    expect(targets).toHaveLength(2);
    expect(targets[1]).toEqual(
      expect.objectContaining({
        dashed: true,
        bounds: { x: 0, y: 0, width: 200, height: 30 },
      }),
    );
  });

  it("reveals a leaf once the scroll brings it back into the hit bounds", () => {
    // 같은 hoveredLeafIds 로 다음 프레임 — 스크롤로 row-clipped 이 들어옴
    const scrolledHitBounds = new Map([
      ["listbox", { x: 0, y: 0, width: 200, height: 100 }],
      ["row-clipped", { x: 0, y: 20, width: 200, height: 50 }],
    ]);

    const targets = buildHoverHighlightTargets(
      treeBoundsMap,
      "listbox",
      ["row-visible", "row-clipped"],
      true,
      elementsMap,
      [],
      scrolledHitBounds,
    );

    expect(targets).toHaveLength(2);
    expect(targets[1]).toEqual(
      expect.objectContaining({
        dashed: true,
        bounds: { x: 0, y: 20, width: 200, height: 50 },
      }),
    );
  });

  it("falls back to tree bounds when no hit bounds map is supplied", () => {
    const targets = buildHoverHighlightTargets(
      treeBoundsMap,
      "listbox",
      ["row-visible", "row-clipped"],
      true,
      elementsMap,
    );

    expect(targets).toHaveLength(3);
  });

  it("clips the context outline itself to the visible bounds", () => {
    // 호버한 채로 스크롤해 컨테이너가 프레임 밖으로 밀리면, 실선 아웃라인도
    // 잘려야 한다. 원본 박스를 쓰면 프레임 밖 캔버스에 아웃라인이 남는다.
    const targets = buildHoverHighlightTargets(
      treeBoundsMap,
      "listbox",
      [],
      false,
      elementsMap,
      [],
      new Map([["listbox", { x: 0, y: 0, width: 200, height: 40 }]]),
    );

    expect(targets).toEqual([
      expect.objectContaining({
        dashed: false,
        bounds: { x: 0, y: 0, width: 200, height: 40 },
      }),
    ]);
  });

  it("drops the context outline when the context is fully clipped away", () => {
    expect(
      buildHoverHighlightTargets(
        treeBoundsMap,
        "listbox",
        [],
        false,
        elementsMap,
        [],
        new Map(),
      ),
    ).toEqual([]);
  });

  it("keeps the page body fallback outline (body 는 hit 맵에 없어도 프레임 경계 사용)", () => {
    const bodyElements = new Map([
      ["page-body", makeElement("page-body", { type: "body" })],
    ]);

    expect(
      buildHoverHighlightTargets(
        new Map(),
        "page-body",
        [],
        false,
        bodyElements,
        [{ id: "page-1", x: 10, y: 20, width: 390, height: 844 }],
        new Map(),
      ),
    ).toEqual([
      expect.objectContaining({
        dashed: false,
        bounds: { x: 10, y: 20, width: 390, height: 844 },
      }),
    ]);
  });
});

describe("buildHoverHighlightTargets editing semantics", () => {
  it("marks origin and instance hover targets with semantic roles", () => {
    const targets = buildHoverHighlightTargets(
      new Map([
        ["origin", { x: 0, y: 0, width: 100, height: 40 }],
        ["instance", { x: 120, y: 0, width: 100, height: 40 }],
      ]),
      "origin",
      ["instance"],
      true,
      new Map([
        ["origin", makeElement("origin", { reusable: true })],
        ["instance", makeElement("instance", { type: "ref", ref: "origin" })],
      ]),
    );

    expect(targets).toEqual([
      expect.objectContaining({
        dashed: false,
        semanticRole: "origin",
        slotMarkerRole: null,
      }),
      expect.objectContaining({
        dashed: true,
        semanticRole: "instance",
        slotMarkerRole: null,
      }),
    ]);
  });

  it("keeps default hover role for plain elements", () => {
    const targets = buildHoverHighlightTargets(
      new Map([["plain", { x: 0, y: 0, width: 100, height: 40 }]]),
      "plain",
      [],
      false,
      new Map([["plain", makeElement("plain")]]),
    );

    expect(targets).toEqual([
      expect.objectContaining({
        dashed: false,
        semanticRole: null,
        slotMarkerRole: null,
      }),
    ]);
  });

  it("uses visible page frame bounds for page body hover when tree bounds are absent", () => {
    const targets = buildHoverHighlightTargets(
      new Map(),
      "page-body",
      [],
      false,
      new Map([
        [
          "page-body",
          makeElement("page-body", { page_id: "page-1", type: "body" }),
        ],
      ]),
      [
        {
          id: "page-1",
          title: "Home",
          x: 10,
          y: 20,
          width: 320,
          height: 200,
          elementCount: 0,
        },
      ],
    );

    expect(targets).toEqual([
      expect.objectContaining({
        bounds: { x: 10, y: 20, width: 320, height: 200 },
        dashed: false,
        semanticRole: null,
        slotMarkerRole: null,
      }),
    ]);
  });

  it("marks slot hover targets with origin and instance slot roles", () => {
    const origin = makeElement("origin", {
      parent_id: null,
      reusable: true,
      type: "frame",
    });
    const originSlot = makeElement("origin/footer", {
      parent_id: "origin",
      slot: ["text"],
      type: "CardFooter",
    });
    const instance = makeElement("instance", {
      type: "ref",
      ref: "origin",
    });
    const instanceSlot = makeElement("instance/footer", {
      parent_id: "instance",
      slot: ["text"],
      type: "CardFooter",
    });

    const targets = buildHoverHighlightTargets(
      new Map([
        ["origin/footer", { x: 0, y: 0, width: 100, height: 40 }],
        ["instance/footer", { x: 120, y: 0, width: 100, height: 40 }],
      ]),
      "origin/footer",
      ["instance/footer"],
      true,
      new Map([
        ["origin", origin],
        ["origin/footer", originSlot],
        ["instance", instance],
        ["instance/footer", instanceSlot],
      ]),
    );

    expect(targets).toEqual([
      expect.objectContaining({
        semanticRole: null,
        slotMarkerRole: "origin",
      }),
      expect.objectContaining({
        semanticRole: null,
        slotMarkerRole: "instance",
      }),
    ]);
  });

  it("marks visible legacy Slot hover targets as origin slot authoring chrome", () => {
    const targets = buildHoverHighlightTargets(
      new Map([["slot-header", { x: 0, y: 0, width: 100, height: 40 }]]),
      "slot-header",
      [],
      false,
      new Map([
        [
          "slot-header",
          makeElement("slot-header", {
            parent_id: "frame-body",
            props: { name: "header" },
            type: "Slot",
          }),
        ],
      ]),
    );

    expect(targets).toEqual([
      expect.objectContaining({
        semanticRole: null,
        slotMarkerRole: "origin",
      }),
    ]);
  });
});

describe("buildSlotMarkerTargets", () => {
  it("emits authoring chrome only for empty slots; filled slots get no marker (hatch nor border)", () => {
    const targets = buildSlotMarkerTargets(
      new Map([
        ["slot-header", { x: 0, y: 0, width: 100, height: 40 }],
        ["slot-filled", { x: 0, y: 60, width: 100, height: 40 }],
        ["slot-with-deleted-child", { x: 0, y: 120, width: 100, height: 40 }],
        ["card-footer", { x: 0, y: 180, width: 100, height: 40 }],
        ["card-content-filled", { x: 0, y: 240, width: 100, height: 40 }],
        ["page-slot-filled", { x: 0, y: 300, width: 100, height: 40 }],
        ["slot-hidden", { x: 0, y: 360, width: 100, height: 40 }],
        ["page-slot-hidden-visible", { x: 0, y: 420, width: 100, height: 40 }],
        [
          "page-slot-hidden-visible-filled",
          { x: 0, y: 480, width: 100, height: 40 },
        ],
        ["plain", { x: 0, y: 540, width: 100, height: 40 }],
      ]),
      new Map([
        [
          "slot-header",
          makeElement("slot-header", {
            props: { name: "header" },
            type: "Slot",
          }),
        ],
        [
          "slot-filled",
          makeElement("slot-filled", {
            props: { name: "content" },
            type: "Slot",
          }),
        ],
        [
          "slot-filled-child",
          makeElement("slot-filled-child", {
            parent_id: "slot-filled",
            type: "Text",
          }),
        ],
        [
          "slot-with-deleted-child",
          makeElement("slot-with-deleted-child", {
            props: { name: "sidebar" },
            type: "Slot",
          }),
        ],
        [
          "deleted-slot-child",
          makeElement("deleted-slot-child", {
            deleted: true,
            parent_id: "slot-with-deleted-child",
            type: "Text",
          }),
        ],
        [
          "card-footer",
          makeElement("card-footer", {
            slot: ["recommended-text"],
            type: "CardFooter",
          }),
        ],
        [
          "card-content-filled",
          makeElement("card-content-filled", {
            slot: ["recommended-text"],
            type: "CardContent",
          }),
        ],
        [
          "card-content-child",
          makeElement("card-content-child", {
            parent_id: "card-content-filled",
            type: "Text",
          }),
        ],
        [
          "page-slot-filled",
          makeElement("page-slot-filled", {
            props: { name: "content" },
            type: "Slot",
          }),
        ],
        [
          "page-content",
          makeElement("page-content", {
            parent_id: "page-body",
            type: "Text",
          }),
        ],
        [
          "slot-hidden",
          makeElement("slot-hidden", {
            props: { _slotChrome: "hidden", name: "content" },
            type: "Slot",
          }),
        ],
        [
          "page-slot-hidden-visible",
          makeElement("page-slot-hidden-visible", {
            props: {
              _slotChrome: "hidden",
              _slotMarkerChrome: "visible",
              name: "content",
            },
            type: "Slot",
          }),
        ],
        [
          "page-slot-hidden-visible-filled",
          makeElement("page-slot-hidden-visible-filled", {
            props: {
              _slotChrome: "hidden",
              _slotMarkerChrome: "visible",
              name: "content",
            },
            type: "Slot",
          }),
        ],
        [
          "page-slot-hidden-visible-child",
          makeElement("page-slot-hidden-visible-child", {
            parent_id: "page-slot-hidden-visible-filled",
            type: "Text",
          }),
        ],
        ["plain", makeElement("plain")],
      ]),
      new Map([
        [
          "page-slot-filled",
          [
            makeElement("page-content", {
              parent_id: "page-body",
              type: "Text",
            }),
          ],
        ],
        [
          "page-slot-hidden-visible-filled",
          [
            makeElement("page-slot-hidden-visible-child", {
              parent_id: "page-slot-hidden-visible-filled",
              type: "Text",
            }),
          ],
        ],
      ]),
    );

    // 빈 slot 만 authoring chrome(hatch+border) 을 emit 한다. content(자식/projection row)이
    // 있는 slot 은 marker target 자체가 생성되지 않는다 → row child 위에 사선/테두리 중복 표시 방지.
    // 제거 대상(이전 showHatch:false 들): slot-filled(y60) / card-content-filled(y240) /
    //   page-slot-filled(y300) / page-slot-hidden-visible-filled(y480).
    expect(targets).toEqual([
      {
        bounds: { x: 0, y: 0, width: 100, height: 40 },
        pageId: "page-1",
        showHatch: true,
        slotMarkerRole: "origin",
      },
      {
        bounds: { x: 0, y: 120, width: 100, height: 40 },
        pageId: "page-1",
        showHatch: true,
        slotMarkerRole: "origin",
      },
      {
        bounds: { x: 0, y: 180, width: 100, height: 40 },
        pageId: "page-1",
        showHatch: true,
        slotMarkerRole: "origin",
      },
      {
        bounds: { x: 0, y: 420, width: 100, height: 40 },
        pageId: "page-1",
        showHatch: true,
        slotMarkerRole: "origin",
      },
    ]);
  });

  it("treats a slot whose only child is a ListBox template anchor as empty (instance shows hatch like origin)", () => {
    // 빈 ListBox instance 는 itemsLen 0 이어도 항상 template anchor child 를 가진다.
    // template anchor 는 실제 data row 가 아니라 템플릿이므로 content 로 카운트하면 안 된다 →
    // origin(자식 0개) 과 동일하게 빈 slot 으로 간주되어 hatch+border 어포던스를 emit 해야 한다.
    const targets = buildSlotMarkerTargets(
      new Map([["instance-listbox", { x: 0, y: 0, width: 200, height: 40 }]]),
      new Map([
        [
          "instance-listbox",
          makeElement("instance-listbox", {
            type: "ListBox",
            ref: "component-listbox",
            slot: ["items"],
          }),
        ],
        [
          "template-anchor",
          makeElement("template-anchor", {
            parent_id: "instance-listbox",
            type: "ListBoxItem",
            ref: "component-listbox-item-default",
            metadata: {
              type: "ref",
              templateRole: "listbox-item-template-anchor",
            },
          }),
        ],
      ]),
      new Map(),
    );

    // bounds 는 ListBox 기본 padding(spec containerStyles fallback, 4px) 만큼 inset 된다.
    expect(targets).toEqual([
      {
        bounds: { x: 4, y: 4, width: 192, height: 32 },
        pageId: "page-1",
        showHatch: true,
        slotMarkerRole: "instance",
      },
    ]);
  });

  it("still treats a slot with a real (non-template) child as filled (no marker)", () => {
    const targets = buildSlotMarkerTargets(
      new Map([["instance-listbox", { x: 0, y: 0, width: 200, height: 40 }]]),
      new Map([
        [
          "instance-listbox",
          makeElement("instance-listbox", {
            type: "ListBox",
            ref: "component-listbox",
            slot: ["items"],
          }),
        ],
        [
          "real-row",
          makeElement("real-row", {
            parent_id: "instance-listbox",
            type: "ListBoxItem",
          }),
        ],
      ]),
      new Map(),
    );

    expect(targets).toEqual([]);
  });

  it("insets slot marker bounds by element padding so hatch + border stay in the content-box", () => {
    const targets = buildSlotMarkerTargets(
      new Map([
        ["slot-shorthand", { x: 0, y: 0, width: 100, height: 40 }],
        ["slot-longhand", { x: 0, y: 60, width: 100, height: 40 }],
        ["slot-longhand-override", { x: 0, y: 120, width: 100, height: 40 }],
        ["slot-no-padding", { x: 0, y: 180, width: 100, height: 40 }],
      ]),
      new Map([
        [
          "slot-shorthand",
          makeElement("slot-shorthand", {
            props: { name: "content", style: { padding: 12 } },
            type: "Slot",
          }),
        ],
        [
          "slot-longhand",
          makeElement("slot-longhand", {
            props: {
              name: "content",
              style: {
                paddingTop: 5,
                paddingRight: 10,
                paddingBottom: 15,
                paddingLeft: 20,
              },
            },
            type: "Slot",
          }),
        ],
        [
          "slot-longhand-override",
          makeElement("slot-longhand-override", {
            // padding shorthand 8px + paddingLeft longhand 30 override
            props: {
              name: "content",
              style: { padding: "8px", paddingLeft: 30 },
            },
            type: "Slot",
          }),
        ],
        [
          "slot-no-padding",
          makeElement("slot-no-padding", {
            props: { name: "content" },
            type: "Slot",
          }),
        ],
      ]),
      new Map(),
    );

    expect(targets).toEqual([
      {
        bounds: { x: 12, y: 12, width: 76, height: 16 },
        pageId: "page-1",
        showHatch: true,
        slotMarkerRole: "origin",
      },
      {
        bounds: { x: 20, y: 65, width: 70, height: 20 },
        pageId: "page-1",
        showHatch: true,
        slotMarkerRole: "origin",
      },
      {
        bounds: { x: 30, y: 128, width: 62, height: 24 },
        pageId: "page-1",
        showHatch: true,
        slotMarkerRole: "origin",
      },
      {
        bounds: { x: 0, y: 180, width: 100, height: 40 },
        pageId: "page-1",
        showHatch: true,
        slotMarkerRole: "origin",
      },
    ]);
  });

  it("falls back to spec containerStyles padding for collection containers without explicit style padding (ListBox origin)", () => {
    // ListBox origin (createInitialProjectDocument → ensureListBoxTemplateOrigins):
    // reusable + slot 배열 → slot marker target. padding 은 element.props.style 이
    // 아니라 ListBoxSpec.containerStyles.padding = {spacing.xs} = 4 에만 존재.
    // resolveContainerStylesFallback 으로 layout 과 동일하게 4 를 resolve → 4-way inset.
    const targets = buildSlotMarkerTargets(
      new Map([["listbox-origin", { x: 0, y: 0, width: 100, height: 40 }]]),
      new Map([
        [
          "listbox-origin",
          makeElement("listbox-origin", {
            props: {},
            reusable: true,
            slot: ["listbox-item/default", "listbox-item/selected"],
            type: "ListBox",
          }),
        ],
      ]),
      new Map(),
    );

    expect(targets).toEqual([
      {
        bounds: { x: 4, y: 4, width: 92, height: 32 },
        pageId: "page-1",
        showHatch: true,
        slotMarkerRole: "origin",
      },
    ]);
  });

  it("keeps explicit style padding priority over spec containerStyles fallback (ListBox)", () => {
    // 사용자가 inspector 에서 padding 을 명시하면 spec fallback 보다 우선.
    const targets = buildSlotMarkerTargets(
      new Map([["listbox-origin", { x: 0, y: 0, width: 100, height: 40 }]]),
      new Map([
        [
          "listbox-origin",
          makeElement("listbox-origin", {
            props: { style: { padding: 10 } },
            reusable: true,
            slot: ["listbox-item/default"],
            type: "ListBox",
          }),
        ],
      ]),
      new Map(),
    );

    expect(targets).toEqual([
      {
        bounds: { x: 10, y: 10, width: 80, height: 20 },
        pageId: "page-1",
        showHatch: true,
        slotMarkerRole: "origin",
      },
    ]);
  });
});

describe("slot / remainder chrome 은 조상 clip 을 따른다", () => {
  // 오버레이 패스는 씬 clip save/restore 밖에서 돌고 renderSlotHatchPattern 은 자기
  // bounds 로만 clipRect 를 건다. 원본 박스를 넘기면 page body(overflow:auto) 를 스크롤해
  // 프레임 밖으로 나간 ListBox/GridList 해치가 캔버스 배경 위에 그대로 그려진다.
  const slotElements = new Map([
    [
      "slot-header",
      makeElement("slot-header", { props: { name: "header" }, type: "Slot" }),
    ],
  ]);

  function remainderElements() {
    return new Map([
      [
        "remainder",
        makeElement("remainder", {
          projection: { kind: "collection-remainder", hiddenRows: 7 },
          type: "Box",
        } as Partial<CanvasSceneNode>),
      ],
    ]);
  }

  it("clips slot marker chrome to the visible (hit) bounds", () => {
    const targets = buildSlotMarkerTargets(
      new Map([["slot-header", { x: 0, y: 0, width: 100, height: 40 }]]),
      slotElements,
      new Map(),
      // 조상이 아래 15px 를 잘라낸 상태
      new Map([["slot-header", { x: 0, y: 0, width: 100, height: 25 }]]),
    );

    expect(targets).toEqual([
      {
        bounds: { x: 0, y: 0, width: 100, height: 25 },
        pageId: "page-1",
        showHatch: true,
        slotMarkerRole: "origin",
      },
    ]);
  });

  it("drops slot marker chrome when the element is fully clipped away", () => {
    expect(
      buildSlotMarkerTargets(
        new Map([["slot-header", { x: 0, y: 0, width: 100, height: 40 }]]),
        slotElements,
        new Map(),
        new Map(),
      ),
    ).toEqual([]);
  });

  it("clips collection remainder chrome to the visible (hit) bounds", () => {
    const targets = buildCollectionRemainderTargets(
      new Map([["remainder", { x: 10, y: 100, width: 200, height: 80 }]]),
      remainderElements(),
      new Map([["remainder", { x: 10, y: 100, width: 200, height: 30 }]]),
    );

    expect(targets).toEqual([
      {
        bounds: { x: 10, y: 100, width: 200, height: 30 },
        hiddenRows: 7,
        pageId: "page-1",
      },
    ]);
  });

  it("drops collection remainder chrome when fully clipped away", () => {
    expect(
      buildCollectionRemainderTargets(
        new Map([["remainder", { x: 10, y: 100, width: 200, height: 80 }]]),
        remainderElements(),
        new Map(),
      ),
    ).toEqual([]);
  });

  it("keeps chrome unchanged when no hit bounds map is supplied (기존 호출 호환)", () => {
    expect(
      buildSlotMarkerTargets(
        new Map([["slot-header", { x: 0, y: 0, width: 100, height: 40 }]]),
        slotElements,
        new Map(),
      ),
    ).toEqual([
      {
        bounds: { x: 0, y: 0, width: 100, height: 40 },
        pageId: "page-1",
        showHatch: true,
        slotMarkerRole: "origin",
      },
    ]);
  });
});

describe("slot / remainder chrome 은 페이지 드래그 transient 위치를 따른다", () => {
  // boundsMap 은 스트림 빌드 시점(canonical pagePositions) 좌표라 드래그 중 stale 하다.
  // content/selection 은 렌더 시점 delta 를 받으므로, 콘텐츠성 chrome 도 같은 delta 를
  // 받아야 슬롯 해치가 드래그 중 제자리에 남지 않는다 (2026-08-11 사용자 보고).
  const dragSnapshot: PagePositionPresentationSnapshot = {
    canonical: { "page-1": { x: 100, y: 200 } },
    activeOverrides: new Map([["page-1", { x: 130, y: 250 }]]), // delta = (+30, +50)
    version: 1,
    isActive: true,
    startBreakpoint: "desktop",
  };
  const slotElements = new Map([
    [
      "slot-header",
      makeElement("slot-header", { props: { name: "header" }, type: "Slot" }),
    ],
    [
      "slot-other-page",
      makeElement("slot-other-page", {
        page_id: "page-2",
        props: { name: "header" },
        type: "Slot",
      }),
    ],
  ]);

  it("shifts slot marker chrome on the dragged page by the transient delta; other pages stay put", () => {
    const targets = buildSlotMarkerTargets(
      new Map([
        ["slot-header", { x: 0, y: 0, width: 100, height: 40 }],
        ["slot-other-page", { x: 500, y: 0, width: 100, height: 40 }],
      ]),
      slotElements,
      new Map(),
      undefined,
      dragSnapshot,
    );

    expect(targets).toEqual([
      {
        bounds: { x: 30, y: 50, width: 100, height: 40 },
        pageId: "page-1",
        showHatch: true,
        slotMarkerRole: "origin",
      },
      {
        bounds: { x: 500, y: 0, width: 100, height: 40 },
        pageId: "page-2",
        showHatch: true,
        slotMarkerRole: "origin",
      },
    ]);
  });

  it("translates after the visible-bounds clip (clip 수식은 canonical 좌표계에서 종결)", () => {
    const targets = buildSlotMarkerTargets(
      new Map([["slot-header", { x: 0, y: 0, width: 100, height: 40 }]]),
      slotElements,
      new Map(),
      new Map([["slot-header", { x: 0, y: 0, width: 100, height: 25 }]]),
      dragSnapshot,
    );

    expect(targets).toEqual([
      {
        bounds: { x: 30, y: 50, width: 100, height: 25 },
        pageId: "page-1",
        showHatch: true,
        slotMarkerRole: "origin",
      },
    ]);
  });

  it("shifts collection remainder chrome by the same delta", () => {
    const targets = buildCollectionRemainderTargets(
      new Map([["remainder", { x: 10, y: 100, width: 200, height: 80 }]]),
      new Map([
        [
          "remainder",
          makeElement("remainder", {
            projection: { kind: "collection-remainder", hiddenRows: 7 },
            type: "Box",
          } as Partial<CanvasSceneNode>),
        ],
      ]),
      undefined,
      dragSnapshot,
    );

    expect(targets).toEqual([
      {
        bounds: { x: 40, y: 150, width: 200, height: 80 },
        hiddenRows: 7,
        pageId: "page-1",
      },
    ]);
  });

  it("keeps chrome unchanged when the presentation is inactive", () => {
    const targets = buildSlotMarkerTargets(
      new Map([["slot-header", { x: 0, y: 0, width: 100, height: 40 }]]),
      slotElements,
      new Map(),
      undefined,
      { ...dragSnapshot, isActive: false },
    );

    expect(targets).toEqual([
      {
        bounds: { x: 0, y: 0, width: 100, height: 40 },
        pageId: "page-1",
        showHatch: true,
        slotMarkerRole: "origin",
      },
    ]);
  });
});

describe("buildFrameTitleRenderItems", () => {
  it("builds Pencil-style frame labels from multi-frame areas", () => {
    const items = buildFrameTitleRenderItems(
      [
        {
          frameId: "frame-a",
          frameName: "Checkout",
          x: 100,
          y: 200,
          width: 1440,
          height: 900,
        },
        {
          frameId: "frame-b",
          frameName: "Settings",
          x: 1600,
          y: 200,
          width: 1440,
          height: 900,
        },
      ],
      "frame-b",
    );

    expect(items).toEqual([
      {
        frameId: "frame-a",
        title: "Checkout",
        x: 100,
        y: 200,
        highlighted: false,
      },
      {
        frameId: "frame-b",
        title: "Settings",
        x: 1600,
        y: 200,
        highlighted: true,
      },
    ]);
  });
});

describe("buildPageGuideTargets — 수동 가이드 좌표 변환 (ADR-181 Phase 4)", () => {
  const FRAMES = [
    { id: "page-1", x: 100, y: 200, width: 390, height: 844 },
    { id: "page-2", x: 600, y: 200, width: 390, height: 844 },
  ];

  it("페이지-로컬 position 을 scene 으로 옮긴다 (축별로 더하는 원점이 다르다)", () => {
    const targets = buildPageGuideTargets(
      new Map([
        [
          "page-1",
          [
            { id: "gx", axis: "x" as const, position: 40 },
            { id: "gy", axis: "y" as const, position: 120 },
          ],
        ],
      ]),
      FRAMES,
    );

    expect(targets).toEqual([
      {
        pageId: "page-1",
        pageRect: { x: 100, y: 200, width: 390, height: 844 },
        lines: [
          { id: "gx", axis: "x", position: 140 }, // 100 + 40
          { id: "gy", axis: "y", position: 320 }, // 200 + 120
        ],
      },
    ]);
  });

  it("드래그 중 페이지의 transient delta 를 따른다 (본문과 같이 움직인다)", () => {
    const dragSnapshot: PagePositionPresentationSnapshot = {
      canonical: { "page-1": { x: 100, y: 200 } },
      activeOverrides: new Map([["page-1", { x: 130, y: 250 }]]), // +30, +50
      version: 1,
      isActive: true,
      startBreakpoint: "desktop",
    };
    const targets = buildPageGuideTargets(
      new Map([
        ["page-1", [{ id: "gx", axis: "x" as const, position: 40 }]],
        ["page-2", [{ id: "gx", axis: "x" as const, position: 40 }]],
      ]),
      FRAMES,
      dragSnapshot,
    );

    // 드래그 중인 페이지만 이동 — rect 와 선이 같은 delta 를 받는다
    expect(targets[0].pageRect).toEqual({
      x: 130,
      y: 250,
      width: 390,
      height: 844,
    });
    expect(targets[0].lines[0].position).toBe(170);
    expect(targets[1].pageRect.x).toBe(600);
    expect(targets[1].lines[0].position).toBe(640);
  });

  it("가이드 없는 페이지·빈 목록은 타깃을 만들지 않는다", () => {
    expect(buildPageGuideTargets(new Map(), FRAMES)).toEqual([]);
    expect(
      buildPageGuideTargets(new Map([["page-2", []]]), FRAMES),
    ).toEqual([]);
  });

  it("보이는 프레임에 없는 pageId 는 건너뛴다 (삭제·비가시 페이지)", () => {
    const targets = buildPageGuideTargets(
      new Map([["page-gone", [{ id: "gz", axis: "x" as const, position: 10 }]]]),
      FRAMES,
    );
    expect(targets).toEqual([]);
  });
});
