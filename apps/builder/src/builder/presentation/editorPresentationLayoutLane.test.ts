import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createPresentationLayoutPlan,
  createPresentationLayoutPublications,
  publishPresentationLayout,
  resolveCanonicalNodeWithPresentation,
} from "./editorPresentationLayoutLane";
import {
  createLayoutOverlay,
  LayoutPublicationChannel,
  PresentationLayoutPublicationStore,
} from "./editorPresentationLayoutLane";
import type { CanvasLayoutNode } from "../workspace/canvas/layout/layoutNode";

describe("editor presentation layout lane", () => {
  it("promotes only used-size parents and collects the affected subtree", () => {
    const plan = createPresentationLayoutPlan({
      targets: [{ kind: "canonical-node", nodeId: "child" }],
      tree: {
        childrenByParent: new Map([
          ["root", ["parent"]],
          ["parent", ["child", "sibling"]],
        ]),
        parentById: new Map([
          ["root", null],
          ["parent", "root"],
          ["child", "parent"],
          ["sibling", "parent"],
        ]),
      },
      promotionOverrideForTest: (parentId) => parentId === "parent",
    });

    expect(plan.roots).toEqual(["parent"]);
    expect(plan.parentChain).toEqual(["parent"]);
    expect(plan.affectedNodeIds).toEqual(
      new Set(["parent", "child", "sibling"]),
    );
  });

  it("derives runtime promotion from used-size registry and stops at a sized ancestor", () => {
    const target = { kind: "canonical-node", nodeId: "child" } as const;
    const plan = createPresentationLayoutPlan({
      targets: [target],
      mutations: [{ patch: { width: 140 }, target, type: "style.patch" }],
      tree: {
        childrenByParent: new Map([
          ["page", ["parent"]],
          ["parent", ["child", "sibling"]],
        ]),
        parentById: new Map([
          ["page", null],
          ["parent", "page"],
          ["child", "parent"],
          ["sibling", "parent"],
        ]),
        nodeById: new Map([
          [
            "page",
            {
              id: "page",
              type: "Page",
              props: { style: { width: 600, height: 400 } },
            },
          ],
          [
            "parent",
            {
              id: "parent",
              type: "Box",
              props: { style: { display: "flex", width: 400, height: 100 } },
            },
          ],
          [
            "child",
            {
              id: "child",
              type: "Box",
              props: { style: { width: 100, height: 20 } },
            },
          ],
          [
            "sibling",
            {
              id: "sibling",
              type: "Box",
              props: { style: { width: 80, height: 20 } },
            },
          ],
        ]),
      },
    });

    expect(plan.roots).toEqual(["parent"]);
    expect(plan.parentChain).toEqual(["parent"]);
    expect(plan.affectedNodeIds).toEqual(
      new Set(["parent", "child", "sibling"]),
    );
  });

  it("does not promote an out-of-flow child or a paint-only mutation", () => {
    const target = { kind: "canonical-node", nodeId: "absolute" } as const;
    const tree = {
      childrenByParent: new Map([["parent", ["absolute", "sibling"]]]),
      parentById: new Map([
        ["parent", null],
        ["absolute", "parent"],
        ["sibling", "parent"],
      ]),
      nodeById: new Map([
        [
          "parent",
          { id: "parent", type: "Box", props: { style: { display: "flex" } } },
        ],
        [
          "absolute",
          {
            id: "absolute",
            type: "Box",
            props: { style: { position: "absolute", width: 100, height: 20 } },
          },
        ],
        [
          "sibling",
          {
            id: "sibling",
            type: "Box",
            props: { style: { width: 80, height: 20 } },
          },
        ],
      ]),
    };

    const geometryPlan = createPresentationLayoutPlan({
      targets: [target],
      mutations: [{ patch: { width: 140 }, target, type: "style.patch" }],
      tree,
    });
    expect(geometryPlan.roots).toEqual(["absolute"]);
    expect(geometryPlan.affectedNodeIds).toEqual(new Set(["absolute"]));

    const paintPlan = createPresentationLayoutPlan({
      targets: [{ kind: "canonical-node", nodeId: "sibling" }],
      mutations: [
        {
          patch: { color: "blue" },
          target: { kind: "canonical-node", nodeId: "sibling" },
          type: "style.patch",
        },
      ],
      tree,
    });
    expect(paintPlan.roots).toEqual(["sibling"]);
  });

  it.each(["padding", "gap"] as const)(
    "keeps a fixed-size flow container %s patch scoped to its own subtree",
    (property) => {
      const target = {
        kind: "canonical-node",
        nodeId: "parent",
      } as const;
      const tree = {
        childrenByParent: new Map([
          ["page", ["parent", "filler"]],
          ["parent", ["target", "sibling"]],
        ]),
        parentById: new Map([
          ["page", null],
          ["parent", "page"],
          ["target", "parent"],
          ["sibling", "parent"],
          ["filler", "page"],
        ]),
        nodeById: new Map([
          [
            "page",
            {
              id: "page",
              type: "Page",
              props: { style: { display: "block" } },
            },
          ],
          [
            "parent",
            {
              id: "parent",
              type: "Box",
              props: { style: { display: "flex", width: 360, height: 180 } },
            },
          ],
          [
            "target",
            {
              id: "target",
              type: "Box",
              props: { style: { width: 100, height: 60 } },
            },
          ],
          [
            "sibling",
            {
              id: "sibling",
              type: "Box",
              props: { style: { width: 100, height: 60 } },
            },
          ],
          [
            "filler",
            {
              id: "filler",
              type: "Box",
              props: { style: { width: 8, height: 8 } },
            },
          ],
        ]),
      };

      const plan = createPresentationLayoutPlan({
        targets: [target],
        mutations: [
          {
            patch: { [property]: 24 },
            target,
            type: "style.patch",
          },
        ],
        tree,
      });

      expect(plan.roots).toEqual(["parent"]);
      expect(plan.parentChain).toEqual([]);
      expect(plan.affectedNodeIds).toEqual(
        new Set(["parent", "target", "sibling"]),
      );
    },
  );

  it("publishes only affected layout delta without copying a canonical base map", () => {
    const changed = { x: 2 };
    const result = publishPresentationLayout({
      plan: {
        parentChain: [],
        roots: ["child"],
        affectedNodeIds: new Set(["child"]),
      },
      resolveNode: () => new Map([["child", changed]]),
    });

    expect(result.layoutDelta.size).toBe(1);
    expect(result.layoutDelta.get("child")).toBe(changed);
    expect(result.writeCount).toBe(1);
    expect(result).not.toHaveProperty("layoutMap");
  });

  it("resolves delta before base without creating a merged map", () => {
    const base = new Map([
      ["root", { x: 1 }],
      ["child", { x: 2 }],
    ]);
    const delta = new Map([["child", { x: 3 }]]);
    const overlay = createLayoutOverlay(base, delta);

    expect(overlay.base).toBe(base);
    expect(overlay.delta).toBe(delta);
    expect(overlay.resolve("root")).toBe(base.get("root"));
    expect(overlay.resolve("child")).toBe(delta.get("child"));
  });

  it("partitions multi-root plans and applies the group atomically", () => {
    const rootKeyByNodeId = new Map([
      ["page-root", "page"],
      ["page-child", "page"],
      ["frame-root", "frame"],
      ["frame-child", "frame"],
    ]);
    const plan = {
      parentChain: [],
      roots: ["page-root", "frame-root"],
      affectedNodeIds: new Set([
        "page-root",
        "page-child",
        "frame-root",
        "frame-child",
      ]),
    };
    const layoutDelta = new Map([
      ["page-root", { x: 10 }],
      ["page-child", { x: 11 }],
      ["frame-root", { x: 20 }],
      ["frame-child", { x: 21 }],
    ]);
    const partitioned = createPresentationLayoutPublications({
      plan,
      layoutDelta,
      tree: {
        childrenByParent: new Map(),
        parentById: new Map(),
        rootKeyByNodeId,
      },
      baseCanonicalRevision: 4,
      planSequence: 12,
      presentationRevisionByRootKey: new Map([
        ["page", 1],
        ["frame", 1],
      ]),
    });
    expect(partitioned.ok).toBe(true);
    if (!partitioned.ok) return;
    expect(partitioned.publications).toHaveLength(2);
    expect(
      partitioned.publications.every((publication) =>
        [...publication.layoutDelta.keys()].every(
          (nodeId) => rootKeyByNodeId.get(nodeId) === publication.rootKey,
        ),
      ),
    ).toBe(true);

    const store = new PresentationLayoutPublicationStore({
      initialCanonicalRevision: 4,
      rootKeyForNode: (nodeId) => rootKeyByNodeId.get(nodeId),
      getCanonicalBase: (rootKey) =>
        new Map(
          [...rootKeyByNodeId.entries()]
            .filter(([, value]) => value === rootKey)
            .map(([nodeId]) => [nodeId, { x: 0 }]),
        ),
    });
    expect(store.applyTargetedGroup(partitioned.publications)).toBe(true);
    expect(store.getRevision("page")).toBe(1);
    expect(store.getRevision("frame")).toBe(1);
    expect(store.getOverlay("page")?.resolve("page-child")).toEqual({
      x: 11,
    });
  });

  it("fails closed when an affected node crosses the root boundary", () => {
    const result = createPresentationLayoutPublications({
      plan: {
        parentChain: [],
        roots: ["page-root"],
        affectedNodeIds: new Set(["page-root", "frame-child"]),
      },
      layoutDelta: new Map([["page-root", { x: 1 }]]),
      tree: {
        childrenByParent: new Map(),
        parentById: new Map(),
        rootKeyByNodeId: new Map([
          ["page-root", "page"],
          ["frame-child", "frame"],
        ]),
      },
      baseCanonicalRevision: 1,
      planSequence: 1,
      presentationRevisionByRootKey: new Map([["page", 1]]),
    });
    expect(result).toEqual({ ok: false, reason: "cross-root-plan" });
  });

  it("rejects a group without recording a revision, then accepts its retry", () => {
    const roots = new Map([
      ["page-root", "page"],
      ["frame-root", "frame"],
    ]);
    const base = (rootKey: string): ReadonlyMap<string, { x: number }> =>
      new Map(
        [...roots.entries()]
          .filter(([, value]) => value === rootKey)
          .map(([nodeId]) => [nodeId, { x: 0 }]),
      );
    const store = new PresentationLayoutPublicationStore({
      initialCanonicalRevision: 7,
      rootKeyForNode: (nodeId) => roots.get(nodeId),
      getCanonicalBase: base,
    });
    const page = {
      kind: "presentation-targeted" as const,
      rootKey: "page",
      roots: ["page-root"],
      affectedNodeIds: new Set(["page-root"]),
      layoutDelta: new Map([["page-root", { x: 1 }]]),
      presentationRevision: 2,
      baseCanonicalRevision: 7,
      planSequence: 22,
    };
    const frame = {
      kind: "presentation-targeted" as const,
      rootKey: "frame",
      roots: ["frame-root"],
      affectedNodeIds: new Set(["frame-root"]),
      layoutDelta: new Map([["frame-root", { x: 2 }]]),
      presentationRevision: 2,
      baseCanonicalRevision: 6,
      planSequence: 22,
    };
    expect(store.applyTargetedGroup([page, frame])).toBe(false);
    expect(store.getRevision("page")).toBeUndefined();
    expect(store.getRevision("frame")).toBeUndefined();
    expect(
      store.applyTargetedGroup([{ ...frame, baseCanonicalRevision: 7 }]),
    ).toBe(true);
    expect(store.getRevision("frame")).toBe(2);
  });

  it("keeps canonical-full and targeted listeners separate", () => {
    const channel = new LayoutPublicationChannel({
      rootKeyForNode: () => "page",
      getCanonicalBase: () => new Map([["root", { x: 0 }]]),
      initialCanonicalRevision: 0,
    });
    const canonicalEvents: number[] = [];
    const targetedEvents: number[] = [];
    channel.onCanonicalFull(({ version }) => canonicalEvents.push(version));
    channel.onPresentationTargeted((publications) =>
      targetedEvents.push(publications.length),
    );
    expect(channel.publishCanonicalFull(1)?.kind).toBe("canonical-full");
    expect(
      channel.publishPresentationTargeted([
        {
          kind: "presentation-targeted",
          rootKey: "page",
          roots: ["root"],
          affectedNodeIds: new Set(["root"]),
          layoutDelta: new Map([["root", { x: 1 }]]),
          presentationRevision: 1,
          baseCanonicalRevision: 1,
          planSequence: 1,
        },
      ]),
    ).toBe(true);
    expect(canonicalEvents).toEqual([1]);
    expect(targetedEvents).toEqual([1]);
  });

  it("merges style and geometry without mutating the canonical layout node", () => {
    const node = {
      id: "node-1",
      parent_id: null,
      page_id: "page-1",
      props: { style: { width: 100, color: "red" } },
      type: "Box",
      width: 100,
      height: 20,
    } as CanvasLayoutNode & {
      height: number;
      width: number;
    };
    const target = { kind: "canonical-node", nodeId: "node-1" } as const;
    const next = resolveCanonicalNodeWithPresentation(node, target, [
      { patch: { width: 140 }, target, type: "style.patch" },
      { patch: { x: 12 }, target, type: "geometry.patch" },
    ]);

    expect(next).not.toBe(node);
    expect(next.props).toEqual({
      style: { width: 140, color: "red", left: 12 },
    });
    expect(node.props?.style).toEqual({ width: 100, color: "red" });
  });

  it("canonicalizes spacing shorthand before targeted engine input", () => {
    const node = {
      id: "flow-parent",
      parent_id: null,
      page_id: "page-1",
      props: {
        style: {
          display: "flex",
          gap: "8px",
          padding: "4px 6px",
        },
      },
      type: "frame",
    } as CanvasLayoutNode;
    const target = { kind: "canonical-node", nodeId: node.id } as const;

    const next = resolveCanonicalNodeWithPresentation(node, target, [
      {
        patch: { gap: 16, padding: 12 },
        target,
        type: "style.patch",
      },
    ]);

    expect(next.props?.style).toEqual({
      columnGap: 16,
      display: "flex",
      paddingBottom: 12,
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 12,
      rowGap: 16,
    });
    expect(node.props?.style).toEqual({
      display: "flex",
      gap: "8px",
      padding: "4px 6px",
    });
  });

  it("does not leak paint-only style into the layout input", () => {
    const node: CanvasLayoutNode = {
      id: "node-1",
      props: { style: { color: "red" } },
      type: "Box",
    };
    const target = { kind: "canonical-node", nodeId: "node-1" } as const;
    expect(
      resolveCanonicalNodeWithPresentation(node, target, [
        { patch: { color: "blue" }, target, type: "style.patch" },
      ]),
    ).toBe(node);
  });

  it("ADR-188 G0: targeted layout has no full-sync escape hatch", async () => {
    const source = await readFile(
      resolve(__dirname, "editorPresentationLayoutLane.ts"),
      "utf-8",
    );

    expect(source).not.toMatch(/layoutVersion/);
    expect(source).not.toMatch(/resync\(true\)/);
    expect(source).not.toMatch(/onLayoutPublished/);
    expect(source).not.toMatch(/buildRenderCommandStream/);
    expect(source).not.toMatch(/shouldPromoteParent/);
    expect(source).not.toMatch(/previousLayoutMap/);
    expect(source).not.toMatch(/getSharedLayoutMap/);
  });
});
