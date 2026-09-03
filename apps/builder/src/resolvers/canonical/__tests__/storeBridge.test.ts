/**
 * @fileoverview storeBridge helper 단위 테스트 — ADR-903 P2 D-B + P3-B
 *
 * 검증 대상:
 * - `selectResolvedTree(doc, cache?)` — canonical document 진입점
 * - `buildResolvedNodeIndex(tree)` — DFS flatten Map
 * - `extractCanonicalPropsFromResolved(resolved)` — canonical props 추출
 * - `resolveInstanceWithSharedCache(instance, master, cache?)` — mini-doc + cache 통과한
 *   Element 재구성 — mergePropsWithStyleDeep oracle 과 시각 등가성 보장
 * - `buildParentIndex(tree)` — DFS child → parent id Map (P3-B)
 * - `getCanonicalParentId(index, elementId)` — canonical parent id 조회 (P3-B)
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { Element } from "@/types/builder/unified.types";
import type {
  CompositionDocument,
  RefNode,
  ResolvedNode,
} from "@composition/shared";

import {
  getComponentMasterReference,
  getComponentOverridesMirror,
  isComponentInstanceMirrorElement,
  withComponentInstanceMirror,
  withComponentOriginMirror,
} from "@/adapters/canonical/componentSemanticsMirror";
import { mergePropsWithStyleDeep } from "@/utils/component/instanceResolver";
import {
  buildResolvedNodeIndex,
  buildParentIndex,
  extractCanonicalPropsFromResolved,
  getCanonicalParentId,
  prefetchResolvedTreeImports,
  resolveInstanceWithSharedCache,
  selectResolvedTree,
} from "../storeBridge";
import {
  createResolverCache,
  resetSharedResolverCache,
  getSharedResolverCache,
} from "../cache";
import {
  createCanonicalImportRegistry,
  resetSharedImportRegistry,
} from "../importRegistry";

// ─────────────────────────────────────────────────────────────────────────────
// fixture helpers (integration.test.ts 패턴 공유)
// ─────────────────────────────────────────────────────────────────────────────

function expectedMergedInstanceProps(
  instance: Element,
  master: Element,
): Record<string, unknown> {
  return mergePropsWithStyleDeep(
    master.props || {},
    getComponentOverridesMirror(instance) ?? {},
  );
}

function el(partial: Partial<Element> & Pick<Element, "id" | "type">): Element {
  return {
    props: {},
    parent_id: null,
    order_num: 0,
    ...partial,
  } as Element;
}

// ─────────────────────────────────────────────────────────────────────────────
// selectResolvedTree
// ─────────────────────────────────────────────────────────────────────────────

describe("selectResolvedTree", () => {
  beforeEach(() => {
    resetSharedResolverCache();
    resetSharedImportRegistry();
  });

  it("TC1: master + instance document → ResolvedNode[] (instance 는 _resolvedFrom 세팅)", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "MasterBtn",
          type: "Button",
          reusable: true,
          props: { label: "Submit", color: "blue" },
        },
        {
          id: "P1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "P1" },
          children: [
            {
              id: "InstanceBtn",
              type: "ref",
              ref: "MasterBtn",
              props: { label: "Send" },
            } as RefNode,
          ],
        },
      ],
    };

    const cache = createResolverCache();
    const tree = selectResolvedTree(doc, cache);

    // top-level: reusable master 1+ 개 + pageNodes — reusable 노드 존재 확인
    const reusableNodes = tree.filter((n) => n.reusable === true);
    expect(reusableNodes.length).toBeGreaterThanOrEqual(1);

    // instance 의 segId 는 customId 기반 ("InstanceBtn") — DFS index 로 lookup
    const index = buildResolvedNodeIndex(tree);
    const instanceResolved = index.get("InstanceBtn");
    expect(instanceResolved).toBeDefined();
    // _resolvedFrom 은 ref 의 stable master id path ("MasterBtn")
    expect(instanceResolved?._resolvedFrom).toBe("MasterBtn");
  });

  it("TC2: 동일 state 에 대한 반복 호출은 shared cache 로 ref subtree hit 보장", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "master-A",
          type: "Button",
          reusable: true,
          props: { label: "A" },
        },
        {
          id: "P1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "P1" },
          children: [
            { id: "inst-A1", type: "ref", ref: "master-A" } as RefNode,
            { id: "inst-A2", type: "ref", ref: "master-A" } as RefNode,
          ],
        },
      ],
    };

    const cache = createResolverCache();

    const before = cache.stats();
    expect(before.hits).toBe(0);

    selectResolvedTree(doc, cache);
    const afterFirst = cache.stats();
    expect(afterFirst.misses).toBeGreaterThan(0);
    expect(afterFirst.size).toBeGreaterThan(0);

    selectResolvedTree(doc, cache);
    const afterSecond = cache.stats();
    // 2 번째 호출은 동일 ref subtree 에 대해 hit 발생
    expect(afterSecond.hits).toBeGreaterThan(afterFirst.hits);
  });

  it("TC2b: prefetched import registry 를 통해 import namespace ref 를 resolve 한다", async () => {
    const registry = createCanonicalImportRegistry(async () => ({
      version: "composition-1.0",
      children: [
        {
          id: "round-button",
          type: "Button",
          reusable: true,
          props: { label: "Imported" },
        },
      ],
    }));
    const doc: CompositionDocument = {
      version: "composition-1.0",
      imports: { kit: "./kit.pen" },
      children: [
        { id: "inst", type: "ref", ref: "kit:round-button" } as RefNode,
      ],
    };

    const result = await prefetchResolvedTreeImports(doc, registry);
    const tree = selectResolvedTree(doc, createResolverCache(), registry);

    expect(result).toEqual({
      loaded: [{ importKey: "kit", source: "./kit.pen" }],
      failed: [],
    });
    expect(tree[0]).toEqual(
      expect.objectContaining({
        id: "inst",
        type: "Button",
        props: { label: "Imported" },
        _resolvedFrom: "kit:round-button",
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildResolvedNodeIndex
// ─────────────────────────────────────────────────────────────────────────────

describe("buildResolvedNodeIndex", () => {
  it("TC3: 중첩 트리 DFS flatten — 모든 id 가 index 에 등록됨", () => {
    const tree: ResolvedNode[] = [
      {
        id: "root",
        type: "frame",
        children: [
          {
            id: "child-A",
            type: "Button",
            children: [{ id: "grand-1", type: "Text" }],
          },
          { id: "child-B", type: "Button" },
        ],
      },
    ];

    const index = buildResolvedNodeIndex(tree);

    expect(index.size).toBe(4);
    expect(index.get("root")?.type).toBe("frame");
    expect(index.get("child-A")?.type).toBe("Button");
    expect(index.get("grand-1")?.type).toBe("Text");
    expect(index.get("child-B")?.type).toBe("Button");
  });

  it("TC4: children 없는 노드도 정상 처리", () => {
    const tree: ResolvedNode[] = [{ id: "solo", type: "Text" }];
    const index = buildResolvedNodeIndex(tree);
    expect(index.size).toBe(1);
    expect(index.get("solo")?.type).toBe("Text");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// extractCanonicalPropsFromResolved
// ─────────────────────────────────────────────────────────────────────────────

describe("extractCanonicalPropsFromResolved", () => {
  it("TC5: props 필드 존재 — 그 값을 shallow copy 로 반환", () => {
    const node: ResolvedNode = {
      id: "n1",
      type: "Button",
      props: { label: "Hello", color: "red" },
    };
    const props = extractCanonicalPropsFromResolved(node);
    expect(props).toEqual({ label: "Hello", color: "red" });
    expect(props).not.toBe(node.props);
  });

  it("TC6: metadata 만 있는 노드는 props extraction 대상이 아니다", () => {
    const node: ResolvedNode = {
      id: "n1",
      type: "Button",
      metadata: {
        type: "debug",
        label: "Direct",
        color: "blue",
      },
    };
    expect(extractCanonicalPropsFromResolved(node)).toEqual({});
  });

  it("TC7: metadata 없으면 빈 객체", () => {
    const node: ResolvedNode = { id: "n1", type: "Button" };
    expect(extractCanonicalPropsFromResolved(node)).toEqual({});
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveInstanceWithSharedCache  (시각 대칭 보장 — legacy 와 동일 결과)
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveInstanceWithSharedCache", () => {
  beforeEach(() => {
    resetSharedResolverCache();
  });

  it("TC9: instance + master → tag=master.tag, props=merged (legacy 와 deep-equal)", () => {
    const master: Element = withComponentOriginMirror(
      el({
        id: "m1",
        type: "Button",
        props: {
          label: "Submit",
          style: { color: "red", fontSize: 14 },
          isDisabled: false,
        },
      }),
    );
    const instance: Element = withComponentInstanceMirror(
      el({
        id: "i1",
        type: "Button",
      }),
      "m1",
      { overrideProps: { label: "Send", style: { color: "blue" } } },
    );

    const canonical = resolveInstanceWithSharedCache(instance, master);
    const expectedProps = expectedMergedInstanceProps(instance, master);

    expect(canonical).not.toBeNull();
    expect(canonical?.type).toBe("Button");
    expect(canonical?.id).toBe("i1");
    // style 심층 병합 포함 props 완전 일치 — ADR-903 Decision 시각 대칭
    expect(canonical?.props).toEqual(expectedProps);
  });

  it("TC10: master 없음 → null (caller 는 element 그대로 처리)", () => {
    const instance: Element = withComponentInstanceMirror(
      el({
        id: "i1",
        type: "Button",
      }),
      "m-missing",
    );
    expect(resolveInstanceWithSharedCache(instance, undefined)).toBeNull();
  });

  it("TC11: 비-instance element → null (caller 는 element 그대로 처리)", () => {
    const regular: Element = el({
      id: "r1",
      type: "Button",
      props: { label: "Plain" },
    });
    // master 가 있어도 instance 가 아니면 null
    expect(resolveInstanceWithSharedCache(regular, regular)).toBeNull();
  });

  it("TC12: 동일 (instance, master) pair 반복 호출 — shared cache hit", () => {
    const master: Element = withComponentOriginMirror(
      el({
        id: "m1",
        type: "Button",
        props: { label: "Submit" },
      }),
    );
    const instance: Element = withComponentInstanceMirror(
      el({
        id: "i1",
        type: "Button",
      }),
      "m1",
      { overrideProps: { label: "Send" } },
    );

    const cache = createResolverCache();
    const before = cache.stats();
    expect(before.hits).toBe(0);

    resolveInstanceWithSharedCache(instance, master, cache);
    resolveInstanceWithSharedCache(instance, master, cache);
    const after = cache.stats();

    expect(after.hits).toBeGreaterThan(0);
  });

  it("TC13: singleton 기본값 사용 — 명시 cache 없이 getSharedResolverCache 공유", () => {
    const master: Element = withComponentOriginMirror(
      el({
        id: "m-singleton",
        type: "Button",
        props: { label: "Singleton" },
      }),
    );
    const instance: Element = withComponentInstanceMirror(
      el({
        id: "i-singleton",
        type: "Button",
      }),
      "m-singleton",
    );

    const shared = getSharedResolverCache();
    const before = shared.stats();

    resolveInstanceWithSharedCache(instance, master);
    const afterFirst = shared.stats();
    expect(afterFirst.size).toBeGreaterThan(before.size);

    resolveInstanceWithSharedCache(instance, master);
    const afterSecond = shared.stats();
    expect(afterSecond.hits).toBeGreaterThan(afterFirst.hits);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// D-C 안전망 — advanced 회귀 케이스 (legacy fallback 제거 전제 검증)
//
// `useResolvedElement` (D-B) 와 `StoreRenderBridge.buildNodeForElement` (D-C)
// 모두 canonical 우선 + legacy fallback 전략을 사용한다. 다음 세션에 fallback
// 제거를 안전하게 하기 위해 다양한 master/instance/overrides 조합을 fuzz 한다.
//
// 모든 케이스는 `resolveInstanceWithSharedCache` 결과가
// mergePropsWithStyleDeep oracle 과 deep-equal 임을 검증.
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveInstanceWithSharedCache — D-C 안전망 회귀", () => {
  beforeEach(() => {
    resetSharedResolverCache();
  });

  it("TC14: 빈 overrides — instance 가 master props 그대로 상속", () => {
    const master: Element = withComponentOriginMirror(
      el({
        id: "m1",
        type: "Button",
        props: {
          label: "MasterOnly",
          style: { color: "red", fontSize: 14, padding: 8 },
        },
      }),
    );
    const instance: Element = withComponentInstanceMirror(
      el({
        id: "i1",
        type: "Button",
      }),
      "m1",
      { overrideProps: {} },
    );
    const canonical = resolveInstanceWithSharedCache(instance, master);
    const expectedProps = expectedMergedInstanceProps(instance, master);
    expect(canonical?.props).toEqual(expectedProps);
    expect(canonical?.props.label).toBe("MasterOnly");
  });

  it("TC15: overrides 가 undefined — instance 가 master props 그대로 상속", () => {
    const master: Element = withComponentOriginMirror(
      el({
        id: "m2",
        type: "Box",
        props: { width: 100, height: 50 },
      }),
    );
    const instance: Element = withComponentInstanceMirror(
      el({
        id: "i2",
        type: "Box",
      }),
      "m2",
    );
    const canonical = resolveInstanceWithSharedCache(instance, master);
    const expectedProps = expectedMergedInstanceProps(instance, master);
    expect(canonical?.props).toEqual(expectedProps);
  });

  it("TC16: nested style merge — color 만 override, fontSize/padding 은 master 보존", () => {
    const master: Element = withComponentOriginMirror(
      el({
        id: "m3",
        type: "Text",
        props: {
          children: "Hello",
          style: {
            color: "black",
            fontSize: 16,
            padding: 8,
            fontWeight: 400,
          },
        },
      }),
    );
    const instance: Element = withComponentInstanceMirror(
      el({
        id: "i3",
        type: "Text",
      }),
      "m3",
      {
        overrideProps: {
          style: { color: "red" },
        },
      },
    );
    const canonical = resolveInstanceWithSharedCache(instance, master);
    const expectedProps = expectedMergedInstanceProps(instance, master);
    expect(canonical?.props).toEqual(expectedProps);

    const style = canonical?.props.style as Record<string, unknown>;
    expect(style.color).toBe("red");
    expect(style.fontSize).toBe(16);
    expect(style.padding).toBe(8);
    expect(style.fontWeight).toBe(400);
  });

  it("TC17: scalar override 가 master scalar 를 완전 교체 (style 외 필드)", () => {
    const master: Element = withComponentOriginMirror(
      el({
        id: "m4",
        type: "Button",
        props: { label: "Original", isDisabled: false },
      }),
    );
    const instance: Element = withComponentInstanceMirror(
      el({
        id: "i4",
        type: "Button",
      }),
      "m4",
      { overrideProps: { label: "Overridden", isDisabled: true } },
    );
    const canonical = resolveInstanceWithSharedCache(instance, master);
    const expectedProps = expectedMergedInstanceProps(instance, master);
    expect(canonical?.props).toEqual(expectedProps);
    expect(canonical?.props.label).toBe("Overridden");
    expect(canonical?.props.isDisabled).toBe(true);
  });

  it("TC18: 다중 instance 가 같은 master 참조 — 각각 다른 props 산출", () => {
    const master: Element = withComponentOriginMirror(
      el({
        id: "m5",
        type: "Button",
        props: { label: "Default", variant: "primary" },
      }),
    );
    const instances: Element[] = [
      withComponentInstanceMirror(
        el({
          id: "i5a",
          type: "Button",
        }),
        "m5",
        { overrideProps: { label: "A" } },
      ),
      withComponentInstanceMirror(
        el({
          id: "i5b",
          type: "Button",
        }),
        "m5",
        { overrideProps: { label: "B", variant: "secondary" } },
      ),
      withComponentInstanceMirror(
        el({
          id: "i5c",
          type: "Button",
        }),
        "m5",
        { overrideProps: {} },
      ),
    ];

    const cache = createResolverCache();
    const results = instances.map((inst) =>
      resolveInstanceWithSharedCache(inst, master, cache),
    );
    const expectedResults = instances.map((inst) =>
      expectedMergedInstanceProps(inst, master),
    );

    // 각 instance 가 자신의 overrides 와 머지된 props 산출
    expect(results[0]?.props.label).toBe("A");
    expect(results[0]?.props.variant).toBe("primary"); // master 보존
    expect(results[1]?.props.label).toBe("B");
    expect(results[1]?.props.variant).toBe("secondary"); // override
    expect(results[2]?.props.label).toBe("Default"); // master 그대로
    expect(results[2]?.props.variant).toBe("primary");

    // 모두 merge oracle 과 deep-equal
    for (let i = 0; i < instances.length; i++) {
      expect(results[i]?.props).toEqual(expectedResults[i]);
    }
  });

  it("TC19: master.tag !== instance.tag (createInstance 후 master 가 변경된 케이스) — canonical 결과 tag = master.tag", () => {
    // createInstance 시 instance.tag = master.tag 로 시작하지만, 후속에 master 가
    // 다른 tag 로 변경된다면 instance 도 master.tag 를 따라가야 함 (legacy 동작).
    const master: Element = withComponentOriginMirror(
      el({
        id: "m6",
        type: "Box", // master 가 Button → Box 로 바뀜
        props: { width: 100 },
      }),
    );
    const instance: Element = withComponentInstanceMirror(
      el({
        id: "i6",
        type: "Button", // 옛 tag 잔존
      }),
      "m6",
    );

    const canonical = resolveInstanceWithSharedCache(instance, master);
    const expectedProps = expectedMergedInstanceProps(instance, master);

    expect(canonical?.type).toBe("Box");
    expect(canonical?.props).toEqual(expectedProps);
  });

  it("TC20: instance.id 보존 — master.id 로 덮어쓰지 않음", () => {
    const master: Element = withComponentOriginMirror(
      el({
        id: "m7",
        type: "Button",
        props: { label: "M" },
      }),
    );
    const instance: Element = withComponentInstanceMirror(
      el({
        id: "i7-unique",
        type: "Button",
      }),
      "m7",
      { overrideProps: { label: "I" } },
    );
    const canonical = resolveInstanceWithSharedCache(instance, master);
    expect(canonical?.id).toBe("i7-unique");
    // 다른 instance 메타필드도 보존 — adapter helper 경유 (legacy field direct access 회피)
    expect(canonical && isComponentInstanceMirrorElement(canonical)).toBe(true);
    expect(canonical && getComponentMasterReference(canonical)).toBe("m7");
  });

  // P3-B tests are appended after TC21

  it("TC21: deeply-nested style 객체 — color + 추가 필드 (border) 머지", () => {
    const master: Element = withComponentOriginMirror(
      el({
        id: "m8",
        type: "Box",
        props: {
          style: {
            color: "black",
            backgroundColor: "white",
            padding: 8,
          },
        },
      }),
    );
    const instance: Element = withComponentInstanceMirror(
      el({
        id: "i8",
        type: "Box",
      }),
      "m8",
      {
        overrideProps: {
          style: {
            color: "red",
            border: "1px solid blue", // master 에 없는 새 필드
          },
        },
      },
    );
    const canonical = resolveInstanceWithSharedCache(instance, master);
    const expectedProps = expectedMergedInstanceProps(instance, master);

    expect(canonical?.props).toEqual(expectedProps);
    const style = canonical?.props.style as Record<string, unknown>;
    expect(style.color).toBe("red"); // override
    expect(style.backgroundColor).toBe("white"); // master 보존
    expect(style.padding).toBe(8); // master 보존
    expect(style.border).toBe("1px solid blue"); // override 신규
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P3-B: buildParentIndex + getCanonicalParentId
//
// ADR-903 P3-D-5 사용 패턴: `getCanonicalParentId(index, el.id) === id`
// 설계 문서: docs/adr/design/903-phase3d-runtime-breakdown.md §4.5
// ─────────────────────────────────────────────────────────────────────────────

describe("buildParentIndex", () => {
  it("TC-P1: root 노드의 parentId → 없음 (Map에 등록 안 됨)", () => {
    const tree: ResolvedNode[] = [{ id: "root", type: "frame" }];
    const index = buildParentIndex(tree);
    // root 는 부모가 없으므로 등록 안 됨
    expect(index.has("root")).toBe(false);
  });

  it("TC-P2: 1단 child → 부모 id 가 Map에 등록됨", () => {
    const tree: ResolvedNode[] = [
      {
        id: "root",
        type: "frame",
        children: [
          { id: "child-A", type: "Button" },
          { id: "child-B", type: "Text" },
        ],
      },
    ];
    const index = buildParentIndex(tree);
    expect(index.get("child-A")).toBe("root");
    expect(index.get("child-B")).toBe("root");
  });

  it("TC-P3: 3단 중첩 — 각 노드가 직속 부모 id 를 가짐", () => {
    const tree: ResolvedNode[] = [
      {
        id: "page",
        type: "frame",
        children: [
          {
            id: "section",
            type: "Section",
            children: [
              {
                id: "card",
                type: "Card",
                children: [{ id: "label", type: "Label" }],
              },
            ],
          },
        ],
      },
    ];
    const index = buildParentIndex(tree);
    expect(index.get("section")).toBe("page");
    expect(index.get("card")).toBe("section");
    expect(index.get("label")).toBe("card");
    // root 는 부모 없음
    expect(index.has("page")).toBe(false);
  });

  it("TC-P4: 복수 root 노드 — 각 root 의 자식 모두 등록", () => {
    const tree: ResolvedNode[] = [
      {
        id: "frame-1",
        type: "frame",
        children: [{ id: "btn-1", type: "Button" }],
      },
      {
        id: "frame-2",
        type: "frame",
        children: [{ id: "btn-2", type: "Button" }],
      },
    ];
    const index = buildParentIndex(tree);
    expect(index.get("btn-1")).toBe("frame-1");
    expect(index.get("btn-2")).toBe("frame-2");
    expect(index.has("frame-1")).toBe(false);
    expect(index.has("frame-2")).toBe(false);
  });
});

describe("getCanonicalParentId", () => {
  it("TC-P5: root element → null (부모 없음)", () => {
    const tree: ResolvedNode[] = [
      {
        id: "root",
        type: "frame",
        children: [{ id: "child", type: "Button" }],
      },
    ];
    const index = buildParentIndex(tree);
    expect(getCanonicalParentId(index, "root")).toBeNull();
  });

  it("TC-P6: 1단 child → root id 반환", () => {
    const tree: ResolvedNode[] = [
      {
        id: "root",
        type: "frame",
        children: [{ id: "child", type: "Button" }],
      },
    ];
    const index = buildParentIndex(tree);
    expect(getCanonicalParentId(index, "child")).toBe("root");
  });

  it("TC-P7: 3단 중첩 child → 직속 부모 id 반환 (조상 아님)", () => {
    const tree: ResolvedNode[] = [
      {
        id: "page",
        type: "frame",
        children: [
          {
            id: "section",
            type: "Section",
            children: [{ id: "deep", type: "Button" }],
          },
        ],
      },
    ];
    const index = buildParentIndex(tree);
    // deep 의 직속 부모는 section (page 아님)
    expect(getCanonicalParentId(index, "deep")).toBe("section");
    expect(getCanonicalParentId(index, "deep")).not.toBe("page");
  });

  it("TC-P8: 존재하지 않는 elementId → null", () => {
    const tree: ResolvedNode[] = [{ id: "root", type: "frame" }];
    const index = buildParentIndex(tree);
    expect(getCanonicalParentId(index, "nonexistent-id")).toBeNull();
  });

  it("TC-P9: ref instance (reusable master child) → instance root id 반환", () => {
    // ResolvedNode 트리에서 ref instance 는 _resolvedFrom 을 가짐.
    // buildParentIndex 는 resolved tree 의 실제 구조 기준으로 parent 를 기록하므로
    // instance 의 부모 = instance 를 children 으로 포함한 노드의 id.
    const tree: ResolvedNode[] = [
      {
        id: "page-node",
        type: "frame",
        children: [
          {
            id: "instance-btn",
            type: "Button",
            _resolvedFrom: "master-btn",
            children: [{ id: "instance-label", type: "Label" }],
          },
        ],
      },
    ];
    const index = buildParentIndex(tree);
    // instance 자체의 부모 = page-node
    expect(getCanonicalParentId(index, "instance-btn")).toBe("page-node");
    // instance 의 resolved 자식 부모 = instance-btn
    expect(getCanonicalParentId(index, "instance-label")).toBe("instance-btn");
  });
});
