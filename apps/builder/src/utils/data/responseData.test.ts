import { describe, expect, it } from "vitest";
import { readPath, resolveResponseData } from "./responseData";

const users = [{ id: 1 }, { id: 2 }];

describe("resolveResponseData (리서치 D1)", () => {
  it("빈 경로 + 최상위 배열 → 배열 그대로", () => {
    expect(resolveResponseData(users, "")).toEqual({
      data: users,
      resolvedPath: "",
      autoDetected: false,
    });
  });

  it('종전 기본값 "data" 로 최상위 배열을 받아도 undefined 가 아니라 배열', () => {
    const r = resolveResponseData(users, "data");
    expect(r.data).toBe(users);
    expect(r.resolvedPath).toBe("");
    expect(r.autoDetected).toBe(true);
  });

  it("경로가 실제로 맞으면 그 경로", () => {
    const r = resolveResponseData({ data: users, meta: {} }, "data");
    expect(r).toEqual({
      data: users,
      resolvedPath: "data",
      autoDetected: false,
    });
  });

  it("빈 경로 + 객체 응답 → 관례 키 중 첫 배열을 감지하고 경로를 돌려준다", () => {
    const r = resolveResponseData({ count: 2, results: users }, "");
    expect(r).toEqual({
      data: users,
      resolvedPath: "results",
      autoDetected: true,
    });
  });

  it("점 경로", () => {
    const r = resolveResponseData(
      { payload: { items: users } },
      "payload.items",
    );
    expect(r.data).toBe(users);
    expect(readPath({ a: { b: 1 } }, "a.b")).toBe(1);
    expect(readPath({ a: null }, "a.b")).toBeUndefined();
  });

  it("배열을 못 찾으면 축소 결과 그대로 (객체 1건 응답)", () => {
    const one = { id: 7, name: "x" };
    expect(resolveResponseData(one, "")).toEqual({
      data: one,
      resolvedPath: "",
      autoDetected: false,
    });
    expect(resolveResponseData(one, "data").data).toBeUndefined();
  });

  it("빈 배열은 감지 후보가 아니다 (0행 오해 방지)", () => {
    const r = resolveResponseData({ results: [], data: users }, "");
    expect(r.resolvedPath).toBe("data");
  });
});
