import { describe, expect, it } from "vitest";
import {
  resolveMoveTarget,
  type MoveTargetNode,
  type MoveTargetPolicy,
} from "../resolveMoveTarget";

function node(
  id: string,
  type: string,
  parentId: string | null,
  extra: Partial<MoveTargetNode> = {},
): MoveTargetNode {
  return { id, type, props: {}, parent_id: parentId, ...extra };
}

// body > frame > instance (ref → Button origin). origin 은 같은 맵에 있다.
const nodes = new Map<string, MoveTargetNode>(
  [
    node("body", "body", null),
    node("frame", "frame", "body"),
    node("inst", "ref", "frame", { ref: "origin-button" }),
    node("origin-button", "Button", null),
  ].map((n) => [n.id, n]),
);

const resolve = (
  targetParentId: string,
  movingTypes: string[],
  policy: MoveTargetPolicy,
) =>
  resolveMoveTarget({
    targetParentId,
    insertionIndex: 0,
    movingTypes,
    nodes,
    policy,
  });

describe("resolveMoveTarget", () => {
  it("ref instance 부모는 원본 타입으로 읽는다 — Button instance 안 Button 은 위반 (E7)", () => {
    expect(resolve("inst", ["Button"], "reject")).toMatchObject({
      ok: false,
      reason: "nesting",
    });
  });

  it("nearest-ancestor 는 가까운 유효 조상으로 옮긴다", () => {
    expect(resolve("inst", ["Button"], "nearest-ancestor")).toMatchObject({
      ok: true,
      parentId: "frame",
      relocation: { relocatedToId: "frame", originalTargetId: "inst" },
    });
  });

  it("유효한 대상은 그대로", () => {
    expect(resolve("frame", ["Button"], "reject")).toEqual({
      ok: true,
      parentId: "frame",
      insertionIndex: 0,
      relocation: null,
    });
  });

  it("instance 의 synthetic 자식은 부모가 될 수 없다 (E6)", () => {
    expect(resolve("inst/label", ["Text"], "nearest-ancestor")).toEqual({
      ok: false,
      reason: "synthetic",
    });
  });

  it("맵에 없는 대상은 판정하지 않고 넘긴다 (종전 표면 동작 · canonical guard 가 백스톱)", () => {
    expect(resolve("missing", ["Button"], "reject")).toMatchObject({
      ok: true,
      parentId: "missing",
      relocation: null,
    });
  });

  it("page-frame 투영 id 는 synthetic 으로 보지 않는다 (드래그는 render-space id 를 받는다)", () => {
    const pageFrame = "page-1::page-frame::inst/label";
    expect(resolve(pageFrame, ["Text"], "reject")).toMatchObject({ ok: true });
  });
});
