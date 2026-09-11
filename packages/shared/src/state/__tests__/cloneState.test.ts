/**
 * ADR-214 Phase 1 — 복제 범위의 VariableDef id 재발급 + `setState.variableId` rewrite (HC2 · R9).
 */
import { describe, expect, it } from "vitest";
import {
  reissueVariableDefIds,
  rewriteVariableRefs,
  remapClonedState,
} from "../cloneState";

const ids = (() => {
  let n = 0;
  return () => `new_${++n}`;
})();

describe("reissueVariableDefIds", () => {
  it("state 배열마다 새 id 를 발급하고 old→new 맵을 돌려준다 (다른 필드 보존)", () => {
    const nodes = [
      {
        id: "a",
        state: [
          { id: "v1", name: "x", type: "string" as const, defaultValue: "1" },
        ],
      },
      { id: "b" },
      {
        id: "c",
        state: [
          { id: "v2", name: "y", type: "number" as const },
          { id: "v3", name: "z", type: "boolean" as const },
        ],
      },
    ];
    const { nodes: out, idMap } = reissueVariableDefIds(nodes, () => ids());
    expect(idMap.size).toBe(3);
    expect(out[0].state![0]).toEqual({
      id: idMap.get("v1"),
      name: "x",
      type: "string",
      defaultValue: "1",
    });
    expect(out[1]).toBe(nodes[1]); // state 없는 노드는 같은 참조
    expect(out[2].state!.map((d) => d.id)).toEqual([
      idMap.get("v2"),
      idMap.get("v3"),
    ]);
    expect(new Set(idMap.values()).size).toBe(3);
    // 원본 불변
    expect(nodes[0].state?.[0].id).toBe("v1");
  });

  it("VariableDef 가 아닌 state 값은 버린다 (가드) · 빈 배열은 필드 제거", () => {
    const { nodes: out } = reissueVariableDefIds(
      [
        {
          id: "a",
          state: [
            { id: "v1", name: "x", type: "string" as const },
            { bogus: true } as never,
          ],
        },
        { id: "b", state: [] },
      ],
      () => ids(),
    );
    expect(out[0].state).toHaveLength(1);
    expect("state" in out[1]).toBe(false);
  });
});

describe("rewriteVariableRefs", () => {
  it("kind:setState 액션의 variableId 를 맵으로 바꾼다 — 맵에 없으면 그대로", () => {
    const idMap = new Map([["v1", "n1"]]);
    const rules = [
      {
        id: "r1",
        type: "interaction",
        elementId: "a",
        trigger: "onPress",
        action: { kind: "setState", variableId: "v1", op: "set", value: 1 },
      },
      {
        id: "r2",
        type: "interaction",
        elementId: "a",
        trigger: "onPress",
        action: { kind: "setState", variableId: "v9", op: "toggle" },
      },
      {
        id: "r3",
        type: "interaction",
        elementId: "a",
        trigger: "onPress",
        action: { kind: "toast", params: { message: "hi" } },
      },
    ];
    const out = rewriteVariableRefs(rules, idMap);
    expect((out[0].action as { variableId: string }).variableId).toBe("n1");
    expect((out[1].action as { variableId: string }).variableId).toBe("v9");
    expect(out[2]).toBe(rules[2]); // 무관한 액션은 같은 참조
    expect((rules[0].action as { variableId: string }).variableId).toBe("v1"); // 원본 불변
  });

  it("중첩 객체 · 배열 안의 setState 도 찾는다 (미래 chain 형태 대비)", () => {
    const out = rewriteVariableRefs(
      {
        list: [{ kind: "setState", variableId: "v1" }],
        nested: { deeper: { kind: "setState", variableId: "v1" } },
      },
      new Map([["v1", "n1"]]),
    );
    expect(out).toEqual({
      list: [{ kind: "setState", variableId: "n1" }],
      nested: { deeper: { kind: "setState", variableId: "n1" } },
    });
  });
});

describe("remapClonedState — 한 pass", () => {
  it("노드 state id 재발급 + 같은 범위 rule 의 setState 참조 rewrite", () => {
    const result = remapClonedState({
      nodes: [
        { id: "a", state: [{ id: "v1", name: "x", type: "string" as const }] },
      ],
      rules: [
        { id: "r", action: { kind: "setState", variableId: "v1", op: "set" } },
      ],
      generateId: () => "fresh",
    });
    expect(result.nodes[0].state![0].id).toBe("fresh");
    expect((result.rules[0].action as { variableId: string }).variableId).toBe(
      "fresh",
    );
    expect(result.idMap.get("v1")).toBe("fresh");
  });

  it("state 가 하나도 없으면 입력을 그대로 돌려준다 (no-op — 참조 유지)", () => {
    const nodes: Array<{ id: string; state?: never }> = [{ id: "a" }];
    const rules = [{ id: "r", action: { kind: "toast" } }];
    const result = remapClonedState({ nodes, rules });
    expect(result.nodes).toBe(nodes);
    expect(result.rules).toBe(rules);
    expect(result.idMap.size).toBe(0);
  });
});
