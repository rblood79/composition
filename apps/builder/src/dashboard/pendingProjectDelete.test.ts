import { describe, expect, it } from "vitest";
import {
  buildPendingProjectDeleteState,
  readPendingProjectDeleteId,
} from "./pendingProjectDelete";

describe("pendingProjectDelete — 빌더 → 대시보드 삭제 요청 계약", () => {
  it("빌더가 만든 state 를 대시보드가 같은 id 로 읽는다", () => {
    expect(
      readPendingProjectDeleteId(buildPendingProjectDeleteState("p-1")),
    ).toBe("p-1");
  });

  it.each([
    null,
    undefined,
    "p-1",
    42,
    {},
    { deleteProjectId: "" },
    {
      deleteProjectId: 7,
    },
  ])("삭제 요청이 아닌 state %j 는 null", (state) => {
    expect(readPendingProjectDeleteId(state)).toBeNull();
  });
});
