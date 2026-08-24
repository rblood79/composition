// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import { clearSkiaRegistry, registerSkiaNode } from "./useSkiaNode";
import { setDragVisualOffset } from "./nodeRendererTree";
import {
  buildRenderCommandStream,
  getCommandBufferSpliceWriteCount,
  type RenderCommandStream,
} from "./renderCommands";
import {
  applyCommitSubtreeCommandPatch,
  applySubtreeCommandPatch,
  getSubtreeElementIds,
} from "./subtreeCommandPatch";

function makeElement(
  id: string,
  overrides: Partial<CanvasSceneNode> = {},
): CanvasSceneNode {
  return {
    id,
    type: "Box",
    page_id: "page-1",
    parent_id: null,
    order_num: 0,
    props: {},
    deleted: false,
    ...overrides,
  } as CanvasSceneNode;
}

function registerNode(
  id: string,
  overrides: Record<string, unknown> = {},
): void {
  registerSkiaNode(id, {
    elementId: id,
    height: 100,
    type: "container",
    visible: true,
    width: 100,
    x: 0,
    y: 0,
    ...overrides,
  } as never);
}

interface FixtureOptions {
  readonly leafY?: number;
  readonly bodyClipChildren?: boolean;
  readonly includeSecondLeaf?: boolean;
  readonly includeTrailingLeaf?: boolean;
  readonly leafDamageUnsafe?: boolean;
  readonly revision?: number;
}

function buildFixture(options: FixtureOptions = {}): RenderCommandStream {
  const body = makeElement("patch-body", { type: "body" });
  const owner = makeElement("patch-owner", { parent_id: body.id });
  const leaf = makeElement("patch-leaf", { parent_id: owner.id });
  const secondLeaf = makeElement("patch-second-leaf", { parent_id: owner.id });
  const trailingLeaf = makeElement("patch-trailing-leaf", {
    parent_id: body.id,
  });

  registerNode(body.id, {
    width: 800,
    height: 600,
    clipChildren: options.bodyClipChildren ?? false,
  });
  registerNode(owner.id, { width: 400, height: 300 });
  registerNode(leaf.id, {
    width: 80,
    height: 40,
    effects: options.leafDamageUnsafe
      ? [{ type: "opacity", opacity: 0.5 }]
      : undefined,
  });
  if (options.includeSecondLeaf) {
    registerNode(secondLeaf.id, { width: 80, height: 40 });
  }
  if (options.includeTrailingLeaf) {
    registerNode(trailingLeaf.id, { width: 80, height: 40 });
  }

  const children = new Map<string, CanvasSceneNode[]>([
    [body.id, options.includeTrailingLeaf ? [owner, trailingLeaf] : [owner]],
    [owner.id, options.includeSecondLeaf ? [leaf, secondLeaf] : [leaf]],
  ]);
  const layout = new Map<string, ComputedLayout>([
    [owner.id, { x: 20, y: 30, width: 400, height: 300 } as ComputedLayout],
    [
      leaf.id,
      {
        x: 10,
        y: options.leafY ?? 20,
        width: 80,
        height: 40,
      } as ComputedLayout,
    ],
  ]);
  if (options.includeSecondLeaf) {
    layout.set(secondLeaf.id, {
      x: 100,
      y: 20,
      width: 80,
      height: 40,
    } as ComputedLayout);
  }
  if (options.includeTrailingLeaf) {
    layout.set(trailingLeaf.id, {
      x: 220,
      y: 20,
      width: 80,
      height: 40,
    } as ComputedLayout);
  }

  return buildRenderCommandStream(
    [body.id],
    children,
    layout,
    { [body.id]: { x: 0, y: 0 } },
    {
      presentationRevision: options.revision ?? 0,
      baseCanonicalRevision: 0,
    },
  );
}

function publication(presentationRevision: number) {
  return {
    presentationRevision,
    baseCanonicalRevision: 0,
  };
}

describe("applySubtreeCommandPatch", () => {
  afterEach(() => {
    setDragVisualOffset(null, 0, 0, true);
    clearSkiaRegistry();
  });

  it("same-size subtree만 교체하고 외부 bounds를 보존한다", () => {
    const current = buildFixture();
    const replacement = buildFixture({ leafY: 120, revision: 1 });
    const outsideBounds = current.boundsMap.get("patch-body");
    const leafStart = current.subtreeSpans.get("patch-leaf")!.start;

    const result = applySubtreeCommandPatch({
      current,
      replacement,
      rootId: "patch-leaf",
      publication: publication(1),
      canonicalRevision: 0,
    });

    expect(result).toMatchObject({
      applied: true,
      damageBounds: { x: 30, y: 50, width: 80, height: 140 },
    });
    expect(current.presentationRevision).toBe(1);
    expect(current.commands[leafStart]).toMatchObject({ x: 10, y: 120 });
    expect(current.boundsMap.get("patch-leaf")).toEqual({
      x: 30,
      y: 150,
      width: 80,
      height: 40,
    });
    expect(current.boundsMap.get("patch-body")).toBe(outsideBounds);
  });

  it("nested subtree의 모든 element bounds를 함께 교체한다", () => {
    const current = buildFixture({ includeSecondLeaf: true });
    const replacement = buildFixture({
      includeSecondLeaf: true,
      leafY: 120,
      revision: 1,
    });
    const outsideBounds = current.boundsMap.get("patch-body");

    const result = applySubtreeCommandPatch({
      current,
      replacement,
      rootId: "patch-owner",
      publication: publication(1),
      canonicalRevision: 0,
    });

    expect(result.applied).toBe(true);
    expect(current.boundsMap.get("patch-leaf")?.y).toBe(150);
    expect(current.boundsMap.has("patch-second-leaf")).toBe(true);
    expect(current.boundsMap.get("patch-body")).toBe(outsideBounds);
  });

  it("scroll/sticky context가 보존된 subtree는 patch할 수 있다", () => {
    const body = makeElement("scroll-body", { type: "body" });
    const sticky = makeElement("sticky-leaf", { parent_id: body.id });
    registerNode(body.id, {
      width: 800,
      height: 600,
      clipChildren: true,
      scrollOffset: { scrollTop: 100, scrollLeft: 0 },
    });
    registerNode(sticky.id, {
      width: 100,
      height: 40,
      isSticky: true,
      stickyTop: 10,
    });

    const build = (y: number, revision: number) =>
      buildRenderCommandStream(
        [body.id],
        new Map([[body.id, [sticky]]]),
        new Map([
          [sticky.id, { x: 20, y, width: 100, height: 40 } as ComputedLayout],
        ]),
        { [body.id]: { x: 0, y: 0 } },
        { presentationRevision: revision, baseCanonicalRevision: 0 },
      );
    const current = build(200, 0);
    const replacement = build(240, 1);

    const result = applySubtreeCommandPatch({
      current,
      replacement,
      rootId: sticky.id,
      publication: publication(1),
      canonicalRevision: 0,
    });

    expect(result).toMatchObject({
      applied: true,
      damageBounds: { x: 20, y: 100, width: 100, height: 80 },
    });
    expect(current.scrollContextKeyByElement.get(sticky.id)).toBe(
      replacement.scrollContextKeyByElement.get(sticky.id),
    );
  });

  it("ancestor scroll context가 달라지면 stale subtree patch를 거부한다", () => {
    const body = makeElement("scroll-context-body", { type: "body" });
    const leaf = makeElement("scroll-context-leaf", { parent_id: body.id });
    registerNode(body.id, {
      width: 800,
      height: 600,
      scrollOffset: { scrollTop: 100, scrollLeft: 0 },
    });
    registerNode(leaf.id, { width: 100, height: 40 });
    const build = (scrollTop: number, revision: number) => {
      registerNode(body.id, {
        width: 800,
        height: 600,
        scrollOffset: { scrollTop, scrollLeft: 0 },
      });
      return buildRenderCommandStream(
        [body.id],
        new Map([[body.id, [leaf]]]),
        new Map([
          [
            leaf.id,
            { x: 20, y: 200, width: 100, height: 40 } as ComputedLayout,
          ],
        ]),
        { [body.id]: { x: 0, y: 0 } },
        { presentationRevision: revision, baseCanonicalRevision: 0 },
      );
    };
    const current = build(100, 0);
    const replacement = build(200, 1);

    expect(
      applySubtreeCommandPatch({
        current,
        replacement,
        rootId: leaf.id,
        publication: publication(1),
        canonicalRevision: 0,
      }),
    ).toEqual({ applied: false, reason: "scroll-context-changed" });
  });

  it("기존 hit entry를 먼저 제거해 clip-out ghost hit를 남기지 않는다", () => {
    const current = buildFixture({ bodyClipChildren: true, leafY: 20 });
    const replacement = buildFixture({
      bodyClipChildren: true,
      leafY: 700,
      revision: 1,
    });

    expect(current.hitBoundsMap.has("patch-leaf")).toBe(true);
    expect(replacement.hitBoundsMap.has("patch-leaf")).toBe(false);

    const result = applySubtreeCommandPatch({
      current,
      replacement,
      rootId: "patch-leaf",
      publication: publication(1),
      canonicalRevision: 0,
    });

    expect(result.applied).toBe(true);
    expect(current.hitBoundsMap.has("patch-leaf")).toBe(false);
  });

  it("command count가 달라지면 fail-closed 한다", () => {
    const current = buildFixture();
    const replacement = buildFixture({ includeSecondLeaf: true, revision: 1 });
    const before = current.commands.slice();

    const result = applySubtreeCommandPatch({
      current,
      replacement,
      rootId: "patch-owner",
      publication: publication(1),
      canonicalRevision: 0,
    });

    expect(result).toEqual({ applied: false, reason: "command-count-changed" });
    expect(current.commands).toEqual(before);
    expect(current.presentationRevision).toBe(0);
  });

  it("commit lane은 variable-length subtree를 splice하고 후속 span을 보존한다", () => {
    const current = buildFixture({ includeTrailingLeaf: true });
    const replacement = buildFixture({
      includeSecondLeaf: true,
      includeTrailingLeaf: true,
      revision: 1,
    });
    const currentLength = current.commands.length;
    const currentRootLength =
      current.subtreeSpans.get("patch-owner")!.end -
      current.subtreeSpans.get("patch-owner")!.start;
    const trailingStartBefore = current.subtreeSpans.get(
      "patch-trailing-leaf",
    )!.start;
    const replacementLength =
      replacement.subtreeSpans.get("patch-owner")!.end -
      replacement.subtreeSpans.get("patch-owner")!.start;

    const result = applyCommitSubtreeCommandPatch({
      current,
      replacement,
      rootId: "patch-owner",
      revision: 1,
      canonicalRevision: 0,
    });

    expect(result).toMatchObject({
      applied: true,
      writeCount: replacementLength,
      damageBounds: { x: 20, y: 30, width: 400, height: 300 },
    });
    expect(current.commands.length).toBe(
      currentLength + (replacementLength - currentRootLength),
    );
    expect(current.subtreeSpans.has("patch-second-leaf")).toBe(true);
    const ownerOffset =
      current.subtreeSpans.get("patch-owner")!.start -
      replacement.subtreeSpans.get("patch-owner")!.start;
    expect(current.childrenSpans.get("patch-owner")).toEqual({
      start: replacement.childrenSpans.get("patch-owner")!.start + ownerOffset,
      end: replacement.childrenSpans.get("patch-owner")!.end + ownerOffset,
    });
    expect(
      getCommandBufferSpliceWriteCount(current.commands),
    ).toBeLessThanOrEqual(replacementLength);
    expect(current.subtreeSpans.get("patch-trailing-leaf")!.start).toBe(
      trailingStartBefore + replacementLength - currentRootLength,
    );
    expect(current.presentationRevision).toBe(1);
  });

  it("dirty subtree ID 수집은 전체 span map을 순회하지 않는다", () => {
    const stream = buildFixture({
      includeSecondLeaf: true,
      includeTrailingLeaf: true,
    });
    const span = stream.subtreeSpans.get("patch-owner")!;
    const entries = vi
      .spyOn(stream.subtreeSpans, "entries")
      .mockImplementation(() => {
        throw new Error("global span iteration");
      });

    expect([...getSubtreeElementIds(stream, span)].sort()).toEqual([
      "patch-leaf",
      "patch-owner",
      "patch-second-leaf",
    ]);
    expect(entries).not.toHaveBeenCalled();
  });

  it("patch 뒤 sparse-damage fail-safe 요소 집합을 원자 교체한다", () => {
    const current = buildFixture();
    const unsafeReplacement = buildFixture({
      leafDamageUnsafe: true,
      revision: 1,
    });

    expect(
      applySubtreeCommandPatch({
        current,
        replacement: unsafeReplacement,
        rootId: "patch-leaf",
        publication: publication(1),
        canonicalRevision: 0,
      }),
    ).toMatchObject({ applied: true });
    expect(current.damageUnsafeElementIds).toEqual(new Set(["patch-leaf"]));

    const safeReplacement = buildFixture({ revision: 2 });
    expect(
      applySubtreeCommandPatch({
        current,
        replacement: safeReplacement,
        rootId: "patch-leaf",
        publication: publication(2),
        canonicalRevision: 0,
      }),
    ).toMatchObject({ applied: true });
    expect(current.damageUnsafeElementIds.size).toBe(0);
  });

  it("patch root의 조상 clip context가 바뀌면 거부한다", () => {
    const current = buildFixture({ bodyClipChildren: false });
    const replacement = buildFixture({ bodyClipChildren: true, revision: 1 });

    const result = applySubtreeCommandPatch({
      current,
      replacement,
      rootId: "patch-leaf",
      publication: publication(1),
      canonicalRevision: 0,
    });

    expect(result).toEqual({ applied: false, reason: "clip-context-changed" });
  });

  it("z-order key가 바뀌면 거부한다", () => {
    const current = buildFixture();
    const replacement = buildFixture({ revision: 1 });
    replacement.zOrderKeyByElement.set("patch-leaf", "changed-z-order");

    const result = applySubtreeCommandPatch({
      current,
      replacement,
      rootId: "patch-owner",
      publication: publication(1),
      canonicalRevision: 0,
    });

    expect(result).toEqual({ applied: false, reason: "z-order-changed" });
  });

  it("span context가 불완전하면 fail-closed 한다", () => {
    const current = buildFixture();
    const replacement = buildFixture({ revision: 1 });
    replacement.subtreeSpans.delete("patch-leaf");

    expect(
      applySubtreeCommandPatch({
        current,
        replacement,
        rootId: "patch-owner",
        publication: publication(1),
        canonicalRevision: 0,
      }),
    ).toEqual({ applied: false, reason: "invalid-span" });
  });

  it("top-layer subtree는 일반 patch 대상에서 제외한다", () => {
    setDragVisualOffset("patch-leaf", 20, 20, true);
    const current = buildFixture();
    const replacement = buildFixture({ leafY: 120, revision: 1 });

    const result = applySubtreeCommandPatch({
      current,
      replacement,
      rootId: "patch-leaf",
      publication: publication(1),
      canonicalRevision: 0,
    });

    expect(result).toEqual({ applied: false, reason: "top-layer" });
  });

  it("stale presentation과 canonical base mismatch를 각각 거부한다", () => {
    const current = buildFixture({ revision: 2 });
    const replacement = buildFixture({ leafY: 120, revision: 3 });

    expect(
      applySubtreeCommandPatch({
        current,
        replacement,
        rootId: "patch-leaf",
        publication: publication(2),
        canonicalRevision: 0,
      }),
    ).toEqual({ applied: false, reason: "stale-revision" });

    expect(
      applySubtreeCommandPatch({
        current,
        replacement,
        rootId: "patch-leaf",
        publication: publication(3),
        canonicalRevision: 1,
      }),
    ).toEqual({ applied: false, reason: "base-revision-mismatch" });
  });
});
