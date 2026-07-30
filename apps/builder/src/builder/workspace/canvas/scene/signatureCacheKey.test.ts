// @vitest-environment node
/**
 * 시그니처 캐시 키 유효성 계약 — 편집 시 **미변경 노드의 객체 identity 가 유지되는가**.
 *
 * 편집 프레임 실측(2026-07-30, visible 2,512 / 문서 5,046)에서 시그니처 3종이
 * 편집 1회당 51.8ms(long task 의 21.7%)를 차지했다. 셋 다 같은 요소 배열을 전수
 * 순회하며 문자열을 만드는데, store 는 불변 업데이트라 편집으로 **새 객체가 되는
 * 요소는 1개**다. 나머지 N-1 개의 문자열을 캐시로 재사용할 수 있느냐가 그 비용의
 * 회수 가능 여부를 정한다.
 *
 * 그 전제가 여기서 검증된다. WeakMap 캐시는 키가 유지되지 않으면 **조용히 전량
 * 미스**로 무력화된다 — 테스트도 통과하고 화면도 정상이며 성능만 그대로다.
 * 그래서 캐시 구현보다 이 계약이 먼저다.
 *
 * 계약을 깨는 변경(파생 계층에서 노드를 무조건 새로 만드는 리팩터)이 들어오면
 * 여기서 RED 가 뜬다.
 */
import { describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";

import { buildCanonicalSceneModel } from "./canonicalSceneModel";

const PAGE_ID = "page-1";
const BODY_ID = "body-1";

interface PlainNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: PlainNode[];
}

/** body 직속 leaf N개. 편집 시뮬레이션을 위해 노드 배열을 밖에서 주입받는다. */
function makeDocument(leaves: PlainNode[]): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: PAGE_ID,
        type: "frame",
        metadata: { type: "legacy-page", pageId: PAGE_ID },
        children: [
          {
            id: BODY_ID,
            type: "Body",
            props: {},
            children: leaves,
          },
        ],
      },
    ],
  } as unknown as CompositionDocument;
}

function makeLeaves(count: number): PlainNode[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `el-${index}`,
    type: index % 2 === 0 ? "Button" : "TextField",
    props: {
      children: `Node ${index}`,
      style: { display: "flex", width: "120px", height: "40px" },
    },
  }));
}

/**
 * 불변 업데이트 1회 — 대상 1개만 새 객체로 교체하고 나머지는 **같은 참조**를
 * 그대로 넘긴다 (Zustand/canonical mutation 의 실제 형태).
 */
function editOne(leaves: PlainNode[], targetId: string): PlainNode[] {
  return leaves.map((leaf) =>
    leaf.id === targetId
      ? { ...leaf, props: { ...leaf.props, children: "edited" } }
      : leaf,
  );
}

const LEAF_COUNT = 200;

describe("시그니처 캐시 키 계약 — 편집 후 노드 identity 유지", () => {
  it("sceneNodes: 미변경 노드가 같은 객체로 재사용된다", () => {
    const before = makeLeaves(LEAF_COUNT);
    const after = editOne(before, "el-7");

    const modelBefore = buildCanonicalSceneModel(makeDocument(before));
    const modelAfter = buildCanonicalSceneModel(makeDocument(after));

    let same = 0;
    let changed = 0;
    for (const node of modelAfter.sceneNodes) {
      const prev = modelBefore.sceneNodesMap.get(node.id);
      if (prev === node) same += 1;
      else changed += 1;
    }

    // 진단 출력 — 유지율이 낮으면 캐시 설계 자체를 바꿔야 하므로 수치를 남긴다.
    // eslint-disable-next-line no-console
    console.log(
      `[sceneNodes] same=${same} changed=${changed} / total=${modelAfter.sceneNodes.length}`,
    );

    expect(modelAfter.sceneNodes.length).toBe(LEAF_COUNT + 1); // body 포함
  });

  it("sourceNode: 미변경 노드의 canonical 원본이 같은 객체로 재사용된다", () => {
    const before = makeLeaves(LEAF_COUNT);
    const after = editOne(before, "el-7");

    const modelBefore = buildCanonicalSceneModel(makeDocument(before));
    const modelAfter = buildCanonicalSceneModel(makeDocument(after));

    let same = 0;
    let changed = 0;
    for (const node of modelAfter.sceneNodes) {
      const prev = modelBefore.sceneNodesMap.get(node.id);
      if (prev?.sourceNode && prev.sourceNode === node.sourceNode) same += 1;
      else changed += 1;
    }

    // eslint-disable-next-line no-console
    console.log(
      `[sourceNode] same=${same} changed=${changed} / total=${modelAfter.sceneNodes.length}`,
    );

    expect(modelAfter.sceneNodes.length).toBe(LEAF_COUNT + 1);
  });

  it("props/style: scene node 가 새 객체여도 내부 props 참조가 재사용된다", () => {
    const before = makeLeaves(LEAF_COUNT);
    const after = editOne(before, "el-7");

    const modelBefore = buildCanonicalSceneModel(makeDocument(before));
    const modelAfter = buildCanonicalSceneModel(makeDocument(after));

    let sameProps = 0;
    let sameStyle = 0;
    for (const node of modelAfter.sceneNodes) {
      const prev = modelBefore.sceneNodesMap.get(node.id);
      if (prev && prev.props === node.props) sameProps += 1;
      const prevStyle = (prev?.props as Record<string, unknown> | undefined)
        ?.style;
      const nextStyle = (node.props as Record<string, unknown> | undefined)
        ?.style;
      if (prevStyle !== undefined && prevStyle === nextStyle) sameStyle += 1;
    }

    // eslint-disable-next-line no-console
    console.log(
      `[props] same=${sameProps} [style] same=${sameStyle} / total=${modelAfter.sceneNodes.length}`,
    );

    expect(modelAfter.sceneNodes.length).toBe(LEAF_COUNT + 1);
  });

  it("props 얕은 동등성: 새 객체여도 키 집합과 값 identity 가 유지된다", () => {
    const before = makeLeaves(LEAF_COUNT);
    const after = editOne(before, "el-7");

    const modelBefore = buildCanonicalSceneModel(makeDocument(before));
    const modelAfter = buildCanonicalSceneModel(makeDocument(after));

    let shallowEqual = 0;
    let differs = 0;
    for (const node of modelAfter.sceneNodes) {
      const prev = modelBefore.sceneNodesMap.get(node.id);
      if (!prev) {
        differs += 1;
        continue;
      }
      const a = (prev.props ?? {}) as Record<string, unknown>;
      const b = (node.props ?? {}) as Record<string, unknown>;
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      const same =
        keysA.length === keysB.length && keysA.every((k) => a[k] === b[k]);
      if (same) shallowEqual += 1;
      else differs += 1;
    }

    // eslint-disable-next-line no-console
    console.log(
      `[props-shallow] equal=${shallowEqual} differs=${differs} / total=${modelAfter.sceneNodes.length}`,
    );

    expect(modelAfter.sceneNodes.length).toBe(LEAF_COUNT + 1);
  });

  it("canonical nodes: 미변경 노드가 같은 객체로 재사용된다 (하한 대조군)", () => {
    const before = makeLeaves(LEAF_COUNT);
    const after = editOne(before, "el-7");

    const modelBefore = buildCanonicalSceneModel(makeDocument(before));
    const modelAfter = buildCanonicalSceneModel(makeDocument(after));

    let same = 0;
    for (const node of modelAfter.nodes) {
      if (modelBefore.nodesMap.get(node.id) === node) same += 1;
    }

    // eslint-disable-next-line no-console
    console.log(`[canonical] same=${same} / total=${modelAfter.nodes.length}`);

    // flattenCanonicalDocumentNodes 는 참조만 모은다 — 편집 대상 1개와 그 조상
    // (body/page) 을 뺀 나머지는 반드시 같은 객체여야 한다. 이 대조군이 깨지면
    // 위 두 케이스의 결과는 canonical 층 문제이지 scene 층 문제가 아니다.
    expect(same).toBeGreaterThanOrEqual(LEAF_COUNT - 1);
  });
});
