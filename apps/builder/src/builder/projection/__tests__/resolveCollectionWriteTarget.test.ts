import { describe, expect, it } from "vitest";

import { resolveCollectionWriteTarget } from "../resolveCollectionWriteTarget";
import { isRenderProjectionId } from "../renderProjectionIds";
import type { CanvasProjectionMetadata } from "../../workspace/canvas/scene/canvasSceneNode";

const rowProjection: CanvasProjectionMetadata = {
  kind: "listbox-row",
  listBoxId: "listbox-1",
  itemKey: "cat",
  rowIndex: 0,
  templateAnchorId: "anchor-1",
  templateOriginId: "component-listbox-item-origin",
};

describe("resolveCollectionWriteTarget — 3-route (ADR-912 단계 4)", () => {
  it("style intent → template route (origin master, 전 행 반영)", () => {
    const target = resolveCollectionWriteTarget(rowProjection, {
      kind: "style",
    });
    expect(target).toEqual({
      route: "template",
      originNodeId: "component-listbox-item-origin",
    });
  });

  it("content intent → data route (collection + itemKey, 구조 불변)", () => {
    const target = resolveCollectionWriteTarget(rowProjection, {
      kind: "content",
    });
    expect(target).toEqual({
      route: "data",
      collectionNodeId: "listbox-1",
      itemKey: "cat",
    });
  });

  it("override intent → override route (RefNode.descendants[itemKey])", () => {
    const target = resolveCollectionWriteTarget(rowProjection, {
      kind: "override",
    });
    expect(target).toEqual({
      route: "override",
      refNodeId: "listbox-1",
      descendantPath: "cat",
    });
  });

  it("style intent + origin 미해결 → null (template route 변환 불가)", () => {
    const target = resolveCollectionWriteTarget(
      { ...rowProjection, templateOriginId: null },
      { kind: "style" },
    );
    expect(target).toBeNull();
  });

  it("non-collection projection(page-frame) → null", () => {
    const pageFrame: CanvasProjectionMetadata = {
      kind: "page-frame-element",
      pageId: "p1",
      sourceElementId: "el-1",
      renderElementId: "el-1::page-frame::x",
      renderParentId: null,
      canonicalParentId: null,
    };
    expect(
      resolveCollectionWriteTarget(pageFrame, { kind: "style" }),
    ).toBeNull();
  });

  it("undefined projection → null", () => {
    expect(
      resolveCollectionWriteTarget(undefined, { kind: "content" }),
    ).toBeNull();
  });

  describe("G-boundary: 출력에 projected id 누출 0 (negative fixture)", () => {
    it("모든 route 의 모든 target id 가 canonical id (projection: 아님)", () => {
      for (const intent of [
        { kind: "style" } as const,
        { kind: "content" } as const,
        { kind: "override" } as const,
      ]) {
        const target = resolveCollectionWriteTarget(rowProjection, intent);
        expect(target).not.toBeNull();
        const ids =
          target!.route === "template"
            ? [target!.originNodeId]
            : target!.route === "data"
              ? [target!.collectionNodeId]
              : [target!.refNodeId];
        for (const id of ids) {
          expect(isRenderProjectionId(id)).toBe(false);
        }
      }
    });

    it("listBoxId 가 projected id 로 오염된 메타 → self-check throw (방어선)", () => {
      // 정상 경로에선 발생 불가하나, projection metadata 가 잘못 구성되면
      // 비영속 id 가 canonical write target 으로 누출되는 것을 출력 측에서 차단.
      const poisoned: CanvasProjectionMetadata = {
        ...rowProjection,
        listBoxId: "projection:listbox-row:x:y",
      };
      expect(() =>
        resolveCollectionWriteTarget(poisoned, { kind: "content" }),
      ).toThrow(/projected id leaked/);
    });
  });
});
