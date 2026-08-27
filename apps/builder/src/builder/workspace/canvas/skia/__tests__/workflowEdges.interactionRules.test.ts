// @vitest-environment node
/**
 * ADR-158 Phase 4 후속 — 캔버스 navigation 엣지의 규칙 출처 이전.
 *
 * **Why**: 종전에는 요소의 legacy `props.events` / `element.events` 를 읽었는데,
 * ADR-158 Phase 1 에서 그 mirror 파생이 끊겨 **신규 인터랙션 규칙이 캔버스에 한
 * 건도 나타나지 않았다**. 조용한 결함이라 — 엣지가 안 보이는 것과 규칙이 없는
 * 것이 화면상 같다 — 테스트로 고정한다.
 *
 * 반대 방향도 함께 잠근다: 구 문서에 남은 `SerializedEvent` entry 는 실행 경로가
 * 없으므로(패널 삭제 + 실행 쪽 `isInteractionRule` 필터) 그리면 **일어나지 않을
 * 이동을 그리는 셈**이고, 게다가 `action` 필드가 없어 가드 없이 읽으면 캔버스가
 * 통째로 죽는다.
 */
import { describe, expect, it } from "vitest";
import type { InteractionRule } from "@composition/shared";

import {
  computeWorkflowEdges,
  type WorkflowElementInput,
  type WorkflowPageInput,
} from "../workflowEdges";

const PAGES: WorkflowPageInput[] = [
  { id: "page-home", title: "Home", slug: "/" },
  { id: "page-2", title: "Page 2", slug: "/page-2" },
];

const BUTTON: WorkflowElementInput = {
  id: "btn-1",
  type: "Button",
  props: {},
  page_id: "page-home",
};

function navRule(over: Partial<InteractionRule> = {}): InteractionRule {
  return {
    id: "r1",
    type: "interaction",
    elementId: "btn-1",
    trigger: "onPress",
    action: { kind: "navigate", params: { path: "/page-2" } },
    ...over,
  } as InteractionRule;
}

describe("computeWorkflowEdges — canonical 인터랙션 규칙", () => {
  it("navigate 규칙이 event-navigation 엣지가 된다", () => {
    const edges = computeWorkflowEdges(PAGES, [BUTTON], [navRule()]);
    expect(edges).toEqual([
      {
        id: "btn-1-page-2-event-navigation",
        type: "event-navigation",
        sourcePageId: "page-home",
        targetPageId: "page-2",
        sourceElementId: "btn-1",
        label: "누를 때",
      },
    ]);
  });

  it("규칙이 없으면 엣지도 없다", () => {
    expect(computeWorkflowEdges(PAGES, [BUTTON], [])).toEqual([]);
    // 인자 자체를 생략해도 종전 호출부가 깨지지 않는다.
    expect(computeWorkflowEdges(PAGES, [BUTTON])).toEqual([]);
  });

  it("미등록 trigger 는 원문 그대로 라벨에 쓴다", () => {
    const [edge] = computeWorkflowEdges(
      PAGES,
      [BUTTON],
      [navRule({ trigger: "onWeirdThing" })],
    );
    expect(edge.label).toBe("onWeirdThing");
  });

  it("navigate 가 아닌 규칙은 엣지를 만들지 않는다", () => {
    const toast = navRule({
      action: { kind: "toast", params: { message: "hi" } },
    });
    expect(computeWorkflowEdges(PAGES, [BUTTON], [toast])).toEqual([]);
  });

  it("삭제된 요소를 가리키는 규칙은 건너뛴다", () => {
    const orphan = navRule({ elementId: "gone" });
    expect(computeWorkflowEdges(PAGES, [BUTTON], [orphan])).toEqual([]);
  });

  it("같은 페이지로 향하는 규칙은 엣지가 아니다", () => {
    const self = navRule({
      action: { kind: "navigate", params: { path: "/" } },
    });
    expect(computeWorkflowEdges(PAGES, [BUTTON], [self])).toEqual([]);
  });

  it("외부 링크·앵커는 제외한다", () => {
    const ext = navRule({
      action: { kind: "navigate", params: { path: "https://example.com" } },
    });
    const anchor = navRule({
      id: "r2",
      action: { kind: "navigate", params: { path: "#top" } },
    });
    expect(computeWorkflowEdges(PAGES, [BUTTON], [ext, anchor])).toEqual([]);
  });

  it("존재하지 않는 슬러그는 엣지를 만들지 않는다", () => {
    const nowhere = navRule({
      action: { kind: "navigate", params: { path: "/does-not-exist" } },
    });
    expect(computeWorkflowEdges(PAGES, [BUTTON], [nowhere])).toEqual([]);
  });

  it("같은 요소·같은 목적지의 규칙 2개는 엣지 1개로 합쳐진다", () => {
    const a = navRule({ id: "r1", trigger: "onPress" });
    const b = navRule({ id: "r2", trigger: "onFocus" });
    expect(computeWorkflowEdges(PAGES, [BUTTON], [a, b])).toHaveLength(1);
  });

  it("구 SerializedEvent entry 가 섞여 있어도 죽지 않는다", () => {
    // `action` 필드가 없는 구 스키마 — 가드가 없으면 여기서 TypeError.
    const legacy = {
      id: "old-1",
      type: "event",
      kind: "onClick",
      target: "btn-1",
      actionRef: "act-1",
    } as unknown as InteractionRule;

    expect(() =>
      computeWorkflowEdges(PAGES, [BUTTON], [legacy, navRule()]),
    ).not.toThrow();
    // 구 entry 는 실행되지 않으므로 그것으로 인한 엣지도 없다 — 신규 규칙 1개만.
    expect(
      computeWorkflowEdges(PAGES, [BUTTON], [legacy, navRule()]),
    ).toHaveLength(1);
  });

  it("href 기반 navigation 엣지는 종전대로 함께 나온다", () => {
    const link: WorkflowElementInput = {
      id: "link-1",
      type: "Link",
      props: { href: "/page-2" },
      page_id: "page-home",
    };
    const edges = computeWorkflowEdges(PAGES, [link, BUTTON], [navRule()]);
    expect(edges.map((e) => e.type).sort()).toEqual([
      "event-navigation",
      "navigation",
    ]);
  });
});
