/**
 * ADR-214 Phase 1 — 가시성 사슬 (요소 → 조상 → 페이지 → 프로젝트) + 이름 고유 검증기 (HC5).
 *
 * breakdown §4 Phase 1: "unit: 사슬 4단 · 충돌 거부 · 조상 변경 시 재검증".
 */
import { describe, expect, it } from "vitest";
import type { CompositionDocument } from "../../types/composition-document.types";
import type { VariableDef } from "../variable.types";
import {
  collectDocumentVariableNames,
  findVariableNameConflict,
  resolveVisibleVariables,
} from "../visibility";

const def = (
  id: string,
  name: string,
  extra: Partial<VariableDef> = {},
): VariableDef => ({
  id,
  name,
  type: "string",
  ...extra,
});

/**
 * page1 (state: pageVar)
 *   └ body
 *      └ card (state: cardVar)
 *         └ label (state: labelVar)
 *      └ sibling
 * page2 (layout-bound ref — descendants.content.children)
 *   └ content: item (state: itemVar)
 */
function doc(): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page1",
        type: "frame",
        metadata: { type: "page" },
        state: [def("v_page", "pageVar")],
        children: [
          {
            id: "body",
            type: "Body",
            props: {},
            children: [
              {
                id: "card",
                type: "Card",
                props: {},
                state: [
                  def("v_card", "cardVar", { type: "number", defaultValue: 0 }),
                ],
                children: [
                  {
                    id: "label",
                    type: "Text",
                    props: { children: "hi" },
                    state: [def("v_label", "labelVar")],
                  },
                ],
              },
              { id: "sibling", type: "Button", props: {} },
            ],
          },
        ],
      },
      {
        id: "page2",
        type: "ref",
        ref: "layout1",
        metadata: { type: "page", layoutId: "layout1" },
        descendants: {
          content: {
            children: [
              {
                id: "item",
                type: "Text",
                props: {},
                state: [def("v_item", "itemVar")],
              },
            ],
          },
        },
      } as CompositionDocument["children"][number],
    ],
  };
}

const project = [def("v_user", "userName", { defaultValue: "guest" })];

describe("resolveVisibleVariables — 사슬 4단", () => {
  it("요소: 자기 → 조상 → 페이지 → 프로젝트 순, 가까운 것이 앞", () => {
    const visible = resolveVisibleVariables(
      doc(),
      { kind: "element", elementId: "label" },
      project,
    );
    expect(visible.map((v) => v.def.name)).toEqual([
      "labelVar",
      "cardVar",
      "pageVar",
      "userName",
    ]);
    expect(visible.map((v) => v.owner)).toEqual([
      { kind: "element", elementId: "label" },
      { kind: "element", elementId: "card" },
      { kind: "page", pageId: "page1" },
      { kind: "project" },
    ]);
  });

  it("형제는 보이지 않는다 (서브트리 가시성)", () => {
    const visible = resolveVisibleVariables(
      doc(),
      { kind: "element", elementId: "sibling" },
      project,
    );
    expect(visible.map((v) => v.def.name)).toEqual(["pageVar", "userName"]);
  });

  it("페이지: 페이지 → 프로젝트", () => {
    const visible = resolveVisibleVariables(
      doc(),
      { kind: "page", pageId: "page1" },
      project,
    );
    expect(visible.map((v) => v.def.name)).toEqual(["pageVar", "userName"]);
  });

  it("프로젝트 (target null): 프로젝트만", () => {
    expect(
      resolveVisibleVariables(doc(), null, project).map((v) => v.def.name),
    ).toEqual(["userName"]);
  });

  it("layout-bound 페이지의 descendants 자식도 페이지 사슬에 든다", () => {
    const visible = resolveVisibleVariables(
      doc(),
      { kind: "element", elementId: "item" },
      project,
    );
    expect(visible.map((v) => v.def.name)).toEqual(["itemVar", "userName"]);
    expect(visible[0].owner).toEqual({ kind: "element", elementId: "item" });
  });

  it("문서가 없으면 프로젝트만 · 없는 요소는 프로젝트만", () => {
    expect(
      resolveVisibleVariables(
        null,
        { kind: "element", elementId: "label" },
        project,
      ),
    ).toHaveLength(1);
    expect(
      resolveVisibleVariables(
        doc(),
        { kind: "element", elementId: "nope" },
        project,
      ),
    ).toHaveLength(1);
  });
});

describe("findVariableNameConflict — 사슬 안 이름 고유 (shadowing 금지)", () => {
  it("조상 이름과 충돌 → 거부 (label 에 cardVar)", () => {
    const conflict = findVariableNameConflict(
      doc(),
      { kind: "element", elementId: "label" },
      "cardVar",
      project,
    );
    expect(conflict?.owner).toEqual({ kind: "element", elementId: "card" });
  });

  it("자손 이름과 충돌 → 거부 (card 에 labelVar — 자손 사슬이 card 를 지난다)", () => {
    const conflict = findVariableNameConflict(
      doc(),
      { kind: "element", elementId: "card" },
      "labelVar",
      project,
    );
    expect(conflict?.def.id).toBe("v_label");
  });

  it("프로젝트 이름과 충돌 → 거부 · 프로젝트에 문서 안 이름 → 거부", () => {
    expect(
      findVariableNameConflict(
        doc(),
        { kind: "element", elementId: "sibling" },
        "userName",
        project,
      )?.owner,
    ).toEqual({ kind: "project" });
    expect(
      findVariableNameConflict(doc(), { kind: "project" }, "itemVar", project)
        ?.def.id,
    ).toBe("v_item");
    expect(
      findVariableNameConflict(doc(), { kind: "project" }, "userName", project)
        ?.def.id,
    ).toBe("v_user");
  });

  it("형제 사슬은 충돌이 아니다 · 같은 id 는 자기 rename 이라 제외", () => {
    expect(
      findVariableNameConflict(
        doc(),
        { kind: "element", elementId: "sibling" },
        "cardVar",
        project,
      ),
    ).toBeNull();
    expect(
      findVariableNameConflict(
        doc(),
        { kind: "element", elementId: "label" },
        "labelVar",
        project,
        "v_label",
      ),
    ).toBeNull();
    expect(
      findVariableNameConflict(
        doc(),
        { kind: "page", pageId: "page2" },
        "cardVar",
        project,
      ),
    ).toBeNull();
  });

  it("조상이 바뀌면 (요소를 다른 부모로 옮기면) 같은 검증기가 다른 답을 낸다", () => {
    const moved = doc();
    // label 을 card 밖 (body 직계) 으로 옮긴다
    const body = moved.children[0].children![0];
    const card = body.children![0];
    const label = card.children!.pop()!;
    body.children!.push(label);
    expect(
      findVariableNameConflict(
        moved,
        { kind: "element", elementId: "label" },
        "cardVar",
        project,
      ),
    ).toBeNull();
    expect(
      findVariableNameConflict(
        doc(),
        { kind: "element", elementId: "label" },
        "cardVar",
        project,
      ),
    ).not.toBeNull();
  });

  it("이름은 trim 후 비교 · 빈 이름은 충돌 판정 대상 아님 (호출자가 먼저 거른다)", () => {
    expect(
      findVariableNameConflict(
        doc(),
        { kind: "project" },
        "  cardVar ",
        project,
      )?.def.id,
    ).toBe("v_card");
  });
});

describe("collectDocumentVariableNames", () => {
  it("문서 안 모든 노드 state 이름 (페이지 · 요소 · descendants) 을 모은다", () => {
    expect([...collectDocumentVariableNames(doc())].sort()).toEqual([
      "cardVar",
      "itemVar",
      "labelVar",
      "pageVar",
    ]);
    expect(collectDocumentVariableNames(null).size).toBe(0);
  });
});
