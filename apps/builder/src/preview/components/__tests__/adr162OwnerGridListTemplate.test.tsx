import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  getCatalogCutoverTypes,
  resolveSlotComposition,
  type CanonicalNode,
  type CompositionDocument,
  type ResolvedNode,
} from "@composition/shared";

import type { RenderContext } from "../../types/index";
import { CanonicalNodeRenderer } from "../CanonicalNodeRenderer";
import {
  createGridListTemplateResolver,
  indexTemplateOriginRecords,
} from "../../utils/itemTemplates";
import { buildCanvasSceneGraph } from "../../../builder/workspace/canvas/scene/canvasSceneNode";
import { toCollectionRowProjectionId } from "../../../builder/projection/renderProjectionIds";
import { resolveCanonicalDocument } from "../../../resolvers/canonical";

/**
 * ADR-162 Phase 1 (round 2 h2) — 데이터 GridList 는 소유자마다 자기 항목 origin 으로 카드를 그린다.
 *
 * Canvas `resolveGridListTemplateOriginId` 는 문서 GridList 의 자기 slot[0] · ref instance 의 master slot[0]
 * 을 읽는다. 종전 Preview 는 전역 `component-gridlist` slot[0] 하나를 모든 GridList 에 넘겨, Properties
 * Slot 절로 custom origin 을 둔 GridList 에서 두 leg 가 다른 카드를 그렸다 (ADR-233 round 3 m2 의 Tabs 와
 * 같은 결함 형태).
 */

afterEach(cleanup);

const RED = "rgb(255, 0, 0)";
const ITEMS = [{ id: "a", label: "Alpha", description: "desc A" }];

function cardOrigin(
  id: string,
  descriptionStyle: Record<string, unknown>,
): CanonicalNode {
  return {
    id,
    type: "GridListItem",
    reusable: true,
    props: { children: "{label}", description: "{description}" },
    children: [
      {
        id: `${id}__label`,
        type: "Text",
        props: { slot: "label", children: "{label}" },
      },
      {
        id: `${id}__description`,
        type: "Text",
        props: {
          slot: "description",
          children: "{description}",
          style: descriptionStyle,
        },
      },
    ],
  } as unknown as CanonicalNode;
}

function makeDoc(): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-components",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-components" },
        children: [
          {
            id: "body-components",
            type: "Body",
            props: {},
            children: [
              cardOrigin("component-gridlist-item-default", {}),
              cardOrigin("user-card", { color: RED }),
              {
                id: "component-gridlist",
                type: "GridList",
                reusable: true,
                slot: ["component-gridlist-item-default"],
                props: {},
              },
              {
                id: "user-gridlist",
                type: "GridList",
                reusable: true,
                slot: ["user-card"],
                props: {},
              },
            ],
          },
        ],
      },
      {
        id: "page-1",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-1" },
        children: [
          {
            id: "body-1",
            type: "Body",
            props: {},
            children: [
              // 자기 slot 을 가진 문서 GridList · slot 없는 문서 GridList · custom master 의 instance
              {
                id: "gl-user",
                type: "GridList",
                slot: ["user-card"],
                props: { items: ITEMS },
              },
              { id: "gl-plain", type: "GridList", props: { items: ITEMS } },
              {
                id: "gl-inst",
                type: "ref",
                ref: "user-gridlist",
                props: { items: ITEMS },
              },
            ],
          },
        ],
      },
    ],
  } as unknown as CompositionDocument;
}

function canvasDescriptionColor(doc: CompositionDocument, ownerId: string) {
  const graph = buildCanvasSceneGraph(doc, { activeBreakpoint: "desktop" });
  const row = graph.nodesMap.get(
    toCollectionRowProjectionId("gridlist", ownerId, "a"),
  );
  const slots = row?.props._slots as
    { slots?: Record<string, { style?: Record<string, unknown> }> } | undefined;
  return slots?.slots?.description?.style?.color ?? null;
}

function findResolved(
  nodes: readonly ResolvedNode[],
  id: string,
): ResolvedNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = findResolved((node.children ?? []) as ResolvedNode[], id);
    if (hit) return hit;
  }
  return undefined;
}

describe("ADR-162 Phase 1 — 데이터 GridList 카드 = 소유자 자기 항목 origin (두 leg)", () => {
  it("자기 slot custom · slot 없음 기본 · custom master instance — Canvas 와 Preview DOM 이 GridList 마다 같다", () => {
    const doc = makeDoc();
    const expected: Record<string, string | null> = {
      "gl-user": RED,
      "gl-plain": null,
      "gl-inst": RED,
    };
    for (const [id, color] of Object.entries(expected)) {
      expect(canvasDescriptionColor(doc, id), `canvas ${id}`).toBe(color);
    }

    const resolved = resolveCanonicalDocument(doc) as ResolvedNode[];
    const byId = indexTemplateOriginRecords(resolved);
    const resolver = createGridListTemplateResolver(byId);
    const ctx = {
      childrenByParent: new Map(),
      renderElement: () => null,
      updateElementProps: () => {},
      // App 이 문서 전역 기본값으로 넣는 값 — GridList 마다 resolveGridListTemplate 이 덮는다.
      gridListTemplateSlotComposition: resolveSlotComposition(
        byId.get("component-gridlist-item-default")?.children,
      ),
      resolveGridListTemplate: resolver.forOwner,
    } as unknown as RenderContext;

    const domDescriptionColor = (id: string) => {
      const node = findResolved(resolved, id)!;
      const { container, unmount } = render(
        <CanonicalNodeRenderer
          node={node}
          renderContext={ctx}
          cutoverPrimitives={getCatalogCutoverTypes()}
        />,
      );
      const description = container.querySelector<HTMLElement>(
        '.react-aria-GridListItem [slot="description"]',
      );
      const value = description?.style.color || null;
      unmount();
      return value;
    };
    for (const [id, color] of Object.entries(expected)) {
      expect(domDescriptionColor(id), `dom ${id}`).toBe(color);
    }
  });
});
