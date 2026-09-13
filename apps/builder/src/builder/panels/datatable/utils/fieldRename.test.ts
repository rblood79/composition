import { describe, expect, it } from "vitest";
import { planFieldRename } from "./fieldRename";

const field = { id: "f-name", key: "name", type: "string" as const };

describe("planFieldRename", () => {
  it("같은 값 (공백 차이 포함) 은 noop", () => {
    expect(planFieldRename("c1", field, ["id", "name"], " name ")).toEqual({
      kind: "noop",
    });
  });
  it("빈 값은 empty", () => {
    expect(planFieldRename("c1", field, ["id", "name"], "  ")).toEqual({
      kind: "empty",
    });
  });
  it("다른 필드와 겹치면 dup", () => {
    expect(planFieldRename("c1", field, ["id", "name"], "id")).toEqual({
      kind: "dup",
      key: "id",
    });
  });
  it("정상이면 update_field { key } op — fieldId 는 id 우선", () => {
    expect(planFieldRename("c1", field, ["id", "name"], "fullName")).toEqual({
      kind: "ok",
      key: "fullName",
      op: {
        op: "update_field",
        collectionId: "c1",
        fieldId: "f-name",
        patch: { key: "fullName" },
      },
    });
    expect(
      planFieldRename("c1", { key: "age", type: "number" }, [], "years"),
    ).toMatchObject({ kind: "ok", op: { fieldId: "age" } });
  });
});
