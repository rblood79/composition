import { describe, expect, it } from "vitest";
import { LISTBOX_TEMPLATE_ANCHOR_ROLE } from "../../components/listbox/listBoxTemplateOrigins";
import {
  canOperate,
  filterOperable,
  getOperationRejectMessageKey,
  type OperableNode,
  type StructuralOp,
} from "../canOperate";

const nodes: Record<string, OperableNode> = {
  body: { id: "body", type: "body" },
  button: { id: "button", type: "Button" },
  frame: { id: "frame", type: "frame" },
  legacyGroup: { id: "legacyGroup", type: "Group" },
  userOrigin: { id: "userOrigin", type: "frame", reusable: true },
  systemOrigin: {
    id: "systemOrigin",
    type: "frame",
    reusable: true,
    metadata: { systemOwned: true },
  },
  anchor: {
    id: "anchor",
    type: "ListBoxItem",
    metadata: { templateRole: LISTBOX_TEMPLATE_ANCHOR_ROLE },
  },
  instance: { id: "instance", type: "Button", ref: "userOrigin" },
  // ADR-234 상태 변형 — origin 의 reusable ref (dual 노드), Components 페이지 system 소유.
  systemVariant: {
    id: "systemOrigin--hover",
    type: "ref",
    ref: "systemOrigin",
    reusable: true,
    metadata: { systemOwned: true, variant: "hover" },
  },
  // system origin 안의 ref 자식 (Form 의 field) — 원본 편집 범위라 분리할 수 있다.
  systemOriginChildRef: { id: "field", type: "ref", ref: "userOrigin" },
};
const lookup = (id: string) => nodes[id];
const ALL_OPS: StructuralOp[] = [
  "delete",
  "copy",
  "duplicate",
  "group",
  "ungroup",
  "detach",
  "toggleOrigin",
  "move",
];

describe("canOperate", () => {
  it("body 는 어떤 작업도 받지 않는다 (toggle 포함 — E1)", () => {
    for (const op of ALL_OPS) {
      expect(canOperate(op, "body", lookup)).toEqual({
        ok: false,
        reason: "body",
      });
    }
  });

  it("instance 의 synthetic 자식은 어떤 작업도 받지 않는다", () => {
    for (const op of ALL_OPS) {
      expect(canOperate(op, "instance/label", lookup)).toEqual({
        ok: false,
        reason: "synthetic",
      });
    }
  });

  it("없는 노드는 거부한다", () => {
    expect(canOperate("delete", "missing", lookup)).toEqual({
      ok: false,
      reason: "notFound",
    });
  });

  it("projection id 는 삭제 · 이동 · ungroup · 컴포넌트 축에서 거부", () => {
    const id = "projection:listbox-row:x";
    for (const op of [
      "delete",
      "move",
      "ungroup",
      "toggleOrigin",
      "detach",
    ] as const) {
      expect(canOperate(op, id, lookup)).toEqual({
        ok: false,
        reason: "projection",
      });
    }
  });

  it("삭제 — systemOwned origin · ListBox template anchor 는 거부 (E3 · E11)", () => {
    expect(canOperate("delete", "systemOrigin", lookup)).toEqual({
      ok: false,
      reason: "systemOwned",
    });
    expect(canOperate("delete", "anchor", lookup)).toEqual({
      ok: false,
      reason: "templateAnchor",
    });
    expect(canOperate("delete", "userOrigin", lookup)).toEqual({ ok: true });
    expect(canOperate("delete", "button", lookup)).toEqual({ ok: true });
  });

  it("컴포넌트 만들기/해제 — systemOwned origin 만 거부", () => {
    expect(canOperate("toggleOrigin", "systemOrigin", lookup).ok).toBe(false);
    expect(canOperate("toggleOrigin", "userOrigin", lookup).ok).toBe(true);
    expect(canOperate("toggleOrigin", "button", lookup).ok).toBe(true);
  });

  it("ungroup — frame · legacy Group 만, systemOwned frame 은 거부 (E5)", () => {
    expect(canOperate("ungroup", "frame", lookup).ok).toBe(true);
    expect(canOperate("ungroup", "legacyGroup", lookup).ok).toBe(true);
    expect(canOperate("ungroup", "button", lookup)).toEqual({
      ok: false,
      reason: "notGroup",
    });
    expect(canOperate("ungroup", "systemOrigin", lookup)).toEqual({
      ok: false,
      reason: "systemOwned",
    });
  });

  it("detach — system 상태 변형은 거부한다 (분리하면 ref 를 잃어 상태 층이 원본 값으로 굳고 복구되지 않는다)", () => {
    expect(canOperate("detach", "systemVariant", lookup)).toEqual({
      ok: false,
      reason: "systemOwned",
    });
    expect(canOperate("detach", "systemOriginChildRef", lookup).ok).toBe(true);
  });

  it("detach — instance 만", () => {
    expect(canOperate("detach", "instance", lookup).ok).toBe(true);
    expect(canOperate("detach", "button", lookup)).toEqual({
      ok: false,
      reason: "notInstance",
    });
  });
});

describe("filterOperable", () => {
  it("입력 순서대로 통과 id 와 거부 사유를 나눈다", () => {
    expect(
      filterOperable(
        "delete",
        ["button", "body", "systemOrigin", "instance/x", "frame"],
        lookup,
      ),
    ).toEqual({
      ids: ["button", "frame"],
      rejected: [
        { id: "body", reason: "body" },
        { id: "systemOrigin", reason: "systemOwned" },
        { id: "instance/x", reason: "synthetic" },
      ],
    });
  });
});

describe("getOperationRejectMessageKey", () => {
  it("사용자에게 이유를 보일 사유만 문구 키가 있다", () => {
    expect(getOperationRejectMessageKey("systemOwned")).toBe(
      "operation.systemOriginLocked",
    );
    expect(getOperationRejectMessageKey("notFound")).toBeNull();
  });
});

describe("canOperate — editStyle (위임 sub-part, A-2)", () => {
  const fieldNodes: Record<string, OperableNode> = {
    body: { id: "body", type: "body" },
    field: { id: "field", type: "TextField", parent_id: "body" },
    label: { id: "label", type: "Label", parent_id: "field" },
    free: { id: "free", type: "Label", parent_id: "body" },
  };
  const fieldLookup = (id: string) => fieldNodes[id];

  it("style 을 owner rule 이 정하는 sub-part 는 거부한다 (TextField 의 Label)", () => {
    expect(canOperate("editStyle", "label", fieldLookup)).toEqual({
      ok: false,
      reason: "delegatedSubpart",
    });
  });

  it("body · 독립 요소는 스타일 편집이 정상이다 (구조 변경 규칙을 따르지 않는다)", () => {
    expect(canOperate("editStyle", "body", fieldLookup)).toEqual({ ok: true });
    expect(canOperate("editStyle", "free", fieldLookup)).toEqual({ ok: true });
    expect(canOperate("editStyle", "field", fieldLookup)).toEqual({ ok: true });
  });
});
