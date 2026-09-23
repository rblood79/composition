import { afterEach, describe, expect, it, vi } from "vitest";

import {
  deriveProjectRenderModelFromDocument,
  type CanonicalNode,
  type CompositionDocument,
  type ResolvedNode,
} from "@composition/shared";

import {
  applyPropsPatch,
  composePropsPatches,
} from "../../../adapters/canonical/instanceResolver";
import {
  buildCanonicalSceneModel,
  pruneDisabledSceneNodes,
} from "../../workspace/canvas/scene/canonicalSceneModel";
import { buildCanvasSceneGraph } from "../../workspace/canvas/scene/canvasSceneNode";
import {
  MAX_REF_CHAIN_DEPTH,
  resolveCanonicalDocument,
} from "../../../resolvers/canonical";
import { createResolverCache } from "../../../resolvers/canonical/cache";
import { ensureReusableCompositeOrigins } from "../reusableCompositeOrigins";

/**
 * ADR-234 Phase 1 — G1 (breakdown §4 Phase 1).
 *
 * - patch 두 연산: `composePropsPatches` (patch 끼리 — `null` 보존) · `applyPropsPatch` (해석이 끝난 값에
 *   적용 — `null` 키 제거). 리뷰 round 2 h1 의 중첩 반례 (red → blue → null) 를 두 leg 로.
 * - ref 체인: 체인 끝 instance 가 origin 구조 + 변형 patch + 자기 patch (진단 (a) 는
 *   `adr234Diagnostics.test.tsx`). origin 편집 전파 (Preview 공유 cache) · 순환 · 깊이 상한.
 * - `enabled`: 부재 = 상속 · false = 숨김 · true = 상속된 숨김 해제 · 조상 숨김은 못 푼다. Canvas
 *   scene (layout · hit test 입력) · Preview resolver · publish render model.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

function page(
  children: CanonicalNode[],
  version = "composition-1.0",
): CompositionDocument {
  return {
    version,
    children: [
      {
        id: "page-1",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-1" },
        children: [
          { id: "body-1", type: "Body", props: {}, children } as CanonicalNode,
        ],
      } as CanonicalNode,
    ],
  } as CompositionDocument;
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

const styleOf = (node: { props?: Record<string, unknown> } | undefined) =>
  (node?.props?.style ?? {}) as Record<string, unknown>;

// ── patch 두 연산 ──────────────────────────────────────────────────────────
describe("ADR-234 G1 — composePropsPatches / applyPropsPatch", () => {
  it("apply 는 null 키를 지운다 (top-level · style), compose 는 남긴다", () => {
    const base = { title: "A", style: { color: "red", padding: 24 } };
    const patch = { title: null, style: { color: null, padding: 8 } };
    expect(applyPropsPatch(base, patch)).toEqual({ style: { padding: 8 } });
    expect(composePropsPatches({ style: { color: "blue" } }, patch)).toEqual({
      title: null,
      style: { color: null, padding: 8 },
    });
    // 뒤 값이 앞 null 을 덮는다
    expect(
      composePropsPatches(
        { style: { color: null } },
        { style: { color: "x" } },
      ),
    ).toEqual({ style: { color: "x" } });
  });

  it("round 1 반례: origin 전용 키는 null patch 로 되돌린다 (원본 값이 되살아나지 않음)", () => {
    const origin = { style: { color: "red", padding: 24 } };
    expect(
      applyPropsPatch(origin, { style: { color: null, padding: null } }),
    ).toEqual({ style: {} });
  });
});

// ── 중첩 합성 반례 (round 2 h1) ────────────────────────────────────────────
// outer (instance of host) → host origin 의 inner (ref → badge, label blue) → badge 의 label (red).
// outer 가 `inner/label` color 를 null 로 지우면 label 은 color 없음 (red 로 되살아나면 RED).
function nestedDeleteDoc(): CompositionDocument {
  return page([
    {
      id: "badge",
      type: "Button",
      reusable: true,
      props: {},
      children: [
        {
          id: "label",
          type: "Text",
          props: { children: "Text", style: { color: "red" } },
        },
      ],
    } as CanonicalNode,
    {
      id: "host",
      type: "frame",
      reusable: true,
      props: {},
      children: [
        {
          id: "inner",
          type: "ref",
          ref: "badge",
          props: {},
          descendants: { label: { style: { color: "blue" } } },
        } as unknown as CanonicalNode,
      ],
    } as CanonicalNode,
    {
      id: "outer",
      type: "ref",
      ref: "host",
      props: {},
      descendants: { "inner/label": { style: { color: null } } },
    } as unknown as CanonicalNode,
  ]);
}

describe("ADR-234 G1 — 중첩 patch 합성 뒤 삭제 (round 2 h1)", () => {
  it("Preview resolver: 바깥 null 이 안쪽 blue 를 지우고 origin red 가 되살아나지 않는다", () => {
    const resolved = resolveCanonicalDocument(
      nestedDeleteDoc(),
    ) as ResolvedNode[];
    const outer = findResolved(resolved, "outer");
    const inner = (outer?.children ?? []).find((c) => c.id === "inner");
    const label = (inner?.children ?? []).find((c) => c.id === "label");
    expect(label?.props?.children).toBe("Text");
    expect(styleOf(label)).not.toHaveProperty("color");
  });

  it("Canvas scene: 같은 결과 (synthetic outer/inner/label)", () => {
    const model = buildCanonicalSceneModel(nestedDeleteDoc());
    const label = model.sceneNodesMap.get("outer/inner/label");
    expect(label?.props?.children).toBe("Text");
    expect(styleOf(label)).not.toHaveProperty("color");
  });
});

// ── 체인: origin 편집 전파 · 순환 · 깊이 ───────────────────────────────────
function chainDoc(originColor: string, version: string): CompositionDocument {
  return page(
    [
      {
        id: "origin",
        type: "Button",
        reusable: true,
        props: { children: "Base", style: { color: originColor, padding: 4 } },
      } as CanonicalNode,
      {
        id: "variant",
        type: "ref",
        ref: "origin",
        reusable: true,
        props: { style: { padding: 12 } },
      } as unknown as CanonicalNode,
      {
        id: "instance",
        type: "ref",
        ref: "variant",
        props: {},
      } as unknown as CanonicalNode,
    ],
    version,
  );
}

describe("ADR-234 G1 — ref 체인 편집 전파 · 순환 · 깊이", () => {
  it("origin 편집이 체인 끝 instance 에 닿는다 (Preview 공유 cache · Canvas scene)", () => {
    const cache = createResolverCache();
    const before = findResolved(
      resolveCanonicalDocument(chainDoc("red", "v1"), cache) as ResolvedNode[],
      "instance",
    );
    expect(styleOf(before)).toEqual({ color: "red", padding: 12 });
    const after = findResolved(
      resolveCanonicalDocument(
        chainDoc("green", "v2"),
        cache,
      ) as ResolvedNode[],
      "instance",
    );
    expect(styleOf(after)).toEqual({ color: "green", padding: 12 });

    const scene = buildCanonicalSceneModel(chainDoc("green", "v2"));
    expect(styleOf(scene.sceneNodesMap.get("instance"))).toEqual({
      color: "green",
      padding: 12,
    });
  });

  it("순환 체인은 broken ref 경로 — 두 leg 모두 origin 을 열지 않고 경고", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const doc = page([
      {
        id: "a",
        type: "ref",
        ref: "b",
        reusable: true,
        props: {},
      } as unknown as CanonicalNode,
      {
        id: "b",
        type: "ref",
        ref: "a",
        reusable: true,
        props: {},
      } as unknown as CanonicalNode,
      {
        id: "instance",
        type: "ref",
        ref: "a",
        props: {},
      } as unknown as CanonicalNode,
    ]);
    const resolved = findResolved(
      resolveCanonicalDocument(doc) as ResolvedNode[],
      "instance",
    );
    expect(resolved?.type).toBe("ref");
    expect(warn).toHaveBeenCalled();
    const scene = buildCanonicalSceneModel(doc);
    expect(scene.sceneNodesMap.get("instance")?.type).toBe("ref");
  });

  it(`깊이 상한 ${MAX_REF_CHAIN_DEPTH} — 넘는 체인은 broken, 안쪽은 해석`, () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const links = (depth: number): CanonicalNode[] => [
      {
        id: "v0",
        type: "Button",
        reusable: true,
        props: { children: "Deep" },
      } as CanonicalNode,
      ...Array.from(
        { length: depth },
        (_, index) =>
          ({
            id: `v${index + 1}`,
            type: "ref",
            ref: `v${index}`,
            reusable: true,
            props: {},
          }) as unknown as CanonicalNode,
      ),
      {
        id: "instance",
        type: "ref",
        ref: `v${depth}`,
        props: {},
      } as unknown as CanonicalNode,
    ];
    const ok = findResolved(
      resolveCanonicalDocument(page(links(3))) as ResolvedNode[],
      "instance",
    );
    expect(ok?.type).toBe("Button");
    const tooDeep = findResolved(
      resolveCanonicalDocument(
        page(links(MAX_REF_CHAIN_DEPTH + 1)),
      ) as ResolvedNode[],
      "instance",
    );
    expect(tooDeep?.type).toBe("ref");
    expect(
      buildCanonicalSceneModel(page(links(3))).sceneNodesMap.get("instance")
        ?.type,
    ).toBe("Button");
    expect(
      buildCanonicalSceneModel(
        page(links(MAX_REF_CHAIN_DEPTH + 1)),
      ).sceneNodesMap.get("instance")?.type,
    ).toBe("ref");
  });
});

// ── enabled ────────────────────────────────────────────────────────────────
// origin card: title (표시) · badge (origin 에서 숨김) · group (숨김) > deep (true).
function enabledDoc(): CompositionDocument {
  return page([
    {
      id: "card",
      type: "frame",
      reusable: true,
      props: {},
      children: [
        { id: "title", type: "Text", props: { children: "Title" } },
        {
          id: "badge",
          type: "Text",
          enabled: false,
          props: { children: "Badge" },
        } as CanonicalNode,
        {
          id: "group",
          type: "frame",
          enabled: false,
          props: {},
          children: [
            {
              id: "deep",
              type: "Text",
              enabled: true,
              props: { children: "Deep" },
            } as CanonicalNode,
          ],
        } as CanonicalNode,
      ],
    } as CanonicalNode,
    // 상속된 숨김 그대로 · title 을 숨기고 badge 를 되살림 · 조상 숨김 아래 deep true · root 숨김
    { id: "inherit", type: "ref", ref: "card", props: {} },
    {
      id: "toggled",
      type: "ref",
      ref: "card",
      props: {},
      descendants: {
        title: { enabled: false },
        badge: { enabled: true },
        "group/deep": { enabled: true },
      },
    },
    { id: "hidden-root", type: "ref", ref: "card", enabled: false, props: {} },
  ] as unknown as CanonicalNode[]);
}

function previewChildIds(doc: CompositionDocument, id: string): string[] {
  const node = findResolved(
    resolveCanonicalDocument(doc) as ResolvedNode[],
    id,
  );
  return (node?.children ?? []).map((child) => child.id);
}

describe("ADR-234 G1 — enabled 3값 (두 leg + publish)", () => {
  it("Preview resolver", () => {
    const doc = enabledDoc();
    expect(previewChildIds(doc, "card")).toEqual(["title"]);
    expect(previewChildIds(doc, "inherit")).toEqual(["title"]);
    expect(previewChildIds(doc, "toggled")).toEqual(["badge"]);
    expect(
      findResolved(
        resolveCanonicalDocument(doc) as ResolvedNode[],
        "hidden-root",
      ),
    ).toBeUndefined();
  });

  it("Canvas scene (layout · hit test 가 읽는 scene)", () => {
    const model = buildCanonicalSceneModel(enabledDoc());
    const kids = (id: string) =>
      (model.sceneChildrenByParent.get(id) ?? []).map((child) => child.id);
    expect(kids("card")).toEqual(["title"]);
    expect(kids("inherit")).toEqual(["inherit/title"]);
    expect(kids("toggled")).toEqual(["toggled/badge"]);
    expect(model.sceneNodesMap.has("toggled/group/deep")).toBe(false);
    expect(model.sceneNodesMap.has("hidden-root")).toBe(false);
    expect(model.sceneNodesMap.has("hidden-root/title")).toBe(false);
  });

  it("publish render model — 유효 false 는 subtree 째 빠진다", () => {
    const model = deriveProjectRenderModelFromDocument(enabledDoc(), "p1");
    const ids = new Set(model.elements.map((element) => element.id));
    expect(ids.has("title")).toBe(true);
    expect(ids.has("badge")).toBe(false);
    expect(ids.has("group")).toBe(false);
    expect(ids.has("deep")).toBe(false);
    expect(ids.has("hidden-root")).toBe(false);
  });

  it("publish render model — ref 체인 끝 instance 는 origin type · 접힌 props", () => {
    const model = deriveProjectRenderModelFromDocument(
      chainDoc("red", "v1"),
      "p1",
    );
    const instance = model.elements.find(
      (element) => element.id === "instance",
    );
    expect(instance?.type).toBe("Button");
    expect((instance?.props as { style?: unknown }).style).toEqual({
      color: "red",
      padding: 12,
    });
  });

  it("필드 부재 문서 Δ0 — 숨긴 노드가 없으면 scene graph 를 그대로 돌려준다 (seed 문서)", () => {
    const doc = ensureReusableCompositeOrigins({
      version: "composition-1.0",
      children: [],
    } as CompositionDocument);
    const graph = buildCanvasSceneGraph(doc, { includeReusableFrames: true });
    expect(pruneDisabledSceneNodes(graph)).toBe(graph);
  });
});
