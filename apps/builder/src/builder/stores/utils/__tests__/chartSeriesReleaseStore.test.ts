/**
 * ADR-209 후속 F1/T4 — Series 해제의 canonical·ref·Undo/Redo 계약.
 *
 * 패널이 실제로 부르는 `dispatchSemanticUpdateWithPropagation` → **실제 inspector store**
 * 액션을 통과한다. `updateElementProps` 직접 호출은 이 경로를 대신하지 않는다.
 */
import { afterEach, beforeEach, expect, it } from "vitest";
import { withComponentOriginMirror } from "@/adapters/canonical/componentSemanticsMirror";
import { deriveProjectRenderModelFromDocument } from "@composition/shared";

import {
  PANEL_FIXTURE_PROJECT_ID,
  resetPanelFixture,
  seedPanelElements,
} from "../../../__tests__/panelFixture";
import { dispatchSemanticUpdateWithPropagation } from "../../../panels/properties/semanticUpdateDispatch";
import { useStore } from "../../index";
import { useCanonicalDocumentStore } from "../../canonical/canonicalDocumentStore";
import { historyManager } from "../../history";

const PROJECT_UUID = "00000000-0000-0000-0000-000000000209";

const ORIGIN_PROPS = {
  chartType: "bar",
  dimension: "category",
  metric: "value",
  color: "series",
  data: [{ category: "Jan", value: 10, series: "A" }],
};

beforeEach(() => {
  resetPanelFixture();
  historyManager.setCurrentPage("page-1");
  useStore.setState({ currentPageId: "page-1" });
});
afterEach(resetPanelFixture);

function readDocument() {
  return useCanonicalDocumentStore
    .getState()
    .getDocument(PANEL_FIXTURE_PROJECT_ID)!;
}

function resolvedProps(id: string): Record<string, unknown> {
  return deriveProjectRenderModelFromDocument(
    readDocument(),
    PROJECT_UUID,
    "page-1",
  ).elements.find((element) => element.id === id)!.props;
}

/** 패널의 semantic 쓰기 한 벌 — 선택 요소를 정하고 실제 store 액션에 넘긴다. */
function releaseSeriesOnSelected(elementId: string): void {
  useStore.getState().setSelectedElement(elementId);
  const state = useStore.getState();
  const element = state.elementsMap.get(elementId)!;
  dispatchSemanticUpdateWithPropagation({
    changedProps: { color: "" },
    propagationElement: {
      id: element.id,
      type: element.type,
      props: element.props,
    },
    childrenMap: new Map(),
    elementsMap: new Map([
      [
        element.id,
        { id: element.id, type: element.type, props: element.props },
      ],
    ]),
    actions: state,
  });
}

it("ref 인스턴스의 해제는 그 인스턴스에만 빈 값 override 를 남긴다", async () => {
  seedPanelElements([
    { id: "body", type: "body", props: {}, parent_id: null, page_id: "page-1" },
    withComponentOriginMirror({
      id: "chart-origin",
      type: "Chart",
      props: { ...ORIGIN_PROPS },
      parent_id: "body",
      page_id: "page-1",
    }),
  ]);
  const first = useStore
    .getState()
    .createInstance("chart-origin", "body", "page-1")!;
  const second = useStore
    .getState()
    .createInstance("chart-origin", "body", "page-1")!;

  releaseSeriesOnSelected(first.id);
  await Promise.resolve();

  // 해제는 삭제가 아니라 **명시적 빈 값** — 삭제면 origin 의 시리즈를 다시 상속한다.
  expect(resolvedProps(first.id).color).toBe("");
  expect(resolvedProps(second.id).color).toBe("series");
  expect(resolvedProps("chart-origin").color).toBe("series");
  // 나머지 매핑·데이터 축은 변화 없음.
  expect(resolvedProps(first.id)).toMatchObject({
    dimension: "category",
    metric: "value",
    data: ORIGIN_PROPS.data,
  });
});

it("해제 → Undo → Redo 가 기존 store history 로 값을 되돌린다", async () => {
  seedPanelElements([
    { id: "body", type: "body", props: {}, parent_id: null, page_id: "page-1" },
    {
      id: "chart",
      type: "Chart",
      props: { ...ORIGIN_PROPS },
      parent_id: "body",
      page_id: "page-1",
    },
  ]);

  releaseSeriesOnSelected("chart");
  await Promise.resolve();
  expect(resolvedProps("chart").color).toBe("");

  await useStore.getState().undo();
  expect(resolvedProps("chart").color).toBe("series");

  await useStore.getState().redo();
  expect(resolvedProps("chart").color).toBe("");
});

it("이미 빈 값인 상태의 재선택은 문서를 다시 쓰지 않는다", async () => {
  seedPanelElements([
    { id: "body", type: "body", props: {}, parent_id: null, page_id: "page-1" },
    {
      id: "chart",
      type: "Chart",
      props: { ...ORIGIN_PROPS, color: "" },
      parent_id: "body",
      page_id: "page-1",
    },
  ]);
  const before = useCanonicalDocumentStore.getState().documentVersion;
  // 패널은 baseline 과 같은 값을 changedProps 에서 걸러낸다 — 그 필터를 재현한다.
  const element = useStore.getState().elementsMap.get("chart")!;
  const changed = Object.fromEntries(
    Object.entries({ color: "" }).filter(
      ([key, value]) => element.props[key] !== value,
    ),
  );
  expect(changed).toEqual({});
  expect(useCanonicalDocumentStore.getState().documentVersion).toBe(before);
});
