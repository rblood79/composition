import { describe, expect, it } from "vitest";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import {
  buildFrameTitleRenderItems,
  buildHoverHighlightTargets,
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
        showHatch: true,
        slotMarkerRole: "origin",
      },
      {
        bounds: { x: 0, y: 120, width: 100, height: 40 },
        showHatch: true,
        slotMarkerRole: "origin",
      },
      {
        bounds: { x: 0, y: 180, width: 100, height: 40 },
        showHatch: true,
        slotMarkerRole: "origin",
      },
      {
        bounds: { x: 0, y: 420, width: 100, height: 40 },
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
        showHatch: true,
        slotMarkerRole: "origin",
      },
      {
        bounds: { x: 20, y: 65, width: 70, height: 20 },
        showHatch: true,
        slotMarkerRole: "origin",
      },
      {
        bounds: { x: 30, y: 128, width: 62, height: 24 },
        showHatch: true,
        slotMarkerRole: "origin",
      },
      {
        bounds: { x: 0, y: 180, width: 100, height: 40 },
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
