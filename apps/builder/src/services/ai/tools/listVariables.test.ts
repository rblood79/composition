/**
 * ADR-214 후속 — `list_variables` 읽기 tool (ADR-213 읽기 tool 4 와 같은 계약).
 *
 * - 프로젝트 (data store) · 페이지 · 요소 (canonical `state`) 정의를 소유자와 함께 한 목록으로
 * - concise = id · name · type · owner · usedBy, detailed = defaultValue · persist · source · usages 까지
 * - 쓰기 0 — 호출 전후 store 참조가 같다 · 런타임 값은 싣지 않는다 (정의만)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import { useDataStore } from "../../../builder/stores/data";
import type { ToolTranslate } from "../../../types/integrations/ai.types";
import { listVariablesTool, summarizeVariables } from "./listVariables";

const doc: CompositionDocument = {
  version: "composition-1.0",
  children: [
    {
      id: "home",
      type: "frame",
      name: "Home",
      metadata: { type: "page" },
      state: [{ id: "v-step", name: "step", type: "number", defaultValue: 1 }],
      children: [
        {
          id: "check",
          type: "Checkbox",
          props: { children: "agree={{ agree }} {{ step }}" },
          state: [
            {
              id: "v-agree",
              name: "agree",
              type: "boolean",
              defaultValue: false,
              source: { prop: "isSelected" },
            },
          ],
        },
        { id: "btn", type: "Button", props: { children: "count={{ count }}" } },
      ],
    },
  ],
  events: [
    {
      id: "r1",
      type: "interaction",
      elementId: "btn",
      trigger: "onPress",
      action: { kind: "setState", variableId: "v-count", op: "increment" },
    },
  ],
} as unknown as CompositionDocument;

vi.mock("../../../builder/stores/canonical/canonicalElementsBridge", () => ({
  getActiveCanonicalDocument: () => doc,
}));

const t: ToolTranslate = (key) => key;

beforeEach(() => {
  useDataStore.setState({
    variables: new Map([
      [
        "v-count",
        {
          id: "v-count",
          name: "count",
          type: "number",
          defaultValue: 0,
          persist: true,
          scope: "global",
          owner: { kind: "project" },
          project_id: "p1",
        } as never,
      ],
    ]),
  });
});

describe("list_variables", () => {
  it("concise — 프로젝트 · 페이지 · 요소 정의를 소유자 + usedBy 와 함께 (project 먼저)", async () => {
    const before = useDataStore.getState().variables;
    const result = await listVariablesTool.execute({}, t);
    expect(result.success).toBe(true);
    expect(result.data).toEqual([
      {
        id: "v-count",
        name: "count",
        type: "number",
        owner: { kind: "project" },
        usedBy: 2,
      },
      {
        id: "v-step",
        name: "step",
        type: "number",
        owner: { kind: "page", pageId: "home", pageTitle: "Home" },
        usedBy: 1,
      },
      {
        id: "v-agree",
        name: "agree",
        type: "boolean",
        owner: {
          kind: "element",
          elementId: "check",
          elementType: "Checkbox",
          pageId: "home",
        },
        usedBy: 1,
      },
    ]);
    expect(useDataStore.getState().variables).toBe(before);
  });

  it("detailed — defaultValue · persist · source · usages 까지", async () => {
    const result = await listVariablesTool.execute({ format: "detailed" }, t);
    const rows = result.data as Array<Record<string, unknown>>;
    expect(rows[0]).toMatchObject({
      id: "v-count",
      defaultValue: 0,
      persist: true,
      usages: [
        { kind: "template", nodeId: "btn", props: ["children"] },
        { kind: "setState", ruleId: "r1", elementId: "btn", trigger: "onPress" },
      ],
    });
    expect(rows[2]).toMatchObject({
      id: "v-agree",
      defaultValue: false,
      source: { prop: "isSelected" },
      usages: [{ kind: "template", nodeId: "check", props: ["children"] }],
    });
    expect(rows[1]).not.toHaveProperty("source");
  });

  it("문서가 없어도 프로젝트 변수는 나온다 (usedBy 0)", () => {
    expect(summarizeVariables(null, [{ id: "x", name: "x", type: "string" }])).toEqual([
      { id: "x", name: "x", type: "string", owner: { kind: "project" }, usedBy: 0 },
    ]);
  });
});
