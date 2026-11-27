// ADR-321 Phase 0 — P1 의 대조 목록 (제품 코드도 시제품도 아니다). 설치된 react-aria 3.53.1 · react-stately
// 3.51.0 의 private steplist hook 을 v3 StepList 와 같은 DOM (`ol > li > a`) 으로 그대로 그린다. 시제품
// (`adr321Prototypes.mjs`) 은 이 파일을 import 하지 않는다 — 실행 스크립트가 두 목록의 속성을 나란히 읽는다.
import { createElement as h, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Item } from "react-stately";
import { useStepList } from "../node_modules/react-aria/dist/private/steplist/useStepList.mjs";
import { useStepListItem } from "../node_modules/react-aria/dist/private/steplist/useStepListItem.mjs";
import { useStepListState } from "../node_modules/react-stately/dist/private/steplist/useStepListState.mjs";

function V3Step({ item, state }) {
  const ref = useRef(null);
  const { stepProps } = useStepListItem({ key: item.key }, state, ref);
  return h(
    "li",
    null,
    h("a", { ...stepProps, ref, "data-step": item.key }, item.rendered),
  );
}

function V3StepList({ fixture }) {
  const props = {
    children: fixture.steps.map((step) =>
      h(Item, { key: step.key }, step.label),
    ),
    defaultSelectedKey: fixture.selectedKey,
    defaultLastCompletedStep: fixture.lastCompletedStep,
    disabledKeys: fixture.disabledKeys,
  };
  const state = useStepListState(props);
  const ref = useRef(null);
  const { listProps } = useStepList(props, state, ref);
  return h(
    "ol",
    { ...listProps, ref, "data-v3-list": fixture.id },
    [...state.collection].map((item) =>
      h(V3Step, { key: item.key, item, state }),
    ),
  );
}

export function mountReference(fixtures) {
  const host = document.createElement("div");
  host.style.cssText = "margin:16px;display:flex;flex-direction:column;gap:8px";
  document.body.append(host);
  createRoot(host).render(
    fixtures.map((fixture) => h(V3StepList, { key: fixture.id, fixture })),
  );
}
