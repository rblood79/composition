/**
 * ADR-198 파일럿 케이스 2 — `catalog-state-paint`
 *
 * catalog 가 실제로 관여하는 축을 한 문서에 모은다: 토큰 색 / border / radius /
 * clip(overflow hidden) / 상태(disabled).
 *
 * 케이스 1 이 "뼈대와 단색이 맞는가" 라면, 이 케이스는 **catalog 바인딩이 두 leg 에
 * 같은 시각 결과로 도달하는가** 를 묻는다. 상태 축을 넣은 이유는 D3 발산이 기본
 * 상태에서는 안 보이다가 disabled/selected 에서만 갈리는 사례가 이 저장소에
 * 반복됐기 때문이다.
 *
 * clip 은 **의도적으로 넘치는 자식**으로 만든다 — `overflow: hidden` 컨테이너보다
 * 큰 자식을 두어 잘리는 경계가 실제로 생기게 한다. 안 넘치면 clip 이 no-op 이라
 * 이 축이 vacuous 해진다.
 */

import type { VisualParityCase } from "../harness/types";
import { caseIds, INITIAL_BUDGETS, scaffoldDocument } from "./scaffold";

const PREFIX = "state";
const ids = caseIds(PREFIX);
const CLIP = `${PREFIX}-clip`;
const OVERFLOW_CHILD = `${PREFIX}-overflow-child`;
const BUTTON_ENABLED = `${PREFIX}-button-enabled`;
const BUTTON_DISABLED = `${PREFIX}-button-disabled`;

export const catalogStatePaint: VisualParityCase = {
  id: "catalog-state-paint",
  pageId: ids.page,
  viewport: { width: 320, height: 220, dpr: 1 },
  theme: "light",
  document: scaffoldDocument({
    prefix: PREFIX,
    width: 320,
    height: 220,
    background: "#FFFFFF",
    padding: 16,
    children: [
      {
        // clip 컨테이너 — 자식이 넘치도록 만들어 잘리는 경계를 실제로 만든다
        id: CLIP,
        type: "frame",
        props: {
          style: {
            display: "block",
            width: "140px",
            height: "80px",
            overflow: "hidden",
            borderRadius: "16px",
            backgroundColor: "#2F6FED",
            boxSizing: "border-box",
          },
        },
        children: [
          {
            id: OVERFLOW_CHILD,
            type: "frame",
            props: {
              style: {
                display: "block",
                // 부모(140x80)보다 크다 — clip 이 실제로 잘라야 한다
                width: "200px",
                height: "120px",
                backgroundColor: "#E8443F",
                boxSizing: "border-box",
              },
            },
          },
        ],
      },
      {
        // 상태 축 — 같은 catalog 컴포넌트의 enabled / disabled 쌍
        id: BUTTON_ENABLED,
        type: "Button",
        props: {
          children: "Enabled",
          variant: "accent",
          fillStyle: "fill",
          size: "md",
          isDisabled: false,
        },
      },
      {
        id: BUTTON_DISABLED,
        type: "Button",
        props: {
          children: "Disabled",
          variant: "accent",
          fillStyle: "fill",
          size: "md",
          isDisabled: true,
        },
      },
    ],
  }),
  artboardNodeId: ids.page,
  expectedNodeIds: [
    ids.body,
    CLIP,
    OVERFLOW_CHILD,
    BUTTON_ENABLED,
    BUTTON_DISABLED,
  ],
  regions: [
    {
      id: "clip-fill",
      nodeIds: [CLIP],
      kind: "non-text",
      ...INITIAL_BUDGETS.nonText,
    },
    {
      id: "clip-boundary",
      nodeIds: [CLIP, OVERFLOW_CHILD],
      kind: "edge",
      reason: "radius 16 clip 경계 — 넘치는 자식이 잘리는 자리",
      ...INITIAL_BUDGETS.edge,
    },
    {
      id: "button-enabled-fill",
      nodeIds: [BUTTON_ENABLED],
      kind: "non-text",
      ...INITIAL_BUDGETS.nonText,
    },
    {
      id: "button-disabled-fill",
      nodeIds: [BUTTON_DISABLED],
      kind: "non-text",
      reason: "disabled 상태의 catalog 토큰이 두 leg 에 같은 값으로 도달하는가",
      ...INITIAL_BUDGETS.nonText,
    },
    {
      id: "button-labels",
      nodeIds: [BUTTON_ENABLED, BUTTON_DISABLED],
      kind: "text",
      reason: "버튼 라벨 — 폰트 rasterization 축",
      ...INITIAL_BUDGETS.text,
    },
    {
      id: "state-geometry",
      nodeIds: [CLIP, BUTTON_ENABLED, BUTTON_DISABLED],
      kind: "geometry",
    },
  ],
};
