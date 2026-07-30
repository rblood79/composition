// @vitest-environment node
/**
 * projection content signature — 노드별 직렬화 캐시의 **정확성**.
 *
 * 이 시그니처는 sceneVersion 의 입력이라 값이 안 바뀌면 씬이 갱신되지 않는다.
 * 즉 캐시가 stale 문자열을 돌려주면 **편집이 조용히 무시**된다 — 화면만 안 바뀌고
 * 에러도 로그도 없다. 그래서 "빨라졌는가" 보다 **"모든 입력 변화를 잡는가"** 가
 * 먼저다.
 *
 * `createNodeProjectionSignature` 가 시그니처에 넣는 필드를 하나씩 바꿔 가며
 * 해시가 갈리는지 확인한다. 필드가 추가되면 여기에 케이스도 추가할 것 —
 * ADR-136 projection-relevant field 규칙과 같은 보수 의무다.
 */
import { describe, expect, it } from "vitest";

import type { CanvasSceneNode } from "./canvasSceneNode";
import {
  createResolvedProjectionSignature,
  readProjectionSignatureCacheStats,
} from "./buildSceneSnapshot";
import type { ScenePageData } from "./sceneSnapshotTypes";

const PAGE_ID = "page-1";

/** canonical 원본 — 캐시 키가 되는 객체 */
function makeSource(id: string): CanvasSceneNode["sourceNode"] {
  return { id, type: "Button" } as unknown as CanvasSceneNode["sourceNode"];
}

function makeNode(
  id: string,
  overrides: Partial<CanvasSceneNode> = {},
): CanvasSceneNode {
  return {
    id,
    type: "Button",
    props: {
      children: `Node ${id}`,
      style: { display: "flex", width: "120px" },
    },
    parentId: "body-1",
    parent_id: "body-1",
    pageId: PAGE_ID,
    page_id: PAGE_ID,
    layoutId: null,
    sourceNode: makeSource(id),
    ...overrides,
  } as unknown as CanvasSceneNode;
}

function sign(
  elements: CanvasSceneNode[],
  pages?: Map<string, ScenePageData>,
): number {
  return createResolvedProjectionSignature({
    elements,
    pageSnapshots: pages ?? new Map(),
  });
}

/** 같은 sourceNode 를 재사용해 캐시가 실제로 조회되는 상황을 만든다 */
function reuseSource(
  base: CanvasSceneNode,
  overrides: Partial<CanvasSceneNode>,
): CanvasSceneNode {
  return { ...base, ...overrides } as CanvasSceneNode;
}

describe("projection signature — 캐시 정확성", () => {
  it("같은 입력은 같은 해시를 낸다", () => {
    const node = makeNode("el-1");
    expect(sign([node])).toBe(sign([node]));
  });

  it("props 값이 바뀌면 해시가 갈린다 (같은 sourceNode 재사용)", () => {
    const base = makeNode("el-1");
    const before = sign([base]);
    const after = sign([
      reuseSource(base, {
        props: { ...base.props, children: "changed" },
      } as Partial<CanvasSceneNode>),
    ]);

    expect(after).not.toBe(before);
  });

  it("props 의 중첩 style 이 새 객체로 바뀌면 해시가 갈린다", () => {
    const base = makeNode("el-1");
    const before = sign([base]);
    const props = base.props as Record<string, unknown>;
    const after = sign([
      reuseSource(base, {
        props: {
          ...props,
          style: {
            ...(props.style as Record<string, unknown>),
            width: "999px",
          },
        },
      } as Partial<CanvasSceneNode>),
    ]);

    expect(after).not.toBe(before);
  });

  it("props 키가 추가되면 해시가 갈린다", () => {
    const base = makeNode("el-1");
    const before = sign([base]);
    const after = sign([
      reuseSource(base, {
        props: { ...base.props, _slots: { header: "x" } },
      } as Partial<CanvasSceneNode>),
    ]);

    expect(after).not.toBe(before);
  });

  it("props 키가 제거되면 해시가 갈린다", () => {
    const base = makeNode("el-1");
    const withExtra = reuseSource(base, {
      props: { ...base.props, extra: 1 },
    } as Partial<CanvasSceneNode>);
    const before = sign([withExtra]);
    const after = sign([base]);

    expect(after).not.toBe(before);
  });

  // 시그니처 입력 필드 전수 — 하나라도 캐시를 통과해 버리면 그 축의 변경이
  // 무반영된다. `createNodeProjectionSignature` 의 목록과 1:1 로 맞춘다.
  const FIELD_CASES: Array<{
    name: string;
    override: Partial<CanvasSceneNode>;
  }> = [
    {
      name: "type",
      override: { type: "TextField" } as Partial<CanvasSceneNode>,
    },
    {
      name: "parentId",
      override: {
        parentId: "other",
        parent_id: "other",
      } as Partial<CanvasSceneNode>,
    },
    {
      name: "pageId",
      override: {
        pageId: "page-2",
        page_id: "page-2",
      } as Partial<CanvasSceneNode>,
    },
    {
      name: "layoutId",
      override: { layoutId: "L1" } as Partial<CanvasSceneNode>,
    },
    {
      name: "deleted",
      override: { deleted: true } as Partial<CanvasSceneNode>,
    },
    {
      name: "reusable",
      override: { reusable: true } as Partial<CanvasSceneNode>,
    },
    { name: "ref", override: { ref: "master-1" } as Partial<CanvasSceneNode> },
    {
      name: "fills",
      override: {
        fills: [{ type: "solid", color: "#f00" }],
      } as unknown as Partial<CanvasSceneNode>,
    },
    {
      name: "projection",
      override: {
        projection: { kind: "gridlist-row" },
      } as unknown as Partial<CanvasSceneNode>,
    },
  ];

  for (const { name, override } of FIELD_CASES) {
    it(`${name} 이 바뀌면 해시가 갈린다`, () => {
      const base = makeNode("el-1");
      const before = sign([base]);
      const after = sign([reuseSource(base, override)]);

      expect(after).not.toBe(before);
    });
  }

  it("한 sourceNode 를 공유하는 두 노드가 서로의 시그니처를 덮지 않는다", () => {
    const shared = makeSource("origin");
    const a = makeNode("row-1", { sourceNode: shared });
    const b = makeNode("row-2", {
      sourceNode: shared,
      props: { children: "different" },
    } as Partial<CanvasSceneNode>);

    // 개별 해시가 서로 다르고, 순서를 바꿔 여러 번 계산해도 안정적이어야 한다
    const signA = sign([a]);
    const signB = sign([b]);
    expect(signA).not.toBe(signB);
    expect(sign([a])).toBe(signA);
    expect(sign([b])).toBe(signB);
  });

  it("pageSnapshots 안의 노드 변경도 반영된다", () => {
    const body = makeNode("body-1");
    const child = makeNode("el-1");
    const pages = new Map<string, ScenePageData>([
      [PAGE_ID, { bodyElement: body, pageElements: [child] }],
    ]);
    const before = sign([], pages);

    const changedPages = new Map<string, ScenePageData>([
      [
        PAGE_ID,
        {
          bodyElement: body,
          pageElements: [
            reuseSource(child, {
              props: { ...child.props, children: "changed" },
            } as Partial<CanvasSceneNode>),
          ],
        },
      ],
    ]);

    expect(sign([], changedPages)).not.toBe(before);
  });

  it("노드 순서가 바뀌면 해시가 갈린다", () => {
    const a = makeNode("el-1");
    const b = makeNode("el-2");

    expect(sign([a, b])).not.toBe(sign([b, a]));
  });

  it("노드가 제거되면 해시가 갈린다", () => {
    const a = makeNode("el-1");
    const b = makeNode("el-2");

    expect(sign([a])).not.toBe(sign([a, b]));
  });
});

describe("projection signature — 캐시 적중 (작업량)", () => {
  it("편집 1회에서 미변경 노드는 전부 캐시 적중한다", () => {
    const nodes = Array.from({ length: 50 }, (_, i) => makeNode(`w-${i}`));

    sign(nodes); // 워밍업 — 전량 miss
    const warm = readProjectionSignatureCacheStats();

    // 불변 업데이트 1회 — 하나만 새 scene node(같은 sourceNode 재사용)
    const edited = nodes.map((node, index) =>
      index === 13
        ? (reuseSource(node, {
            props: { ...node.props, children: "edited" },
          } as Partial<CanvasSceneNode>) as CanvasSceneNode)
        : node,
    );
    sign(edited);
    const after = readProjectionSignatureCacheStats();

    const hits = after.hits - warm.hits;
    const misses = after.misses - warm.misses;

    // 50개 중 49개 적중, 편집된 1개만 miss — 요소 수와 무관한 값이라 flaky 하지 않다
    expect(hits).toBe(49);
    expect(misses).toBe(1);
  });

  it("워밍업 자체는 전량 miss 다 (계측 대조군)", () => {
    const nodes = Array.from({ length: 10 }, (_, i) => makeNode(`c-${i}`));

    const before = readProjectionSignatureCacheStats();
    sign(nodes);
    const after = readProjectionSignatureCacheStats();

    expect(after.misses - before.misses).toBe(10);
    expect(after.hits - before.hits).toBe(0);
  });
});
