// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  withFrameElementMirrorId,
  withPageFrameBinding,
} from "../../../../adapters/canonical/frameMirror";
import { withSlotMirrorName } from "../../../../adapters/canonical/slotMirror";
import type { Element, Page } from "../../../../types/core/store.types";

import {
  resolvePageWithFrame,
  toPageFrameElementId,
} from "./resolvePageWithFrame";

type TestElementPartial = Partial<Element> & {
  frameId?: string | null;
  id: string;
  propsSlotMirrorName?: string | null;
  slotMirrorName?: string | null;
  type: string;
};

const makeEl = (partial: TestElementPartial): Element => {
  const { frameId, propsSlotMirrorName, slotMirrorName, ...element } = partial;
  let row = {
    props: {},
    ...element,
  } as Element;

  if (propsSlotMirrorName !== undefined) {
    row = {
      ...row,
      props: withSlotMirrorName(row.props ?? {}, propsSlotMirrorName),
    };
  }
  if (slotMirrorName !== undefined) {
    row = withSlotMirrorName(row, slotMirrorName);
  }

  return frameId === undefined ? row : withFrameElementMirrorId(row, frameId);
};

const makePage = (partial: Partial<Page> & { id: string }): Page => ({
  title: "Home",
  project_id: "proj-1",
  slug: "home",
  ...partial,
});

const makeFramePage = (
  frameId: string | null,
  partial: Partial<Page> & { id: string },
): Page => withPageFrameBinding(makePage(partial), frameId);

const buildElementsMap = (els: Element[]): Map<string, Element> =>
  new Map(els.map((el) => [el.id, el]));

describe("ADR-911 P3-θ resolvePageWithFrame", () => {
  it("frame mirror 미바인딩 page → 기존 동작 (body + nonBody, hasFrameBinding=false)", () => {
    const pageBody = makeEl({
      id: "page-body",
      type: "body",
      page_id: "page-1",
      order_num: 0,
    });
    const button = makeEl({
      id: "btn",
      type: "Button",
      page_id: "page-1",
      parent_id: "page-body",
      order_num: 1,
    });
    const elementsMap = buildElementsMap([pageBody, button]);

    const result = resolvePageWithFrame({
      page: makePage({ id: "page-1" }),
      pageElements: [pageBody, button],
      elementsMap,
    });

    expect(result.hasFrameBinding).toBe(false);
    expect(result.bodyElement?.id).toBe("page-body");
    expect(result.pageElements.map((el) => el.id)).toEqual(["btn"]);
  });

  it("frame mirror 미바인딩 page 는 page-scoped frame projection 을 body 후보에서 제외한다", () => {
    const projectedFrameBody = makeEl({
      id: "frame-body",
      type: "body",
      frameId: "frame-1",
      page_id: "page-1",
      order_num: 0,
    });
    const pageBody = makeEl({
      id: "page-body",
      type: "body",
      page_id: "page-1",
      order_num: 0,
    });
    const projectedSlot = makeEl({
      id: "slot-content",
      type: "Slot",
      frameId: "frame-1",
      page_id: "page-1",
      parent_id: "frame-body",
      order_num: 1,
    });
    const pageCard = makeEl({
      id: "page-card",
      type: "Card",
      page_id: "page-1",
      parent_id: "page-body",
      order_num: 2,
    });
    const elementsMap = buildElementsMap([
      projectedFrameBody,
      pageBody,
      projectedSlot,
      pageCard,
    ]);

    const result = resolvePageWithFrame({
      page: makePage({ id: "page-1" }),
      pageElements: [projectedFrameBody, pageBody, projectedSlot, pageCard],
      elementsMap,
    });

    expect(result.hasFrameBinding).toBe(false);
    expect(result.bodyElement?.id).toBe("page-body");
    expect(result.pageElements.map((el) => el.id)).toEqual(["page-card"]);
  });

  it("frame mirror 바인딩 but frame body 미존재 → page only fallback", () => {
    const pageBody = makeEl({
      id: "page-body",
      type: "body",
      page_id: "page-1",
    });
    const button = makeEl({
      id: "btn",
      type: "Button",
      page_id: "page-1",
      parent_id: "page-body",
      order_num: 1,
    });
    const elementsMap = buildElementsMap([pageBody, button]);

    const result = resolvePageWithFrame({
      page: makeFramePage("missing-frame", { id: "page-1" }),
      pageElements: [pageBody, button],
      elementsMap,
    });

    expect(result.hasFrameBinding).toBe(false);
    expect(result.bodyElement?.id).toBe("page-body");
    expect(result.pageElements.map((el) => el.id)).toEqual(["btn"]);
  });

  describe("T2 — frame body + slot 구조 inline 노출 (page slot fill 없음)", () => {
    const FRAME_ID = "frame-9dd9946f";
    const frameBody = makeEl({
      id: "frame-body",
      type: "body",
      frameId: FRAME_ID,
      page_id: null,
      order_num: 0,
    });
    const slotHeader = makeEl({
      id: "slot-header",
      type: "Slot",
      frameId: FRAME_ID,
      page_id: null,
      parent_id: "frame-body",
      order_num: 0,
      props: { name: "header" },
    });
    const slotContent = makeEl({
      id: "slot-content",
      type: "Slot",
      frameId: FRAME_ID,
      page_id: null,
      parent_id: "frame-body",
      order_num: 1,
      props: { name: "content" },
    });
    const slotFooter = makeEl({
      id: "slot-footer",
      type: "Slot",
      frameId: FRAME_ID,
      page_id: null,
      parent_id: "frame-body",
      order_num: 2,
      props: { name: "footer" },
    });
    const textHeader = makeEl({
      id: "text-header",
      type: "Text",
      frameId: FRAME_ID,
      page_id: null,
      parent_id: "slot-header",
      order_num: 0,
    });
    const textFooter = makeEl({
      id: "text-footer",
      type: "Text",
      frameId: FRAME_ID,
      page_id: null,
      parent_id: "slot-footer",
      order_num: 0,
    });
    const pageBody = makeEl({
      id: "page-body",
      type: "body",
      page_id: "page-1",
    });

    const allElements = [
      frameBody,
      slotHeader,
      slotContent,
      slotFooter,
      textHeader,
      textFooter,
      pageBody,
    ];

    it("page body 가 root 유지, frame slot 들이 page body 자식으로 reparent + default text 노출", () => {
      const elementsMap = buildElementsMap(allElements);

      const result = resolvePageWithFrame({
        page: makeFramePage(FRAME_ID, { id: "page-1" }),
        pageElements: [pageBody],
        elementsMap,
      });

      expect(result.hasFrameBinding).toBe(true);
      expect(result.bodyElement?.id).toBe("page-body");
      const scoped = (id: string) => toPageFrameElementId("page-1", id);

      const ids = new Set(result.pageElements.map((el) => el.id));
      expect(ids).toEqual(
        new Set([
          scoped("slot-header"),
          scoped("slot-content"),
          scoped("slot-footer"),
          scoped("text-header"),
          scoped("text-footer"),
        ]),
      );

      const reparentedSlotHeader = result.pageElements.find(
        (el) => el.id === scoped("slot-header"),
      );
      const reparentedSlotContent = result.pageElements.find(
        (el) => el.id === scoped("slot-content"),
      );
      const reparentedSlotFooter = result.pageElements.find(
        (el) => el.id === scoped("slot-footer"),
      );
      expect(reparentedSlotHeader?.parent_id).toBe("page-body");
      expect(reparentedSlotContent?.parent_id).toBe("page-body");
      expect(reparentedSlotFooter?.parent_id).toBe("page-body");
      expect(reparentedSlotHeader?.props?._slotChrome).toBe("hidden");
      expect(reparentedSlotContent?.props?._slotChrome).toBe("hidden");
      expect(reparentedSlotFooter?.props?._slotChrome).toBe("hidden");
      expect(reparentedSlotHeader?.props?._slotMarkerChrome).toBe("visible");
      expect(reparentedSlotContent?.props?._slotMarkerChrome).toBe("visible");
      expect(reparentedSlotFooter?.props?._slotMarkerChrome).toBe("visible");

      const textInHeader = result.pageElements.find(
        (el) => el.id === scoped("text-header"),
      );
      expect(textInHeader?.parent_id).toBe(scoped("slot-header"));
    });

    it("refresh hydrate 로 page body 와 page-scoped frame body/slot 을 함께 복원한다", () => {
      const hydratedPageBody = makeEl({
        id: "page-body",
        type: "body",
        page_id: "page-1",
        order_num: 0,
      });
      const hydratedFrameBody = makeEl({
        id: "frame-body",
        type: "body",
        frameId: FRAME_ID,
        page_id: "page-1",
        order_num: 0,
      });
      const hydratedSlotContent = makeEl({
        id: "slot-content",
        type: "Slot",
        frameId: FRAME_ID,
        page_id: "page-1",
        parent_id: "frame-body",
        order_num: 1,
        props: { name: "content" },
      });
      const hydratedText = makeEl({
        id: "text-content",
        type: "Text",
        frameId: FRAME_ID,
        page_id: "page-1",
        parent_id: "slot-content",
        order_num: 0,
      });
      const elementsMap = buildElementsMap([
        hydratedPageBody,
        hydratedFrameBody,
        hydratedSlotContent,
        hydratedText,
      ]);

      const result = resolvePageWithFrame({
        page: makeFramePage(FRAME_ID, { id: "page-1" }),
        pageElements: [
          hydratedPageBody,
          hydratedFrameBody,
          hydratedSlotContent,
          hydratedText,
        ],
        elementsMap,
      });

      const scoped = (id: string) => toPageFrameElementId("page-1", id);
      expect(result.hasFrameBinding).toBe(true);
      expect(result.bodyElement?.id).toBe("page-body");
      expect(new Set(result.pageElements.map((el) => el.id))).toEqual(
        new Set([scoped("slot-content"), scoped("text-content")]),
      );

      const slotContent = result.pageElements.find(
        (el) => el.id === scoped("slot-content"),
      );
      expect(slotContent?.parent_id).toBe("page-body");
      expect(slotContent?.props?._slotChrome).toBe("hidden");
      expect(slotContent?.props?._slotMarkerChrome).toBe("visible");
    });
  });

  describe("T3 — page slot:content fill (frame default content 의 자식 hide)", () => {
    const FRAME_ID = "frame-9dd9946f";
    const frameBody = makeEl({
      id: "frame-body",
      type: "body",
      frameId: FRAME_ID,
      page_id: null,
    });
    const slotHeader = makeEl({
      id: "slot-header",
      type: "Slot",
      frameId: FRAME_ID,
      page_id: null,
      parent_id: "frame-body",
      order_num: 0,
      props: { name: "header" },
    });
    const slotContent = makeEl({
      id: "slot-content",
      type: "Slot",
      frameId: FRAME_ID,
      page_id: null,
      parent_id: "frame-body",
      order_num: 1,
      props: { name: "content" },
    });
    const slotFooter = makeEl({
      id: "slot-footer",
      type: "Slot",
      frameId: FRAME_ID,
      page_id: null,
      parent_id: "frame-body",
      order_num: 2,
      props: { name: "footer" },
    });
    const textHeader = makeEl({
      id: "text-header",
      type: "Text",
      frameId: FRAME_ID,
      page_id: null,
      parent_id: "slot-header",
    });
    const textFooter = makeEl({
      id: "text-footer",
      type: "Text",
      frameId: FRAME_ID,
      page_id: null,
      parent_id: "slot-footer",
    });
    const defaultContentText = makeEl({
      id: "default-content-text",
      type: "Text",
      frameId: FRAME_ID,
      page_id: null,
      parent_id: "slot-content",
    });

    const pageBody = makeEl({
      id: "page-body",
      type: "body",
      page_id: "page-1",
    });
    const pageCustom = makeEl({
      id: "page-custom",
      type: "Card",
      page_id: "page-1",
      parent_id: "page-body",
      order_num: 0,
      propsSlotMirrorName: "content",
    });

    const allElements = [
      frameBody,
      slotHeader,
      slotContent,
      slotFooter,
      textHeader,
      textFooter,
      defaultContentText,
      pageBody,
      pageCustom,
    ];

    it("page slot mirror='content' 매칭 → page element parent_id 재매핑 + frame default content 자식 hide", () => {
      const elementsMap = buildElementsMap(allElements);

      const result = resolvePageWithFrame({
        page: makeFramePage(FRAME_ID, { id: "page-1" }),
        pageElements: [pageBody, pageCustom],
        elementsMap,
      });

      expect(result.hasFrameBinding).toBe(true);
      expect(result.bodyElement?.id).toBe("page-body");
      const scoped = (id: string) => toPageFrameElementId("page-1", id);

      const ids = new Set(result.pageElements.map((el) => el.id));
      expect(ids.has(scoped("default-content-text"))).toBe(false);
      expect(ids.has("page-custom")).toBe(true);
      expect(ids.has(scoped("slot-content"))).toBe(true);
      expect(ids.has(scoped("slot-header"))).toBe(true);
      expect(ids.has(scoped("text-header"))).toBe(true);
      expect(ids.has(scoped("text-footer"))).toBe(true);

      const remappedCustom = result.pageElements.find(
        (el) => el.id === "page-custom",
      );
      expect(remappedCustom?.parent_id).toBe(scoped("slot-content"));

      const slotContentRow = result.pageElements.find(
        (el) => el.id === scoped("slot-content"),
      );
      expect(slotContentRow?.parent_id).toBe("page-body");
      expect(slotContentRow?.props?._slotChrome).toBe("hidden");
      expect(slotContentRow?.props?._slotMarkerChrome).toBe("visible");
    });

    it("page slot mirror 가 element-level (props 외부) 에 있어도 매칭", () => {
      const pageCustomLegacy = makeEl({
        id: "page-custom",
        type: "Card",
        page_id: "page-1",
        parent_id: "page-body",
        slotMirrorName: "content",
      });
      const elementsMap = buildElementsMap([
        frameBody,
        slotHeader,
        slotContent,
        slotFooter,
        textHeader,
        textFooter,
        defaultContentText,
        pageBody,
        pageCustomLegacy,
      ]);

      const result = resolvePageWithFrame({
        page: makeFramePage(FRAME_ID, { id: "page-1" }),
        pageElements: [pageBody, pageCustomLegacy],
        elementsMap,
      });

      const remappedCustom = result.pageElements.find(
        (el) => el.id === "page-custom",
      );
      expect(remappedCustom?.parent_id).toBe(
        toPageFrameElementId("page-1", "slot-content"),
      );
    });
  });

  it("매칭 안 된 slot mirror 는 'content' fallback 으로 fill", () => {
    const FRAME_ID = "frame-1";
    const frameBody = makeEl({
      id: "frame-body",
      type: "body",
      frameId: FRAME_ID,
      page_id: null,
    });
    const slotContent = makeEl({
      id: "slot-content",
      type: "Slot",
      frameId: FRAME_ID,
      page_id: null,
      parent_id: "frame-body",
      props: { name: "content" },
    });
    const pageBody = makeEl({
      id: "page-body",
      type: "body",
      page_id: "page-1",
    });
    const pageMisslotted = makeEl({
      id: "misslotted",
      type: "Button",
      page_id: "page-1",
      parent_id: "page-body",
      propsSlotMirrorName: "nonexistent",
    });
    const elementsMap = buildElementsMap([
      frameBody,
      slotContent,
      pageBody,
      pageMisslotted,
    ]);

    const result = resolvePageWithFrame({
      page: makeFramePage(FRAME_ID, { id: "page-1" }),
      pageElements: [pageBody, pageMisslotted],
      elementsMap,
    });

    const remapped = result.pageElements.find((el) => el.id === "misslotted");
    expect(remapped?.parent_id).toBe(
      toPageFrameElementId("page-1", "slot-content"),
    );
  });

  it("page non-root element (다른 page element 의 자식) 는 그대로 유지", () => {
    const FRAME_ID = "frame-1";
    const frameBody = makeEl({
      id: "frame-body",
      type: "body",
      frameId: FRAME_ID,
      page_id: null,
    });
    const slotContent = makeEl({
      id: "slot-content",
      type: "Slot",
      frameId: FRAME_ID,
      page_id: null,
      parent_id: "frame-body",
      props: { name: "content" },
    });
    const pageBody = makeEl({
      id: "page-body",
      type: "body",
      page_id: "page-1",
    });
    const pageRoot = makeEl({
      id: "page-root",
      type: "Card",
      page_id: "page-1",
      parent_id: "page-body",
      propsSlotMirrorName: "content",
    });
    const pageChild = makeEl({
      id: "page-child",
      type: "Text",
      page_id: "page-1",
      parent_id: "page-root",
    });
    const elementsMap = buildElementsMap([
      frameBody,
      slotContent,
      pageBody,
      pageRoot,
      pageChild,
    ]);

    const result = resolvePageWithFrame({
      page: makeFramePage(FRAME_ID, { id: "page-1" }),
      pageElements: [pageBody, pageRoot, pageChild],
      elementsMap,
    });

    const remappedRoot = result.pageElements.find(
      (el) => el.id === "page-root",
    );
    const childResult = result.pageElements.find(
      (el) => el.id === "page-child",
    );

    expect(remappedRoot?.parent_id).toBe(
      toPageFrameElementId("page-1", "slot-content"),
    );
    expect(childResult?.parent_id).toBe("page-root");
  });

  it("동일 frame 을 여러 page 에 적용해도 page별 slot projection id 가 충돌하지 않는다", () => {
    const FRAME_ID = "frame-shared";
    const frameBody = makeEl({
      id: "frame-body",
      type: "body",
      frameId: FRAME_ID,
      page_id: null,
    });
    const slotContent = makeEl({
      id: "slot-content",
      type: "Slot",
      frameId: FRAME_ID,
      page_id: null,
      parent_id: "frame-body",
      props: { name: "content" },
    });
    const page1Body = makeEl({
      id: "page-1-body",
      type: "body",
      page_id: "page-1",
    });
    const page1Card = makeEl({
      id: "page-1-card",
      type: "Card",
      page_id: "page-1",
      parent_id: "page-1-body",
      propsSlotMirrorName: "content",
    });
    const page2Body = makeEl({
      id: "page-2-body",
      type: "body",
      page_id: "page-2",
    });
    const page2Button = makeEl({
      id: "page-2-button",
      type: "Button",
      page_id: "page-2",
      parent_id: "page-2-body",
      propsSlotMirrorName: "content",
    });
    const elementsMap = buildElementsMap([
      frameBody,
      slotContent,
      page1Body,
      page1Card,
      page2Body,
      page2Button,
    ]);

    const page1Result = resolvePageWithFrame({
      page: makeFramePage(FRAME_ID, { id: "page-1" }),
      pageElements: [page1Body, page1Card],
      elementsMap,
    });
    const page2Result = resolvePageWithFrame({
      page: makeFramePage(FRAME_ID, { id: "page-2" }),
      pageElements: [page2Body, page2Button],
      elementsMap,
    });

    const page1SlotId = toPageFrameElementId("page-1", "slot-content");
    const page2SlotId = toPageFrameElementId("page-2", "slot-content");
    const page1Slot = page1Result.pageElements.find(
      (el) => el.id === page1SlotId,
    );
    const page2Slot = page2Result.pageElements.find(
      (el) => el.id === page2SlotId,
    );
    const page1Fill = page1Result.pageElements.find(
      (el) => el.id === "page-1-card",
    );
    const page2Fill = page2Result.pageElements.find(
      (el) => el.id === "page-2-button",
    );

    expect(page1Slot?.parent_id).toBe("page-1-body");
    expect(page2Slot?.parent_id).toBe("page-2-body");
    expect(page1SlotId).not.toBe(page2SlotId);
    expect(page1Fill?.parent_id).toBe(page1SlotId);
    expect(page2Fill?.parent_id).toBe(page2SlotId);
  });

  it("refresh hydrate 된 page-scoped frame projection 을 다시 projection 하지 않는다", () => {
    const FRAME_ID = "frame-hydrated";
    const projectedBodyId = toPageFrameElementId("page-1", "frame-body");
    const projectedSlotId = toPageFrameElementId("page-1", "slot-content");
    const pageBody = makeEl({
      id: "page-1-body",
      type: "body",
      page_id: "page-1",
    });
    const projectedFrameBody = makeEl({
      id: projectedBodyId,
      type: "body",
      frameId: FRAME_ID,
      page_id: "page-1",
    });
    const projectedSlot = makeEl({
      id: projectedSlotId,
      type: "Slot",
      frameId: FRAME_ID,
      page_id: "page-1",
      parent_id: projectedBodyId,
      props: { name: "content" },
    });
    const elementsMap = buildElementsMap([
      pageBody,
      projectedFrameBody,
      projectedSlot,
    ]);

    const result = resolvePageWithFrame({
      page: makeFramePage(FRAME_ID, { id: "page-1" }),
      pageElements: [pageBody, projectedFrameBody, projectedSlot],
      elementsMap,
    });

    expect(result.hasFrameBinding).toBe(true);
    expect(result.bodyElement?.id).toBe("page-1-body");
    expect(result.pageElements.map((el) => el.id)).toEqual([projectedSlotId]);
    expect(result.pageElements[0]?.parent_id).toBe("page-1-body");
  });

  it("frame Slot 0건 (빈 frame body) → page element 가 page-body 자식 유지 (orphan 방지 회귀 fixture)", () => {
    const FRAME_ID = "frame-empty";
    const frameBody = makeEl({
      id: "frame-body",
      type: "body",
      frameId: FRAME_ID,
      page_id: null,
    });
    const pageBody = makeEl({
      id: "page-body",
      type: "body",
      page_id: "page-1",
    });
    const pageCard = makeEl({
      id: "page-card",
      type: "Card",
      page_id: "page-1",
      parent_id: "page-body",
    });
    const elementsMap = buildElementsMap([frameBody, pageBody, pageCard]);

    const result = resolvePageWithFrame({
      page: makeFramePage(FRAME_ID, { id: "page-1" }),
      pageElements: [pageBody, pageCard],
      elementsMap,
    });

    expect(result.bodyElement?.id).toBe("page-body");
    expect(result.hasFrameBinding).toBe(true);

    const cardRow = result.pageElements.find((el) => el.id === "page-card");
    expect(cardRow?.parent_id).toBe("page-body");
  });

  it("page width/height/배경 시각 속성 보존 + frame body layout 문법 적용", () => {
    const FRAME_ID = "frame-1";
    const frameBody = makeEl({
      id: "frame-body",
      type: "body",
      frameId: FRAME_ID,
      page_id: null,
      props: {
        style: {
          width: 320,
          height: 200,
          background: "red",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        },
      },
    });
    const slotContent = makeEl({
      id: "slot-content",
      type: "Slot",
      frameId: FRAME_ID,
      page_id: null,
      parent_id: "frame-body",
      props: { name: "content" },
    });
    const pageBody = makeEl({
      id: "page-body",
      type: "body",
      page_id: "page-1",
      props: { style: { width: 390, height: 844, background: "white" } },
    });
    const elementsMap = buildElementsMap([frameBody, slotContent, pageBody]);

    const result = resolvePageWithFrame({
      page: makeFramePage(FRAME_ID, { id: "page-1" }),
      pageElements: [pageBody],
      elementsMap,
    });

    expect(result.bodyElement?.id).toBe("page-body");
    const bodyStyle = (result.bodyElement?.props?.style ?? {}) as Record<
      string,
      unknown
    >;
    expect(bodyStyle.width).toBe(390);
    expect(bodyStyle.height).toBe(844);
    expect(bodyStyle.background).toBe("white");
    expect(bodyStyle.display).toBe("flex");
    expect(bodyStyle.flexDirection).toBe("column");
    expect(bodyStyle.gap).toBe(12);

    const slotRow = result.pageElements.find(
      (el) => el.id === toPageFrameElementId("page-1", "slot-content"),
    );
    expect(slotRow?.parent_id).toBe("page-body");
  });

  it("page-frame 합성 시 root Slot 이 frame body flex 방향을 따라 page height 를 채운다", () => {
    const FRAME_ID = "frame-vertical";
    const frameBody = makeEl({
      id: "frame-body",
      type: "body",
      frameId: FRAME_ID,
      page_id: null,
      props: { style: { display: "flex", flexDirection: "column" } },
    });
    const header = makeEl({
      id: "slot-header",
      type: "Slot",
      frameId: FRAME_ID,
      page_id: null,
      parent_id: "frame-body",
      props: { name: "header" },
    });
    const content = makeEl({
      id: "slot-content",
      type: "Slot",
      frameId: FRAME_ID,
      page_id: null,
      parent_id: "frame-body",
      props: { name: "content" },
    });
    const footer = makeEl({
      id: "slot-footer",
      type: "Slot",
      frameId: FRAME_ID,
      page_id: null,
      parent_id: "frame-body",
      props: { name: "footer" },
    });
    const pageBody = makeEl({
      id: "page-body",
      type: "body",
      page_id: "page-1",
    });
    const elementsMap = buildElementsMap([
      frameBody,
      header,
      content,
      footer,
      pageBody,
    ]);

    const result = resolvePageWithFrame({
      page: makeFramePage(FRAME_ID, { id: "page-1" }),
      pageElements: [pageBody],
      elementsMap,
    });

    const headerStyle = result.pageElements.find(
      (el) => el.id === toPageFrameElementId("page-1", "slot-header"),
    )?.props?.style as Record<string, unknown> | undefined;
    const contentStyle = result.pageElements.find(
      (el) => el.id === toPageFrameElementId("page-1", "slot-content"),
    )?.props?.style as Record<string, unknown> | undefined;
    const footerStyle = result.pageElements.find(
      (el) => el.id === toPageFrameElementId("page-1", "slot-footer"),
    )?.props?.style as Record<string, unknown> | undefined;

    expect(headerStyle).toMatchObject({ width: "100%", flexShrink: 0 });
    expect(contentStyle).toMatchObject({
      width: "100%",
      flex: "1 1 auto",
      minHeight: 0,
    });
    expect(footerStyle).toMatchObject({ width: "100%", flexShrink: 0 });
  });

  it("deleted 표시된 frame element 는 제외", () => {
    const FRAME_ID = "frame-1";
    const frameBody = makeEl({
      id: "frame-body",
      type: "body",
      frameId: FRAME_ID,
      page_id: null,
    });
    const slotContent = makeEl({
      id: "slot-content",
      type: "Slot",
      frameId: FRAME_ID,
      page_id: null,
      parent_id: "frame-body",
      props: { name: "content" },
    });
    const deletedSlot = makeEl({
      id: "slot-deleted",
      type: "Slot",
      frameId: FRAME_ID,
      page_id: null,
      parent_id: "frame-body",
      props: { name: "footer" },
      deleted: true,
    });
    const pageBody = makeEl({
      id: "page-body",
      type: "body",
      page_id: "page-1",
    });
    const elementsMap = buildElementsMap([
      frameBody,
      slotContent,
      deletedSlot,
      pageBody,
    ]);

    const result = resolvePageWithFrame({
      page: makeFramePage(FRAME_ID, { id: "page-1" }),
      pageElements: [pageBody],
      elementsMap,
    });

    const ids = new Set(result.pageElements.map((el) => el.id));
    expect(ids.has(toPageFrameElementId("page-1", "slot-deleted"))).toBe(false);
    expect(ids.has(toPageFrameElementId("page-1", "slot-content"))).toBe(true);
  });
});
