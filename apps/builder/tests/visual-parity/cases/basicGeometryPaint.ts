/**
 * ADR-198 파일럿 케이스 1 — `basic-geometry-paint`
 *
 * 텍스트 0, 래스터 0. 중첩 컨테이너 + border/radius + 단색 fill 만.
 * 폰트 로딩과 이미지 디코드를 배제해 **geometry 와 단색 paint** 만 남긴다 —
 * 이 케이스가 실패하면 나머지 두 케이스의 실패는 해석할 수 없다.
 *
 * `harness/fixture.ts` 의 파일럿 문서를 케이스 계약으로 승격한 것이다. 색은
 * hex8 로 둔다 — 사용자가 실제로 오소링하는 형태이고, Skia catalog 채널이 hex6
 * 전용이라는 사실은 이 케이스가 드러내야 할 대상이지 회피할 대상이 아니다
 * (measurement-validity §1 Q2).
 */

import type { VisualParityCase } from "../harness/types";
import { caseIds, INITIAL_BUDGETS, scaffoldDocument } from "./scaffold";

const PREFIX = "basic";
const ids = caseIds(PREFIX);
const OUTER = `${PREFIX}-outer`;
const INNER = `${PREFIX}-inner`;

const COLORS = {
  body: "#FFFFFFFF",
  outer: "#2F6FEDFF",
  inner: "#E8443FFF",
  border: "#102A5CFF",
} as const;

export const basicGeometryPaint: VisualParityCase = {
  id: "basic-geometry-paint",
  pageId: ids.page,
  viewport: { width: 240, height: 180, dpr: 1 },
  theme: "light",
  document: scaffoldDocument({
    prefix: PREFIX,
    width: 240,
    height: 180,
    background: COLORS.body,
    padding: 20,
    children: [
      {
        id: OUTER,
        type: "frame",
        props: {
          style: {
            display: "block",
            width: "160px",
            height: "110px",
            paddingTop: "24px",
            paddingRight: "24px",
            paddingBottom: "24px",
            paddingLeft: "24px",
            backgroundColor: COLORS.outer,
            borderRadius: "12px",
            borderTopWidth: "2px",
            borderRightWidth: "2px",
            borderBottomWidth: "2px",
            borderLeftWidth: "2px",
            borderTopStyle: "solid",
            borderRightStyle: "solid",
            borderBottomStyle: "solid",
            borderLeftStyle: "solid",
            borderTopColor: COLORS.border,
            borderRightColor: COLORS.border,
            borderBottomColor: COLORS.border,
            borderLeftColor: COLORS.border,
            boxSizing: "border-box",
          },
        },
        children: [
          {
            id: INNER,
            type: "frame",
            props: {
              style: {
                display: "block",
                width: "60px",
                height: "40px",
                backgroundColor: COLORS.inner,
                boxSizing: "border-box",
              },
            },
          },
        ],
      },
    ],
  }),
  artboardNodeId: ids.page,
  expectedNodeIds: [ids.body, OUTER, INNER],
  regions: [
    {
      id: "body-fill",
      nodeIds: [ids.body],
      kind: "non-text",
      ...INITIAL_BUDGETS.nonText,
    },
    {
      id: "outer-fill",
      nodeIds: [OUTER],
      kind: "non-text",
      ...INITIAL_BUDGETS.nonText,
    },
    {
      id: "outer-border-radius",
      nodeIds: [OUTER],
      kind: "edge",
      reason: "radius 12 + border 2 의 AA 밴드 — SW↔GL 도 여기서만 갈린다",
      ...INITIAL_BUDGETS.edge,
    },
    {
      id: "inner-fill",
      nodeIds: [INNER],
      kind: "non-text",
      ...INITIAL_BUDGETS.nonText,
    },
    {
      id: "nesting-geometry",
      nodeIds: [ids.body, OUTER, INNER],
      kind: "geometry",
    },
  ],
};
