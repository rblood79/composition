/**
 * ADR-214 Phase 1 — `{{ name }}` 참조 스캐너 + 소비 정의 digest (R8 · HC4).
 *
 * Phase 3 해석기 (`template.ts`) 와 같은 토큰 규약을 쓴다: `{{ name }}` (공백 허용) ·
 * `{{ a.b }}` 경로 (첫 세그먼트가 변수 이름) · `\{{` 리터럴 · `{{env.X}}` 는 변수 아님 (HC7).
 * ADR-159 `{field}` (단일 중괄호) 는 별개 문법 — 스캐너가 건드리지 않는다.
 */
import { describe, expect, it } from "vitest";
import {
  collectPropsStateRefs,
  collectStateTemplateRefs,
  resolveStateDependencies,
} from "../stateDependencies";

describe("collectStateTemplateRefs", () => {
  it("{{ name }} · 공백 · 경로 첫 세그먼트 · 중복 제거 · 순서 유지", () => {
    expect(collectStateTemplateRefs("Hello {{ userName }}!")).toEqual([
      "userName",
    ]);
    expect(collectStateTemplateRefs("{{a}} {{ b.c.d }} {{a}}")).toEqual([
      "a",
      "b",
    ]);
    expect(collectStateTemplateRefs("{{  spaced  }}")).toEqual(["spaced"]);
  });

  it("리터럴 \\{{ 는 참조가 아니다 · {field} 단일 중괄호는 무관 · env 는 변수 아님", () => {
    expect(collectStateTemplateRefs("code: \\{{ notVar }}")).toEqual([]);
    expect(collectStateTemplateRefs("{name} and {{ real }}")).toEqual(["real"]);
    expect(collectStateTemplateRefs("{{ env.API_KEY }} {{ ok }}")).toEqual([
      "ok",
    ]);
  });

  it("빈 문자열 · `{{` 없음 · 닫히지 않음 · 잘못된 이름은 0건", () => {
    expect(collectStateTemplateRefs("")).toEqual([]);
    expect(collectStateTemplateRefs("plain")).toEqual([]);
    expect(collectStateTemplateRefs("{{ open")).toEqual([]);
    expect(collectStateTemplateRefs("{{ 1abc }}")).toEqual([]);
    expect(collectStateTemplateRefs("{{ a-b }}")).toEqual([]);
  });
});

describe("collectPropsStateRefs", () => {
  it("string prop 만 · 중첩 객체/배열도 · 비문자열은 무시", () => {
    expect(
      collectPropsStateRefs({
        children: "Hi {{ user }}",
        placeholder: "{{ hint }}",
        count: 3,
        style: { color: "{{ theme }}", width: 10 },
        items: [{ label: "{{ item }}" }, "{{ user }}"],
        flag: true,
        nothing: null,
      }),
    ).toEqual(["user", "hint", "theme", "item"]);
  });

  it("참조 없는 props 는 빈 배열 (빠른 경로)", () => {
    expect(
      collectPropsStateRefs({ children: "plain", style: { color: "red" } }),
    ).toEqual([]);
    expect(collectPropsStateRefs({})).toEqual([]);
  });
});

describe("resolveStateDependencies", () => {
  const visible = [
    {
      def: {
        id: "v_local",
        name: "count",
        type: "number" as const,
        defaultValue: 0,
      },
      owner: { kind: "element" as const, elementId: "e" },
    },
    {
      def: {
        id: "v_user",
        name: "userName",
        type: "string" as const,
        defaultValue: "guest",
      },
      owner: { kind: "project" as const },
    },
  ];

  it("참조 이름을 가시 목록에서 해석 — id · type · defaultValue 를 싣는다", () => {
    expect(resolveStateDependencies(["userName", "count"], visible)).toEqual([
      { name: "userName", id: "v_user", type: "string", defaultValue: "guest" },
      { name: "count", id: "v_local", type: "number", defaultValue: 0 },
    ]);
  });

  it("미해결 이름도 항목으로 남긴다 (나중에 정의되면 digest 가 바뀌어야 하므로)", () => {
    expect(resolveStateDependencies(["missing"], visible)).toEqual([
      { name: "missing", id: null, type: null, defaultValue: undefined },
    ]);
  });

  it("참조가 없으면 undefined (scene node 필드 생략)", () => {
    expect(resolveStateDependencies([], visible)).toBeUndefined();
  });

  it("가까운 소유자가 앞이면 그것이 이긴다 (사슬 순서 = 해석 순서)", () => {
    const shadowed = [
      {
        def: {
          id: "near",
          name: "x",
          type: "string" as const,
          defaultValue: "near",
        },
        owner: { kind: "element" as const, elementId: "e" },
      },
      {
        def: {
          id: "far",
          name: "x",
          type: "string" as const,
          defaultValue: "far",
        },
        owner: { kind: "project" as const },
      },
    ];
    expect(resolveStateDependencies(["x"], shadowed)![0].id).toBe("near");
  });
});
