/**
 * ADR-214 Phase 5 — 변수 사용처 (템플릿 `{{ name }}` · setState 규칙) 집계. 삭제 확인 ·
 * 인덱스 "사용처 N" 배지가 같은 함수를 읽는다.
 */
import { describe, expect, it } from "vitest";
import type { CompositionDocument } from "../../types/composition-document.types";
import type { InteractionRule } from "../../interactions/interactionRule.types";
import { collectVariableUsages } from "../usage";

const doc: CompositionDocument = {
  version: "composition-1.0",
  children: [
    {
      id: "home",
      type: "frame",
      metadata: { type: "page" },
      state: [{ id: "v-filter", name: "filter", type: "string" }],
      children: [
        {
          id: "card",
          type: "frame",
          state: [{ id: "v-open", name: "open", type: "boolean" }],
          children: [
            // 요소 변수 open + 페이지 변수 filter + 프로젝트 변수 count 를 한 문자열에서
            { id: "t1", type: "Text", props: { children: "{{ open }} {{ filter }} {{ count }}" } },
            { id: "t2", type: "Text", props: { children: "{{ open }}", "aria-label": "{{ count }}" } },
          ],
        },
        // card 밖 — `open` 은 여기서 안 보인다 (사용처 아님, 미해결 원문)
        { id: "t3", type: "Text", props: { children: "{{ open }}" } },
      ],
    },
    {
      id: "other",
      type: "frame",
      metadata: { type: "page" },
      // 다른 페이지의 같은 이름 `filter` — home 의 filter 사용처가 아니다
      state: [{ id: "v-filter-2", name: "filter", type: "string" }],
      children: [{ id: "t4", type: "Text", props: { children: "{{ filter }}" } }],
    },
  ],
} as unknown as CompositionDocument;

const rules: InteractionRule[] = [
  { id: "r1", type: "interaction", elementId: "b1", trigger: "onPress", action: { kind: "setState", variableId: "v-open", op: "toggle" } },
  { id: "r2", type: "interaction", elementId: "b2", trigger: "onPress", action: { kind: "setState", variableId: "v-count", op: "increment" } },
  { id: "r3", type: "interaction", elementId: "b3", trigger: "onPress", action: { kind: "navigate", params: { path: "/" } } },
] as InteractionRule[];

const project = [{ id: "v-count", name: "count", type: "number" as const }];

describe("collectVariableUsages", () => {
  it("요소 변수 — 사슬 안 템플릿 2 (노드 2) + setState 규칙 1, 사슬 밖 노드는 제외", () => {
    const usages = collectVariableUsages(doc, rules, "v-open", project);
    expect(usages.map((u) => (u.kind === "template" ? `t:${u.nodeId}` : `r:${u.ruleId}`))).toEqual([
      "t:t1",
      "t:t2",
      "r:r1",
    ]);
  });

  it("페이지 변수 — 다른 페이지의 같은 이름은 제외 · 프로젝트 변수 — 노드 2 (prop 2 는 노드 1 로) + 규칙 1", () => {
    expect(collectVariableUsages(doc, rules, "v-filter", project).map((u) => u.kind === "template" ? u.nodeId : u.ruleId)).toEqual(["t1"]);
    const count = collectVariableUsages(doc, rules, "v-count", project);
    expect(count.map((u) => (u.kind === "template" ? `${u.nodeId}:${u.props.join("|")}` : u.ruleId))).toEqual([
      "t1:children",
      "t2:aria-label",
      "r2",
    ]);
  });

  it("모르는 id · 문서 없음 → 빈 목록", () => {
    expect(collectVariableUsages(doc, rules, "nope", project)).toEqual([]);
    expect(collectVariableUsages(null, rules, "v-count", project)).toEqual([{ kind: "setState", ruleId: "r2", elementId: "b2", trigger: "onPress" }]);
  });
});
