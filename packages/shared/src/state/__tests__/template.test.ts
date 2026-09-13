import { describe, expect, it } from "vitest";
import { compileFieldTemplate, interpolateFieldTemplate } from "../../collections/fieldTemplate";
import {
  createDefaultValueEnv,
  formatStateValue,
  resolveStateTemplate,
  resolveStateTemplateProps,
} from "../template";

const env = {
  get: (name: string) =>
    ({
      userName: "guest",
      count: 3,
      open: false,
      user: { profile: { city: "Seoul" }, tags: ["a", "b"] },
      empty: null,
    })[name as "userName"],
};

describe("resolveStateTemplate", () => {
  it("이름 · 공백 · 경로 접근 · 형식 함수 (number/boolean/object/null)", () => {
    expect(resolveStateTemplate("Hello {{ userName }}!", env)).toBe("Hello guest!");
    expect(resolveStateTemplate("{{userName}}/{{count}}/{{open}}", env)).toBe("guest/3/false");
    expect(resolveStateTemplate("{{ user.profile.city }} {{user.tags}}", env)).toBe('Seoul ["a","b"]');
    expect(resolveStateTemplate("[{{ empty }}]", env)).toBe("[]");
    expect(resolveStateTemplate("{{ user.profile.zip }}", env)).toBe("");
  });

  it("미해결 이름 · env 예약 루트 · 리터럴 \\{{ · {{ 없는 문자열은 원문 (참조 동일)", () => {
    expect(resolveStateTemplate("Hi {{ nobody }}", env)).toBe("Hi {{ nobody }}");
    expect(resolveStateTemplate("{{ env.API }}", env)).toBe("{{ env.API }}");
    expect(resolveStateTemplate("code: \\{{ userName }}", env)).toBe("code: {{ userName }}");
    const plain = "no template";
    expect(resolveStateTemplate(plain, env)).toBe(plain);
    const untouched = "{{ nobody }}";
    expect(resolveStateTemplate(untouched, env)).toBe(untouched);
  });

  it("ADR-159 {field} 와 한 문자열 — {{ }} 가 먼저 값이 되고 {field} 토큰은 그대로 남아 행 보간이 받는다", () => {
    const afterState = resolveStateTemplate("{label} — {{ userName }}", env);
    expect(afterState).toBe("{label} — guest");
    const compiled = compileFieldTemplate(afterState)!;
    expect(interpolateFieldTemplate(compiled, { label: "User 1" })).toBe("User 1 — guest");
    // field 문법에서 `{{`/`}}` 는 `{`/`}` escape 다 — 미해결 상태 토큰이 행 보간까지 가면 `{ x }` 로
    // 보인다. 그래서 순서는 반드시 `{{ }}` (노드 prop) → `{field}` (행 투영) 이다.
    expect(interpolateFieldTemplate(compileFieldTemplate("{label} {{ x }}")!, { label: "L" })).toBe("L { x }");
  });
});

describe("resolveStateTemplateProps", () => {
  it("string prop 만 · 중첩 (배열/객체) · 바뀐 것이 없으면 같은 참조", () => {
    const props = {
      children: "Hi {{ userName }}",
      count: 3,
      style: { title: "n={{ count }}", color: "red" },
      items: ["{{ userName }}", "x"],
      nested: { deep: { deeper: { d4: { d5: { d6: { d7: "{{ userName }}" } } } } } },
    };
    const out = resolveStateTemplateProps(props, env);
    expect(out).not.toBe(props);
    expect(out.children).toBe("Hi guest");
    expect(out.count).toBe(3);
    expect(out.style).toEqual({ title: "n=3", color: "red" });
    expect(out.items).toEqual(["guest", "x"]);
    // 깊이 6 초과는 스캐너 상한과 같이 건드리지 않는다
    expect(out.nested.deep.deeper.d4.d5.d6.d7).toBe("{{ userName }}");
    const plain = { children: "static", style: { color: "red" } };
    expect(resolveStateTemplateProps(plain, env)).toBe(plain);
  });

  it("createDefaultValueEnv — 가까운 소유자 우선 · 타입별 기본값", () => {
    const e = createDefaultValueEnv([
      { def: { name: "open", type: "boolean", defaultValue: true } },
      { def: { name: "open", type: "boolean", defaultValue: false } },
      { def: { name: "n", type: "number" } },
      { def: { name: "s", type: "string" } },
    ]);
    expect(e.get("open")).toBe(true);
    expect(e.get("n")).toBe(0);
    expect(e.get("s")).toBe("");
    expect(e.get("missing")).toBeUndefined();
  });

  it("formatStateValue", () => {
    expect(formatStateValue(undefined)).toBe("");
    expect(formatStateValue(1.5)).toBe("1.5");
    expect(formatStateValue({ a: 1 })).toBe('{"a":1}');
  });
});
