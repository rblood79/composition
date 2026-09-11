/**
 * ADR-212 Phase 4 P7 — 응답 스키마 추천. JSON 응답에서 배열 후보 경로를 전수 탐색해 추천하고
 * (행 수 · 미리보기 키), 고른 경로의 행으로 컬럼을 감지한다.
 */
import { describe, expect, it } from "vitest";
import { recommendArrayPaths } from "./responseSchema";

describe("recommendArrayPaths", () => {
  it("최상위 배열은 경로 '' 후보 1개", () => {
    const r = recommendArrayPaths([{ id: 1 }, { id: 2 }]);
    expect(r).toEqual([{ path: "", count: 2, keys: ["id"] }]);
  });
  it("관례 키 · 중첩 배열을 전수 탐색해 행 수 내림차순", () => {
    const json = {
      meta: { total: 3 },
      data: { items: [{ a: 1 }, { a: 2 }, { a: 3 }], page: 1 },
      tags: ["x", "y"],
    };
    const r = recommendArrayPaths(json);
    expect(r[0]).toEqual({ path: "data.items", count: 3, keys: ["a"] });
    // 원시 배열 (tags) 도 후보지만 객체 배열보다 뒤 (키 없음)
    expect(r.some((c) => c.path === "tags")).toBe(true);
    expect(r.find((c) => c.path === "tags")?.keys).toEqual([]);
  });
  it("배열이 없으면 빈 목록", () => {
    expect(recommendArrayPaths({ a: 1, b: { c: 2 } })).toEqual([]);
  });
  it("객체 배열 우선 (같은 길이면 객체>원시), 깊이 제한", () => {
    const json = { a: [{ k: 1 }], b: [1, 2] };
    const r = recommendArrayPaths(json);
    expect(r[0].path).toBe("b"); // 더 김 (2 > 1)
    expect(r[1].path).toBe("a");
  });
});
