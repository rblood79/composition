import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCommitPatchPlan } from "./commitPatchPlan";
import type { CanvasLayoutNode } from "../workspace/canvas/layout/layoutNode";
import type { EditorMutationDescriptor } from "./editorPresentationTypes";

/**
 * ADR-189 Phase 1 (G1) — commit dirty-root 도출.
 *
 * 검증 축은 breakdown §Phase 1 의 편집 유형 fixture 다:
 * 위치 / 크기 / 텍스트 / 스타일(paint-only) / 자식 추가·제거.
 * 각 유형에서 dirtyRootIds 가 **실제 시각 변화 범위를 포함**하는지를 본다
 * (과소 포함 = R4, 과대 포함은 성능 손실이지 정확성 결함은 아니다).
 */

/** 3층 트리: root > [sidebar, content > [text, image]] */
function buildTree(overrides?: {
  readonly nodeById?: ReadonlyMap<string, CanvasLayoutNode>;
}) {
  const node = (
    id: string,
    style: Record<string, unknown> = {},
  ): CanvasLayoutNode =>
    ({ id, props: { style } }) as unknown as CanvasLayoutNode;

  return {
    childrenByParent: new Map([
      ["root", ["sidebar", "content"]],
      ["content", ["text", "image"]],
    ]),
    parentById: new Map([
      ["root", null],
      ["sidebar", "root"],
      ["content", "root"],
      ["text", "content"],
      ["image", "content"],
    ]),
    nodeById:
      overrides?.nodeById ??
      new Map([
        ["root", node("root", { display: "flex" })],
        ["sidebar", node("sidebar", { width: "240px", height: "100px" })],
        ["content", node("content", { display: "flex" })],
        ["text", node("text")],
        ["image", node("image", { width: "40px", height: "40px" })],
      ]),
    rootKeyByNodeId: new Map([
      ["root", "page:p1"],
      ["sidebar", "page:p1"],
      ["content", "page:p1"],
      ["text", "page:p1"],
      ["image", "page:p1"],
    ]),
  };
}

const targetNode = (nodeId: string) =>
  ({ kind: "canonical-node", nodeId }) as const;

describe("ADR-189 Phase 1 — createCommitPatchPlan", () => {
  it("paint-only 스타일 편집은 승격하지 않고 자기 서브트리만 dirty 로 잡는다", () => {
    // color 는 자손에게 상속되므로 affected 는 서브트리 전체여야 한다.
    const mutation: EditorMutationDescriptor = {
      type: "style.patch",
      target: targetNode("content"),
      patch: { color: "#f00" },
    };

    const result = createCommitPatchPlan({
      mutations: [mutation],
      tree: buildTree(),
      revision: 7,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plans).toHaveLength(1);
    expect(result.plans[0].rootKey).toBe("page:p1");
    expect(result.plans[0].dirtyRootIds).toEqual(["content"]);
    expect(result.plans[0].affectedIds).toEqual(
      new Set(["content", "text", "image"]),
    );
    expect(result.plans[0].revision).toBe(7);
  });

  it("크기 편집은 used-size 축으로 부모까지 승격해 형제를 포함한다", () => {
    const mutation: EditorMutationDescriptor = {
      type: "style.patch",
      target: targetNode("text"),
      patch: { width: "300px" },
    };

    const result = createCommitPatchPlan({
      mutations: [mutation],
      tree: buildTree(),
      revision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // content 는 명시 크기가 없어 자신도 재분배 대상 → root 까지 승격한다.
    // 형제(image)와 삼촌(sidebar)이 affected 에 들어와야 시각 변화 범위를 덮는다.
    expect(result.plans[0].dirtyRootIds).toEqual(["root"]);
    expect(result.plans[0].affectedIds.has("image")).toBe(true);
    expect(result.plans[0].affectedIds.has("sidebar")).toBe(true);
  });

  it("명시 크기 조상을 만나면 승격이 거기서 멈춘다", () => {
    const base = buildTree();
    const node = (
      id: string,
      style: Record<string, unknown>,
    ): CanvasLayoutNode =>
      ({ id, props: { style } }) as unknown as CanvasLayoutNode;
    const tree = {
      ...base,
      nodeById: new Map([
        ...base.nodeById,
        // content 가 크기를 확정하면 그 위로는 재분배가 전파되지 않는다.
        [
          "content",
          node("content", {
            display: "flex",
            width: "400px",
            height: "300px",
          }),
        ],
      ]),
    };

    const result = createCommitPatchPlan({
      mutations: [
        {
          type: "style.patch",
          target: targetNode("text"),
          patch: { width: "300px" },
        },
      ],
      tree,
      revision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plans[0].dirtyRootIds).toEqual(["content"]);
    expect(result.plans[0].affectedIds.has("sidebar")).toBe(false);
  });

  it("텍스트 편집은 content-box 축으로 승격한다", () => {
    const result = createCommitPatchPlan({
      mutations: [
        {
          type: "style.patch",
          target: targetNode("text"),
          patch: { fontSize: "24px" },
        },
      ],
      tree: buildTree(),
      revision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plans[0].affectedIds.has("image")).toBe(true);
  });

  it("크기 확정 조상에서 승격이 멈춘다", () => {
    // sidebar 는 width/height 명시 → 그 위로 올라가지 않는다.
    const tree = buildTree();
    const result = createCommitPatchPlan({
      mutations: [
        {
          type: "style.patch",
          target: targetNode("sidebar"),
          patch: { padding: "8px" },
        },
      ],
      tree,
      revision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 자신은 승격 판정의 source 라 부모(root)까지 1단 올라가되, root 위는 없다.
    expect(result.plans[0].dirtyRootIds).toEqual(["root"]);
  });

  it("자식 추가는 부모를 dirty root 로 잡는다 (span 길이 변화)", () => {
    const result = createCommitPatchPlan({
      mutations: [
        {
          type: "structure.patch",
          target: targetNode("image"),
          operation: { type: "add" },
        },
      ],
      tree: buildTree(),
      revision: 3,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plans[0].dirtyRootIds).toEqual(["content"]);
    expect(result.plans[0].affectedIds).toEqual(
      new Set(["content", "text", "image"]),
    );
  });

  it("자식 제거는 제거된 노드가 새 트리에 없어도 부모 기준으로 도출된다", () => {
    // post-commit 트리에는 image 가 없다.
    const tree = {
      childrenByParent: new Map([
        ["root", ["sidebar", "content"]],
        ["content", ["text"]],
      ]),
      parentById: new Map([
        ["root", null],
        ["sidebar", "root"],
        ["content", "root"],
        ["text", "content"],
      ]),
      nodeById: buildTree().nodeById,
      rootKeyByNodeId: buildTree().rootKeyByNodeId,
    };

    const result = createCommitPatchPlan({
      mutations: [
        {
          type: "structure.patch",
          target: targetNode("image"),
          operation: { type: "remove", payload: { parentId: "content" } },
        },
      ],
      tree,
      revision: 4,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plans[0].dirtyRootIds).toEqual(["content"]);
    expect(result.plans[0].affectedIds.has("image")).toBe(false);
  });

  it("reparent 는 fail-closed — full rebuild 로 수렴한다", () => {
    const result = createCommitPatchPlan({
      mutations: [
        {
          type: "structure.patch",
          target: targetNode("image"),
          operation: { type: "reparent" },
        },
      ],
      tree: buildTree(),
      revision: 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("unsupported-structure-operation");
  });

  it("rootKey 를 알 수 없으면 fail-closed", () => {
    const tree = { ...buildTree(), rootKeyByNodeId: new Map<string, string>() };
    const result = createCommitPatchPlan({
      mutations: [
        {
          type: "style.patch",
          target: targetNode("content"),
          patch: { color: "#f00" },
        },
      ],
      tree,
      revision: 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("unknown-root-key");
  });

  it("tree node 가 없으면 fail-closed (promotion 판정 불가)", () => {
    const tree = {
      ...buildTree(),
      nodeById: new Map<string, CanvasLayoutNode>(),
    };
    const result = createCommitPatchPlan({
      mutations: [
        {
          type: "style.patch",
          target: targetNode("text"),
          patch: { width: "300px" },
        },
      ],
      tree,
      revision: 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("missing-tree-node");
  });

  it("mutation 이 없으면 fail-closed (도출할 dirty root 없음)", () => {
    const result = createCommitPatchPlan({
      mutations: [],
      tree: buildTree(),
      revision: 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("no-dirty-root");
  });

  it("여러 rootKey 는 plan 으로 분할된다", () => {
    const tree = {
      ...buildTree(),
      rootKeyByNodeId: new Map([
        ["root", "page:p1"],
        ["sidebar", "page:p1"],
        ["content", "frame:f1"],
        ["text", "frame:f1"],
        ["image", "frame:f1"],
      ]),
    };

    const result = createCommitPatchPlan({
      mutations: [
        {
          type: "style.patch",
          target: targetNode("sidebar"),
          patch: { color: "#f00" },
        },
        {
          type: "style.patch",
          target: targetNode("content"),
          patch: { color: "#0f0" },
        },
      ],
      tree,
      revision: 9,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plans).toHaveLength(2);
    expect(new Set(result.plans.map((plan) => plan.rootKey))).toEqual(
      new Set(["page:p1", "frame:f1"]),
    );
  });

  it("promotion 판정을 재구현하지 않는다 — 신규 diff 계층 0 (G1)", async () => {
    // ADR-189 R4: commit lane 이 자체 promotion 규칙을 만들면 presentation lane 과
    // dirty 범위가 갈려 시각 발산이 생긴다. 판정은 lane 의 두 심볼만 경유해야 한다.
    const source = await readFile(
      resolve(__dirname, "commitPatchPlan.ts"),
      "utf8",
    );

    expect(source).toContain('from "./editorPresentationLayoutLane"');
    expect(source).toContain("createPresentationLayoutPlan");
    expect(source).toContain("getDescriptorUsedSizeEffect");
    // 규칙표를 여기서 다시 세우는 흔적이 없어야 한다.
    expect(source).not.toContain("usedSizeEffect ===");
    expect(source).not.toContain("parentRedistributes");
    expect(source).not.toContain("isFullySized");
    expect(source).not.toMatch(/EDITOR_MUTATION_EFFECT_REGISTRY/);
  });

  it("한 target 이라도 실패하면 commit 전체가 fail-closed (부분 적용 금지)", () => {
    const result = createCommitPatchPlan({
      mutations: [
        {
          type: "style.patch",
          target: targetNode("content"),
          patch: { color: "#f00" },
        },
        {
          type: "structure.patch",
          target: targetNode("image"),
          operation: { type: "slot" },
        },
      ],
      tree: buildTree(),
      revision: 1,
    });

    expect(result.ok).toBe(false);
  });
});
