import { afterEach, describe, expect, it } from "vitest";
import {
  clearFieldIdIndex,
  isFieldIdRef,
  registerFieldIds,
  resolveFieldRef,
} from "../fieldIdIndex";

afterEach(() => clearFieldIdIndex());

describe("fieldIdIndex — id → key 색인", () => {
  it("등록된 id 참조는 key 로, key 참조는 그대로, 미등록 id 는 null", () => {
    registerFieldIds([
      { id: "f1", key: "name" },
      { key: "noId" },
      { id: "f2", key: "addr", children: [{ id: "f3", key: "city" }] },
    ]);
    expect(resolveFieldRef("#f1")).toBe("name");
    expect(resolveFieldRef("#f3")).toBe("city");
    expect(resolveFieldRef("name")).toBe("name");
    expect(resolveFieldRef("#missing")).toBeNull();
    expect(isFieldIdRef("#f1")).toBe(true);
    expect(isFieldIdRef("f1")).toBe(false);
  });

  it("rename 재등록이 이전 key 를 덮는다", () => {
    registerFieldIds([{ id: "f1", key: "name" }]);
    registerFieldIds([{ id: "f1", key: "fullName" }]);
    expect(resolveFieldRef("#f1")).toBe("fullName");
  });
});
