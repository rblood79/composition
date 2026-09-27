// @vitest-environment node
/**
 * ADR-150 후속 F2 · F3 — origin 안 자식의 descendants 키 규칙 하나 (사용자 판정 2026-09-27 "Canvas 규칙").
 *
 * F2: segment = customId (최상위 · legacy metadata) ‖ name ‖ id. 종전엔 Canvas scene 이 customId 를 먼저,
 *     Preview · 패널 조회 · insert 쓰기가 name ‖ id 를 봐 팔레트로 origin 에 넣은 자식 (customId 자동) 의
 *     instance override 가 Canvas 에만 보였다. 옛 규칙 키도 두 해석기가 읽는다 (문서는 안 바꾼다).
 * F3: 같은 segment 형제는 두 번째부터 `~N` — 종전 Canvas 는 두 번째 형제를 잃고 첫 형제를 두 번 그렸다.
 */
import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { collectSlotFillHosts } from "../../../builder/components/slotFillPath";
import { resolveCanonicalDocument } from "../../../resolvers/canonical";
import {
  getCanonicalRefChildSegment,
  getCanonicalRefChildSegments,
  resolveCanonicalRefTree,
} from "../canonicalRefResolution";

const ORIGIN_ID = "card-origin";
const INSTANCE_ID = "card-1";

function makeDoc(descendants: Record<string, unknown>): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-components",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-components" },
        children: [
          {
            id: ORIGIN_ID,
            type: "frame",
            reusable: true,
            children: [
              {
                id: "o-title",
                type: "Text",
                name: "Title",
                metadata: { type: "legacy-element-props", customId: "text_1" },
                props: { title: "origin" },
              },
              { id: "o-a", type: "Text", name: "Dup", props: { title: "A" } },
              { id: "o-b", type: "Text", name: "Dup", props: { title: "B" } },
            ],
          },
        ],
      },
      {
        id: "page-home",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-home" },
        children: [
          {
            id: INSTANCE_ID,
            type: "ref",
            ref: ORIGIN_ID,
            descendants,
          } as unknown as CanonicalNode,
        ],
      },
    ],
  } as CompositionDocument;
}

function indexNodes(doc: CompositionDocument) {
  const map = new Map<string, CanonicalNode>();
  const walk = (nodes: readonly CanonicalNode[]) => {
    for (const node of nodes) {
      map.set(node.id, node);
      walk(node.children ?? []);
    }
  };
  walk(doc.children);
  return map;
}

/**
 * Canvas scene 노드 모양 (`canvasSceneNode.ts` — legacy metadata customId 를 최상위로 올리고 name 을
 * componentName 으로도 싣는다). 원시 문서 노드만 넘기면 scene 에서만 생기는 차이를 놓친다 (F2 판독 HIGH-1).
 */
function toSceneShape(node: CanonicalNode): CanonicalNode {
  const customId = (node.metadata as { customId?: string } | undefined)
    ?.customId;
  return {
    ...node,
    ...(customId ? { customId } : {}),
    ...(node.name !== undefined ? { componentName: node.name } : {}),
    ...(node.children ? { children: node.children.map(toSceneShape) } : {}),
  } as CanonicalNode;
}

/** Canvas 축 (scene · Properties 패널이 쓰는 같은 해석기) — synthetic id → props. */
function canvasProps(
  doc: CompositionDocument,
  shape: (node: CanonicalNode) => CanonicalNode = (node) => node,
): Record<string, Record<string, unknown>> {
  const nodeMap = new Map(
    [...indexNodes({ ...doc, children: doc.children.map(shape) }).values()].map(
      (node) => [node.id, node],
    ),
  );
  const childrenMap = new Map<string, CanonicalNode[]>();
  for (const node of nodeMap.values()) {
    if (node.children?.length) childrenMap.set(node.id, [...node.children]);
  }
  const tree = resolveCanonicalRefTree<CanonicalNode>({
    elements: [nodeMap.get(INSTANCE_ID)!],
    elementsMap: nodeMap,
    childrenMap,
  });
  const out: Record<string, Record<string, unknown>> = {};
  for (const node of tree.elements) {
    if (node.id.startsWith(`${INSTANCE_ID}/`)) {
      out[node.id] = node.props as Record<string, unknown>;
    }
  }
  return out;
}

function canvasTitles(
  doc: CompositionDocument,
  shape?: (node: CanonicalNode) => CanonicalNode,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(canvasProps(doc, shape)).map(([id, props]) => [
      id,
      props.title,
    ]),
  );
}

/** Preview 축 (resolveCanonicalDocument) — origin 자식 id → props. */
function previewProps(
  doc: CompositionDocument,
): Record<string, Record<string, unknown>> {
  const resolved = resolveCanonicalDocument(doc);
  const find = (nodes: readonly CanonicalNode[]): CanonicalNode | undefined => {
    for (const node of nodes) {
      if (node.id === INSTANCE_ID) return node;
      const hit = find(node.children ?? []);
      if (hit) return hit;
    }
    return undefined;
  };
  const instance = find(resolved as unknown as CanonicalNode[])!;
  return Object.fromEntries(
    (instance.children ?? []).map((child) => [
      child.id,
      child.props as Record<string, unknown>,
    ]),
  );
}

function previewTitles(doc: CompositionDocument): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(previewProps(doc)).map(([id, props]) => [id, props.title]),
  );
}

describe("ADR-150 후속 F2 · F3 — descendants 키 규칙 하나", () => {
  it("segment: 문서 노드의 legacy metadata customId 를 읽는다 · 같은 segment 형제는 두 번째부터 ~N", () => {
    const origin = indexNodes(makeDoc({})).get(ORIGIN_ID)!;
    expect(
      getCanonicalRefChildSegment(origin.children!, origin.children![0]!),
    ).toBe("text_1");
    expect(
      getCanonicalRefChildSegment(origin.children!, origin.children![2]!),
    ).toBe("Dup~2");
    expect(getCanonicalRefChildSegments(origin.children!)).toEqual([
      "text_1",
      "Dup",
      "Dup~2",
    ]);
  });

  it("F2: Canvas 가 쓰는 customId 키를 Preview 도 읽는다", () => {
    const doc = makeDoc({ text_1: { title: "edited" } });
    expect(canvasTitles(doc)[`${INSTANCE_ID}/text_1`]).toBe("edited");
    expect(previewTitles(doc)["o-title"]).toBe("edited");
  });

  it("F2: 옛 규칙 (name ‖ id) 키도 두 해석기가 같은 자식에 적용한다", () => {
    const doc = makeDoc({ Title: { title: "legacy" } });
    expect(canvasTitles(doc)[`${INSTANCE_ID}/text_1`]).toBe("legacy");
    expect(previewTitles(doc)["o-title"]).toBe("legacy");
  });

  it("F2: Canvas scene 모양 (최상위 customId · componentName) 에서도 옛 키를 읽는다", () => {
    const doc = makeDoc({ Title: { title: "legacy" } });
    expect(canvasTitles(doc, toSceneShape)[`${INSTANCE_ID}/text_1`]).toBe(
      "legacy",
    );
  });

  it("F2: 옛 키와 현재 키가 같이 있으면 둘을 합친다 (충돌 필드는 현재 키)", () => {
    const doc = makeDoc({
      Title: { title: "legacy", style: { color: "red", fontSize: 10 } },
      text_1: { style: { fontSize: 20 } },
    });
    const expected = {
      title: "legacy",
      style: expect.objectContaining({ color: "red", fontSize: 20 }),
    };
    expect(canvasProps(doc)[`${INSTANCE_ID}/text_1`]).toMatchObject(expected);
    expect(
      canvasProps(doc, toSceneShape)[`${INSTANCE_ID}/text_1`],
    ).toMatchObject(expected);
    expect(previewProps(doc)["o-title"]).toMatchObject(expected);
  });

  it("F3: 같은 이름 형제 둘 다 실체화되고 두 번째 형제 patch 는 그 형제에만", () => {
    const doc = makeDoc({ "Dup~2": { title: "second" } });
    const canvas = canvasTitles(doc);
    expect(canvas[`${INSTANCE_ID}/Dup`]).toBe("A");
    expect(canvas[`${INSTANCE_ID}/Dup~2`]).toBe("second");
    const preview = previewTitles(doc);
    expect(preview["o-a"]).toBe("A");
    expect(preview["o-b"]).toBe("second");
  });

  it("MEDIUM-3 근본: slot 채우기 경로도 문서 노드의 metadata customId 를 읽는다", () => {
    const host = {
      id: "o-region",
      type: "frame",
      slot: ["component-button"],
      metadata: { type: "legacy-element-props", customId: "frame_3" },
    } as unknown as CanonicalNode;
    const hosts = collectSlotFillHosts<CanonicalNode>(
      ORIGIN_ID,
      new Map([[ORIGIN_ID, [host]]]),
    );
    expect(hosts.map((hit) => hit.path)).toEqual(["frame_3"]);
  });

  it("도장 (`_pathSegment`) 있는 형제와 없는 형제가 섞여도 segment 가 겹치지 않는다", () => {
    expect(
      getCanonicalRefChildSegments([
        { id: "a", name: "Dup", _pathSegment: "Dup" },
        { id: "b", name: "Dup" },
      ]),
    ).toEqual(["Dup", "Dup~2"]);
  });
});
